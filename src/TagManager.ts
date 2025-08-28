import * as fs from 'fs/promises';
import * as path from 'path';

export interface TagRegistry {
  commonTags: string[];
  projectTypeTags: { [key: string]: string[] };
  languageTags: { [key: string]: string[] };
  frameworkTags: { [key: string]: string[] };
  customTags: string[];
  tagUsageCount: { [key: string]: number };
}

export class TagManager {
  private registry: TagRegistry = {
    commonTags: [
      'documentation',
      'api',
      'architecture',
      'setup',
      'deployment',
      'testing',
      'contributing',
      'security',
      'performance',
      'database',
      'authentication',
      'configuration',
      'dependencies',
      'changelog',
      'roadmap'
    ],
    projectTypeTags: {
      'single-project': ['application', 'standalone', 'single-repo'],
      'monorepo': ['monorepo', 'workspace', 'multi-package'],
      'multi-tool': ['tools', 'utilities', 'scripts', 'multi-tool'],
      'library': ['library', 'package', 'module', 'sdk'],
      'cli-tool': ['cli', 'command-line', 'terminal'],
      'web-frontend': ['frontend', 'ui', 'spa', 'web-app'],
      'web-backend': ['backend', 'api', 'server', 'rest'],
      'web-fullstack': ['fullstack', 'full-stack', 'web'],
      'mobile-app': ['mobile', 'ios', 'android', 'react-native'],
      'desktop-app': ['desktop', 'electron', 'native-app']
    },
    languageTags: {
      'javascript': ['javascript', 'js', 'node', 'nodejs'],
      'typescript': ['typescript', 'ts', 'typed'],
      'python': ['python', 'py', 'pip'],
      'java': ['java', 'jvm', 'maven', 'gradle'],
      'go': ['golang', 'go'],
      'rust': ['rust', 'cargo'],
      'ruby': ['ruby', 'rails', 'gem'],
      'php': ['php', 'composer'],
      'csharp': ['csharp', 'dotnet', 'c#'],
      'swift': ['swift', 'ios'],
      'kotlin': ['kotlin', 'android']
    },
    frameworkTags: {
      'react': ['react', 'jsx', 'hooks'],
      'vue': ['vue', 'vuex', 'composition-api'],
      'angular': ['angular', 'rxjs'],
      'nextjs': ['nextjs', 'next', 'vercel'],
      'express': ['express', 'expressjs'],
      'django': ['django', 'python-web'],
      'rails': ['rails', 'ruby-on-rails'],
      'spring': ['spring', 'spring-boot'],
      'fastapi': ['fastapi', 'async-python'],
      'flask': ['flask', 'python-micro'],
      'laravel': ['laravel', 'php-framework'],
      'nestjs': ['nestjs', 'nest']
    },
    customTags: [],
    tagUsageCount: {}
  };

  private obsidianVaultPath: string;
  private tagRegistryPath: string;

  constructor(obsidianVaultPath: string) {
    this.obsidianVaultPath = obsidianVaultPath;
    this.tagRegistryPath = path.join(obsidianVaultPath, '.tag-registry.json');
  }

  async loadExistingTags(): Promise<void> {
    try {
      // Load saved registry if exists
      const registryContent = await fs.readFile(this.tagRegistryPath, 'utf-8');
      const savedRegistry = JSON.parse(registryContent);
      this.registry = { ...this.registry, ...savedRegistry };
      
      console.log(`  📋 Loaded ${Object.keys(this.registry.tagUsageCount).length} existing tags`);
    } catch (error) {
      console.log('  📋 No existing tag registry found, using defaults');
    }
    
    // Scan Obsidian vault for existing tags
    await this.scanVaultForTags();
  }

  private async scanVaultForTags(): Promise<void> {
    try {
      const files = await this.getAllMarkdownFiles(this.obsidianVaultPath);
      
      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        const tags = this.extractTagsFromContent(content);
        
        for (const tag of tags) {
          // Add to custom tags if not in predefined lists
          if (!this.isKnownTag(tag)) {
            if (!this.registry.customTags.includes(tag)) {
              this.registry.customTags.push(tag);
            }
          }
          
          // Update usage count
          this.registry.tagUsageCount[tag] = (this.registry.tagUsageCount[tag] || 0) + 1;
        }
      }
      
      console.log(`  🏷️ Found ${this.registry.customTags.length} custom tags in vault`);
    } catch (error) {
      // Vault might not exist yet
      console.log('  🏷️ Obsidian vault not found, will be created');
    }
  }

  private async getAllMarkdownFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const subFiles = await this.getAllMarkdownFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory might not exist
    }
    
    return files;
  }

  private extractTagsFromContent(content: string): string[] {
    const tags: string[] = [];
    
    // Extract from frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const tagsMatch = frontmatterMatch[1].match(/tags:\s*\[(.*?)\]/);
      if (tagsMatch) {
        const frontmatterTags = tagsMatch[1].split(',').map(t => t.trim().replace(/['"]/g, ''));
        tags.push(...frontmatterTags);
      }
    }
    
    // Extract inline tags
    const inlineTags = content.match(/#[a-zA-Z0-9_-]+/g) || [];
    tags.push(...inlineTags.map(t => t.substring(1)));
    
    return [...new Set(tags)]; // Remove duplicates
  }

  private isKnownTag(tag: string): boolean {
    if (this.registry.commonTags.includes(tag)) return true;
    
    for (const tags of Object.values(this.registry.projectTypeTags)) {
      if (tags.includes(tag)) return true;
    }
    
    for (const tags of Object.values(this.registry.languageTags)) {
      if (tags.includes(tag)) return true;
    }
    
    for (const tags of Object.values(this.registry.frameworkTags)) {
      if (tags.includes(tag)) return true;
    }
    
    return false;
  }

  async getTagsForProject(analysis: any): Promise<string[]> {
    const tags: string[] = [];
    
    // Add common relevant tags
    tags.push('documentation');
    
    // Add project type tags
    if (analysis.projectType && this.registry.projectTypeTags[analysis.projectType]) {
      tags.push(...this.registry.projectTypeTags[analysis.projectType]);
    }
    
    // Add language tags
    if (analysis.languages) {
      for (const lang of Object.keys(analysis.languages)) {
        const langLower = lang.toLowerCase();
        if (this.registry.languageTags[langLower]) {
          tags.push(...this.registry.languageTags[langLower].slice(0, 2)); // Limit to 2 tags per language
        }
      }
    }
    
    // Add framework tags
    if (analysis.frameworks) {
      for (const framework of analysis.frameworks) {
        const frameworkLower = framework.toLowerCase();
        if (this.registry.frameworkTags[frameworkLower]) {
          tags.push(...this.registry.frameworkTags[frameworkLower].slice(0, 2));
        }
      }
    }
    
    // Add category-specific tags
    const category = analysis.category || '';
    if (category.includes('web')) tags.push('web');
    if (category.includes('mobile')) tags.push('mobile');
    if (category.includes('desktop')) tags.push('desktop');
    if (category.includes('data')) tags.push('data-science');
    if (category.includes('devops')) tags.push('devops', 'infrastructure');
    
    // Add version control tags
    if (analysis.versionControl?.isGitRepo) {
      tags.push('git');
      if (analysis.versionControl.remoteUrl?.includes('github')) {
        tags.push('github');
      }
    }
    
    // Remove duplicates and limit total tags
    const uniqueTags = [...new Set(tags)];
    
    // Sort by usage frequency (prefer commonly used tags)
    uniqueTags.sort((a, b) => {
      const countA = this.registry.tagUsageCount[a] || 0;
      const countB = this.registry.tagUsageCount[b] || 0;
      return countB - countA;
    });
    
    // Return top 10 most relevant tags
    return uniqueTags.slice(0, 10);
  }

  async saveTagRegistry(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.tagRegistryPath), { recursive: true });
      await fs.writeFile(
        this.tagRegistryPath,
        JSON.stringify(this.registry, null, 2)
      );
      console.log('  💾 Tag registry saved');
    } catch (error) {
      console.error('  ❌ Failed to save tag registry:', error);
    }
  }

  async generateTagIndex(): Promise<string> {
    const tagIndex = `---
title: Tag Index
tags: [index, tags, reference]
---

# Tag Index

## Tag Cloud

${this.generateTagCloud()}

## Tags by Category

### Project Types
${this.formatTagList(Object.values(this.registry.projectTypeTags).flat())}

### Programming Languages
${this.formatTagList(Object.values(this.registry.languageTags).flat())}

### Frameworks
${this.formatTagList(Object.values(this.registry.frameworkTags).flat())}

### Common Tags
${this.formatTagList(this.registry.commonTags)}

### Custom Tags
${this.formatTagList(this.registry.customTags)}

## Tag Usage Statistics

| Tag | Usage Count |
|-----|-------------|
${this.generateUsageTable()}

## Search by Tag

\`\`\`dataview
TABLE file.name as "Document", tags as "Tags"
FROM "docs"
WHERE contains(tags, this.tag)
SORT file.name
\`\`\`
`;
    
    return tagIndex;
  }

  private generateTagCloud(): string {
    const sortedTags = Object.entries(this.registry.tagUsageCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30);
    
    return sortedTags.map(([tag, count]) => {
      const size = Math.min(Math.max(count / 5, 1), 4);
      return `<span style="font-size: ${size}em">#${tag}</span>`;
    }).join(' ');
  }

  private formatTagList(tags: string[]): string {
    const uniqueTags = [...new Set(tags)];
    return uniqueTags.map(tag => `- #${tag}`).join('\n');
  }

  private generateUsageTable(): string {
    const sortedUsage = Object.entries(this.registry.tagUsageCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
    
    return sortedUsage.map(([tag, count]) => `| #${tag} | ${count} |`).join('\n');
  }
}