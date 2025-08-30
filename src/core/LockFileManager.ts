/**
 * LockFileManager.ts - Atomic lock file operations with comprehensive signal handling
 *
 * CRITICAL FEATURES:
 * 1. Atomic lock file operations
 * 2. Process lifecycle tracking with heartbeat
 * 3. Resume from interruption support
 * 4. ALL signal handling (SIGINT, SIGTERM, SIGHUP, etc.)
 * 5. Synchronous cleanup in exit handlers
 * 6. Cross-platform compatibility (Windows + Unix)
 * 7. Stale lock detection and cleanup
 */

import { promises as fs, writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs'
import { join, dirname, basename, resolve } from 'path'
import { EventEmitter } from 'events'
import { promisify } from 'util'
import { spawn } from 'child_process'

/**
 * Lock file content structure
 */
export interface LockInfo {
    pid: number;
    startTime: Date;
    lastUpdate: Date;
    status: 'running' | 'interrupted' | 'completed' | 'failed';
    phase: string;
    progress: {
        current: number;
        total: number;
        percentage: number;
    };
    projectPath: string;
    version: string;
    platform: string;
    nodeVersion: string;
    memoryUsage?: {
        rss: number;
        heapUsed: number;
        heapTotal: number;
        external: number;
    };
    metadata?: Record<string, any>;
}

/**
 * Lock check result
 */
export interface LockCheckResult {
    isLocked: boolean;
    lockInfo?: LockInfo;
    canResume: boolean;
    isStale: boolean;
    lockFilePath: string;
    error?: Error;
}

/**
 * Lock operation result
 */
export interface LockOperationResult {
    success: boolean;
    lockInfo: LockInfo;
    resumed: boolean;
    error?: Error;
}

/**
 * Heartbeat configuration
 */
interface HeartbeatConfig {
    interval: number; // milliseconds
    enabled: boolean;
    maxMissedBeats: number;
}

/**
 * Cross-platform process checker
 */
class ProcessChecker {
  /**
     * Check if a process is still running
     */
  static async isProcessRunning(pid: number): Promise<boolean> {
    if (pid <= 0) return false

    try {
      if (process.platform === 'win32') {
        // Windows: use tasklist command
        // spawn already imported at top
        return new Promise<boolean>((resolve) => {
          const child = spawn('tasklist', ['/FI', `PID eq ${pid}`], { stdio: 'pipe' })
          let output = ''

          child.stdout.on('data', (data: Buffer) => {
            output += data.toString()
          })

          child.on('close', (code: number) => {
            resolve(output.includes(pid.toString()))
          })

          child.on('error', () => resolve(false))
        })
      } else {
        // Unix-like: use kill with signal 0
        process.kill(pid, 0)
        return true
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException
      if (err.code === 'ESRCH') {
        // Process not found
        return false
      } else if (err.code === 'EPERM') {
        // Process exists but no permission to signal
        return true
      }
      // Other errors - assume process doesn't exist
      return false
    }
  }

  /**
     * Get current process memory usage
     */
  static getMemoryUsage(): LockInfo['memoryUsage'] {
    const usage = process.memoryUsage()
    return {
      rss: usage.rss,
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external
    }
  }
}

/**
 * Atomic lock file manager with comprehensive process lifecycle support
 */
export class LockFileManager extends EventEmitter {
  private lockFilePath: string
  private lockInfo: LockInfo | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private heartbeatConfig: HeartbeatConfig
  private destroyed = false
  private exitHandlersRegistered = false
  private gracefulShutdown = false
  private readonly LOCK_FILE_NAME = '.documentor.lock'

  constructor(
    projectPath: string,
    heartbeatConfig: Partial<HeartbeatConfig> = {}
  ) {
    super()

    this.lockFilePath = join(resolve(projectPath), this.LOCK_FILE_NAME)
    this.heartbeatConfig = {
      interval: 5000, // 5 seconds
      enabled: true,
      maxMissedBeats: 3,
      ...heartbeatConfig
    }

    // Register exit handlers
    this.registerExitHandlers()
  }

  /**
     * Register all possible exit handlers for cleanup
     */
  private registerExitHandlers(): void {
    if (this.exitHandlersRegistered) return

    const cleanup = () => {
      this.gracefulShutdown = true
      this.cleanupSync()
    }

    // Standard signals
    process.on('exit', cleanup)
    process.on('SIGINT', cleanup)   // Ctrl+C
    process.on('SIGTERM', cleanup)  // Termination request
    process.on('SIGHUP', cleanup)   // Hangup
    process.on('SIGQUIT', cleanup)  // Quit

    // Error handlers
    process.on('uncaughtException', (error) => {
      this.emit('uncaught_exception', error)
      cleanup()
    })

    process.on('unhandledRejection', (reason) => {
      this.emit('unhandled_rejection', reason)
      cleanup()
    })

    // Windows-specific signals
    if (process.platform === 'win32') {
      process.on('SIGBREAK', cleanup) // Ctrl+Break on Windows
    }

    this.exitHandlersRegistered = true
  }

  /**
     * Create initial lock info structure
     */
  private createLockInfo(projectPath: string, resuming = false): LockInfo {
    const now = new Date()
    return {
      pid: process.pid,
      startTime: resuming ? (this.lockInfo?.startTime || now) : now,
      lastUpdate: now,
      status: 'running',
      phase: 'initializing',
      progress: {
        current: 0,
        total: 0,
        percentage: 0
      },
      projectPath: resolve(projectPath),
      version: '2.0.0', // DocuMentor version
      platform: process.platform,
      nodeVersion: process.version,
      memoryUsage: ProcessChecker.getMemoryUsage(),
      metadata: {}
    }
  }

  /**
     * Check for existing lock and determine if we can proceed
     */
  async checkAndCreate(projectPath: string): Promise<LockCheckResult> {
    if (this.destroyed) {
      return {
        isLocked: false,
        canResume: false,
        isStale: false,
        lockFilePath: this.lockFilePath,
        error: new Error('LockFileManager destroyed')
      }
    }

    try {
      // Check if lock file exists
      if (!existsSync(this.lockFilePath)) {
        // No lock file - we can create one
        const lockInfo = this.createLockInfo(projectPath)
        const result = await this.createLockFile(lockInfo)

        return {
          isLocked: false,
          canResume: false,
          isStale: false,
          lockFilePath: this.lockFilePath,
          error: result.success ? undefined : result.error
        }
      }

      // Lock file exists - read and analyze
      const existingLock = await this.readLockFile()
      if (!existingLock) {
        // Corrupted lock file - clean up and create new
        await this.cleanup()
        const lockInfo = this.createLockInfo(projectPath)
        const result = await this.createLockFile(lockInfo)

        return {
          isLocked: false,
          canResume: false,
          isStale: true,
          lockFilePath: this.lockFilePath,
          error: result.success ? undefined : result.error
        }
      }

      // Check if the process is still running
      const isProcessRunning = await ProcessChecker.isProcessRunning(existingLock.pid)
      const timeSinceUpdate = Date.now() - new Date(existingLock.lastUpdate).getTime()
      const isStale = !isProcessRunning || timeSinceUpdate > (this.heartbeatConfig.interval * this.heartbeatConfig.maxMissedBeats)

      if (isStale) {
        this.emit('stale_lock_detected', {
          pid: existingLock.pid,
          lastUpdate: existingLock.lastUpdate,
          timeSinceUpdate,
          processRunning: isProcessRunning
        })

        // Clean up stale lock and create new one
        await this.cleanup()
        const lockInfo = this.createLockInfo(projectPath)
        const result = await this.createLockFile(lockInfo)

        return {
          isLocked: false,
          canResume: existingLock.status === 'interrupted',
          isStale: true,
          lockInfo: existingLock,
          lockFilePath: this.lockFilePath,
          error: result.success ? undefined : result.error
        }
      }

      // Active lock exists
      return {
        isLocked: true,
        canResume: existingLock.status === 'interrupted',
        isStale: false,
        lockInfo: existingLock,
        lockFilePath: this.lockFilePath
      }

    } catch (error) {
      return {
        isLocked: false,
        canResume: false,
        isStale: false,
        lockFilePath: this.lockFilePath,
        error: error as Error
      }
    }
  }

  /**
     * Create new lock file atomically
     */
  private async createLockFile(lockInfo: LockInfo): Promise<LockOperationResult> {
    try {
      // Ensure directory exists
      await fs.mkdir(dirname(this.lockFilePath), { recursive: true })

      // Write lock file atomically
      const tempPath = `${this.lockFilePath}.tmp`
      const lockContent = JSON.stringify(lockInfo, null, 2)

      await fs.writeFile(tempPath, lockContent, 'utf8')
      await fs.rename(tempPath, this.lockFilePath)

      this.lockInfo = lockInfo
      this.startHeartbeat()

      this.emit('lock_created', { lockInfo, lockFilePath: this.lockFilePath })

      return {
        success: true,
        lockInfo,
        resumed: false
      }

    } catch (error) {
      return {
        success: false,
        lockInfo,
        resumed: false,
        error: error as Error
      }
    }
  }

  /**
     * Resume from existing lock (for interrupted processes)
     */
  async resume(): Promise<LockOperationResult> {
    if (this.destroyed) {
      return {
        success: false,
        lockInfo: this.createLockInfo(''),
        resumed: false,
        error: new Error('LockFileManager destroyed')
      }
    }

    try {
      const existingLock = await this.readLockFile()
      if (!existingLock) {
        return {
          success: false,
          lockInfo: this.createLockInfo(''),
          resumed: false,
          error: new Error('No lock file to resume from')
        }
      }

      // Update lock info for resume
      const resumedLock: LockInfo = {
        ...existingLock,
        pid: process.pid,
        lastUpdate: new Date(),
        status: 'running',
        phase: 'resuming',
        memoryUsage: ProcessChecker.getMemoryUsage()
      }

      // Update lock file
      const result = await this.updateLockFile(resumedLock)
      if (result.success) {
        this.lockInfo = resumedLock
        this.startHeartbeat()

        this.emit('lock_resumed', {
          lockInfo: resumedLock,
          lockFilePath: this.lockFilePath,
          originalPid: existingLock.pid
        })

        return {
          success: true,
          lockInfo: resumedLock,
          resumed: true
        }
      }

      return result

    } catch (error) {
      return {
        success: false,
        lockInfo: this.createLockInfo(''),
        resumed: false,
        error: error as Error
      }
    }
  }

  /**
     * Read lock file content
     */
  private async readLockFile(): Promise<LockInfo | null> {
    try {
      const content = await fs.readFile(this.lockFilePath, 'utf8')
      const lockInfo = JSON.parse(content) as LockInfo

      // Validate required fields
      if (!lockInfo.pid || !lockInfo.startTime || !lockInfo.lastUpdate) {
        return null
      }

      // Convert date strings back to Date objects
      lockInfo.startTime = new Date(lockInfo.startTime)
      lockInfo.lastUpdate = new Date(lockInfo.lastUpdate)

      return lockInfo
    } catch (error) {
      this.emit('lock_read_error', { error, lockFilePath: this.lockFilePath })
      return null
    }
  }

  /**
     * Update lock file with current info
     */
  async updateLockFile(updates: Partial<LockInfo>): Promise<LockOperationResult> {
    if (this.destroyed || !this.lockInfo) {
      return {
        success: false,
        lockInfo: this.lockInfo || this.createLockInfo(''),
        resumed: false,
        error: new Error('No active lock to update')
      }
    }

    try {
      const updatedLock: LockInfo = {
        ...this.lockInfo,
        ...updates,
        lastUpdate: new Date(),
        memoryUsage: ProcessChecker.getMemoryUsage()
      }

      // Write atomically
      const tempPath = `${this.lockFilePath}.tmp`
      const lockContent = JSON.stringify(updatedLock, null, 2)

      await fs.writeFile(tempPath, lockContent, 'utf8')
      await fs.rename(tempPath, this.lockFilePath)

      this.lockInfo = updatedLock
      this.emit('lock_updated', { lockInfo: updatedLock })

      return {
        success: true,
        lockInfo: updatedLock,
        resumed: false
      }

    } catch (error) {
      return {
        success: false,
        lockInfo: this.lockInfo,
        resumed: false,
        error: error as Error
      }
    }
  }

  /**
     * Update progress information
     */
  async updateProgress(current: number, total: number, phase?: string): Promise<void> {
    if (this.destroyed || !this.lockInfo) return

    const percentage = total > 0 ? Math.round((current / total) * 100) : 0
    const updates: Partial<LockInfo> = {
      progress: { current, total, percentage }
    }

    if (phase) {
      updates.phase = phase
    }

    await this.updateLockFile(updates)
  }

  /**
     * Mark process as completed
     */
  async complete(): Promise<void> {
    if (this.destroyed || !this.lockInfo) return

    await this.updateLockFile({
      status: 'completed',
      progress: {
        current: this.lockInfo.progress.total,
        total: this.lockInfo.progress.total,
        percentage: 100
      }
    })

    this.stopHeartbeat()
    this.emit('process_completed', { lockInfo: this.lockInfo })
  }

  /**
     * Mark process as failed
     */
  async fail(error?: Error): Promise<void> {
    if (this.destroyed || !this.lockInfo) return

    const updates: Partial<LockInfo> = {
      status: 'failed'
    }

    if (error) {
      updates.metadata = {
        ...this.lockInfo.metadata,
        error: {
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        }
      }
    }

    await this.updateLockFile(updates)
    this.stopHeartbeat()
    this.emit('process_failed', { lockInfo: this.lockInfo, error })
  }

  /**
     * Start heartbeat mechanism
     */
  private startHeartbeat(): void {
    if (!this.heartbeatConfig.enabled || this.heartbeatTimer || this.destroyed) {
      return
    }

    this.heartbeatTimer = setInterval(async () => {
      if (this.destroyed || !this.lockInfo) {
        this.stopHeartbeat()
        return
      }

      try {
        await this.updateLockFile({
          memoryUsage: ProcessChecker.getMemoryUsage()
        })
        this.emit('heartbeat', { timestamp: new Date(), pid: process.pid })
      } catch (error) {
        this.emit('heartbeat_error', { error, timestamp: new Date() })
      }
    }, this.heartbeatConfig.interval)

    this.emit('heartbeat_started', {
      interval: this.heartbeatConfig.interval,
      pid: process.pid
    })
  }

  /**
     * Stop heartbeat mechanism
     */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
      this.emit('heartbeat_stopped', { pid: process.pid })
    }
  }

  /**
     * Get current lock information
     */
  getLockInfo(): LockInfo | null {
    return this.lockInfo
  }

  /**
     * Check if manager has an active lock
     */
  hasActiveLock(): boolean {
    return this.lockInfo !== null && !this.destroyed
  }

  /**
     * Synchronous cleanup for exit handlers
     * MUST be synchronous to work in process exit handlers
     */
  private cleanupSync(): void {
    if (this.destroyed) return

    try {
      // Stop heartbeat
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer)
        this.heartbeatTimer = null
      }

      if (this.lockInfo && existsSync(this.lockFilePath)) {
        if (this.gracefulShutdown) {
          // Mark as interrupted for potential resume
          const interruptedLock: LockInfo = {
            ...this.lockInfo,
            status: 'interrupted',
            lastUpdate: new Date(),
            metadata: {
              ...this.lockInfo.metadata,
              interrupted: {
                timestamp: new Date().toISOString(),
                reason: 'graceful_shutdown'
              }
            }
          }

          // Synchronous write for exit handler
          writeFileSync(this.lockFilePath, JSON.stringify(interruptedLock, null, 2), 'utf8')
          this.emit('lock_interrupted', { lockInfo: interruptedLock })
        } else {
          // Remove lock file completely
          unlinkSync(this.lockFilePath)
          this.emit('lock_removed', { lockFilePath: this.lockFilePath })
        }
      }

      this.lockInfo = null
      this.destroyed = true

    } catch (error) {
      // Ignore errors during cleanup - we're shutting down
      this.emit('cleanup_error', error)
    }
  }

  /**
     * Asynchronous cleanup
     */
  async cleanup(): Promise<void> {
    if (this.destroyed) return

    try {
      this.stopHeartbeat()

      if (this.lockInfo && existsSync(this.lockFilePath)) {
        await fs.unlink(this.lockFilePath)
        this.emit('lock_removed', { lockFilePath: this.lockFilePath })
      }

      this.lockInfo = null
      this.removeAllListeners()
      this.destroyed = true

      this.emit('cleanup_complete')

    } catch (error) {
      this.emit('cleanup_error', error)
    }
  }

  /**
     * Force cleanup (remove lock file even if process might be running)
     */
  async forceCleanup(): Promise<void> {
    try {
      if (existsSync(this.lockFilePath)) {
        await fs.unlink(this.lockFilePath)
        this.emit('force_cleanup', { lockFilePath: this.lockFilePath })
      }
    } catch (error) {
      this.emit('cleanup_error', error)
    }
  }

  /**
     * Destroy the manager
     */
  destroy(): void {
    this.cleanupSync()
  }
}

/**
 * Factory function to create lock manager
 */
export function createLockFileManager(
  projectPath: string,
  heartbeatConfig?: Partial<HeartbeatConfig>
): LockFileManager {
  return new LockFileManager(projectPath, heartbeatConfig)
}

/**
 * Utility functions
 */
export class LockUtils {
  /**
     * Check if a lock file exists and get its info
     */
  static async getLockInfo(projectPath: string): Promise<LockInfo | null> {
    const lockFilePath = join(resolve(projectPath), '.documentor.lock')

    try {
      if (!existsSync(lockFilePath)) {
        return null
      }

      const content = readFileSync(lockFilePath, 'utf8')
      const lockInfo = JSON.parse(content) as LockInfo

      // Convert date strings back to Date objects
      lockInfo.startTime = new Date(lockInfo.startTime)
      lockInfo.lastUpdate = new Date(lockInfo.lastUpdate)

      return lockInfo
    } catch (error) {
      return null
    }
  }

  /**
     * Check if a process is stale
     */
  static async isLockStale(lockInfo: LockInfo, maxAge = 60000): Promise<boolean> {
    const isProcessRunning = await ProcessChecker.isProcessRunning(lockInfo.pid)
    const timeSinceUpdate = Date.now() - new Date(lockInfo.lastUpdate).getTime()

    return !isProcessRunning || timeSinceUpdate > maxAge
  }

  /**
     * Clean up stale lock files
     */
  static async cleanupStaleLocks(projectPath: string): Promise<boolean> {
    const lockInfo = await LockUtils.getLockInfo(projectPath)

    if (!lockInfo) {
      return false // No lock file to clean
    }

    const isStale = await LockUtils.isLockStale(lockInfo)

    if (isStale) {
      const lockFilePath = join(resolve(projectPath), '.documentor.lock')
      try {
        unlinkSync(lockFilePath)
        return true
      } catch (error) {
        return false
      }
    }

    return false
  }
}
