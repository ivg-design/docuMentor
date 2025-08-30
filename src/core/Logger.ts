/**
 * Centralized Logger Service for DocuMentor
 * Provides unified logging with TUI integration and consistent formatting
 */

import { TUIBridge } from './TUIBridge'
import { SecureFileOps } from './SecureFileOps'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

interface LogOptions {
  toFile?: boolean;
  toTUI?: boolean;
  context?: string;
  metadata?: any;
}

/**
 * Centralized logging service that replaces all console.* calls
 * Integrates with TUI and provides consistent log formatting
 */
class LoggerService {
  private static instance: LoggerService
  private tuiBridge?: TUIBridge
  private secureFileOps?: SecureFileOps
  private logFilePath?: string
  private isDevelopment = process.env.NODE_ENV !== 'production'

  private constructor() {
    // Singleton pattern
  }

  static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService()
    }
    return LoggerService.instance
  }

  /**
   * Initialize logger with TUI bridge and file operations
   */
  initialize(tuiBridge?: TUIBridge, secureFileOps?: SecureFileOps, logFilePath?: string): void {
    this.tuiBridge = tuiBridge
    this.secureFileOps = secureFileOps
    this.logFilePath = logFilePath
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, options: LogOptions = {}): void {
    const timestamp = new Date().toISOString()
    const formattedMessage = this.formatMessage(level, message, timestamp, options.context)

    // Send to TUI if available
    if (options.toTUI !== false && this.tuiBridge) {
      this.sendToTUI(level, message, options.metadata)
    }

    // Write to file if requested
    if (options.toFile && this.logFilePath && this.secureFileOps) {
      this.writeToFile(formattedMessage)
    }

    // In development, also log to console
    if (this.isDevelopment) {
      this.logToConsole(level, formattedMessage)
    }
  }

  /**
   * Format log message with timestamp and context
   */
  private formatMessage(level: LogLevel, message: string, timestamp: string, context?: string): string {
    const levelStr = level.toUpperCase().padEnd(7)
    const contextStr = context ? `[${context}]` : ''
    return `${timestamp} ${levelStr} ${contextStr} ${message}`
  }

  /**
   * Send log to TUI
   */
  private sendToTUI(level: LogLevel, message: string, metadata?: any): void {
    if (!this.tuiBridge) return

    // Map success to info for TUI compatibility
    const tuiLevel = level === 'success' ? 'info' : level as 'info' | 'warn' | 'error' | 'debug'
    this.tuiBridge.log(tuiLevel, message, metadata)
  }


  /**
   * Write log to file
   */
  private async writeToFile(message: string): Promise<void> {
    if (!this.secureFileOps || !this.logFilePath) return

    try {
      // Read existing content and append
      const existingResult = await this.secureFileOps.readFileSecure(this.logFilePath, 'utf-8')
      const existingContent = existingResult.success ? existingResult.content as string : ''
      
      await this.secureFileOps.writeFileSecure(
        this.logFilePath,
        existingContent + message + '\n'
      )
    } catch (error) {
      // Silently fail to avoid infinite loop
    }
  }

  /**
   * Log to console (development only)
   */
  private logToConsole(level: LogLevel, message: string): void {
    const methods: Record<LogLevel, keyof Console> = {
      debug: 'debug',
      info: 'info',
      warn: 'warn',
      error: 'error',
      success: 'log'
    }

    const method = methods[level];
    (console[method] as (...args: any[]) => void)(message)
  }

  // Public logging methods
  debug(message: string, options?: LogOptions): void {
    this.log('debug', message, options)
  }

  info(message: string, options?: LogOptions): void {
    this.log('info', message, options)
  }

  warn(message: string, options?: LogOptions): void {
    this.log('warn', message, options)
  }

  error(message: string, options?: LogOptions): void {
    this.log('error', message, options)
  }

  success(message: string, options?: LogOptions): void {
    this.log('success', message, options)
  }

  /**
   * Log with specific context
   */
  withContext(context: string) {
    return {
      debug: (message: string, options?: LogOptions) =>
        this.debug(message, { ...options, context }),
      info: (message: string, options?: LogOptions) =>
        this.info(message, { ...options, context }),
      warn: (message: string, options?: LogOptions) =>
        this.warn(message, { ...options, context }),
      error: (message: string, options?: LogOptions) =>
        this.error(message, { ...options, context }),
      success: (message: string, options?: LogOptions) =>
        this.success(message, { ...options, context })
    }
  }
}

// Export singleton instance
export const Logger = LoggerService.getInstance()

// Export for compatibility with existing code
export const logger = Logger
