# TUI Message Protocol Definition v3.0

## Critical Architecture Decision
This document defines the COMPLETE message protocol between:
- Go TUI (parent process) 
- Node.js DocumentProcessor (child process)
- Efficient Pipeline Workers (parallel processors)

## Message Flow Architecture
```
Efficient Pipeline Workers → TUIInterface.ts → stdout → Go TUI → Display
                          ↓
                    (batching & queuing)
```

## Core Message Types

### 1. Base Message Structure
```typescript
interface TUIMessage {
  type: MessageType
  timestamp: string  // ISO 8601
  sequence?: number  // For ordering
  data: any
}

enum MessageType {
  // System Messages
  INIT = 'init',
  READY = 'ready', 
  SHUTDOWN = 'shutdown',
  ERROR = 'error',
  
  // Progress Messages  
  PHASE = 'phase',
  FILE = 'file',
  
  // Worker Messages (NEW)
  WORKER = 'worker',
  WORKER_BATCH = 'worker_batch',
  
  // Performance Messages (NEW)
  METRICS = 'metrics',
  
  // Logging
  LOG = 'log',
  DEBUG = 'debug',
  
  // Control Messages (NEW)
  COMMAND = 'command',
  RESPONSE = 'response',
  
  // Batch Message (NEW)
  BATCH = 'batch'
}
```

### 2. Worker Messages (NEW - Critical for 4-worker display)
```typescript
interface WorkerMessage extends TUIMessage {
  type: MessageType.WORKER
  data: {
    workerId: number  // 1-4
    state: WorkerState
    file?: string
    operation?: string
    progress?: number  // 0-100
    timeElapsed?: number  // ms
    error?: string
    stats?: WorkerStats
  }
}

enum WorkerState {
  IDLE = 'idle',
  BUSY = 'busy',
  BLOCKED = 'blocked',  // Waiting for Claude
  ERROR = 'error',
  COMPLETE = 'complete'
}

interface WorkerStats {
  completed: number
  failed: number
  avgTime: number  // ms
  totalTime: number
}

// Batch update for all workers
interface WorkerBatchMessage extends TUIMessage {
  type: MessageType.WORKER_BATCH
  data: {
    workers: WorkerMessage['data'][]
  }
}
```

### 3. Performance Metrics (NEW)
```typescript
interface MetricsMessage extends TUIMessage {
  type: MessageType.METRICS
  data: {
    cpu: number  // 0-100
    memory: {
      used: number  // bytes
      total: number
      percentage: number
    }
    disk: {
      read: number  // bytes/sec
      write: number
    }
    network: {
      up: number  // bytes/sec
      down: number
    }
    claude: {
      calls: number
      maxCalls: number
      tokens: number
      maxTokens: number
      cost: number  // USD
      remaining: number  // calls remaining
    }
    queue: {
      pending: number
      processing: number
      completed: number
      failed: number
    }
  }
}
```

### 4. Enhanced Phase Messages
```typescript
interface PhaseMessage extends TUIMessage {
  type: MessageType.PHASE
  data: {
    current: number  // 1-9 for display (even if 3 internally)
    total: number    // Always 9 for user expectation
    name: string
    subPhase?: string
    percentage?: number  // 0-100
    eta?: number  // seconds
  }
}
```

### 5. Enhanced File Messages
```typescript
interface FileMessage extends TUIMessage {
  type: MessageType.FILE
  data: {
    processed: number
    total: number
    current?: string
    queue?: number  // Files in queue
    rate?: number   // Files per second
    success?: number
    failed?: number
    skipped?: number
  }
}
```

### 6. Batch Messages (for efficiency)
```typescript
interface BatchMessage extends TUIMessage {
  type: MessageType.BATCH
  data: {
    messages: TUIMessage[]
  }
}
```

### 7. Control Messages (bidirectional)
```typescript
interface CommandMessage extends TUIMessage {
  type: MessageType.COMMAND
  data: {
    command: 'pause' | 'resume' | 'abort' | 'skip' | 'retry'
    target?: number  // Worker ID if applicable
    args?: any
  }
}

interface ResponseMessage extends TUIMessage {
  type: MessageType.RESPONSE
  data: {
    command: string
    success: boolean
    result?: any
    error?: string
  }
}
```

## Go TUI Updates Required

### 1. Update Message Struct
```go
// src/tui/main.go
type Message struct {
    Type        string      `json:"type"`
    Timestamp   string      `json:"timestamp"`
    Sequence    int         `json:"sequence,omitempty"`
    Data        interface{} `json:"data"`
}

// Add worker-specific structs
type WorkerData struct {
    WorkerID    int         `json:"workerId"`
    State       string      `json:"state"`
    File        string      `json:"file,omitempty"`
    Operation   string      `json:"operation,omitempty"`
    Progress    int         `json:"progress,omitempty"`
    TimeElapsed int         `json:"timeElapsed,omitempty"`
    Error       string      `json:"error,omitempty"`
    Stats       WorkerStats `json:"stats,omitempty"`
}

type WorkerStats struct {
    Completed  int `json:"completed"`
    Failed     int `json:"failed"`
    AvgTime    int `json:"avgTime"`
    TotalTime  int `json:"totalTime"`
}
```

### 2. Add Worker Display Panel
```go
// New component for worker visualization
type WorkerPanel struct {
    *tview.Box
    workers [4]WorkerData
}

func (w *WorkerPanel) Draw(screen tcell.Screen) {
    // Draw 4 worker boxes as per TUI_LAYOUT_ULTRA_DESIGN.md
}
```

## TypeScript TUIInterface Implementation

### 1. Create TUIInterface.ts
```typescript
// src/core/efficient/TUIInterface.ts
export class TUIInterface {
  private messageQueue: TUIMessage[] = []
  private batchTimer?: NodeJS.Timeout
  private sequence: number = 0
  private workerStates: Map<number, WorkerData> = new Map()
  
  constructor() {
    // Initialize 4 workers
    for (let i = 1; i <= 4; i++) {
      this.workerStates.set(i, {
        workerId: i,
        state: WorkerState.IDLE,
        stats: { completed: 0, failed: 0, avgTime: 0, totalTime: 0 }
      })
    }
  }
  
  // Send message with batching
  private send(message: TUIMessage): void {
    message.timestamp = new Date().toISOString()
    message.sequence = ++this.sequence
    
    this.messageQueue.push(message)
    
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flush(), 10)
    }
  }
  
  // Flush batch
  private flush(): void {
    if (this.messageQueue.length === 0) return
    
    if (this.messageQueue.length === 1) {
      // Single message, send directly
      console.log(JSON.stringify(this.messageQueue[0]))
    } else {
      // Multiple messages, batch them
      const batch: BatchMessage = {
        type: MessageType.BATCH,
        timestamp: new Date().toISOString(),
        data: { messages: this.messageQueue }
      }
      console.log(JSON.stringify(batch))
    }
    
    this.messageQueue = []
    this.batchTimer = undefined
  }
  
  // Worker updates
  updateWorker(workerId: number, update: Partial<WorkerData>): void {
    const current = this.workerStates.get(workerId)!
    const updated = { ...current, ...update }
    this.workerStates.set(workerId, updated)
    
    this.send({
      type: MessageType.WORKER,
      timestamp: '',
      data: updated
    })
  }
  
  // Batch worker update (more efficient)
  updateAllWorkers(): void {
    const workers = Array.from(this.workerStates.values())
    this.send({
      type: MessageType.WORKER_BATCH,
      timestamp: '',
      data: { workers }
    })
  }
  
  // Performance metrics
  sendMetrics(metrics: MetricsData): void {
    this.send({
      type: MessageType.METRICS,
      timestamp: '',
      data: metrics
    })
  }
}
```

## Integration Points

### 1. DocumentProcessor Integration
```typescript
// src/core/efficient/DocumentProcessor.ts
class DocumentProcessor {
  private tui: TUIInterface
  
  private async processWorker(workerId: number): Promise<void> {
    this.tui.updateWorker(workerId, {
      state: WorkerState.IDLE
    })
    
    while (!this.queue.isEmpty()) {
      const file = this.queue.take()
      if (!file) break
      
      const startTime = Date.now()
      
      this.tui.updateWorker(workerId, {
        state: WorkerState.BUSY,
        file: file.name,
        operation: 'processing',
        progress: 0
      })
      
      try {
        // Process with progress callbacks
        const doc = await this.pipeline.process(file, (progress, op) => {
          this.tui.updateWorker(workerId, {
            operation: op,
            progress,
            timeElapsed: Date.now() - startTime
          })
        })
        
        // Update stats
        const stats = this.getWorkerStats(workerId)
        stats.completed++
        stats.totalTime += Date.now() - startTime
        stats.avgTime = stats.totalTime / stats.completed
        
        this.tui.updateWorker(workerId, {
          state: WorkerState.IDLE,
          stats
        })
        
      } catch (error) {
        this.tui.updateWorker(workerId, {
          state: WorkerState.ERROR,
          error: error.message
        })
      }
    }
    
    this.tui.updateWorker(workerId, {
      state: WorkerState.COMPLETE
    })
  }
}
```

## Testing Strategy

### 1. Mock Worker Test
```typescript
// test/tui-protocol.test.ts
const tui = new TUIInterface()

// Simulate 4 workers
for (let i = 1; i <= 4; i++) {
  tui.updateWorker(i, {
    state: WorkerState.BUSY,
    file: `test${i}.ts`,
    progress: Math.random() * 100
  })
}

// Verify JSON output format
```

### 2. Go TUI Mock Test
```go
// Create mock messages
mockWorkerMsg := `{
  "type": "worker",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "workerId": 1,
    "state": "busy",
    "file": "test.ts",
    "progress": 50
  }
}`

// Test parsing and display
```

## Migration Path

### Phase 1: Protocol Definition (THIS DOCUMENT)
✅ Define all message types
✅ Define Go structures
✅ Define TypeScript interfaces

### Phase 2: Go TUI Update
- Add worker panel component
- Update message parsing
- Test with mock data

### Phase 3: TypeScript Implementation
- Create TUIInterface.ts
- Integrate with DocumentProcessor
- Test message generation

### Phase 4: Full Integration
- Connect all components
- Test with real processing
- Verify display

## Benefits

1. **Clear Contract**: All components know exactly what to send/receive
2. **Worker Visibility**: Can see all 4 workers in parallel
3. **Performance Monitoring**: Real-time metrics
4. **Bidirectional Control**: Can pause/resume workers
5. **Efficient Batching**: Reduces message overhead
6. **Future Proof**: Easy to add new message types

## Success Criteria

- [ ] Go TUI can parse all message types
- [ ] TypeScript generates correct JSON
- [ ] Worker states display correctly
- [ ] Performance metrics update in real-time
- [ ] Batch messages work efficiently
- [ ] No message loss or corruption
- [ ] Control commands work (pause/resume)