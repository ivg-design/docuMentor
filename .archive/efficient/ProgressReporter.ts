/**
 * ProgressReporter - Reports real-time progress to TUI
 */

import { tuiAdapter } from '../TUIAdapter'
import { Logger } from '../Logger'

export class ProgressReporter {
  private startTime: number = 0
  private totalFiles: number = 0
  private processedFiles: number = 0
  private currentPhase: string = ''
  private successCount: number = 0
  private errorCount: number = 0

  /**
   * Start a new phase
   */
  startPhase(name: string, description: string): void {
    this.currentPhase = name
    
    // Console output for non-TUI mode
    console.log(`\n📋 Phase: ${name} - ${description}`)
    
    // Report to TUI if available
    if (process.env.DOCUMENTOR_TUI === 'true') {
      tuiAdapter.updatePhase(0, 9, name)
    }
    
    Logger.info(`Phase: ${name} - ${description}`, 'Progress')
  }

  /**
   * Set total number of files
   */
  setTotal(total: number): void {
    this.totalFiles = total
    this.processedFiles = 0
    this.startTime = Date.now()
    
    console.log(`📊 Total files to process: ${total}`)
    
    if (process.env.DOCUMENTOR_TUI === 'true') {
      tuiAdapter.updateFileProgress(0, total)
    }
  }

  /**
   * Increment progress for a file
   */
  increment(fileName: string, success: boolean = true): void {
    this.processedFiles++
    
    if (success) {
      this.successCount++
    } else {
      this.errorCount++
    }
    
    const percentage = Math.round((this.processedFiles / this.totalFiles) * 100)
    const elapsed = Date.now() - this.startTime
    const rate = this.processedFiles / (elapsed / 1000) // files per second
    const eta = (this.totalFiles - this.processedFiles) / rate
    
    // Console progress
    const status = success ? '✅' : '❌'
    console.log(`${status} [${this.processedFiles}/${this.totalFiles}] ${fileName} (${percentage}%)`)
    
    // Update TUI if available
    if (process.env.DOCUMENTOR_TUI === 'true') {
      tuiAdapter.updateFileProgress(this.processedFiles, this.totalFiles, fileName)
    }
    
    // Log progress every 10 files
    if (this.processedFiles % 10 === 0 || this.processedFiles === this.totalFiles) {
      Logger.info(
        `Progress: ${this.processedFiles}/${this.totalFiles} (${percentage}%) - ${rate.toFixed(1)} files/sec`,
        'Progress'
      )
    }
  }

  /**
   * Report completion
   */
  complete(): void {
    const elapsed = Date.now() - this.startTime
    
    console.log(`\n✨ Documentation generation complete!`)
    console.log(`📈 Results: ${this.successCount} success, ${this.errorCount} errors`)
    console.log(`⏱️  Time: ${this.formatTime(elapsed / 1000)}`)
    
    if (process.env.DOCUMENTOR_TUI === 'true') {
      tuiAdapter.updatePhase(9, 9, 'Complete')
      tuiAdapter.log('success', `✓ Processed ${this.successCount} files successfully`)
      if (this.errorCount > 0) {
        tuiAdapter.log('warning', `⚠ ${this.errorCount} files had errors`)
      }
    }
    
    Logger.success(
      `Completed: ${this.successCount} success, ${this.errorCount} errors in ${this.formatTime(elapsed / 1000)}`,
      'Progress'
    )
  }

  /**
   * Report error
   */
  error(message: string): void {
    tuiAdapter.log('error', message)
    Logger.error(message, 'Progress')
  }

  /**
   * Format time in seconds to human readable
   */
  private formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`
    }
    const minutes = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${minutes}m ${secs}s`
  }
}