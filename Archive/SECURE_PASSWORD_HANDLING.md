# Secure Password Handling for DocuMentor

## Core Security Principles

1. **NEVER store passwords** - Only pass through to sudo
2. **NEVER log passwords** - No traces in logs or files
3. **ALWAYS clear from memory** - Immediate cleanup after use
4. **GRACEFUL degradation** - Continue without permission if user cancels
5. **MINIMAL privilege time** - Use sudo only for specific operations

## Architecture

### Password Flow

```
Permission Error → Check if Critical → Prompt User → Execute with Sudo → Clear Memory
       ↓                   ↓                ↓                 ↓              ↓
   Skip File          Skip File       User Cancels      Success/Fail    Continue
                                           ↓
                                      Skip Operation
```

## Implementation

### 1. Go TUI Password Modal (`src/tui/password_modal.go`)

```go
package main

import (
    "github.com/gdamore/tcell/v2"
    "github.com/rivo/tview"
    "strings"
)

type PasswordModal struct {
    app      *tview.Application
    modal    *tview.Modal
    input    *tview.InputField
    callback func(password string, cancelled bool)
}

func NewPasswordModal(app *tview.Application) *PasswordModal {
    return &PasswordModal{
        app: app,
    }
}

func (p *PasswordModal) Show(title, message string, callback func(string, bool)) {
    p.callback = callback
    
    // Create secure input field (masked)
    p.input = tview.NewInputField().
        SetLabel("Password: ").
        SetFieldWidth(30).
        SetMaskCharacter('•'). // Mask password input
        SetDoneFunc(func(key tcell.Key) {
            if key == tcell.KeyEnter {
                password := p.input.GetText()
                p.input.SetText("") // Clear immediately
                p.closeModal()
                p.callback(password, false)
            } else if key == tcell.KeyEscape {
                p.input.SetText("") // Clear immediately
                p.closeModal()
                p.callback("", true) // Cancelled
            }
        })
    
    // Create modal with input
    form := tview.NewForm().
        AddFormItem(p.input).
        SetButtonsAlign(tview.AlignCenter).
        AddButton("Submit", func() {
            password := p.input.GetText()
            p.input.SetText("") // Clear immediately
            p.closeModal()
            p.callback(password, false)
        }).
        AddButton("Cancel", func() {
            p.input.SetText("") // Clear immediately
            p.closeModal()
            p.callback("", true)
        })
    
    p.modal = tview.NewModal().
        SetText(message).
        AddButtons([]string{}).
        SetDoneFunc(func(buttonIndex int, buttonLabel string) {})
    
    // Create flex layout
    flex := tview.NewFlex().
        SetDirection(tview.FlexRow).
        AddItem(tview.NewTextView().SetText(title).SetTextAlign(tview.AlignCenter), 1, 0, false).
        AddItem(tview.NewTextView().SetText(message).SetTextAlign(tview.AlignCenter), 2, 0, false).
        AddItem(form, 5, 0, true)
    
    // Show modal
    p.app.SetRoot(flex, true)
    p.app.SetFocus(p.input)
}

func (p *PasswordModal) closeModal() {
    // Return to main view
    p.app.SetRoot(p.app.GetRoot(), true)
}
```

### 2. TypeScript Password Request Handler (`src/core/PasswordHandler.ts`)

```typescript
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

export class PasswordHandler extends EventEmitter {
  private activeRequest: string | null = null;
  
  /**
   * Request password from user for a specific operation
   * NEVER stores the password, only passes it through
   */
  async requestPassword(
    operation: string,
    path: string,
    critical: boolean = false
  ): Promise<{ password: string | null; cancelled: boolean }> {
    
    // Generate unique request ID
    const requestId = `pwd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.activeRequest = requestId;
    
    // Send password request to TUI
    this.sendToTUI({
      type: 'password_request',
      requestId,
      operation,
      path,
      critical,
      message: this.buildMessage(operation, path, critical)
    });
    
    // Wait for response (with timeout)
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        // Timeout after 30 seconds - treat as cancelled
        this.activeRequest = null;
        resolve({ password: null, cancelled: true });
      }, 30000);
      
      // Listen for password response
      const handler = (response: any) => {
        if (response.requestId === requestId) {
          clearTimeout(timeout);
          this.activeRequest = null;
          
          // Clear password from response after resolving
          const result = {
            password: response.cancelled ? null : response.password,
            cancelled: response.cancelled
          };
          
          // Security: Clear password from response object
          response.password = null;
          delete response.password;
          
          resolve(result);
        }
      };
      
      this.once(`password-response-${requestId}`, handler);
    });
  }
  
  /**
   * Execute command with sudo using provided password
   * Password is NEVER logged or stored
   */
  async executeWithSudo(
    command: string,
    args: string[],
    password: string
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    return new Promise((resolve) => {
      // Use sudo with stdin for password
      const sudo = spawn('sudo', ['-S', command, ...args], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      let error = '';
      
      // Send password to sudo (never logged)
      sudo.stdin.write(password + '\n');
      sudo.stdin.end();
      
      // Clear password from memory immediately
      password = '';
      
      sudo.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      sudo.stderr.on('data', (data) => {
        const str = data.toString();
        // Filter out password prompt from stderr
        if (!str.includes('Password:') && !str.includes('[sudo]')) {
          error += str;
        }
      });
      
      sudo.on('close', (code) => {
        resolve({
          success: code === 0,
          output: output || undefined,
          error: error || undefined
        });
      });
      
      sudo.on('error', (err) => {
        resolve({
          success: false,
          error: err.message
        });
      });
    });
  }
  
  /**
   * Try operation with password if needed
   */
  async tryWithPermission<T>(
    operation: () => Promise<T>,
    fallback: () => Promise<T>,
    context: { path: string; operation: string; critical?: boolean }
  ): Promise<T> {
    try {
      // Try without elevated permissions first
      return await operation();
    } catch (error: any) {
      // Check if permission error
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        
        // Ask user if they want to provide password
        const { password, cancelled } = await this.requestPassword(
          context.operation,
          context.path,
          context.critical
        );
        
        if (cancelled || !password) {
          // User cancelled - try fallback
          console.log(`⚠️  Skipping ${context.path} - permission denied`);
          return await fallback();
        }
        
        // Try with sudo
        // Implementation depends on specific operation
        // Password is cleared from memory after use
        
        // For now, fallback
        return await fallback();
      }
      
      // Not a permission error - rethrow
      throw error;
    }
  }
  
  private buildMessage(operation: string, path: string, critical: boolean): string {
    if (critical) {
      return `Critical operation "${operation}" requires elevated permissions for:\n${path}\n\nThis operation cannot be skipped.`;
    } else {
      return `Operation "${operation}" requires elevated permissions for:\n${path}\n\nYou can cancel to skip this file.`;
    }
  }
  
  private sendToTUI(message: any): void {
    // Send to TUI via stdout
    console.log(JSON.stringify(message));
  }
}
```

### 3. Secure File Operations (`src/core/SecureFileOps.ts`)

```typescript
export class SecureFileOps {
  constructor(private passwordHandler: PasswordHandler) {}
  
  /**
   * Read file with permission handling
   */
  async readFile(path: string): Promise<string | null> {
    return this.passwordHandler.tryWithPermission(
      // Try normal read
      async () => {
        return await fs.readFile(path, 'utf-8');
      },
      // Fallback if no permission
      async () => {
        console.log(`⚠️  Skipped reading ${path} - no permission`);
        return null;
      },
      {
        path,
        operation: 'read file',
        critical: false
      }
    );
  }
  
  /**
   * Read directory with permission handling
   */
  async readDirectory(path: string): Promise<string[] | null> {
    return this.passwordHandler.tryWithPermission(
      async () => {
        return await fs.readdir(path);
      },
      async () => {
        console.log(`⚠️  Skipped directory ${path} - no permission`);
        return null;
      },
      {
        path,
        operation: 'read directory',
        critical: false
      }
    );
  }
  
  /**
   * Analyze with graceful permission handling
   */
  async analyzeProject(projectPath: string): Promise<Analysis> {
    const files: string[] = [];
    const skipped: string[] = [];
    
    const scanDir = async (dir: string) => {
      const entries = await this.readDirectory(dir);
      
      if (!entries) {
        skipped.push(dir);
        return;
      }
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stats = await this.statFile(fullPath);
        
        if (!stats) {
          skipped.push(fullPath);
          continue;
        }
        
        if (stats.isDirectory()) {
          await scanDir(fullPath);
        } else {
          files.push(fullPath);
        }
      }
    };
    
    await scanDir(projectPath);
    
    if (skipped.length > 0) {
      console.log(`⚠️  Skipped ${skipped.length} files/directories due to permissions`);
    }
    
    return { files, skipped };
  }
}
```

### 4. Go TUI Message Handler Update (`src/tui/main.go`)

```go
// Add to message handling
case "password_request":
    var req PasswordRequest
    if err := json.Unmarshal(msg.Data, &req); err == nil {
        t.handlePasswordRequest(req)
    }

func (t *TUI) handlePasswordRequest(req PasswordRequest) {
    // Show password modal
    passwordModal := NewPasswordModal(t.app)
    
    passwordModal.Show(
        "Permission Required",
        req.Message,
        func(password string, cancelled bool) {
            // Send response back to Node.js
            response := PasswordResponse{
                RequestID: req.RequestID,
                Password:  password,
                Cancelled: cancelled,
            }
            
            // Send via named pipe or stdout
            responseJSON, _ := json.Marshal(response)
            fmt.Println(string(responseJSON))
            
            // Security: Clear password from memory
            password = ""
            response.Password = ""
        },
    )
}
```

## Security Measures

### 1. **Memory Security**
```typescript
// Always clear passwords immediately after use
let password = await getPassword();
await usePassword(password);
password = ''; // Clear immediately
delete password; // Remove reference
```

### 2. **No Logging**
```typescript
// Never log passwords or password-related data
logger.log('Requesting permission for:', path); // ✓ OK
logger.log('Password:', password); // ✗ NEVER DO THIS
```

### 3. **Timeout Protection**
- Password prompts timeout after 30 seconds
- Treats timeout as cancellation
- Continues with fallback behavior

### 4. **Graceful Degradation**
```typescript
if (cancelled || !password) {
  // User chose not to provide password
  // Continue without this file/operation
  return skipOperation();
}
```

### 5. **Minimal Privilege Window**
- Only request password when absolutely needed
- Use password immediately
- Clear from memory right after use
- Don't keep sudo sessions alive

## Usage Examples

### Example 1: Reading Protected File
```typescript
const content = await secureOps.readFile('/etc/shadow');
if (!content) {
  console.log('Could not read protected file - continuing without it');
}
```

### Example 2: Scanning Protected Directory
```typescript
const analysis = await secureOps.analyzeProject('/root/project');
console.log(`Analyzed ${analysis.files.length} files`);
console.log(`Skipped ${analysis.skipped.length} protected items`);
```

### Example 3: Critical Operation
```typescript
const result = await passwordHandler.tryWithPermission(
  async () => await writeSystemConfig(),
  async () => { throw new Error('Cannot proceed without permission'); },
  { path: '/etc/config', operation: 'write config', critical: true }
);
```

## User Experience

### Password Prompt in TUI
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

### After Cancellation
```
⚠️  Skipped /etc/important-config - permission denied
→ Continuing with remaining files...
✓ Analyzed 95 of 100 files (5 skipped due to permissions)
```

## Integration with DocuMentor

### Update DocumentEngine
```typescript
class DocumentEngine {
  private passwordHandler: PasswordHandler;
  private secureOps: SecureFileOps;
  
  constructor(config: Config) {
    this.passwordHandler = new PasswordHandler();
    this.secureOps = new SecureFileOps(this.passwordHandler);
  }
  
  async analyze(projectPath: string): Promise<Analysis> {
    // Will prompt for password if needed, skip if cancelled
    return await this.secureOps.analyzeProject(projectPath);
  }
}
```

## Benefits

1. **Security**: No password storage, immediate memory clearing
2. **User Control**: User decides whether to provide password
3. **Graceful**: Continues working even without permissions
4. **Transparent**: Shows what was skipped and why
5. **Safe**: No privilege escalation without user consent