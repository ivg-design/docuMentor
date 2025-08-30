# DocuMentor V3.1 - Complete Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [Core Architecture](#core-architecture)
3. [User API & Commands](#user-api--commands)
4. [Obsidian Integration](#obsidian-integration)
5. [Security & Permissions](#security--permissions)
6. [Implementation Roadmap](#implementation-roadmap)
7. [The 9 Phases](#the-9-phases)
8. [Special Features](#special-features)

---

## Overview

DocuMentor V3.1 is a complete redesign addressing critical issues:
- **From**: 60% code redundancy, 12,000+ lines, no single source of truth
- **To**: Clean 4,000 lines, modular architecture, professional Obsidian integration

### Core Principles
1. **SIMPLE** - No unnecessary abstractions, direct function calls
2. **SECURE** - Transient password handling, no storage
3. **MODULAR** - Clean separation of concerns
4. **PRACTICAL** - Solves real problems without overengineering
5. **OBSIDIAN-FIRST** - Every document optimized for Obsidian

---

## Core Architecture

### System Overview
```
documentor CLI
     │
     ▼
DocumentEngine ─────┬──→ ProjectAnalyzer (with SecureFileOps)
     │              ├──→ ClaudeClient (with permission handling)
     │              ├──→ DocGenerator  
     │              ├──→ ObsidianIntegration
     │              └──→ FileWriter
     │
     ├──→ PasswordBridge ←──→ Go TUI (existing password modal)
     ├──→ LockFileManager (prevent duplicates, resume support)
     └──→ ProgressTracker ──→ TUIBridge ──→ Go TUI
```

### Core Components (~4000 lines total)

#### 1. DocumentEngine.ts (~600 lines)
```typescript
export class DocumentEngine {
  private analyzer: ProjectAnalyzer
  private claude: ClaudeClient
  private generator: DocGenerator
  private obsidian: ObsidianIntegration
  private progress: ProgressTracker
  private passwordBridge: PasswordBridge
  private lockFile: LockFileManager
  
  constructor(config: Config) {
    this.passwordBridge = new PasswordBridge()
    this.lockFile = new LockFileManager(config.projectPath)
    this.analyzer = new ProjectAnalyzer(config, this.passwordBridge)
    this.claude = new ClaudeClient(config, this.passwordBridge)
    this.generator = new DocGenerator(config)
    this.obsidian = new ObsidianIntegration(config)
    this.progress = new ProgressTracker()
  }
  
  async generate(projectPath: string): Promise<void> {
    // Check lock file
    if (!await this.lockFile.checkAndCreate()) {
      console.log('Documentation already in progress!')
      return
    }
    
    try {
      // Phase 1: Analysis
      this.progress.startPhase('Analysis', 1, 9)
      const project = await this.analyzer.analyze(projectPath)
      
      // Phase 2: Generation
      this.progress.startPhase('Generation', 2, 9)
      const docs = await this.generator.generate(project)
      
      // Phase 3: Enhancement
      this.progress.startPhase('Enhancement', 3, 9)
      const enhanced = await this.claude.enhance(docs)
      
      // Phase 4: Formatting
      this.progress.startPhase('Formatting', 4, 9)
      const formatted = await this.generator.format(enhanced)
      
      // Phase 5: Obsidian Integration
      this.progress.startPhase('Obsidian Integration', 5, 9)
      const obsidianDocs = await this.obsidian.process(formatted)
      
      // Phase 6: Tag Optimization
      this.progress.startPhase('Tag Optimization', 6, 9)
      await this.obsidian.optimizeTags(obsidianDocs)
      
      // Phase 7: Backlink Generation
      this.progress.startPhase('Backlink Generation', 7, 9)
      await this.obsidian.generateBacklinks(obsidianDocs)
      
      // Phase 8: Verification
      this.progress.startPhase('Verification', 8, 9)
      await this.obsidian.verify(obsidianDocs)
      
      // Phase 9: Save
      this.progress.startPhase('Save', 9, 9)
      await this.writer.save(obsidianDocs)
      
      await this.lockFile.completeLock()
    } catch (error) {
      await this.lockFile.failLock(error.message)
      this.handleError(error)
    }
  }
}
```

#### 2. ProjectAnalyzer.ts with Type Detection (~500 lines)
```typescript
export class ProjectAnalyzer {
  private secureOps: SecureFileOps
  private detector: ProjectTypeDetector
  
  async analyze(projectPath: string): Promise<ProjectAnalysis> {
    // Detect project type
    const projectType = await this.detector.detect(projectPath)
    
    // Adapt structure based on type
    switch(projectType) {
      case 'monorepo':
        return this.analyzeMonorepo(projectPath)
      case 'library':
        return this.analyzeLibrary(projectPath)
      case 'tools':
        return this.analyzeToolsCollection(projectPath)
      default:
        return this.analyzeStandard(projectPath)
    }
  }
  
  private async analyzeMonorepo(path: string): Promise<ProjectAnalysis> {
    // Special handling for monorepos
    // Creates nested documentation structure:
    // docs/monorepo-name/
    // ├── README.md (overview)
    // ├── packages/
    // │   ├── package-a/
    // │   └── package-b/
  }
}

export class ProjectTypeDetector {
  async detect(projectPath: string): Promise<ProjectType> {
    // Check for monorepo indicators
    if (await this.exists('lerna.json') || 
        await this.exists('pnpm-workspace.yaml') ||
        await this.hasYarnWorkspaces()) {
      return 'monorepo'
    }
    
    // Check for library/tools collection
    if (await this.hasMultipleEntryPoints() || 
        await this.hasToolsDirectory()) {
      return 'library'
    }
    
    return 'application'
  }
}
```

---

## User API & Commands

### Installation
```bash
npm install -g documentor
# Or use directly
npx documentor generate ./my-project
```

### Core Commands

#### 1. `documentor generate` - Main Documentation
```bash
# Basic usage - uses config for output path
documentor generate /path/to/project

# With options
documentor generate ./my-project \
  --output ~/my-docs \
  --format obsidian \
  --verbose \
  --no-permission

# Short form
doc gen ./my-project
```

#### 2. `documentor self-document` - Document DocuMentor
```bash
documentor self-document
# Generates documentation for DocuMentor itself
# Saves to configured output path
```

#### 3. `documentor github-watch` - Monitor GitHub
```bash
# Webhook mode (preferred)
documentor github-watch https://github.com/user/repo --webhook --port 8088

# Polling mode (fallback)
documentor github-watch https://github.com/user/repo --poll --interval 5m
```

#### 4. `documentor watch` - Live Local Monitoring
```bash
# Watch for changes and regenerate
documentor watch ./my-project

# With specific patterns
documentor watch ./my-project --include "src/**/*.ts" --exclude "test/**"
```

#### 5. `documentor analyze` - Analysis Only
```bash
# Analyze without generating
documentor analyze ./my-project --focus architecture
```

#### 6. `documentor verify` - Check Documentation
```bash
# Verify documentation quality
documentor verify ./my-project --check all --fix
```

#### 7. `documentor config` - Configuration
```bash
# Initialize config
documentor config init

# Set values
documentor config set output.path ~/obsidian_vault/docs
```

### Display Modes

#### Normal Mode (Default)
```
DocuMentor v3.1.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 Project: my-awesome-project
📍 Output:  ~/obsidian_vault/docs/my-awesome-project

[3/9] Enhancement
  ✓ Analyzing with Claude AI
  → Generating API documentation...
  
Progress: ████████████░░░░░░░░ 60%
Files: 93/156 | Time: 00:02:34
```

#### Raw Mode (`--display raw`)
```
PHASE:ENHANCEMENT
TASK:API_GENERATION
FILES_PROCESSED:93
FILES_TOTAL:156
PROGRESS:60
```

#### Interactive TUI Mode (Default with TTY)
```
╔════════════════════════════════════════════════════════════════╗
║ DocuMentor v3.1.0 - my-awesome-project                        ║
╠════════════════════════════════════════════════════════════════╣
║ Phase:    3/9 Enhancement                                      ║
║ Task:     2/4 Creating API Documentation                      ║
║ Progress: ████████████░░░░░░░░░░░░░░░░░░ 45%                 ║
╠════════════════════════════════════════════════════════════════╣
║ [10:23:45] 📄 Reading: src/api/users.ts                       ║
║ [10:23:46] 🔍 Analyzing: Class UserController                 ║
║ [10:23:47] ✍️  Writing: API.md                                ║
╠════════════════════════════════════════════════════════════════╣
║ Files: 45/156 | Memory: 125MB | Time: 00:02:34                ║
║ PID: 12345 | Lock: Active | Status: Processing                ║
╚════════════════════════════════════════════════════════════════╝
```

---

## Obsidian Integration

### Mandatory Frontmatter Structure
Every file MUST include:

```yaml
---
# Document Metadata
project: "project-name"
title: "ComponentName API Documentation"
type: "api-reference"  # api-reference|architecture|guide|overview|component
version: "1.0.0" # should reflect the version of the documented project
status: "complete"  # draft|in-progress|complete|deprecated

# Timestamps LOCAL TIME
created: 2024-01-01T10:00:00Z
modified: 2024-01-01T15:30:00Z

# File Information
source_file: "src/components/Auth.ts"
source_lines: [100, 500]
language: "typescript"
framework: ["react", "nextjs"]

# Relationships
parent: "[[Architecture Overview]]"
children:
  - "[[AuthProvider]]"
  - "[[AuthContext]]"
related:
  - "[[Database Schema]]"
  - "[[API Routes]]"
dependencies:
  - "[[UserModel]]"
  - "[[SessionManager]]"

# Tags (Hierarchical)
tags:
  - "#architecture/authentication"
  - "#component/auth"
  - "#security/jwt"
  - "#api/rest"
  - "#status/production"

# Dataview Properties
complexity: "high"
importance: "critical"
test_coverage: 85
loc: 500
---
```

### Universal Document Requirements

#### 1. Universal Frontmatter (EVERY document)
```yaml
---
# Project Identity
project: "project-name"  # e.g., "documentor", "my-app"
project_tag: "#project/documentor"  # Unique project identifier

# Document Basics
title: "Whatever makes sense for this document"
type: "auto-determined"  # Let AI decide: api|guide|readme|architecture|etc
status: "complete"  # draft|in-progress|complete

# Timestamps (LOCAL TIME)
created: 2024-01-01T10:00:00
modified: 2024-01-01T15:30:00

# Source References (if applicable)
source_files: ["src/file1.ts", "src/file2.ts"]
source_repo: "https://github.com/user/repo"

# Relationships (AI determines these)
related: []  # AI fills with [[Document Links]]
---
```

#### 2. Document Body (AI DECIDES STRUCTURE)
```markdown
# Title

[AI determines the best structure for THIS specific document]
[Could be API reference, could be narrative guide, could be anything]
[Must include backlinks [[Like This]] to other documents]
[Must reference source files when discussing code]

<!-- The AI is FREE to structure content however makes most sense -->
<!-- No forced sections, no required headers -->
<!-- Just good, useful documentation -->
```

#### 3. Universal Footer (EVERY document)
```markdown
---
## Tags
#project/{{project_name}}  <!-- Always include project tag -->
[AI adds relevant hierarchical tags]
[Minimum 3, maximum 10]
[Must be hierarchical: #category/subcategory]

---
Source: `{{source_file}}:{{line_numbers}}` when applicable
Generated: {{timestamp}} by DocuMentor v3.1
```

### Tag Optimization - AI-Driven Review
```typescript
export class ObsidianTagOptimizer {
  private projectTag: string;  // e.g., "#project/documentor"
  private claude: ClaudeClient;
  
  constructor(projectName: string, claude: ClaudeClient) {
    this.projectTag = `#project/${projectName.toLowerCase()}`;
    this.claude = claude;
  }
  
  async optimizeTags(docs: Document[]): Promise<void> {
    // 1. Ensure project tag on everything
    docs.forEach(doc => {
      if (!doc.tags.includes(this.projectTag)) {
        doc.tags.unshift(this.projectTag);
      }
    });
    
    // 2. Have Claude review and optimize ALL tags across project
    const allTags = this.collectAllTags(docs);
    
    const optimizationPrompt = `
    Review these tags from the ${this.projectName} documentation:
    ${JSON.stringify(allTags)}
    
    Tasks:
    1. Identify single-use tags that should be consolidated
    2. Suggest hierarchical replacements (e.g., #auth-jwt → #security/jwt)
    3. Find redundant/similar tags that mean the same thing
    4. Ensure consistency across the project
    5. Keep tags that are useful even if used once (if they're important)
    
    Return a mapping of: { "old_tag": "new_tag" }
    `;
    
    const tagMapping = await this.claude.query(optimizationPrompt);
    
    // 3. Apply Claude's tag optimization decisions
    await this.applyTagMapping(docs, tagMapping);
    
    // 4. Have Claude create a meaningful tag hierarchy document
    const hierarchyPrompt = `
    Create a tag hierarchy document for project "${this.projectName}".
    Explain the tagging system and how to search effectively.
    Make it useful for navigating the documentation.
    `;
    
    const tagHierarchy = await this.claude.query(hierarchyPrompt);
    await this.saveDocument('TAG_HIERARCHY.md', tagHierarchy);
  }
}
```

### Backlink & Cross-Reference System
```typescript
export class ObsidianBacklinkGenerator {
  private projectName: string;
  
  async generateBacklinks(docs: Document[]): Promise<void> {
    docs.forEach(doc => {
      // 1. Link to source files in project
      doc.content = this.linkSourceFiles(doc.content);
      
      // 2. Auto-link to other documents
      doc.content = this.autoLinkDocuments(doc.content, docs);
      
      // 3. Add source references
      doc.content = this.addSourceReferences(doc.content, doc.sourceFiles);
    });
  }
  
  private linkSourceFiles(content: string): string {
    // Transform: "in Auth.ts" → "in `Auth.ts:45`"
    // Transform: "the UserService class" → "the [[UserService]] class"
    // Keep it natural and readable
    return content;
  }
  
  private autoLinkDocuments(content: string, allDocs: Document[]): string {
    // When mentioning another documented component, auto-link it
    // But keep the text natural and readable
    return content;
  }
}
```

### Simple Verification Checklist
Every document MUST have:
- [ ] Project tag (e.g., #project/documentor)
- [ ] Basic frontmatter (project, title, type, timestamps)
- [ ] Minimum 3 hierarchical tags
- [ ] At least some [[backlinks]] to other docs
- [ ] Source file references where applicable
- [ ] Footer with tags and generation info

That's it! The AI decides everything else based on what makes sense for each document.

### Example: AI Freedom in Action

#### For a README.md:
```markdown
---
project: "documentor"
project_tag: "#project/documentor"
title: "DocuMentor - Intelligent Documentation Generator"
type: "readme"
created: 2024-01-01T10:00:00
modified: 2024-01-01T15:30:00
---

# DocuMentor

[AI writes a natural, engaging README with whatever sections make sense]
[Might include: Overview, Installation, Usage, Configuration, etc.]
[Or might be completely different structure]
[Links to [[API Documentation]] and [[Architecture Overview]] naturally]

---
## Tags
#project/documentor
#type/readme
#documentation/generator
#tool/cli
---
Generated: 2024-01-01 by DocuMentor v3.1
```

#### For an API Reference:
```markdown
---
project: "documentor"
project_tag: "#project/documentor"
title: "ClaudeClient API"
type: "api"
source_files: ["src/core/ClaudeClient.ts"]
created: 2024-01-01T10:00:00
modified: 2024-01-01T15:30:00
---

# ClaudeClient API

[AI structures this completely differently - maybe class-based]
[Maybe method-by-method]
[Maybe organized by functionality]
[Whatever makes this API easiest to understand]

Source: `src/core/ClaudeClient.ts:45-350`

---
## Tags
#project/documentor
#type/api
#component/claude
#integration/ai
---
Generated: 2024-01-01 by DocuMentor v3.1
```

The AI has COMPLETE FREEDOM to structure content. Only the universal requirements are enforced.

---

## Security & Permissions

### Password Handling Architecture
```
Permission Error → Check if Critical → Prompt User → Execute with Sudo → Clear Memory
       ↓                   ↓                ↓                 ↓              ↓
   Skip File          Skip File       User Cancels      Success/Fail    Continue
```

### PasswordBridge.ts (~300 lines)
```typescript
export class PasswordBridge extends EventEmitter {
  async requestPassword(
    operation: string,
    path: string
  ): Promise<string | null> {
    // Request from existing Go TUI modal
    this.sendToTUI({
      type: 'password_request',
      requestId: `pwd-${Date.now()}`,
      prompt: `Permission needed for ${operation}`,
      context: path
    })
    
    // Wait for response (30s timeout)
    return new Promise((resolve) => {
      // Handle response or timeout
      // Password used immediately then cleared
    })
  }
  
  async sudoExec(command: string, args: string[], password: string): Promise<boolean> {
    const sudo = spawn('sudo', ['-S', command, ...args])
    sudo.stdin.write(password + '\n')
    sudo.stdin.end()
    password = '' // Clear immediately
    // Return success/failure
  }
}
```

### Security Guarantees
1. **No Password Storage** - Only in memory during use
2. **User Control** - Decide for each request
3. **Graceful Degradation** - Continue without inaccessible files
4. **Minimal Privilege** - No maintained sudo sessions

### Go TUI Password Modal
```
╔════════════════════════════════════════════════════════════════╗
║                     Permission Required                        ║
╠════════════════════════════════════════════════════════════════╣
║ Operation "read file" requires elevated permissions for:       ║
║ /etc/important-config                                         ║
║                                                                ║
║ You can cancel to skip this file.                             ║
║                                                                ║
║ Password: ••••••••••                                          ║
║                                                                ║
║        [Submit]                    [Cancel]                    ║
╚════════════════════════════════════════════════════════════════╝
```

---

## Implementation Roadmap

### Week 1: Foundation
**Day 1-2: DocumentEngine Core**
- Create DocumentEngine with 9-phase flow
- Implement Config loader
- Setup error handling

**Day 3-4: Secure File Operations**
- Implement PasswordBridge
- Create SecureFileOps
- Test password flow

**Day 5: Progress & Lock Files**
- Single source of truth for progress
- Implement LockFileManager
- Handle all termination scenarios

### Week 2: Analysis & Generation
**Day 6-7: Project Analyzer**
- Implement project type detection:
  - Monorepo (lerna, yarn workspaces)
  - Library/Tools (multiple entry points)
  - Application (single entry)
- Adapt documentation structure

**Day 8-9: Claude Integration**
- Single Claude client
- Block TodoWrite/Task tools
- Handle permissions

**Day 10: Obsidian Integration**
- Frontmatter generation
- Template system
- Tag optimizer
- Backlink generator
- Verifier

### Week 3: CLI & Commands
**Day 11-12: CLI Framework**
- All 9 commands
- Self-document command
- GitHub watch mode

**Day 13: Output & Config**
- Read output path from config
- Never write to project directory
- Support path expansion

**Day 14-15: Testing & Polish**
- Integration tests
- Permission scenarios
- Documentation

---

## The 9 Phases

1. **Analysis** - Scan project, detect type, collect files
2. **Generation** - Create initial documentation  
3. **Enhancement** - Claude AI enhancement
4. **Formatting** - Apply templates and structure
5. **Obsidian Integration** - Add frontmatter, structure
6. **Tag Optimization** - Consolidate and hierarchize tags
7. **Backlink Generation** - Create cross-references
8. **Verification** - Validate completeness
9. **Save** - Write to configured output

---

## Special Features

### Lock File System
```json
{
  "pid": 12345,
  "startTime": "2024-01-01 10:00:00",
  "lastUpdate": "2024-01-01 10:05:23",
  "status": "running",
  "currentPhase": "Generation",
  "completedTasks": ["analysis", "project-detection"],
  "progress": 45,
  "error": null
}
```

**Features:**
- Prevents duplicate runs
- Auto-updates every 5 seconds
- Handles ALL termination scenarios
- Supports resume from interruption
- Cleans stale locks

### Self-Documentation
```typescript
export class SelfDocumentCommand {
  async execute(): Promise<void> {
    // Analyzes DocuMentor's own codebase
    // Generates comprehensive documentation
    // Saves to configured output/documentor-self/
  }
}
```

### GitHub Watch Mode
```typescript
export class GitHubWatchCommand {
  // Mode 1: Webhook-based
  async setupWebhookListener(repoUrl: string): Promise<void> {
    // Start local server on port 8088
    // Listen for GitHub push/PR events
    // Auto-generate documentation
    // Optional: Comment on PRs
  }
  
  // Mode 2: Polling-based
  async startPolling(repoUrl: string): Promise<void> {
    // Check for changes every 5 minutes
    // Pull changes and regenerate
  }
}
```

### Project Type Adaptation
```
# Monorepo Structure:
docs/monorepo-name/
├── README.md
├── packages/
│   ├── package-a/
│   └── package-b/

# Library/Tools Structure:
docs/library-name/
├── README.md
├── tools/
│   ├── tool-1/
│   └── tool-2/
```

---

## Configuration

### Main Configuration (`.documentor/config.json`)
```json
{
  "version": "3.1.0",
  "project": {
    "name": "auto-detect",
    "type": "auto"
  },
  "output": {
    "path": "~/obsidian_vault/docs",
    "format": "obsidian",
    "features": {
      "frontmatter": true,
      "backlinks": true,
      "tags": {
        "optimize": true,
        "hierarchy": true,
        "minPerDoc": 3
      },
      "moc": true,
      "dataview": true
    }
  },
  "permissions": {
    "requestPassword": true,
    "skipOnDenial": true,
    "importantPaths": ["src", "lib", "config"]
  },
  "claude": {
    "model": "claude-3-opus",
    "maxTokens": 100000,
    "temperature": 0.3
  },
  "phases": [
    "analysis", "generation", "enhancement", "formatting",
    "obsidian-integration", "tag-optimization", 
    "backlink-generation", "verification", "save"
  ]
}
```

### Environment Variables
```bash
export DOCUMENTOR_OUTPUT="~/obsidian_vault/docs"
export DOCUMENTOR_FORMAT="obsidian"
export DOCUMENTOR_NO_PASSWORD="true"
export DOCUMENTOR_DEBUG="true"
```

---

## Critical Success Criteria

### Must Have
- ✅ Secure password handling without storage
- ✅ Single source of truth for progress
- ✅ Proper TUI communication (9 phases, real PID)
- ✅ Files save ONLY to configured output path
- ✅ Lock file prevents duplicates
- ✅ Complete Obsidian integration

### Should Have
- ✅ All 9 phases working correctly
- ✅ Claude integration without TodoWrite
- ✅ Permission errors handled gracefully
- ✅ Project type detection and adaptation
- ✅ Tag optimization (no single-use)
- ✅ Rich backlink network

### Nice to Have
- ✅ All CLI commands functional
- ✅ Multiple display modes
- ✅ GitHub watch mode
- ✅ Self-documentation
- ✅ Resume from interruption

---

## Benefits of V3.1

| Aspect | Old (V3) | New (V3.1) |
|--------|----------|------------|
| Lines of Code | ~12,000 | ~4,000 |
| Complexity | High (DI, Events) | Low (Direct calls) |
| Password Handling | None | Secure, transient |
| Obsidian Integration | Basic | Complete with frontmatter, tags, backlinks |
| Project Detection | None | Automatic adaptation |
| Lock Files | Broken | Robust with resume |
| Tag Management | None | Optimized hierarchy |
| Cross-References | Manual | Automatic backlinks |

---

## Implementation Notes

### DO:
- Keep it simple (4000 lines max)
- Use existing Go TUI modal for passwords
- Save ONLY to configured output path
- Handle permissions gracefully
- Create rich Obsidian documents
- Optimize tags hierarchically
- Generate extensive backlinks
- Verify document completeness

### DON'T:
- Create new password systems
- Use dependency injection
- Add event buses
- Store passwords anywhere
- Write to project directory (except .documentor.lock)
- Create single-use tags
- Leave documents unconnected
- Skip verification

---

## Next Steps

1. **Immediate**: Start with DocumentEngine.ts core
2. **Day 1**: Implement PasswordBridge for TUI connection
3. **Day 2**: Create SecureFileOps with permission handling
4. **Day 3**: Build ProjectAnalyzer with type detection
5. **Week 1**: Complete foundation with lock files
6. **Week 2**: Full Obsidian integration
7. **Week 3**: CLI commands and polish

---

*This document consolidates all discussions and decisions for DocuMentor V3.1, providing a complete implementation guide from current broken state to production-ready intelligent documentation system with professional Obsidian integration.*