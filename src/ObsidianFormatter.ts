export interface ObsidianFormatOptions {
  projectName: string;
  projectType: string;
  tags: string[];
  createBacklinks: boolean;
  addMetadata: boolean;
  linkToRelated: boolean;
}

export class ObsidianFormatter {
  private commonLinks: Map<string, string> = new Map([
    ['API', '[[API Reference]]'],
    ['architecture', '[[Architecture Overview]]'],
    ['setup', '[[Setup Guide]]'],
    ['testing', '[[Testing Strategy]]'],
    ['deployment', '[[Deployment Guide]]'],
    ['contributing', '[[Contributing Guidelines]]'],
    ['security', '[[Security Considerations]]'],
    ['performance', '[[Performance Optimization]]'],
    ['database', '[[Database Schema]]'],
    ['authentication', '[[Authentication Flow]]']
  ]);

  async format(documentation: any, options: ObsidianFormatOptions): Promise<any> {
    const formatted: any = {};
    
    for (const [key, content] of Object.entries(documentation)) {
      if (typeof content === 'string') {
        formatted[key] = await this.formatDocument(content, key, options);
      } else if (typeof content === 'object') {
        formatted[key] = await this.formatSection(content, key, options);
      }
    }
    
    return formatted;
  }

  private async formatDocument(content: string, docName: string, options: ObsidianFormatOptions): Promise<string> {
    let formatted = content;
    
    // Add frontmatter metadata
    if (options.addMetadata) {
      formatted = this.addFrontmatter(formatted, docName, options);
    }
    
    // Add tags inline
    formatted = this.addInlineTags(formatted, options.tags);
    
    // Create backlinks to related documents
    if (options.createBacklinks) {
      formatted = this.createBacklinks(formatted, options.projectName);
    }
    
    // Convert headings to linkable format
    formatted = this.convertHeadingsToLinks(formatted);
    
    // Add project-specific links
    formatted = this.addProjectLinks(formatted, options.projectName);
    
    // Format code blocks with language hints
    formatted = this.enhanceCodeBlocks(formatted);
    
    // Add navigation breadcrumbs
    formatted = this.addBreadcrumbs(formatted, docName, options.projectType);
    
    // Add related documents section
    if (options.linkToRelated) {
      formatted = this.addRelatedDocuments(formatted, docName, options);
    }
    
    return formatted;
  }

  private addFrontmatter(content: string, docName: string, options: ObsidianFormatOptions): string {
    const frontmatter = `---
title: ${docName.replace(/([A-Z])/g, ' $1').trim()}
project: ${options.projectName}
type: ${options.projectType}
tags: [${options.tags.join(', ')}]
created: ${new Date().toISOString().split('T')[0]}
updated: ${new Date().toISOString().split('T')[0]}
---

`;
    
    return frontmatter + content;
  }

  private addInlineTags(content: string, tags: string[]): string {
    // Add tags at the top of the document
    const tagLine = tags.map(tag => `#${tag}`).join(' ');
    
    // Insert after frontmatter if exists, otherwise at the beginning
    if (content.includes('---\n')) {
      const parts = content.split('---\n');
      if (parts.length >= 3) {
        return parts[0] + '---\n' + parts[1] + '---\n' + tagLine + '\n\n' + parts.slice(2).join('---\n');
      }
    }
    
    return tagLine + '\n\n' + content;
  }

  private createBacklinks(content: string, projectName: string): string {
    // Create links to main project documentation
    const projectLink = `[[${projectName}/index|${projectName}]]`;
    
    // Replace references to common terms with backlinks
    let formatted = content;
    
    // Link to project index when mentioning the project
    const projectRegex = new RegExp(`\\b${projectName}\\b(?!\\])`, 'gi');
    formatted = formatted.replace(projectRegex, projectLink);
    
    // Link common technical terms
    for (const [term, link] of this.commonLinks) {
      const regex = new RegExp(`\\b${term}\\b(?!\\])`, 'gi');
      formatted = formatted.replace(regex, link);
    }
    
    return formatted;
  }

  private convertHeadingsToLinks(content: string): string {
    // Convert markdown headings to linkable format
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    
    return content.replace(headingRegex, (match, hashes, heading) => {
      const linkableHeading = heading.replace(/[^\w\s-]/g, '').trim();
      return `${hashes} ${heading} ^${linkableHeading.toLowerCase().replace(/\s+/g, '-')}`;
    });
  }

  private addProjectLinks(content: string, projectName: string): string {
    // Add links to other project documents
    const docTypes = ['setup', 'api', 'architecture', 'testing', 'deployment'];
    let formatted = content;
    
    for (const docType of docTypes) {
      const regex = new RegExp(`(see|refer to|check|view)\\s+(the\\s+)?${docType}\\s+(documentation|guide|reference)`, 'gi');
      formatted = formatted.replace(regex, `$1 [[${projectName}/${docType}|$2${docType} $3]]`);
    }
    
    return formatted;
  }

  private enhanceCodeBlocks(content: string): string {
    // Add language hints and folding markers to code blocks
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    
    return content.replace(codeBlockRegex, (match, lang, code) => {
      const language = lang || 'plaintext';
      const lines = code.split('\n').length;
      
      if (lines > 20) {
        // Add folding hint for long code blocks
        return `\`\`\`${language} fold\n${code}\`\`\``;
      }
      
      return `\`\`\`${language}\n${code}\`\`\``;
    });
  }

  private addBreadcrumbs(content: string, docName: string, projectType: string): string {
    const breadcrumbs = `> [!breadcrumb]
> [[Documentation Index]] → [[${projectType} Projects]] → [[${docName}]]

`;
    
    return breadcrumbs + content;
  }

  private addRelatedDocuments(content: string, docName: string, options: ObsidianFormatOptions): string {
    const relatedSection = `

## Related Documents

- [[${options.projectName}/index|Project Overview]]
- [[${options.projectName}/architecture|Architecture]]
- [[${options.projectName}/api|API Reference]]
- [[${options.projectName}/setup|Setup Guide]]
- [[${options.projectName}/contributing|Contributing]]

## Tags

${options.tags.map(tag => `- #${tag}`).join('\n')}

## External Links

- [GitHub Repository](github-link-here)
- [Documentation](docs-link-here)
`;
    
    return content + relatedSection;
  }

  private async formatSection(section: any, sectionName: string, options: ObsidianFormatOptions): Promise<any> {
    const formatted: any = {};
    
    for (const [key, value] of Object.entries(section)) {
      if (typeof value === 'string') {
        formatted[key] = await this.formatDocument(value, `${sectionName}/${key}`, options);
      } else {
        formatted[key] = value;
      }
    }
    
    return formatted;
  }

  generateIndexPage(projects: string[], options: any): string {
    const indexContent = `---
title: Documentation Index
tags: [documentation, index, overview]
created: ${new Date().toISOString().split('T')[0]}
---

# Documentation Index

## Projects by Type

### Single Project Applications
${projects.filter(p => p.includes('single-project')).map(p => `- [[${p}]]`).join('\n')}

### Monorepos
${projects.filter(p => p.includes('monorepo')).map(p => `- [[${p}]]`).join('\n')}

### Multi-Tool Repositories
${projects.filter(p => p.includes('multi-tool')).map(p => `- [[${p}]]`).join('\n')}

### Libraries
${projects.filter(p => p.includes('library')).map(p => `- [[${p}]]`).join('\n')}

### Script Collections
${projects.filter(p => p.includes('scripts')).map(p => `- [[${p}]]`).join('\n')}

## Quick Links

- [[Setup Guides]]
- [[API References]]
- [[Architecture Overviews]]
- [[Contributing Guidelines]]

## Search by Tags

\`\`\`dataview
TABLE project, type, updated
FROM "docs"
SORT updated DESC
LIMIT 10
\`\`\`
`;
    
    return indexContent;
  }

  generateProjectGraph(projectName: string, dependencies: any): string {
    const graphContent = `---
title: ${projectName} Dependency Graph
tags: [graph, dependencies, architecture]
---

# ${projectName} Dependency Graph

\`\`\`mermaid
graph TD
    A[${projectName}] --> B[Core Dependencies]
    B --> C[Runtime Dependencies]
    B --> D[Development Dependencies]
    
    ${this.generateMermaidDependencies(dependencies)}
\`\`\`

## Interactive Graph

\`\`\`dataview
graph
from "docs/${projectName}"
\`\`\`
`;
    
    return graphContent;
  }

  private generateMermaidDependencies(dependencies: any): string {
    let mermaidCode = '';
    
    if (dependencies.runtime) {
      for (const dep of dependencies.runtime) {
        mermaidCode += `    C --> C${dep.replace(/[^a-zA-Z0-9]/g, '')}[${dep}]\n`;
      }
    }
    
    if (dependencies.dev) {
      for (const dep of dependencies.dev) {
        mermaidCode += `    D --> D${dep.replace(/[^a-zA-Z0-9]/g, '')}[${dep}]\n`;
      }
    }
    
    return mermaidCode;
  }
}