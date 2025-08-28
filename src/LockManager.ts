import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import crypto from 'crypto';

export interface LockInfo {
  pid: number;
  startTime: Date;
  projectPath: string;
  hostname: string;
  lastHeartbeat: Date;
  progress?: ResumeState;
}

export interface ResumeState {
  phase: string;
  completedTasks: string[];
  currentTask?: string;
  subprojects?: string[];
  processedSubprojects?: string[];
  metadata?: Record<string, any>;
  checkpoint: Date;
}

export class LockManager {
  private lockDir: string;
  private stateDir: string;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private currentLockFile: string | null = null;
  
  constructor() {
    this.lockDir = path.join(os.homedir(), '.documentor', 'locks');
    this.stateDir = path.join(os.homedir(), '.documentor', 'state');
  }
  
  /**
   * Acquire a lock for a project
   * Returns true if lock acquired, false if another instance is running
   */
  async acquireLock(projectPath: string): Promise<{ acquired: boolean; existingLock?: LockInfo; resumeState?: ResumeState }> {
    await fs.mkdir(this.lockDir, { recursive: true });
    await fs.mkdir(this.stateDir, { recursive: true });
    
    const lockFile = this.getLockFileName(projectPath);
    this.currentLockFile = lockFile;
    const lockPath = path.join(this.lockDir, lockFile);
    
    // Check for existing lock
    try {
      const existingLockData = await fs.readFile(lockPath, 'utf-8');
      const existingLock: LockInfo = JSON.parse(existingLockData);
      
      // Check if the process is still alive
      if (this.isProcessAlive(existingLock.pid)) {
        // Check heartbeat (consider dead if no heartbeat for 30 seconds)
        const timeSinceHeartbeat = Date.now() - new Date(existingLock.lastHeartbeat).getTime();
        if (timeSinceHeartbeat < 30000) {
          // Another instance is actively running
          return { 
            acquired: false, 
            existingLock,
            resumeState: existingLock.progress 
          };
        }
      }
      
      // Process is dead or unresponsive, we can take over
      console.log('🔄 Found stale lock, recovering state...');
      
      // Load resume state if available
      const resumeState = await this.loadResumeState(projectPath);
      
      // Remove stale lock
      await fs.unlink(lockPath).catch(() => {});
      
      // Create new lock
      await this.createLock(lockPath, projectPath);
      
      return { 
        acquired: true, 
        resumeState 
      };
      
    } catch (error) {
      // No existing lock, create new one
      await this.createLock(lockPath, projectPath);
      
      // Check for any previous state to resume
      const resumeState = await this.loadResumeState(projectPath);
      
      return { 
        acquired: true,
        resumeState 
      };
    }
  }
  
  /**
   * Create a new lock file
   */
  private async createLock(lockPath: string, projectPath: string): Promise<void> {
    const lockInfo: LockInfo = {
      pid: process.pid,
      startTime: new Date(),
      projectPath,
      hostname: os.hostname(),
      lastHeartbeat: new Date()
    };
    
    await fs.writeFile(lockPath, JSON.stringify(lockInfo, null, 2));
    
    // Start heartbeat
    this.startHeartbeat(lockPath);
  }
  
  /**
   * Start heartbeat to keep lock alive
   */
  private startHeartbeat(lockPath: string): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        const lockData = await fs.readFile(lockPath, 'utf-8');
        const lock: LockInfo = JSON.parse(lockData);
        lock.lastHeartbeat = new Date();
        await fs.writeFile(lockPath, JSON.stringify(lock, null, 2));
      } catch (error) {
        // Lock file might have been deleted
        console.error('Failed to update heartbeat:', error);
      }
    }, 10000); // Update every 10 seconds
  }
  
  /**
   * Release the lock
   */
  async releaseLock(projectPath: string): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.currentLockFile) {
      const lockPath = path.join(this.lockDir, this.currentLockFile);
      await fs.unlink(lockPath).catch(() => {});
      this.currentLockFile = null;
    }
  }
  
  /**
   * Save resume state
   */
  async saveResumeState(projectPath: string, state: ResumeState): Promise<void> {
    const stateFile = this.getStateFileName(projectPath);
    const statePath = path.join(this.stateDir, stateFile);
    
    state.checkpoint = new Date();
    
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
    
    // Also update lock file with progress
    if (this.currentLockFile) {
      const lockPath = path.join(this.lockDir, this.currentLockFile);
      try {
        const lockData = await fs.readFile(lockPath, 'utf-8');
        const lock: LockInfo = JSON.parse(lockData);
        lock.progress = state;
        lock.lastHeartbeat = new Date();
        await fs.writeFile(lockPath, JSON.stringify(lock, null, 2));
      } catch (error) {
        // Lock might not exist yet
      }
    }
  }
  
  /**
   * Load resume state
   */
  async loadResumeState(projectPath: string): Promise<ResumeState | undefined> {
    const stateFile = this.getStateFileName(projectPath);
    const statePath = path.join(this.stateDir, stateFile);
    
    try {
      const stateData = await fs.readFile(statePath, 'utf-8');
      return JSON.parse(stateData);
    } catch (error) {
      return undefined;
    }
  }
  
  /**
   * Clear resume state (when completed successfully)
   */
  async clearResumeState(projectPath: string): Promise<void> {
    const stateFile = this.getStateFileName(projectPath);
    const statePath = path.join(this.stateDir, stateFile);
    
    await fs.unlink(statePath).catch(() => {});
  }
  
  /**
   * Check if a process is alive
   */
  private isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get lock file name for a project
   */
  private getLockFileName(projectPath: string): string {
    const hash = crypto.createHash('md5').update(projectPath).digest('hex');
    return `documentor-${hash}.lock`;
  }
  
  /**
   * Get state file name for a project
   */
  private getStateFileName(projectPath: string): string {
    const hash = crypto.createHash('md5').update(projectPath).digest('hex');
    return `documentor-${hash}.state`;
  }
  
  /**
   * Force unlock (for emergency cases)
   */
  async forceUnlock(projectPath: string): Promise<void> {
    const lockFile = this.getLockFileName(projectPath);
    const lockPath = path.join(this.lockDir, lockFile);
    
    await fs.unlink(lockPath).catch(() => {});
    console.log('🔓 Force unlocked:', projectPath);
  }
  
  /**
   * List all active locks
   */
  async listLocks(): Promise<LockInfo[]> {
    try {
      await fs.mkdir(this.lockDir, { recursive: true });
      const files = await fs.readdir(this.lockDir);
      const locks: LockInfo[] = [];
      
      for (const file of files) {
        if (file.startsWith('documentor-') && file.endsWith('.lock')) {
          try {
            const lockPath = path.join(this.lockDir, file);
            const lockData = await fs.readFile(lockPath, 'utf-8');
            const lock: LockInfo = JSON.parse(lockData);
            
            // Check if still alive
            const timeSinceHeartbeat = Date.now() - new Date(lock.lastHeartbeat).getTime();
            if (timeSinceHeartbeat < 30000) {
              locks.push(lock);
            } else {
              // Clean up stale lock
              await fs.unlink(lockPath).catch(() => {});
            }
          } catch (error) {
            // Invalid lock file
          }
        }
      }
      
      return locks;
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Cleanup on process exit
   */
  setupCleanup(projectPath: string): void {
    const cleanup = async () => {
      await this.releaseLock(projectPath);
      process.exit(0);
    };
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', () => {
      this.releaseLock(projectPath).catch(() => {});
    });
  }
}

export class LockError extends Error {
  constructor(message: string, public lockInfo?: LockInfo) {
    super(message);
    this.name = 'LockError';
  }
}