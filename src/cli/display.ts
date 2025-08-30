import chalk from 'chalk'
import { existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'

export type DisplayMode = 'normal' | 'raw' | 'debug' | 'quiet';

let currentDisplayMode: DisplayMode = 'normal'
const isInteractive: boolean = process.stdout.isTTY && !process.env.CI

// Check if running in a TTY and adjust modes accordingly
export function setDisplayMode(mode: DisplayMode): void {
  currentDisplayMode = mode
  process.env.DISPLAY_MODE = mode

  // Auto-detect non-interactive environments
  if (!isInteractive && mode === 'normal') {
    currentDisplayMode = 'raw'
  }
}

export function getDisplayMode(): DisplayMode {
  return currentDisplayMode
}

export function isQuietMode(): boolean {
  return currentDisplayMode === 'quiet'
}

export function isDebugMode(): boolean {
  return currentDisplayMode === 'debug'
}

// Progress tracking for TUI integration
export interface ProgressInfo {
  phase: number;
  total: number;
  phaseName: string;
  task: string;
  progress: number;
  timestamp: number;
}

export class Logger {
  private lockFilePath: string = ''

  setLockFile(path: string): void {
    this.lockFilePath = path
  }

  // Core logging methods
  info(message: string, ...args: any[]): void {
    if (isQuietMode()) return

    switch (currentDisplayMode) {
    case 'normal':
      console.log(chalk.blue('ℹ'), message, ...args)
      break
    case 'raw':
      console.log(`INFO: ${message}`, ...args)
      break
    case 'debug':
      console.log(JSON.stringify({
        level: 'info',
        message,
        args,
        timestamp: Date.now()
      }))
      break
    }
  }

  success(message: string, ...args: any[]): void {
    if (isQuietMode()) return

    switch (currentDisplayMode) {
    case 'normal':
      console.log(chalk.green('✓'), message, ...args)
      break
    case 'raw':
      console.log(`SUCCESS: ${message}`, ...args)
      break
    case 'debug':
      console.log(JSON.stringify({
        level: 'success',
        message,
        args,
        timestamp: Date.now()
      }))
      break
    }
  }

  warn(message: string, ...args: any[]): void {
    if (isQuietMode()) return

    switch (currentDisplayMode) {
    case 'normal':
      console.warn(chalk.yellow('⚠'), message, ...args)
      break
    case 'raw':
      console.warn(`WARN: ${message}`, ...args)
      break
    case 'debug':
      console.warn(JSON.stringify({
        level: 'warn',
        message,
        args,
        timestamp: Date.now()
      }))
      break
    }
  }

  error(message: string, ...args: any[]): void {
    switch (currentDisplayMode) {
    case 'normal':
      console.error(chalk.red('✗'), message, ...args)
      break
    case 'raw':
      console.error(`ERROR: ${message}`, ...args)
      break
    case 'debug':
      console.error(JSON.stringify({
        level: 'error',
        message,
        args,
        timestamp: Date.now()
      }))
      break
    case 'quiet':
      // Only errors are shown in quiet mode
      console.error(`ERROR: ${message}`, ...args)
      break
    }
  }

  debug(message: string, data?: any): void {
    if (!isDebugMode()) return

    console.log(JSON.stringify({
      level: 'debug',
      message,
      data,
      timestamp: Date.now()
    }, null, 2))
  }

  // Progress reporting for TUI integration
  reportProgress(info: ProgressInfo): void {
    switch (currentDisplayMode) {
    case 'normal':
      this.showNormalProgress(info)
      break
    case 'raw':
      console.log(`PHASE:${info.phase}:${info.total}:${info.phaseName}`)
      console.log(`TASK:${info.task}`)
      console.log(`PROGRESS:${info.progress}`)
      break
    case 'debug':
      console.log(JSON.stringify({
        type: 'progress',
        ...info
      }))
      break
    case 'quiet':
      // No progress in quiet mode
      break
    }

    // Update lock file for TUI
    this.updateLockFile(info)
  }

  private showNormalProgress(info: ProgressInfo): void {
    const progressBar = this.createProgressBar(info.progress, 20)
    const phaseInfo = chalk.cyan(`[${info.phase}/${info.total}] ${info.phaseName}`)

    console.log(`${phaseInfo}`)
    console.log(`  ${chalk.green('→')} ${info.task}`)
    console.log(`  Progress: ${progressBar} ${info.progress}%`)
    console.log('')
  }

  private createProgressBar(progress: number, width: number): string {
    const filled = Math.floor((progress / 100) * width)
    const empty = width - filled

    return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty))
  }

  private updateLockFile(info: ProgressInfo): void {
    if (!this.lockFilePath) return

    try {
      const lockData = {
        status: 'running',
        phase: info.phase,
        totalPhases: info.total,
        phaseName: info.phaseName,
        currentTask: info.task,
        progress: info.progress,
        timestamp: info.timestamp
      }

      writeFileSync(this.lockFilePath, JSON.stringify(lockData, null, 2))
    } catch (error) {
      // Silently fail - lock file is not critical
    }
  }

  // Header display for commands
  showHeader(title: string, subtitle?: string): void {
    if (isQuietMode()) return

    switch (currentDisplayMode) {
    case 'normal':
      console.log('')
      console.log(chalk.bold.blue('DocuMentor v3.1.0'))
      console.log(chalk.gray('━'.repeat(40)))
      console.log(chalk.bold(title))
      if (subtitle) {
        console.log(chalk.gray(subtitle))
      }
      console.log('')
      break
    case 'raw':
      console.log(`HEADER: ${title}`)
      if (subtitle) {
        console.log(`SUBTITLE: ${subtitle}`)
      }
      break
    case 'debug':
      console.log(JSON.stringify({
        type: 'header',
        title,
        subtitle,
        timestamp: Date.now()
      }))
      break
    }
  }

  // Summary display
  showSummary(summary: {
    project: string;
    output: string;
    duration: number;
    files: number;
    success: boolean;
  }): void {
    if (isQuietMode() && summary.success) return

    switch (currentDisplayMode) {
    case 'normal':
      console.log('')
      console.log(chalk.gray('━'.repeat(40)))
      console.log(chalk.bold('Summary'))
      console.log(`📁 Project: ${chalk.cyan(summary.project)}`)
      console.log(`📍 Output:  ${chalk.cyan(summary.output)}`)
      console.log(`⏱️  Duration: ${chalk.yellow(this.formatDuration(summary.duration))}`)
      console.log(`📄 Files:   ${chalk.yellow(summary.files)}`)
      console.log(`${summary.success ? chalk.green('✓ Success') : chalk.red('✗ Failed')}`)
      console.log('')
      break
    case 'raw':
      console.log(`SUMMARY:PROJECT:${summary.project}`)
      console.log(`SUMMARY:OUTPUT:${summary.output}`)
      console.log(`SUMMARY:DURATION:${summary.duration}`)
      console.log(`SUMMARY:FILES:${summary.files}`)
      console.log(`SUMMARY:STATUS:${summary.success ? 'SUCCESS' : 'FAILED'}`)
      break
    case 'debug':
      console.log(JSON.stringify({
        type: 'summary',
        ...summary,
        timestamp: Date.now()
      }))
      break
    case 'quiet':
      if (!summary.success) {
        console.error(`Documentation generation failed for ${summary.project}`)
      }
      break
    }
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)

    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    }
    return `${seconds}s`
  }
}

// Singleton logger instance
export const logger = new Logger()

// Utility to check if output should be colored
export function shouldUseColor(): boolean {
  return currentDisplayMode === 'normal' &&
         !process.env.NO_COLOR &&
         isInteractive
}
