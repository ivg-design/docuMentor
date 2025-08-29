# DocuMentor Usage Guide

## Table of Contents
- [Getting Started](#getting-started)
- [Installation Steps](#installation-steps)
- [Configuration Options](#configuration-options)
- [Common Use Cases](#common-use-cases)
- [Command Line Interface](#command-line-interface)
- [Troubleshooting](#troubleshooting)

## Getting Started

DocuMentor is an intelligent, AI-powered documentation generator that transforms codebases into comprehensive, Obsidian-compatible documentation. It leverages Claude AI to analyze code structure, verify functionality, and create interconnected documentation with automated tagging and cross-referencing.

### Prerequisites

Before installing DocuMentor, ensure you have:

- **Node.js** version 16.0.0 or higher
- **npm** (version 8+) or **yarn** (version 1.22+)
- **Claude Code SDK** with an active subscription
- **Git** version 2.0 or higher (for version control features)
- **Obsidian** (optional, for viewing generated documentation)

### Quick Start

1. Clone and install DocuMentor
2. Configure your settings (especially the Obsidian vault path)
3. Run `documentor generate` on your project
4. View the generated documentation in Obsidian

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/docuMentor.git
cd docuMentor
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build the Project

```bash
npm run build
```

### 4. Link Globally for CLI Access

```bash
npm link
```

This makes the `documentor` command available globally on your system.

### 5. Verify Installation

```bash
documentor --version
```

You should see: `2.0.0`

### 6. Initial Configuration

On first run, DocuMentor will automatically create a default configuration file at `~/.documentor/config.json`. You can customize it using:

```bash
documentor config --edit
```


## Configuration Options

DocuMentor uses a hierarchical configuration system:

1. **Default Configuration** - Built-in defaults
2. **User Configuration** - `~/.documentor/config.json`
3. **Project Configuration** - `.documentor.json` in project root
4. **Environment Variables** - Override specific settings
5. **CLI Arguments** - Highest priority

### Core Configuration Settings

#### Basic Settings

| Setting | Description | Default |
|---------|-------------|------|
| `defaultTargetPath` | Default project path to document | `null` (uses current directory) |
| `obsidianVaultPath` | Path to your Obsidian vault | `~/github/obsidian_vault/docs` |
| `excludePaths` | Patterns to exclude from documentation | `node_modules`, `.git`, `dist`, etc. |
| `verifyCode` | Whether to verify code functionality | `true` |
| `generateBacklinks` | Create Obsidian backlinks | `true` |
| `maxTags` | Maximum tags per document | `10` |

#### Safety Mode Settings

| Setting | Description | Default |
|---------|-------------|------|
| `safetyMode.enabled` | Enable safety checks | `true` |
| `safetyMode.backupBeforeWrite` | Create backups before writing | `true` |
| `safetyMode.maxFileSize` | Maximum file size in MB | `50` |
| `safetyMode.validateJson` | Validate JSON/YAML files | `true` |

#### GitHub Integration

| Setting | Description | Default |
|---------|-------------|------|
| `github.enabled` | Enable GitHub monitoring | `false` |
| `github.accessToken` | GitHub Personal Access Token | `""` |
| `github.repositories` | List of repos to monitor | `[]` |
| `github.pollInterval` | Check interval in minutes | `5` |

#### Full Monty Settings

| Setting | Description | Default |
|---------|-------------|------|
| `fullMonty.analyzeCode` | Perform code analysis | `true` |
| `fullMonty.generateDiagrams` | Create architecture diagrams | `false` |
| `fullMonty.analyzeSecurity` | Security vulnerability analysis | `true` |
| `fullMonty.generateMetrics` | Generate quality metrics | `true` |

### Environment Variables

```bash
export CLAUDE_API_KEY="sk-ant-..."
export DOCUMENTOR_VAULT="/path/to/obsidian/vault"
export DOCUMENTOR_LOG_LEVEL="debug"  # debug, info, warn, error
export EDITOR="code"  # for config --edit command
```

### Managing Configuration

```bash
# View current configuration
documentor config --show

# Edit configuration in your default editor
documentor config --edit

# Validate configuration
documentor config --validate

# Set specific values
documentor config --set-path /default/project/path
documentor config --set-vault /path/to/obsidian/vault

# Reset to defaults
documentor config --reset
```

## Common Use Cases

### 1. Document a New Project

```bash
# Document current directory
documentor generate

# Document specific project
documentor generate /path/to/project

# With custom output location
documentor generate /path/to/project --output /custom/docs
```

### 2. Update Existing Documentation

```bash
# Update without overwriting manual edits
documentor generate /path/to/project --update

# Skip verification for faster updates
documentor generate /path/to/project --no-verify
```

### 3. Comprehensive Documentation (Full Monty)

```bash
# Generate complete documentation suite with all analyses
documentor full-monty /path/to/project

# With verbose output for debugging
documentor full-monty /path/to/project --verbose
```

### 4. Monitor GitHub Repositories

```bash
# Add a repository to monitor
documentor monitor --add owner/repo

# Start monitoring with 10-minute intervals
documentor monitor --start --interval 10

# List monitored repositories
documentor monitor --list

# Stop monitoring
documentor monitor --stop
```

### 5. Document Multiple Projects (Monorepo)

```bash
# DocuMentor automatically detects monorepo structures
documentor generate /path/to/monorepo

# It will document each package/project separately
# and create cross-references between them
```

### 6. Quick Project Analysis

```bash
# Analyze project structure without generating docs
documentor analyze /path/to/project

# Verify code functionality without documentation
documentor verify /path/to/project
```

### 7. Safety Operations

```bash
# Check if a directory is safe to document
documentor safety --check /path/to/project

# Create a manual backup
documentor safety --backup /path/to/project

# Clean old backups (older than 7 days)
documentor safety --cleanup
```

## Command Line Interface

### Main Commands

#### `documentor generate [path] [options]`

Generate documentation for a codebase.

**Arguments:**
- `path` - Path to the codebase (optional, defaults to current directory or config default)

**Options:**
- `-o, --output <path>` - Custom output path for documentation
- `--no-verify` - Skip code functionality verification
- `--update` - Update existing documentation without overwriting
- `-e, --exclude <paths...>` - Additional paths to exclude

**Examples:**
```bash
documentor generate
documentor generate ./my-project
documentor generate ~/projects/app --output ~/docs
documentor generate . --exclude "**/test/**" "**/vendor/**"
```

#### `documentor full-monty [path] [options]`

Generate comprehensive documentation with all features enabled.

**Arguments:**
- `path` - Path to document (optional)

**Options:**
- `-v, --verbose` - Enable verbose output

**Example:**
```bash
documentor full-monty ./my-project --verbose
```

#### `documentor monitor [options]`

Monitor GitHub repositories for changes and auto-document.

**Options:**
- `--add <repo>` - Add repository (format: owner/repo)
- `--remove <repo>` - Remove repository
- `--list` - List monitored repositories
- `--start` - Start monitoring
- `--stop` - Stop monitoring
- `--interval <minutes>` - Polling interval (default: 5)

**Examples:**
```bash
documentor monitor --add facebook/react
documentor monitor --start --interval 15
documentor monitor --list
```

#### `documentor config [options]`

Manage DocuMentor configuration.

**Options:**
- `--show` - Display current configuration
- `--edit` - Open configuration in editor
- `--validate` - Validate configuration
- `--reset` - Reset to defaults
- `--set-path <path>` - Set default target path
- `--set-vault <path>` - Set Obsidian vault path

#### `documentor safety [options]`

Safety and integrity checks.

**Options:**
- `--check <path>` - Check directory safety
- `--backup <path>` - Create backup
- `--cleanup` - Clean old backups
- `--report` - Show safety report

#### `documentor verify [path]`

Verify code functionality without generating documentation.

#### `documentor analyze [path]`

Analyze project structure and display results.

#### `documentor tags [options]`

Manage Obsidian tags.

**Options:**
- `--scan` - Scan vault for tags
- `--generate-index` - Generate tag index page

#### `documentor self-document`

Generate documentation for DocuMentor itself.

### Global Options

- `--version` - Display version
- `--help` - Display help for command

## Troubleshooting

### Common Issues and Solutions

#### 1. Permission Denied Errors

**Problem:** Cannot write to output directory or config file.

**Solution:**
```bash
# Check directory permissions
ls -la ~/.documentor

# Fix permissions if needed
chmod 755 ~/.documentor
chmod 644 ~/.documentor/config.json
```

#### 2. Claude API Connection Issues

**Problem:** "Claude API key not found" or connection errors.

**Solution:**
```bash
# Set your API key
export CLAUDE_API_KEY="sk-ant-..."

# Or add to config
documentor config --edit
# Add under "api": { "claudeApiKey": "sk-ant-..." }
```

#### 3. Documentation Not Appearing in Obsidian

**Problem:** Generated documentation not visible in Obsidian.

**Solution:**
1. Verify the vault path is correct:
   ```bash
   documentor config --show
   ```
2. Check if files were created:
   ```bash
   ls -la ~/github/obsidian_vault/docs
   ```
3. Restart Obsidian or reload the vault

#### 4. Process Hangs or Doesn't Complete

**Problem:** Documentation generation seems stuck.

**Solution:**
- Use `Ctrl+C` to interrupt safely (progress is saved)
- Check for lock files:
  ```bash
  rm ~/.documentor/*.lock
  ```
- Run with verbose mode for more details:
  ```bash
  documentor generate --verbose
  ```

#### 5. Out of Memory Errors

**Problem:** Large projects cause memory issues.

**Solution:**
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
documentor generate /large/project
```

#### 6. Excluded Files Still Being Documented

**Problem:** Files that should be excluded are being processed.

**Solution:**
- Check exclude patterns in config:
  ```bash
  documentor config --show
  ```
- Use additional excludes:
  ```bash
  documentor generate . --exclude "**/build/**" "**/cache/**"
  ```

### Debug Mode

For detailed troubleshooting, enable debug logging:

```bash
export DOCUMENTOR_LOG_LEVEL="debug"
documentor generate /path/to/project
```

### Getting Help

1. **Check the logs:**
   ```bash
   cat ~/.documentor/documentor.log
   ```

2. **Validate your configuration:**
   ```bash
   documentor config --validate
   ```

3. **Run safety check:**
   ```bash
   documentor safety --check /path/to/project
   ```

4. **View system information:**
   ```bash
   documentor --version
   node --version
   npm --version
   ```

### Reporting Issues

If you encounter persistent issues:

1. Check existing issues: https://github.com/yourusername/docuMentor/issues
2. Create a new issue with:
   - DocuMentor version
   - Node.js version
   - Error messages
   - Steps to reproduce
   - Configuration (sanitized)

### Best Practices

1. **Regular Backups:** Keep safety mode enabled for automatic backups
2. **Incremental Updates:** Use `--update` flag for existing projects
3. **Monitor Resources:** For large projects, monitor memory usage
4. **Test First:** Try on a small project before documenting large codebases
5. **Review Output:** Always review generated documentation for accuracy
6. **Custom Excludes:** Exclude test files, vendor directories, and build artifacts
7. **Use Full Monty Sparingly:** It's comprehensive but resource-intensive

---

For more information, see the [README](README.md) or visit the [GitHub repository](https://github.com/yourusername/docuMentor).