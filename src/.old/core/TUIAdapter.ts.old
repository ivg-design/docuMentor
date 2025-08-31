/**
 * Unified TUI Adapter
 * Single source of truth for all TUI communication
 * This is the ONLY module that should output JSON to stdout
 */

import { EventEmitter } from 'events'
import { LockFileManager } from './LockFileManager'

/**
 * TUI Message types as defined in TUI_DATA_INTERFACE.md
 */
export interface TUIMessage {
  type: 'log' | 'project' | 'phase' | 'file' | 'tool' | 'debug' | 'raw' | 'lockInfo' | 'memory'
  timestamp?: string
  [key: string]: any
}

export interface PhaseInfo {
  current: number    // Current phase number (1-based)
  total: number      // Total number of phases
  name: string       // Phase name
  subPhase?: string  // Optional sub-phase description
}

export interface FileInfo {
  processed: number  // Files processed so far
  total: number      // Total files to process
  current?: string   // Current file being processed
}

export interface LockInfo {
  status: string     // 'locked', 'unlocked', 'stale'
  resuming: boolean  // True if resuming from interruption
  createdAt: string  // ISO timestamp
  updatedAt: string  // ISO timestamp
  timestamp: string  // Alternative timestamp field
  pid: number        // Process ID
}

/**
 * Unified TUI Adapter - Singleton
 */
class TUIAdapterClass extends EventEmitter {
  private static instance: TUIAdapterClass
  private lockFileManager: LockFileManager | null = null
  private projectPath: string = ''
  private currentPhase: PhaseInfo = { current: 0, total: 9, name: 'Initialization' }
  private fileProgress: FileInfo = { processed: 0, total: 0 }
  private isTUIMode: boolean = false

  private constructor() {
    super()
    this.isTUIMode = process.env.DOCUMENTOR_TUI === 'true'
  }

  static getInstance(): TUIAdapterClass {
    if (!TUIAdapterClass.instance) {
      TUIAdapterClass.instance = new TUIAdapterClass()
    }
    return TUIAdapterClass.instance
  }

  /**
   * Initialize TUI with project
   */
  start(projectPath: string): void {
    this.projectPath = projectPath
    this.lockFileManager = new LockFileManager(projectPath)
    
    // Send initial project message
    this.send({
      type: 'project',
      projectPath
    })
    
    // Start monitoring lock file if it exists
    this.monitorLockFile()
  }

  /**
   * Stop TUI and cleanup
   */
  stop(): void {
    this.logInfo('Documentation generation stopped')
  }

  /**
   * Core send method - ONLY place that outputs to stdout
   */
  private send(message: TUIMessage): void {
    if (!this.isTUIMode) return
    
    // Add timestamp if not present
    if (!message.timestamp) {
      const now = new Date()
      message.timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
    }
    
    // Output JSON to stdout for Go TUI
    console.log(JSON.stringify(message))
  }

  /**
   * Log messages with levels
   */
  log(level: 'info' | 'warning' | 'error' | 'success', content: string): void {
    this.send({
      type: 'log',
      level,
      content
    })
  }

  logInfo(content: string): void {
    this.log('info', content)
  }

  logWarning(content: string): void {
    this.log('warning', content)
  }

  logError(content: string): void {
    this.log('error', content)
  }

  logSuccess(content: string): void {
    this.log('success', content)
  }

  /**
   * Phase management
   */
  updatePhase(current: number, total: number, name: string, subPhase?: string): void {
    this.currentPhase = { current, total, name, subPhase }
    
    this.send({
      type: 'phase',
      phase: this.currentPhase
    })
    
    // Update lock file
    if (this.lockFileManager) {
      this.lockFileManager.updatePhase(current, name, subPhase).catch(() => {})
    }
  }

  setPhase(name: string, current: number, total: number): void {
    this.updatePhase(current, total, name)
  }

  /**
   * File progress tracking
   */
  updateFileProgress(processed: number, total: number, current?: string): void {
    this.fileProgress = { processed, total, current }
    
    this.send({
      type: 'file',
      files: this.fileProgress
    })
    
    // Update lock file
    if (this.lockFileManager) {
      this.lockFileManager.updateFileProgress(processed, total, current).catch(() => {})
    }
  }

  /**
   * Tool calls (Claude operations)
   */
  reportTool(tool: string, content: string): void {
    this.send({
      type: 'tool',
      tool,
      content
    })
  }

  /**
   * Debug messages (only shown in debug view)
   */
  debug(content: string): void {
    this.send({
      type: 'debug',
      content
    })
  }

  /**
   * Raw API messages (only shown in raw view)
   */
  raw(content: string): void {
    this.send({
      type: 'raw',
      content
    })
  }

  /**
   * Memory usage updates
   */
  updateMemory(mb: number): void {
    this.send({
      type: 'memory',
      data: mb
    })
  }

  /**
   * Lock file monitoring
   */
  private async monitorLockFile(): Promise<void> {
    if (!this.lockFileManager) return
    
    const sendLockInfo = async () => {
      const lockInfo = await this.lockFileManager!.getTUILockInfo()
      if (lockInfo) {
        this.send({
          type: 'lockInfo',
          lockInfo
        })
      }
    }
    
    // Send initial lock info
    await sendLockInfo()
    
    // Update periodically
    setInterval(sendLockInfo, 5000)
  }

  /**
   * Compatibility methods for easy migration
   */
  stream(message: string): void {
    this.logInfo(message)
  }

  streamFile(action: string, fileName: string): void {
    this.reportTool(action, fileName)
  }

  displayDebug(content: string): void {
    this.debug(content)
  }

  displayRaw(content: string): void {
    this.raw(content)
  }

  displayMemory(mb: number): void {
    this.updateMemory(mb)
  }

  updateDocumentProgress(current: number, total: number, fileName?: string): void {
    this.updateFileProgress(current, total, fileName)
  }
}

// Export singleton instance
export const tuiAdapter = TUIAdapterClass.getInstance()

// Export types
export type { TUIAdapterClass as TUIAdapter }