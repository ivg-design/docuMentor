/**
 * TUIAdapter - Bridge between legacy code and TUI
 * Provides backward compatibility for existing code
 */

import { TUIInterface } from './TUIInterface-spawned'
import { Logger } from './Logger'

export class TUIAdapter {
  private static instance: TUIAdapter
  private tui?: TUIInterface
  private isEnabled: boolean = false

  private constructor() {
    this.isEnabled = process.env.TUI_MODE === 'true'
    
    if (this.isEnabled) {
      this.tui = new TUIInterface({
        project: process.cwd(),
        output: './docs',
        enabled: true
      })
    }
  }

  static getInstance(): TUIAdapter {
    if (!TUIAdapter.instance) {
      TUIAdapter.instance = new TUIAdapter()
    }
    return TUIAdapter.instance
  }

  /**
   * Initialize TUI with project info
   */
  start(projectPath: string, outputPath?: string): void {
    if (this.tui) {
      // Send init message
      this.sendMessage({
        type: 'project',
        projectPath,
        outputPath: outputPath || './docs'
      })
    }
  }

  /**
   * Send message to TUI
   */
  sendMessage(message: any): void {
    if (this.isEnabled) {
      // In TUI mode, send JSON to stdout
      console.log(JSON.stringify({
        ...message,
        timestamp: new Date().toISOString()
      }))
    } else {
      // In normal mode, log to console
      if (message.type === 'log') {
        Logger[message.level?.toLowerCase() || 'info'](message.content || message.message)
      }
    }
  }

  /**
   * Update phase progress
   */
  updatePhase(current: number, total: number, name: string): void {
    if (this.tui) {
      this.tui.updatePhase(current, total, name)
    } else {
      Logger.info(`Phase ${current}/${total}: ${name}`)
    }
  }

  /**
   * Update file progress
   */
  updateFileProgress(processed: number, total: number): void {
    if (this.tui) {
      this.tui.updateFileProgress(processed, total)
    } else {
      Logger.info(`Files: ${processed}/${total}`)
    }
  }

  /**
   * Log message
   */
  log(level: 'info' | 'warn' | 'error' | 'debug', message: string): void {
    if (this.tui) {
      const levelMap = {
        info: 'INFO',
        warn: 'WARN',
        error: 'ERROR',
        debug: 'DEBUG'
      }
      this.tui.log(levelMap[level] as any, message)
    } else {
      Logger[level](message)
    }
  }

  /**
   * Stop TUI
   */
  stop(): void {
    if (this.tui) {
      this.tui.shutdown()
    }
  }

  /**
   * Check if TUI is enabled
   */
  get enabled(): boolean {
    return this.isEnabled
  }
}