import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

export interface LockFileData {
  pid: number;
  startTime: string; // Local time string
  lastUpdate: string; // Local time string  
  status: 'running' | 'interrupted' | 'completed' | 'failed';
  currentPhase?: string;
  completedTasks?: string[];
  progress?: number;
  error?: string;
}

export class SimpleLockFile {
  private lockFilePath: string;
  private updateInterval: NodeJS.Timeout | null = null;
  private cleanupInProgress = false;
  
  constructor(targetPath: string) {
    // Place .documentor.lock in the target directory being documented
    this.lockFilePath = path.join(targetPath, '.documentor.lock');
  }
  
  /**
   * Check if another instance is running
   */
  async checkLock(): Promise<{ isLocked: boolean; lockData?: LockFileData; canResume?: boolean }> {
    try {
      const content = await fs.readFile(this.lockFilePath, 'utf-8');
      const lockData: LockFileData = JSON.parse(content);
      
      // Check if process is still alive
      const isAlive = this.isProcessAlive(lockData.pid);
      
      // Check last update time (consider stale after 30 seconds)
      const lastUpdate = new Date(lockData.lastUpdate);
      const timeSinceUpdate = Date.now() - lastUpdate.getTime();
      const isStale = timeSinceUpdate > 30000;
      
      if (isAlive && !isStale && lockData.status === 'running') {
        // Another instance is actively running
        return { 
          isLocked: true, 
          lockData,
          canResume: false 
        };
      }
      
      // Process died or was interrupted
      if (lockData.status === 'interrupted' || lockData.status === 'failed' || isStale) {
        return {
          isLocked: false,
          lockData,
          canResume: true
        };
      }
      
      // Completed normally
      if (lockData.status === 'completed') {
        return {
          isLocked: false,
          lockData,
          canResume: false
        };
      }
      
      return { isLocked: false };
      
    } catch (error) {
      // No lock file exists
      return { isLocked: false };
    }
  }
  
  /**
   * Create or update lock file
   */
  async createLock(phase: string = 'initializing'): Promise<void> {
    const lockData: LockFileData = {
      pid: process.pid,
      startTime: this.getLocalTimeString(),
      lastUpdate: this.getLocalTimeString(),
      status: 'running',
      currentPhase: phase,
      completedTasks: [],
      progress: 0
    };
    
    await fs.writeFile(this.lockFilePath, JSON.stringify(lockData, null, 2));
    
    // Start auto-update
    this.startAutoUpdate();
    
    // Setup cleanup handlers
    this.setupCleanupHandlers();
  }
  
  /**
   * Update lock file
   */
  async updateLock(updates: Partial<LockFileData>): Promise<void> {
    try {
      const current = await this.readLock();
      if (current) {
        const updated = {
          ...current,
          ...updates,
          lastUpdate: this.getLocalTimeString()
        };
        await fs.writeFile(this.lockFilePath, JSON.stringify(updated, null, 2));
      }
    } catch (error) {
      // Lock file might not exist
    }
  }
  
  /**
   * Update lock file synchronously (for exit handlers)
   */
  private updateLockSync(updates: Partial<LockFileData>): void {
    try {
      const content = fsSync.readFileSync(this.lockFilePath, 'utf-8');
      const current: LockFileData = JSON.parse(content);
      const updated = {
        ...current,
        ...updates,
        lastUpdate: this.getLocalTimeString()
      };
      fsSync.writeFileSync(this.lockFilePath, JSON.stringify(updated, null, 2));
    } catch (error) {
      // Lock file might not exist or can't be updated
    }
  }
  
  /**
   * Mark as completed
   */
  async completeLock(): Promise<void> {
    await this.updateLock({
      status: 'completed',
      progress: 100
    });
    
    this.stopAutoUpdate();
    
    // Optionally remove lock file after completion
    // await fs.unlink(this.lockFilePath).catch(() => {});
  }
  
  /**
   * Mark as failed
   */
  async failLock(error: string): Promise<void> {
    await this.updateLock({
      status: 'failed',
      error
    });
    
    this.stopAutoUpdate();
  }
  
  /**
   * Remove lock file
   */
  async removeLock(): Promise<void> {
    this.stopAutoUpdate();
    await fs.unlink(this.lockFilePath).catch(() => {});
  }
  
  /**
   * Read current lock data
   */
  private async readLock(): Promise<LockFileData | null> {
    try {
      const content = await fs.readFile(this.lockFilePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
  
  /**
   * Start auto-updating the lock file
   */
  private startAutoUpdate(): void {
    // Update every 5 seconds to show we're still alive
    this.updateInterval = setInterval(async () => {
      await this.updateLock({});
    }, 5000);
  }
  
  /**
   * Stop auto-update
   */
  private stopAutoUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
  
  /**
   * Setup cleanup handlers for ALL termination scenarios
   */
  private setupCleanupHandlers(): void {
    const cleanup = async (signal: string) => {
      if (this.cleanupInProgress) return;
      this.cleanupInProgress = true;
      
      console.log(`\nReceived ${signal}, updating lock file...`);
      
      // Get current lock state
      const current = await this.readLock();
      
      await this.updateLock({
        status: 'interrupted',
        error: `Process interrupted by ${signal} at ${this.getLocalTimeString()}`,
        currentPhase: current?.currentPhase || 'unknown',
        progress: current?.progress || 0,
        completedTasks: current?.completedTasks || []
      });
      
      this.stopAutoUpdate();
      
      // Give time for the update to write
      setTimeout(() => process.exit(0), 100);
    };
    
    // Handle common termination signals
    process.on('SIGINT', () => cleanup('SIGINT (Ctrl+C)'));
    process.on('SIGTERM', () => cleanup('SIGTERM (Kill signal)'));
    process.on('SIGHUP', () => cleanup('SIGHUP (Terminal closed)'));
    process.on('SIGUSR1', () => cleanup('SIGUSR1'));
    process.on('SIGUSR2', () => cleanup('SIGUSR2'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      if (this.cleanupInProgress) return;
      this.cleanupInProgress = true;
      
      console.error('Uncaught Exception:', error);
      
      const current = await this.readLock();
      await this.updateLock({
        status: 'failed',
        error: `Crashed: ${error.message} at ${this.getLocalTimeString()}`,
        currentPhase: current?.currentPhase || 'unknown',
        progress: current?.progress || 0,
        completedTasks: current?.completedTasks || []
      });
      
      this.stopAutoUpdate();
      setTimeout(() => process.exit(1), 100);
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      if (this.cleanupInProgress) return;
      this.cleanupInProgress = true;
      
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      
      const current = await this.readLock();
      await this.updateLock({
        status: 'failed',
        error: `Unhandled Promise Rejection: ${String(reason)} at ${this.getLocalTimeString()}`,
        currentPhase: current?.currentPhase || 'unknown',
        progress: current?.progress || 0,
        completedTasks: current?.completedTasks || []
      });
      
      this.stopAutoUpdate();
      setTimeout(() => process.exit(1), 100);
    });
    
    // Handle process exit - MUST be synchronous!
    process.on('exit', (code) => {
      if (this.cleanupInProgress) return;
      
      this.stopAutoUpdate();
      
      // If exiting abnormally and we haven't already updated status
      if (code !== 0) {
        try {
          const content = fsSync.readFileSync(this.lockFilePath, 'utf-8');
          const current: LockFileData = JSON.parse(content);
          
          if (current && current.status === 'running') {
            // Process died without proper cleanup - use SYNC write
            this.updateLockSync({
              status: 'interrupted',
              error: `Process exited unexpectedly with code ${code} at ${this.getLocalTimeString()}`,
              currentPhase: current.currentPhase || 'unknown',
              progress: current.progress || 0
            });
          }
        } catch {
          // Can't update lock file on exit
        }
      }
    });
    
    // Handle beforeExit event for cleaner async cleanup
    process.on('beforeExit', async (code) => {
      if (this.cleanupInProgress) return;
      
      const current = await this.readLock();
      if (current && current.status === 'running') {
        await this.updateLock({
          status: 'interrupted',
          error: `Process exiting with code ${code} at ${this.getLocalTimeString()}`,
          currentPhase: current.currentPhase || 'unknown',
          progress: current.progress || 0
        });
      }
    });
    
    // Windows-specific signal handling
    if (process.platform === 'win32') {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      rl.on('SIGINT', () => cleanup('SIGINT (Ctrl+C)'));
      rl.on('close', () => cleanup('Terminal closed'));
    }
  }
  
  /**
   * Check if a process is alive
   */
  private isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get local time string
   */
  private getLocalTimeString(): string {
    return new Date().toLocaleString();
  }
  
  /**
   * Format lock info for display
   */
  static formatLockInfo(lockData: LockFileData): string {
    return `
Lock File Status:
-----------------
PID: ${lockData.pid}
Status: ${lockData.status}
Started: ${lockData.startTime}
Last Update: ${lockData.lastUpdate}
Current Phase: ${lockData.currentPhase || 'N/A'}
Progress: ${lockData.progress || 0}%
Completed Tasks: ${lockData.completedTasks?.length || 0}
${lockData.error ? `Error: ${lockData.error}` : ''}
`;
  }
}

/**
 * Simple decorator to check lock before running
 */
export async function withLockCheck<T>(
  targetPath: string,
  operation: (lock: SimpleLockFile, resumeData?: LockFileData) => Promise<T>
): Promise<T> {
  const lock = new SimpleLockFile(targetPath);
  
  // Check for existing lock
  const { isLocked, lockData, canResume } = await lock.checkLock();
  
  if (isLocked) {
    console.log('❌ Another instance is already running!');
    console.log(SimpleLockFile.formatLockInfo(lockData!));
    throw new Error('Documentation already in progress. Please wait or kill the other process.');
  }
  
  if (canResume && lockData) {
    console.log('🔄 Found interrupted session, resuming...');
    console.log(SimpleLockFile.formatLockInfo(lockData));
    
    // Ask user if they want to resume
    // For now, auto-resume
  }
  
  // Create new lock
  await lock.createLock();
  
  try {
    // Run the operation
    const result = await operation(lock, canResume ? lockData : undefined);
    
    // Mark as completed
    await lock.completeLock();
    
    return result;
  } catch (error) {
    // Mark as failed
    await lock.failLock(error instanceof Error ? error.message : String(error));
    throw error;
  }
}