# Complete Audit: Competing Systems and Conflicts

## 1. LOCK FILE SYSTEMS - 5 Competing Implementations

### Implementation #1: LockFileManager (CURRENT MAIN)
**File**: `/src/core/LockFileManager.ts`
**Lines**: 24-46 (interface), 331-362 (create), 432-451 (read)
**Format**:
```typescript
interface LockInfo {
    pid: number;
    startTime: Date;
    lastUpdate: Date;
    status: 'running' | 'interrupted' | 'completed' | 'failed';
    phase: string;
    progress: {
        current: number;
        total: number;
        percentage: number;
    };
    projectPath: string;
    version: string;
    platform: string;
    nodeVersion: string;
    memoryUsage?: {...};
    metadata?: Record<string, any>;
}
```

### Implementation #2: TypeScript Types 
**File**: `/src/types/index.ts`
**Lines**: 334-347
**Format**:
```typescript
interface LockFileData {
  pid: number
  startTime: string  // STRING not Date
  lastUpdate: string // STRING not Date
  status: LockStatus // Different enum
  currentPhase: Phase // Different type
  completedTasks: string[]
  progress: number // FLAT number not object
  projectPath: string
  outputPath: string
  error?: ErrorInfo
}
```

### Implementation #3: CLI Generate Command
**File**: `/src/cli/commands/generate.ts`
**Lines**: 92-108 (createLockFile method)
**Format**:
```typescript
const lockData = {
    status: 'starting',  // NOT in any enum!
    phase: 0,           // NUMBER not string!
    totalPhases: 9,
    phaseName: 'Initialization',
    currentTask: 'Starting documentation generation',
    progress: 0,        // FLAT number
    timestamp: formatLocalTimestamp(),
    pid: process.pid,
    projectPath: this.projectPath,
    outputPath: this.outputPath
}
```

### Implementation #4: TUIAdapter Reader
**File**: `/src/core/TUIAdapter.ts`
**Lines**: 67-91 (readAndSendLockInfo)
**Expected Format**:
```typescript
{
    status: string,
    resuming: boolean,  // Calculated field
    timestamp: string,
    pid: number,
    createdAt: string,
    updatedAt: string
}
```

### Implementation #5: Go TUI Structure
**File**: `/src/tui/main.go`
**Lines**: 46-53
**Format**:
```go
type LockInfo struct {
    Status    string    `json:"status"`
    Resuming  bool      `json:"resuming"`
    CreatedAt time.Time `json:"createdAt"`
    UpdatedAt time.Time `json:"updatedAt"`
    Timestamp time.Time `json:"timestamp"`
    PID       int       `json:"pid"`
}
```

### CONFLICTS:
- **Date format**: Date objects vs strings vs timestamps
- **Status values**: 'running'/'interrupted' vs 'starting' vs LockStatus enum
- **Phase format**: string vs number vs Phase type
- **Progress format**: flat number vs object with current/total/percentage
- **Missing fields**: Various implementations missing required fields

---

## 2. TUI ADAPTER SYSTEMS - 4 Competing Implementations

### Implementation #1: TUIAdapter (Main)
**File**: `/src/core/TUIAdapter.ts`
**Lines**: 1-343
**Message Format**:
```typescript
{ 
  type: 'log|phase|file|tool|debug|raw|memory|lockInfo|project',
  level?: string,
  content?: string,
  timestamp?: string,
  phase?: PhaseInfo,
  files?: FileInfo,
  ...
}
```
**Output**: `console.log(JSON.stringify(message))` (Line 35)

### Implementation #2: TUIBridge 
**File**: `/src/core/TUIBridge.ts`
**Lines**: 1-396
**Message Format**:
```typescript
{
  type: TUIMessageType, // Different enum
  timestamp: string,    // Always included
  data: any            // Generic data field
}
```
**Output**: `console.log(jsonMessage)` (Line 217)

### Implementation #3: TUILauncher
**File**: `/src/core/TUILauncher.ts`
**Lines**: 1-185
**Message Format**: Same as TUIAdapter but sends to process stdin
**Output**: `this.tuiProcess.stdin.write(JSON.stringify(message) + '\n')` (Line 97)

### Implementation #4: Display Module
**File**: `/src/cli/display.ts`
**Lines**: 1-150+
**Usage**: Direct TUIAdapter methods, environmental detection
**Conflicts**: Uses both TUIAdapter and console.log based on environment

### CONFLICTS:
- **Message structure**: Different field names and nesting
- **Timestamp handling**: Optional vs required
- **Output method**: stdout vs process stdin
- **Type systems**: Different enums and type definitions

---

## 3. PHASE MANAGEMENT SYSTEMS - 4 Competing Implementations

### Implementation #1: New PhaseManager
**File**: `/src/core/PhaseManager.ts`
**Lines**: 78-353 (phase definitions)
**Phase IDs**: 
```typescript
// WRONG MAPPINGS!
Phase 1: id='analysis', name='INITIALIZATION'      // ID doesn't match name!
Phase 2: id='generation', name='VALIDATION'        // ID doesn't match name!
Phase 3: id='analysis', name='ANALYSIS'           // DUPLICATE ID!
Phase 4: id='generation', name='PREPARATION'      // DUPLICATE ID!
```

### Implementation #2: DocumentEngine Phases
**File**: `/src/core/DocumentEngine.ts`
**Lines**: 121-590 (phase methods)
**Methods**:
```typescript
executePhase1Analysis()     // Lines 121-186
executePhase2Generation()   // Lines 192-250
executePhase3Enhancement()  // Lines 256-301
// ... etc
```

### Implementation #3: CLI Generate Command Phases
**File**: `/src/cli/commands/generate.ts`
**Lines**: 125-292 (phase methods)
**Methods**:
```typescript
phase1_ProjectAnalysis()     // Lines 125-143
phase2_SecurityValidation()  // Lines 146-180
phase3_Enhancement()         // Lines 183-194
// ... Different names!
```

### Implementation #4: Types Definition
**File**: `/src/types/index.ts`
**Lines**: 269-278
**Enum**:
```typescript
type Phase = 'analysis' | 'generation' | 'enhancement' | ...
```

### CONFLICTS:
- **Phase IDs**: Duplicate and mismatched IDs
- **Phase names**: Different naming conventions
- **Phase count**: Sometimes 9, sometimes 10 phases
- **Execution methods**: Different method signatures

---

## 4. LOGGER SYSTEMS - 2 Competing Implementations

### Implementation #1: Core Logger
**File**: `/src/core/Logger.ts`
**Lines**: 1-172
**Issues**:
- Maps 'success' to 'info' (Line 86)
- Uses 'warn' instead of 'warning'
- No timestamp in TUI messages
- Uses generic `tuiAdapter.log()` method

### Implementation #2: Display Module Logger
**File**: `/src/cli/display.ts`
**Lines**: Various
**Better approach**:
- Uses specific methods: `logSuccess()`, `logWarning()`
- Proper level names
- Direct TUI integration

### CONFLICTS:
- **Level mapping**: success→info vs keeping success
- **Level names**: warn vs warning
- **Method usage**: Generic vs specific

---

## 5. PROGRESS TRACKING - 3 Competing Systems

### Implementation #1: ProgressTracker
**File**: `/src/core/ProgressTracker.ts`
**Lines**: Various
**Format**: Complex FileProgress objects with detailed status

### Implementation #2: TUIBridge Progress
**File**: `/src/core/TUIBridge.ts`
**Lines**: 97-113
**Format**: ProgressMessage with phase/file/overall progress

### Implementation #3: TUIAdapter Progress
**File**: `/src/core/TUIAdapter.ts`
**Lines**: 313-327
**Format**: Simple processed/total counts

### CONFLICTS:
- **Data structure**: Complex objects vs simple counts
- **Status granularity**: 7 statuses vs simple progress
- **Update frequency**: Per-file vs batch updates

---

## 6. CRITICAL MISSING/BROKEN CODE

### Missing Function in Go TUI
**File**: `/src/tui/main.go`
**Issue**: Calls `updateInfoBox()` at lines 269, 671, 675, 680, 688, 709, 712
**Problem**: Only `updateInfoBox_old()` exists (Line 502)
**Impact**: **TUI CRASHES** when trying to update display

### Wrong Phase Execution Loop
**File**: `/src/cli/commands/generate.ts`
**Lines**: 77-79
```typescript
for (let i = 0; i < 9; i++) {
    await this.executePhaseWithWork(i)  // Uses wrong phase IDs
}
```

### Mixed Output Stream
**File**: `/documentor` (bash wrapper)
**Line**: 69
```bash
node "$SCRIPT_DIR/dist/index.js" "$@" > "$PIPE" 2>&1
```
**Problem**: Mixes JSON with stderr, corrupting TUI input

---

## SUMMARY: Which Version Follows Needed Format?

### For Lock Files:
**NONE** follow the complete format. The Go TUI expects a simplified version but TypeScript sends complex nested objects.

**Closest to correct**: `LockFileManager` has the most complete data, but needs transformation for TUI.

### For TUI Messages:
**TUIAdapter** is closest to correct format expected by Go TUI, but has issues:
- Missing timestamps in some messages
- Wrong level mappings
- Inconsistent field names

### For Phases:
**DocumentEngine** phases are most complete and functional, but:
- PhaseManager has wrong ID mappings
- CLI generate has different names
- No consistent phase tracking to TUI

### For Logging:
**Display module** approach is better (specific methods) but **Core Logger** is more centralized.

---

## 7. ADDITIONAL CONFLICTS (Second Pass)

### JSON Output to stdout - CRITICAL VIOLATION
**Issue**: Multiple systems write JSON to stdout, corrupting TUI data stream

**Violators**:
- `/src/cli/commands/config.ts` Line 155: `console.log(JSON.stringify(config, null, 2))`
- `/src/cli/commands/watch.ts` Line 321: `console.log(JSON.stringify(result, null, 2))`
- `/src/core/TUIBridge.ts` Line 217: Direct JSON output competing with TUIAdapter

**Impact**: JSON messages mix with TUI protocol, causing parsing failures

### Duplicate LockFileManager Classes
- `/src/core/LockFileManager.ts`: Main implementation
- `/src/core/DocumentEngine.ts` Line 694: Has its own `class LockFileManager`
**Conflict**: Two different lock file managers can create incompatible locks

### Multiple ConfigManager Systems
- `/src/core/Config.ts`: `ConfigLoader` class
- `/src/cli/commands/config.ts`: `ConfigManager` class
**Conflict**: Different config formats and APIs

### Multiple DocumentEngine Classes
- `/src/core/DocumentEngine.ts`: Main engine
- `/src/cli/commands/generate.ts`: Different `DocumentEngine` class
- `/src/cli/commands/self-document.ts`: `SelfDocumentEngine` extends DocumentEngine
**Conflict**: Three different engines with overlapping functionality

### Display System Bypass
- TUI mode detection via `DOCUMENTOR_TUI=true` environment variable
- Multiple systems bypass display module and write directly to stdout
- Mock data system (`/src/tui/scripts/mock_data.sh`) can interfere with real data

---

## FINAL RECOMMENDATION PRIORITY:

### CRITICAL (Fix Immediately):
1. **Fix Go TUI** `updateInfoBox()` function - System crashes without this
2. **Block ALL console.log** except TUIAdapter - Data corruption issue
3. **Remove duplicate LockFileManager** in DocumentEngine.ts

### HIGH (Fix This Week):
4. **Fix PhaseManager ID mappings** - Phases 1-4 have wrong/duplicate IDs
5. **Standardize lock file format** - Pick one structure and transform for TUI
6. **Consolidate DocumentEngine** classes - Too many competing implementations

### MEDIUM (Fix This Sprint):
7. **Unify ConfigManager** systems - Choose Config.ts or commands/config.ts
8. **Consolidate Logger** systems - Core Logger with proper TUI methods
9. **Fix timestamp/level issues** in TUIAdapter messages
10. **Separate JSON from stderr** in wrapper script