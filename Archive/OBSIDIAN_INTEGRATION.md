# Obsidian Integration for DocuMentor V3.1

## Core Obsidian Requirements

### 1. Structured Frontmatter (MANDATORY)
Every generated markdown file MUST include comprehensive frontmatter:

```yaml
---
# Document Metadata
title: "ComponentName API Documentation"
type: "api-reference"  # api-reference | architecture | guide | overview | component
project: "project-name"
version: "1.0.0"
status: "complete"  # draft | in-progress | complete | deprecated

# Timestamps
created: 2024-01-01T10:00:00Z
modified: 2024-01-01T15:30:00Z
documented: 2024-01-01T12:00:00Z
last_reviewed: 2024-01-01T14:00:00Z

# File Information
source_file: "src/components/Auth.ts"
source_lines: [100, 500]
language: "typescript"
framework: ["react", "nextjs"]

# Documentation Metadata
doc_version: "3.1.0"
generator: "DocuMentor"
ai_model: "claude-3-opus"
confidence: 0.95

# Relationships
parent: "[[Architecture Overview]]"
children:
  - "[[AuthProvider]]"
  - "[[AuthContext]]"
related:
  - "[[Database Schema]]"
  - "[[API Routes]]"
dependencies:
  - "[[UserModel]]"
  - "[[SessionManager]]"

# Tags (Optimized & Consolidated)
tags:
  - "#architecture/authentication"
  - "#component/auth"
  - "#security/jwt"
  - "#api/rest"
  - "#pattern/provider"
  - "#status/production"

# Aliases for Obsidian Search
aliases:
  - "Authentication Component"
  - "Auth Module"
  - "Login System"

# Custom Properties for Dataview
complexity: "high"  # low | medium | high
importance: "critical"  # low | medium | high | critical
test_coverage: 85
loc: 500
---
```

### 2. Markdown Template Structure

```markdown
---
[FRONTMATTER AS ABOVE]
---

# {{title}}

> [!info] Document Information
> - **Type**: {{type}}
> - **Status**: {{status}}
> - **Last Updated**: {{modified}}
> - **Confidence**: {{confidence}}%

## 📋 Table of Contents
- [[#Overview]]
- [[#Architecture]]
- [[#Implementation]]
- [[#API Reference]]
- [[#Usage Examples]]
- [[#Testing]]
- [[#Related Documents]]
- [[#Changelog]]

## Overview
> [!abstract] Summary
> {{ai_generated_summary}}

### Purpose
{{purpose_description}}

### Key Features
- Feature 1 with [[Internal Link]]
- Feature 2 connecting to [[Another Component]]
- Feature 3 (see [[Related Guide]])

## Architecture

```mermaid
graph TD
    A[{{component}}] --> B[Dependency 1]
    A --> C[[[Linked Component]]]
    B --> D[Sub-component]
```

### Component Relationships
- **Parent**: [[{{parent}}]]
- **Children**: 
  {{#each children}}
  - [[{{this}}]]
  {{/each}}
- **Dependencies**:
  {{#each dependencies}}
  - [[{{this}}]] - {{dependency_reason}}
  {{/each}}

## Implementation

### Core Code
```{{language}}
{{code_snippet}}
```

### Key Methods
{{#each methods}}
#### `{{name}}({{params}})`
- **Purpose**: {{purpose}}
- **Returns**: `{{return_type}}`
- **Related**: [[{{related_component}}]]
- **Tags**: #method/{{type}}

{{/each}}

## API Reference

### Endpoints
{{#each endpoints}}
#### {{method}} `{{path}}`
- **Description**: {{description}}
- **Auth Required**: {{auth}}
- **Related Docs**: [[{{related_doc}}]]
- **Tags**: #endpoint/{{method_lower}}

**Request**:
```json
{{request_example}}
```

**Response**:
```json
{{response_example}}
```
{{/each}}

## Usage Examples

### Example 1: {{example_name}}
> [!example]
> Demonstrates {{example_purpose}}

```{{language}}
{{example_code}}
```

**See Also**: [[{{related_example}}]]

## Testing

### Test Coverage
> [!check] Coverage: {{test_coverage}}%

- Unit Tests: [[{{project}}/tests/unit/{{component}}]]
- Integration Tests: [[{{project}}/tests/integration/{{component}}]]
- E2E Tests: [[{{project}}/tests/e2e/{{feature}}]]

## Related Documents

### 🔗 Internal Links
{{#each related}}
- [[{{this}}]] - {{relationship_type}}
{{/each}}

### 📚 External References
- [Official Docs]({{official_docs_url}})
- [GitHub Repository]({{github_url}})

## Changelog

### Recent Changes
{{#each recent_changes}}
- **{{date}}**: {{change}} ({{commit_hash}})
{{/each}}

---

## 🏷️ Tags

{{#each tags}}
{{this}} 
{{/each}}

---

> [!note] Navigation
> **Previous**: [[{{previous_doc}}]] | **Up**: [[{{parent}}]] | **Next**: [[{{next_doc}}]]
```

### 3. Tag Optimization System

```typescript
// src/core/ObsidianTagOptimizer.ts
export class ObsidianTagOptimizer {
  private tagHierarchy = {
    // Primary categories (never single-use)
    architecture: ['overview', 'design', 'pattern', 'structure'],
    component: ['ui', 'logic', 'service', 'utility'],
    api: ['rest', 'graphql', 'websocket', 'rpc'],
    database: ['schema', 'model', 'migration', 'query'],
    security: ['auth', 'encryption', 'validation', 'permission'],
    testing: ['unit', 'integration', 'e2e', 'performance'],
    documentation: ['guide', 'reference', 'tutorial', 'example'],
    status: ['draft', 'review', 'production', 'deprecated'],
    
    // Technology-specific
    framework: [], // Populated based on project
    language: [],  // Populated based on project
    pattern: ['singleton', 'factory', 'observer', 'mvc', 'provider'],
    
    // Importance/complexity
    priority: ['critical', 'high', 'medium', 'low'],
    complexity: ['simple', 'moderate', 'complex', 'advanced']
  };
  
  async optimizeTags(projectDocs: Document[]): Promise<TagReport> {
    // 1. Collect all tags from all documents
    const allTags = this.collectAllTags(projectDocs);
    
    // 2. Identify single-use tags
    const singleUseTags = this.findSingleUseTags(allTags);
    
    // 3. Consolidate to parent categories
    const consolidatedTags = this.consolidateTags(singleUseTags);
    
    // 4. Create tag aliases for search
    const tagAliases = this.createTagAliases(consolidatedTags);
    
    // 5. Generate tag hierarchy document
    await this.generateTagHierarchy(consolidatedTags);
    
    // 6. Update all documents with optimized tags
    await this.updateDocumentTags(projectDocs, consolidatedTags);
    
    return {
      original: allTags.length,
      optimized: consolidatedTags.length,
      removed: singleUseTags.length,
      hierarchyCreated: true
    };
  }
  
  private consolidateTags(tags: string[]): Map<string, string> {
    const consolidation = new Map();
    
    tags.forEach(tag => {
      // Example: #auth-jwt-token -> #security/jwt
      if (tag.includes('auth') || tag.includes('jwt')) {
        consolidation.set(tag, '#security/jwt');
      }
      // Example: #user-component -> #component/user
      else if (tag.includes('component')) {
        const type = tag.replace('-component', '').replace('component-', '');
        consolidation.set(tag, `#component/${type}`);
      }
      // Keep hierarchical structure
      else if (!tag.includes('/')) {
        // Find best parent category
        const parent = this.findBestParent(tag);
        consolidation.set(tag, `#${parent}/${tag}`);
      }
    });
    
    return consolidation;
  }
  
  async generateTagHierarchy(tags: Map<string, string>): Promise<void> {
    const hierarchy = `---
title: Tag Hierarchy
type: meta-document
tags:
  - "#meta/tags"
  - "#documentation/index"
---

# 🏷️ Project Tag Hierarchy

## Primary Tags (Always Use These)

### Architecture
\`\`\`
#architecture/
├── overview
├── design
├── pattern
└── structure
\`\`\`

### Components
\`\`\`
#component/
├── ui/
│   ├── button
│   ├── form
│   └── layout
├── logic/
│   ├── controller
│   └── service
└── utility/
    ├── helper
    └── validator
\`\`\`

## Tag Usage Guidelines

1. **Always use hierarchical tags**: \`#category/subcategory\`
2. **Never create single-use tags**
3. **Consolidate similar concepts**
4. **Use tag aliases in frontmatter for searchability**

## Tag Statistics

- Total Unique Tags: ${tags.size}
- Most Used: ${this.getMostUsedTags(tags)}
- Categories: ${this.getCategories(tags)}

## Search Queries

### Dataview Queries

\`\`\`dataview
TABLE tags, type, status
FROM ""
WHERE contains(tags, "#architecture")
SORT modified DESC
\`\`\`

### Complex Queries

\`\`\`dataview
LIST
FROM #component AND #status/production
WHERE test_coverage > 80
\`\`\`
`;
    
    // Save to tag hierarchy document
    await this.saveDocument('TAG_HIERARCHY.md', hierarchy);
  }
}
```

### 4. Backlink Generation System

```typescript
// src/core/ObsidianBacklinkGenerator.ts
export class ObsidianBacklinkGenerator {
  private linkMap: Map<string, Set<string>> = new Map();
  
  async generateBacklinks(docs: Document[]): Promise<void> {
    // 1. Build relationship map
    docs.forEach(doc => {
      this.extractRelationships(doc);
    });
    
    // 2. Insert contextual backlinks
    docs.forEach(doc => {
      doc.content = this.insertBacklinks(doc.content, doc.path);
    });
    
    // 3. Create link index
    await this.createLinkIndex();
  }
  
  private insertBacklinks(content: string, currentPath: string): string {
    // Smart replacement of references with [[backlinks]]
    
    // Replace class names
    content = content.replace(
      /class (\w+)/g,
      (match, className) => {
        if (this.linkMap.has(className)) {
          return `class [[${className}]]`;
        }
        return match;
      }
    );
    
    // Replace import statements
    content = content.replace(
      /from ['"](.+)['"]/g,
      (match, importPath) => {
        const componentName = this.extractComponentName(importPath);
        if (this.linkMap.has(componentName)) {
          return `from '${importPath}' // See: [[${componentName}]]`;
        }
        return match;
      }
    );
    
    // Replace function references
    content = content.replace(
      /calls? (\w+)\(/g,
      (match, funcName) => {
        if (this.linkMap.has(funcName)) {
          return `calls [[${funcName}]](`;
        }
        return match;
      }
    );
    
    return content;
  }
  
  private async createLinkIndex(): Promise<void> {
    const index = `---
title: Link Index
type: meta-document
tags:
  - "#meta/links"
  - "#documentation/index"
---

# 🔗 Document Link Index

## Relationship Map

\`\`\`mermaid
graph LR
${this.generateMermaidGraph()}
\`\`\`

## Most Connected Documents

${this.getMostConnected()}

## Orphaned Documents

${this.getOrphaned()}

## Bidirectional Links

${this.getBidirectional()}
`;
    
    await this.saveDocument('LINK_INDEX.md', index);
  }
}
```

### 5. Obsidian Verification System

```typescript
// src/core/ObsidianVerifier.ts
export class ObsidianVerifier {
  private requiredSections = [
    'frontmatter',
    'overview',
    'architecture',
    'implementation',
    'api-reference',
    'usage-examples',
    'testing',
    'related-documents',
    'tags'
  ];
  
  async verifyDocument(doc: Document): Promise<ValidationResult> {
    const issues: Issue[] = [];
    
    // 1. Verify frontmatter
    if (!doc.frontmatter) {
      issues.push({ type: 'critical', message: 'Missing frontmatter' });
    } else {
      this.verifyFrontmatterFields(doc.frontmatter, issues);
    }
    
    // 2. Verify sections
    this.requiredSections.forEach(section => {
      if (!doc.content.includes(`## ${section}`)) {
        issues.push({ 
          type: 'warning', 
          message: `Missing section: ${section}` 
        });
      }
    });
    
    // 3. Verify backlinks
    const backlinks = this.extractBacklinks(doc.content);
    if (backlinks.length < 3) {
      issues.push({ 
        type: 'warning', 
        message: `Too few backlinks (${backlinks.length})` 
      });
    }
    
    // 4. Verify tags
    if (!doc.frontmatter.tags || doc.frontmatter.tags.length < 3) {
      issues.push({ 
        type: 'warning', 
        message: 'Insufficient tags for discoverability' 
      });
    }
    
    // 5. Verify mermaid diagrams
    if (doc.type === 'architecture' && !doc.content.includes('```mermaid')) {
      issues.push({ 
        type: 'warning', 
        message: 'Architecture doc missing diagram' 
      });
    }
    
    return {
      valid: issues.filter(i => i.type === 'critical').length === 0,
      issues,
      score: this.calculateCompleteness(doc, issues)
    };
  }
  
  private verifyFrontmatterFields(fm: Frontmatter, issues: Issue[]): void {
    const required = [
      'title', 'type', 'created', 'modified', 
      'tags', 'parent', 'related'
    ];
    
    required.forEach(field => {
      if (!fm[field]) {
        issues.push({ 
          type: 'critical', 
          message: `Missing frontmatter field: ${field}` 
        });
      }
    });
    
    // Verify tag format
    if (fm.tags) {
      fm.tags.forEach(tag => {
        if (!tag.includes('/')) {
          issues.push({ 
            type: 'warning', 
            message: `Non-hierarchical tag: ${tag}` 
          });
        }
      });
    }
  }
}
```

### 6. Obsidian Graph Integration

```typescript
// src/core/ObsidianGraphBuilder.ts
export class ObsidianGraphBuilder {
  async buildGraphData(projectPath: string): Promise<void> {
    // Generate special graph view files
    
    // 1. Create MOCs (Maps of Content)
    await this.createMOCs();
    
    // 2. Create index files
    await this.createIndexFiles();
    
    // 3. Create relationship maps
    await this.createRelationshipMaps();
  }
  
  private async createMOCs(): Promise<void> {
    const moc = `---
title: "Map of Content"
type: "moc"
tags:
  - "#meta/moc"
  - "#navigation/index"
---

# 🗺️ Map of Content

## 📚 Documentation Structure

### Core Architecture
- [[Architecture Overview]]
- [[System Design]]
- [[Component Hierarchy]]

### Components
#### UI Components
- [[Button Component]]
- [[Form System]]
- [[Layout Manager]]

#### Business Logic
- [[Authentication System]]
- [[Data Processing]]
- [[API Gateway]]

### API Documentation
- [[REST API Reference]]
- [[GraphQL Schema]]
- [[WebSocket Events]]

## 🔍 Quick Access

### By Importance
#### 🔴 Critical
\`\`\`dataview
LIST
WHERE importance = "critical"
SORT modified DESC
\`\`\`

#### 🟡 High Priority
\`\`\`dataview
LIST
WHERE importance = "high"
SORT modified DESC
\`\`\`

### By Status
#### ✅ Production Ready
\`\`\`dataview
TABLE status, test_coverage, modified
WHERE status = "production"
SORT test_coverage DESC
\`\`\`

## 📊 Statistics

\`\`\`dataview
TABLE 
  length(file.inlinks) as "Incoming Links",
  length(file.outlinks) as "Outgoing Links",
  test_coverage as "Coverage %"
FROM ""
SORT length(file.inlinks) DESC
LIMIT 10
\`\`\`
`;
    
    await this.saveDocument('MOC.md', moc);
  }
}
```

### 7. Implementation in DocumentEngine

```typescript
// src/core/DocumentEngine.ts
export class DocumentEngine {
  private obsidianIntegration: ObsidianIntegration;
  
  constructor(config: Config) {
    // ... other initialization
    this.obsidianIntegration = new ObsidianIntegration(config);
  }
  
  async generate(projectPath: string): Promise<void> {
    // ... phases 1-5 as before
    
    // Phase 6: Obsidian Optimization
    this.progress.startPhase('Obsidian Integration', 6, 9);
    await this.obsidianIntegration.process(documents);
    
    // Phase 7: Tag Optimization
    this.progress.startPhase('Tag Optimization', 7, 9);
    await this.obsidianIntegration.optimizeTags(documents);
    
    // Phase 8: Backlink Generation
    this.progress.startPhase('Backlink Generation', 8, 9);
    await this.obsidianIntegration.generateBacklinks(documents);
    
    // Phase 9: Verification
    this.progress.startPhase('Verification', 9, 9);
    await this.obsidianIntegration.verify(documents);
  }
}
```

## Configuration for Obsidian

```json
{
  "output": {
    "format": "obsidian",
    "features": {
      "frontmatter": true,
      "backlinks": true,
      "tags": {
        "optimize": true,
        "hierarchy": true,
        "minPerDoc": 3,
        "maxPerDoc": 10
      },
      "moc": true,
      "graph": true,
      "dataview": true
    },
    "templates": {
      "path": "./templates/obsidian",
      "strict": true
    }
  },
  "obsidian": {
    "vault": "~/obsidian_vault",
    "dailyNotes": true,
    "templates": true,
    "requireComplete": true,
    "minBacklinks": 3,
    "autoTag": true
  }
}
```

## Validation Checklist

Every document MUST have:
- [ ] Complete frontmatter (15+ fields)
- [ ] Hierarchical tags (minimum 3)
- [ ] Parent document link
- [ ] Related documents (minimum 2)
- [ ] Backlinks in content (minimum 3)
- [ ] Table of contents
- [ ] Mermaid diagram (if architecture)
- [ ] Code examples with language tags
- [ ] Dataview-compatible properties
- [ ] Navigation links (prev/up/next)
- [ ] Timestamps (created/modified/reviewed)
- [ ] Status indicator
- [ ] Aliases for search

## Benefits

1. **Complete Obsidian Integration**: Every file works perfectly with Obsidian features
2. **Rich Graph View**: Extensive backlinks create meaningful graph connections
3. **Powerful Search**: Tags, aliases, and frontmatter enable complex queries
4. **Dataview Queries**: All metadata structured for Dataview plugin
5. **No Orphan Documents**: Every document connected to the knowledge graph
6. **No Single-Use Tags**: Optimized tag hierarchy prevents clutter
7. **Template Consistency**: All documents follow strict template structure
8. **Cross-Reference Heaven**: Navigate between related concepts effortlessly