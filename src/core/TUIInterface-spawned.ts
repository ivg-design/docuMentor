/**
 * TUI Interface for Spawned Mode
 * Used when Node.js is spawned BY the Go TUI
 */

import {
  MessageType,
  TUIMessage,
  UpdateMessage,
  WorkerState,
  MessageBuilder,
  PerformanceUpdateData
} from './TUIProtocol'
import * as os from 'os'

export interface TUIConfig {
  project: string
  output: string
  enabled?: boolean
  batchInterval?: number
  metricsInterval?: number
}

export class TUIInterface {
  private messageQueue: TUIMessage[] = []
  private batchTimer?: NodeJS.Timeout
  private metricsInterval?: NodeJS.Timeout
  private workerStates: Map<number, WorkerState> = new Map()
  private isEnabled: boolean
  private totalFiles: number = 0
  private processedFiles: number = 0
  private errorCount: number = 0
  private startTime: number = Date.now()

  constructor(private readonly config: TUIConfig) {
    // In spawned mode, TUI is enabled if TUI_MODE env is set
    this.isEnabled = process.env.TUI_MODE === 'true'
    
    if (this.isEnabled) {
      this.initialize()
    }
  }

  /**
   * Initialize in spawned mode
   */
  private initialize(): void {
    // Send initialization message to TUI via stdout
    this.sendInit()
    
    // Setup periodic tasks
    this.setupMetricsCollection()
  }

  /**
   * Send initialization message to TUI
   */
  private sendInit(): void {
    const initMsg = MessageBuilder.init(
      this.config.project,
      this.config.output,
      process.pid,
      this.totalFiles
    )
    this.sendDirect(initMsg)
  }

  /**
   * Send message directly to stdout (for TUI)
   */
  private sendDirect(message: TUIMessage): void {
    if (!this.isEnabled) return

    const msg = JSON.stringify({
      ...message,
      timestamp: new Date().toISOString()
    })
    
    // Send to stdout for TUI to read
    console.log(msg)
  }

  /**
   * Queue message for batching
   */
  private send(message: TUIMessage): void {
    if (!this.isEnabled) return

    this.messageQueue.push(message)
    this.scheduleBatch()
  }

  /**
   * Schedule batch processing
   */
  private scheduleBatch(): void {
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flush()
      }, this.config.batchInterval || 10)
    }
  }

  /**
   * Flush message queue
   */
  private flush(): void {
    if (this.messageQueue.length === 0) {
      this.batchTimer = undefined
      return
    }

    if (this.messageQueue.length === 1) {
      // Single message, send directly
      this.sendDirect(this.messageQueue[0])
    } else {
      // Multiple messages, send as batch
      const batch = MessageBuilder.batch(...(this.messageQueue as UpdateMessage[]))
      this.sendDirect(batch)
    }

    this.messageQueue = []
    this.batchTimer = undefined
  }

  /**
   * Setup metrics collection
   */
  private setupMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.collectAndSendMetrics()
    }, this.config.metricsInterval || 1000)
  }

  /**
   * Collect and send system metrics
   */
  private async collectAndSendMetrics(): Promise<void> {
    const metrics = await this.gatherSystemMetrics()
    this.send(MessageBuilder.metrics(metrics))
  }

  /**
   * Gather system metrics
   */
  private async gatherSystemMetrics(): Promise<PerformanceUpdateData> {
    const cpuUsage = process.cpuUsage()
    const memUsage = process.memoryUsage()
    const totalMem = os.totalmem()
    
    // Calculate CPU percentage (simplified)
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000 * 100 / os.cpus().length

    return {
      cpu: Math.min(100, cpuPercent),
      memory: (memUsage.heapUsed / totalMem) * 100,
      memoryUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      memoryTotal: Math.round(totalMem / 1024 / 1024),
      disk: 0, // TODO: Implement disk I/O monitoring
      networkDown: 0, // TODO: Implement network monitoring
      networkUp: 0
    }
  }

  // ========== Public API ==========

  /**
   * Set total file count
   */
  setTotalFiles(count: number): void {
    this.totalFiles = count
    this.send(MessageBuilder.updateFiles(this.processedFiles, count))
  }

  /**
   * Update worker state
   */
  updateWorker(id: number, state: Partial<WorkerState>): void {
    const current = this.workerStates.get(id) || { id, state: 'idle' }
    const updated = { ...current, ...state }
    this.workerStates.set(id, updated as WorkerState)
    
    this.send(MessageBuilder.updateWorker(id, updated))
  }

  /**
   * Update phase
   */
  updatePhase(current: number, total: number, name: string): void {
    this.send(MessageBuilder.updatePhase(current, total, name))
  }

  /**
   * Update file progress
   */
  updateFileProgress(processed: number, total: number): void {
    this.processedFiles = processed
    this.send(MessageBuilder.updateFiles(processed, total))
  }

  /**
   * Add log entry
   */
  log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, workerID = 0): void {
    if (!this.isEnabled) {
      // Fallback to stderr (not stdout which is for TUI messages)
      const prefix = workerID > 0 ? `[W${workerID}]` : ''
      console.error(`${prefix} [${level}] ${message}`)
      return
    }

    this.send(MessageBuilder.log(level, message, workerID))
  }

  /**
   * Update status message
   */
  setStatus(message: string, state?: string): void {
    this.send(MessageBuilder.status(message, state))
  }

  /**
   * Set processing status
   */
  setProcessing(inputFile: string, outputFile: string): void {
    this.send({
      type: MessageType.UPDATE,
      panel: 'status',
      method: 'SetProcessing',
      data: { inputFile, outputFile }
    } as UpdateMessage)
  }

  /**
   * Update error count
   */
  updateErrors(count: number): void {
    this.errorCount = count
    this.send({
      type: MessageType.UPDATE,
      panel: 'infobar',
      method: 'UpdateErrors',
      data: { errors: count }
    } as UpdateMessage)
  }

  /**
   * Update queue size
   */
  updateQueue(current: number, total: number): void {
    this.send({
      type: MessageType.UPDATE,
      panel: 'infobar',
      method: 'UpdateQueue',
      data: { current, total }
    } as UpdateMessage)
  }

  /**
   * Control commands acknowledgment
   */
  pause(): void {
    this.send({ type: MessageType.CONTROL, action: 'paused', data: {} } as any)
  }

  resume(): void {
    this.send({ type: MessageType.CONTROL, action: 'resumed', data: {} } as any)
  }

  /**
   * Cleanup and shutdown
   */
  shutdown(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval)
    }
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
    }
    
    // Flush any remaining messages
    this.flush()
    
    // Send shutdown message
    this.sendDirect({ type: MessageType.SHUTDOWN, data: {} })
  }

  /**
   * Check if TUI is enabled
   */
  get enabled(): boolean {
    return this.isEnabled
  }
}