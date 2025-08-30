/**
 * Unified Lock File Manager
 * Manages lock files with consistent format for TUI compatibility
 */

import * as fs from 'fs'
import * as path from 'path'
import { formatLocalTimestamp } from '../utils/datetime'
import { Logger } from './Logger'

/**
 * Lock file data structure that matches TUI expectations
 */
export interface LockFileData {
  // Core fields expected by TUI
  pid: number
  status: 'running' | 'interrupted' | 'completed' | 'failed' | 'starting'
  createdAt: string  // ISO timestamp
  updatedAt: string  // ISO timestamp
  
  // Phase tracking
  phase: number      // Current phase number (1-9)
  totalPhases: number
  phaseName: string
  subPhase?: string
  
  // Progress tracking
  filesProcessed: number
  filesTotal: number
  currentFile?: string
  
  // Project info
  projectPath: string
  outputPath: string
  
  // Optional fields
  error?: string
  completedTasks?: string[]
  metadata?: Record<string, any>
}

/**
 * Unified Lock File Manager
 */
export class LockFileManager {
  private lockFilePath: string
  private updateInterval: NodeJS.Timeout | null = null
  private lockData: LockFileData | null = null

  constructor(projectPath: string) {
    this.lockFilePath = path.join(projectPath, '.documentor.lock')
  }

  /**
   * Create a new lock file
   */
  async create(projectPath: string, outputPath: string): Promise<void> {
    this.lockData = {
      pid: process.pid,
      status: 'starting',
      createdAt: formatLocalTimestamp(),
      updatedAt: formatLocalTimestamp(),
      phase: 0,
      totalPhases: 9,
      phaseName: 'Initialization',
      filesProcessed: 0,
      filesTotal: 0,
      projectPath,
      outputPath,
      completedTasks: []
    }

    await this.write()
    this.startAutoUpdate()
  }

  /**
   * Read existing lock file
   */
  async read(): Promise<LockFileData | null> {
    try {
      if (!fs.existsSync(this.lockFilePath)) {
        return null
      }
      
      const content = await fs.promises.readFile(this.lockFilePath, 'utf-8')
      this.lockData = JSON.parse(content)
      return this.lockData
    } catch (error) {
      Logger.error(`Failed to read lock file: ${(error as Error).message}`)
      return null
    }
  }

  /**
   * Update lock file with new data
   */
  async update(updates: Partial<LockFileData>): Promise<void> {
    if (!this.lockData) {
      await this.read()
    }
    
    if (this.lockData) {
      this.lockData = {
        ...this.lockData,
        ...updates,
        updatedAt: formatLocalTimestamp()
      }
      await this.write()
    }
  }

  /**
   * Update phase information
   */
  async updatePhase(phase: number, phaseName: string, subPhase?: string): Promise<void> {
    await this.update({
      phase,
      phaseName,
      subPhase,
      status: 'running'
    })
  }

  /**
   * Update file progress
   */
  async updateFileProgress(processed: number, total: number, currentFile?: string): Promise<void> {
    await this.update({
      filesProcessed: processed,
      filesTotal: total,
      currentFile
    })
  }

  /**
   * Mark as completed
   */
  async complete(): Promise<void> {
    await this.update({ status: 'completed' })
    this.stopAutoUpdate()
  }

  /**
   * Mark as failed
   */
  async fail(error: string): Promise<void> {
    await this.update({ 
      status: 'failed',
      error 
    })
    this.stopAutoUpdate()
  }

  /**
   * Mark as interrupted
   */
  async interrupt(): Promise<void> {
    await this.update({ status: 'interrupted' })
    this.stopAutoUpdate()
  }

  /**
   * Remove lock file
   */
  async remove(): Promise<void> {
    this.stopAutoUpdate()
    try {
      if (fs.existsSync(this.lockFilePath)) {
        await fs.promises.unlink(this.lockFilePath)
      }
    } catch (error) {
      Logger.error(`Failed to remove lock file: ${(error as Error).message}`)
    }
  }

  /**
   * Check if lock exists and is valid
   */
  async exists(): Promise<boolean> {
    return fs.existsSync(this.lockFilePath)
  }

  /**
   * Check if lock is stale (process no longer running)
   */
  async isStale(): Promise<boolean> {
    const data = await this.read()
    if (!data) return false
    
    try {
      // Check if process is still running
      process.kill(data.pid, 0)
      return false
    } catch {
      return true
    }
  }

  /**
   * Get lock info formatted for TUI
   */
  async getTUILockInfo(): Promise<any> {
    const data = await this.read()
    if (!data) return null
    
    const isStale = await this.isStale()
    
    return {
      status: isStale ? 'stale' : data.status === 'running' ? 'locked' : data.status,
      resuming: data.status === 'interrupted',
      pid: data.pid,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      timestamp: data.updatedAt // For compatibility
    }
  }

  /**
   * Write lock data to file (atomic write)
   */
  private async write(): Promise<void> {
    if (!this.lockData) return
    
    const tempPath = `${this.lockFilePath}.tmp`
    try {
      await fs.promises.writeFile(
        tempPath,
        JSON.stringify(this.lockData, null, 2),
        'utf-8'
      )
      await fs.promises.rename(tempPath, this.lockFilePath)
    } catch (error) {
      Logger.error(`Failed to write lock file: ${(error as Error).message}`)
      // Clean up temp file if it exists
      try {
        if (fs.existsSync(tempPath)) {
          await fs.promises.unlink(tempPath)
        }
      } catch {
        // Ignore cleanup errors
      }
      throw error
    }
  }

  /**
   * Start automatic update interval
   */
  private startAutoUpdate(): void {
    this.stopAutoUpdate()
    this.updateInterval = setInterval(async () => {
      if (this.lockData && this.lockData.status === 'running') {
        await this.update({})
      }
    }, 5000)
  }

  /**
   * Stop automatic update interval
   */
  private stopAutoUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
  }
}

/**
 * Static utility functions
 */
export class LockUtils {
  static async checkLock(projectPath: string): Promise<boolean> {
    const manager = new LockFileManager(projectPath)
    return await manager.exists()
  }
  
  static async removeStaleLock(projectPath: string): Promise<void> {
    const manager = new LockFileManager(projectPath)
    if (await manager.isStale()) {
      await manager.remove()
    }
  }
}