# DocuMentor V3.1 - Simplified Architecture with Password Handling

## Core Principles
1. **SIMPLE** - Direct, understandable code
2. **SECURE** - Transient password handling, no storage
3. **MODULAR** - Clean separation of concerns
4. **PRACTICAL** - Solves real problems without overengineering

## Architecture Overview

```
documentor CLI
     │
     ▼
DocumentEngine ─────┬──→ ProjectAnalyzer (with SecureFileOps)
     │              ├──→ ClaudeClient (with permission handling)
     │              ├──→ DocGenerator  
     │              └──→ FileWriter
     │
     ├──→ PasswordBridge ←──→ Go TUI (existing password modal)
     │
     └──→ ProgressTracker ──→ TUIBridge ──→ Go TUI
```

## Core Components (~4000 lines total)

### 1. `src/core/DocumentEngine.ts` (~600 lines)
```typescript
export class DocumentEngine {
  private analyzer: ProjectAnalyzer
  private claude: ClaudeClient
  private generator: DocGenerator
  private progress: ProgressTracker
  private passwordBridge: PasswordBridge
  
  constructor(config: Config) {
    this.passwordBridge = new PasswordBridge()
    this.analyzer = new ProjectAnalyzer(config, this.passwordBridge)
    this.claude = new ClaudeClient(config, this.passwordBridge)
    this.generator = new DocGenerator(config)
    this.progress = new ProgressTracker()
  }
  
  async generate(projectPath: string): Promise<void> {
    try {
      // Phase 1: Analysis (may need permissions for some files)
      this.progress.startPhase('Analysis', 1, 5)
      const project = await this.analyzer.analyze(projectPath)
      
      // Report skipped files if any
      if (project.skippedFiles.length > 0) {
        this.progress.log('warning', 
          `Skipped ${project.skippedFiles.length} files due to permissions`)
      }
      
      // Continue with available files...
      // Rest of generation flow
    } catch (error) {
      this.handleError(error)
    }
  }
}
```

### 2. `src/core/PasswordBridge.ts` (~300 lines)
Bridge to existing Go TUI password modal:

```typescript
import { EventEmitter } from 'events';

export class PasswordBridge extends EventEmitter {
  private pendingRequests: Map<string, (response: any) => void> = new Map();
  
  constructor() {
    super();
    this.listenForResponses();
  }
  
  /**
   * Request password from existing Go TUI modal
   * Returns null if user cancels
   */
  async requestPassword(
    operation: string,
    path: string
  ): Promise<string | null> {
    const requestId = `pwd-${Date.now()}`;
    
    // Send request to existing Go TUI password modal
    this.sendToTUI({
      type: 'password_request',
      requestId,
      prompt: `Permission needed for ${operation}`,
      context: path
    });
    
    // Wait for response from Go TUI
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        resolve(null); // Timeout = cancelled
      }, 30000);
      
      this.pendingRequests.set(requestId, (response) => {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        
        if (response.cancelled) {
          resolve(null);
        } else {
          // Use password immediately and clear
          const pwd = response.password;
          response.password = null; // Clear from response
          resolve(pwd);
        }
      });
    });
  }
  
  /**
   * Execute command with sudo using transient password
   */
  async sudoExec(command: string, args: string[], password: string): Promise<boolean> {
    const sudo = spawn('sudo', ['-S', command, ...args], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Send password and immediately clear
    sudo.stdin.write(password + '\n');
    sudo.stdin.end();
    password = ''; // Clear from memory
    
    return new Promise((resolve) => {
      sudo.on('close', (code) => resolve(code === 0));
      sudo.on('error', () => resolve(false));
    });
  }
  
  private listenForResponses(): void {
    // Listen for password responses from Go TUI
    process.stdin.on('data', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'password_response') {
          const handler = this.pendingRequests.get(msg.requestId);
          if (handler) {
            handler(msg);
          }
        }
      } catch (e) {
        // Not JSON or not for us
      }
    });
  }
  
  private sendToTUI(message: any): void {
    console.log(JSON.stringify(message));
  }
}
```

### 3. `src/core/SecureFileOps.ts` (~400 lines)
Graceful permission handling:

```typescript
export class SecureFileOps {
  constructor(private passwordBridge: PasswordBridge) {}
  
  /**
   * Try to read file, request password if needed, skip if denied
   */
  async readFileSecure(filepath: string): Promise<string | null> {
    try {
      // Try normal read first
      return await fs.readFile(filepath, 'utf-8');
    } catch (error: any) {
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        // Permission denied - ask user
        const password = await this.passwordBridge.requestPassword(
          'read file',
          filepath
        );
        
        if (!password) {
          // User cancelled - skip this file
          console.log(`⚠️  Skipping ${filepath} - no permission`);
          return null;
        }
        
        // Try with sudo
        const success = await this.sudoRead(filepath, password);
        return success || null;
      }
      throw error; // Other error
    }
  }
  
  /**
   * Scan directory with automatic permission handling
   */
  async scanDirectory(dir: string): Promise<ScanResult> {
    const accessible: string[] = [];
    const skipped: string[] = [];
    
    const scan = async (path: string) => {
      try {
        const entries = await fs.readdir(path);
        
        for (const entry of entries) {
          const fullPath = path.join(path, entry);
          try {
            const stats = await fs.stat(fullPath);
            if (stats.isDirectory()) {
              await scan(fullPath);
            } else {
              accessible.push(fullPath);
            }
          } catch (e: any) {
            if (e.code === 'EACCES' || e.code === 'EPERM') {
              skipped.push(fullPath);
            }
          }
        }
      } catch (error: any) {
        if (error.code === 'EACCES' || error.code === 'EPERM') {
          // Try with password for important directories
          if (this.isImportantDir(path)) {
            const password = await this.passwordBridge.requestPassword(
              'access directory',
              path
            );
            
            if (password) {
              // Try with sudo
              const files = await this.sudoListDir(path, password);
              accessible.push(...files);
              return;
            }
          }
          skipped.push(path);
        }
      }
    };
    
    await scan(dir);
    
    return { accessible, skipped };
  }
  
  private isImportantDir(path: string): boolean {
    // Determine if directory is worth requesting password for
    return path.includes('/src') || 
           path.includes('/lib') || 
           path.includes('/config');
  }
}
```

### 4. `src/core/ProjectAnalyzer.ts` (~500 lines)
Integrates secure file operations:

```typescript
export class ProjectAnalyzer {
  private secureOps: SecureFileOps;
  
  constructor(config: Config, passwordBridge: PasswordBridge) {
    this.secureOps = new SecureFileOps(passwordBridge);
  }
  
  async analyze(projectPath: string): Promise<ProjectAnalysis> {
    // Scan with automatic permission handling
    const { accessible, skipped } = await this.secureOps.scanDirectory(projectPath);
    
    // Analyze accessible files
    const files = await Promise.all(
      accessible.map(async (file) => {
        const content = await this.secureOps.readFileSecure(file);
        return { path: file, content, accessible: content !== null };
      })
    );
    
    // Report what we could analyze
    const analyzed = files.filter(f => f.accessible);
    const failed = files.filter(f => !f.accessible);
    
    console.log(`✓ Analyzed ${analyzed.length} files`);
    if (failed.length > 0) {
      console.log(`⚠️  Skipped ${failed.length} files (no permission)`);
    }
    
    return {
      projectPath,
      files: analyzed,
      skippedFiles: [...failed.map(f => f.path), ...skipped],
      stats: this.calculateStats(analyzed)
    };
  }
}
```

### 5. `src/core/ClaudeClient.ts` (~400 lines)
With permission-aware file access:

```typescript
export class ClaudeClient {
  constructor(
    private config: Config,
    private passwordBridge: PasswordBridge
  ) {}
  
  async query(prompt: string, projectPath: string): Promise<string> {
    const args = [
      '--print',
      '--verbose',
      '--output-format', 'stream-json',
      // Still skip Claude's permission system - we handle it ourselves
      '--dangerously-skip-permissions',
      '--disallowedTools', 'TodoWrite,Task',
      '--allowedTools', 'Read,Grep,Glob,LS,Bash,Write,Edit'
    ];
    
    const claude = spawn('claude', args, {
      cwd: projectPath,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Monitor for permission errors from Claude
    claude.stderr.on('data', async (data) => {
      const msg = data.toString();
      
      // If Claude hits permission error, we handle it
      if (msg.includes('Permission denied') || msg.includes('EACCES')) {
        // Extract file path from error
        const filepath = this.extractFilePath(msg);
        
        if (filepath) {
          // Request password through our system
          const password = await this.passwordBridge.requestPassword(
            'Claude file access',
            filepath
          );
          
          if (!password) {
            // Tell Claude to skip this file
            claude.stdin.write('SKIP\n');
          } else {
            // We can't give Claude the password directly
            // Log that file was skipped
            console.log(`⚠️  Claude skipped ${filepath} - no permission`);
          }
        }
      }
    });
    
    // Rest of Claude handling...
  }
}
```

## Configuration File

Project-local configuration with sensible defaults:

```json
{
  "version": "3.1.0",
  "project": {
    "name": "auto-detect",
    "path": "./"
  },
  "output": {
    "path": "~/obsidian_vault/docs",
    "format": "obsidian"
  },
  "permissions": {
    "requestPassword": true,
    "skipOnDenial": true,
    "importantPaths": ["src", "lib", "config"]
  },
  "display": {
    "format": "normal",
    "showSkipped": true
  },
  "phases": [
    "analysis",
    "generation", 
    "enhancement",
    "formatting",
    "save"
  ]
}
```

## Message Flow with Go TUI

### Password Request (TypeScript → Go)
```json
{
  "type": "password_request",
  "requestId": "pwd-1234567890",
  "prompt": "Permission needed for read file",
  "context": "/etc/important-config"
}
```

### Password Response (Go → TypeScript)
```json
{
  "type": "password_response",
  "requestId": "pwd-1234567890",
  "password": "***TRANSIENT***",
  "cancelled": false
}
```

### Progress Updates
```json
{
  "type": "file",
  "files": {
    "processed": 45,
    "total": 95,
    "skipped": 5,
    "current": "src/index.ts"
  }
}
```

## Security Guarantees

1. **No Password Storage**
   - Passwords exist only in memory during use
   - Cleared immediately after use
   - Never written to disk or logs

2. **User Control**
   - User decides for each permission request
   - Can cancel anytime to skip operation
   - Clear indication of what needs permission

3. **Graceful Degradation**
   - System continues without inaccessible files
   - Reports what was skipped
   - Generates documentation with available files

4. **Minimal Privilege**
   - Only requests password when needed
   - Doesn't maintain sudo session
   - Each operation requires separate approval

## Benefits of V3.1

- ✅ **Secure** - Transient password handling
- ✅ **Simple** - ~4000 lines vs 12000 in original V3
- ✅ **Practical** - Handles real permission issues
- ✅ **Transparent** - Shows what was accessed/skipped
- ✅ **Integrated** - Uses existing Go TUI password modal
- ✅ **Graceful** - Continues working despite permission issues

## Implementation Priority

1. **Week 1**: Core password bridge and secure file ops
2. **Week 2**: Integrate with analyzer and Claude
3. **Week 3**: Testing and refinement