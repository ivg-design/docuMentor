# DocuMentor V3 Architecture

## Clean, Modular, Maintainable

### Core Principles
1. **Single Responsibility**: Each module does ONE thing well
2. **Dependency Injection**: No hardcoded dependencies
3. **Event-Driven**: Loose coupling through events
4. **Configuration-First**: Everything configurable
5. **Clear Interfaces**: Well-defined contracts

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLI Entry Point                         │
│                         src/index.ts                            │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Core Engine                                 │
│                  src/core/Engine.ts                             │
│  • Dependency injection container                               │
│  • Service orchestration                                        │
│  • Event bus management                                         │
└────────┬───────────────────────────────────┬────────────────────┘
         │                                   │
         ▼                                   ▼
┌─────────────────────┐           ┌─────────────────────┐
│   Configuration     │           │    Event Bus        │
│ src/core/Config.ts  │           │ src/core/Events.ts  │
│ • Project config    │           │ • Type-safe events  │
│ • Phase definitions │           │ • Event routing     │
│ • Custom workflows  │           │ • Error handling    │
└─────────────────────┘           └─────────────────────┘
         │                                   │
         ▼                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Services Layer                           │
├─────────────────────┬─────────────────────┬────────────────────┤
│   AnalysisService   │  GenerationService  │  ClaudeService     │
│ src/services/       │ src/services/       │ src/services/      │
│   Analysis.ts       │   Generation.ts     │   Claude.ts        │
├─────────────────────┼─────────────────────┼────────────────────┤
│   FileService       │  ObsidianService    │  ProgressService   │
│ src/services/       │ src/services/       │ src/services/      │
│   Files.ts          │   Obsidian.ts       │   Progress.ts      │
└─────────────────────┴─────────────────────┴────────────────────┘
         │                                   │
         ▼                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Output Layer                                │
├─────────────────────┬─────────────────────┬────────────────────┤
│   MessageFormatter  │    TUIBridge        │   FileWriter       │
│ src/output/         │ src/output/         │ src/output/        │
│   Formatter.ts      │   TUIBridge.ts      │   Writer.ts        │
└─────────────────────┴─────────────────────┴────────────────────┘
```

## Module Definitions

### 1. Core Engine (`src/core/Engine.ts`)
```typescript
interface IEngine {
  configure(config: IConfig): void
  execute(command: Command): Promise<void>
  registerService(name: string, service: IService): void
  emit(event: IEvent): void
}

class Engine implements IEngine {
  private services: Map<string, IService>
  private eventBus: IEventBus
  private config: IConfig
  
  async execute(command: Command): Promise<void> {
    const workflow = this.config.getWorkflow(command)
    for (const phase of workflow.phases) {
      await this.executePhase(phase)
    }
  }
}
```

### 2. Configuration (`src/core/Config.ts`)
```typescript
interface IConfig {
  // Paths
  projectPath: string
  outputPath: string
  configPath: string
  
  // Workflow customization
  workflow?: IWorkflow
  
  // Display preferences
  display: {
    format: 'normal' | 'raw' | 'debug'
    colors: boolean
    verbose: boolean
  }
  
  // Claude settings
  claude: {
    model: string
    allowedTools: string[]
    maxTokens: number
  }
}

interface IWorkflow {
  phases: IPhase[]
}

interface IPhase {
  id: string
  name: string
  tasks: ITask[]
  weight: number
  enabled: boolean
}

interface ITask {
  id: string
  name: string
  operation: string
  required: boolean
}
```

### 3. Event System (`src/core/Events.ts`)
```typescript
enum EventType {
  // Phase events
  PHASE_START = 'phase:start',
  PHASE_COMPLETE = 'phase:complete',
  
  // Task events
  TASK_START = 'task:start',
  TASK_PROGRESS = 'task:progress',
  TASK_COMPLETE = 'task:complete',
  
  // Operation events
  OPERATION_START = 'operation:start',
  OPERATION_COMPLETE = 'operation:complete',
  
  // File events
  FILE_PROCESS = 'file:process',
  FILE_COMPLETE = 'file:complete',
  
  // Error events
  ERROR = 'error',
  WARNING = 'warning'
}

interface IEvent {
  type: EventType
  timestamp: Date
  data: any
}

interface IEventBus {
  on(event: EventType, handler: EventHandler): void
  emit(event: IEvent): void
  removeListener(event: EventType, handler: EventHandler): void
}
```

### 4. Progress Service (`src/services/Progress.ts`)
```typescript
interface IProgress {
  phase: {
    current: number
    total: number
    name: string
  }
  task: {
    current: number
    total: number
    name: string
  }
  operation: {
    type: string
    target: string
  }
  file: {
    current: number
    total: number
    name: string
  }
}

class ProgressService implements IService {
  private state: IProgress
  
  constructor(private eventBus: IEventBus) {
    this.subscribeToEvents()
  }
  
  private subscribeToEvents(): void {
    this.eventBus.on(EventType.PHASE_START, this.onPhaseStart)
    this.eventBus.on(EventType.TASK_START, this.onTaskStart)
    this.eventBus.on(EventType.OPERATION_START, this.onOperationStart)
    this.eventBus.on(EventType.FILE_PROCESS, this.onFileProcess)
  }
  
  getProgress(): IProgress {
    return { ...this.state }
  }
}
```

### 5. Message Formatter (`src/output/Formatter.ts`)
```typescript
enum MessageFormat {
  NORMAL = 'normal',   // Clean, user-friendly output
  RAW = 'raw',        // Unformatted output
  DEBUG = 'debug'     // Detailed debug information
}

interface IFormatter {
  format(message: IMessage, format: MessageFormat): string
}

class MessageFormatter implements IFormatter {
  format(message: IMessage, format: MessageFormat): string {
    switch (format) {
      case MessageFormat.NORMAL:
        return this.formatNormal(message)
      case MessageFormat.RAW:
        return this.formatRaw(message)
      case MessageFormat.DEBUG:
        return this.formatDebug(message)
    }
  }
  
  private formatNormal(message: IMessage): string {
    // Clean, colored output for users
    const { type, content, timestamp } = message
    return `[${timestamp}] ${this.getIcon(type)} ${content}`
  }
  
  private formatRaw(message: IMessage): string {
    // Plain text, no formatting
    return message.content
  }
  
  private formatDebug(message: IMessage): string {
    // Full JSON with all metadata
    return JSON.stringify(message, null, 2)
  }
}
```

### 6. TUI Bridge (`src/output/TUIBridge.ts`)
```typescript
interface ITUIMessage {
  type: 'phase' | 'task' | 'operation' | 'file' | 'log'
  data: any
}

class TUIBridge implements IService {
  constructor(
    private eventBus: IEventBus,
    private formatter: IFormatter,
    private progress: ProgressService
  ) {
    this.subscribeToEvents()
  }
  
  private send(message: ITUIMessage): void {
    // Send JSON to Go TUI via stdout
    console.log(JSON.stringify(message))
  }
  
  private subscribeToEvents(): void {
    // Listen to all events and convert to TUI messages
    this.eventBus.on(EventType.PHASE_START, (event) => {
      const progress = this.progress.getProgress()
      this.send({
        type: 'phase',
        data: {
          current: progress.phase.current,
          total: progress.phase.total,
          name: progress.phase.name
        }
      })
    })
  }
}
```

## Default Workflow Configuration

```typescript
const DEFAULT_WORKFLOW: IWorkflow = {
  phases: [
    {
      id: 'init',
      name: 'Initialization',
      weight: 5,
      enabled: true,
      tasks: [
        { id: 'load-config', name: 'Load Configuration', operation: 'config:load', required: true },
        { id: 'validate-env', name: 'Validate Environment', operation: 'env:validate', required: true }
      ]
    },
    {
      id: 'analysis',
      name: 'Project Analysis',
      weight: 20,
      enabled: true,
      tasks: [
        { id: 'scan-files', name: 'Scan Project Files', operation: 'files:scan', required: true },
        { id: 'detect-type', name: 'Detect Project Type', operation: 'project:detect', required: true },
        { id: 'analyze-deps', name: 'Analyze Dependencies', operation: 'deps:analyze', required: false }
      ]
    },
    {
      id: 'generation',
      name: 'Documentation Generation',
      weight: 40,
      enabled: true,
      tasks: [
        { id: 'gen-readme', name: 'Generate README', operation: 'doc:readme', required: true },
        { id: 'gen-api', name: 'Generate API Docs', operation: 'doc:api', required: true },
        { id: 'gen-guides', name: 'Generate Guides', operation: 'doc:guides', required: false }
      ]
    },
    {
      id: 'enhancement',
      name: 'Enhancement',
      weight: 20,
      enabled: true,
      tasks: [
        { id: 'add-frontmatter', name: 'Add Frontmatter', operation: 'enhance:frontmatter', required: true },
        { id: 'create-links', name: 'Create Links', operation: 'enhance:links', required: true },
        { id: 'generate-tags', name: 'Generate Tags', operation: 'enhance:tags', required: true }
      ]
    },
    {
      id: 'finalization',
      name: 'Finalization',
      weight: 15,
      enabled: true,
      tasks: [
        { id: 'validate-output', name: 'Validate Output', operation: 'validate:output', required: true },
        { id: 'create-index', name: 'Create Index', operation: 'index:create', required: false },
        { id: 'save-files', name: 'Save Files', operation: 'files:save', required: true }
      ]
    }
  ]
}
```

## Project Configuration File

Location: `{project}/.documentor/config.json`

```json
{
  "version": "3.0.0",
  "project": {
    "name": "MyProject",
    "path": "./",
    "type": "auto"
  },
  "output": {
    "path": "~/obsidian_vault/docs",
    "format": "obsidian",
    "overwrite": false
  },
  "display": {
    "format": "normal",
    "colors": true,
    "verbose": false
  },
  "claude": {
    "model": "claude-3-opus",
    "allowedTools": ["Read", "Grep", "Glob", "Bash"],
    "maxTokens": 100000
  },
  "workflow": {
    "phases": [
      {
        "id": "init",
        "enabled": true,
        "tasks": ["load-config", "validate-env"]
      },
      {
        "id": "analysis",
        "enabled": true,
        "tasks": ["scan-files", "detect-type"]
      },
      {
        "id": "generation",
        "enabled": true,
        "tasks": ["gen-readme", "gen-api"]
      },
      {
        "id": "enhancement",
        "enabled": true,
        "tasks": ["add-frontmatter", "create-links"]
      },
      {
        "id": "finalization",
        "enabled": true,
        "tasks": ["validate-output", "save-files"]
      }
    ]
  }
}
```

## Status Reporting Format

### TUI Display Structure
```
╔════════════════════════════════════════════════════════════════╗
║ DocuMentor V3.0.0 - Project: MyProject                        ║
╠════════════════════════════════════════════════════════════════╣
║ Phase:    3/5 Documentation Generation                         ║
║ Task:     2/3 Generate API Docs                               ║
║ Progress: ████████████████░░░░░░░░░░░░░░░░░░ 45%             ║
╠════════════════════════════════════════════════════════════════╣
║ [10:23:45] 📄 Reading: src/index.ts                           ║
║ [10:23:46] 🔍 Analyzing: Class definitions                    ║
║ [10:23:47] ✍️  Writing: API.md                                 ║
╠════════════════════════════════════════════════════════════════╣
║ Files: 45/120 | Memory: 125MB | Time: 00:02:34                ║
║ Status: Processing src/services/Engine.ts [Analyzing...]       ║
╚════════════════════════════════════════════════════════════════╝
```

## Key Improvements

### 1. **Modular Services**
- Each service has a single responsibility
- Services communicate through events only
- Easy to test, maintain, and extend

### 2. **Configuration-First**
- Project-specific config in `.documentor/config.json`
- Customizable workflow phases and tasks
- Display format preferences

### 3. **Clear Status Reporting**
- Phase: Current/Total with name
- Task: Current/Total within phase
- Operation: Current tool/action
- File: Current file being processed

### 4. **Message Formatting**
- **Normal**: Clean, user-friendly with colors and icons
- **Raw**: Plain text for piping/scripting
- **Debug**: Full JSON with all metadata

### 5. **Event-Driven Architecture**
- Loose coupling between components
- Easy to add new features without changing core
- Centralized error handling

### 6. **Type Safety**
- Full TypeScript interfaces
- Compile-time checking
- Clear contracts between modules

## Implementation Priority

### Phase 1: Core Infrastructure
1. Create `Engine.ts` with DI container
2. Implement `Events.ts` event bus
3. Create `Config.ts` configuration system

### Phase 2: Essential Services
1. Implement `Progress.ts` service
2. Create `Claude.ts` service
3. Build `Files.ts` service

### Phase 3: Output Layer
1. Implement `Formatter.ts`
2. Create `TUIBridge.ts`
3. Build `Writer.ts`

### Phase 4: Business Logic
1. Port analysis logic to `Analysis.ts`
2. Port generation logic to `Generation.ts`
3. Port Obsidian logic to `Obsidian.ts`

This architecture is:
- **Clean**: Clear separation of concerns
- **Modular**: Easy to extend and maintain
- **Testable**: Each module can be tested independently
- **Configurable**: Everything can be customized
- **Maintainable**: Clear structure and interfaces