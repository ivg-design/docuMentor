# DocuMentor V2.1 - Pragmatic Architecture

## Core Principles
1. **SIMPLE** - No unnecessary abstractions
2. **DIRECT** - Function calls, not event buses
3. **SECURE** - No passwords, handle permissions gracefully
4. **PRACTICAL** - Solve real problems, not theoretical ones

## Architecture Overview (SIMPLE!)

```
documentor CLI
     │
     ▼
DocumentEngine ─────┬──→ ProjectAnalyzer
     │              ├──→ ClaudeClient  
     │              ├──→ DocGenerator
     │              └──→ FileWriter
     │
     ▼
ProgressTracker ────→ TUIBridge ────→ Go TUI
```

That's it! No DI containers, no event buses, no service registries.

## Core Components (5 files, ~3000 lines total)

### 1. `src/DocumentEngine.ts` (~500 lines)
```typescript
export class DocumentEngine {
  private analyzer: ProjectAnalyzer
  private claude: ClaudeClient
  private generator: DocGenerator
  private progress: ProgressTracker
  
  constructor(config: Config) {
    // Direct instantiation, no DI nonsense
    this.analyzer = new ProjectAnalyzer(config)
    this.claude = new ClaudeClient(config)
    this.generator = new DocGenerator(config)
    this.progress = new ProgressTracker()
  }
  
  async generate(projectPath: string): Promise<void> {
    try {
      // Phase 1: Analysis
      this.progress.startPhase('Analysis', 1, 5)
      const project = await this.analyzer.analyze(projectPath)
      
      // Phase 2: Generation
      this.progress.startPhase('Generation', 2, 5)
      const docs = await this.generator.generate(project)
      
      // Phase 3: Enhancement
      this.progress.startPhase('Enhancement', 3, 5)
      const enhanced = await this.generator.enhance(docs)
      
      // Phase 4: Formatting
      this.progress.startPhase('Formatting', 4, 5)
      const formatted = await this.generator.format(enhanced)
      
      // Phase 5: Saving
      this.progress.startPhase('Saving', 5, 5)
      await this.writer.save(formatted)
      
    } catch (error) {
      this.handleError(error)
    }
  }
  
  private handleError(error: any): void {
    // CRITICAL: Handle permission errors gracefully
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      console.error('❌ Permission denied. Please check file permissions.')
      console.error('   Cannot write to:', error.path)
      console.error('   Run without sudo. Never run documentor with sudo.')
      process.exit(1)
    }
    
    if (error.code === 'ENOENT') {
      console.error('❌ Path not found:', error.path)
      process.exit(1)
    }
    
    // Generic error
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}
```

### 2. `src/ClaudeClient.ts` (~400 lines)
```typescript
export class ClaudeClient {
  async query(prompt: string, projectPath: string): Promise<string> {
    const args = [
      '--print',
      '--verbose', 
      '--output-format', 'stream-json',
      // NO PASSWORD PROMPTS - Skip permissions
      '--dangerously-skip-permissions',
      // BLOCKED TOOLS - Never use TodoWrite or password tools
      '--disallowedTools', 'TodoWrite,Task,Password',
      '--allowedTools', 'Read,Grep,Glob,LS,Bash,Write,Edit'
    ]
    
    const claude = spawn('claude', args, {
      cwd: projectPath,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    // NEVER handle password prompts
    // If Claude asks for password, kill it
    claude.stderr.on('data', (data) => {
      if (data.toString().includes('Password') || 
          data.toString().includes('password')) {
        claude.kill('SIGTERM')
        throw new Error('Claude requested password. This is not allowed.')
      }
    })
    
    // Rest of implementation...
  }
}
```

### 3. `src/ProgressTracker.ts` (~300 lines)
```typescript
export class ProgressTracker {
  private tui: TUIBridge
  private state: {
    phase: { current: number, total: number, name: string }
    task: { current: number, total: number, name: string }
    file: { current: string, processed: number, total: number }
  }
  
  constructor() {
    this.tui = new TUIBridge()
  }
  
  startPhase(name: string, current: number, total: number): void {
    this.state.phase = { name, current, total }
    this.tui.updatePhase(this.state.phase)
  }
  
  startTask(name: string, current: number, total: number): void {
    this.state.task = { name, current, total }
    this.tui.updateTask(this.state.task)
  }
  
  processFile(name: string): void {
    this.state.file.current = name
    this.state.file.processed++
    this.tui.updateFile(this.state.file)
  }
}
```

### 4. `src/Config.ts` (~200 lines)
```typescript
export interface Config {
  // Simple, flat configuration
  projectPath: string
  outputPath: string
  
  // Display preferences
  format: 'normal' | 'raw' | 'debug'
  colors: boolean
  
  // Claude settings
  claude: {
    model: string
    maxTokens: number
  }
  
  // Phases (optional customization)
  phases?: string[]  // Simple array of phase names to run
}

export class ConfigLoader {
  static load(projectPath: string): Config {
    // 1. Check project-local config
    const localConfig = path.join(projectPath, '.documentor', 'config.json')
    if (fs.existsSync(localConfig)) {
      return JSON.parse(fs.readFileSync(localConfig, 'utf-8'))
    }
    
    // 2. Use defaults
    return {
      projectPath,
      outputPath: path.join(os.homedir(), 'obsidian_vault/docs'),
      format: 'normal',
      colors: true,
      claude: {
        model: 'claude-3-opus',
        maxTokens: 100000
      }
    }
  }
}
```

### 5. `src/TUIBridge.ts` (~200 lines)
```typescript
export class TUIBridge {
  // Simple JSON messages to Go TUI
  
  updatePhase(phase: PhaseInfo): void {
    this.send({
      type: 'phase',
      phase: {
        current: phase.current,
        total: phase.total,
        name: phase.name
      }
    })
  }
  
  updateTask(task: TaskInfo): void {
    this.send({
      type: 'task', 
      task: {
        current: task.current,
        total: task.total,
        name: task.name
      }
    })
  }
  
  updateFile(file: FileInfo): void {
    this.send({
      type: 'file',
      files: {
        processed: file.processed,
        total: file.total,
        current: file.current
      }
    })
  }
  
  log(level: 'info' | 'warning' | 'error', message: string): void {
    this.send({
      type: 'log',
      level,
      content: message
    })
  }
  
  private send(message: any): void {
    console.log(JSON.stringify(message))
  }
}
```

## Security & Permissions

### **CRITICAL SECURITY RULES**

1. **NEVER prompt for passwords**
   - No sudo prompts
   - No password modals
   - No credential input

2. **NEVER escalate privileges**
   - Never run with sudo
   - Never request elevated permissions
   - Fail gracefully on permission errors

3. **Handle permission errors gracefully**
   ```typescript
   if (error.code === 'EACCES') {
     console.error('Permission denied. Check file permissions.')
     console.error('Do NOT run with sudo.')
     process.exit(1)
   }
   ```

4. **Validate paths before operations**
   ```typescript
   // Check write permission before attempting
   try {
     await fs.access(outputPath, fs.constants.W_OK)
   } catch {
     throw new Error(`Cannot write to ${outputPath}. Check permissions.`)
   }
   ```

## Message Formatting

### Normal Format (User-Friendly)
```
[10:23:45] ✓ Configuration loaded
[10:23:46] → Analyzing project structure...
[10:23:47] ✓ Found 120 files
[10:23:48] → Generating documentation...
[10:23:49] ✓ README.md created
```

### Raw Format (For Piping)
```
CONFIG_LOADED
ANALYZING_PROJECT
FILES_FOUND:120
GENERATING_DOCS
FILE_CREATED:README.md
```

### Debug Format (Full Details)
```json
{"type":"phase","timestamp":"2024-01-01T10:23:45Z","phase":{"current":1,"total":5,"name":"Analysis"}}
{"type":"file","timestamp":"2024-01-01T10:23:46Z","file":"src/index.ts","operation":"read"}
```

## Status Bar Display

```
Phase: 2/5 Generation | Task: 3/4 API Docs | File: 45/120 | Status: Analyzing src/Engine.ts
```

## Benefits of V2.1 over V3

| Aspect | V3 (Overengineered) | V2.1 (Pragmatic) |
|--------|-------------------|-----------------|
| Lines of Code | ~12,000 | ~3,000 |
| Files | 25+ | 5-7 |
| Complexity | High (DI, Events, Interfaces) | Low (Direct calls) |
| Maintainability | Hard | Easy |
| Testing | Complex mocks | Simple |
| Performance | Event overhead | Direct |
| Learning Curve | Steep | Gentle |

## Implementation Plan

### Week 1: Core Components
1. Create DocumentEngine with basic flow
2. Implement ClaudeClient with security
3. Build ProgressTracker

### Week 2: Integration
1. Connect TUIBridge
2. Add Config loading
3. Test with real projects

### Week 3: Polish
1. Error handling
2. Permission validation
3. Documentation

## Summary

V2.1 is **80% less code** than V3 while providing **100% of the functionality**:
- ✅ **Simple** - Direct function calls
- ✅ **Secure** - No passwords, proper permission handling
- ✅ **Practical** - Solves real problems
- ✅ **Maintainable** - Anyone can understand it
- ❌ **No overengineering** - No DI, no event buses, no abstractions