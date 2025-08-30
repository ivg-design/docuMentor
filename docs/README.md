# DocuMentor

> Intelligent documentation generator with AI-powered analysis, Obsidian integration, and comprehensive code understanding

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/docuMentor)
[![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-purple.svg)](LICENSE)

## Overview

DocuMentor is a sophisticated documentation generation tool that analyzes codebases using Claude AI to create comprehensive, well-structured documentation. It features deep Obsidian vault integration, intelligent tagging, code verification, and real-time progress monitoring with an advanced terminal UI.

## Key Features

### 🎯 Core Capabilities
- **AI-Powered Analysis**: Leverages Claude AI for intelligent code understanding and documentation generation
- **Obsidian Integration**: Full compatibility with Obsidian vaults, including backlinks, tags, and frontmatter
- **Multi-Project Support**: Analyze and document multiple projects simultaneously
- **Code Verification**: Validates documented functionality to ensure accuracy
- **Safety First**: Built-in safety validation, backup systems, and file integrity checks

### ✨ Advanced Features
- **Full Monty Mode**: Comprehensive documentation with quality scores and metrics
- **GitHub Monitoring**: Track repository changes and auto-generate commit documentation
- **Smart Tag Management**: Intelligent tag consolidation and hierarchy management
- **Terminal Dashboard**: Real-time progress tracking with interrupt handling
- **Streaming Processing**: Efficient handling of large codebases with streaming APIs
- **Lock File System**: Resume interrupted documentation sessions

## Installation

### Prerequisites
- Node.js 16.0.0 or higher
- npm or yarn package manager
- Claude API access (via @anthropic-ai/claude-code)

### Install from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/docuMentor.git
cd docuMentor

# Install dependencies
npm install

# Build the project
npm run build

# Link globally (optional)
npm link
```

### Quick Start

```bash
# Generate documentation for current directory
documentor generate

# Generate for specific project
documentor generate ~/projects/my-app

# Full comprehensive documentation
documentor full-monty ~/projects/my-app
```

## Usage Examples

### Basic Documentation Generation

```bash
# Generate docs with default settings
documentor generate ./my-project

# Specify output location
documentor generate ./my-project -o ~/Documents/docs

# Skip code verification for faster generation
documentor generate ./my-project --no-verify

# Update existing documentation
documentor generate ./my-project --update
```

### Configuration Management

```bash
# View current configuration
documentor config --show

# Set default target path
documentor config --set-path ~/projects

# Set Obsidian vault location
documentor config --set-vault ~/obsidian-vault

# Validate configuration
documentor config --validate
```

### GitHub Repository Monitoring

```bash
# Add repository to monitor
documentor monitor --add facebook/react

# Start monitoring with 10-minute intervals
documentor monitor --start --interval 10

# List monitored repositories
documentor monitor --list

# Remove repository
documentor monitor --remove facebook/react
```

### Safety and Validation

```bash
# Check directory safety before documentation
documentor safety --check ./sensitive-project

# Create backup before processing
documentor safety --backup ./important-project

# Generate safety report
documentor safety --report
```

### Advanced Operations

```bash
# Comprehensive "Full Monty" documentation
documentor full-monty ./project --verbose

# Verify code functionality only
documentor verify ./project

# Analyze project structure
documentor analyze ./project

# Generate tag index for Obsidian vault
documentor tags --generate-index

# Self-document the DocuMentor tool
documentor self-document
```

## Architecture Overview

### Component Structure

```
DocuMentor/
├── Core Engine
│   ├── FixedDocumentationAgent     # Main documentation orchestrator
│   ├── FullMontyGeneratorV3        # Comprehensive documentation generator
│   ├── ProjectAnalyzer             # Project structure analysis
│   └── MultiProjectAnalyzer        # Parallel multi-project processing
│
├── AI Integration
│   ├── EnhancedClaudeClientV2      # Claude AI client with retry logic
│   ├── ClaudeStreamClient          # Streaming API integration
│   └── claudeCodeClient            # Core Claude API wrapper
│
├── Safety & Validation
│   ├── SafetyValidator             # File safety and integrity checks
│   ├── CodeVerifier                # Code functionality validation
│   └── SimpleLockFile              # Session state management
│
├── Obsidian Integration
│   ├── ObsidianFormatter           # Markdown formatting for Obsidian
│   ├── ObsidianLinker              # Cross-reference and backlink generation
│   ├── SmartTagManager             # Intelligent tag management
│   └── ImprovedFrontmatterGenerator # YAML frontmatter creation
│
├── UI & Reporting
│   ├── UltraTerminalUI             # Advanced terminal dashboard
│   ├── StreamingReporter           # Real-time progress reporting
│   └── DocumentationAuditor        # Documentation quality analysis
│
└── Utilities
    ├── ConfigManager               # Configuration handling
    ├── ContentCleaner              # Content sanitization
    └── GitHubMonitor               # Repository change tracking
```

### Data Flow

1. **Input Processing**: CLI command parsed by Commander.js
2. **Configuration Loading**: Settings loaded from `~/.documentor/config.json`
3. **Safety Validation**: Target directory checked for safety
4. **Project Analysis**: Structure and dependencies analyzed
5. **AI Processing**: Claude AI generates documentation
6. **Formatting**: Content formatted for Obsidian
7. **Tag Management**: Tags consolidated and managed
8. **Output Generation**: Files written to Obsidian vault

## Configuration

DocuMentor uses a JSON configuration file located at `~/.documentor/config.json`.

### Configuration Structure

```json
{
  "obsidianVaultPath": "~/obsidian-vault/docs",
  "defaultTargetPath": "~/projects",
  "excludePaths": [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/build/**"
  ],
  "maxTags": 10,
  "safetyMode": {
    "enabled": true,
    "backupBeforeWrite": true,
    "maxFileSize": 10485760
  },
  "github": {
    "enabled": false,
    "accessToken": "",
    "webhookSecret": ""
  },
  "monitoring": {
    "autoSave": true,
    "saveInterval": 60000
  }
}
```

### Environment Variables

- `CLAUDE_API_KEY`: Your Claude API key (required)
- `DOCUMENTOR_CONFIG`: Custom config file path
- `DOCUMENTOR_VAULT`: Override Obsidian vault path
- `DOCUMENTOR_DEBUG`: Enable debug logging

## Contributing Guidelines

We welcome contributions! Please follow these guidelines:

### Development Setup

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit with descriptive messages
6. Push to your branch
7. Open a Pull Request

### Code Style

- TypeScript strict mode enabled
- Use async/await for asynchronous operations
- Follow existing patterns in the codebase
- Add JSDoc comments for public APIs
- Keep functions focused and single-purpose

### Testing

```bash
# Run tests (when available)
npm test

# Build the project
npm run build

# Run in development mode
npm run dev
```

### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## API Documentation

### CLI Commands

| Command | Description | Options |
|---------|-------------|---------|
| `generate [path]` | Generate documentation | `-o`, `--no-verify`, `--update`, `-e` |
| `full-monty [path]` | Comprehensive documentation | `-v, --verbose` |
| `monitor` | GitHub repository monitoring | `--add`, `--remove`, `--list`, `--start` |
| `config` | Configuration management | `--show`, `--edit`, `--validate`, `--reset` |
| `safety` | Safety validation | `--check`, `--backup`, `--restore`, `--report` |
| `verify [path]` | Code verification only | - |
| `analyze [path]` | Project structure analysis | - |
| `tags` | Tag management | `--generate-index`, `--scan` |
| `self-document` | Document DocuMentor itself | - |

### Core Classes

#### FixedDocumentationAgent
Main orchestrator for documentation generation.

```typescript
const agent = new FixedDocumentationAgent({
  targetPath: string,
  outputPath?: string,
  excludePaths?: string[],
  verifyCode?: boolean,
  updateExisting?: boolean
});
```

#### SafetyValidator
Ensures file and directory safety before operations.

```typescript
const validator = new SafetyValidator();
const result = await validator.validateDirectory(path);
```

#### SmartTagManager
Manages Obsidian tags intelligently.

```typescript
const tagManager = new SmartTagManager(vaultPath, projectName);
await tagManager.loadExistingTags();
```

## Troubleshooting

### Common Issues

**Issue**: Documentation generation interrupted
- **Solution**: DocuMentor automatically saves state. Run the same command to resume.

**Issue**: Claude API rate limits
- **Solution**: Built-in retry logic handles rate limits automatically.

**Issue**: Large repository takes too long
- **Solution**: Use `--no-verify` to skip code verification, or exclude unnecessary paths.

**Issue**: Obsidian vault not found
- **Solution**: Set vault path with `documentor config --set-vault <path>`

### Debug Mode

Enable detailed logging:
```bash
DOCUMENTOR_DEBUG=true documentor generate ./project
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Claude AI](https://claude.ai) by Anthropic
- Terminal UI powered by [Chalk](https://github.com/chalk/chalk)
- CLI framework by [Commander.js](https://github.com/tj/commander.js)

## Support

For issues, questions, or suggestions:
- Open an issue on [GitHub](https://github.com/yourusername/docuMentor/issues)
- Check [documentation](./docs) for detailed guides
- Review [examples](./docs/EXAMPLES.md) for common use cases

---

*DocuMentor v2.0.0 - Intelligent Documentation, Simplified*