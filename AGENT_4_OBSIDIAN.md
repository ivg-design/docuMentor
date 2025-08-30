# Agent 4: Obsidian Integration & Documentation

## Mission
Create comprehensive Obsidian integration with AI-driven formatting (~1500 lines total).

## Prerequisites
- Review OBSIDIAN_INTEGRATION.md thoroughly
- Understand universal frontmatter requirements
- AI freedom for content structure
- Project tag system

## Todo List

### 1. Create ObsidianIntegration (`src/core/ObsidianIntegration.ts`)
- [ ] Main orchestrator class (~600 lines)
- [ ] Process documents through Obsidian pipeline
- [ ] Coordinate all Obsidian features:
  - Frontmatter generation
  - Tag optimization
  - Backlink creation
  - Verification
- [ ] Ensure project tag on everything

### 2. Implement ObsidianFrontmatter (`src/core/ObsidianFrontmatter.ts`)
- [ ] Generate UNIVERSAL frontmatter (~200 lines):
  ```yaml
  ---
  project: "project-name"
  project_tag: "#project/documentor"
  title: "Document Title"
  type: "auto-determined"
  status: "complete"
  created: 2024-01-01T10:00:00
  modified: 2024-01-01T15:30:00
  source_files: ["src/file.ts"]
  related: []
  ---
  ```
- [ ] Auto-detect document type
- [ ] Generate timestamps in local time
- [ ] Link source files appropriately
- [ ] Keep it SIMPLE and FLEXIBLE

### 3. Build ObsidianTagOptimizer (`src/core/ObsidianTagOptimizer.ts`)
- [ ] AI-driven tag review (~400 lines)
- [ ] Ensure project tag first: `#project/[name]`
- [ ] Create prompt for Claude to review tags:
  - Identify single-use tags
  - Suggest hierarchical structure
  - Consolidate redundant tags
  - Keep important single-use tags
- [ ] Apply Claude's optimization decisions
- [ ] Generate TAG_HIERARCHY.md document
- [ ] Minimum 3 tags per document

### 4. Create ObsidianBacklinks (`src/core/ObsidianBacklinks.ts`)
- [ ] Automatic backlink generation (~300 lines)
- [ ] Link to source files: `src/file.ts:45`
- [ ] Auto-link to other documents: [[Component]]
- [ ] Keep natural and readable
- [ ] Don't over-link
- [ ] Create bidirectional relationships

### 5. Implement ObsidianVerifier (`src/core/ObsidianVerifier.ts`)
- [ ] Simple verification checklist (~200 lines)
- [ ] Check for:
  - Project tag present
  - Basic frontmatter complete
  - Minimum 3 hierarchical tags
  - Some backlinks exist
  - Source references where applicable
  - Footer with generation info
- [ ] Report issues but don't block

### 6. Create DocGenerator (`src/core/DocGenerator.ts`)
- [ ] AI-driven content generation (~400 lines)
- [ ] Let AI decide structure based on content type
- [ ] NO forced templates or sections
- [ ] Generate natural documentation
- [ ] Universal footer:
  ```markdown
  ---
  ## Tags
  #project/documentor
  #type/api
  #component/auth
  
  ---
  Source: `src/file.ts:45-350`
  Generated: 2024-01-01 by DocuMentor v3.1
  ```

### 7. ClaudeClient Integration (`src/core/ClaudeClient.ts`)
- [ ] Single Claude client (~400 lines)
- [ ] Block TodoWrite and Task tools
- [ ] Handle permission errors
- [ ] Generate enhancement prompts
- [ ] Review and optimize tags
- [ ] Create natural documentation

## Document Examples

### README.md (AI decides structure):
```markdown
---
project: "documentor"
project_tag: "#project/documentor"
title: "DocuMentor - Intelligent Documentation"
type: "readme"
created: 2024-01-01T10:00:00
modified: 2024-01-01T15:30:00
---

# DocuMentor

[AI writes whatever makes sense]
[Natural links to [[Architecture]] and [[API Docs]]]

---
## Tags
#project/documentor
#type/readme
#tool/cli
---
Generated: 2024-01-01 by DocuMentor v3.1
```

## Critical Rules
1. Universal frontmatter only
2. AI decides content structure
3. Project tag on everything
4. Natural backlinks
5. Simple verification
6. NO rigid templates

## Testing Checklist
- [ ] Frontmatter generated correctly
- [ ] Project tag on all documents
- [ ] Tags optimized by AI
- [ ] Backlinks created naturally
- [ ] Verification passes
- [ ] AI has freedom in content

## Files to Create
1. `src/core/ObsidianIntegration.ts`
2. `src/core/ObsidianFrontmatter.ts`
3. `src/core/ObsidianTagOptimizer.ts`
4. `src/core/ObsidianBacklinks.ts`
5. `src/core/ObsidianVerifier.ts`
6. `src/core/DocGenerator.ts`
7. `src/core/ClaudeClient.ts`