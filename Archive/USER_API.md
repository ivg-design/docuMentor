# DocuMentor User API & Command Structure

## Installation

```bash
# Install globally
npm install -g documentor

# Or use directly with npx
npx documentor generate ./my-project
```

## Basic Commands

### 1. `documentor generate` - Standard Documentation
Generate complete documentation for a project:

```bash
# Basic usage - generates docs in ~/obsidian_vault/docs/
documentor generate /path/to/project

# With options
documentor generate ./my-project \
  --output ~/my-docs \
  --format obsidian \
  --verbose

# Short form
doc gen ./my-project
```

**Options:**
- `--output, -o` : Output directory (default: `~/obsidian_vault/docs/`)
- `--format, -f` : Output format: `obsidian`, `markdown`, `json` (default: `obsidian`)
- `--verbose, -v` : Show detailed progress
- `--no-permission` : Never request password, skip restricted files
- `--config, -c` : Use specific config file
- `--include-tests` : Include test files in documentation
- `--max-depth` : Maximum directory depth to scan (default: 10)

### 2. `documentor analyze` - Analysis Only
Analyze project without generating documentation:

```bash
# Analyze and display project structure
documentor analyze ./my-project

# Output analysis to file
documentor analyze ./my-project --output analysis.json

# With specific focus
documentor analyze ./my-project --focus architecture
documentor analyze ./my-project --focus dependencies
documentor analyze ./my-project --focus security
```

**Options:**
- `--focus` : Specific analysis type: `architecture`, `dependencies`, `security`, `quality`
- `--output, -o` : Save analysis to file
- `--depth` : Analysis depth: `shallow`, `normal`, `deep` (default: `normal`)

### 3. `documentor watch` - Live Documentation
Monitor project and auto-update documentation:

```bash
# Watch for changes and regenerate
documentor watch ./my-project

# Watch specific files/patterns
documentor watch ./my-project --include "src/**/*.ts" --exclude "test/**"

# With debounce
documentor watch ./my-project --debounce 5000
```

**Options:**
- `--include, -i` : Glob patterns to watch
- `--exclude, -e` : Glob patterns to ignore
- `--debounce, -d` : Debounce time in ms (default: 2000)
- `--incremental` : Only update changed files

### 4. `documentor update` - Update Existing Docs
Update existing documentation without full regeneration:

```bash
# Update all docs for project
documentor update ./my-project

# Update specific files only
documentor update ./my-project --files "src/index.ts,src/api.ts"

# Update with new analysis
documentor update ./my-project --reanalyze
```

**Options:**
- `--files, -f` : Specific files to update
- `--reanalyze` : Force re-analysis
- `--preserve-custom` : Keep manual edits in docs

### 5. `documentor verify` - Verify Documentation
Check documentation quality and completeness:

```bash
# Basic verification
documentor verify ./my-project

# With specific checks
documentor verify ./my-project --check completeness
documentor verify ./my-project --check links
documentor verify ./my-project --check outdated

# Fix issues automatically
documentor verify ./my-project --fix
```

**Options:**
- `--check` : Specific checks: `completeness`, `links`, `outdated`, `quality`
- `--fix` : Attempt to fix issues automatically
- `--report` : Generate verification report

### 6. `documentor config` - Configuration Management

```bash
# Initialize config for project
documentor config init

# Show current configuration
documentor config show

# Set configuration values
documentor config set output.path ~/my-docs
documentor config set display.format raw
documentor config set permissions.requestPassword false

# Edit config in editor
documentor config edit
```

### 7. `documentor list` - List Generated Documentation

```bash
# List all generated documentation
documentor list

# List for specific project
documentor list --project my-project

# With details
documentor list --detailed
```

## Configuration File

`.documentor/config.json` in project root:

```json
{
  "version": "3.1.0",
  "project": {
    "name": "my-project",
    "description": "My awesome project",
    "type": "auto"
  },
  "output": {
    "path": "~/obsidian_vault/docs",
    "format": "obsidian",
    "structure": "nested"
  },
  "analysis": {
    "depth": "normal",
    "includTests": false,
    "includeNodeModules": false,
    "maxFileSize": "10MB"
  },
  "generation": {
    "phases": ["analysis", "generation", "enhancement", "formatting", "save"],
    "templates": "default",
    "style": "comprehensive"
  },
  "permissions": {
    "requestPassword": true,
    "skipOnDenial": true,
    "importantPaths": ["src", "lib", "config"]
  },
  "display": {
    "format": "normal",
    "colors": true,
    "showProgress": true,
    "showSkipped": true
  },
  "claude": {
    "model": "claude-3-opus",
    "maxTokens": 100000,
    "temperature": 0.3
  },
  "ignore": [
    "node_modules",
    ".git",
    "dist",
    "build",
    "*.log",
    "*.tmp"
  ]
}
```

## Display Modes

### Normal Mode (Default)
Clean, colored output with progress indicators:
```
DocuMentor v3.1.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 Project: my-awesome-project
📍 Output:  ~/obsidian_vault/docs/my-awesome-project

[1/5] Analysis
  ✓ Scanning project structure
  ✓ Detecting project type: Node.js/TypeScript
  ✓ Found 156 files to document
  ⚠️ Skipped 3 files (no permission)

[2/5] Generation
  → Generating README.md...
  → Generating API.md...
  → Generating ARCHITECTURE.md...

Progress: ████████████░░░░░░░░ 60%
Files: 93/156 | Time: 00:02:34
```

### Raw Mode (`--display raw`)
Plain text for scripting:
```
PHASE:ANALYSIS
TASK:SCAN_FILES
FILES_FOUND:156
FILES_SKIPPED:3
PHASE:GENERATION
TASK:README
TASK:API
PROGRESS:60
```

### Debug Mode (`--display debug`)
Full JSON output:
```json
{"type":"phase","timestamp":"2024-01-01T10:00:00Z","data":{"current":1,"total":5,"name":"Analysis"}}
{"type":"task","timestamp":"2024-01-01T10:00:01Z","data":{"name":"scan_files","status":"complete"}}
{"type":"file","timestamp":"2024-01-01T10:00:02Z","data":{"path":"src/index.ts","operation":"read","success":true}}
```

### Quiet Mode (`--quiet`)
Minimal output:
```
✓ Documentation generated: ~/obsidian_vault/docs/my-project
  156 files processed (3 skipped)
  Time: 2m 34s
```

## Interactive Mode

### With TUI (`--interactive` or default when TTY detected)
Full terminal UI with real-time updates:
```
╔════════════════════════════════════════════════════════════════╗
║ DocuMentor v3.1.0 - my-awesome-project                        ║
╠════════════════════════════════════════════════════════════════╣
║ Phase:    2/5 Generation                                       ║
║ Task:     3/4 Creating API Documentation                      ║
║ Progress: ████████████░░░░░░░░░░░░░░░░░░ 45%                 ║
╠════════════════════════════════════════════════════════════════╣
║ [10:23:45] 📄 Reading: src/api/users.ts                       ║
║ [10:23:46] 🔍 Analyzing: Class UserController                 ║
║ [10:23:47] ✍️  Writing: API.md                                 ║
╠════════════════════════════════════════════════════════════════╣
║ Files: 45/156 | Memory: 125MB | Time: 00:02:34                ║
║ Status: Processing src/api/auth.ts                            ║
╚════════════════════════════════════════════════════════════════╝
```

## Common Use Cases

### 1. First-Time Documentation
```bash
# Initialize and generate
cd my-project
documentor config init
documentor generate .
```

### 2. CI/CD Integration
```bash
# In CI pipeline
documentor generate . \
  --output ./docs \
  --format markdown \
  --no-permission \
  --quiet
```

### 3. Development Workflow
```bash
# Watch mode during development
documentor watch . \
  --incremental \
  --debounce 5000
```

### 4. Documentation Audit
```bash
# Check documentation quality
documentor verify . --check all --report audit.html
```

### 5. Monorepo Documentation
```bash
# Document entire monorepo
documentor generate . --monorepo

# Document specific package
documentor generate packages/my-package
```

## Permission Handling

When DocuMentor encounters files it cannot access:

### Interactive Mode (Default)
```
╔════════════════════════════════════════════════════════════════╗
║                     Permission Required                        ║
╠════════════════════════════════════════════════════════════════╣
║ Cannot access: /etc/nginx/nginx.conf                          ║
║ This file appears important for documentation.                 ║
║                                                                ║
║ Enter password to access with sudo, or Cancel to skip.        ║
║                                                                ║
║ Password: ••••••••                                            ║
║                                                                ║
║        [Submit]                    [Cancel]                    ║
╚════════════════════════════════════════════════════════════════╝
```

### Non-Interactive Mode
```bash
# Never prompt for password
documentor generate . --no-permission

# Output:
⚠️  Skipped 3 files due to permissions:
   - /etc/nginx/nginx.conf
   - /var/log/app.log
   - /root/.ssh/config
✓ Generated documentation with 153/156 files
```

## Environment Variables

```bash
# Set default output path
export DOCUMENTOR_OUTPUT="~/my-docs"

# Set default format
export DOCUMENTOR_FORMAT="markdown"

# Disable password prompts
export DOCUMENTOR_NO_PASSWORD="true"

# Set Claude model
export DOCUMENTOR_CLAUDE_MODEL="claude-3-opus"

# Enable debug logging
export DOCUMENTOR_DEBUG="true"
```

## Output Structure

### Obsidian Format (Default)
```
~/obsidian_vault/docs/
└── my-project/
    ├── README.md           # Project overview
    ├── ARCHITECTURE.md     # System architecture
    ├── API.md             # API documentation
    ├── SETUP.md           # Installation guide
    ├── CHANGELOG.md       # Change history
    ├── components/        # Component docs
    │   ├── auth.md
    │   ├── database.md
    │   └── api.md
    ├── guides/            # User guides
    │   ├── getting-started.md
    │   └── deployment.md
    └── .tags              # Tag registry
```

### Markdown Format
```
output/
├── index.md
├── api-reference.md
├── architecture.md
├── setup.md
└── components/
    └── ...
```

### JSON Format
```json
{
  "project": "my-project",
  "timestamp": "2024-01-01T10:00:00Z",
  "files": [...],
  "documentation": {
    "readme": "...",
    "api": "...",
    "architecture": "..."
  },
  "metadata": {...}
}
```

## Error Handling

### Permission Errors
```bash
❌ Permission denied: Cannot access /etc/sensitive
   → Run without sudo, or use --no-permission to skip restricted files
```

### Configuration Errors
```bash
❌ Invalid configuration in .documentor/config.json
   Line 5: "output.format" must be one of: obsidian, markdown, json
   → Run 'documentor config init' to create valid config
```

### Claude Errors
```bash
❌ Claude API error: Rate limit exceeded
   → Waiting 30 seconds before retry...
   → Use --no-ai to generate without AI enhancement
```

## Advanced Features

### Custom Templates
```bash
# Use custom templates
documentor generate . --templates ./my-templates

# Template structure:
my-templates/
├── readme.hbs
├── api.hbs
├── component.hbs
└── guide.hbs
```

### Plugins
```bash
# Install plugin
documentor plugin install @documentor/mermaid-diagrams

# Use plugin
documentor generate . --plugins mermaid-diagrams
```

### Export/Import
```bash
# Export documentation
documentor export my-project --format pdf --output docs.pdf

# Import from other formats
documentor import ./swagger.json --format openapi
```

## Getting Help

```bash
# General help
documentor --help
documentor help

# Command-specific help
documentor generate --help
documentor help generate

# Show version
documentor --version

# Check for updates
documentor update-check
```