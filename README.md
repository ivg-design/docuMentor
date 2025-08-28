# DocuMentor 📚

An intelligent documentation generator that analyzes codebases, verifies functionality, and creates Obsidian-compatible documentation with smart tagging and cross-referencing.

## ✨ Features

- **🔍 Intelligent Project Analysis**: Automatically detects project types (monorepo, single-project, multi-tool, library)
- **✅ Code Verification**: Validates that documented functionality actually works
- **🏷️ Smart Tag Management**: Reuses existing Obsidian tags and creates cohesive tag hierarchies
- **🔗 Obsidian Integration**: Generates documentation with backlinks, tags, and metadata
- **📊 Multi-Format Support**: Handles various project structures and languages
- **🚫 Smart Exclusions**: Automatically excludes docuMentor itself and obsidian_vault

## 🚀 Installation

```bash
# Clone the repository
git clone ~/github/docuMentor
cd ~/github/docuMentor

# Install dependencies
npm install

# Build the project
npm run build

# Link globally (optional)
npm link
```

## 📖 Usage

### Generate Documentation

```bash
# Document current directory
documentor generate

# Document specific project
documentor generate ~/projects/my-app

# Skip code verification for faster generation
documentor generate ~/projects/my-app --no-verify

# Specify custom output location
documentor generate ~/projects/my-app --output ~/custom/docs

# Update existing documentation
documentor generate ~/projects/my-app --update
```

### Other Commands

```bash
# Verify code functionality without generating docs
documentor verify ~/projects/my-app

# Analyze project structure
documentor analyze ~/projects/my-app

# Manage Obsidian tags
documentor tags --scan
documentor tags --generate-index

# View configuration
documentor config
```

## 📁 Output Structure

Documentation is saved to `~/github/obsidian_vault/docs/` by default:

```
obsidian_vault/docs/
├── project-name/
│   ├── README.md          # Main documentation
│   ├── architecture.md    # System architecture
│   ├── api.md            # API reference
│   ├── setup.md          # Setup guide
│   └── contributing.md   # Contributing guidelines
├── another-project/
│   └── ...
└── tag-index.md          # Tag reference
```

## 🏷️ Tag System

DocuMentor uses a sophisticated tagging system:

- **Automatic Tag Detection**: Scans existing Obsidian vault for tags
- **Hierarchical Tags**: Project type, language, framework-specific tags
- **Tag Reuse**: Prefers existing tags over creating new ones
- **Tag Statistics**: Tracks tag usage across documentation

### Tag Categories

- **Project Types**: `monorepo`, `library`, `cli`, `web-app`
- **Languages**: `javascript`, `typescript`, `python`, `go`
- **Frameworks**: `react`, `vue`, `express`, `django`
- **Common**: `documentation`, `api`, `architecture`, `setup`

## 🔍 Project Type Detection

DocuMentor automatically identifies:

- **Single Project**: Standalone applications or services
- **Monorepo**: Workspace-based projects with multiple packages
- **Multi-Tool**: Collections of independent scripts/tools
- **Library**: Reusable packages and SDKs
- **CLI Tool**: Command-line applications

## ✅ Code Verification

The verifier checks:

- Entry point functionality
- Import/export validity
- Test suite health
- API endpoint availability
- Component integrity
- Dependency usage

## 🔗 Obsidian Features

Generated documentation includes:

- **Frontmatter Metadata**: Title, tags, dates, project info
- **Backlinks**: Automatic linking between related documents
- **Tag Integration**: Inline tags and tag indices
- **Breadcrumbs**: Navigation paths
- **Dataview Queries**: Dynamic content aggregation

## ⚙️ Configuration

Default settings (can be customized):

```json
{
  "obsidianVaultPath": "~/github/obsidian_vault/docs",
  "excludePaths": [
    "node_modules",
    ".git",
    "dist",
    "build",
    "~/github/docuMentor",
    "~/github/obsidian_vault"
  ],
  "verifyCode": true,
  "generateBacklinks": true,
  "maxTags": 10
}
```

## 🛠️ Development

```bash
# Run in development mode
npm run dev generate ~/projects/test-project

# Clean build artifacts
npm run clean

# Rebuild
npm run build
```

## 📋 Requirements

- Node.js 16+
- Claude Code SDK subscription
- Obsidian (for viewing documentation)

## 🎯 Use Cases

- **Project Onboarding**: Generate documentation for new team members
- **Code Audits**: Verify and document working functionality
- **Knowledge Base**: Build searchable documentation vault
- **API Documentation**: Auto-generate API references
- **Architecture Docs**: Create system design documentation

## 🚫 Automatic Exclusions

The following are automatically excluded from documentation:

- `~/github/docuMentor` (this tool itself)
- `~/github/obsidian_vault` (output directory)
- Standard exclusions: `node_modules`, `.git`, `dist`, `build`

## 🤝 Contributing

Contributions are welcome! The project structure:

```
docuMentor/
├── src/
│   ├── index.ts              # CLI interface
│   ├── DocumentationAgent.ts  # Main orchestrator
│   ├── ProjectAnalyzer.ts    # Project analysis
│   ├── ObsidianFormatter.ts  # Obsidian formatting
│   ├── CodeVerifier.ts       # Code verification
│   └── TagManager.ts          # Tag management
├── package.json
├── tsconfig.json
└── README.md
```

## 📄 License

MIT

## 🔮 Future Enhancements

- [ ] Watch mode for continuous documentation updates
- [ ] Integration with GitHub Actions
- [ ] Custom documentation templates
- [ ] Multi-language documentation
- [ ] Documentation quality scoring
- [ ] Visual dependency graphs
- [ ] API testing integration

---

Built with the Claude Code SDK for intelligent code analysis and documentation generation.