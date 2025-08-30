# Agent 2: Security & Password Handling

## Mission
Implement secure, transient password handling with Go TUI integration (~1000 lines total).

## Prerequisites
- Review SECURE_PASSWORD_HANDLING.md
- Understand Go TUI password modal (already exists)
- NEVER store passwords anywhere

## Todo List

### 1. Implement PasswordBridge (`src/core/PasswordBridge.ts`)
- [ ] Extend EventEmitter (~300 lines)
- [ ] Create requestPassword() method:
  - Generate unique requestId
  - Send JSON to Go TUI via stdout
  - Wait for response with 30s timeout
  - Return password or null if cancelled
- [ ] Implement sudoExec() method:
  - Use spawn with sudo -S
  - Write password to stdin
  - Clear password immediately
  - Never log password
- [ ] Add message handlers for TUI responses
- [ ] Setup cleanup on all paths

### 2. Create SecureFileOps (`src/core/SecureFileOps.ts`)
- [ ] Implement tryWithPermission() wrapper (~400 lines)
- [ ] Add readFileSecure() method:
  - Try normal read first
  - On EACCES/EPERM, request password
  - Skip if user cancels
  - Try with sudo if password provided
- [ ] Create scanDirectory() with permission handling:
  - Track accessible vs skipped files
  - Request password for important directories
  - Continue without inaccessible files
- [ ] Add isImportantPath() logic

### 3. Implement LockFileManager (`src/core/LockFileManager.ts`)
- [ ] Create lock file in target directory (~400 lines)
- [ ] Implement checkAndCreate():
  - Check for existing lock
  - Verify if process still alive
  - Support resume from interrupted
  - Create new lock if clear
- [ ] Add heartbeat mechanism (every 5 seconds)
- [ ] Handle ALL termination scenarios:
  - SIGINT, SIGTERM, SIGHUP
  - Uncaught exceptions
  - Process exit
  - Windows-specific handling
- [ ] Use synchronous writes in exit handlers
- [ ] Track: pid, startTime, lastUpdate, status, phase, progress

### 4. Update Go TUI Integration
- [ ] Verify password modal message format:
  ```json
  {
    "type": "password_request",
    "requestId": "pwd-xxx",
    "prompt": "Permission needed for X",
    "context": "/path/to/file"
  }
  ```
- [ ] Ensure response format:
  ```json
  {
    "type": "password_response",
    "requestId": "pwd-xxx",
    "password": "***TRANSIENT***",
    "cancelled": false
  }
  ```

### 5. Security Validation
- [ ] Verify NO password storage
- [ ] Check memory clearing after use
- [ ] Ensure no logging of passwords
- [ ] Test timeout behavior
- [ ] Validate graceful degradation

## Critical Security Rules
1. NEVER store passwords
2. Clear from memory immediately
3. No password in logs
4. 30-second timeout
5. User can always cancel
6. Continue without restricted files

## Testing Checklist
- [ ] Password prompt appears in TUI
- [ ] Cancel works properly
- [ ] Timeout after 30 seconds
- [ ] sudo execution succeeds
- [ ] Lock file prevents duplicates
- [ ] Resume from interruption works
- [ ] All signals handled properly

## Files to Create
1. `src/core/PasswordBridge.ts`
2. `src/core/SecureFileOps.ts`
3. `src/core/LockFileManager.ts`
4. `src/utils/security.ts` (helpers if needed)