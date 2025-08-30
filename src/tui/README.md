# DocuMentor TUI (Terminal User Interface)

A professional terminal interface for DocuMentor that provides real-time progress tracking, interactive password input, and comprehensive logging capabilities.

## Features

- **Real-time Progress Tracking**: Monitor documentation generation progress with live updates
- **Password Modal**: Secure password input for sudo operations and authentication
- **Multi-view System**: Switch between Normal, Debug, and Raw API views
- **Fixed Grid Layout**: Information panel with non-shifting elements
- **Text Wrapping**: Long lines wrap instead of truncating
- **Keyboard Navigation**: Full keyboard control with customizable shortcuts

## Installation

```bash
# Navigate to TUI directory
cd src/tui

# Install dependencies
go mod download

# Build the TUI
go build -o documentor-tui main.go updateInfoBox.go password_modal_simple.go

# Optional: Install Nerd Fonts for better icons
./install_font.sh
```

## Usage

### Basic Usage

```bash
# Run with stdin input (expects JSON messages)
./documentor-tui

# Run with test data
./test_modal_only.sh
./test_simple_password.sh
./mock_data.sh
```

### Keyboard Shortcuts

| Key | Action | Available When |
|-----|--------|----------------|
| `N` | Switch to Normal view | Always (except modal) |
| `D` | Switch to Debug view | Always (except modal) |
| `R` | Switch to Raw API view | Always (except modal) |
| `C` | Clear current view | Always (except modal) |
| `E` | Export logs | Always (except modal) |
| `P` | Test password modal | Always (except modal) |
| `Q` | Quit application | Always (except modal) |
| `Tab` | Switch focus between panels | Always (except modal) |
| `PgUp/PgDn` | Scroll current view | Always |
| `Enter` | Submit password | Password modal only |
| `Escape` | Cancel password modal | Password modal only |
| `Ctrl+C` | Force quit | Always |

## Message Protocol (JSON)

The TUI accepts JSON messages via stdin. Each message must be a single line of valid JSON.

### Input Message Types

#### 1. Log Message
```json
{
  "type": "log",
  "level": "info|warning|error|success",
  "content": "Message text",
  "timestamp": "15:04:05"  // Optional, auto-generated if missing
}
```

#### 2. Phase Update
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

#### 3. File Progress
```json
{
  "type": "file",
  "files": {
    "processed": 45,
    "total": 145,
    "current": "src/components/Example.ts"
  }
}
```

#### 4. Project Path
```json
{
  "type": "project",
  "projectPath": "/Users/username/project"
}
```

#### 5. Lock Information
```json
{
  "type": "lockInfo",
  "lockInfo": {
    "status": "locked|unlocked|stale",
    "resuming": false,
    "timestamp": "2024-08-29T14:30:00Z",
    "pid": 12345,
    "createdAt": "2024-08-29T14:30:00Z",
    "updatedAt": "2024-08-29T14:35:00Z"
  }
}
```

#### 6. Tool Call
```json
{
  "type": "tool",
  "tool": "Read|Write|Glob|Edit",
  "content": "Tool-specific content"
}
```

#### 7. Debug Message
```json
{
  "type": "debug",
  "content": "Debug information"
}
```

#### 8. Raw API Message
```json
{
  "type": "raw",
  "content": "Raw API response or data"
}
```

#### 9. Memory Update
```json
{
  "type": "memory",
  "data": 125.5  // Memory in MB
}
```

#### 10. Password Request
```json
{
  "type": "password_request",
  "requestId": "unique-id-123",
  "prompt": "sudo password required for installation",
  "context": "Running: sudo apt-get install build-essential"
}
```

### Output Message Types (Future Implementation)

#### Password Response
```json
{
  "type": "password_response",
  "requestId": "unique-id-123",
  "password": "user_entered_password",
  "cancelled": false
}
```

## Architecture

### Core Components

#### 1. Main TUI Structure (`main.go`)
- **TUI struct**: Central state management
- **View Management**: Pages for normal/debug/raw views
- **Layout**: Header, Info/Stats panels, Button row, Logs, Footer
- **Event Handling**: Global keyboard input capture

#### 2. Info Panel (`updateInfoBox.go`)
- **Fixed Grid Layout**: Prevents element shifting
- **3-line format**: Project/PID/Files, Phase/Task, Lockfile/Status
- **Dynamic Updates**: Real-time state changes
- **Debug Mode**: Additional process stats when in debug view

#### 3. Password Modal (`password_modal_simple.go`)
- **Screen Replacement**: Temporarily replaces entire UI
- **Secure Input**: Password masking with asterisks
- **Modal State**: Tracks when modal is open to block shortcuts
- **Clean Restoration**: Returns to previous view on completion

### Key Patterns

#### Event Flow
1. JSON message received via stdin
2. Parsed in `readStdin()` goroutine
3. Dispatched via `handleMessage()`
4. UI updated via `app.QueueUpdateDraw()`
5. View refreshed automatically

#### Modal Handling
1. `modalOpen` flag set to true
2. Main keyboard shortcuts blocked
3. Enter/Escape keys passed through to modal
4. On close, flag cleared and main view restored

#### View Switching
- Each view (normal/debug/raw) is a separate TextView
- Pages component manages active view
- Scroll position maintained per view
- Title and scroll indicators update dynamically

## Integration Points

### 1. DocumentorAgent Integration
```go
// Send messages to TUI
encoder := json.NewEncoder(tuiStdin)
encoder.Encode(Message{
    Type: "log",
    Level: "info",
    Content: "Starting documentation generation",
})
```

### 2. Password Hook
```go
// Request password from user
passwordReq := PasswordRequest{
    Type: "password_request",
    RequestID: uuid.New().String(),
    Prompt: "SSH key passphrase required",
    Context: "Accessing private repository",
}
// Send request and wait for response
```

### 3. Progress Tracking
```go
// Update progress in real-time
phaseUpdate := Message{
    Type: "phase",
    Phase: PhaseInfo{
        Current: 3,
        Total: 7,
        Name: "Generating Documentation",
        SubPhase: "Creating markdown files",
    },
}
```

## Testing

### Test Scripts

1. **test_modal_only.sh**: Minimal test for password modal
2. **test_simple_password.sh**: Password modal with messages
3. **mock_data.sh**: Full UI demonstration with all message types
4. **test_wrapping.sh**: Test text wrapping with long lines
5. **test_password.sh**: Automated password request testing

### Manual Testing

```bash
# Test password modal
./test_modal_only.sh
# Press 'P' to trigger modal
# Enter password and press Enter
# Or press Escape to cancel

# Test full UI
./mock_data.sh
# Watch all UI elements update
# Try all keyboard shortcuts
```

## Customization

### Colors
- Modify color codes in `addLog()`, `updateInfoBox()`, etc.
- Uses tview color syntax: `[color]text[white]`

### Layout
- Adjust panel heights in `NewTUI()` flex items
- Modify grid layout in `updateInfoBox.go`

### Shortcuts
- Update key handlers in main input capture
- Add new cases in `KeyRune` switch statement

## Performance Considerations

- **Non-blocking UI**: All updates via `QueueUpdateDraw()`
- **Goroutine Safety**: Separate reader goroutine for stdin
- **Memory Efficient**: Text views with scrollback limits
- **CPU Friendly**: Spinner updates only when visible

## Troubleshooting

### Modal Not Responding
- Check `modalOpen` flag is properly set/cleared
- Ensure main input capture passes events when modal open
- Verify focus is set to input field

### Text Not Wrapping
- Confirm `SetWrap(true)` and `SetWordWrap(true)` on TextViews
- Check terminal width is sufficient

### Shortcuts Not Working
- Verify modal is not open (`modalOpen == false`)
- Check focus is on correct widget
- Ensure key event not consumed by earlier handler

## Future Enhancements

- [ ] Bidirectional communication (responses to agent)
- [ ] Configuration file support
- [ ] Theme customization
- [ ] Log filtering and search
- [ ] Session recording and replay
- [ ] Multi-project support
- [ ] Network status indicators
- [ ] Progress bar animations

## License

Part of the DocuMentor project. See main project LICENSE.