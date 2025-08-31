/**
 * Unified Logger System
 * Single source of truth for all logging operations
 */

import * as fs from 'fs'
import * as path from 'path'
import { TUIAdapter } from './TUIAdapter'

const tuiAdapter = new TUIAdapter({ project: '', output: '', enabled: false })
import { formatLocalTimestamp } from '../utils/datetime'

export type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'success'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: string
  metadata?: any
}

/**
 * Unified Logger - Singleton
 */
class LoggerClass {
  private static instance: LoggerClass
  private logFilePath: string | null = null
  private writeStream: fs.WriteStream | null = null
  private isDebugMode: boolean = false
  private isSilentMode: boolean = false
  
  private constructor() {
    this.isDebugMode = process.env.DOCUMENTOR_DEBUG === 'true'
    this.isSilentMode = process.env.DOCUMENTOR_QUIET === 'true'
  }
  
  static getInstance(): LoggerClass {
    if (!LoggerClass.instance) {
      LoggerClass.instance = new LoggerClass()
    }
    return LoggerClass.instance
  }
  
  /**
   * Initialize logger with output file
   */
  initialize(outputPath: string): void {
    const logsDir = path.join(outputPath, 'logs')
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true })
    }
    
    // Create log file with timestamp
    const timestamp = formatLocalTimestamp().replace(/[:.]/g, '-')
    this.logFilePath = path.join(logsDir, `documentor-${timestamp}.log`)
    
    // Create write stream
    this.writeStream = fs.createWriteStream(this.logFilePath, { flags: 'a' })
  }
  
  /**
   * Close logger and cleanup
   */
  close(): void {
    if (this.writeStream) {
      this.writeStream.end()
      this.writeStream = null
    }
  }
  
  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: string, metadata?: any): void {
    // Skip debug messages unless in debug mode
    if (level === 'debug' && !this.isDebugMode) return
    
    // Skip all messages in silent mode except errors
    if (this.isSilentMode && level !== 'error') return
    
    const timestamp = formatLocalTimestamp()
    
    // Create log entry
    const entry: LogEntry = {
      timestamp,
      level,
      message,
      context,
      metadata
    }
    
    // Write to file if available
    this.writeToFile(entry)
    
    // Send to TUI (TUI handles its own mode checking)
    this.sendToTUI(level, message, context)
  }
  
  /**
   * Write log entry to file
   */
  private writeToFile(entry: LogEntry): void {
    if (!this.writeStream) return
    
    // Format for file: timestamp LEVEL [context] message
    let line = `${entry.timestamp} ${entry.level.toUpperCase().padEnd(7)}`
    if (entry.context) {
      line += ` [${entry.context}]`
    }
    line += ` ${entry.message}`
    
    // Add metadata if present
    if (entry.metadata) {
      line += ` | ${JSON.stringify(entry.metadata)}`
    }
    
    this.writeStream.write(line + '\n')
  }
  
  /**
   * Send log to TUI
   */
  private sendToTUI(level: LogLevel, message: string, context?: string): void {
    // Format message with context if present
    const formattedMessage = context ? `[${context}] ${message}` : message
    
    // Map log levels to TUI levels (TUI uses 'warning' not 'warn')
    switch (level) {
    case 'debug':
      tuiAdapter.debug(formattedMessage)
      break
    case 'info':
      tuiAdapter.logInfo(formattedMessage)
      break
    case 'warning':
      tuiAdapter.logWarning(formattedMessage)
      break
    case 'error':
      tuiAdapter.logError(formattedMessage)
      break
    case 'success':
      tuiAdapter.logSuccess(formattedMessage)
      break
    }
  }
  
  /**
   * Public logging methods
   */
  debug(message: string, context?: string, metadata?: any): void {
    this.log('debug', message, context, metadata)
  }
  
  info(message: string, context?: string, metadata?: any): void {
    this.log('info', message, context, metadata)
  }
  
  warn(message: string, context?: string, metadata?: any): void {
    this.log('warning', message, context, metadata)
  }
  
  warning(message: string, context?: string, metadata?: any): void {
    this.log('warning', message, context, metadata)
  }
  
  error(message: string | Error, context?: string, metadata?: any): void {
    const errorMessage = message instanceof Error 
      ? `${message.message}${message.stack ? '\n' + message.stack : ''}`
      : message
    this.log('error', errorMessage, context, metadata)
  }
  
  success(message: string, context?: string, metadata?: any): void {
    this.log('success', message, context, metadata)
  }
  
  /**
   * Log with explicit level
   */
  logLevel(level: LogLevel, message: string, context?: string, metadata?: any): void {
    this.log(level, message, context, metadata)
  }
  
  /**
   * Create a child logger with context
   */
  withContext(context: string): ContextLogger {
    return new ContextLogger(this, context)
  }
  
  /**
   * Log performance timing
   */
  time(label: string): void {
    console.time(label)
  }
  
  timeEnd(label: string): void {
    console.timeEnd(label)
  }
  
  /**
   * Set debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.isDebugMode = enabled
  }
  
  /**
   * Set silent mode
   */
  setSilentMode(enabled: boolean): void {
    this.isSilentMode = enabled
  }
}

/**
 * Context logger for consistent context in logs
 */
class ContextLogger {
  constructor(
    private logger: LoggerClass,
    private context: string
  ) {}
  
  debug(message: string, metadata?: any): void {
    this.logger.debug(message, this.context, metadata)
  }
  
  info(message: string, metadata?: any): void {
    this.logger.info(message, this.context, metadata)
  }
  
  warn(message: string, metadata?: any): void {
    this.logger.warn(message, this.context, metadata)
  }
  
  warning(message: string, metadata?: any): void {
    this.logger.warning(message, this.context, metadata)
  }
  
  error(message: string | Error, metadata?: any): void {
    this.logger.error(message, this.context, metadata)
  }
  
  success(message: string, metadata?: any): void {
    this.logger.success(message, this.context, metadata)
  }
}

// Export singleton instance
export const Logger = LoggerClass.getInstance()

// Export types
export type { LoggerClass, ContextLogger }