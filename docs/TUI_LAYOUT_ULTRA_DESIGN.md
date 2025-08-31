# TUI Layout - ULTRA DESIGN

## Your Design Analysis (Strengths)
✅ **Parallel Worker Display** - Perfect for efficient pipeline!
✅ **Compact Header** - Good use of space
✅ **Real-time Status** - PID, lockfile, time tracking
✅ **Main Log Area** - Essential for debugging
✅ **Footer Status** - Current file and memory

## Critical Enhancements & Additional Data Points

### Enhanced Layout Design

```
┌─ DocuMentor v3.2.0 ─────────────────────────────────────────────────── [●] Connected ───┐
│ Project: ~/github/bm_player_template                      │ PID: 45789   Time: 21:20:15 │
│ Output:  ~/obsidian_vault/docs/bm_player_docs             │ Lock: ✓      Elapsed: 00:25 │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE [3/9] Analysis                                                                    |
| Files: 156/487         Queue: 331           Rate: 6.2/s    Errors: 2  docs complete: 3  |
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌─[W1]─BUSY──────────┐ ┌─[W2]─IDLE──────────┐ ┌─[W3]─BUSY──────────┐ ┌─[W4]─BUSY───────┐│
│ │ src/index.js       │ │⚡ waiting...        │ │ main.tsx           │ │█ README.md      |│
│ │  analyzing [12s]   │ │  completed: 42     │ │  generating [3s]   │ │  reading [1s]   ││
│ └────────────────────┘ └────────────────────┘ └────────────────────┘ └─────────────────┘│
│ CONTROLS ───────────────────────────────────────────────────────────────────────────────│
│ [H]elp  [P]ause  [R]esume  [V] RAW   [D] Debug  [Esc] Exit  [↑↓] Scroll                 |
│ LOGS ─────────────────────────────────────────────────────────────────── [Auto-scroll]  │
│ 21:20:14 [INFO ] Starting efficient document processing                                 │
│ 21:20:14 [INFO ] Found 487 documentable files                                           │
│ 21:20:14 [INFO ] Starting 4 parallel workers                                            │
│ 21:20:15 [WORK1] Processing: src/index.js (JavaScript, 12KB)                            │
│ 21:20:15 [WORK3] Processing: main.tsx (TypeScript React, 8KB)                           │
│ 21:20:15 [WORK4] Processing: README.md (Markdown, 15KB)                                 │
│ 21:20:16 [WORK2] ✓ Completed: package.json (4KB) in 1.2s                                │
│ 21:20:16 [WORK2] ✓ Completed: tsconfig.json (2KB) in 0.8s                               │
│ 21:20:17 [ERROR] Failed: src/broken.js - Syntax error at line 42                        │
│ 21:20:17 [WARN ] Retrying: src/broken.js (attempt 2/3)                                  │
│ 21:20:18 [WORK1] Claude processing... (waiting for response)                            │
│ 21:20:19 [INFO ] Output saved: ~/obsidian_vault/docs/bm_player_docs/package_json.md     │
│                                                                         ▼ 156 more lines│
│ PERFORMANCE ────────────────────────────────────────────────────────────────────────────│
│ CPU: ████████░░ 78%  MEM: ███░░░░░░░ 234MB/2GB  DISK: 45MB/s  NET: ↓128KB/s ↑12KB/s     │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ STATUS: Processing "src/components/Button.tsx" → Button.tsx.md          [●●●] spinning  │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## Additional Data Points to Consider

### 1. **Progress Visualization**
- **Phase Progress Bar**: Visual indication of overall phase completion
- **Per-Worker Progress**: Individual progress bars for each worker
- **Overall Progress**: Master progress showing total completion

### 2. **Performance Metrics**
- **Processing Rate**: Files per second
- **Average Time**: Per file type (JS: 4.2s, MD: 2.1s, etc.)
- **Queue Depth**: How many files waiting
- **ETA Calculation**: Based on current rate

### 3. **Resource Monitoring**
- **CPU Usage**: Overall and per-worker if possible
- **Memory**: Current/Peak/Available
- **Disk I/O**: Read/Write speeds
- **Network**: Claude API calls
- **Token Usage**: For cost tracking

### 4. **Error Tracking**
- **Error Count**: Inline with success count
- **Error Rate**: Percentage of failures
- **Retry Queue**: Files being retried
- **Skip List**: Files that couldn't be processed

### 5. **Worker Intelligence**
```
Worker States:
- BUSY:     Currently processing (show file + time + progress)
- IDLE:     Waiting for work (show stats)
- BLOCKED:  Waiting for Claude response
- ERROR:    Failed, attempting recovery
- COMPLETE: Finished all work
```

### 6. **Interactive Elements**
- **Clickable Workers**: Click to see detailed log for that worker
- **Expandable Sections**: Collapse/expand different panels
- **Filter Logs**: Show only errors, only specific worker, etc.
- **Quick Actions**: Retry failed, skip current, pause worker

### 7. **Smart Status Line**
```
Adaptive status that shows most relevant info:
- Normal:    "Processing src/index.js → index.md"
- Waiting:   "Waiting for Claude API response (12s)..."
- Error:     "⚠ Failed: src/broken.js - Retrying (2/3)"
- Complete:  "✓ All files processed successfully!"
```

## Color Coding Scheme

```ansi
GREEN:  ✓ Success, completed items
YELLOW: ⚡ Processing, warnings
RED:    ✗ Errors, failures
BLUE:   ℹ Information, headers
CYAN:   ⟳ In progress, loading
GRAY:   - Idle, inactive
WHITE:  Normal text
```

## Alternative Compact Layout (for smaller terminals)

```
┌─ DocuMentor ──────────────────────────────────────────┐
│ bm_player_template → obsidian_vault/docs │ PID: 45789 │
│ Phase 3/9: Analysis 73% │ 156/487 files │ Rate: 6.2/s │
├───────────────────────────────────────────────────────┤
│ W1:█ index.js 82%  W2:⚡ idle  W3:█ main.tsx  W4:█ README │
├───────────────────────────────────────────────────────┤
│ 21:20:19 [INFO] Processing src/index.js               │
│ 21:20:19 [SUCC] Completed package.json in 1.2s        │
│ 21:20:20 [WARN] Retrying src/broken.js (2/3)          │
│ 21:20:21 [INFO] Claude processing Button.tsx...       │
│                                        ▼ (Space) more  │
├───────────────────────────────────────────────────────┤
│ CPU:78% MEM:234MB Queue:331 ETA:00:53 │ Errors:2/156  │
└───────────────────────────────────────────────────────┘
```

## Dynamic Sections Based on Mode

### Generate Mode
- Show all workers
- Show queue depth
- Show file progress

### Review Mode
```
│ REVIEW RESULTS ────────────────────────────────────── │
│ Total Docs: 487     Quality Score: 87/100             │
│ ✓ Excellent: 234    ⚡ Good: 198    ⚠ Poor: 55        │
│ Missing: README links, API docs, Examples             │
```

### Update Mode
```
│ CHANGE DETECTION ──────────────────────────────────── │
│ Scanning for changes since: 2024-08-30 20:15:00       │
│ Modified: 23 files   New: 5 files   Deleted: 2 files  │
│ Updating: src/index.js (modified 2 hours ago)         │
```

### Monitor Mode
```
│ WATCHING ──────────────────────────────────────────── │
│ Monitoring: src/**, docs/**, *.config.js               │
│ Last Change: src/index.js at 21:19:45                 │
│ Auto-regenerate: ON   Debounce: 1000ms   Queue: Empty │
```

## Responsive Design Considerations

### Terminal Size Detection
```typescript
if (terminalWidth < 80) {
  // Use compact layout
} else if (terminalWidth < 120) {
  // Use standard layout
} else {
  // Use expanded layout with extra details
}
```

### Priority Information Hierarchy
1. **Always Show**: Project, Phase, File Progress
2. **Show if Space**: Workers, Performance
3. **Show if Requested**: Detailed logs, Debug info

## User Interaction Patterns

### Keyboard Shortcuts
```
Global:
  F1-F7:    Function keys for main actions
  Ctrl+C:   Graceful shutdown
  Ctrl+L:   Clear log window
  Ctrl+R:   Refresh display

Navigation:
  ↑/↓:      Scroll logs
  PgUp/Dn:  Page through logs
  Home/End: Jump to start/end
  Tab:      Cycle through panels

Filters:
  E:        Show only errors
  W:        Show only warnings
  1-4:      Show only worker N
  A:        Show all (reset filters)

Actions:
  Space:    Pause/Resume
  S:        Skip current file
  R:        Retry failed files
  V:        Toggle verbose mode
  D:        Toggle debug mode
```

## Implementation Strategy

### 1. Create Flexible TUI Components
```go
type TUIComponent interface {
    Render(width, height int) string
    Update(data interface{})
    HandleKey(key tcell.Key)
}

type WorkerPanel struct {}
type LogPanel struct {}
type ProgressPanel struct {}
type StatusBar struct {}
```

### 2. Message Protocol Extensions
```typescript
interface WorkerStatus {
  id: number
  state: 'busy' | 'idle' | 'blocked' | 'error'
  currentFile?: string
  progress?: number
  timeElapsed?: number
  stats: {
    completed: number
    avgTime: number
  }
}

interface PerformanceMetrics {
  cpu: number
  memory: { used: number, total: number }
  disk: { read: number, write: number }
  network: { up: number, down: number }
  claude: {
    calls: number
    maxCalls: number
    tokens: number
    maxTokens: number
    cost: number
  }
}
```

### 3. Real-time Updates
- Update worker status every 100ms
- Update performance metrics every 1s
- Batch log messages every 10ms
- Update progress on every file completion

## Final Ultra-Design Principles

1. **Information Density**: Maximum useful info, minimum clutter
2. **Visual Hierarchy**: Most important info most prominent
3. **Responsive**: Adapts to terminal size
4. **Interactive**: Not just display, but control
5. **Performance**: Smooth updates without flicker
6. **Accessible**: Clear color coding, keyboard navigation
7. **Context-Aware**: Shows relevant info for current mode
8. **Error-Focused**: Problems immediately visible
9. **Progress-Centric**: Always know what's happening
10. **Professional**: Clean, organized, enterprise-ready

This ultra-designed TUI will make DocuMentor feel like a professional, enterprise-grade tool while maintaining excellent usability!