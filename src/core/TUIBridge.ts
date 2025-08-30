// DocuMentor V3.1 - TUI Bridge
// Simple JSON message passing to existing Go TUI
// NO abstractions, direct stdout communication

import {
  Phase,
  TUIMessage,
  TUIMessageType,
  PhaseMessage,
  TaskMessage,
  FileMessage,
  ProgressMessage,
  LogMessage,
  PasswordRequest,
  PasswordResponse
} from '../types/index.js'

// ============================================================================
// TUIBridge - JSON Message Passing to Go TUI
// ============================================================================

export class TUIBridge {
  private messageId: number = 0
  private pendingPasswordRequests: Map<string, {
    resolve: (password: string | null) => void
    timeout: NodeJS.Timeout
  }> = new Map()

  constructor() {
    this.setupPasswordResponseListener()
  }

  // ============================================================================
  // Phase Communication
  // ============================================================================

  phaseStart(phase: Phase, displayName: string, index: number, total: number): void {
    this.sendMessage('phase_start', {
      phase,
      displayName,
      index,
      total
    })
  }

  phaseComplete(phase: Phase, displayName: string, index: number, total: number): void {
    this.sendMessage('phase_complete', {
      phase,
      displayName,
      index,
      total
    })
  }

  // ============================================================================
  // Task Communication
  // ============================================================================

  taskStart(taskName: string, displayName: string, phase: Phase): void {
    this.sendMessage('task_start', {
      task: taskName,
      displayName,
      phase
    })
  }

  taskComplete(taskName: string, displayName: string, phase: Phase): void {
    this.sendMessage('task_complete', {
      task: taskName,
      displayName,
      phase
    })
  }

  // ============================================================================
  // File Communication
  // ============================================================================

  fileStart(file: string, operation: string): void {
    this.sendMessage('file_start', {
      file,
      operation
    })
  }

  fileComplete(file: string, operation: string): void {
    this.sendMessage('file_complete', {
      file,
      operation
    })
  }

  // ============================================================================
  // Progress Communication
  // ============================================================================

  progressUpdate(
    phase: Phase,
    phaseProgress: number,
    overallProgress: number,
    filesProcessed: number,
    filesTotal: number,
    currentFile?: string
  ): void {
    this.sendMessage('progress_update', {
      phase,
      phaseProgress,
      overallProgress,
      filesProcessed,
      filesTotal,
      currentFile
    })
  }

  // ============================================================================
  // Logging
  // ============================================================================

  log(level: 'info' | 'warn' | 'error' | 'debug', message: string, details?: any): void {
    this.sendMessage('log', {
      level,
      message,
      details
    })
  }

  error(message: string, details?: any): void {
    this.sendMessage('error', {
      message,
      details,
      timestamp: new Date().toISOString()
    })
  }

  // ============================================================================
  // Completion
  // ============================================================================

  completion(data: {
    documentsGenerated: number
    duration: number
    outputPath: string
  }): void {
    this.sendMessage('completion', {
      ...data,
      success: true,
      timestamp: new Date().toISOString()
    })
  }

  // ============================================================================
  // Password Bridge Integration
  // ============================================================================

  async requestPassword(
    operation: string,
    path: string,
    timeoutMs: number = 30000
  ): Promise<string | null> {
    const requestId = `pwd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Send password request to Go TUI
    this.sendMessage('password_request', {
      requestId,
      operation,
      path,
      prompt: `Permission needed for ${operation}`,
      timeout: timeoutMs
    })

    // Wait for response with timeout
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingPasswordRequests.delete(requestId)
        this.log('warn', `Password request timed out for operation: ${operation}`)
        resolve(null)
      }, timeoutMs)

      this.pendingPasswordRequests.set(requestId, {
        resolve,
        timeout
      })
    })
  }

  handlePasswordResponse(requestId: string, password?: string, cancelled: boolean = false): void {
    const pending = this.pendingPasswordRequests.get(requestId)
    if (!pending) {
      this.log('warn', `Received password response for unknown request: ${requestId}`)
      return
    }

    clearTimeout(pending.timeout)
    this.pendingPasswordRequests.delete(requestId)

    if (cancelled) {
      this.log('info', 'Password request was cancelled by user')
      pending.resolve(null)
    } else {
      pending.resolve(password || null)
    }
  }

  // ============================================================================
  // Core Message Sending
  // ============================================================================

  private sendMessage(type: TUIMessageType, data: any): void {
    const message: TUIMessage = {
      type,
      timestamp: new Date().toISOString(),
      data
    }

    // Send to stdout for Go TUI consumption
    const jsonMessage = JSON.stringify(message)
    process.stdout.write(`TUI_MSG:${jsonMessage}\n`)

    // Increment message ID
    this.messageId++

    // Debug logging in development
    if (process.env.DOCUMENTOR_DEBUG === 'true') {
      console.error(`[TUIBridge] Sent ${type}: ${JSON.stringify(data)}`)
    }
  }

  // ============================================================================
  // Password Response Listener Setup
  // ============================================================================

  private setupPasswordResponseListener(): void {
    // Listen for password responses from stdin
    process.stdin.setEncoding('utf-8')
    process.stdin.on('data', (data: string) => {
      try {
        // Look for password response messages
        const lines = data.trim().split('\n')
        for (const line of lines) {
          if (line.startsWith('PWD_RESPONSE:')) {
            const jsonData = line.substring('PWD_RESPONSE:'.length)
            const response = JSON.parse(jsonData) as PasswordResponse['data']
            this.handlePasswordResponse(
              response.requestId,
              response.password,
              response.cancelled
            )
          }
        }
      } catch (error) {
        this.log('error', `Failed to parse password response: ${error}`)
      }
    })
  }

  // ============================================================================
  // Message Validation
  // ============================================================================

  private validateMessage(type: TUIMessageType, data: any): boolean {
    // Basic validation to ensure required fields are present
    switch (type) {
    case 'phase_start':
    case 'phase_complete':
      return data.phase && data.displayName && typeof data.index === 'number' && typeof data.total === 'number'

    case 'task_start':
    case 'task_complete':
      return data.task && data.displayName && data.phase

    case 'file_start':
    case 'file_complete':
      return data.file && data.operation

    case 'progress_update':
      return data.phase &&
               typeof data.phaseProgress === 'number' &&
               typeof data.overallProgress === 'number' &&
               typeof data.filesProcessed === 'number' &&
               typeof data.filesTotal === 'number'

    case 'log':
      return data.level && data.message

    case 'error':
      return data.message

    case 'password_request':
      return data.requestId && data.operation && data.path && data.prompt

    case 'completion':
      return typeof data.documentsGenerated === 'number' && typeof data.duration === 'number'

    default:
      return true
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Send a batch of progress updates for efficient TUI updates
   */
  batchProgressUpdate(updates: {
    phase: Phase
    phaseProgress: number
    overallProgress: number
    filesProcessed: number
    filesTotal: number
    currentFiles: string[]
  }): void {
    this.sendMessage('progress_batch', {
      ...updates,
      batchSize: updates.currentFiles.length
    })
  }

  /**
   * Send memory and performance stats
   */
  performanceUpdate(stats: {
    memoryUsage: number
    cpuUsage: number
    activeFiles: number
    queuedFiles: number
  }): void {
    this.sendMessage('performance_update', stats)
  }

  /**
   * Send detailed error with context
   */
  detailedError(error: {
    code: string
    message: string
    phase?: Phase
    task?: string
    file?: string
    stack?: string
    recoverable: boolean
    suggestions?: string[]
  }): void {
    this.sendMessage('detailed_error', {
      ...error,
      timestamp: new Date().toISOString(),
      pid: process.pid
    })
  }

  /**
   * Send final statistics
   */
  finalStats(stats: {
    totalFiles: number
    documentsGenerated: number
    duration: number
    peakMemoryUsage: number
    avgProcessingTime: number
    errors: number
    warnings: number
  }): void {
    this.sendMessage('final_stats', {
      ...stats,
      endTime: new Date().toISOString(),
      pid: process.pid
    })
  }

  /**
   * Graceful shutdown notification
   */
  shutdown(reason: 'complete' | 'error' | 'cancelled' | 'interrupted'): void {
    this.sendMessage('shutdown', {
      reason,
      timestamp: new Date().toISOString(),
      pid: process.pid,
      pendingRequests: this.pendingPasswordRequests.size
    })

    // Clear all pending password requests
    for (const [requestId, pending] of this.pendingPasswordRequests) {
      clearTimeout(pending.timeout)
      pending.resolve(null)
    }
    this.pendingPasswordRequests.clear()
  }
}

// ============================================================================
// Export Default Instance
// ============================================================================

export default TUIBridge
