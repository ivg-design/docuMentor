/**
 * DocumentProcessor - Main orchestrator for efficient parallel processing
 * Processes multiple documents in parallel but outputs sequentially
 */

import * as path from 'path'
import { DocumentQueue } from './DocumentQueue'
import { DocumentPipeline } from './DocumentPipeline'
import { OutputManager } from './OutputManager'
import { ProgressReporter } from './ProgressReporter'
import { SimpleFileScanner } from './SimpleFileScanner'
import { Logger } from '../Logger'
import { DocumentorConfig } from '../../types'

export interface SourceFile {
  path: string
  name: string
  size: number
  extension: string
}

export interface ProcessedDocument {
  filePath: string
  outputPath: string
  title: string
  content: string
  frontmatter: Record<string, any>
  tags: string[]
  success: boolean
  error?: string
}

export class DocumentProcessor {
  private queue: DocumentQueue
  private pipeline: DocumentPipeline
  private output: OutputManager
  private progress: ProgressReporter
  private scanner: SimpleFileScanner
  private config: DocumentorConfig
  private projectPath: string
  private readonly WORKER_COUNT = 4 // Process 4 documents in parallel

  constructor(config: DocumentorConfig, projectPath: string) {
    this.config = config
    this.projectPath = projectPath
    
    // Initialize components
    this.queue = new DocumentQueue()
    this.pipeline = new DocumentPipeline(config, projectPath)
    this.output = new OutputManager(config, projectPath)
    this.progress = new ProgressReporter()
    this.scanner = new SimpleFileScanner()
  }

  /**
   * Main processing entry point
   */
  async process(): Promise<void> {
    try {
      Logger.info('Starting efficient document processing', 'DocumentProcessor')
      
      // Using Claude Code CLI - no API key needed
      console.log('🤖 Using Claude Code CLI for documentation generation')
      
      // 1. Quick scan - find all documentable files (no AI, no Claude)
      this.progress.startPhase('Scanning', 'Finding documentable files...')
      const files = await this.scanner.scan(this.projectPath)
      Logger.info(`Found ${files.length} documentable files`, 'DocumentProcessor')
      
      // Set total for progress tracking
      this.progress.setTotal(files.length)
      
      // 2. Queue all documents
      files.forEach(file => this.queue.add(file))
      
      // 3. Start output manager
      this.output.startWriting()
      
      // 4. Start parallel workers
      this.progress.startPhase('Processing', 'Generating documentation...')
      const workers = Array(this.WORKER_COUNT).fill(0).map((_, i) => 
        this.processWorker(i + 1)
      )
      
      // 5. Wait for all workers to complete
      await Promise.all(workers)
      
      // 6. Wait for output to complete
      await this.output.waitForCompletion()
      
      // 7. Generate index/summary
      this.progress.startPhase('Finalizing', 'Creating index...')
      await this.output.generateIndex()
      
      Logger.success('Document processing completed successfully', 'DocumentProcessor')
      this.progress.complete()
      
    } catch (error) {
      Logger.error(`Document processing failed: ${(error as Error).message}`, 'DocumentProcessor')
      this.progress.error(`Processing failed: ${(error as Error).message}`)
      throw error
    }
  }

  /**
   * Worker that processes documents from queue
   */
  private async processWorker(workerId: number): Promise<void> {
    Logger.debug(`Worker ${workerId} started`, 'DocumentProcessor')
    
    while (!this.queue.isEmpty()) {
      const file = this.queue.take()
      if (!file) break // Queue is empty
      
      try {
        Logger.debug(`Worker ${workerId} processing ${file.name}`, 'DocumentProcessor')
        
        // Process through pipeline (all phases for this one document)
        const doc = await this.pipeline.process(file)
        
        // Queue for sequential output
        this.output.queue(doc)
        
        // Report progress in real-time
        this.progress.increment(file.name)
        
      } catch (error) {
        Logger.error(`Worker ${workerId} failed on ${file.name}: ${(error as Error).message}`, 'DocumentProcessor')
        
        // Create error document
        const errorDoc: ProcessedDocument = {
          filePath: file.path,
          outputPath: '',
          title: file.name,
          content: `# Error Processing ${file.name}\n\nFailed to generate documentation: ${(error as Error).message}`,
          frontmatter: { error: true },
          tags: [],
          success: false,
          error: (error as Error).message
        }
        
        this.output.queue(errorDoc)
        this.progress.increment(file.name, false)
      }
    }
    
    Logger.debug(`Worker ${workerId} finished`, 'DocumentProcessor')
  }
}

export default DocumentProcessor