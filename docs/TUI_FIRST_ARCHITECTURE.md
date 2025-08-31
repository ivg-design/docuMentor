# TUI-First Architecture: Building Efficient Pipeline with TUI Integration

## Paradigm Shift

### Old Thinking (Wrong)
```
Efficient Pipeline → Adapter → TUI
(Forcing new into old)
```

### New Thinking (Right)
```
TUI API Definition → Efficient Pipeline with TUI hooks → Direct Integration
(Building with TUI in mind from the start)
```

## 1. TUI Architecture Analysis

### 1.1 TUI Components (Go Side)

```go
// src/tui/main.go
type TUI struct {
    app           *tview.Application
    projectInfo   *tview.TextView
    phaseInfo     *tview.TextView
    fileProgress  *tview.TextView
    logView       *tview.TextView
    messageBuffer chan TUIMessage
}
```

### 1.2 TUI Message Protocol

```typescript
interface TUIMessage {
  type: 'log' | 'project' | 'phase' | 'file' | 'tool' | 'debug' | 'raw' | 'lockInfo' | 'memory'
  timestamp?: string
  [key: string]: any
}

// Specific message types
interface PhaseMessage {
  type: 'phase'
  phase: {
    current: number
    total: number
    name: string
    subPhase?: string
  }
}

interface FileMessage {
  type: 'file'
  files: {
    processed: number
    total: number
    current?: string
  }
}

interface LogMessage {
  type: 'log'
  level: 'info' | 'warning' | 'error' | 'success'
  content: string
}
```

### 1.3 TUI Entry Points

**Initialization**:
- `tuiAdapter.start(projectPath)` - Initialize TUI with project
- `tuiAdapter.stop()` - Cleanup

**Progress Updates**:
- `tuiAdapter.updatePhase(current, total, name)` - Phase progress
- `tuiAdapter.updateFileProgress(processed, total, current?)` - File progress
- `tuiAdapter.log(level, message)` - Log messages

**Data Flow**:
```
Node.js Process → stdout (JSON) → Go TUI → UI Updates
```

## 2. Efficient Pipeline Enhancement Plan

### 2.1 Core Architecture (TUI-Aware)

```typescript
// New structure with TUI built-in
class EnhancedDocumentProcessor {
  private queue: DocumentQueue
  private pipeline: DocumentPipeline
  private output: OutputManager
  private progress: TUIProgressReporter  // ← Enhanced for TUI
  private scanner: SmartFileScanner      // ← Enhanced scanner
  private reviewer: DocumentReviewer     // ← NEW
  private updater: DocumentUpdater       // ← NEW
  private monitor: DocumentMonitor       // ← NEW
  private tuiInterface: TUIInterface     // ← NEW: Direct TUI integration
  
  constructor(config: DocumentorConfig, projectPath: string) {
    // Initialize with TUI awareness
    this.tuiInterface = new TUIInterface()
    this.tuiInterface.initialize(projectPath)
    
    // All components get TUI interface
    this.progress = new TUIProgressReporter(this.tuiInterface)
    this.scanner = new SmartFileScanner(this.tuiInterface)
    // ... etc
  }
}
```

### 2.2 TUI Interface Layer

```typescript
class TUIInterface {
  private messageQueue: TUIMessage[] = []
  private batchTimer?: NodeJS.Timeout
  
  initialize(projectPath: string): void {
    this.send({
      type: 'project',
      projectPath
    })
  }
  
  updatePhase(phase: PhaseInfo): void {
    this.send({
      type: 'phase',
      phase
    })
  }
  
  updateFiles(files: FileInfo): void {
    this.send({
      type: 'file',
      files
    })
  }
  
  log(level: LogLevel, content: string): void {
    this.send({
      type: 'log',
      level,
      content
    })
  }
  
  private send(message: TUIMessage): void {
    // Batch messages for efficiency
    this.messageQueue.push({
      ...message,
      timestamp: new Date().toISOString()
    })
    
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flush()
      }, 10) // 10ms batching
    }
  }
  
  private flush(): void {
    if (this.messageQueue.length > 0) {
      // Send to stdout for Go TUI
      this.messageQueue.forEach(msg => {
        console.log(JSON.stringify(msg))
      })
      this.messageQueue = []
    }
    this.batchTimer = undefined
  }
}
```

### 2.3 Enhanced Components

#### Smart File Scanner (with TUI)
```typescript
class SmartFileScanner {
  constructor(private tui: TUIInterface) {}
  
  async scan(projectPath: string): Promise<SourceFile[]> {
    this.tui.log('info', 'Starting intelligent file scan...')
    
    // Quick scan for count
    const quickScan = await this.quickCount(projectPath)
    this.tui.log('info', `Found ${quickScan} potential files`)
    
    // Detailed scan with progress
    const files: SourceFile[] = []
    let scanned = 0
    
    await this.scanWithProgress(projectPath, (file) => {
      files.push(file)
      scanned++
      
      // Update TUI every 10 files
      if (scanned % 10 === 0) {
        this.tui.updateFiles({
          processed: scanned,
          total: quickScan,
          current: file.name
        })
      }
    })
    
    // Smart filtering and prioritization
    const filtered = this.filterAndPrioritize(files)
    this.tui.log('success', `Scan complete: ${filtered.length} documentable files`)
    
    return filtered
  }
}
```

#### Document Reviewer (NEW)
```typescript
class DocumentReviewer {
  constructor(private tui: TUIInterface) {}
  
  async review(outputPath: string): Promise<ReviewReport> {
    this.tui.updatePhase({
      current: 1,
      total: 3,
      name: 'Review',
      subPhase: 'Analyzing documentation quality'
    })
    
    const docs = await this.scanGeneratedDocs(outputPath)
    const quality = await this.analyzeQuality(docs)
    
    this.tui.updatePhase({
      current: 2,
      total: 3,
      name: 'Review',
      subPhase: 'Generating report'
    })
    
    const report = {
      totalDocs: docs.length,
      quality: quality.score,
      issues: quality.issues,
      recommendations: quality.recommendations
    }
    
    this.tui.log('info', `Review complete: ${report.quality}/100 quality score`)
    
    return report
  }
}
```

#### Document Updater (NEW)
```typescript
class DocumentUpdater {
  constructor(private tui: TUIInterface) {}
  
  async updateChanged(since: Date): Promise<UpdateReport> {
    this.tui.updatePhase({
      current: 1,
      total: 2,
      name: 'Update',
      subPhase: 'Detecting changes'
    })
    
    const changes = await this.detectChanges(since)
    
    if (changes.length === 0) {
      this.tui.log('info', 'No changes detected')
      return { updated: 0 }
    }
    
    this.tui.updatePhase({
      current: 2,
      total: 2,
      name: 'Update',
      subPhase: `Updating ${changes.length} files`
    })
    
    // Process only changed files
    await this.processChanges(changes)
    
    this.tui.log('success', `Updated ${changes.length} documents`)
    return { updated: changes.length, files: changes }
  }
}
```

#### Document Monitor (NEW)
```typescript
class DocumentMonitor {
  constructor(private tui: TUIInterface) {}
  
  async startWatching(paths: string[]): Promise<void> {
    this.tui.log('info', `Monitoring ${paths.length} paths for changes`)
    
    const watcher = chokidar.watch(paths, {
      persistent: true,
      ignoreInitial: true
    })
    
    watcher.on('change', (path) => {
      this.tui.log('info', `Detected change: ${path}`)
      this.scheduleRegeneration(path)
    })
    
    watcher.on('add', (path) => {
      this.tui.log('info', `New file: ${path}`)
      this.scheduleGeneration(path)
    })
  }
}
```

## 3. Missing Modules to Add

### 3.1 Phase Coordinator
```typescript
class PhaseCoordinator {
  private phases = [
    'Initialization',
    'Validation',
    'Analysis',
    'Preparation',
    'Generation',
    'Enhancement',
    'Formatting',
    'Integration',
    'Finalization'
  ]
  
  constructor(private tui: TUIInterface) {}
  
  async executePhase(index: number, work: () => Promise<void>): Promise<void> {
    this.tui.updatePhase({
      current: index + 1,
      total: this.phases.length,
      name: this.phases[index]
    })
    
    await work()
  }
}
```

### 3.2 Error Recovery System
```typescript
class ErrorRecovery {
  constructor(private tui: TUIInterface) {}
  
  async withRecovery<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T | null> {
    try {
      return await operation()
    } catch (error) {
      this.tui.log('error', `Failed: ${context}`)
      
      // Attempt recovery
      const recovered = await this.attemptRecovery(error, context)
      if (recovered) {
        this.tui.log('warning', `Recovered from error in ${context}`)
        return recovered
      }
      
      // Log and continue
      this.tui.log('error', `Skipping ${context}: ${error.message}`)
      return null
    }
  }
}
```

### 3.3 Cache Manager
```typescript
class CacheManager {
  private cache = new Map<string, CacheEntry>()
  
  constructor(private tui: TUIInterface) {}
  
  async get<T>(key: string, generator: () => Promise<T>): Promise<T> {
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!
      if (!this.isExpired(entry)) {
        this.tui.log('debug', `Cache hit: ${key}`)
        return entry.value as T
      }
    }
    
    this.tui.log('debug', `Cache miss: ${key}`)
    const value = await generator()
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: 3600000 // 1 hour
    })
    
    return value
  }
}
```

## 4. Complete Efficient Pipeline with TUI

```typescript
class TUIAwareEfficientPipeline {
  // All components
  private tui: TUIInterface
  private coordinator: PhaseCoordinator
  private scanner: SmartFileScanner
  private processor: DocumentProcessor
  private reviewer: DocumentReviewer
  private updater: DocumentUpdater
  private monitor: DocumentMonitor
  private cache: CacheManager
  private recovery: ErrorRecovery
  
  constructor(config: DocumentorConfig, projectPath: string) {
    // Initialize TUI first
    this.tui = new TUIInterface()
    this.tui.initialize(projectPath)
    
    // Create all components with TUI
    this.coordinator = new PhaseCoordinator(this.tui)
    this.scanner = new SmartFileScanner(this.tui)
    this.processor = new DocumentProcessor(config, projectPath, this.tui)
    this.reviewer = new DocumentReviewer(this.tui)
    this.updater = new DocumentUpdater(this.tui)
    this.monitor = new DocumentMonitor(this.tui)
    this.cache = new CacheManager(this.tui)
    this.recovery = new ErrorRecovery(this.tui)
  }
  
  // Main entry point
  async generate(): Promise<void> {
    await this.coordinator.executePhase(0, async () => {
      // Initialization
      await this.initialize()
    })
    
    await this.coordinator.executePhase(1, async () => {
      // Validation
      await this.validate()
    })
    
    await this.coordinator.executePhase(2, async () => {
      // Analysis
      this.files = await this.scanner.scan(this.projectPath)
    })
    
    // Phases 3-6 handled by processor
    await this.coordinator.executePhase(3, async () => {
      await this.processor.process(this.files)
    })
    
    await this.coordinator.executePhase(8, async () => {
      // Finalization
      await this.finalize()
    })
  }
  
  // Additional capabilities
  async review(): Promise<void> {
    const report = await this.reviewer.review(this.outputPath)
    this.displayReport(report)
  }
  
  async update(): Promise<void> {
    const report = await this.updater.updateChanged(this.lastRun)
    this.displayReport(report)
  }
  
  async watch(): Promise<void> {
    await this.monitor.startWatching(this.watchPaths)
  }
}
```

## 5. Implementation Strategy

### Phase 1: TUI Interface Layer
1. Create `TUIInterface` class
2. Define all message types
3. Implement batching and queueing

### Phase 2: Enhance Core Components
1. Add TUI to `DocumentProcessor`
2. Add TUI to `DocumentPipeline`
3. Add TUI to `OutputManager`

### Phase 3: Add Missing Modules
1. Implement `PhaseCoordinator`
2. Implement `ErrorRecovery`
3. Implement `CacheManager`

### Phase 4: New Capabilities
1. Implement `DocumentReviewer`
2. Implement `DocumentUpdater`
3. Implement `DocumentMonitor`

### Phase 5: Integration
1. Create `TUIAwareEfficientPipeline`
2. Wire up all commands
3. Test with Go TUI

## 6. Benefits of This Approach

### Clean Architecture
- TUI awareness built-in, not bolted on
- Single source of truth for progress
- No adapter layer needed

### Better Performance
- Batched TUI messages
- Cached operations
- Parallel processing with proper reporting

### Enhanced Capabilities
- Review/Update/Monitor built-in
- Error recovery
- Smart caching

### Maintainability
- Clear separation of concerns
- Each component has TUI interface
- Easy to add new features

## 7. Migration Path

### Step 1: Build New Pipeline
- Create all components
- Test in isolation

### Step 2: Parallel Run
- Run both old and new
- Compare outputs
- Measure performance

### Step 3: Switch Default
- Make new pipeline default
- Keep old as fallback

### Step 4: Remove Old
- Delete old DocumentEngine
- Clean up code

## Decision: Build TUI-Aware Efficient Pipeline

This approach is superior because:
1. **Clean Integration**: TUI is part of the design, not an afterthought
2. **Complete Features**: All capabilities (review/update/monitor) included
3. **Better UX**: Real-time progress, better error messages
4. **Maintainable**: Clear architecture, easy to extend
5. **Performant**: Optimized from the ground up

The efficient pipeline becomes the ONLY pipeline, with TUI integration as a first-class citizen.