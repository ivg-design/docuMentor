# Agent 1: Foundation & Core Structure

## Mission
Establish the core V3.1 architecture with clean, simple, direct implementation (~1200 lines total).

## Prerequisites
- Review DOCUMENTOR_V3.1_COMPLETE.md thoroughly
- Understand the 9-phase flow
- Keep existing Go TUI in src/tui/ untouched

## Todo List

### 1. Clean & Prepare Structure
- [ ] Move all existing TypeScript files from src/ to .reference/ (except src/tui/)
- [ ] Create new directory structure:
  ```
  src/
  ├── core/           # Core engine and components
  ├── cli/            # CLI commands
  ├── types/          # TypeScript interfaces
  ├── utils/          # Utilities
  ├── tui/            # KEEP EXISTING Go TUI
  └── index.ts        # Entry point
  ```

### 2. Create Core Types (`src/types/index.ts`)
- [ ] Define Config interface (simple, flat)
- [ ] Define ProjectAnalysis interface
- [ ] Define Document interface
- [ ] Define PhaseInfo, TaskInfo, FileInfo
- [ ] Define LockFileData interface
- [ ] Keep it under 200 lines total

### 3. Implement DocumentEngine (`src/core/DocumentEngine.ts`)
- [ ] Create main class (~600 lines)
- [ ] Implement constructor with direct instantiation (NO DI)
- [ ] Add all 9 phases in generate() method:
  1. Analysis
  2. Generation
  3. Enhancement
  4. Formatting
  5. Obsidian Integration
  6. Tag Optimization
  7. Backlink Generation
  8. Verification
  9. Save
- [ ] Integrate with LockFileManager
- [ ] Add proper error handling
- [ ] Connect to ProgressTracker

### 4. Create TUIBridge (`src/core/TUIBridge.ts`)
- [ ] Simple JSON message passing (~200 lines)
- [ ] Methods: updatePhase(), updateTask(), updateFile(), log()
- [ ] Send to stdout for Go TUI consumption
- [ ] Format messages correctly for existing TUI

### 5. Implement ConfigLoader (`src/core/Config.ts`)
- [ ] Load from .documentor/config.json
- [ ] Use sensible defaults
- [ ] Support environment variables
- [ ] Path expansion for output directory
- [ ] ~200 lines maximum

### 6. Create ProgressTracker (`src/core/ProgressTracker.ts`)
- [ ] Single source of truth for progress
- [ ] Track phase, task, file progress
- [ ] Connect to TUIBridge
- [ ] ~300 lines

## Critical Rules
- NO dependency injection
- NO event buses  
- NO complex abstractions
- Direct function calls only
- Keep it SIMPLE
- Total: ~1200 lines for foundation

## Testing Checklist
- [ ] DocumentEngine instantiates correctly
- [ ] All 9 phases execute in order
- [ ] Progress updates reach TUI
- [ ] Config loads properly
- [ ] Error handling works

## Files to Create
1. `src/types/index.ts`
2. `src/core/DocumentEngine.ts`
3. `src/core/TUIBridge.ts`
4. `src/core/Config.ts`
5. `src/core/ProgressTracker.ts`