# TUI as Primary Entrypoint Architecture

## ⚠️ CRITICAL ARCHITECTURE POINT ⚠️

**The Go TUI binary (`documentor`) is the PRIMARY ENTRYPOINT that spawns Node.js as a child process!**

## Architecture Overview

```
User → Go TUI Binary → Node.js Process → Claude Code CLI
         (Parent)        (Child)          (Grandchild)
```

## Process Hierarchy

```
documentor (Go binary)                    [PID: 45789]
├── tview TUI interface                   [Main thread]
├── Node.js process                       [Child PID: 45790]
│   ├── DocumentProcessor                 [Worker 1]
│   ├── DocumentProcessor                 [Worker 2]
│   ├── DocumentProcessor                 [Worker 3]
│   ├── DocumentProcessor                 [Worker 4]
│   └── Claude Code CLI processes         [Multiple grandchildren]
│       ├── claude process 1              [PID: 45791]
│       ├── claude process 2              [PID: 45792]
│       ├── claude process 3              [PID: 45793]
│       └── claude process 4              [PID: 45794]
└── Process cleanup handler                [Signal handler]
```

## Go TUI as Entrypoint

### 1. Binary Compilation
```bash
# The Go TUI is compiled into a single binary
go build -o documentor src/tui/main.go

# This becomes the ONLY executable users interact with
./documentor generate /path/to/project
```

### 2. Go TUI Responsibilities
```go
// src/tui/main.go
func main() {
    // 1. Parse command line arguments
    cmd := parseCommand(os.Args)
    
    // 2. Initialize TUI interface
    tui := NewTUI()
    
    // 3. Spawn Node.js child process
    nodeProcess := exec.Command("node", 
        "dist/cli/index.js",
        cmd.Command,
        cmd.ProjectPath,
        "--tui-mode",  // Special flag indicating TUI parent
    )
    
    // 4. Connect pipes for communication
    nodeProcess.Stdout = tui.MessagePipe
    nodeProcess.Stderr = tui.ErrorPipe
    nodeProcess.Stdin = tui.CommandPipe
    
    // 5. Start Node.js process
    nodeProcess.Start()
    
    // 6. Run TUI event loop
    tui.Run()
    
    // 7. Cleanup on exit
    defer nodeProcess.Kill()
}
```

### 3. Communication Protocol
```go
// Go TUI receives JSON messages from Node.js
type TUIMessage struct {
    Type      string      `json:"type"`
    Timestamp string      `json:"timestamp"`
    Data      interface{} `json:"data"`
}

// Message flow: Node.js → stdout → Go TUI
func (tui *TUI) handleNodeMessage(msg TUIMessage) {
    switch msg.Type {
    case "phase":
        tui.updatePhase(msg.Data)
    case "file":
        tui.updateFileProgress(msg.Data)
    case "log":
        tui.appendLog(msg.Data)
    case "worker":
        tui.updateWorkerStatus(msg.Data)
    case "performance":
        tui.updatePerformance(msg.Data)
    }
}
```

## Node.js as Child Process

### 1. Detection of TUI Mode
```typescript
// src/cli/index.ts
const isTUIMode = process.argv.includes('--tui-mode')

if (isTUIMode) {
  // Initialize TUI communication
  const tuiInterface = new TUIInterface()
  tuiInterface.connectToParent(process.stdout, process.stdin)
  
  // All console.log redirected to TUI
  console.log = (msg) => tuiInterface.send({ type: 'log', content: msg })
} else {
  // Regular CLI mode (for debugging/testing)
  // Normal console output
}
```

### 2. TUIInterface Class
```typescript
// src/core/efficient/TUIInterface.ts
export class TUIInterface {
  private stdout: NodeJS.WriteStream
  private stdin: NodeJS.ReadStream
  private messageQueue: TUIMessage[] = []
  private batchTimer?: NodeJS.Timeout
  
  connectToParent(stdout: NodeJS.WriteStream, stdin: NodeJS.ReadStream) {
    this.stdout = stdout
    this.stdin = stdin
    
    // Listen for commands from Go TUI
    this.stdin.on('data', (data) => {
      const command = JSON.parse(data.toString())
      this.handleCommand(command)
    })
  }
  
  send(message: TUIMessage): void {
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
      // Send to Go TUI via stdout
      this.messageQueue.forEach(msg => {
        this.stdout.write(JSON.stringify(msg) + '\n')
      })
      this.messageQueue = []
    }
    this.batchTimer = undefined
  }
  
  handleCommand(command: TUICommand): void {
    switch (command.type) {
      case 'pause':
        this.pauseProcessing()
        break
      case 'resume':
        this.resumeProcessing()
        break
      case 'abort':
        this.abortProcessing()
        break
    }
  }
}
```

## Claude Code CLI as Grandchild

### Process Spawning Chain
```typescript
// src/core/ClaudeClient.ts
class ClaudeClient {
  async executeClaudeQuery(prompt: string): Promise<string> {
    // Node.js spawns Claude Code CLI
    const claudeProcess = spawn(claudePath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.projectPath
    })
    
    // This creates grandchild process under Node.js
    // Go TUI → Node.js → Claude Code CLI
  }
}
```

## Complete Flow Example

### 1. User Executes Command
```bash
./documentor generate /Users/ivg/github/bm_player_template
```

### 2. Go TUI Starts
```go
// Go binary is the entrypoint
func main() {
    // Initialize TUI
    app := tview.NewApplication()
    
    // Spawn Node.js
    node := exec.Command("node", "dist/cli/index.js", "generate", projectPath, "--tui-mode")
    
    // Start processing
    node.Start()
    
    // Run TUI
    app.Run()
}
```

### 3. Node.js Processes Documents
```typescript
// Node.js receives command and starts processing
class DocumentProcessor {
  async process(files: SourceFile[]) {
    // Send progress to Go TUI
    this.tui.updatePhase({ current: 1, total: 9, name: 'Initialization' })
    
    // Process files in parallel
    await Promise.all(workers.map(w => w.process()))
    
    // Each worker spawns Claude Code CLI
  }
}
```

### 4. Claude Generates Documentation
```typescript
// Each worker spawns Claude
const claudeProcess = spawn('/Users/ivg/.nvm/versions/node/v24.6.0/bin/claude', args)
```

### 5. Updates Flow Back
```
Claude → Node.js → Go TUI → User Display
```

## Process Management

### Graceful Shutdown
```go
// Go TUI handles all cleanup
func (tui *TUI) cleanup() {
    // 1. Send abort command to Node.js
    tui.sendCommand(TUICommand{Type: "abort"})
    
    // 2. Wait for graceful shutdown
    time.Sleep(500 * time.Millisecond)
    
    // 3. Kill Node.js process (kills all children)
    tui.nodeProcess.Kill()
    
    // 4. Clean up TUI
    tui.app.Stop()
}
```

### Signal Handling
```go
// Handle Ctrl+C properly
signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
go func() {
    <-sigChan
    tui.cleanup()
    os.Exit(0)
}()
```

## Benefits of This Architecture

### 1. Single Binary Distribution
- Users only need the `documentor` binary
- No need to install Node.js globally (can be bundled)
- Simple installation: just copy the binary

### 2. Better Process Control
- Go TUI has full control over Node.js lifecycle
- Clean process management
- Proper cleanup on exit

### 3. Enhanced User Experience
- Immediate TUI feedback
- No terminal corruption
- Smooth interaction

### 4. Cross-Platform Compatibility
- Go compiles to native binaries for all platforms
- TUI works consistently across OS
- No platform-specific Node.js issues

## Implementation Requirements

### 1. Go TUI Must:
- Be the primary entrypoint
- Spawn Node.js as child
- Handle all user interaction
- Manage process lifecycle
- Parse command line arguments

### 2. Node.js Must:
- Detect TUI mode via `--tui-mode` flag
- Send all output as JSON to stdout
- Listen for commands on stdin
- Not corrupt terminal output
- Handle graceful shutdown

### 3. Communication Must:
- Use JSON for all messages
- Batch messages for efficiency
- Handle errors gracefully
- Support bidirectional flow

## Testing Strategy

### Standalone Testing
```bash
# Test Node.js directly (debug mode)
node dist/cli/index.js generate /project

# Test Go TUI with mock Node.js
go test ./tui/...

# Integration test
./documentor generate /test/project
```

### Debug Mode
```bash
# Enable debug output
DOCUMENTOR_DEBUG=true ./documentor generate /project

# This shows:
# - TUI initialization
# - Node.js spawn command
# - Message flow
# - Process cleanup
```

## Summary

The architecture is:
1. **Go TUI is the ONLY entrypoint** users interact with
2. **Go TUI spawns Node.js** as a child process
3. **Node.js spawns Claude Code CLI** as grandchildren
4. **All communication flows through Go TUI**
5. **Single binary distribution** for end users

This ensures clean process management, proper UI control, and excellent user experience!