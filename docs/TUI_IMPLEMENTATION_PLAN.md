# TUI Implementation Plan

## Phase 1: Fix Critical Bug & Prepare Foundation (Day 1)

### 1.1 Fix Claude Content Bug (CRITICAL - 30 mins)
```typescript
// src/core/efficient/DocumentPipeline.ts
const request = {
  type: 'documentation' as const,
  sourceContent: content,  // ← FIX: was 'content'
  context: `File: ${file.name}\nProject: ${this.projectName}\nType: ${docType}`,
  // ... rest
}
```

### 1.2 Create Enhanced Message Protocol (1 hour)
```typescript
// src/core/TUIProtocol.ts
export interface TUIMessage {
  type: MessageType
  timestamp: string
  data: any
}

export enum MessageType {
  // System
  INIT = 'init',
  SHUTDOWN = 'shutdown',
  
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
  COMMAND = 'command',
  RESPONSE = 'response'
}

export interface WorkerMessage {
  type: MessageType.WORKER
  data: {
    workers: Array<{
      id: number
      state: 'busy' | 'idle' | 'blocked' | 'error' | 'complete'
      currentFile?: string
      currentOperation?: string
      progress?: number
      timeElapsed?: number
      stats: {
        completed: number
        failed: number
        avgTime: number
      }
    }>
  }
}

export interface MetricsMessage {
  type: MessageType.METRICS
  data: {
    cpu: number
    memory: { used: number, total: number, percentage: number }
    disk: { read: number, write: number }
    network: { up: number, down: number }
    claude: {
      calls: number
      maxCalls: number
      tokens: number
      maxTokens: number
      cost: number
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

### 1.3 Create TUIInterface Class (2 hours)
```typescript
// src/core/TUIInterface.ts
export class TUIInterface {
  private messageQueue: TUIMessage[] = []
  private batchTimer?: NodeJS.Timeout
  private metricsInterval?: NodeJS.Interval
  private workerStates: Map<number, WorkerState> = new Map()
  
  constructor(private readonly config: TUIConfig) {
    this.setupMetricsCollection()
    this.setupMessageBatching()
  }
  
  // Core messaging
  private send(message: TUIMessage): void {
    if (process.env.DOCUMENTOR_TUI !== 'true') return
    
    this.messageQueue.push({
      ...message,
      timestamp: new Date().toISOString()
    })
    
    this.scheduleBatch()
  }
  
  private scheduleBatch(): void {
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flush()
      }, 10) // 10ms batching
    }
  }
  
  private flush(): void {
    if (this.messageQueue.length > 0) {
      // Send as single batch message
      const batch = {
        type: 'batch',
        messages: this.messageQueue
      }
      console.log(JSON.stringify(batch))
      this.messageQueue = []
    }
    this.batchTimer = undefined
  }
  
  // Worker management
  updateWorker(id: number, state: WorkerState): void {
    this.workerStates.set(id, state)
    this.sendWorkerUpdate()
  }
  
  private sendWorkerUpdate(): void {
    const workers = Array.from(this.workerStates.values())
    this.send({
      type: MessageType.WORKER,
      data: { workers }
    } as WorkerMessage)
  }
  
  // Performance metrics
  private setupMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.collectAndSendMetrics()
    }, 1000) // Every second
  }
  
  private async collectAndSendMetrics(): Promise<void> {
    const metrics = await this.gatherSystemMetrics()
    this.send({
      type: MessageType.METRICS,
      data: metrics
    } as MetricsMessage)
  }
}
```

## Phase 2: Update Go TUI Components (Day 1-2)

### 2.1 Restructure TUI Layout (3 hours)
```go
// src/tui/components/layout.go
type Layout struct {
    app          *tview.Application
    header       *HeaderPanel
    workers      *WorkersPanel
    progress     *ProgressPanel
    logs         *LogPanel
    performance  *PerformancePanel
    status       *StatusBar
}

func NewLayout() *Layout {
    layout := &Layout{
        app: tview.NewApplication(),
    }
    
    // Create panels
    layout.header = NewHeaderPanel()
    layout.workers = NewWorkersPanel(4) // 4 workers
    layout.progress = NewProgressPanel()
    layout.logs = NewLogPanel()
    layout.performance = NewPerformancePanel()
    layout.status = NewStatusBar()
    
    // Arrange in grid
    grid := tview.NewGrid().
        SetRows(3, 3, 4, 0, 2, 1). // header, progress, workers, logs, perf, status
        SetColumns(0).
        AddItem(layout.header, 0, 0, 1, 1, 0, 0, false).
        AddItem(layout.progress, 1, 0, 1, 1, 0, 0, false).
        AddItem(layout.workers, 2, 0, 1, 1, 0, 0, false).
        AddItem(layout.logs, 3, 0, 1, 1, 0, 0, true). // Focus on logs
        AddItem(layout.performance, 4, 0, 1, 1, 0, 0, false).
        AddItem(layout.status, 5, 0, 1, 1, 0, 0, false)
    
    layout.app.SetRoot(grid, true)
    return layout
}
```

### 2.2 Worker Panel Component (2 hours)
```go
// src/tui/components/workers.go
type WorkerPanel struct {
    *tview.Box
    workers []*WorkerDisplay
}

type WorkerDisplay struct {
    id           int
    state        string
    file         string
    operation    string
    progress     int
    timeElapsed  time.Duration
    completed    int
    failed       int
}

func (w *WorkerPanel) Draw(screen tcell.Screen) {
    w.Box.Draw(screen)
    x, y, width, height := w.GetInnerRect()
    
    // Calculate worker box width
    workerWidth := width / len(w.workers)
    
    for i, worker := range w.workers {
        startX := x + (i * workerWidth)
        w.drawWorker(screen, worker, startX, y, workerWidth, height)
    }
}

func (w *WorkerPanel) drawWorker(screen tcell.Screen, worker *WorkerDisplay, x, y, width, height int) {
    // Draw border
    style := w.getStyleForState(worker.state)
    drawBorder(screen, x, y, width, height, style)
    
    // Draw header [W1] BUSY
    header := fmt.Sprintf("[W%d] %s", worker.id, strings.ToUpper(worker.state))
    drawText(screen, x+1, y, header, style)
    
    // Draw file name
    if worker.file != "" {
        file := truncate(worker.file, width-2)
        drawText(screen, x+1, y+1, file, tcell.StyleDefault)
    }
    
    // Draw operation and time
    if worker.operation != "" {
        op := fmt.Sprintf("%s [%s]", worker.operation, worker.timeElapsed)
        drawText(screen, x+1, y+2, op, tcell.StyleDefault.Dim(true))
    }
    
    // Draw progress bar
    if worker.progress > 0 {
        drawProgressBar(screen, x+1, y+3, width-2, worker.progress)
    }
}
```

### 2.3 Progress Panel with Phase Bar (2 hours)
```go
// src/tui/components/progress.go
type ProgressPanel struct {
    *tview.Box
    phase       int
    totalPhases int
    phaseName   string
    files       FileProgress
    rate        float64
    eta         time.Duration
}

func (p *ProgressPanel) Draw(screen tcell.Screen) {
    p.Box.Draw(screen)
    x, y, width, _ := p.GetInnerRect()
    
    // Line 1: Phase with progress bar
    phaseText := fmt.Sprintf("PHASE [%d/%d] %s", p.phase, p.totalPhases, p.phaseName)
    phaseProgress := float64(p.phase) / float64(p.totalPhases) * 100
    
    // Draw phase text
    drawText(screen, x, y, phaseText, tcell.StyleDefault.Bold(true))
    
    // Draw progress bar
    barStart := x + len(phaseText) + 1
    barWidth := width - len(phaseText) - 20 // Leave space for percentage
    drawProgressBar(screen, barStart, y, barWidth, int(phaseProgress))
    
    // Draw percentage
    pctText := fmt.Sprintf("%.0f%%", phaseProgress)
    drawText(screen, barStart+barWidth+1, y, pctText, tcell.StyleDefault)
    
    // Line 2: File progress and stats
    statsText := fmt.Sprintf("Files: %d/%d  Rate: %.1f/s", 
        p.files.Processed, p.files.Total, p.rate)
    drawText(screen, x, y+1, statsText, tcell.StyleDefault)
    
    // Line 3: Success/Errors and ETA
    errorStyle := tcell.StyleDefault
    if p.files.Errors > 0 {
        errorStyle = errorStyle.Foreground(tcell.ColorRed)
    }
    
    statusText := fmt.Sprintf("Success: %d    Errors: %d", 
        p.files.Success, p.files.Errors)
    drawText(screen, x, y+2, statusText, tcell.StyleDefault)
    
    etaText := fmt.Sprintf("Queue: %d      ETA: %s", 
        p.files.Queue, formatDuration(p.eta))
    drawText(screen, x+30, y+2, etaText, tcell.StyleDefault)
}
```

## Phase 3: Integrate Enhanced Pipeline (Day 2)

### 3.1 Enhance DocumentProcessor with TUI (2 hours)
```typescript
// src/core/efficient/DocumentProcessor.ts
export class DocumentProcessor {
  private tui: TUIInterface
  
  constructor(config: DocumentorConfig, projectPath: string) {
    this.tui = new TUIInterface({
      project: projectPath,
      output: config.output.path
    })
    
    // Initialize TUI
    this.tui.initialize()
  }
  
  private async processWorker(workerId: number): Promise<void> {
    // Update worker state
    this.tui.updateWorker(workerId, {
      id: workerId,
      state: 'idle',
      stats: { completed: 0, failed: 0, avgTime: 0 }
    })
    
    while (!this.queue.isEmpty()) {
      const file = this.queue.take()
      if (!file) break
      
      // Update worker to busy
      const startTime = Date.now()
      this.tui.updateWorker(workerId, {
        id: workerId,
        state: 'busy',
        currentFile: file.name,
        currentOperation: 'processing',
        progress: 0,
        timeElapsed: 0
      })
      
      try {
        // Process with progress updates
        const doc = await this.pipeline.process(file, (progress, operation) => {
          this.tui.updateWorker(workerId, {
            id: workerId,
            state: 'busy',
            currentFile: file.name,
            currentOperation: operation,
            progress,
            timeElapsed: Date.now() - startTime
          })
        })
        
        // Queue for output
        this.output.queue(doc)
        
        // Update worker stats
        const stats = this.workerStats.get(workerId) || { completed: 0, failed: 0, totalTime: 0 }
        stats.completed++
        stats.totalTime += Date.now() - startTime
        this.workerStats.set(workerId, stats)
        
        this.tui.updateWorker(workerId, {
          id: workerId,
          state: 'idle',
          stats: {
            completed: stats.completed,
            failed: stats.failed,
            avgTime: stats.totalTime / stats.completed
          }
        })
        
      } catch (error) {
        // Update failed stats
        const stats = this.workerStats.get(workerId) || { completed: 0, failed: 0, totalTime: 0 }
        stats.failed++
        this.workerStats.set(workerId, stats)
        
        this.tui.updateWorker(workerId, {
          id: workerId,
          state: 'error',
          currentFile: file.name,
          error: error.message
        })
      }
    }
    
    // Worker complete
    this.tui.updateWorker(workerId, {
      id: workerId,
      state: 'complete'
    })
  }
}
```

### 3.2 Add Review/Update/Monitor Commands (3 hours)
```typescript
// src/cli/commands/review.ts
export const reviewCommand = new Command('review')
  .description('Review generated documentation quality')
  .argument('<output>', 'Output directory to review')
  .action(async (outputPath: string) => {
    const reviewer = new DocumentReviewer(new TUIInterface())
    await reviewer.review(outputPath)
  })

// src/cli/commands/update.ts
export const updateCommand = new Command('update')
  .description('Update only changed files')
  .argument('<project>', 'Project directory')
  .option('--since <date>', 'Update files changed since date')
  .action(async (projectPath: string, options) => {
    const updater = new DocumentUpdater(new TUIInterface())
    await updater.updateChanged(options.since || lastRun)
  })

// src/cli/commands/monitor.ts
export const monitorCommand = new Command('monitor')
  .description('Monitor files and auto-regenerate on change')
  .argument('<project>', 'Project directory')
  .option('--paths <paths...>', 'Specific paths to watch')
  .action(async (projectPath: string, options) => {
    const monitor = new DocumentMonitor(new TUIInterface())
    await monitor.startWatching(options.paths || [projectPath])
  })
```

## Phase 4: Testing & Polish (Day 3)

### 4.1 Integration Tests (2 hours)
```typescript
// tests/tui-integration.test.ts
describe('TUI Integration', () => {
  it('sends correct worker updates', async () => {
    const tui = new TUIInterface()
    const spy = jest.spyOn(console, 'log')
    
    tui.updateWorker(1, {
      id: 1,
      state: 'busy',
      currentFile: 'test.js'
    })
    
    await delay(20) // Wait for batch
    
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('"type":"worker"')
    )
  })
  
  it('batches messages efficiently', async () => {
    const tui = new TUIInterface()
    const spy = jest.spyOn(console, 'log')
    
    // Send 100 messages rapidly
    for (let i = 0; i < 100; i++) {
      tui.log('info', `Message ${i}`)
    }
    
    await delay(20)
    
    // Should batch into single message
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('"type":"batch"')
    )
  })
})
```

### 4.2 Performance Optimization (2 hours)
- Implement message compression for large batches
- Add circular buffer for logs to prevent memory growth
- Optimize worker state updates (diff only)
- Add caching for metrics collection

### 4.3 Error Handling (1 hour)
- Graceful degradation if TUI crashes
- Reconnection logic
- Fallback to simple console output
- Error recovery in workers

## Phase 5: Documentation & Deployment (Day 3)

### 5.1 User Documentation
- TUI keyboard shortcuts guide
- Configuration options
- Troubleshooting guide
- Performance tuning

### 5.2 Developer Documentation
- Message protocol specification
- Component architecture
- Extension guide
- Testing strategy

## Implementation Order

1. **IMMEDIATE** (30 mins):
   - Fix Claude content bug

2. **TODAY** (4 hours):
   - Create TUIInterface class
   - Create message protocol
   - Test with single file

3. **TOMORROW** (6 hours):
   - Update Go TUI components
   - Integrate with DocumentProcessor
   - Add worker management

4. **DAY 3** (6 hours):
   - Add review/update/monitor commands
   - Performance optimization
   - Testing & documentation

## Success Metrics

### Functional
- ✅ All 4 workers display correctly
- ✅ Progress bars update smoothly
- ✅ No message loss or corruption
- ✅ Keyboard shortcuts work
- ✅ Performance metrics accurate

### Performance
- ✅ < 1% CPU overhead for TUI
- ✅ < 10MB memory for TUI
- ✅ 60fps refresh rate
- ✅ < 10ms message latency

### Quality
- ✅ No flicker or tearing
- ✅ Responsive to terminal resize
- ✅ Clear error messages
- ✅ Graceful degradation

## Risk Mitigation

### Risk: Message overflow
**Mitigation**: Circular buffer, message dropping with warning

### Risk: TUI crash
**Mitigation**: Separate process, auto-restart, fallback mode

### Risk: Performance impact
**Mitigation**: Batching, compression, rate limiting

### Risk: Terminal compatibility
**Mitigation**: Fallback layouts, feature detection

## Next Immediate Step

```bash
# 1. Fix the Claude bug
vim src/core/efficient/DocumentPipeline.ts
# Change 'content' to 'sourceContent'

# 2. Test the fix
DOCUMENTOR_EFFICIENT=true ./documentor generate /small/test/project

# 3. Verify output quality
cat ~/obsidian_vault/docs/test-project/README.md
# Should contain real documentation, not "I need more information"
```

Once confirmed working, proceed with TUI implementation!