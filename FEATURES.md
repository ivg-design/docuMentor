# DocuMentor Features

## **Architecture Overview**

Build first with a bash/cli mode so that Claude can run and test and see all output

---

## **1. Claude CLI Bridge**

### Core Integration
- Uses Claude CLI to analyze and document code (NOT API!)
- This is the most important key feature!
- Using `--print --json-stream` toolset
- Letting Claude Code CLI decide what tools to use and when
- Configurable `--dangerously-skip-permissions` flag

### Document Generation
- Create comprehensive documentation from any codebase
- Supports multiple languages (JS, TS, Python, Go, Rust, Java, C/C++)
- Automatic code analysis and understanding
- Recursive documentation generation
- Meta-documentation capabilities

### Processing Features
- Process multiple files simultaneously
- Configurable worker count (default: 4)
- Faster documentation generation
- Efficient resource utilization
- Automatic retry with backoff

---

## **2. Obsidian Bridge**

### Vault Integration
- Generate Obsidian-compatible markdown
- Create automatic backlinks between documents
- Add rich frontmatter metadata
- Dataview-compatible fields
- Graph view support

### Advanced Features
- Smart hierarchical tagging system
- AI-driven tag review/consolidation/optimization and reporting
- Map of Content (MOC) generation
- Mermaid functional diagrams
- Advanced tables

### Output Optimization
- Obsidian-optimized markdown formatting
- Frontmatter with metadata
- Backlinks and tags
- Graph view support

---

## **3. Dashboard Bridge**

### Web Interface
- Real-time monitoring interface at `http://localhost:3333`
- View processing progress across 9 phases
- See logs, metrics, and worker status
- Collapsible log entries

### Monitoring Features
- RAW JSON mode to see Claude input/output
- Claude action view (reading/thinking/writing)
- Real-time progress tracking
- Performance metrics (CPU, memory, disk I/O)
- Process PID tracking
- Event-driven updates with real-time streaming

### Dashboard Controls
- Start/stop/pause processing
- Queue management
- Worker pool control
- Phase navigation

---

## **4. GitHub Bridge**

### Repository Monitoring
- Watch GitHub repositories
- Webhook integration for auto-updates
- Track changes across branches
- Automatic documentation on push events

### Integration Features
- GitHub API token storage
- Branch tracking
- Commit-triggered documentation
- Pull request documentation

---

## **5. File System Bridge**

### Watch Mode
- Monitor local folders for changes
- Auto-regenerate docs when files change
- Configurable debounce timing
- Real-time documentation updates

### Smart Processing
- Skip documentation files (README/CHANGELOG)
- Code-first approach (prioritizes source code)
- Large file handling (skip minified/huge files)
- Smart file filtering (process only relevant code)

### File Management
- Path management
- Custom output paths
- Template system
- File permission handling

---

## **6. Configuration System**

### Core Configuration
- Persistent settings via `.documentor.config.json`
- Configurable phase order
- Configurable task order
- Template system

### Advanced Settings
- GitHub API token storage
- Custom output paths
- Worker count configuration
- Processing phase adjustments

---

## **7. Security & Reliability System**

### Security Features
- Password Bridge for secure file handling
- Permission management for elevated access
- Secure token storage
- Safety validation for operations

### Reliability Features
- Lock file management (prevent concurrent processing)
- System for tracking processed/processing projects
- Ensure no competing agents review same repo
- Error recovery with automatic retry

---

## **8. Analysis Engine**

### Project Analysis
- Deep project structure analysis
- Detect project type (monorepo, library, application, tools)
- Map dependencies and relationships
- Identify critical vs. non-critical files
- Code complexity evaluation

### Verification System
- Verify generated documentation accuracy
- Check for missing or outdated docs
- Validate documentation completeness
- Self-documentation capabilities

---

## **9. Processing Pipeline**

### 9-Phase Documentation System
1. **Initialization** - Setup and configuration
2. **Validation** - Check permissions and requirements
3. **Analysis** - Deep code analysis
4. **Preparation** - Prepare for generation
5. **Generation** - Create documentation with Claude
6. **Enhancement** - Add metadata and links
7. **Formatting** - Apply templates and styles
8. **Integration** - Integrate with Obsidian/output format
9. **Finalization** - Complete and save documentation

---

## **10. Usage Interfaces**

### CLI Mode
```bash
documentor generate <project-path> --output <docs-path>
documentor watch <project-path>
documentor verify <docs-path>
documentor self-document
```

### Dashboard Mode
```bash
# Start the web dashboard
npm run dashboard
# Open browser to http://localhost:3333
```

### API Mode
- Programmatic access via TypeScript/JavaScript
- Event-driven architecture
- Full control over processing pipeline
- Custom integration capabilities

---

## **11. Output Formats**

### Standard Markdown
- Standard markdown files
- GitHub-compatible formatting
- Clean, readable documentation

### Obsidian Format
- Obsidian-optimized markdown
- Rich frontmatter metadata
- Automatic backlinks
- Tag hierarchies

### Custom Templates
- Custom templates for different file types
- Configurable documentation structure
- Flexible tagging strategies
- Template inheritance system

---

## **12. Performance Features**

### Optimization
- Processes hundreds of files in minutes
- Parallel processing with worker pools
- Efficient memory management
- Incremental processing support

### Scalability
- Configurable worker pools
- Queue-based processing
- Stream-based file handling
- Memory-efficient operations

---

**Version**: TBD  
**License**: MIT  
**Built with**: TypeScript, Claude CLI, Express, Socket.io