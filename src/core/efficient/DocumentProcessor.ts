/**
 * ULTRA Document Processor
 * Main orchestrator for document processing with TUI integration
 */

import { TUIInterface } from '../TUIInterface'
import { WorkerPool } from './WorkerPool'
import { FileQueue } from './FileQueue'
import { DocumentPipeline } from './DocumentPipeline'
import { OutputManager } from './OutputManager'
import * as path from 'path'
import * as fs from 'fs/promises'

export interface ProcessorConfig {
  projectPath: string
  outputPath: string
  workers?: number
  enableTUI?: boolean
  claudeApiKey?: string
  maxRetries?: number
  batchSize?: number
}

export interface ProcessingStats {
  totalFiles: number
  processedFiles: number
  failedFiles: number
  startTime: number
  endTime?: number
  errors: string[]
}

export class DocumentProcessor {
  private tui: TUIInterface
  private workerPool: WorkerPool
  private fileQueue: FileQueue
  private pipeline: DocumentPipeline
  private outputManager: OutputManager
  private stats: ProcessingStats
  private isPaused: boolean = false

  constructor(private config: ProcessorConfig) {
    // Initialize TUI
    this.tui = new TUIInterface({
      project: config.projectPath,
      output: config.outputPath,
      enabled: config.enableTUI !== false
    })

    // Initialize components
    this.workerPool = new WorkerPool(config.workers || 4, this.tui)
    this.fileQueue = new FileQueue()
    this.pipeline = new DocumentPipeline(config)
    this.outputManager = new OutputManager(config.outputPath)
    
    // Initialize stats
    this.stats = {
      totalFiles: 0,
      processedFiles: 0,
      failedFiles: 0,
      startTime: Date.now(),
      errors: []
    }
  }

  /**
   * Main processing entry point
   */
  async process(): Promise<ProcessingStats> {
    try {
      this.stats.startTime = Date.now()
      
      // Initialize output
      await this.outputManager.initialize()
      
      // Phase 1: Discovery
      this.tui.updatePhase(1, 9, 'Discovery')
      this.tui.log('INFO', 'Starting document processing')
      
      const files = await this.discoverFiles()
      this.stats.totalFiles = files.length
      this.tui.setTotalFiles(files.length)
      this.tui.log('INFO', `Found ${files.length} files to process`)
      
      if (files.length === 0) {
        this.tui.log('WARN', 'No files found to process')
        return this.stats
      }
      
      // Phase 2: Analysis
      this.tui.updatePhase(2, 9, 'Analysis')
      await this.analyzeProject()
      
      // Phase 3: Queue Preparation
      this.tui.updatePhase(3, 9, 'Queue Preparation')
      await this.fileQueue.addFiles(files)
      this.tui.updateQueue(files.length, files.length)
      
      // Phase 4: Processing
      this.tui.updatePhase(4, 9, 'Processing')
      await this.processFiles()
      
      // Phase 5: Validation
      this.tui.updatePhase(5, 9, 'Validation')
      await this.validateOutput()
      
      // Phase 6: Output
      this.tui.updatePhase(6, 9, 'Output')
      await this.outputManager.finalize()
      
      // Phase 7: Cleanup
      this.tui.updatePhase(7, 9, 'Cleanup')
      await this.cleanup()
      
      // Phase 8: Report
      this.tui.updatePhase(8, 9, 'Report')
      await this.generateReport()
      
      // Phase 9: Complete
      this.tui.updatePhase(9, 9, 'Complete')
      this.stats.endTime = Date.now()
      
      this.tui.setStatus('Processing complete', 'complete')
      this.tui.log('INFO', `Processed ${this.stats.processedFiles} files successfully`)
      
      return this.stats
      
    } catch (error: any) {
      this.tui.log('ERROR', `Processing failed: ${error.message}`)
      this.tui.setStatus(`Error: ${error.message}`, 'error')
      throw error
    } finally {
      this.shutdown()
    }
  }

  /**
   * Discover files to process
   */
  private async discoverFiles(): Promise<string[]> {
    const files: string[] = []
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.md']
    
    const scanDir = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          
          // Skip common directories
          if (entry.isDirectory()) {
            if (!['node_modules', '.git', 'dist', 'build', '.archive', '.temp'].includes(entry.name)) {
              await scanDir(fullPath)
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name)
            if (extensions.includes(ext)) {
              files.push(fullPath)
            }
          }
        }
      } catch (error: any) {
        this.tui.log('WARN', `Failed to scan directory ${dir}: ${error.message}`)
      }
    }
    
    await scanDir(this.config.projectPath)
    return files
  }

  /**
   * Analyze project structure
   */
  private async analyzeProject(): Promise<void> {
    this.tui.log('INFO', 'Analyzing project structure')
    
    // Detect project type
    const packageJsonPath = path.join(this.config.projectPath, 'package.json')
    const goModPath = path.join(this.config.projectPath, 'go.mod')
    const cargoTomlPath = path.join(this.config.projectPath, 'Cargo.toml')
    
    let projectType = 'unknown'
    
    try {
      await fs.access(packageJsonPath)
      projectType = 'node'
      const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
      this.tui.log('INFO', `Detected Node.js project: ${pkg.name || 'unnamed'}`)
    } catch {
      // Not a Node project
    }
    
    try {
      await fs.access(goModPath)
      projectType = 'go'
      this.tui.log('INFO', 'Detected Go project')
    } catch {
      // Not a Go project
    }
    
    try {
      await fs.access(cargoTomlPath)
      projectType = 'rust'
      this.tui.log('INFO', 'Detected Rust project')
    } catch {
      // Not a Rust project
    }
    
    this.pipeline.setProjectType(projectType)
  }

  /**
   * Process files using worker pool
   */
  private async processFiles(): Promise<void> {
    // Start workers
    const workerPromises = []
    
    for (let i = 1; i <= this.workerPool.size; i++) {
      workerPromises.push(this.processWorker(i))
    }
    
    // Wait for all workers to complete
    await Promise.all(workerPromises)
  }

  /**
   * Individual worker processing loop
   */
  private async processWorker(workerId: number): Promise<void> {
    this.tui.updateWorker(workerId, { state: 'idle' })
    
    while (!this.fileQueue.isEmpty()) {
      // Handle pause
      while (this.isPaused) {
        this.tui.updateWorker(workerId, { state: 'blocked', operation: 'Paused' })
        await this.sleep(100)
      }
      
      const file = await this.fileQueue.getNext()
      if (!file) break
      
      const startTime = Date.now()
      
      try {
        // Update worker state
        this.tui.updateWorker(workerId, {
          state: 'busy',
          file: path.relative(this.config.projectPath, file),
          operation: 'reading',
          progress: 0
        })
        
        // Process through pipeline
        const document = await this.pipeline.process(file, (progress, operation) => {
          this.tui.updateWorker(workerId, {
            state: 'busy',
            file: path.relative(this.config.projectPath, file),
            operation,
            progress,
            timeElapsed: `${Math.round((Date.now() - startTime) / 1000)}s`
          })
        })
        
        // Save output
        await this.outputManager.save(document)
        
        // Update stats
        this.stats.processedFiles++
        this.tui.updateFileProgress(this.stats.processedFiles, this.stats.totalFiles)
        
        // Update worker
        const workerStats = this.workerPool.getStats(workerId)
        workerStats.completed++
        workerStats.totalTime += Date.now() - startTime
        this.workerPool.updateStats(workerId, workerStats)
        
        this.tui.updateWorker(workerId, {
          state: 'idle',
          stats: workerStats
        })
        
        this.tui.log('INFO', `Completed: ${path.basename(file)}`, workerId)
        
      } catch (error: any) {
        // Handle error
        this.stats.failedFiles++
        this.stats.errors.push(`${file}: ${error.message}`)
        
        const workerStats = this.workerPool.getStats(workerId)
        workerStats.failed++
        this.workerPool.updateStats(workerId, workerStats)
        
        this.tui.updateWorker(workerId, {
          state: 'error',
          file: path.relative(this.config.projectPath, file),
          stats: workerStats
        })
        
        this.tui.log('ERROR', `Failed: ${path.basename(file)} - ${error.message}`, workerId)
        this.tui.updateErrors(this.stats.failedFiles)
        
        // Brief pause before continuing
        await this.sleep(100)
      }
    }
    
    // Worker complete
    this.tui.updateWorker(workerId, { state: 'complete' })
  }

  /**
   * Validate generated output
   */
  private async validateOutput(): Promise<void> {
    this.tui.log('INFO', 'Validating output')
    const valid = await this.outputManager.validate()
    
    if (!valid) {
      this.tui.log('WARN', 'Some output files failed validation')
    }
  }

  /**
   * Cleanup temporary files
   */
  private async cleanup(): Promise<void> {
    this.tui.log('INFO', 'Cleaning up temporary files')
    await this.outputManager.cleanup()
  }

  /**
   * Generate processing report
   */
  private async generateReport(): Promise<void> {
    const duration = (this.stats.endTime || Date.now()) - this.stats.startTime
    const rate = this.stats.processedFiles / (duration / 1000)
    
    const report = {
      summary: {
        totalFiles: this.stats.totalFiles,
        processed: this.stats.processedFiles,
        failed: this.stats.failedFiles,
        duration: `${Math.round(duration / 1000)}s`,
        rate: `${rate.toFixed(1)} files/s`
      },
      errors: this.stats.errors
    }
    
    await this.outputManager.saveReport(report)
    this.tui.log('INFO', `Report saved: ${this.stats.processedFiles}/${this.stats.totalFiles} files processed`)
  }

  /**
   * Pause processing
   */
  pause(): void {
    this.isPaused = true
    this.tui.pause()
    this.tui.log('INFO', 'Processing paused')
  }

  /**
   * Resume processing
   */
  resume(): void {
    this.isPaused = false
    this.tui.resume()
    this.tui.log('INFO', 'Processing resumed')
  }

  /**
   * Shutdown and cleanup
   */
  private shutdown(): void {
    this.workerPool.shutdown()
    this.tui.shutdown()
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}