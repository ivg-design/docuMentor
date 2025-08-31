/**
 * Logger module for DocuMentor
 * Provides centralized logging with TUI integration
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  private static instance: Logger
  private level: LogLevel = LogLevel.INFO
  private isTUIMode: boolean = process.env.TUI_MODE === 'true'

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  setLevel(level: LogLevel): void {
    this.level = level
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString()
    return `[${timestamp}] [${level}] ${message}`
  }

  private output(level: string, message: string): void {
    if (this.isTUIMode) {
      // In TUI mode, send as JSON to stdout for TUI to parse
      const msg = {
        type: 'log',
        data: {
          level: level.toUpperCase(),
          message,
          workerID: 0
        }
      }
      console.log(JSON.stringify(msg))
    } else {
      // In normal mode, output to stderr
      console.error(this.formatMessage(level, message))
    }
  }

  debug(message: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.output('DEBUG', message)
    }
  }

  info(message: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.output('INFO', message)
    }
  }

  warn(message: string): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.output('WARN', message)
    }
  }

  error(message: string, error?: Error): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const msg = error ? `${message}: ${error.message}` : message
      this.output('ERROR', msg)
    }
  }

  // Static convenience methods
  static debug(message: string): void {
    Logger.getInstance().debug(message)
  }

  static info(message: string): void {
    Logger.getInstance().info(message)
  }

  static warn(message: string): void {
    Logger.getInstance().warn(message)
  }

  static error(message: string, error?: Error): void {
    Logger.getInstance().error(message, error)
  }
}