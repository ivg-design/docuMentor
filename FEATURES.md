# DocuMentor Features

## **Core Features**

build first with a bash/cli mode so that claude can run and test and see all output

### 0. **CLAUDE CLI NOT API !!!!**
- Uses Claude CLI to analyze and document code
- this is the most important key feature!
- using --print --json-stream toolset
- using claud code cli efficiently - by letting it decide what tools to use and when
- configurable --dangerously-skip-permissions flag

### 1. **Generate Documentation**
- Create comprehensive documentation from any codebase
- Supports multiple languages (JS, TS, Python, Go, Rust, Java, C/C++)
- Automatic code analysis and understanding

### 2. **Watch Mode**
- Monitor local folders for changes
- Auto-regenerate docs when files change
- Configurable debounce timing
- Real-time documentation updates

### 3. **GitHub Monitoring**
- Watch GitHub repositories
- Webhook integration for auto-updates
- Track changes across branches
- Automatic documentation on push events

### 4. **Web Dashboard**
- Real-time monitoring interface at `http://localhost:3333`
- View processing progress across 9 phases
- See logs, metrics, and worker status
- RAW JSON mode to see Claude input/output
- Claude action view (reading/thinking/writing)
- Collapsible log entries

### 5. **Obsidian Vault Integration**
- Generate Obsidian-compatible markdown
- Create automatic backlinks between documents
- Add rich frontmatter metadata
- Smart hierarchical tagging system
- AI driven tag review/consolidation/optimization and reporting
- Map of Content (MOC) generation
- Dataview-compatible fields
- Mermaid functional diagrams
- Advanced tables

### 6. **Project Analysis**
- Deep project structure analysis
- Detect project type (monorepo, library, application, tools or something else)
- Map dependencies and relationships
- Identify critical vs. non-critical files
- Code complexity evaluation

### 7. **Self-Documentation**
- Document the DocuMentor tool itself
- Recursive documentation generation
- Meta-documentation capabilities

### 8. **Code Verification**
- Verify generated documentation accuracy
- Check for missing or outdated docs
- Validate documentation completeness
- Safety validation for operations

### 10. **Parallel Processing**
- Process multiple files simultaneously
- Configurable worker count (default: 4)
- Faster documentation generation
- Efficient resource utilization

### 11. Config System
- configurable phase order via
- configurable task order
- path management
- github api token storage
- persistent settings via .documentor.config.json in root
- template system
- custom output paths

### 12. Lockfile system
- system for keeping track of processed/processing projects/folders/repositories
- making sure there are no competing agents reviewing the same repo

## **Processing Pipeline**

### 9-Phase Documentation System:
1. **Initialization** - Setup and configuration
2. **Validation** - Check permissions and requirements
3. **Analysis** - Deep code analysis
4. **Preparation** - Prepare for generation
5. **Generation** - Create documentation with Claude
6. **Enhancement** - Add metadata and links
7. **Formatting** - Apply templates and styles
8. **Integration** - Integrate with Obsidian/output format
9. **Finalization** - Complete and save documentation

## **Additional Capabilities**

### Smart Processing
- **Skip Documentation Files** - Ignores existing README/CHANGELOG files
- **Code-First Approach** - Prioritizes source code over documentation
- **Large File Handling** - Automatically skips minified/huge files
- **Smart File Filtering** - Processes only relevant code files

### Security & Reliability
- **Password Bridge** - Secure handling of protected files
- **Permission Management** - Handle elevated access requirements
- **Lock File Management** - Prevent concurrent processing
- **Error Recovery** - Automatic retry with backoff

### Monitoring & Metrics
- **Real-time Progress** - Track processing status
- **Performance Metrics** - CPU, memory, disk I/O monitoring
- **Process PID Tracking** - Monitor specific process resources
- **Event-Driven Updates** - Real-time event streaming


## **Usage Modes**

### CLI Mode
```bash
documentor generate <project-path> --output <docs-path>
documentor watch <project-path>
documentor verify <docs-path>
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

## **Output Formats**

### Markdown
- Standard markdown files
- GitHub-compatible formatting
- Clean, readable documentation

### Obsidian
- Obsidian-optimized markdown
- Frontmatter with metadata
- Backlinks and tags
- Graph view support

##  **Performance**

- Processes hundreds of files in minutes
- Parallel processing with worker pools
- Efficient memory management
- Incremental processing support

##  **Customization**

- Custom templates for different file types
- Configurable documentation structure
- Flexible tagging strategies
- Adjustable processing phases

---

**Version**: TBD
**License**: MIT
**Built with**: TypeScript, Claude CLI, Express, Socket.io`