# DocuMentor V3.1 Implementation Roadmap

## Overview
Transform DocuMentor from its current fragmented state to a clean, modular V3.1 architecture with secure password handling and professional CLI experience.

## Current State → Target State

### From (Current Issues):
- 60% code redundancy across 20+ files
- 4 separate phase tracking systems
- No single source of truth
- Files generated in wrong locations
- TUI displaying incorrect information
- Test code in production

### To (V3.1 Goals):
- ~4000 lines of clean, maintainable code
- Single DocumentEngine orchestrator
- Unified progress tracking
- Secure password handling via existing Go TUI
- Professional CLI with multiple display modes
- Proper file generation to obsidian_vault only

## Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal**: Core engine and secure file operations

#### Day 1-2: DocumentEngine Core
```typescript
src/core/
├── DocumentEngine.ts      (600 lines)
├── Config.ts              (200 lines)
└── types.ts               (100 lines)
```
- [ ] Create DocumentEngine with 9-phase flow
- [ ] Implement Config loader with defaults
- [ ] Define all TypeScript interfaces
- [ ] Setup proper error handling

#### Day 3-4: Secure File Operations
```typescript
src/core/
├── PasswordBridge.ts      (300 lines)
├── SecureFileOps.ts       (400 lines)
└── permissions.ts         (100 lines)
```
- [ ] Implement PasswordBridge to connect with Go TUI
- [ ] Create SecureFileOps with graceful permission handling
- [ ] Test password request/response flow
- [ ] Ensure no password storage/logging

#### Day 5: Progress Tracking & Lock Files
```typescript
src/core/
├── ProgressTracker.ts     (300 lines)
├── TUIBridge.ts          (200 lines)
└── LockFileManager.ts     (400 lines)
```
- [ ] Single source of truth for all progress
- [ ] Clean JSON messages to Go TUI
- [ ] Remove all redundant tracking systems
- [ ] Implement robust lock file system:
  - Create `.documentor.lock` in target directory
  - Track PID, start time, last update, status
  - Auto-update every 5 seconds (heartbeat)
  - Handle ALL termination scenarios (SIGINT, SIGTERM, crash)
  - Support resume from interrupted sessions
  - Prevent duplicate documentation runs
  - Clean stale locks (>30 seconds without update)

### Phase 2: Analysis & Generation (Week 2)
**Goal**: Project analysis and documentation generation

#### Day 6-7: Project Analyzer with Type Detection
```typescript
src/core/
├── ProjectAnalyzer.ts     (500 lines)
├── FileScanner.ts         (200 lines)
├── ProjectDetector.ts     (300 lines)
└── ProjectTypes.ts        (150 lines)
```
- [ ] Integrate SecureFileOps for permission handling
- [ ] Implement intelligent project type detection:
  - **Monorepo**: Detect lerna.json, pnpm-workspace.yaml, yarn workspaces
  - **Library/Tools**: Multiple entry points, separate tool directories
  - **Application**: Single main entry, unified structure
  - **Documentation**: Markdown-heavy, docs/ folder present
  - **Mixed**: Combination of above
- [ ] Create file filtering logic
- [ ] Generate project statistics
- [ ] Adapt documentation structure based on type:
  ```
  # For Monorepo:
  docs/monorepo-name/
  ├── README.md (overview)
  ├── packages/
  │   ├── package-a/
  │   │   ├── README.md
  │   │   └── API.md
  │   └── package-b/
  │       ├── README.md
  │       └── API.md
  
  # For Library/Tools:
  docs/library-name/
  ├── README.md (overview)
  ├── tools/
  │   ├── tool-1/
  │   │   ├── README.md
  │   │   ├── API.md
  │   │   └── USAGE.md
  │   └── tool-2/
  │       ├── README.md
  │       └── USAGE.md
  ```

#### Day 8-9: Claude Integration
```typescript
src/core/
├── ClaudeClient.ts        (400 lines)
└── ClaudePrompts.ts       (200 lines)
```
- [ ] Single Claude client (remove duplicates)
- [ ] Block TodoWrite/Task tools
- [ ] Handle permission errors from Claude
- [ ] Implement retry logic

#### Day 10: Documentation Generator with Obsidian
```typescript
src/core/
├── DocGenerator.ts          (400 lines)
├── ObsidianIntegration.ts   (600 lines)
├── ObsidianTagOptimizer.ts  (400 lines)
├── ObsidianBacklinks.ts     (300 lines)
├── ObsidianVerifier.ts      (300 lines)
├── templates/
│   ├── obsidian/
│   │   ├── base.md.hbs
│   │   ├── api.md.hbs
│   │   ├── architecture.md.hbs
│   │   ├── component.md.hbs
│   │   └── moc.md.hbs
│   └── standard/
│       ├── README.ts
│       └── API.ts
└── Formatter.ts             (200 lines)
```
- [ ] Create Obsidian-specific template system
- [ ] Implement frontmatter generation (15+ fields)
- [ ] Add backlink insertion engine
- [ ] Create tag optimization pipeline
- [ ] Build MOC (Map of Content) generator
- [ ] Add verification system for completeness
- [ ] See: [OBSIDIAN_INTEGRATION.md](./OBSIDIAN_INTEGRATION.md)

### Phase 3: CLI & Commands (Week 3)
**Goal**: User-facing CLI with all commands

#### Day 11-12: CLI Framework with Special Commands
```typescript
src/cli/
├── index.ts               (200 lines)
├── commands/
│   ├── generate.ts        (150 lines)
│   ├── analyze.ts         (100 lines)
│   ├── watch.ts           (150 lines)
│   ├── update.ts          (100 lines)
│   ├── verify.ts          (100 lines)
│   ├── config.ts          (150 lines)
│   ├── list.ts            (50 lines)
│   ├── self-document.ts   (100 lines)
│   └── github-watch.ts    (200 lines)
└── utils.ts               (100 lines)
```
- [ ] Implement all core commands
- [ ] Add `self-document` command:
  ```bash
  documentor self-document
  # Generates documentation for DocuMentor itself
  # Saves to configured output path
  ```
- [ ] Add `github-watch` command:
  ```bash
  documentor github-watch [repo-url]
  # Monitor GitHub repo for changes
  # Auto-generate docs on commits/PRs
  # Support webhooks and polling
  ```
- [ ] Add proper argument parsing
- [ ] Create help system
- [ ] Handle display modes

#### Day 13: File Writer & Output with Config
```typescript
src/core/
├── FileWriter.ts          (300 lines)
├── OutputManager.ts       (200 lines)
└── ConfigManager.ts       (250 lines)
```
- [ ] Read output path from config file:
  ```json
  {
    "output": {
      "path": "~/obsidian_vault/docs",  // Or custom path
      "format": "obsidian"
    }
  }
  ```
- [ ] Never write to project directory (except .documentor.lock)
- [ ] Implement different format writers
- [ ] Add verification step
- [ ] Support path expansion (~, env vars)

#### Day 14-15: Testing & Polish
- [ ] Integration tests for full flow
- [ ] Test permission handling scenarios
- [ ] Verify TUI display accuracy
- [ ] Documentation and examples

## Migration Strategy

### Step 1: Preserve Reference
```bash
# Already done - old code in .reference/
.reference/
└── [20 TypeScript files archived]
```

### Step 2: Clean Start
```bash
# Remove old fragmented code
rm -rf src/*.ts  # Keep only tui/ folder
```

### Step 3: Build New Structure
```bash
src/
├── core/           # Core engine (Week 1-2)
├── cli/            # CLI commands (Week 3)
├── tui/            # Keep existing Go TUI
└── index.ts        # Entry point
```

## Testing Checkpoints

### Week 1 Checkpoint
- [ ] Can request password via TUI modal
- [ ] Password is never stored/logged
- [ ] Can read files with permission handling
- [ ] Progress updates show in TUI

### Week 2 Checkpoint
- [ ] Can analyze full project
- [ ] Claude integration works without TodoWrite
- [ ] Documents generate correctly
- [ ] All 9 phases report properly

### Week 3 Checkpoint
- [ ] All 7 commands functional
- [ ] Files save ONLY to obsidian_vault
- [ ] Display modes work (normal/raw/debug)
- [ ] Lock file prevents duplicate runs

## Critical Success Criteria

### Must Have (Week 1)
- ✅ Secure password handling
- ✅ Single source of truth
- ✅ Proper TUI communication
- ✅ No test code in production

### Should Have (Week 2)
- ✅ All 9 phases working
- ✅ Claude integration clean
- ✅ Permission errors handled gracefully
- ✅ Project analysis complete

### Nice to Have (Week 3)
- ✅ All CLI commands
- ✅ Multiple display modes
- ✅ Watch mode
- ✅ Configuration management

## File Count Comparison

### Current (Fragmented)
- 20+ TypeScript files
- ~12,000 lines of code
- 60% redundancy
- No clear organization

### Target (V3.1)
- 15-20 clean files
- ~4,000 lines of code
- 0% redundancy
- Clear module boundaries

## Risk Mitigation

### Risk 1: Go TUI Integration
**Mitigation**: Keep existing TUI, only fix message format

### Risk 2: Password Security
**Mitigation**: Never store, immediate memory clear, transient only

### Risk 3: Claude Permission Errors
**Mitigation**: Use --dangerously-skip-permissions, handle our side

### Risk 4: File Generation Location
**Mitigation**: Hard-code obsidian_vault path, never use project dir

## Daily Checklist

### Every Day:
- [ ] Test TUI displays correct info
- [ ] Verify no passwords in logs
- [ ] Check files save to correct location
- [ ] Ensure no test code remains
- [ ] Update progress in lock file

## Quick Wins (Do First)

1. **Fix TUI Display** (1 hour)
   - Correct phase count (9 not 7)
   - Show real PID from lock file
   - Display actual file counts

2. **Remove Test Code** (30 mins)
   - Delete password modal tests
   - Remove any debug outputs
   - Clean up console.logs

3. **Block Bad Tools** (30 mins)
   - Prevent TodoWrite access
   - Block Task tool
   - Filter tool list properly

4. **Fix Output Path** (1 hour)
   - Hard-code obsidian_vault
   - Never write to project
   - Verify all save operations

## Command Priority

### Phase 1 (Core Commands)
1. `documentor generate` - Main functionality
2. `documentor config` - Configuration setup
3. `documentor self-document` - Document DocuMentor itself

### Phase 2 (Enhanced Commands)  
4. `documentor analyze` - Analysis only
5. `documentor update` - Incremental updates
6. `documentor github-watch` - GitHub repository monitoring

### Phase 3 (Advanced Commands)
7. `documentor watch` - Local file monitoring
8. `documentor verify` - Quality checks
9. `documentor list` - Documentation tracking

## Special Features Implementation

### Self-Documentation (`documentor self-document`)
```typescript
// src/cli/commands/self-document.ts
export class SelfDocumentCommand {
  async execute(): Promise<void> {
    // 1. Analyze DocuMentor's own codebase
    const docPath = path.resolve(__dirname, '../../../');
    
    // 2. Generate comprehensive docs
    const docs = await this.generateSelfDocs({
      architecture: true,
      commands: true,
      api: true,
      configuration: true
    });
    
    // 3. Save to configured output
    const outputPath = config.output.path || '~/obsidian_vault/docs';
    await this.saveDocs(path.join(outputPath, 'documentor-self'), docs);
  }
}
```

### GitHub Watch Mode (`documentor github-watch`)
```typescript
// src/cli/commands/github-watch.ts
export class GitHubWatchCommand {
  private pollInterval: number = 300000; // 5 minutes
  private webhookPort: number = 8088;
  
  async execute(repoUrl: string, options: WatchOptions): Promise<void> {
    // Mode 1: Webhook-based (preferred)
    if (options.webhook) {
      await this.setupWebhookListener(repoUrl);
    }
    
    // Mode 2: Polling-based (fallback)
    else {
      await this.startPolling(repoUrl);
    }
  }
  
  private async setupWebhookListener(repoUrl: string): Promise<void> {
    // 1. Start local webhook server
    const server = express();
    server.post('/github-webhook', async (req, res) => {
      const event = req.headers['x-github-event'];
      
      if (event === 'push' || event === 'pull_request') {
        // 2. Clone/pull latest changes
        await this.syncRepository(repoUrl);
        
        // 3. Generate documentation
        await this.generateDocs();
        
        // 4. Optional: Comment on PR with doc link
        if (event === 'pull_request') {
          await this.commentOnPR(req.body);
        }
      }
    });
    
    server.listen(this.webhookPort);
  }
  
  private async startPolling(repoUrl: string): Promise<void> {
    setInterval(async () => {
      // 1. Check for new commits
      const hasChanges = await this.checkForChanges(repoUrl);
      
      if (hasChanges) {
        // 2. Pull changes
        await this.syncRepository(repoUrl);
        
        // 3. Generate documentation
        await this.generateDocs();
      }
    }, this.pollInterval);
  }
}
```

## The 9 Phases of Documentation

1. **Analysis** - Scan project, detect type, collect files
2. **Generation** - Create initial documentation
3. **Enhancement** - Claude AI enhancement
4. **Formatting** - Apply templates and structure
5. **Obsidian Integration** - Add frontmatter, structure
6. **Tag Optimization** - Consolidate and hierarchize tags
7. **Backlink Generation** - Create cross-references
8. **Verification** - Validate completeness
9. **Save** - Write to configured output

## Success Metrics

### Week 1 Success:
- Password prompt works without storage ✓
- TUI shows correct information ✓
- Files handle permissions gracefully ✓
- Lock file system prevents duplicates ✓

### Week 2 Success:
- Full project analysis completes ✓
- Claude generates documentation ✓
- All 9 phases execute properly ✓
- Obsidian integration complete ✓

### Week 3 Success:
- All commands operational ✓
- Multiple display modes work ✓
- GitHub watch mode functional ✓
- Production ready for use ✓

## Lock File System Details

### Lock File Structure (`.documentor.lock`)
```json
{
  "pid": 12345,
  "startTime": "2024-01-01 10:00:00",
  "lastUpdate": "2024-01-01 10:05:23",
  "status": "running",
  "currentPhase": "Generation",
  "completedTasks": ["analysis", "project-detection"],
  "progress": 45,
  "projectPath": "/path/to/project",
  "outputPath": "~/obsidian_vault/docs/project-name",
  "error": null
}
```

### Lock File States
- **running**: Active documentation in progress
- **interrupted**: Process killed/crashed (can resume)
- **completed**: Successfully finished
- **failed**: Error occurred (shows error message)

### Lock File Operations
```typescript
// src/core/LockFileManager.ts
export class LockFileManager {
  async checkAndCreate(): Promise<boolean> {
    // 1. Check for existing lock
    const existing = await this.checkLock();
    
    if (existing.isLocked && existing.isAlive) {
      // Another instance running
      console.log('Documentation already in progress!');
      console.log(`PID: ${existing.pid}, Phase: ${existing.currentPhase}`);
      return false;
    }
    
    if (existing.canResume) {
      // Previous run interrupted
      const resume = await this.promptResume(existing);
      if (resume) {
        return this.resumeFromLock(existing);
      }
    }
    
    // 2. Create new lock
    await this.createLock();
    
    // 3. Setup cleanup handlers
    this.setupCleanupHandlers();
    
    // 4. Start heartbeat
    this.startHeartbeat();
    
    return true;
  }
  
  private setupCleanupHandlers(): void {
    // Handle ALL termination scenarios
    ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGUSR1', 'SIGUSR2'].forEach(signal => {
      process.on(signal, () => this.handleTermination(signal));
    });
    
    // Handle crashes
    process.on('uncaughtException', (error) => {
      this.updateLockSync({ status: 'failed', error: error.message });
    });
    
    // Handle exit
    process.on('exit', (code) => {
      if (code !== 0) {
        this.updateLockSync({ status: 'interrupted' });
      }
    });
  }
}
```

## Notes for Implementation

### DO:
- Keep it simple (4000 lines max)
- Use existing Go TUI modal
- Save ONLY to obsidian_vault
- Handle permissions gracefully
- Report accurate progress

### DON'T:
- Create new password systems
- Use dependency injection
- Add event buses
- Store passwords anywhere
- Write to project directory

## Next Immediate Steps

1. Start with `DocumentEngine.ts` core
2. Implement `PasswordBridge.ts` for TUI connection
3. Create `SecureFileOps.ts` with permission handling
4. Test password flow end-to-end
5. Begin migration from old to new

---

*This roadmap provides a clear 3-week path from current chaos to clean V3.1 implementation.*