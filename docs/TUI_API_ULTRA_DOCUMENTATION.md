# TUI API ULTRA DOCUMENTATION
## Complete Interface Specification for DocuMentor TUI v3.0

---

## Table of Contents
1. [Overview](#overview)
2. [Communication Protocol](#communication-protocol)
3. [Panel Components](#panel-components)
4. [Data Types & Formats](#data-types--formats)
5. [Message Protocol](#message-protocol)
6. [Update Methods](#update-methods)
7. [Error Handling](#error-handling)

---

## Overview

The DocuMentor TUI consists of 7 primary panels, each with specific data requirements and update methods. All communication between the Node.js backend and Go TUI frontend follows a structured JSON message protocol.

### TUI Layout Structure
```
┌─ Header (FlexHeaderPanel) ─────────────────────────────────────────────┐
├─ InfoBar ───────────────────────────────────────────────────────────────┤
├─ Workers (4 parallel panels) ───────────────────────────────────────────┤
├─ Controls (Button row) ─────────────────────────────────────────────────┤
├─ Logs (Scrollable) ─────────────────────────────────────────────────────┤
├─ Performance ───────────────────────────────────────────────────────────┤
└─ Status ────────────────────────────────────────────────────────────────┘
```

---

## Communication Protocol

### Message Structure
All messages follow this JSON structure:
```json
{
  "type": "update",
  "panel": "panel_name",
  "method": "method_name",
  "data": { ... }
}
```

### Message Types
- `update` - Update panel data
- `control` - Control command (pause/resume/stop)
- `config` - Configuration change
- `log` - Log entry

---

## Panel Components

### 1. Header Panel (FlexHeaderPanel)
**Location**: Top of TUI (75/25 split)
**Height**: 4 rows

#### Data Points
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `projectPath` | string | Project directory path | `"~/github/docuMentor"` |
| `outputPath` | string | Output directory path | `"./docs"` |
| `pid` | int | Process ID | `42446` |
| `lockStatus` | string | Lock file status | `"Free"` or `"Locked"` |
| `connection` | string | Connection status | `"Connected"` or `"Disconnected"` |
| `startTime` | timestamp | Process start time | Auto-calculated |

#### Update Methods
```json
{
  "type": "update",
  "panel": "header",
  "method": "UpdateProject",
  "data": {
    "project": "~/github/docuMentor",
    "output": "./docs",
    "pid": 42446
  }
}

{
  "type": "update",
  "panel": "header",
  "method": "SetLock",
  "data": {
    "locked": true
  }
}
```

---

### 2. InfoBar Panel
**Location**: Below header
**Height**: 3 rows (with border)

#### Data Points
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `phaseCurrent` | int | Current phase number | `3` |
| `phaseTotal` | int | Total phases | `9` |
| `phaseName` | string | Phase name | `"Analysis"` |
| `filesProcessed` | int | Files completed | `156` |
| `filesTotal` | int | Total files | `487` |
| `queueCurrent` | int | Current queue size | `13` |
| `queueTotal` | int | Total queue capacity | `323` |
| `errors` | int | Error count | `2` |
| `docsComplete` | int | Documents completed | `3` |
| `docsTotal` | int | Total documents | `6` |

#### Update Methods
```json
{
  "type": "update",
  "panel": "infobar",
  "method": "UpdatePhase",
  "data": {
    "current": 3,
    "total": 9,
    "name": "Analysis"
  }
}

{
  "type": "update",
  "panel": "infobar",
  "method": "UpdateFiles",
  "data": {
    "processed": 156,
    "total": 487
  }
}

{
  "type": "update",
  "panel": "infobar",
  "method": "UpdateQueue",
  "data": {
    "current": 13,
    "total": 323
  }
}

{
  "type": "update",
  "panel": "infobar",
  "method": "UpdateErrors",
  "data": {
    "errors": 2
  }
}

{
  "type": "update",
  "panel": "infobar",
  "method": "UpdateDocs",
  "data": {
    "complete": 3,
    "total": 6
  }
}
```

---

### 3. Workers Panel (UltraWorkersPanel)
**Location**: Below InfoBar
**Height**: 4 rows
**Layout**: 4 equal-width panels

#### Worker States
- `idle` - Worker available
- `busy` - Processing file
- `blocked` - Waiting for API
- `error` - Error occurred
- `complete` - Task completed

#### Data Points (per worker)
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | int | Worker ID (1-4) | `1` |
| `state` | WorkerState | Current state | `"busy"` |
| `file` | string | Current file | `"src/index.ts"` |
| `operation` | string | Current operation | `"analyzing"` |
| `progress` | int | Progress percentage | `65` |
| `timeElapsed` | duration | Time on current task | `"12s"` |
| `stats.completed` | int | Files completed | `42` |
| `stats.failed` | int | Files failed | `2` |
| `stats.processing` | int | Currently processing | `1` |

#### Update Methods
```json
{
  "type": "update",
  "panel": "workers",
  "method": "UpdateWorker",
  "data": {
    "id": 1,
    "state": "busy",
    "file": "src/index.ts",
    "operation": "analyzing",
    "progress": 65,
    "timeElapsed": "12s",
    "stats": {
      "completed": 42,
      "failed": 2,
      "processing": 1
    }
  }
}
```

---

### 4. Controls Panel
**Location**: Below Workers
**Height**: 1 row
**Layout**: Centered button row

#### Control Actions
| Key | Action | Description |
|-----|--------|-------------|
| `H` | Help | Show help modal |
| `P` | Pause | Pause processing |
| `R` | Resume | Resume processing |
| `V` | RAW | Toggle raw view |
| `D` | Debug | Toggle debug mode |
| `Esc` | Exit | Exit application |
| `↑↓` | Scroll | Scroll logs |

#### Control Messages
```json
{
  "type": "control",
  "action": "pause"
}

{
  "type": "control",
  "action": "resume"
}

{
  "type": "control",
  "action": "toggle_debug"
}
```

---

### 5. Logs Panel
**Location**: Below Controls
**Height**: Flexible (fills available space)
**Features**: Auto-scroll, color-coded levels

#### Log Levels
- `INFO` - Green
- `WARN` - Yellow
- `ERROR` - Red
- `DEBUG` - Gray
- `WORK1-4` - Worker-specific

#### Data Points
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `timestamp` | time | Log timestamp | `"09:46:57"` |
| `level` | string | Log level | `"INFO"` |
| `message` | string | Log message | `"Processing file"` |
| `workerID` | int | Worker ID (0 for main) | `1` |

#### Update Methods
```json
{
  "type": "log",
  "data": {
    "level": "INFO",
    "message": "Starting efficient document processing",
    "workerID": 0
  }
}

{
  "type": "log",
  "data": {
    "level": "ERROR",
    "message": "Failed: src/broken.js - Syntax error at line 42",
    "workerID": 2
  }
}
```

---

### 6. Performance Panel
**Location**: Below Logs
**Height**: 3 rows (with border)

#### Data Points
| Field | Type | Description | Example | Range |
|-------|------|-------------|---------|-------|
| `cpu` | float | CPU usage percentage | `67.5` | 0-100 |
| `memory` | float | Memory usage percentage | `25.3` | 0-100 |
| `memoryUsed` | int | Memory used (MB) | `234` | - |
| `memoryTotal` | int | Total memory (MB) | `2048` | - |
| `disk` | float | Disk I/O (MB/s) | `45.2` | - |
| `networkDown` | float | Network download (KB/s) | `128.5` | - |
| `networkUp` | float | Network upload (KB/s) | `12.3` | - |

#### Visual Representation
- CPU/Memory: Progress bars with percentage
- Disk/Network: Numeric values with units

#### Update Methods
```json
{
  "type": "update",
  "panel": "performance",
  "method": "UpdateMetrics",
  "data": {
    "cpu": 67.5,
    "memory": 25.3,
    "memoryUsed": 234,
    "memoryTotal": 2048,
    "disk": 45.2,
    "networkDown": 128.5,
    "networkUp": 12.3
  }
}
```

---

### 7. Status Panel (UltraStatusPanel)
**Location**: Bottom
**Height**: 3 rows (with border)

#### Status States
- `idle` - Waiting
- `processing` - Active processing
- `paused` - Paused by user
- `error` - Error state
- `complete` - Finished

#### Data Points
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `state` | string | Current state | `"processing"` |
| `inputFile` | string | Current input file | `"src/components/Button.tsx"` |
| `outputFile` | string | Current output file | `"Button.tsx.md"` |
| `message` | string | Status message | `"Processing documentation"` |
| `spinner` | string | Spinner animation | `"[●●●]"` |

#### Update Methods
```json
{
  "type": "update",
  "panel": "status",
  "method": "SetProcessing",
  "data": {
    "inputFile": "src/components/Button.tsx",
    "outputFile": "Button.tsx.md"
  }
}

{
  "type": "update",
  "panel": "status",
  "method": "SetMessage",
  "data": {
    "message": "System ready - Press [P] to start processing"
  }
}

{
  "type": "update",
  "panel": "status",
  "method": "SetError",
  "data": {
    "message": "Failed to process file"
  }
}
```

---

## Data Types & Formats

### Time Formats
- **Elapsed Time**: `HH:MM:SS` format (e.g., `"00:01:21"`)
- **Clock Time**: `HH:MM:SS` 24-hour format (e.g., `"10:00:38"`)
- **Timestamps**: `HH:MM:SS` for logs (e.g., `"09:46:57"`)
- **Duration**: String with unit (e.g., `"12s"`, `"1.2s"`, `"3m"`)

### File Paths
- **Relative paths**: From project root (e.g., `"src/index.ts"`)
- **Absolute paths**: Full system path (e.g., `"~/github/docuMentor"`)
- **Truncation**: Max display width per panel

### Progress Indicators
- **Percentage**: Integer 0-100
- **Ratios**: `current/total` format (e.g., `"156/487"`)
- **Rates**: Float with unit (e.g., `"6.2/s"`)

### Color Codes
- **Green**: Success, active, connected
- **Yellow**: Warning, paused, pending
- **Red**: Error, failed, disconnected
- **Cyan**: Labels, headers
- **White**: Normal text
- **Gray**: Debug, dim, inactive

---

## Message Protocol

### Complete Message Flow

#### 1. Initialization
```json
{
  "type": "init",
  "data": {
    "project": "~/github/docuMentor",
    "output": "./docs",
    "pid": 42446,
    "totalFiles": 487,
    "phases": ["Discovery", "Analysis", "Processing", "Generation", "Validation", "Output", "Cleanup", "Report", "Complete"]
  }
}
```

#### 2. Phase Updates
```json
{
  "type": "phase",
  "data": {
    "current": 2,
    "total": 9,
    "name": "Analysis",
    "progress": 45
  }
}
```

#### 3. Worker Updates
```json
{
  "type": "worker",
  "data": {
    "id": 1,
    "state": "busy",
    "file": "src/index.ts",
    "operation": "analyzing",
    "progress": 65,
    "timeElapsed": "12s"
  }
}
```

#### 4. Batch Updates
```json
{
  "type": "batch",
  "updates": [
    {
      "panel": "workers",
      "method": "UpdateWorker",
      "data": { "id": 1, "state": "idle" }
    },
    {
      "panel": "infobar",
      "method": "UpdateFiles",
      "data": { "processed": 157, "total": 487 }
    },
    {
      "panel": "performance",
      "method": "UpdateMetrics",
      "data": { "cpu": 68.2, "memory": 26.1 }
    }
  ]
}
```

---

## Error Handling

### Error Message Format
```json
{
  "type": "error",
  "severity": "error|warning|info",
  "data": {
    "code": "FILE_NOT_FOUND",
    "message": "Cannot read file: src/missing.ts",
    "file": "src/missing.ts",
    "line": 0,
    "workerID": 2,
    "recoverable": true,
    "retry": true,
    "retryCount": 1,
    "maxRetries": 3
  }
}
```

### Error Recovery Actions
- `retry` - Automatic retry with backoff
- `skip` - Skip file and continue
- `abort` - Stop worker
- `pause` - Pause all processing

---

## Implementation Notes

### Update Frequency
- **Header**: Time updates every 1 second
- **Workers**: On state change or every 1 second during processing
- **Performance**: Every 2 seconds
- **Logs**: Real-time as generated
- **InfoBar**: On file completion or every 5 seconds
- **Status**: On state change

### Buffer Limits
- **Logs**: Maximum 1000 entries (circular buffer)
- **Message Queue**: 500 messages
- **Worker Queue**: 100 files per worker

### Performance Considerations
- Batch updates when possible
- Use worker-specific channels
- Implement backpressure for log flooding
- Cache unchanged data

---

## Example Integration

### Node.js Sender
```javascript
class TUIInterface {
  sendUpdate(panel, method, data) {
    const message = JSON.stringify({
      type: 'update',
      panel,
      method,
      data,
      timestamp: Date.now()
    });
    this.tuiProcess.stdin.write(message + '\n');
  }

  updateWorker(id, state, file, operation, progress) {
    this.sendUpdate('workers', 'UpdateWorker', {
      id,
      state,
      file,
      operation,
      progress,
      timeElapsed: this.getElapsed(id)
    });
  }

  log(level, message, workerID = 0) {
    this.sendUpdate('logs', 'AddLog', {
      level,
      message,
      workerID,
      timestamp: new Date().toTimeString().slice(0, 8)
    });
  }
}
```

### Go Receiver
```go
type Message struct {
    Type   string          `json:"type"`
    Panel  string          `json:"panel"`
    Method string          `json:"method"`
    Data   json.RawMessage `json:"data"`
}

func (tui *UltraTUI) HandleMessage(msg Message) {
    switch msg.Panel {
    case "header":
        tui.handleHeaderUpdate(msg.Method, msg.Data)
    case "workers":
        tui.handleWorkerUpdate(msg.Method, msg.Data)
    case "logs":
        tui.handleLogUpdate(msg.Method, msg.Data)
    // ... other panels
    }
    tui.app.Draw() // Trigger redraw
}
```

---

## Testing Protocol

### Test Message Sequence
```bash
# Initialize
echo '{"type":"init","data":{"project":"~/test","output":"./out","pid":12345,"totalFiles":100}}' | ./tui-ultra

# Update worker
echo '{"type":"update","panel":"workers","method":"UpdateWorker","data":{"id":1,"state":"busy","file":"test.js"}}' | ./tui-ultra

# Add log
echo '{"type":"log","data":{"level":"INFO","message":"Test message"}}' | ./tui-ultra

# Update performance
echo '{"type":"update","panel":"performance","method":"UpdateMetrics","data":{"cpu":50.0,"memory":25.0}}' | ./tui-ultra
```

---

## Version History
- v3.0.0 - Initial ULTRA design implementation
- v3.1.0 - Added FlexHeaderPanel with 75/25 split
- v3.2.0 - Fixed worker panel gaps and alignment issues

---

**End of TUI API Documentation**