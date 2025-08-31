/**
 * Worker Pool Manager
 * Manages parallel processing workers with full TUI integration
 */

import { TUIInterfaceV4 } from '../TUIInterfaceV4'
import { DocumentPipeline } from './DocumentPipeline'
import { FileQueue } from './FileQueue'
import { OutputManager } from './OutputManager'
import { EventEmitter } from 'events'

/**
 * Worker state tracking
 */
export interface WorkerState {
  id: number
  status: 'idle' | 'busy' | 'blocked' | 'error' | 'complete'
  currentFile?: string
  currentOperation?: string
  progress: number
  startTime?: Date
  stats: WorkerStats
}

/**
 * Worker statistics
 */
export interface WorkerStats {
  completed: number
  failed: number
  processing: number
  totalTime: number
  avgTime: number
}

/**
 * Worker task
 */
interface WorkerTask {
  file: string
  workerId: number
  startTime: Date
  retries: number
}

/**
 * WorkerPool - Manages parallel document processing
 */
export class WorkerPool extends EventEmitter {
  private workers: Map<number, WorkerState> = new Map()
  private activeTasks: Map<number, WorkerTask> = new Map()
  private isRunning: boolean = false
  private isPaused: boolean = false
  
  constructor(
    public readonly size: number,
    private tui: TUIInterfaceV4,
    private pipeline: DocumentPipeline,
    private fileQueue: FileQueue,
    private outputManager: OutputManager
  ) {
    super()
    
    // Initialize workers
    for (let i = 1; i <= size; i++) {
      this.workers.set(i, {
        id: i,
        status: 'idle',
        progress: 0,
        stats: {
          completed: 0,
          failed: 0,
          processing: 0,
          totalTime: 0,
          avgTime: 0
        }
      })
      
      // Update TUI
      this.tui.updateWorker(i, {
        id: i,
        state: 'idle' as any,
        progress: 0,
        filesCompleted: 0,
        filesFailed: 0
      })
    }
  }
  
  /**
   * Start processing with all workers
   */
  async start(): Promise<void> {
    if (this.isRunning) return
    
    this.isRunning = true
    this.isPaused = false
    
    // Start workers
    const workerPromises: Promise<void>[] = []
    for (let i = 1; i <= this.size; i++) {
      workerPromises.push(this.runWorker(i))
    }
    
    // Wait for all workers to complete
    await Promise.all(workerPromises)
    
    this.isRunning = false
    this.emit('complete')
  }
  
  /**
   * Run a single worker
   */
  private async runWorker(workerId: number): Promise<void> {
    
    while (this.isRunning && !this.isPaused) {
      // Get next file from queue
      const file = await this.fileQueue.getNext()
      if (!file) {
        // No more files, worker is done
        this.updateWorkerState(workerId, 'idle')
        break
      }
      
      // Process file
      await this.processFile(workerId, file)
    }
    
    // Mark worker as complete
    this.updateWorkerState(workerId, 'complete')
  }
  
  /**
   * Process a single file with a worker
   */
  private async processFile(workerId: number, file: string): Promise<void> {
    const worker = this.workers.get(workerId)!
    const startTime = new Date()
    
    // Create task
    const task: WorkerTask = {
      file,
      workerId,
      startTime,
      retries: 0
    }
    this.activeTasks.set(workerId, task)
    
    try {
      // Update worker state to busy
      this.updateWorkerState(workerId, 'busy', file, 'reading')
      
      // Phase 1: Read file (10% progress)
      this.updateWorkerProgress(workerId, 10, 'reading')
      await this.delay(100) // Simulate work
      
      // Phase 2: Analyze (30% progress)
      this.updateWorkerProgress(workerId, 30, 'analyzing')
      await this.delay(200)
      
      // Phase 3: Generate documentation (60% progress)
      this.updateWorkerState(workerId, 'blocked', file, 'generating')
      this.updateWorkerProgress(workerId, 60, 'calling Claude API')
      
      // Process through pipeline
      const result = await this.pipeline.process(file, (progress: number, operation: string) => {
        this.updateWorkerProgress(workerId, 60 + (progress * 0.3), operation)
      })
      
      // Phase 4: Write output (90% progress)
      this.updateWorkerState(workerId, 'busy', file, 'writing')
      this.updateWorkerProgress(workerId, 90, 'writing')
      
      await this.outputManager.save(result)
      
      // Complete
      this.updateWorkerProgress(workerId, 100, 'complete')
      
      // Update stats
      const elapsed = Date.now() - startTime.getTime()
      worker.stats.completed++
      worker.stats.totalTime += elapsed
      worker.stats.avgTime = worker.stats.totalTime / worker.stats.completed
      
      // Update TUI
      this.tui.updateWorker(workerId, {
        filesCompleted: worker.stats.completed,
        filesFailed: worker.stats.failed
      })
      
      // Document generated
      this.tui.documentGenerated()
      
      // Log success
      this.tui.log('INFO', `Worker ${workerId} completed: ${file}`, workerId)
      
    } catch (error) {
      // Handle error
      worker.stats.failed++
      
      this.updateWorkerState(workerId, 'error', file, 'error')
      this.tui.updateWorker(workerId, {
        filesFailed: worker.stats.failed
      })
      
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.tui.log('ERROR', `Worker ${workerId} failed on ${file}: ${errorMsg}`, workerId)
      
      // Retry logic
      if (task.retries < 3) {
        task.retries++
        this.tui.log('WARN', `Retrying ${file} (attempt ${task.retries + 1})`, workerId)
        await this.fileQueue.addFiles([file]) // Re-queue
      }
      
    } finally {
      // Clean up
      this.activeTasks.delete(workerId)
      this.updateWorkerState(workerId, 'idle')
    }
  }
  
  /**
   * Update worker state
   */
  private updateWorkerState(
    workerId: number, 
    status: WorkerState['status'],
    file?: string,
    operation?: string
  ): void {
    const worker = this.workers.get(workerId)!
    worker.status = status
    worker.currentFile = file
    worker.currentOperation = operation
    
    if (status === 'busy' || status === 'blocked') {
      worker.startTime = new Date()
    }
    
    // Update TUI
    this.tui.updateWorker(workerId, {
      state: status as any,
      file,
      operation
    })
  }
  
  /**
   * Update worker progress
   */
  private updateWorkerProgress(
    workerId: number,
    progress: number,
    operation: string
  ): void {
    const worker = this.workers.get(workerId)!
    worker.progress = progress
    worker.currentOperation = operation
    
    // Update TUI
    this.tui.updateWorker(workerId, {
      progress,
      operation
    })
  }
  
  /**
   * Pause all workers
   */
  pause(): void {
    this.isPaused = true
    this.tui.log('INFO', 'Worker pool paused')
    
    // Update all busy workers to paused state
    this.workers.forEach((worker, id) => {
      if (worker.status === 'busy') {
        this.tui.updateWorker(id, {
          state: 'blocked' as any,
          operation: 'paused'
        })
      }
    })
  }
  
  /**
   * Resume all workers
   */
  resume(): void {
    this.isPaused = false
    this.tui.log('INFO', 'Worker pool resumed')
    
    // Update paused workers back to busy
    this.workers.forEach((worker, id) => {
      if (worker.status === 'blocked' && worker.currentOperation === 'paused') {
        this.tui.updateWorker(id, {
          state: 'busy' as any,
          operation: worker.currentOperation
        })
      }
    })
  }
  
  /**
   * Stop all workers
   */
  async stop(): Promise<void> {
    this.isRunning = false
    this.tui.log('INFO', 'Stopping worker pool...')
    
    // Wait for active tasks to complete
    const waitTime = 5000 // 5 seconds max
    const startTime = Date.now()
    
    while (this.activeTasks.size > 0 && Date.now() - startTime < waitTime) {
      await this.delay(100)
    }
    
    // Force stop if still running
    if (this.activeTasks.size > 0) {
      this.tui.log('WARN', `Force stopping ${this.activeTasks.size} active tasks`)
    }
    
    // Update all workers to complete
    this.workers.forEach((_worker, id) => {
      this.updateWorkerState(id, 'complete')
    })
  }
  
  /**
   * Get worker statistics
   */
  getStats(workerId: number): WorkerStats {
    return this.workers.get(workerId)?.stats || {
      completed: 0,
      failed: 0,
      processing: 0,
      totalTime: 0,
      avgTime: 0
    }
  }
  
  /**
   * Update worker statistics
   */
  updateStats(workerId: number, stats: WorkerStats): void {
    const worker = this.workers.get(workerId)
    if (worker) {
      worker.stats = stats
    }
  }
  
  /**
   * Get aggregate statistics
   */
  getAggregateStats(): WorkerStats {
    let total: WorkerStats = {
      completed: 0,
      failed: 0,
      processing: 0,
      totalTime: 0,
      avgTime: 0
    }
    
    this.workers.forEach(worker => {
      total.completed += worker.stats.completed
      total.failed += worker.stats.failed
      total.processing += worker.status === 'busy' ? 1 : 0
      total.totalTime += worker.stats.totalTime
    })
    
    if (total.completed > 0) {
      total.avgTime = total.totalTime / total.completed
    }
    
    return total
  }
  
  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  
  /**
   * Shutdown all workers
   */
  shutdown(): void {
    this.stop()
    this.tui.log('INFO', 'Worker pool shut down')
  }
}