# TUI Data Interface Documentation

## Overview
The Go TUI (`src/tui/main.go`) receives JSON messages via **stdin** from the TypeScript documentor application. Each message must be a valid JSON object on a single line.

## Entry Point
- **Input Method**: STDIN (standard input)
- **Format**: Line-delimited JSON (one JSON object per line)
- **Processing**: `readStdin()` function at line 782-800

## Message Structure

### Base Message Type
```go
type Message struct {
    Type        string      `json:"type"`        // Required: message type identifier
    Level       string      `json:"level"`       // Log level (for "log" type)
    Content     string      `json:"content"`     // Main message content
    Timestamp   string      `json:"timestamp"`   // Optional timestamp string
    Phase       PhaseInfo   `json:"phase,omitempty"`
    Files       FileInfo    `json:"files,omitempty"`
    Tool        string      `json:"tool,omitempty"`
    Data        interface{} `json:"data,omitempty"`
    ProjectPath string      `json:"projectPath,omitempty"`
    LockInfo    LockInfo    `json:"lockInfo,omitempty"`
}
```

## Message Types and Display Behavior

### 1. Log Messages
**Type**: `"log"`
**Purpose**: Display general log messages in the main view
**Format**:
```json
{
  "type": "log",
  "level": "info|warning|error|success",
  "content": "Message text",
  "timestamp": "15:04:05"
}
```
**Display**:
- Shows in main view with colored icon based on level:
  - `info`: cyan ℹ icon
  - `warning`: yellow ⚠ icon
  - `error`: red ✗ icon
  - `success`: green ✓ icon
- Format: `[timestamp] [icon] message`

### 2. Project Information
**Type**: `"project"`
**Purpose**: Sets the project path/name
**Format**:
```json
{
  "type": "project",
  "projectPath": "/path/to/project"
}
```
**Display**:
- Updates project name in info box (top-left panel)
- Shows basename of path

### 3. Phase Updates
**Type**: `"phase"`
**Purpose**: Updates current processing phase
**Format**:
```json
{
  "type": "phase",
  "phase": {
    "current": 2,
    "total": 7,
    "name": "Analyzing Project",
    "subPhase": "Scanning files"
  }
}
```
**Display**:
- Info box shows: `Phase: 2/7: Analyzing Project`
- SubPhase shown indented below if present: `→ Scanning files`

### 4. File Processing Progress
**Type**: `"file"`
**Purpose**: Updates file processing progress
**Format**:
```json
{
  "type": "file",
  "files": {
    "processed": 45,
    "total": 145,
    "current": "src/index.ts"
  }
}
```
**Display**:
- Info box: Progress bar with percentage `[████████────────────] 31% (45/145)`
- Footer box: `Processing: src/index.ts`
- Bar color changes: red (<33%), yellow (33-66%), green (>66%)

### 5. Tool Calls
**Type**: `"tool"`
**Purpose**: Shows Claude tool usage
**Format**:
```json
{
  "type": "tool",
  "tool": "Read|Edit|Glob|etc",
  "content": "filename or description"
}
```
**Display**:
- Main view: `[timestamp] [tool icon] ToolName: content`
- Also appears in debug view

### 6. Debug Messages
**Type**: `"debug"`
**Purpose**: Debug information (only shown in debug view)
**Format**:
```json
{
  "type": "debug",
  "content": "Debug information"
}
```
**Display**:
- Only appears in debug view (press 'D' to switch)
- Format: `[timestamp] [bug icon] message`

### 7. Raw API Messages
**Type**: `"raw"`
**Purpose**: Raw Claude API responses
**Format**:
```json
{
  "type": "raw",
  "content": "Raw API response or JSON string"
}
```
**Display**:
- Only appears in raw view (press 'R' to switch)
- Shows unformatted API data

### 8. Lock File Information
**Type**: `"lockInfo"`
**Purpose**: Updates lock file status
**Format**:
```json
{
  "type": "lockInfo",
  "lockInfo": {
    "status": "locked|unlocked|stale",
    "resuming": false,
    "createdAt": "2024-08-29T14:30:00Z",
    "updatedAt": "2024-08-29T14:35:00Z",
    "timestamp": "2024-08-29T14:35:00Z",
    "pid": 12345
  }
}
```
**Display**:
- Info box lock status:
  - `locked`: Yellow lock icon, shows "Locked"
  - `resuming`: Yellow lock, shows "Resuming" with PID and time
  - `stale`: Red warning icon, shows "Stale Lock" with old PID
  - `unlocked/other`: Green check, shows "Ready"

### 9. Memory Usage
**Type**: `"memory"`
**Purpose**: Updates memory usage display
**Format**:
```json
{
  "type": "memory",
  "data": 125
}
```
**Display**:
- Stats box (top-right): Shows memory in MB
- Also updates internal process stats

## Supporting Data Types

### PhaseInfo
```go
type PhaseInfo struct {
    Current  int    `json:"current"`  // Current phase number
    Total    int    `json:"total"`    // Total phases
    Name     string `json:"name"`     // Phase name
    SubPhase string `json:"subPhase"` // Optional sub-phase description
}
```

### FileInfo
```go
type FileInfo struct {
    Processed int    `json:"processed"` // Files processed so far
    Total     int    `json:"total"`     // Total files to process
    Current   string `json:"current"`   // Current file being processed
}
```

### LockInfo
```go
type LockInfo struct {
    Status    string    `json:"status"`    // "locked", "unlocked", "stale"
    Resuming  bool      `json:"resuming"`  // True if resuming from interruption
    CreatedAt time.Time `json:"createdAt"` // Lock creation time
    UpdatedAt time.Time `json:"updatedAt"` // Last update time
    Timestamp time.Time `json:"timestamp"` // Alternative timestamp field
    PID       int       `json:"pid"`       // Process ID
}
```

## UI Panels and Their Data Sources

### 1. Header Bar (Top)
- Static title: "docuMentor v2.0.0"
- No dynamic data

### 2. Info Box (Top-Left, 75% width)
Displays:
- **Project**: From `"project"` messages
- **Lock Status**: From `"lockInfo"` messages
- **Phase**: From `"phase"` messages
- **Files Progress**: From `"file"` messages
- **Last Updated**: Auto-calculated time since last message
- **Process Stats** (in debug mode): Memory, CPU, Threads

### 3. Stats Box (Top-Right, 25% width)
Displays:
- **Current Time**: System time
- **Elapsed Time**: Time since TUI start
- **Status**: Always "Working" with spinner
- **Memory**: From `"memory"` messages or runtime stats
- **Threads**: Go routines count

### 4. Shortcuts Box (Middle row)
Interactive buttons (Tab to focus, arrows to navigate):
- N: Normal view
- D: Debug view
- R: Raw view
- C: Clear current view
- E: Export logs
- Q: Quit

### 5. Main View Area (Center, switchable)
Three views controlled by shortcuts:
- **Normal**: Shows `"log"` and `"tool"` messages
- **Debug**: Shows `"debug"`, `"tool"`, and all messages
- **Raw**: Shows `"raw"` API messages

### 6. Footer Box (Bottom)
Displays:
- Current file being processed from `"file"` messages
- "Ready - Waiting for input" when idle

## Sending Data from TypeScript

Use the `TUIAdapter` class (`src/core/TUIAdapter.ts`):

```typescript
import { tuiAdapter } from './core/TUIAdapter'

// Log messages
tuiAdapter.logInfo("Starting process")
tuiAdapter.logWarning("Cache miss", "Rebuilding...")
tuiAdapter.logError("Failed", error)
tuiAdapter.logSuccess("Complete!")

// Phase updates
tuiAdapter.updatePhase("Analyzing", "Scanning files")
tuiAdapter.setPhase("Phase Name", 2, 7)

// File progress
tuiAdapter.updateDocumentProgress(45, 145, "src/index.ts")
tuiAdapter.streamFile("Read", "config.json")

// Debug/Raw
tuiAdapter.displayDebug("Internal state: ...")
tuiAdapter.displayRaw('{"api": "response"}')

// Memory
tuiAdapter.displayMemory(125)
```

## Direct JSON Sending

To send messages directly, output JSON to stdout:
```javascript
console.log(JSON.stringify({
  type: "log",
  level: "info",
  content: "Message"
}))
```

## Testing

Use the mock data script to test all message types:
```bash
./src/tui/scripts/mock_data.sh | ./documentor-tui
```

## Important Notes

1. **Single Line JSON**: Each message must be complete JSON on one line
2. **Timestamp**: If not provided, current time is used
3. **View Switching**: Messages go to different views based on type
4. **Persistence**: Messages remain in views until cleared (C key)
5. **Export**: Can export current view to file (E key)
6. **Scrolling**: PgUp/PgDn to scroll, view titles show scroll position
7. **Text Wrapping**: All views have word-wrap enabled for long lines