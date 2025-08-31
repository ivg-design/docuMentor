# TUI Integration Strategy for Efficient Pipeline

## Executive Summary

Integrate the efficient parallel processing pipeline into the existing TUI workflow while preserving user experience and adding new capabilities for review, update, and monitoring.

## Current State vs. Desired State

### Current State
```
TUI (Go) 
  ↓ JSON messages
DocumentEngine (Sequential)
  ↓ 9 phases
PhaseManager + Multiple Singletons
  ↓ One file at a time
Output (Batch at end)
```

### Desired State
```
TUI (Go)
  ↓ JSON messages (unchanged protocol)
EfficientEngineAdapter 
  ↓ 3 macro-phases (displays as 9 to user)
DocumentProcessor (Parallel)
  ↓ 4 workers processing simultaneously
OutputManager (Sequential, real-time)
  + Review/Update/Monitor capabilities
```

## Integration Architecture

### Layer 1: Command Interface (Minimal Changes)

```typescript
// src/cli/commands/generate.ts
if (config.experimental?.efficientMode || process.env.DOCUMENTOR_EFFICIENT) {
  const adapter = new EfficientEngineAdapter(config, projectPath)
  await adapter.generate()
} else {
  const engine = new DocumentEngine(config, projectPath)
  await engine.generate()
}
```

### Layer 2: EfficientEngineAdapter (New)

```typescript
class EfficientEngineAdapter {
  private processor: DocumentProcessor
  private phaseManager: PhaseManager
  private tuiAdapter: TUIAdapter
  
  constructor(config: DocumentorConfig, projectPath: string) {
    this.processor = new DocumentProcessor(config, projectPath)
    this.phaseManager = PhaseManager.getInstance()
    this.tuiAdapter = TUIAdapter.getInstance()
  }
  
  async generate(): Promise<void> {
    // Initialize TUI
    this.tuiAdapter.start(this.projectPath)
    
    // Map to user-visible 9 phases
    await this.executeDiscoveryPhases()  // Phases 1-3
    await this.executeProcessingPhases() // Phases 4-7
    await this.executeFinalizationPhases() // Phases 8-9
  }
  
  private async executeDiscoveryPhases() {
    // Phase 1: Initialization
    await this.phaseManager.startPhase(1, 'Initialization')
    const scanner = new SimpleFileScanner()
    
    // Phase 2: Validation
    await this.phaseManager.startPhase(2, 'Validation')
    // Security checks here
    
    // Phase 3: Analysis
    await this.phaseManager.startPhase(3, 'Analysis')
    const files = await scanner.scan(this.projectPath)
    
    return files
  }
  
  private async executeProcessingPhases() {
    // Phases 4-7 all happen in parallel inside processor
    await this.phaseManager.startPhase(4, 'Preparation')
    await this.phaseManager.startPhase(5, 'Generation')
    
    // Let processor handle the actual work
    await this.processor.process()
    
    // Report remaining phases as complete
    await this.phaseManager.startPhase(6, 'Enhancement')
    await this.phaseManager.startPhase(7, 'Formatting')
  }
  
  private async executeFinalizationPhases() {
    // Phase 8: Integration
    await this.phaseManager.startPhase(8, 'Integration')
    
    // Phase 9: Finalization
    await this.phaseManager.startPhase(9, 'Finalization')
  }
}
```

### Layer 3: Enhanced Capabilities

#### Review Capability

```typescript
class DocumentReviewer {
  private outputPath: string
  
  async review(): Promise<ReviewReport> {
    // Scan generated documentation
    const docs = await this.scanGeneratedDocs()
    
    // Analyze quality
    const quality = await this.analyzeQuality(docs)
    
    // Generate report
    return {
      totalDocs: docs.length,
      successfulDocs: quality.successful,
      failedDocs: quality.failed,
      averageQuality: quality.score,
      issues: quality.issues,
      recommendations: quality.recommendations
    }
  }
  
  async regenerate(filePaths: string[]): Promise<void> {
    // Selective regeneration
    const processor = new DocumentProcessor(this.config, this.projectPath)
    await processor.processSpecific(filePaths)
  }
}
```

#### Update Capability

```typescript
class DocumentUpdater {
  private lastRunTimestamp: Date
  
  async updateChanged(): Promise<UpdateReport> {
    // Find changed files since last run
    const changes = await this.detectChanges(this.lastRunTimestamp)
    
    if (changes.length === 0) {
      return { message: 'No changes detected' }
    }
    
    // Process only changed files
    const processor = new DocumentProcessor(this.config, this.projectPath)
    await processor.processSpecific(changes)
    
    return {
      updated: changes.length,
      files: changes
    }
  }
  
  private async detectChanges(since: Date): Promise<string[]> {
    // Use git or filesystem timestamps
    const gitChanges = await this.getGitChanges(since)
    const fsChanges = await this.getFileSystemChanges(since)
    return [...new Set([...gitChanges, ...fsChanges])]
  }
}
```

#### Monitor Capability

```typescript
class DocumentMonitor {
  private watcher: FSWatcher
  private debounceTimer: NodeJS.Timeout
  
  async startWatching(paths: string[]): Promise<void> {
    this.watcher = chokidar.watch(paths, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true
    })
    
    this.watcher.on('change', (path) => {
      this.handleChange(path)
    })
    
    this.watcher.on('add', (path) => {
      this.handleNewFile(path)
    })
  }
  
  private handleChange(path: string): void {
    // Debounce to avoid rapid regeneration
    clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      this.regenerateFile(path)
    }, 1000)
  }
  
  private async regenerateFile(path: string): Promise<void> {
    const processor = new DocumentProcessor(this.config, this.projectPath)
    await processor.processSpecific([path])
  }
}
```

## TUI Message Protocol Mapping

### Phase Messages
```typescript
// Efficient pipeline emits
processor.on('phase', (phase) => {
  // Map to TUI protocol
  tuiAdapter.send({
    type: 'phase',
    phase: this.mapPhase(phase),
    description: this.getPhaseDescription(phase),
    progress: this.calculateProgress(phase)
  })
})
```

### Progress Messages
```typescript
// Efficient pipeline emits
processor.on('fileComplete', (file) => {
  // Map to TUI protocol
  tuiAdapter.send({
    type: 'file',
    files: {
      processed: this.filesProcessed,
      total: this.filesTotal,
      current: file.name
    }
  })
})
```

### Log Messages
```typescript
// Intercept console.log
const originalLog = console.log
console.log = (...args) => {
  originalLog(...args)
  tuiAdapter.send({
    type: 'log',
    level: 'info',
    content: args.join(' ')
  })
}
```

## Implementation Phases

### Phase 1: Foundation (Immediate)
1. **Fix Claude Bug**
   - Change `content` to `sourceContent`
   - Test with single file
   
2. **Create Adapter**
   - Basic EfficientEngineAdapter
   - Wire up to generate command

### Phase 2: Integration (Day 1)
1. **TUI Communication**
   - Map all messages properly
   - Test with Go TUI
   
2. **Phase Mapping**
   - Show 9 phases to user
   - Run 3 internally

### Phase 3: Capabilities (Day 2)
1. **Review System**
   - Implement DocumentReviewer
   - Add review command
   
2. **Update System**
   - Implement DocumentUpdater
   - Add update command
   
3. **Monitor System**
   - Implement DocumentMonitor
   - Add watch command

### Phase 4: Polish (Day 3)
1. **Error Handling**
   - Graceful degradation
   - Retry logic
   
2. **Performance**
   - Caching
   - Incremental updates
   
3. **UX**
   - Better progress indicators
   - Clear error messages

## Command Structure

### Existing Commands (Enhanced)
```bash
# Generate with efficient pipeline
documentor generate /path/to/project

# Watch for changes
documentor watch /path/to/project

# GitHub integration
documentor github-watch owner/repo
```

### New Commands
```bash
# Review generated documentation
documentor review /path/to/docs

# Update changed files only
documentor update /path/to/project

# Monitor specific files
documentor monitor /path/to/project --files "src/**/*.ts"

# Regenerate specific files
documentor regenerate /path/to/project --files "README.md,src/index.ts"
```

## Migration Path

### Step 1: Opt-in
```bash
# Use environment variable
DOCUMENTOR_EFFICIENT=true documentor generate /project

# Or config file
{
  "experimental": {
    "efficientMode": true
  }
}
```

### Step 2: A/B Testing
- Run both engines
- Compare output
- Measure performance

### Step 3: Default
- Make efficient mode default
- Keep old engine as fallback
- Document migration

### Step 4: Deprecation
- Mark old engine deprecated
- Remove in next major version
- Clean up code

## Success Criteria

### Functional
- ✅ Claude generates real documentation (not "I need more information")
- ✅ All 9 phases display correctly in TUI
- ✅ Parallel processing works with 4 workers
- ✅ Sequential output maintains order
- ✅ Review command shows quality metrics
- ✅ Update command detects changes
- ✅ Monitor command auto-regenerates

### Performance
- ✅ 3x faster than sequential processing
- ✅ Memory usage < 500MB for large projects
- ✅ CPU utilization ~80% during processing
- ✅ No UI freezing or lag

### Quality
- ✅ Documentation quality same or better
- ✅ No missing files
- ✅ Proper error recovery
- ✅ Clear progress indication

## Risk Mitigation

### Risk: Claude Integration Breaks
**Mitigation**: 
- Test thoroughly with different file types
- Add comprehensive error handling
- Implement retry logic

### Risk: TUI Protocol Incompatibility
**Mitigation**:
- Keep exact same message format
- Test with actual Go TUI
- Add protocol version checking

### Risk: User Confusion with Phases
**Mitigation**:
- Keep displaying 9 phases
- Add clear documentation
- Provide --classic flag for old behavior

### Risk: Performance Regression
**Mitigation**:
- Benchmark before/after
- Profile memory usage
- Add performance tests

## Next Steps

1. **Immediate**: Fix Claude content bug
2. **Today**: Create EfficientEngineAdapter
3. **Tomorrow**: Full TUI integration
4. **This Week**: Add review/update/monitor
5. **Next Week**: Performance optimization