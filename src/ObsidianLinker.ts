import * as fs from 'fs/promises';
import * as path from 'path';
import crypto from 'crypto';

export interface ObsidianDocument {
  path: string;
  title: string;
  tags: string[];
  backlinks: string[];
  forwardLinks: string[];
  aliases?: string[];
  created: Date;
  updated: Date;
  id: string;
}

export interface LinkGraph {
  documents: Map<string, ObsidianDocument>;
  tagIndex: Map<string, Set<string>>; // tag -> document IDs
  linkIndex: Map<string, Set<string>>; // document ID -> linked document IDs
}

export class ObsidianLinker {
  private graph: LinkGraph;
  private vaultPath: string;
  private projectName: string;
  
  constructor(vaultPath: string, projectName: string) {
    this.vaultPath = vaultPath;
    this.projectName = projectName;
    this.graph = {
      documents: new Map(),
      tagIndex: new Map(),
      linkIndex: new Map()
    };
  }
  
  // Generate unique document ID
  private generateId(filePath: string): string {
    return crypto.createHash('md5').update(filePath).digest('hex').substring(0, 8);
  }
  
  // Register a document
  registerDocument(
    relativePath: string,
    title: string,
    tags: string[],
    aliases?: string[]
  ): ObsidianDocument {
    const doc: ObsidianDocument = {
      path: relativePath,
      title,
      tags: this.normalizeTags(tags),
      backlinks: [],
      forwardLinks: [],
      aliases,
      created: new Date(),
      updated: new Date(),
      id: this.generateId(relativePath)
    };
    
    this.graph.documents.set(doc.id, doc);
    
    // Update tag index
    doc.tags.forEach(tag => {
      if (!this.graph.tagIndex.has(tag)) {
        this.graph.tagIndex.set(tag, new Set());
      }
      this.graph.tagIndex.get(tag)?.add(doc.id);
    });
    
    return doc;
  }
  
  // Add link between documents
  addLink(fromDocId: string, toDocId: string, linkText?: string): void {
    const fromDoc = this.graph.documents.get(fromDocId);
    const toDoc = this.graph.documents.get(toDocId);
    
    if (!fromDoc || !toDoc) {
      return;
    }
    
    // Add forward link
    const linkFormat = `[[${toDoc.path}|${linkText || toDoc.title}]]`;
    if (!fromDoc.forwardLinks.includes(linkFormat)) {
      fromDoc.forwardLinks.push(linkFormat);
    }
    
    // Add backlink
    const backlinkFormat = `[[${fromDoc.path}|${fromDoc.title}]]`;
    if (!toDoc.backlinks.includes(backlinkFormat)) {
      toDoc.backlinks.push(backlinkFormat);
    }
    
    // Update link index
    if (!this.graph.linkIndex.has(fromDocId)) {
      this.graph.linkIndex.set(fromDocId, new Set());
    }
    this.graph.linkIndex.get(fromDocId)?.add(toDocId);
  }
  
  // Create cross-references based on content analysis
  createAutoLinks(content: string, docId: string): string {
    let linkedContent = content;
    
    // Find mentions of other documents
    this.graph.documents.forEach((doc, id) => {
      if (id === docId) return; // Don't link to self
      
      // Check for title mentions
      const titleRegex = new RegExp(`\\b${this.escapeRegex(doc.title)}\\b`, 'gi');
      if (titleRegex.test(content)) {
        // Replace first mention with link
        linkedContent = linkedContent.replace(
          titleRegex,
          (match) => {
            this.addLink(docId, id, match);
            return `[[${doc.path}|${match}]]`;
          }
        );
      }
      
      // Check for alias mentions
      doc.aliases?.forEach(alias => {
        const aliasRegex = new RegExp(`\\b${this.escapeRegex(alias)}\\b`, 'gi');
        if (aliasRegex.test(content)) {
          linkedContent = linkedContent.replace(
            aliasRegex,
            (match) => {
              this.addLink(docId, id, match);
              return `[[${doc.path}|${match}]]`;
            }
          );
        }
      });
    });
    
    return linkedContent;
  }
  
  // Generate frontmatter with all metadata
  generateFrontmatter(doc: ObsidianDocument): string {
    const frontmatter = {
      id: doc.id,
      title: doc.title,
      tags: doc.tags,
      aliases: doc.aliases || [],
      created: doc.created.toISOString(),
      updated: doc.updated.toISOString(),
      project: this.projectName,
      backlinks: doc.backlinks.length,
      forwardLinks: doc.forwardLinks.length
    };
    
    const yaml = Object.entries(frontmatter)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          if (value.length === 0) return null;
          return `${key}:\n${value.map(v => `  - ${v}`).join('\n')}`;
        }
        return `${key}: ${value}`;
      })
      .filter(line => line !== null)
      .join('\n');
    
    return `---\n${yaml}\n---`;
  }
  
  // Generate backlinks section
  generateBacklinksSection(doc: ObsidianDocument): string {
    if (doc.backlinks.length === 0) {
      return '';
    }
    
    return `
## Backlinks

Documents that reference this page:

${doc.backlinks.map(link => `- ${link}`).join('\n')}
`;
  }
  
  // Generate related documents section based on tags
  generateRelatedSection(doc: ObsidianDocument): string {
    const related = new Set<string>();
    
    // Find documents with shared tags
    doc.tags.forEach(tag => {
      this.graph.tagIndex.get(tag)?.forEach(id => {
        if (id !== doc.id) {
          related.add(id);
        }
      });
    });
    
    if (related.size === 0) {
      return '';
    }
    
    const relatedDocs = Array.from(related)
      .map(id => this.graph.documents.get(id))
      .filter(d => d !== undefined)
      .slice(0, 10); // Limit to 10 related docs
    
    return `
## Related Documents

Documents with similar tags:

${relatedDocs.map(d => `- [[${d!.path}|${d!.title}]] ${d!.tags.map(t => `#${t}`).join(' ')}`).join('\n')}
`;
  }
  
  // Generate tag index page
  async generateTagIndex(): Promise<string> {
    const tagGroups: Record<string, string[]> = {};
    
    // Group documents by tags
    this.graph.tagIndex.forEach((docIds, tag) => {
      tagGroups[tag] = Array.from(docIds)
        .map(id => this.graph.documents.get(id))
        .filter(d => d !== undefined)
        .map(d => `[[${d!.path}|${d!.title}]]`);
    });
    
    // Sort tags by frequency
    const sortedTags = Object.entries(tagGroups)
      .sort((a, b) => b[1].length - a[1].length);
    
    const content = `---
title: Tag Index - ${this.projectName}
tags: [index, tags, ${this.projectName}]
created: ${new Date().toISOString()}
---

# Tag Index - ${this.projectName}

## Tag Cloud

${sortedTags.map(([tag, docs]) => `#${tag} (${docs.length})`).join(' | ')}

## Tags by Category

### Project Structure
${this.filterTagsByPrefix(sortedTags, ['architecture', 'module', 'component', 'service'])}

### Languages & Frameworks
${this.filterTagsByPrefix(sortedTags, ['javascript', 'typescript', 'react', 'node', 'python'])}

### Documentation Types
${this.filterTagsByPrefix(sortedTags, ['api', 'guide', 'reference', 'tutorial', 'overview'])}

### Features
${this.filterTagsByPrefix(sortedTags, ['feature', 'function', 'method', 'class', 'interface'])}

## All Tags

${sortedTags.map(([tag, docs]) => `
### #${tag}

${docs.slice(0, 20).join('\n')}
${docs.length > 20 ? `\n... and ${docs.length - 20} more` : ''}
`).join('\n')}

## Statistics

- **Total Tags**: ${sortedTags.length}
- **Total Documents**: ${this.graph.documents.size}
- **Average Tags per Document**: ${(Array.from(this.graph.documents.values()).reduce((sum, d) => sum + d.tags.length, 0) / this.graph.documents.size).toFixed(1)}
- **Most Used Tag**: #${sortedTags[0]?.[0]} (${sortedTags[0]?.[1].length} documents)

---
*Generated by DocuMentor - ${new Date().toLocaleString()}*
`;
    
    return content;
  }
  
  // Generate document graph/map
  async generateDocumentMap(): Promise<string> {
    const rootDocs = Array.from(this.graph.documents.values())
      .filter(d => d.backlinks.length === 0); // Start with docs that have no backlinks
    
    const content = `---
title: Document Map - ${this.projectName}
tags: [index, map, structure, ${this.projectName}]
created: ${new Date().toISOString()}
---

# Document Map - ${this.projectName}

## Project Structure

\`\`\`mermaid
graph TD
${this.generateMermaidGraph()}
\`\`\`

## Document Hierarchy

${this.generateHierarchy()}

## Key Documents

### Entry Points
${rootDocs.map(d => `- [[${d.path}|${d.title}]] - ${d.tags.slice(0, 3).map(t => `#${t}`).join(' ')}`).join('\n')}

### Most Referenced
${this.getMostReferenced().map(d => `- [[${d.path}|${d.title}]] (${d.backlinks.length} references)`).join('\n')}

### Core Components
${this.getDocumentsByTag('core').map(d => `- [[${d.path}|${d.title}]]`).join('\n')}

## Navigation

- [[tag-index|View Tag Index]]
- [[${this.projectName}/README|Project Overview]]
- [[${this.projectName}/architecture|Architecture]]
- [[${this.projectName}/api|API Reference]]

---
*Generated by DocuMentor - ${new Date().toLocaleString()}*
`;
    
    return content;
  }
  
  // Helper: Generate Mermaid graph
  private generateMermaidGraph(): string {
    const lines: string[] = [];
    
    this.graph.linkIndex.forEach((targets, source) => {
      const sourceDoc = this.graph.documents.get(source);
      if (!sourceDoc) return;
      
      targets.forEach(target => {
        const targetDoc = this.graph.documents.get(target);
        if (!targetDoc) return;
        
        const sourceName = sourceDoc.title.replace(/[^a-zA-Z0-9]/g, '_');
        const targetName = targetDoc.title.replace(/[^a-zA-Z0-9]/g, '_');
        
        lines.push(`    ${sourceName}[${sourceDoc.title}] --> ${targetName}[${targetDoc.title}]`);
      });
    });
    
    return lines.slice(0, 50).join('\n'); // Limit to 50 connections for readability
  }
  
  // Helper: Generate hierarchy
  private generateHierarchy(): string {
    const tree: Record<string, any> = {};
    
    // Build tree structure based on file paths
    this.graph.documents.forEach(doc => {
      const parts = doc.path.split('/');
      let current = tree;
      
      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          current[part] = `[[${doc.path}|${doc.title}]]`;
        } else {
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part];
        }
      });
    });
    
    return this.renderTree(tree);
  }
  
  // Helper: Render tree structure
  private renderTree(obj: any, indent: string = ''): string {
    const lines: string[] = [];
    
    Object.entries(obj).forEach(([key, value]) => {
      if (typeof value === 'string') {
        lines.push(`${indent}- ${value}`);
      } else {
        lines.push(`${indent}- **${key}/**`);
        lines.push(this.renderTree(value, indent + '  '));
      }
    });
    
    return lines.join('\n');
  }
  
  // Helper: Get most referenced documents
  private getMostReferenced(): ObsidianDocument[] {
    return Array.from(this.graph.documents.values())
      .sort((a, b) => b.backlinks.length - a.backlinks.length)
      .slice(0, 10);
  }
  
  // Helper: Get documents by tag
  private getDocumentsByTag(tag: string): ObsidianDocument[] {
    const docIds = this.graph.tagIndex.get(tag);
    if (!docIds) return [];
    
    return Array.from(docIds)
      .map(id => this.graph.documents.get(id))
      .filter(d => d !== undefined) as ObsidianDocument[];
  }
  
  // Helper: Filter tags by prefix
  private filterTagsByPrefix(sortedTags: Array<[string, string[]]>, prefixes: string[]): string {
    const filtered = sortedTags.filter(([tag]) => 
      prefixes.some(prefix => tag.toLowerCase().includes(prefix))
    );
    
    return filtered
      .map(([tag, docs]) => `- #${tag} (${docs.length})`)
      .join('\n');
  }
  
  // Helper: Normalize tags
  private normalizeTags(tags: string[]): string[] {
    return tags.map(tag => 
      tag.toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/--+/g, '-')
        .replace(/^-|-$/g, '')
    );
  }
  
  // Helper: Escape regex
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  // Save index files
  async saveIndexes(): Promise<void> {
    const indexPath = path.join(this.vaultPath, this.projectName);
    await fs.mkdir(indexPath, { recursive: true });
    
    // Save tag index
    const tagIndex = await this.generateTagIndex();
    await fs.writeFile(path.join(indexPath, 'tag-index.md'), tagIndex);
    
    // Save document map
    const docMap = await this.generateDocumentMap();
    await fs.writeFile(path.join(indexPath, 'document-map.md'), docMap);
  }
}