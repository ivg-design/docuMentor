# DocuMentor Examples & Recipes 📚

A comprehensive collection of examples, patterns, and best practices for using DocuMentor effectively.

## Table of Contents

- [Basic Usage Examples](#basic-usage-examples)
- [Advanced Patterns](#advanced-patterns)
- [Integration Examples](#integration-examples)
- [Best Practices](#best-practices)
- [Common Recipes](#common-recipes)
- [Troubleshooting](#troubleshooting)

---

## Basic Usage Examples

### 1. Quick Start - Document Current Project

```bash
# Document the current directory with default settings
documentor generate

# Document with verbose output to see what's happening
documentor generate --verbose
```

### 2. Document a Specific Project

```bash
# Basic documentation for a React app
documentor generate ~/projects/my-react-app

# Document a Node.js API
documentor generate /path/to/api-server --output ~/docs/api

# Document with verification disabled for faster processing
documentor generate ~/projects/large-codebase --no-verify
```

### 3. Update Existing Documentation

```bash
# Update documentation without overwriting manual edits
documentor generate ~/projects/my-app --update

# Update only specific sections
documentor generate ~/projects/my-app --update --sections "api,components"
```

### 4. Exclude Patterns

```bash
# Exclude test files and vendor directories
documentor generate . --exclude "**/test/**" "**/vendor/**" "**/*.test.js"

# Exclude build artifacts and cache
documentor generate . --exclude "dist/" "build/" ".next/" ".cache/"

# Complex exclusion pattern for monorepo
documentor generate ~/monorepo \
  --exclude "packages/*/node_modules" \
  --exclude "packages/*/dist" \
  --exclude "**/__tests__/**"
```

### 5. Configuration Setup

```bash
# Initial configuration
documentor config --show

# Set default project path
documentor config --set-path ~/projects/main-project

# Set Obsidian vault location
documentor config --set-vault ~/Documents/ObsidianVault/Development

# Validate configuration
documentor config --validate
```

---

## Advanced Patterns

### 1. Full Monty - Comprehensive Documentation

```bash
# Generate everything with quality metrics
documentor full-monty ~/projects/enterprise-app

# Verbose mode for detailed progress
documentor full-monty . --verbose

# Custom output with specific depth
documentor full-monty ~/projects/complex-system \
  --max-depth 3 \
  --quality-threshold 80
```

**Output includes:**
- Architecture diagrams
- API documentation with examples
- Security analysis report
- Performance metrics
- Dependency tree
- Test coverage report
- Quality scores (0-100)

### 2. Multi-Project Monorepo Documentation

```bash
# Document entire monorepo with project detection
documentor generate ~/monorepo --detect-projects

# Document specific packages in monorepo
documentor generate ~/monorepo/packages/core
documentor generate ~/monorepo/packages/ui
documentor generate ~/monorepo/packages/api

# Create unified documentation structure
documentor full-monty ~/monorepo --monorepo-mode
```

### 3. CI/CD Integration

```yaml
# GitHub Actions example
name: Documentation
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  document:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'
      
      - name: Install DocuMentor
        run: |
          npm install -g documentor
          
      - name: Generate Documentation
        env:
          CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
        run: |
          documentor generate . \
            --output ./docs \
            --no-verify
            
      - name: Upload Documentation
        uses: actions/upload-artifact@v2
        with:
          name: documentation
          path: ./docs
```

### 4. Incremental Documentation with Git Hooks

```bash
# .git/hooks/pre-commit
#!/bin/bash

# Document only changed files
CHANGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|ts|jsx|tsx)$')

if [ ! -z "$CHANGED_FILES" ]; then
  echo "Updating documentation for changed files..."
  documentor generate . --update --files "$CHANGED_FILES"
fi
```

### 5. Scheduled Documentation Updates

```bash
# Crontab entry for nightly documentation
0 2 * * * /usr/local/bin/documentor generate ~/projects/main --update --quiet

# With GitHub monitoring
0 */6 * * * /usr/local/bin/documentor monitor --start --interval 360
```

---

## Integration Examples

### 1. Obsidian Vault Integration

```bash
# Configure Obsidian vault path
documentor config --set-vault ~/ObsidianVault/Development

# Generate with Obsidian-specific features
documentor generate ~/projects/app \
  --obsidian-links \
  --generate-graph \
  --tag-hierarchy

# Create tag index for Obsidian
documentor tags --generate-index

# Scan and organize existing tags
documentor tags --scan --organize
```

### 2. GitHub Repository Monitoring

```bash
# Add repositories to monitor
documentor monitor --add facebook/react
documentor monitor --add vuejs/vue
documentor monitor --add microsoft/typescript

# Start monitoring with 10-minute intervals
documentor monitor --start --interval 10

# List monitored repositories
documentor monitor --list

# Generate documentation for new commits
documentor monitor --process-changes

# Setup webhook for real-time updates
documentor monitor --setup-webhook --secret $WEBHOOK_SECRET
```

### 3. VS Code Integration

```json
// .vscode/tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Generate Documentation",
      "type": "shell",
      "command": "documentor",
      "args": ["generate", "${workspaceFolder}"],
      "group": {
        "kind": "build",
        "isDefault": true
      },
      "presentation": {
        "reveal": "always",
        "panel": "new"
      }
    },
    {
      "label": "Update Documentation",
      "type": "shell",
      "command": "documentor",
      "args": ["generate", "${workspaceFolder}", "--update"],
      "problemMatcher": []
    },
    {
      "label": "Full Monty Analysis",
      "type": "shell",
      "command": "documentor",
      "args": ["full-monty", "${workspaceFolder}", "--verbose"],
      "problemMatcher": []
    }
  ]
}
```

### 4. Docker Integration

```dockerfile
# Dockerfile for documentation generation
FROM node:16-alpine

# Install DocuMentor
RUN npm install -g documentor

# Set working directory
WORKDIR /workspace

# Copy project files
COPY . .

# Generate documentation
RUN documentor generate . --output /docs

# Export documentation
FROM nginx:alpine
COPY --from=0 /docs /usr/share/nginx/html
```

```bash
# Docker Compose for continuous documentation
# docker-compose.yml
version: '3.8'

services:
  documentor:
    image: documentor:latest
    volumes:
      - ./project:/workspace
      - ./docs:/output
    environment:
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
    command: generate /workspace --output /output --watch
    
  docs-server:
    image: nginx:alpine
    volumes:
      - ./docs:/usr/share/nginx/html
    ports:
      - "8080:80"
```

### 5. API Documentation Server

```javascript
// docs-server.js
const express = require('express');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve generated documentation
app.use('/docs', express.static(path.join(__dirname, 'documentation')));

// API endpoint to trigger documentation generation
app.post('/api/generate-docs', (req, res) => {
  const { projectPath = '.' } = req.body;
  
  exec(`documentor generate ${projectPath}`, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: stderr });
    }
    res.json({ message: 'Documentation generated', output: stdout });
  });
});

// Webhook for GitHub updates
app.post('/webhook/github', (req, res) => {
  const { repository, commits } = req.body;
  
  exec(`documentor monitor --process-repo ${repository.full_name}`, (error) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ message: 'Repository documentation updated' });
  });
});

app.listen(PORT, () => {
  console.log(`Documentation server running on port ${PORT}`);
});
```

---

## Best Practices

### 1. Project Organization

```bash
# Recommended project structure for optimal documentation
project/
├── src/                    # Source code
├── docs/                   # Generated documentation
├── .documentor.json        # Project-specific config
├── .documentor-ignore      # Exclusion patterns
└── README.md              # Project overview

# Create project-specific configuration
cat > .documentor.json << EOF
{
  "projectName": "My Application",
  "outputPath": "./docs",
  "excludePaths": ["test", "scripts"],
  "tags": ["production", "api", "v2"],
  "generateDiagrams": true
}
EOF
```

### 2. Tag Strategy

```bash
# Hierarchical tag structure
#project/my-app
#type/api
#language/typescript
#framework/express
#status/production
#version/2.0

# Generate tag hierarchy
documentor tags --generate-hierarchy

# Apply consistent tagging
documentor generate . --tags "project/my-app,type/api,status/production"
```

### 3. Performance Optimization

```bash
# For large codebases, use incremental updates
documentor generate . --incremental --cache

# Parallel processing for monorepos
documentor generate . --parallel --max-workers 4

# Skip verification for trusted code
documentor generate . --no-verify --fast-mode

# Use specific file patterns
documentor generate . --include "src/**/*.ts" --exclude "**/*.test.ts"
```

### 4. Quality Assurance

```bash
# Set quality thresholds
documentor generate . --min-quality 75

# Generate quality report
documentor analyze . --quality-report

# Validate documentation completeness
documentor verify . --check-coverage

# Run documentation tests
documentor test . --validate-links --check-examples
```

### 5. Team Collaboration

```bash
# Setup shared configuration
documentor config --export > team-config.json
documentor config --import team-config.json

# Lock versions for consistency
npm install --save-exact documentor@2.0.0

# Generate contributor documentation
documentor generate . --include-contributors --git-history

# Create documentation style guide
documentor generate . --style-guide > DOCUMENTATION_STYLE.md
```

---

## Common Recipes

### Recipe 1: Document a React + TypeScript Project

```bash
#!/bin/bash
# document-react-app.sh

PROJECT_PATH="~/projects/react-app"
OUTPUT_PATH="~/ObsidianVault/Projects/ReactApp"

# Generate comprehensive documentation
documentor full-monty $PROJECT_PATH \
  --output $OUTPUT_PATH \
  --tags "react,typescript,frontend" \
  --include-tests \
  --generate-component-docs \
  --extract-props \
  --verify

# Generate component catalog
documentor analyze $PROJECT_PATH \
  --components \
  --output "$OUTPUT_PATH/components.md"

# Create API documentation
documentor generate "$PROJECT_PATH/src/api" \
  --output "$OUTPUT_PATH/api" \
  --api-mode
```

### Recipe 2: Document Node.js Microservices

```bash
#!/bin/bash
# document-microservices.sh

SERVICES_PATH="~/projects/microservices"
OUTPUT_BASE="~/docs"

# Document each service
for service in $SERVICES_PATH/*/; do
  SERVICE_NAME=$(basename "$service")
  
  echo "Documenting $SERVICE_NAME..."
  
  documentor generate "$service" \
    --output "$OUTPUT_BASE/$SERVICE_NAME" \
    --tags "microservice,$SERVICE_NAME" \
    --api-mode \
    --include-swagger
done

# Generate service dependency graph
documentor analyze $SERVICES_PATH \
  --dependency-graph \
  --output "$OUTPUT_BASE/architecture.md"

# Create unified API documentation
documentor full-monty $SERVICES_PATH \
  --unified-api \
  --output "$OUTPUT_BASE/unified-api.md"
```

### Recipe 3: Document Python Data Science Project

```bash
#!/bin/bash
# document-data-science.sh

PROJECT="~/projects/ml-pipeline"

# Document with notebook support
documentor generate $PROJECT \
  --include-notebooks \
  --extract-markdown \
  --tags "python,datascience,ml"

# Generate model documentation
documentor analyze "$PROJECT/models" \
  --model-cards \
  --performance-metrics

# Document data pipeline
documentor generate "$PROJECT/pipeline" \
  --dag-visualization \
  --data-lineage
```

### Recipe 4: Create Living Documentation

```bash
#!/bin/bash
# living-documentation.sh

# Setup continuous documentation with file watching
PROJECT_PATH="."
VAULT_PATH="~/ObsidianVault/CurrentProject"

# Initial full documentation
documentor full-monty $PROJECT_PATH --output $VAULT_PATH

# Watch for changes (requires fswatch or inotify-tools)
fswatch -r $PROJECT_PATH/src | while read file; do
  echo "Detected change in $file"
  
  # Update documentation for changed file
  documentor generate $PROJECT_PATH \
    --update \
    --files "$file" \
    --output $VAULT_PATH \
    --quiet
done
```

### Recipe 5: Documentation Audit & Improvement

```bash
#!/bin/bash
# audit-documentation.sh

PROJECT="."

# Run comprehensive audit
documentor audit $PROJECT \
  --check-completeness \
  --validate-examples \
  --verify-links \
  --measure-quality > audit-report.md

# Extract TODOs and missing documentation
grep -r "TODO" $PROJECT/docs > documentation-todos.txt
grep -r "UNDOCUMENTED" $PROJECT/docs >> documentation-todos.txt

# Generate improvement recommendations
documentor analyze $PROJECT \
  --suggest-improvements \
  --coverage-gaps > improvements.md

# Update based on audit results
documentor generate $PROJECT \
  --fix-issues \
  --from-audit audit-report.md
```

### Recipe 6: Multi-Language Project Documentation

```bash
#!/bin/bash
# document-polyglot.sh

PROJECT="~/projects/full-stack-app"

# Frontend (React + TypeScript)
documentor generate "$PROJECT/frontend" \
  --output "docs/frontend" \
  --tags "frontend,react,typescript"

# Backend (Python FastAPI)
documentor generate "$PROJECT/backend" \
  --output "docs/backend" \
  --tags "backend,python,fastapi" \
  --api-mode

# Mobile (React Native)
documentor generate "$PROJECT/mobile" \
  --output "docs/mobile" \
  --tags "mobile,react-native"

# Infrastructure (Terraform)
documentor generate "$PROJECT/infrastructure" \
  --output "docs/infrastructure" \
  --tags "infrastructure,terraform,iac"

# Generate unified documentation
documentor full-monty $PROJECT \
  --output "docs/overview" \
  --cross-reference
```

### Recipe 7: Emergency Documentation Recovery

```bash
#!/bin/bash
# recover-documentation.sh

# Check for backups
documentor safety --list-backups

# Restore from most recent backup
LATEST_BACKUP=$(documentor safety --latest-backup)
documentor safety --restore "$LATEST_BACKUP"

# Regenerate missing documentation
documentor generate . \
  --recovery-mode \
  --use-git-history \
  --reconstruct

# Verify integrity
documentor verify . --check-all
```

---

## Troubleshooting

### Common Issues & Solutions

#### 1. API Key Issues

```bash
# Check if API key is set
echo $CLAUDE_API_KEY

# Set API key
export CLAUDE_API_KEY="sk-ant-..."

# Or add to config
documentor config --set-api-key "sk-ant-..."
```

#### 2. Memory Issues with Large Projects

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=8192"

# Use chunked processing
documentor generate . --chunk-size 100 --parallel

# Process in batches
documentor generate . --batch-mode --batch-size 50
```

#### 3. Lock File Issues

```bash
# Check for stale locks
ls -la ~/.documentor/*.lock

# Force unlock (use with caution)
rm ~/.documentor/.documentor.lock

# Safe unlock
documentor safety --unlock --force
```

#### 4. Slow Documentation Generation

```bash
# Profile performance
documentor generate . --profile > performance.log

# Optimize with caching
documentor generate . --cache --cache-dir /tmp/documenor-cache

# Skip expensive operations
documentor generate . \
  --no-verify \
  --skip-diagrams \
  --simple-mode
```

#### 5. Obsidian Sync Issues

```bash
# Verify vault path
documentor config --show | grep vault

# Test vault access
documentor test --vault-access

# Force sync
documentor sync --force --vault ~/ObsidianVault
```

### Debug Mode

```bash
# Enable debug logging
export DOCUMENTOR_LOG_LEVEL=debug
documentor generate . --debug

# Generate debug report
documentor debug --report > debug-report.txt

# Test specific components
documentor test --component analyzer
documentor test --component generator
documentor test --component formatter
```

### Getting Help

```bash
# Show help for any command
documentor --help
documentor generate --help
documentor full-monty --help

# Show version and environment info
documentor --version --env

# Run diagnostic checks
documentor doctor

# Generate support bundle
documentor support --bundle > support.zip
```

---

## Advanced Configuration Examples

### Custom Configuration File

```json
// .documentor.json - Project-specific configuration
{
  "projectName": "Enterprise Application",
  "version": "3.0.0",
  "outputPath": "./documentation",
  "obsidianVault": "~/ObsidianVault/Work",
  
  "generation": {
    "verifyCode": true,
    "generateDiagrams": true,
    "includeTests": false,
    "extractComments": true,
    "apiMode": true
  },
  
  "exclusions": {
    "paths": [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/vendor/**"
    ],
    "files": [
      "*.min.js",
      "*.bundle.js",
      "*.map"
    ]
  },
  
  "tagging": {
    "autoTags": true,
    "maxTags": 15,
    "tagPrefix": "project/enterprise",
    "customTags": [
      "production",
      "critical",
      "api-v3"
    ]
  },
  
  "quality": {
    "minScore": 75,
    "requireTests": true,
    "requireComments": true,
    "maxComplexity": 10
  },
  
  "monitoring": {
    "enabled": true,
    "repositories": [
      "myorg/main-app",
      "myorg/shared-libs"
    ],
    "interval": 300,
    "autoDocument": true
  },
  
  "ai": {
    "model": "claude-3-opus",
    "temperature": 0.7,
    "maxTokens": 4096,
    "streaming": true
  },
  
  "output": {
    "format": "markdown",
    "includeTimestamps": true,
    "includeAuthors": true,
    "generateIndex": true,
    "createBacklinks": true
  }
}
```

### Environment-Specific Configurations

```bash
# Development environment
export DOCUMENTOR_ENV=development
export DOCUMENTOR_CONFIG=~/.documentor/config.dev.json

# Production environment
export DOCUMENTOR_ENV=production
export DOCUMENTOR_CONFIG=~/.documentor/config.prod.json

# CI environment
export DOCUMENTOR_ENV=ci
export DOCUMENTOR_CONFIG=./ci/documentor.config.json
```

---

*Last updated: 2024*
*DocuMentor v2.0.0*