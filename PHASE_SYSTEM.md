# DocuMentor Phase System Documentation

## Overview
DocuMentor uses a unified 9-phase system for all documentation generation processes. Each phase has specific tasks, operations, and progress tracking.

## The 9 Phases

### Phase 1: INITIALIZATION (Weight: 5%)
**Purpose**: Set up the documentation environment and validate prerequisites
**Tasks**:
- Loading configuration
- Initializing display system
- Setting up output directories
- Creating lock files
- Validating API keys

**Status Messages**:
- "Loading configuration"
- "Initializing display system"
- "Setting up output directories"
- "Creating lock file"
- "Validating API keys"

**Operations**:
- `Read`: config.json
- `Write`: .documentor.lock
- `Validate`: API credentials

---

### Phase 2: VALIDATION (Weight: 5%)
**Purpose**: Ensure project safety and validity
**Tasks**:
- Running safety checks
- Validating project structure
- Checking permissions
- Verifying dependencies

**Status Messages**:
- "Running safety checks"
- "Validating project structure"
- "Checking file permissions"
- "Verifying dependencies"

**Operations**:
- `Validate`: Project path
- `Check`: File permissions
- `Scan`: Security threats

---

### Phase 3: ANALYSIS (Weight: 20%)
**Purpose**: Deep analysis of the project structure and codebase
**Tasks**:
- Scanning directory structure
- Analyzing code patterns
- Identifying components
- Mapping dependencies
- Extracting metadata

**Status Messages**:
- "Scanning directory structure"
- "Analyzing [X] files"
- "Identifying project type: [type]"
- "Mapping dependencies"
- "Extracting metadata"

**Operations**:
- `Scan`: Directory tree
- `Read`: Source files
- `Analyze`: Code patterns
- `Query`: Claude for project analysis

**Tool Calls**:
- `[READ]`: Reading source files
- `[SEARCH]`: Searching for patterns
- `[LIST]`: Listing directories
- `[FIND]`: Finding specific files

---

### Phase 4: PREPARATION (Weight: 10%)
**Purpose**: Prepare for documentation generation
**Tasks**:
- Creating output structure
- Setting up templates
- Preparing context
- Loading existing documentation

**Status Messages**:
- "Creating output structure"
- "Setting up templates"
- "Preparing documentation context"
- "Loading existing documentation"

**Operations**:
- `Write`: Directory structure
- `Load`: Templates
- `Prepare`: Context data

---

### Phase 5: GENERATION (Weight: 30%)
**Purpose**: Generate the actual documentation files
**Tasks**:
- Creating main documentation
- Generating API documentation
- Creating architecture diagrams
- Writing guides and tutorials

**Status Messages**:
- "Creating README.md"
- "Generating API.md"
- "Creating ARCHITECTURE.md"
- "Writing SETUP.md"
- "Generating CHANGELOG.md"
- "Creating documentation for [component]"

**Operations**:
- `Write`: README.md
- `Write`: API.md
- `Write`: ARCHITECTURE.md
- `Write`: SETUP.md
- `Write`: CHANGELOG.md
- `Query`: Claude for content generation

**Tool Calls**:
- `[WRITE]`: Writing documentation files
- `[EDIT]`: Updating existing files

---

### Phase 6: ENHANCEMENT (Weight: 15%)
**Purpose**: Enhance documentation with additional features
**Tasks**:
- Adding frontmatter
- Creating tags
- Building backlinks
- Generating indexes

**Status Messages**:
- "Adding frontmatter to [file]"
- "Creating tag system"
- "Building backlinks"
- "Generating index files"

**Operations**:
- `Edit`: Add frontmatter
- `Generate`: Tags
- `Create`: Backlinks
- `Write`: Index files

---

### Phase 7: FORMATTING (Weight: 5%)
**Purpose**: Format and beautify documentation
**Tasks**:
- Formatting markdown
- Validating syntax
- Optimizing images
- Creating TOC

**Status Messages**:
- "Formatting markdown files"
- "Validating syntax"
- "Optimizing images"
- "Creating table of contents"

**Operations**:
- `Format`: Markdown files
- `Validate`: Syntax
- `Optimize`: Images

---

### Phase 8: INTEGRATION (Weight: 5%)
**Purpose**: Integrate with Obsidian and other systems
**Tasks**:
- Setting up Obsidian integration
- Creating graph connections
- Building search index
- Setting up plugins

**Status Messages**:
- "Setting up Obsidian integration"
- "Creating graph connections"
- "Building search index"
- "Configuring plugins"

**Operations**:
- `Configure`: Obsidian settings
- `Create`: Graph data
- `Build`: Search index

---

### Phase 9: FINALIZATION (Weight: 5%)
**Purpose**: Complete the documentation process
**Tasks**:
- Generating summary
- Creating audit report
- Cleaning up
- Saving state

**Status Messages**:
- "Generating documentation summary"
- "Creating audit report"
- "Cleaning up temporary files"
- "Saving final state"

**Operations**:
- `Generate`: Summary report
- `Audit`: Documentation quality
- `Clean`: Temporary files
- `Save`: Final state

---

## Operation Types

The system tracks 24 different operation types:

### File Operations
- `Read`: Reading file contents
- `Write`: Creating new files
- `Edit`: Modifying existing files
- `Delete`: Removing files

### Search Operations
- `Search`: Text search in files
- `Find`: Finding files by pattern
- `List`: Listing directory contents
- `Glob`: Pattern matching

### Analysis Operations
- `Analyze`: Analyzing code/content
- `Scan`: Scanning directories
- `Parse`: Parsing file contents
- `Extract`: Extracting metadata

### Generation Operations
- `Generate`: Creating new content
- `Transform`: Converting formats
- `Format`: Formatting content
- `Optimize`: Optimizing resources

### System Operations
- `Query`: Querying AI/Claude
- `Validate`: Validating content
- `Check`: Checking conditions
- `Configure`: Setting configuration

### Meta Operations
- `Start`: Starting a process
- `Complete`: Completing a task
- `Progress`: Updating progress
- `Status`: Reporting status

---

## Progress Calculation

Progress is calculated using weighted phases:
```typescript
totalProgress = Σ(phaseProgress × phaseWeight)
```

Each phase tracks:
- Current task within phase
- Operations performed
- Files processed
- Completion percentage

---

## Status Message Format

Status messages follow this format:
```
[timestamp] [phase X/9] [operation] message
```

Examples:
- `09:15:23 [3/9 Analysis] [READ] src/index.ts`
- `09:15:24 [5/9 Generation] [WRITE] README.md`
- `09:15:25 [5/9 Generation] Creating API documentation`

---

## Integration with TUI

The Phase System sends JSON messages to the Go TUI:

### Phase Update
```json
{
  "type": "phase",
  "phase": {
    "current": 5,
    "total": 9,
    "name": "generation",
    "subPhase": "Creating README.md"
  }
}
```

### Task Update
```json
{
  "type": "log",
  "level": "info",
  "content": "Task: Creating documentation"
}
```

### File Operation
```json
{
  "type": "file",
  "files": {
    "processed": 45,
    "total": 100,
    "current": "src/index.ts"
  }
}
```

### Tool Usage
```json
{
  "type": "tool",
  "tool": "Write",
  "content": "README.md"
}
```

---

## Usage in Code

### Starting a Phase
```typescript
phaseManager.startPhase(PhaseType.GENERATION);
```

### Reporting Operations
```typescript
phaseManager.reportOperation(OperationType.WRITE, 'README.md');
```

### Document-Specific Operations
```typescript
phaseManager.reportDocumentOperation('creating', 'API.md', 50);
```

### Completing a Phase
```typescript
phaseManager.completePhase();
```

---

## Command-Specific Phases

All commands use the same 9-phase system:

### `documentor generate`
- Full 9-phase process
- Emphasis on Analysis (phase 3) and Generation (phase 5)

### `documentor self-document`
- Full 9-phase process
- Additional self-analysis in phase 3
- Saves only to obsidian_vault/docs/

### `documentor full-monty`
- Extended 9-phase process
- Multiple iterations through phases 3-6
- Comprehensive analysis and generation

### `documentor monitor`
- Continuous phase cycling
- Emphasis on Analysis (phase 3) and Integration (phase 8)
- Real-time updates

---

## Error Handling

Each phase has error recovery:
- Retry logic for transient failures
- Graceful degradation for non-critical errors
- Lock file updates on interruption
- Resume capability from last checkpoint