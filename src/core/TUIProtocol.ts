/**
 * TUI Communication Protocol
 * Defines all message types and interfaces for Node.js <-> Go TUI communication
 */

export enum MessageType {
  // System
  INIT = 'init',
  SHUTDOWN = 'shutdown',
  READY = 'ready',
  
  // Updates
  UPDATE = 'update',
  BATCH = 'batch',
  
  // Progress
  PHASE = 'phase',
  FILE = 'file',
  WORKER = 'worker',
  
  // Performance
  METRICS = 'metrics',
  
  // Logging
  LOG = 'log',
  ERROR = 'error',
  
  // Control
  CONTROL = 'control',
  COMMAND = 'command',
  RESPONSE = 'response'
}

export interface TUIMessage {
  type: MessageType
  timestamp?: string
  data: any
}

// Panel-specific message interfaces
export interface UpdateMessage extends TUIMessage {
  type: MessageType.UPDATE
  panel: string
  method: string
  data: any
}

export interface BatchMessage extends TUIMessage {
  type: MessageType.BATCH
  updates: UpdateMessage[]
}

// Worker management
export interface WorkerState {
  id: number
  state: 'idle' | 'busy' | 'blocked' | 'error' | 'complete'
  file?: string
  operation?: string
  progress?: number
  timeElapsed?: string
  stats?: {
    completed: number
    failed: number
    processing: number
  }
}

export interface WorkerMessage extends TUIMessage {
  type: MessageType.WORKER
  data: {
    id: number
    state: string
    file?: string
    operation?: string
    progress?: number
    timeElapsed?: string
    stats?: {
      completed: number
      failed: number
      processing: number
    }
  }
}

// Phase management
export interface PhaseMessage extends TUIMessage {
  type: MessageType.PHASE
  data: {
    current: number
    total: number
    name: string
    progress?: number
  }
}

// File processing
export interface FileMessage extends TUIMessage {
  type: MessageType.FILE
  data: {
    processed: number
    total: number
    current?: string
    queue?: number
    errors?: number
  }
}

// Performance metrics
export interface MetricsMessage extends TUIMessage {
  type: MessageType.METRICS
  data: {
    cpu: number
    memory: number
    memoryUsed?: number
    memoryTotal?: number
    disk?: number
    networkDown?: number
    networkUp?: number
  }
}

// Logging
export interface LogMessage extends TUIMessage {
  type: MessageType.LOG
  data: {
    level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
    message: string
    workerID?: number
  }
}

// Control commands
export interface ControlMessage extends TUIMessage {
  type: MessageType.CONTROL
  action: 'pause' | 'resume' | 'stop' | 'toggle_debug' | 'toggle_raw'
}

// Initialization
export interface InitMessage extends TUIMessage {
  type: MessageType.INIT
  data: {
    project: string
    output: string
    pid: number
    totalFiles: number
    phases?: string[]
    workers?: number
  }
}

// Header update
export interface HeaderUpdateData {
  project?: string
  output?: string
  pid?: number
  locked?: boolean
  connected?: boolean
}

// InfoBar update
export interface InfoBarUpdateData {
  phaseCurrent?: number
  phaseTotal?: number
  phaseName?: string
  filesProcessed?: number
  filesTotal?: number
  queueCurrent?: number
  queueTotal?: number
  errors?: number
  docsComplete?: number
  docsTotal?: number
}

// Performance update
export interface PerformanceUpdateData {
  cpu?: number
  memory?: number
  memoryUsed?: number
  memoryTotal?: number
  disk?: number
  networkDown?: number
  networkUp?: number
}

// Status update
export interface StatusUpdateData {
  state?: 'idle' | 'processing' | 'paused' | 'error' | 'complete'
  inputFile?: string
  outputFile?: string
  message?: string
}

// Helper function to create messages
export class MessageBuilder {
  static init(project: string, output: string, pid: number, totalFiles: number): InitMessage {
    return {
      type: MessageType.INIT,
      data: {
        project,
        output,
        pid,
        totalFiles,
        phases: ['Discovery', 'Analysis', 'Processing', 'Generation', 'Validation', 'Output', 'Cleanup', 'Report', 'Complete'],
        workers: 4
      }
    }
  }

  static updateWorker(id: number, state: Partial<WorkerState>): UpdateMessage {
    return {
      type: MessageType.UPDATE,
      panel: 'workers',
      method: 'UpdateWorker',
      data: { id, ...state }
    }
  }

  static updatePhase(current: number, total: number, name: string): UpdateMessage {
    return {
      type: MessageType.UPDATE,
      panel: 'infobar',
      method: 'UpdatePhase',
      data: { current, total, name }
    }
  }

  static updateFiles(processed: number, total: number): UpdateMessage {
    return {
      type: MessageType.UPDATE,
      panel: 'infobar',
      method: 'UpdateFiles',
      data: { processed, total }
    }
  }

  static log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, workerID = 0): LogMessage {
    return {
      type: MessageType.LOG,
      data: { level, message, workerID }
    }
  }

  static metrics(data: PerformanceUpdateData): UpdateMessage {
    return {
      type: MessageType.UPDATE,
      panel: 'performance',
      method: 'UpdateMetrics',
      data
    }
  }

  static status(message: string, state?: string): UpdateMessage {
    return {
      type: MessageType.UPDATE,
      panel: 'status',
      method: state === 'error' ? 'SetError' : 'SetMessage',
      data: { message }
    }
  }

  static batch(...updates: UpdateMessage[]): BatchMessage {
    return {
      type: MessageType.BATCH,
      updates,
      data: {} // BatchMessage requires data field
    }
  }
}