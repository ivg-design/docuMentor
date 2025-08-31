/**
 * TUI Interface for Node.js
 * Manages communication with Go TUI process
 */

import { spawn, ChildProcess } from 'child_process'
import * as os from 'os'
import * as path from 'path'
import {
  MessageType,
  TUIMessage,
  UpdateMessage,
  WorkerState,
  MessageBuilder,
  PerformanceUpdateData
} from './TUIProtocol'

export interface TUIConfig {
  project: string
  output: string
  enabled?: boolean
  batchInterval?: number
  metricsInterval?: number
  executable?: string
}

export class TUIInterface {
  private tuiProcess?: ChildProcess
  private messageQueue: TUIMessage[] = []
  private batchTimer?: NodeJS.Timeout
  private metricsInterval?: NodeJS.Timeout
  private workerStates: Map<number, WorkerState> = new Map()
  private isEnabled: boolean
  private isConnected: boolean = false
  private totalFiles: number = 0
  private processedFiles: number = 0
  private errorCount: number = 0
  private startTime: number = Date.now()

  constructor(private readonly config: TUIConfig) {
    this.isEnabled = config.enabled !== false && process.env.DOCUMENTOR_TUI !== 'false'
    
    if (this.isEnabled) {
      this.initialize()
    }
  }

  /**
   * Initialize TUI process and communication
   */
  private initialize(): void {
    try {
      // Determine TUI executable path
      const tuiPath = this.config.executable || path.join(__dirname, '..', '..', 'tui-ultra')
      
      // Spawn TUI process
      this.tuiProcess = spawn(tuiPath, [], {
        stdio: ['pipe', 'inherit', 'inherit'],
        env: { ...process.env, TERM: process.env.TERM || 'xterm-256color' }
      })

      // Handle TUI process events
      this.tuiProcess.on('error', (error) => {
        console.error('TUI process error:', error)
        this.fallbackToConsole()
      })

      this.tuiProcess.on('exit', (code) => {
        if (code !== 0) {
          console.error(`TUI process exited with code ${code}`)
        }
        this.isConnected = false
      })

      // Send initialization message
      this.sendInit()
      this.isConnected = true

      // Setup periodic tasks
      this.setupMetricsCollection()

    } catch (error) {
      console.error('Failed to initialize TUI:', error)
      this.fallbackToConsole()
    }
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
   * Send message directly (bypass queue)
   */
  private sendDirect(message: TUIMessage): void {
    if (!this.isConnected || !this.tuiProcess?.stdin?.writable) return

    try {
      const msg = JSON.stringify({
        ...message,
        timestamp: new Date().toISOString()
      })
      this.tuiProcess.stdin.write(msg + '\n')
    } catch (error) {
      console.error('Failed to send TUI message:', error)
    }
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

  /**
   * Fallback to console output if TUI fails
   */
  private fallbackToConsole(): void {
    this.isEnabled = false
    this.isConnected = false
    console.log('TUI disabled, falling back to console output')
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
      // Fallback to console
      const prefix = workerID > 0 ? `[W${workerID}]` : ''
      console.log(`${prefix} [${level}] ${message}`)
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
   * Control commands
   */
  pause(): void {
    this.send({ type: MessageType.CONTROL, action: 'pause' } as any)
  }

  resume(): void {
    this.send({ type: MessageType.CONTROL, action: 'resume' } as any)
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
    
    // Give TUI time to cleanup
    setTimeout(() => {
      if (this.tuiProcess) {
        this.tuiProcess.kill('SIGTERM')
      }
    }, 100)
  }

  /**
   * Check if TUI is enabled
   */
  get enabled(): boolean {
    return this.isEnabled && this.isConnected
  }
  
  // ========== Compatibility Methods ==========
  
  /**
   * Start TUI (compatibility method)
   */
  start(lockPath?: string): void {
    // TUI is already started in constructor if enabled
    // lockPath parameter ignored for compatibility
    this.log('INFO', 'TUI started')
  }
  
  /**
   * Log info message (compatibility method)
   */
  logInfo(message: string): void {
    this.log('INFO', message)
  }
  
  /**
   * Log error message (compatibility method)
   */
  logError(message: string): void {
    this.log('ERROR', message)
  }
  
  /**
   * Log warning message (compatibility method)
   */
  logWarning(message: string): void {
    this.log('WARN', message)
  }
  
  /**
   * Log debug message (compatibility method)
   */
  logDebug(message: string): void {
    this.log('DEBUG', message)
  }
  
  /**
   * Log success message (compatibility method)
   */
  logSuccess(message: string): void {
    this.log('INFO', `✓ ${message}`)
  }
  
  /**
   * Display debug message (compatibility method)
   */
  displayDebug(message: string): void {
    this.log('DEBUG', message)
  }
  
  /**
   * Debug log (compatibility method)
   */
  debug(message: string): void {
    this.log('DEBUG', message)
  }
}