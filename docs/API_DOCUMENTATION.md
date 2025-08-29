# DocuMentor API Documentation

## Overview

DocuMentor is an intelligent documentation generator that analyzes codebases, verifies functionality, and creates Obsidian-compatible documentation with intelligent tagging and cross-referencing.

## Core Components

### 1. DocumentationAgent

The main orchestrator for documentation generation.

**Location:** `src/DocumentationAgent.ts`

#### Interface: `DocConfig`

```typescript
interface DocConfig {
  targetPath: string;          // Path to the codebase to document
  outputPath?: string;         // Output path for documentation (default: Obsidian vault)
  excludePaths?: string[];     // Additional paths to exclude from documentation
  verifyCode?: boolean;        // Enable code functionality verification (default: true)
  includeTests?: boolean;      // Include test files in documentation
  updateExisting?: boolean;    // Update existing documentation instead of overwriting
}
```

#### Class: `DocumentationAgent`

**Constructor:**
```typescript
constructor(config: DocConfig)
```

**Public Methods:**

```typescript
async generateDocumentation(): Promise<void>
```
Generates complete documentation for the target codebase.

**Example Usage:**
```typescript
import { DocumentationAgent } from './DocumentationAgent';

const agent = new DocumentationAgent({
  targetPath: '/path/to/project',
  outputPath: '/path/to/obsidian/vault',
  verifyCode: true,
  excludePaths: ['**/test/**']
});

await agent.generateDocumentation();
```

---

### 2. ConfigManager

Manages DocuMentor configuration with auto-generation and validation.

**Location:** `src/ConfigManager.ts`

#### Interface: `DocumentorConfig`

```typescript
interface DocumentorConfig {
  // Core settings
  defaultTargetPath: string;
  obsidianVaultPath: string;
  excludePaths: string[];
  verifyCode: boolean;
  generateBacklinks: boolean;
  maxTags: number;
  
  // Safety settings
  safetyMode: {
    enabled: boolean;
    backupBeforeWrite: boolean;
    validateJson: boolean;
    maxFileSize: number;        // in MB
    preventOverwrite: boolean;
  };
  
  // GitHub monitoring settings
  github: {
    enabled: boolean;
    accessToken: string;
    username?: string;
    repositories: string[];
    pollInterval: number;        // in minutes
    webhookUrl?: string;
    documentOnCommit: boolean;
    documentOnPR: boolean;
    ignorePatterns: string[];
    scopes: string[];
  };
  
  // Progress monitoring
  monitoring: {
    showProgress: boolean;
    verboseLogging: boolean;
    logFile?: string;
    interruptKey: string;
    autoSave: boolean;
    saveInterval: number;        // in seconds
  };
  
  // Full-monty settings
  fullMonty: {
    analyzeCode: boolean;
    verifyFunctionality: boolean;
    generateDiagrams: boolean;
    createTests: boolean;
    generateChangelog: boolean;
    analyzeSecurity: boolean;
    checkDependencies: boolean;
    generateMetrics: boolean;
  };
  
  // Output settings
  output: {
    format: 'markdown' | 'html' | 'pdf';
    includeTimestamps: boolean;
    includeAuthor: boolean;
    customTemplates?: string;
    theme: string;
  };
  
  // API settings
  api: {
    claudeApiKey?: string;
    maxTokens: number;
    temperature: number;
    model: string;
  };
}
```

#### Class: `ConfigManager`

**Public Methods:**

```typescript
async loadConfig(): Promise<DocumentorConfig>
```
Loads configuration from disk or creates default.

```typescript
async createDefaultConfig(): Promise<DocumentorConfig>
```
Creates and saves default configuration.

```typescript
async updateConfig(config: Partial<DocumentorConfig>): Promise<void>
```
Updates existing configuration.

```typescript
async validateConfig(): Promise<{ valid: boolean; errors: string[] }>
```
Validates current configuration.

```typescript
async getConfig(): Promise<DocumentorConfig>
```
Returns current configuration.

**Example Usage:**
```typescript
import { ConfigManager } from './ConfigManager';

const config = new ConfigManager();

// Load or create config
const settings = await config.loadConfig();

// Update specific setting
await config.updateConfig({
  defaultTargetPath: '/new/path',
  github: { ...settings.github, enabled: true }
});

// Validate configuration
const validation = await config.validateConfig();
if (!validation.valid) {
  console.error('Config errors:', validation.errors);
}
```

---

### 3. FullMontyGeneratorV3

Generates comprehensive documentation with quality metrics.

**Location:** `src/FullMontyGeneratorV3.ts`

#### Interface: `FullMontyReport`

```typescript
interface FullMontyReport {
  targetPath: string;
  timestamp: Date;
  duration: number;
  projectType: 'single' | 'multi-tool' | 'monorepo' | 'collection';
  subProjects: number;
  documentsGenerated: number;
  quality: {
    codeQuality: number;         // 0-100 score
    documentationCoverage: number; // 0-100 score
    testCoverage: number;         // 0-100 score
    securityScore: number;        // 0-100 score
  };
}
```

#### Class: `FullMontyGeneratorV3`

**Constructor:**
```typescript
constructor(verbose: boolean = false)
```

**Public Methods:**

```typescript
async generate(targetPath: string): Promise<FullMontyReport>
```
Generates comprehensive documentation with all features enabled.

**Example Usage:**
```typescript
import { FullMontyGeneratorV3 } from './FullMontyGeneratorV3';

const generator = new FullMontyGeneratorV3(true); // verbose mode
const report = await generator.generate('/path/to/project');

console.log('Documentation Quality:', report.quality);
console.log('Documents Generated:', report.documentsGenerated);
```

---

### 4. ProjectAnalyzer

Analyzes project structure and detects project types.

**Location:** `src/ProjectAnalyzer.ts`

#### Interface: `ProjectStructure`

```typescript
interface ProjectStructure {
  rootPath: string;
  files: string[];
  directories: string[];
  languages: { [key: string]: number };  // Language file counts
  frameworks: string[];
  packageManagers: string[];
  hasTests: boolean;
  testFrameworks: string[];
  entryPoints: string[];
  configFiles: string[];
  dependencies: any;
  devDependencies: any;
  scripts: any;
  workspaceInfo?: any;
  versionControl?: any;
  projectType?: string;
  tools?: any[];
}
```

#### Class: `ProjectAnalyzer`

**Public Methods:**

```typescript
async analyze(targetPath: string): Promise<ProjectStructure>
```
Performs comprehensive project analysis.

**Example Usage:**
```typescript
import { ProjectAnalyzer } from './ProjectAnalyzer';

const analyzer = new ProjectAnalyzer();
const structure = await analyzer.analyze('/path/to/project');

console.log('Languages:', structure.languages);
console.log('Frameworks:', structure.frameworks);
console.log('Is Monorepo:', structure.workspaceInfo !== undefined);
```

---

### 5. SafetyValidator

Validates directories and manages backups for safety.

**Location:** `src/SafetyValidator.ts`

#### Interface: `ValidationResult`

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}
```

#### Class: `SafetyValidator`

**Public Methods:**

```typescript
async validateDirectory(targetPath: string): Promise<ValidationResult>
```
Validates directory for safety before operations.

```typescript
async createBackup(targetPath: string): Promise<string>
```
Creates backup of specified path, returns backup location.

```typescript
async restoreFromBackup(originalPath: string, backupPath: string): Promise<void>
```
Restores files from backup.

```typescript
async cleanupBackups(daysOld: number = 7): Promise<number>
```
Removes old backups, returns count of deleted backups.

```typescript
getSafetyReport(): string
```
Returns formatted safety report.

**Example Usage:**
```typescript
import { SafetyValidator } from './SafetyValidator';

const safety = new SafetyValidator();

// Validate before operations
const validation = await safety.validateDirectory('/sensitive/path');
if (!validation.valid) {
  throw new Error(validation.errors.join(', '));
}

// Create backup
const backupPath = await safety.createBackup('/important/data');
console.log('Backup created:', backupPath);

// Cleanup old backups
const deleted = await safety.cleanupBackups(30);
console.log(`Cleaned up ${deleted} old backups`);
```

---

### 6. GitHubMonitor

Monitors GitHub repositories for changes and auto-documents.

**Location:** `src/GitHubMonitor.ts`

#### Class: `GitHubMonitor`

**Constructor:**
```typescript
constructor(accessToken: string, outputPath: string)
```

**Public Methods:**

```typescript
async addRepository(owner: string, repo: string, branch: string = 'main'): Promise<void>
```
Adds repository to monitoring list.

```typescript
async removeRepository(owner: string, repo: string): Promise<void>
```
Removes repository from monitoring.

```typescript
async startMonitoring(intervalMs: number = 300000): Promise<void>
```
Starts continuous monitoring (default: 5 minutes).

```typescript
stopMonitoring(): void
```
Stops monitoring process.

```typescript
getStatus(): { repositories: any[]; lastCheck: Date; isMonitoring: boolean }
```
Returns current monitoring status.

```typescript
async loadState(): Promise<void>
```
Loads saved monitoring state.

```typescript
async saveState(): Promise<void>
```
Saves current monitoring state.

**Example Usage:**
```typescript
import { GitHubMonitor } from './GitHubMonitor';

const monitor = new GitHubMonitor('github_token', '/obsidian/vault');

// Add repositories
await monitor.addRepository('facebook', 'react');
await monitor.addRepository('microsoft', 'typescript');

// Start monitoring
await monitor.startMonitoring(600000); // 10 minutes

// Check status
const status = monitor.getStatus();
console.log('Monitoring:', status.repositories);

// Stop when done
process.on('SIGINT', () => {
  monitor.stopMonitoring();
  process.exit(0);
});
```

---

### 7. CodeVerifier

Verifies code functionality and generates reports.

**Location:** `src/CodeVerifier.ts`

#### Class: `CodeVerifier`

**Public Methods:**

```typescript
async verifyProject(targetPath: string, projectAnalysis: any): Promise<any>
```
Verifies entire project functionality.

```typescript
async verifyFile(filePath: string): Promise<{ valid: boolean; errors: string[] }>
```
Verifies individual file functionality.

```typescript
generateVerificationReport(): string
```
Generates formatted verification report.

**Example Usage:**
```typescript
import { CodeVerifier } from './CodeVerifier';
import { ProjectAnalyzer } from './ProjectAnalyzer';

const verifier = new CodeVerifier();
const analyzer = new ProjectAnalyzer();

const analysis = await analyzer.analyze('/path/to/project');
const results = await verifier.verifyProject('/path/to/project', analysis);

const report = verifier.generateVerificationReport();
console.log(report);
```

---

### 8. ObsidianFormatter

Formats documentation for Obsidian with proper links and tags.

**Location:** `src/ObsidianFormatter.ts`

#### Class: `ObsidianFormatter`

**Public Methods:**

```typescript
formatDocument(content: string, metadata: any): string
```
Formats content with Obsidian frontmatter and structure.

```typescript
createBacklinks(documents: any[]): string[]
```
Generates backlinks between related documents.

```typescript
formatCodeBlock(code: string, language: string): string
```
Formats code blocks with proper syntax highlighting.

**Example Usage:**
```typescript
import { ObsidianFormatter } from './ObsidianFormatter';

const formatter = new ObsidianFormatter();

const formatted = formatter.formatDocument(
  'Document content here',
  {
    title: 'API Documentation',
    tags: ['api', 'documentation'],
    created: new Date()
  }
);

const codeBlock = formatter.formatCodeBlock(
  'console.log("Hello");',
  'javascript'
);
```

---

### 9. TagManager

Manages Obsidian tags and generates tag indices.

**Location:** `src/TagManager.ts`

#### Class: `TagManager`

**Constructor:**
```typescript
constructor(vaultPath: string)
```

**Public Methods:**

```typescript
async loadExistingTags(): Promise<void>
```
Loads existing tags from vault.

```typescript
async saveTagRegistry(): Promise<void>
```
Saves tag registry to disk.

```typescript
generateTags(content: string, projectType: string): string[]
```
Generates appropriate tags for content.

```typescript
async generateTagIndex(): Promise<string>
```
Creates comprehensive tag index document.

**Example Usage:**
```typescript
import { TagManager } from './TagManager';

const tagManager = new TagManager('/obsidian/vault');

// Load existing tags
await tagManager.loadExistingTags();

// Generate tags for content
const tags = tagManager.generateTags(
  'React component documentation',
  'react'
);

// Create tag index
const index = await tagManager.generateTagIndex();
await fs.writeFile('/obsidian/vault/tag-index.md', index);

// Save registry
await tagManager.saveTagRegistry();
```

---

### 10. SimpleLockFile

Manages lock files for concurrent operation safety.

**Location:** `src/SimpleLockFile.ts`

#### Class: `SimpleLockFile`

**Constructor:**
```typescript
constructor(targetPath: string)
```

**Public Methods:**

```typescript
async acquireLock(): Promise<boolean>
```
Attempts to acquire lock for target path.

```typescript
async releaseLock(): Promise<void>
```
Releases lock for target path.

```typescript
async isLocked(): Promise<boolean>
```
Checks if target is currently locked.

```typescript
async updateLock(data: any): Promise<void>
```
Updates lock file with progress data.

```typescript
async readLock(): Promise<any>
```
Reads current lock data.

#### Helper Function

```typescript
async function withLockCheck<T>(
  targetPath: string,
  operation: (lock: SimpleLockFile, resumeData: any) => Promise<T>
): Promise<T>
```
Executes operation with automatic lock management.

**Example Usage:**
```typescript
import { SimpleLockFile, withLockCheck } from './SimpleLockFile';

// Manual lock management
const lock = new SimpleLockFile('/path/to/project');

if (await lock.acquireLock()) {
  try {
    // Perform operations
    await lock.updateLock({ progress: 50 });
    // More operations
  } finally {
    await lock.releaseLock();
  }
}

// Automatic lock management
const result = await withLockCheck('/path/to/project', async (lock, resumeData) => {
  if (resumeData) {
    console.log('Resuming from:', resumeData.progress);
  }
  
  await lock.updateLock({ progress: 25 });
  // Perform work
  
  return 'completed';
});
```

---

## Error Handling

### Common Error Types

1. **ValidationError**: Thrown when safety validation fails
   ```typescript
   try {
     await agent.generateDocumentation();
   } catch (error) {
     if (error.message.includes('validation')) {
       console.error('Validation failed:', error);
     }
   }
   ```

2. **LockError**: Thrown when unable to acquire lock
   ```typescript
   try {
     await withLockCheck(path, async (lock) => {
       // operations
     });
   } catch (error) {
     if (error.message.includes('locked')) {
       console.error('Resource locked:', error);
     }
   }
   ```

3. **ConfigError**: Thrown for configuration issues
   ```typescript
   try {
     await config.loadConfig();
   } catch (error) {
     if (error.message.includes('config')) {
       console.error('Configuration error:', error);
     }
   }
   ```

### Error Recovery Patterns

#### Backup and Restore
```typescript
const safety = new SafetyValidator();
const backupPath = await safety.createBackup(targetPath);

try {
  await riskyOperation();
} catch (error) {
  console.error('Operation failed, restoring backup');
  await safety.restoreFromBackup(targetPath, backupPath);
  throw error;
}
```

#### Resume After Interrupt
```typescript
await withLockCheck(targetPath, async (lock, resumeData) => {
  const startPoint = resumeData?.lastProcessedFile || 0;
  
  for (let i = startPoint; i < files.length; i++) {
    await processFile(files[i]);
    await lock.updateLock({ lastProcessedFile: i });
  }
});
```

---

## CLI Integration

### Command Structure

```typescript
import { Command } from 'commander';

const program = new Command();

// Generate documentation
program
  .command('generate')
  .argument('[path]')
  .option('-o, --output <path>')
  .option('--no-verify')
  .option('--update')
  .action(async (targetPath, options) => {
    const agent = new DocumentationAgent({
      targetPath: targetPath || process.cwd(),
      outputPath: options.output,
      verifyCode: options.verify !== false,
      updateExisting: options.update
    });
    
    await agent.generateDocumentation();
  });

// Full monty mode
program
  .command('full-monty')
  .argument('[path]')
  .option('-v, --verbose')
  .action(async (targetPath, options) => {
    const generator = new FullMontyGeneratorV3(options.verbose);
    const report = await generator.generate(targetPath || process.cwd());
    console.log('Report:', report);
  });

// Monitor GitHub
program
  .command('monitor')
  .option('--add <repo>')
  .option('--start')
  .action(async (options) => {
    const config = await new ConfigManager().loadConfig();
    const monitor = new GitHubMonitor(
      config.github.accessToken,
      config.obsidianVaultPath
    );
    
    if (options.add) {
      const [owner, repo] = options.add.split('/');
      await monitor.addRepository(owner, repo);
    }
    
    if (options.start) {
      await monitor.startMonitoring();
    }
  });
```

---

## Advanced Usage Examples

### 1. Multi-Project Documentation

```typescript
import { MultiProjectAnalyzer } from './MultiProjectAnalyzer';
import { DocumentationAgent } from './DocumentationAgent';

const analyzer = new MultiProjectAnalyzer();
const projects = await analyzer.detectSubProjects('/monorepo');

for (const project of projects) {
  const agent = new DocumentationAgent({
    targetPath: project.path,
    outputPath: `/vault/docs/${project.name}`,
    verifyCode: true
  });
  
  await agent.generateDocumentation();
}
```

### 2. Custom Progress Monitoring

```typescript
import { StableTerminalUI } from './StableTerminalUI';

const ui = new StableTerminalUI();
ui.start();

ui.createTask('analyze', 'Analyzing project', 100);
ui.updatePhase('Analysis');

// Perform analysis
for (let i = 0; i <= 100; i += 10) {
  ui.updateTask('analyze', i, `Processing ${i}%`);
  await sleep(100);
}

ui.completeTask('analyze', true);
ui.displayMetric('Files Processed', '150');
ui.displayMetric('Documentation Coverage', '95%');

ui.stop();
```

### 3. Streaming Documentation Generation

```typescript
import { StreamingReporter } from './StreamingReporter';
import { streamingClaudeQuery } from './EnhancedClaudeClientV2';

const reporter = new StreamingReporter(ui);

await streamingClaudeQuery(
  'Generate comprehensive documentation for this codebase',
  {
    onChunk: (chunk) => reporter.handleChunk(chunk),
    onComplete: () => reporter.finalize(),
    maxTokens: 4000
  }
);
```

### 4. Smart Tag Management

```typescript
import { SmartTagManager } from './SmartTagManager';

const tagManager = new SmartTagManager('/vault');

// Load and analyze existing tags
await tagManager.loadExistingTags();
const stats = tagManager.getTagStatistics();

// Generate contextual tags
const tags = await tagManager.generateSmartTags(
  documentContent,
  'react',
  existingTags
);

// Create tag hierarchy
const hierarchy = tagManager.buildTagHierarchy();
```

### 5. Documentation Auditing

```typescript
import { DocumentationAuditor } from './DocumentationAuditor';

const auditor = new DocumentationAuditor('/vault');

// Audit existing documentation
const auditReport = await auditor.audit();

console.log('Coverage:', auditReport.coverage);
console.log('Quality Score:', auditReport.qualityScore);
console.log('Missing Docs:', auditReport.missingDocumentation);
console.log('Outdated Docs:', auditReport.outdatedDocumentation);

// Generate improvement suggestions
const suggestions = auditor.generateSuggestions(auditReport);
```

---

## Best Practices

### 1. Configuration Management

Always validate configuration before use:
```typescript
const config = new ConfigManager();
const validation = await config.validateConfig();

if (!validation.valid) {
  throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
}
```

### 2. Safety First

Always validate and backup before operations:
```typescript
const safety = new SafetyValidator();

// Validate
const validation = await safety.validateDirectory(targetPath);
if (!validation.valid) {
  throw new Error(validation.errors.join(', '));
}

// Backup
const backup = await safety.createBackup(targetPath);
console.log('Backup created:', backup);
```

### 3. Proper Lock Management

Use withLockCheck for automatic lock handling:
```typescript
await withLockCheck(targetPath, async (lock, resumeData) => {
  // Your operations here
  // Lock is automatically acquired and released
});
```

### 4. Progress Tracking

Update progress regularly for long operations:
```typescript
const total = files.length;
for (let i = 0; i < total; i++) {
  await processFile(files[i]);
  
  // Update progress
  const progress = Math.round((i / total) * 100);
  ui.updateTask('processing', progress, `File ${i + 1}/${total}`);
  
  // Save state for resume capability
  await lock.updateLock({ 
    progress,
    lastFile: files[i],
    timestamp: new Date()
  });
}
```

### 5. Error Handling

Implement comprehensive error handling:
```typescript
try {
  await operation();
} catch (error) {
  // Log error
  console.error('Operation failed:', error);
  
  // Clean up resources
  await cleanup();
  
  // Restore from backup if needed
  if (backupPath) {
    await safety.restoreFromBackup(targetPath, backupPath);
  }
  
  // Re-throw or handle
  throw error;
}
```

---

## Environment Variables

DocuMentor respects the following environment variables:

- `HOME`: User home directory (required)
- `EDITOR`: Default editor for config editing (optional, defaults to 'nano')
- `CLAUDE_API_KEY`: Claude API key (optional, can be set in config)
- `GITHUB_TOKEN`: GitHub access token (optional, can be set in config)
- `DEBUG`: Enable debug logging when set to 'true'
- `NO_COLOR`: Disable colored output when set

---

## Performance Considerations

### Memory Management

For large codebases:
```typescript
// Process files in batches
const batchSize = 100;
for (let i = 0; i < files.length; i += batchSize) {
  const batch = files.slice(i, i + batchSize);
  await processBatch(batch);
  
  // Allow garbage collection
  if (global.gc) {
    global.gc();
  }
}
```

### Concurrent Processing

Use concurrent processing where appropriate:
```typescript
import { Promise as Bluebird } from 'bluebird';

// Process with concurrency limit
await Bluebird.map(
  files,
  async (file) => await processFile(file),
  { concurrency: 5 }
);
```

### Caching

Implement caching for repeated operations:
```typescript
const cache = new Map();

async function getCachedAnalysis(path: string) {
  if (cache.has(path)) {
    return cache.get(path);
  }
  
  const analysis = await analyze(path);
  cache.set(path, analysis);
  return analysis;
}
```

---

## Troubleshooting

### Common Issues

1. **Lock file conflicts**
   ```bash
   rm ~/.documentor/.locks/*.lock
   ```

2. **Configuration errors**
   ```bash
   documentor config --validate
   documentor config --reset
   ```

3. **Memory issues with large repos**
   ```bash
   node --max-old-space-size=4096 documentor generate /large/repo
   ```

4. **GitHub API rate limits**
   - Use personal access token with appropriate scopes
   - Increase polling interval in config

5. **Obsidian sync issues**
   - Ensure vault path is correct
   - Check file permissions
   - Verify Obsidian is not locked

---

## Version History

- **v2.0.0**: Complete rewrite with streaming, multi-project support, and enhanced UI
- **v1.5.0**: Added GitHub monitoring and safety validation
- **v1.0.0**: Initial release with basic documentation generation

---

## License

MIT License - See LICENSE file for details

---

## Support

For issues, feature requests, or questions:
- GitHub Issues: https://github.com/yourusername/docuMentor/issues
- Documentation: https://docs.documentor.ai
- Email: support@documentor.ai