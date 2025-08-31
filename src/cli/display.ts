import chalk from 'chalk'
import { existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { TUIAdapter } from '../core/TUIAdapter'

const tuiAdapter = new TUIAdapter({ project: '', output: '', enabled: false })

export type DisplayMode = 'normal' | 'raw' | 'debug' | 'quiet';

let currentDisplayMode: DisplayMode = 'normal'

// DO NOT output to console when running under TUI
// ALL output should go through TUIAdapter
const isTUIMode = (): boolean => {
  // Check if we're running under the TUI wrapper
  return process.env.DOCUMENTOR_TUI === 'true'
}

export function setDisplayMode(mode: DisplayMode): void {
  currentDisplayMode = mode
  process.env.DISPLAY_MODE = mode
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

  info(message: string, ...args: any[]): void {
    if (isTUIMode()) {
      tuiAdapter.logInfo(message)
    } else if (!isQuietMode()) {
      console.log(chalk.blue('ℹ'), message, ...args)
    }
  }

  success(message: string, ...args: any[]): void {
    if (isTUIMode()) {
      tuiAdapter.logSuccess(message)
    } else if (!isQuietMode()) {
      console.log(chalk.green('✓'), message, ...args)
    }
  }

  warn(message: string, ...args: any[]): void {
    if (isTUIMode()) {
      tuiAdapter.logWarning(message)
    } else {
      console.warn(chalk.yellow('⚠'), message, ...args)
    }
  }

  error(message: string, ...args: any[]): void {
    if (isTUIMode()) {
      tuiAdapter.logError(message)
    } else {
      console.error(chalk.red('✗'), message, ...args)
    }
  }

  debug(message: string, ...args: any[]): void {
    if (isTUIMode()) {
      tuiAdapter.displayDebug(message)
    } else if (isDebugMode()) {
      console.error(chalk.gray('[DEBUG]'), message, ...args)
    }
  }

  reportProgress(info: ProgressInfo): void {
    if (isTUIMode()) {
      // TUI handles progress through PhaseManager
      return
    }

    // Non-TUI progress display
    const phaseInfo = chalk.cyan(`[Phase ${info.phase}/${info.total}] ${info.phaseName}`)
    const progressBar = this.createProgressBar(info.progress)
    
    console.log(`${phaseInfo}`)
    console.log(`  ${chalk.green('→')} ${info.task}`)
    console.log(`  Progress: ${progressBar} ${info.progress}%`)
    console.log('')
  }

  private createProgressBar(progress: number): string {
    const width = 20
    const filled = Math.round((progress / 100) * width)
    const empty = width - filled
    return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty))
  }

  showHeader(title: string, subtitle?: string): void {
    if (isTUIMode()) {
      tuiAdapter.logInfo(title)
      if (subtitle) {
        tuiAdapter.logInfo(subtitle)
      }
      return
    }

    // Non-TUI header
    console.log('')
    console.log(chalk.bold.blue('DocuMentor v3.1.0'))
    console.log(chalk.gray('━'.repeat(40)))
    console.log(chalk.bold(title))
    if (subtitle) {
      console.log(chalk.gray(subtitle))
    }
    console.log('')
  }

  showSummary(summary: {
    project: string;
    output: string;
    duration: number;
    files: number;
    success: boolean;
  }): void {
    if (isTUIMode()) {
      tuiAdapter.logSuccess(`Documentation generated for ${summary.project}`)
      // Display stats as individual info lines
      Object.entries(summary).forEach(([key, value]) => {
        if (key !== 'project') {
          tuiAdapter.logInfo(`${key}: ${value}`)
        }
      })
      return
    }

    // Non-TUI summary
    console.log('')
    console.log(chalk.gray('━'.repeat(40)))
    console.log(chalk.bold('Summary'))
    console.log(`📁 Project: ${chalk.cyan(summary.project)}`)
    console.log(`📍 Output:  ${chalk.cyan(summary.output)}`)
    console.log(`⏱️  Duration: ${chalk.yellow(this.formatDuration(summary.duration))}`)
    console.log(`📄 Files:   ${chalk.yellow(summary.files)}`)
    console.log(`${summary.success ? chalk.green('✓ Success') : chalk.red('✗ Failed')}`)
    console.log('')
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    }
    return `${seconds}s`
  }
}

export const logger = new Logger()