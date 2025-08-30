# Agent 5: CLI Integration & Final Assembly

## Mission
Create CLI commands and integrate all components into working system (~1000 lines total).

## Prerequisites
- All other agents' work completed
- Review USER_API.md for commands
- Understand display modes
- Output path configuration

## Todo List

### 1. Create CLI Entry Point (`src/index.ts`)
- [ ] Setup commander.js for CLI (~100 lines)
- [ ] Register all commands
- [ ] Handle global options
- [ ] Setup error handling
- [ ] Display version info

### 2. Implement Core Commands

#### `generate` Command (`src/cli/commands/generate.ts`)
- [ ] Main documentation command (~150 lines)
- [ ] Options:
  - `--output, -o`: Output directory
  - `--format, -f`: Output format (obsidian|markdown)
  - `--verbose, -v`: Detailed progress
  - `--no-permission`: Skip password prompts
  - `--display`: Mode (normal|raw|debug|quiet)
- [ ] Instantiate DocumentEngine
- [ ] Run 9-phase generation
- [ ] Handle errors gracefully

#### `self-document` Command (`src/cli/commands/self-document.ts`)
- [ ] Document DocuMentor itself (~100 lines)
- [ ] Use own codebase as input
- [ ] Save to configured output/documentor-self/
- [ ] Special handling for meta-documentation

#### `github-watch` Command (`src/cli/commands/github-watch.ts`)
- [ ] Monitor GitHub repositories (~200 lines)
- [ ] Webhook mode (--webhook --port 8088)
- [ ] Polling mode (--poll --interval 5m)
- [ ] Auto-generate on changes
- [ ] Optional PR comments

#### `watch` Command (`src/cli/commands/watch.ts`)
- [ ] Local file monitoring (~150 lines)
- [ ] Use chokidar for file watching
- [ ] Debounce changes
- [ ] Incremental updates
- [ ] Include/exclude patterns

#### `analyze` Command (`src/cli/commands/analyze.ts`)
- [ ] Analysis without generation (~100 lines)
- [ ] Focus options (architecture|dependencies|security)
- [ ] Output analysis results
- [ ] JSON or readable format

#### `verify` Command (`src/cli/commands/verify.ts`)
- [ ] Check documentation quality (~100 lines)
- [ ] Verification checks
- [ ] Auto-fix option
- [ ] Generate report

#### `config` Command (`src/cli/commands/config.ts`)
- [ ] Configuration management (~150 lines)
- [ ] Subcommands: init, show, set, edit
- [ ] Create .documentor/config.json
- [ ] Set output paths
- [ ] Configure options

### 3. Create FileWriter (`src/core/FileWriter.ts`)
- [ ] Write to configured output ONLY (~300 lines)
- [ ] NEVER write to project directory (except .documentor.lock)
- [ ] Path expansion (~, env vars)
- [ ] Create directory structure
- [ ] Handle different formats
- [ ] Verify writes

### 4. Implement Display Modes (`src/cli/display.ts`)
- [ ] Normal mode (colored, progress bars)
- [ ] Raw mode (for piping)
- [ ] Debug mode (JSON output)
- [ ] Quiet mode (minimal)
- [ ] Auto-detect TTY for interactive

### 5. Binary Compilation & Packaging
- [ ] Install pkg package for binary compilation
- [ ] Configure pkg in package.json
- [ ] Create build script for multi-platform binaries
- [ ] Bundle TypeScript compiled code
- [ ] Include Go TUI binary
- [ ] Package assets (templates, configs)
- [ ] Test standalone binaries on:
  - Linux x64
  - macOS x64 (Intel and Apple Silicon)
  - Windows x64
- [ ] Create distribution script

### 6. Integration Testing
- [ ] Create test script
- [ ] Test all commands
- [ ] Verify 9 phases work
- [ ] Check TUI updates
- [ ] Test lock files
- [ ] Verify output paths
- [ ] Test compiled binaries

### 6. Binary Compilation Setup

#### Install pkg for binary compilation
```json
{
  "devDependencies": {
    "pkg": "^5.8.1"
  }
}
```

#### Configure pkg in package.json
```json
{
  "name": "documentor",
  "version": "3.1.0",
  "bin": {
    "documentor": "./dist/index.js",
    "doc": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "build:binary": "npm run build && npm run pkg",
    "pkg": "pkg dist/index.js --targets node18-linux-x64,node18-macos-x64,node18-win-x64 --output bin/documentor",
    "pkg:linux": "pkg dist/index.js --targets node18-linux-x64 --output bin/documentor-linux",
    "pkg:mac": "pkg dist/index.js --targets node18-macos-x64 --output bin/documentor-macos",
    "pkg:win": "pkg dist/index.js --targets node18-win-x64 --output bin/documentor-win.exe",
    "dev": "ts-node src/index.ts",
    "test": "jest"
  },
  "pkg": {
    "scripts": "dist/**/*.js",
    "assets": [
      "src/tui/**/*",
      "templates/**/*",
      ".documentor/config.default.json"
    ],
    "outputPath": "bin"
  }
}
```

#### Create build script (`scripts/build-binary.sh`)
```bash
#!/bin/bash
echo "Building DocuMentor v3.1 binaries..."

# Clean previous builds
rm -rf dist/ bin/

# Build TypeScript
echo "Compiling TypeScript..."
npm run build

# Build Go TUI binary
echo "Building Go TUI..."
cd src/tui
go build -o ../../dist/tui/documentor-tui
cd ../..

# Package binaries
echo "Creating standalone executables..."
npm run pkg

# Make executable
chmod +x bin/documentor-*

echo "Binaries created in bin/ directory:"
ls -la bin/

echo "Done! Binaries ready for distribution."
```

### 7. Configuration File Template
Create default `.documentor/config.json`:
```json
{
  "version": "3.1.0",
  "output": {
    "path": "~/obsidian_vault/docs",
    "format": "obsidian"
  },
  "permissions": {
    "requestPassword": true,
    "skipOnDenial": true
  },
  "claude": {
    "model": "claude-3-opus",
    "maxTokens": 100000
  }
}
```

## Display Examples

### Normal Mode:
```
DocuMentor v3.1.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 Project: my-project
📍 Output:  ~/obsidian_vault/docs/my-project

[3/9] Enhancement
  ✓ Analyzing with Claude AI
  → Generating API documentation...
  
Progress: ████████████░░░░░░░░ 60%
```

### Raw Mode:
```
PHASE:3:9:Enhancement
TASK:API_GENERATION
PROGRESS:60
```

## Critical Integration Points
1. DocumentEngine coordinates all components
2. Lock file prevents duplicates
3. Progress updates reach TUI
4. Output ONLY to configured path
5. All 9 phases execute properly
6. Commands work independently

## Testing Checklist
- [ ] `documentor generate ./test-project` works
- [ ] TUI shows correct progress (9 phases)
- [ ] Lock file created and updated
- [ ] Files saved to obsidian_vault ONLY
- [ ] Password prompt appears when needed
- [ ] Project type detected correctly
- [ ] Tags optimized by AI
- [ ] Backlinks generated
- [ ] All commands functional

## Files to Create
1. `src/index.ts`
2. `src/cli/commands/generate.ts`
3. `src/cli/commands/self-document.ts`
4. `src/cli/commands/github-watch.ts`
5. `src/cli/commands/watch.ts`
6. `src/cli/commands/analyze.ts`
7. `src/cli/commands/verify.ts`
8. `src/cli/commands/config.ts`
9. `src/cli/display.ts`
10. `src/core/FileWriter.ts`