# DocuMentor Technical Documentation

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Key Components and Modules](#key-components-and-modules)
3. [Data Structures](#data-structures)
4. [Algorithms and Design Patterns](#algorithms-and-design-patterns)
5. [Performance Considerations](#performance-considerations)
6. [Security Measures](#security-measures)
7. [Testing Approach](#testing-approach)

## System Architecture

### Overview
DocuMentor is a TypeScript-based CLI application that leverages Claude AI for intelligent documentation generation. The architecture follows a modular, event-driven design with emphasis on safety, streaming processing, and extensibility.

### Architecture Diagram
```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Layer                            │
│                    (Commander.js - index.ts)                 │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│                    Core Engine Layer                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ DocumentationAgent │ FullMontyGeneratorV3            │   │
│  │ MultiProjectAnalyzer │ ProjectAnalyzer               │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│                    AI Integration Layer                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ EnhancedClaudeClientV2 │ ClaudeStreamClient          │   │
│  │ StreamingReporter │ claudeCodeClient                 │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│                  Safety & Validation Layer                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ SafetyValidator │ SimpleLockFile │ CodeVerifier      │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│                    UI & Reporting Layer                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ StableTerminalUI │ ImprovedTerminalUI                │   │
│  │ CleanTerminalUI │ StreamingReporter                  │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│                Knowledge Management Layer                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ObsidianLinker │ SmartTagManager │ TagManager        │   │
│  │ ObsidianFormatter │ FrontmatterGenerator             │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### Architectural Principles

1. **Modularity**: Each component has a single responsibility and clear interfaces
2. **Streaming Processing**: Real-time processing of Claude AI responses for better UX
3. **Safety-First**: Multiple validation layers before any file system operations
4. **Resumability**: Lock files and state management enable interrupted task resumption
5. **Extensibility**: Plugin-like architecture for formatters and analyzers

## Key Components and Modules

### Core Components

#### 1. DocumentationAgent (`src/DocumentationAgent.ts`)
- **Purpose**: Main orchestrator for documentation generation
- **Responsibilities**:
  - Project analysis coordination
  - Documentation generation workflow
  - Output formatting and saving
- **Key Methods**:
  - `generateDocumentation()`: Main entry point
  - `analyzeProject()`: Project structure analysis
  - `formatForObsidian()`: Obsidian-specific formatting

#### 2. FullMontyGeneratorV3 (`src/FullMontyGeneratorV3.ts`)
- **Purpose**: Comprehensive documentation generation with quality metrics
- **Features**:
  - Multi-project support
  - Quality scoring (code, documentation, tests, security)
  - Progress tracking with UI integration
- **Key Methods**:
  - `generate()`: Orchestrates full documentation suite
  - Quality assessment algorithms

#### 3. EnhancedClaudeClientV2 (`src/EnhancedClaudeClientV2.ts`)
- **Purpose**: Claude AI integration with streaming support
- **Features**:
  - Real-time JSON event streaming
  - Tool usage tracking
  - Token usage monitoring
- **Implementation**:
  - Spawns Claude CLI process
  - Parses JSON events via readline interface
  - Handles multiple event types (system, assistant, tool_use, result)

#### 4. SafetyValidator (`src/SafetyValidator.ts`)
- **Purpose**: File system safety and integrity checks
- **Features**:
  - Protected path validation
  - File size limits
  - Sensitive data detection
  - Backup management
- **Security Measures**:
  - Checksum verification
  - System path protection
  - Content validation

#### 5. SimpleLockFile (`src/SimpleLockFile.ts`)
- **Purpose**: Concurrent operation prevention and state management
- **Features**:
  - Process-based locking
  - Resumable state persistence
  - Automatic cleanup on interruption
- **Lock Data Structure**:
  ```typescript
  interface LockFileData {
    pid: number;
    startTime: string;
    lastUpdate: string;
    status: 'running' | 'interrupted' | 'completed' | 'failed';
    currentPhase?: string;
    completedTasks?: string[];
    progress?: number;
  }
  ```

### UI Components

#### StableTerminalUI / ImprovedTerminalUI
- **Purpose**: Terminal-based progress tracking and visualization
- **Features**:
  - Task progress bars
  - Real-time streaming updates
  - Phase tracking
  - Error logging with context

### Knowledge Management Components

#### SmartTagManager (`src/SmartTagManager.ts`)
- **Purpose**: Intelligent tag management with hierarchy and consolidation
- **Features**:
  - Tag similarity detection (80% threshold)
  - Automatic consolidation rules
  - Hierarchical categorization
  - Usage statistics tracking

## Data Structures

### 1. Project Analysis Structure
```typescript
interface ProjectAnalysis {
  projectType: 'single' | 'multi-tool' | 'monorepo' | 'collection';
  subProjects: SubProject[];
  versionControl?: {
    isGitRepo: boolean;
    hasRemote: boolean;
    remoteUrl?: string;
    branch?: string;
  };
  dependencies?: {
    production: Record<string, string>;
    development: Record<string, string>;
  };
}
```

### 2. Documentation Configuration
```typescript
interface DocConfig {
  targetPath: string;
  outputPath?: string;
  excludePaths?: string[];
  verifyCode?: boolean;
  includeTests?: boolean;
  updateExisting?: boolean;
}
```

### 3. Tag Management
```typescript
interface TagDefinition {
  tag: string;
  aliases: string[];
  parent?: string;
  category: 'project' | 'language' | 'framework' | 'tool' | 'concept' | 'meta';
  count: number;
  firstSeen: Date;
  lastUsed: Date;
}

interface TagHierarchy {
  projectRoot: string;
  categories: Map<string, Set<string>>;
  relationships: Map<string, Set<string>>;
  consolidationRules: Map<string, string>;
}
```

### 4. Full Monty Report
```typescript
interface FullMontyReport {
  targetPath: string;
  timestamp: Date;
  duration: number;
  projectType: string;
  subProjects: number;
  documentsGenerated: number;
  quality: {
    codeQuality: number;      // 0-100
    documentationCoverage: number;  // 0-100
    testCoverage: number;     // 0-100
    securityScore: number;    // 0-100
  };
}
```

## Algorithms and Design Patterns

### Design Patterns

#### 1. **Command Pattern**
- Used in CLI implementation via Commander.js
- Each command encapsulates specific functionality
- Enables easy extension with new commands

#### 2. **Observer Pattern**
- Streaming updates from Claude AI
- UI components observe documentation generation progress
- Event-driven architecture for real-time updates

#### 3. **Strategy Pattern**
- Different documentation strategies based on project type
- Pluggable formatters (Obsidian, Markdown)
- Configurable analysis strategies

#### 4. **Singleton Pattern**
- Configuration manager instance
- Terminal UI instance
- Lock file manager

#### 5. **Factory Pattern**
- Document generator creation based on project type
- UI component creation

### Key Algorithms

#### 1. **Tag Similarity Algorithm**
```typescript
// Levenshtein distance for tag similarity
private calculateSimilarity(tag1: string, tag2: string): number {
  // Normalize tags
  const s1 = this.normalizeTag(tag1);
  const s2 = this.normalizeTag(tag2);
  
  // Calculate Levenshtein distance
  const distance = this.levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  
  // Convert to similarity percentage
  return 1 - (distance / maxLength);
}
```

#### 2. **Project Type Detection**
- Heuristic-based analysis
- Checks for workspace configurations
- Analyzes directory structure patterns
- Examines package.json/configuration files

#### 3. **Lock File Staleness Detection**
```typescript
async checkLock(): Promise<{ isLocked: boolean; canResume?: boolean }> {
  const lockData = await this.readLockFile();
  
  // Check process alive
  const isAlive = this.isProcessAlive(lockData.pid);
  
  // Check staleness (30 second threshold)
  const timeSinceUpdate = Date.now() - new Date(lockData.lastUpdate).getTime();
  const isStale = timeSinceUpdate > 30000;
  
  return {
    isLocked: isAlive && !isStale,
    canResume: lockData.status === 'interrupted' || isStale
  };
}
```

## Performance Considerations

### 1. **Streaming Processing**
- **Challenge**: Large documentation generation can consume significant memory
- **Solution**: Stream-based processing of Claude responses
- **Implementation**: Readline interface for line-by-line JSON parsing
- **Benefit**: Constant memory usage regardless of response size

### 2. **File System Operations**
- **Optimization**: Batch file operations where possible
- **Caching**: Tag registry cached in memory
- **Async I/O**: All file operations use fs/promises for non-blocking execution

### 3. **Lock File Updates**
- **Strategy**: Periodic updates (every 10 seconds) instead of continuous
- **Benefit**: Reduces I/O overhead while maintaining freshness

### 4. **Project Analysis**
- **Optimization**: Parallel analysis of sub-projects in monorepos
- **Caching**: Reuse analysis results across documentation phases

### 5. **Memory Management**
- **Content Cleaning**: ContentCleaner removes unnecessary whitespace/formatting
- **Streaming UI**: Updates displayed incrementally without buffering entire output
- **File Size Limits**: 10MB default maximum per file

## Security Measures

### 1. **Path Validation**
```typescript
// Protected system paths
private readOnlyPaths = [
  '/System', '/usr/bin', '/bin',
  '~/.ssh', '~/.gnupg', '~/.aws', '~/.kube'
];

// Require extra validation
private protectedPaths = [
  '~/.gitconfig', '~/.bashrc', '~/.zshrc'
];
```

### 2. **Sensitive Data Detection**
- API key patterns
- Private key patterns
- Password/secret patterns
- Personal information patterns

### 3. **Content Validation**
- JSON/YAML syntax validation
- File size limits (10MB default)
- Character encoding validation
- Path traversal prevention

### 4. **Backup Strategy**
- Automatic backups before writes
- Checksum verification
- Rollback capability
- 7-day retention policy

### 5. **Process Isolation**
- Lock files prevent concurrent modifications
- PID-based process tracking
- Graceful cleanup on interruption

### 6. **Claude AI Integration Security**
- `--dangerously-skip-permissions` flag used consciously
- Tool usage restrictions via `--allowedTools`
- Working directory isolation

## Testing Approach

### 1. **Unit Testing Strategy** (Planned)
- Component isolation testing
- Mock Claude AI responses
- File system operation mocking
- Error scenario coverage

### 2. **Integration Testing**
- End-to-end documentation generation
- Multi-project analysis validation
- Obsidian format verification
- Tag consolidation testing

### 3. **Performance Testing**
- Large codebase handling (1000+ files)
- Memory usage profiling
- Streaming performance validation
- Concurrent operation testing

### 4. **Security Testing**
- Path traversal attempts
- Sensitive data detection validation
- System path protection verification
- Lock file race condition testing

### 5. **User Acceptance Testing**
- CLI command validation
- Progress tracking accuracy
- Interrupt/resume functionality
- Documentation quality assessment

### 6. **Test Coverage Goals**
- Target: 80% code coverage
- Critical paths: 100% coverage
- Error handling: Comprehensive coverage
- Edge cases: Systematic identification and testing

## Configuration Management

### Configuration Hierarchy
1. Built-in defaults
2. User configuration (`~/.documentor/config.json`)
3. Project configuration (`.documentor.json`)
4. Environment variables
5. CLI arguments (highest priority)

### Configuration Schema
```typescript
interface Configuration {
  defaultTargetPath?: string;
  obsidianVaultPath: string;
  excludePaths: string[];
  github: {
    enabled: boolean;
    accessToken: string;
    repositories: string[];
    pollInterval: number;
  };
  safetyMode: {
    enabled: boolean;
    backupBeforeWrite: boolean;
    maxBackupAge: number;
    maxFileSize: number;
  };
  monitoring: {
    saveProgress: boolean;
    enableInterrupts: boolean;
    autoSaveInterval: number;
  };
  fullMonty: {
    generateAll: boolean;
    includeMetrics: boolean;
    qualityThreshold: number;
  };
}
```

## Error Handling

### Error Categories
1. **Fatal Errors**: Process termination required
2. **Recoverable Errors**: Can continue with degraded functionality
3. **Warnings**: Non-critical issues logged
4. **Validation Errors**: User input/configuration issues

### Error Recovery Strategies
- Lock file cleanup on crash
- Partial documentation preservation
- Graceful degradation for missing features
- User-friendly error messages with suggestions

## Future Enhancements

### Planned Features
1. **Plugin System**: Extensible analyzers and formatters
2. **Web Dashboard**: Browser-based monitoring
3. **Real-time Collaboration**: Multi-user documentation sessions
4. **CI/CD Integration**: GitHub Actions, GitLab CI support
5. **Multi-language Support**: Internationalization
6. **Cloud Sync**: Cross-device configuration sync

### Performance Improvements
1. Incremental documentation updates
2. Parallel Claude AI queries
3. Smart caching layer
4. Differential analysis for large codebases

### Security Enhancements
1. Encryption for sensitive configurations
2. Audit logging
3. Role-based access control
4. Compliance reporting (GDPR, SOC2)

---

*Generated by DocuMentor v2.0.0*
*Last Updated: 2025-08-29*