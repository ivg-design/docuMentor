# DocuMentor

DocuMentor is an intelligent documentation generator that uses AI-powered analysis to create comprehensive, well-structured documentation for any codebase. It features deep integration with Obsidian, multi-phase processing, and real-time monitoring capabilities.

## Features

### Core Capabilities
- **AI-Powered Documentation** - Utilizes Claude Opus 4.1 for intelligent code analysis and documentation generation
- **Multi-Language Support** - Analyzes TypeScript, JavaScript, Python, Go, Rust, Java, and more
- **9-Phase Processing Pipeline** - Comprehensive documentation workflow from analysis to final output
- **Real-Time TUI Display** - Interactive terminal interface for monitoring generation progress

### Obsidian Integration
- **Smart Frontmatter Generation** - Automatic metadata creation with tags, categories, and relationships
- **Tag Optimization** - Intelligent tag hierarchy creation with configurable limits
- **Backlink Generation** - Automatic cross-referencing between related documentation
- **Dataview Support** - Query-ready documentation structure

### Advanced Features
- **File Watch Mode** - Monitor directories for changes and auto-regenerate documentation
- **GitHub Integration** - Track repository changes and document on commits/PRs
- **Security Validation** - Built-in permission system with password protection
- **Lock File Management** - Prevents concurrent documentation runs and tracks state

## Installation

### Using npm
```bash
npm install -g documentor
```

### Using Prebuilt Binaries
Download the appropriate binary for your platform:
- Linux: `documentor-linux`
- macOS: `documentor-macos`
- Windows: `documentor-win.exe`

### Building from Source
```bash
git clone https://github.com/yourusername/documentor.git
cd documentor
npm install
npm run build
npm run pkg  # Creates platform-specific binaries
```

## Configuration

DocuMentor uses a configuration file `.documentor.config.json` for project settings. Initialize a new configuration:

```bash
documentor config init
```

### Configuration Options

```json
{
  "version": "3.1.0",
  "project": {
    "name": "auto-detect",
    "type": "auto"
  },
  "output": {
    "path": "~/docs",
    "format": "obsidian",
    "features": {
      "frontmatter": true,
      "backlinks": true,
      "tags": {
        "optimize": true,
        "hierarchy": true,
        "minPerDoc": 3
      }
    }
  },
  "claude": {
    "model": "claude-opus-4-1-20250805",
    "maxTokens": 200000,
    "temperature": 0.3
  }
}
```

## Usage

### Generate Documentation
```bash
documentor generate /path/to/project
```

Options:
- `-o, --output <path>` - Override output directory
- `-f, --format <type>` - Output format (obsidian|markdown)
- `-v, --verbose` - Enable verbose logging
- `--no-permission` - Skip security prompts

### Watch Mode
Monitor a directory for changes and regenerate documentation automatically:

```bash
documentor watch /path/to/project
```

### GitHub Monitoring
Track GitHub repositories and document changes:

```bash
documentor github-watch username/repository
```

### Self Documentation
Generate documentation for DocuMentor itself:

```bash
documentor self-document
```

### Project Analysis
Analyze a project without generating documentation:

```bash
documentor analyze /path/to/project
```

### Verify Documentation
Check documentation integrity and completeness:

```bash
documentor verify /path/to/docs
```

## Processing Phases

DocuMentor uses a 9-phase processing pipeline:

1. **Analysis** - Project structure and type detection
2. **Security** - Permission validation and safety checks
3. **Generation** - Core documentation creation
4. **Enhancement** - AI-powered content enrichment
5. **Obsidian Integration** - Vault structure and metadata
6. **Tag Optimization** - Smart tag hierarchy creation
7. **Backlink Generation** - Cross-reference creation
8. **Verification** - Quality and completeness checks
9. **Save** - Final output and state persistence

## API Key Setup

DocuMentor requires a Claude API key for AI-powered features:

1. Get an API key from [Anthropic Console](https://console.anthropic.com)
2. Set the environment variable:
   ```bash
   export CLAUDE_API_KEY="your-api-key-here"
   ```
3. Or add to your shell configuration file

## Output Formats

### Obsidian Format
Creates documentation optimized for Obsidian vaults with:
- Structured frontmatter with tags and metadata
- Automatic backlinks between related documents
- Tag hierarchy for navigation
- Dataview-compatible properties

### Markdown Format
Standard markdown documentation suitable for:
- GitHub repositories
- Static site generators
- General documentation needs

## Project Structure

```
documentor/
├── src/
│   ├── cli/           # Command-line interface
│   ├── core/          # Core processing modules
│   ├── tui/           # Terminal UI (Go)
│   └── utils/         # Utility functions
├── templates/         # Documentation templates
├── bin/              # Compiled binaries
└── dist/             # TypeScript build output
```

## Development

### Requirements
- Node.js >= 18.0.0
- TypeScript 5.0+
- Go 1.21+ (for TUI)

### Setup
```bash
git clone https://github.com/yourusername/documentor.git
cd documentor
npm install
npm run dev  # Development mode with ts-node
```

### Building
```bash
npm run build       # TypeScript compilation
npm run pkg:macos   # Platform-specific binary
```

### Testing
```bash
npm run lint        # ESLint checks
npm test           # Run test suite
```

## Architecture

DocuMentor employs a modular architecture with:

- **Command Layer** - CLI commands and argument parsing
- **Core Engine** - Documentation generation and processing
- **Claude Client** - AI model integration
- **File System** - Secure file operations and scanning
- **TUI Adapter** - Terminal interface communication
- **Phase Manager** - Orchestrates multi-phase processing

## Performance

### Efficient Mode
Enable parallel processing for large codebases:

```bash
export DOCUMENTOR_EFFICIENT=true
documentor generate /path/to/project
```

This mode features:
- Parallel file processing
- Queue-based document generation
- Optimized memory usage
- Progress reporting

## Troubleshooting

### Common Issues

**API Key Not Found**
```bash
export CLAUDE_API_KEY="sk-ant-..."
```

**Permission Denied**
- Check output directory permissions
- Use `--no-permission` flag if security prompts fail

**Lock File Exists**
- Remove stale lock file: `rm .documentor.lock`
- Check for running instances

### Debug Mode
```bash
documentor generate /path/to/project --verbose
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Commit changes with clear messages
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- Issues: [GitHub Issues](https://github.com/yourusername/documentor/issues)
- Documentation: [Wiki](https://github.com/yourusername/documentor/wiki)
- Discussions: [GitHub Discussions](https://github.com/yourusername/documentor/discussions)