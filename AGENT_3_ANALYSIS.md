# Agent 3: Project Analysis & Type Detection

## Mission
Build intelligent project analyzer with type detection and adaptive documentation (~1000 lines total).

## Prerequisites
- Review project type detection requirements
- Understand monorepo/library/application differences
- Integration with SecureFileOps for permissions

## Todo List

### 1. Create ProjectTypeDetector (`src/core/ProjectTypeDetector.ts`)
- [ ] Implement detect() method (~300 lines):
  ```typescript
  async detect(projectPath: string): Promise<ProjectType>
  ```
- [ ] Detection logic for MONOREPO:
  - Check for lerna.json
  - Check for pnpm-workspace.yaml
  - Check for yarn workspaces in package.json
  - Check for nx.json
  - Check for rush.json
- [ ] Detection logic for LIBRARY/TOOLS:
  - Multiple entry points (index.ts, cli.ts, etc.)
  - Tools/ or scripts/ directory
  - Multiple package.json exports
  - Bin entries in package.json
- [ ] Detection logic for APPLICATION:
  - Single main entry point
  - Presence of src/index or src/main
  - Web framework indicators (next.config.js, etc.)
- [ ] Default fallback handling

### 2. Implement ProjectAnalyzer (`src/core/ProjectAnalyzer.ts`)
- [ ] Main analyze() method (~500 lines)
- [ ] Integrate SecureFileOps for permission handling
- [ ] Adapt analysis based on detected type:
  ```typescript
  switch(projectType) {
    case 'monorepo': return this.analyzeMonorepo(path)
    case 'library': return this.analyzeLibrary(path)
    case 'tools': return this.analyzeToolsCollection(path)
    default: return this.analyzeStandard(path)
  }
  ```
- [ ] Track skipped files due to permissions
- [ ] Generate appropriate structure for each type

### 3. Create FileScanner (`src/core/FileScanner.ts`)
- [ ] Implement intelligent file scanning (~200 lines)
- [ ] Respect .gitignore patterns
- [ ] Handle .documentor-ignore file
- [ ] Skip node_modules by default
- [ ] Track file statistics:
  - Total files
  - File types distribution
  - Lines of code
  - Accessible vs skipped
- [ ] Support depth limiting

### 4. Monorepo-Specific Analysis
- [ ] Detect workspace packages
- [ ] Create nested documentation structure:
  ```
  docs/monorepo-name/
  ├── README.md (overview)
  ├── packages/
  │   ├── package-a/
  │   │   ├── README.md
  │   │   └── API.md
  │   └── package-b/
  ```
- [ ] Handle inter-package dependencies
- [ ] Generate package relationship diagram

### 5. Library/Tools Analysis
- [ ] Identify individual tools
- [ ] Create structure:
  ```
  docs/library-name/
  ├── README.md (overview)
  ├── tools/
  │   ├── tool-1/
  │   │   ├── README.md
  │   │   ├── API.md
  │   │   └── USAGE.md
  ```
- [ ] Document each tool separately
- [ ] Create tool index

### 6. Standard Application Analysis
- [ ] Identify architecture patterns
- [ ] Detect frameworks (React, Vue, Angular, etc.)
- [ ] Find API routes
- [ ] Locate configuration files
- [ ] Standard documentation structure

## Output Interface
```typescript
interface ProjectAnalysis {
  projectPath: string
  projectType: 'monorepo' | 'library' | 'tools' | 'application'
  projectName: string
  files: AnalyzedFile[]
  skippedFiles: string[]
  statistics: ProjectStats
  structure: DocumentationStructure
  metadata: ProjectMetadata
}
```

## Testing Checklist
- [ ] Correctly detects monorepo
- [ ] Correctly detects library/tools
- [ ] Correctly detects application
- [ ] Handles permission errors gracefully
- [ ] Generates appropriate structure
- [ ] Tracks skipped files
- [ ] Statistics are accurate

## Files to Create
1. `src/core/ProjectTypeDetector.ts`
2. `src/core/ProjectAnalyzer.ts`
3. `src/core/FileScanner.ts`
4. `src/utils/gitignore.ts` (helper)