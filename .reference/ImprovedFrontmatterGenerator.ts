import * as path from 'path';
import * as fs from 'fs/promises';

export interface FrontmatterOptions {
  title: string;
  type: string;
  project: string;
  tags: string[];
  relatedFiles?: string[];
  backlinks?: string[];
  frontlinks?: string[];
  description?: string;
  author?: string;
  version?: string;
}

export class ImprovedFrontmatterGenerator {
  private projectPath: string;
  private projectName: string;
  
  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.projectName = path.basename(projectPath);
  }
  
  /**
   * Generate complete frontmatter with ALL required fields
   */
  async generateFrontmatter(options: FrontmatterOptions): Promise<string> {
    // Get current date in local timezone
    const now = new Date();
    const localDate = now.toLocaleDateString('en-CA'); // YYYY-MM-DD format
    const localTime = now.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    // Build frontmatter object
    const frontmatter: any = {
      title: options.title,
      date: localDate,
      time: localTime,
      lastModified: `${localDate} ${localTime}`,
      type: options.type || 'documentation',
      project: options.project || this.projectName,
      status: 'documented',
      verified: true,
      author: options.author || 'DocuMentor',
      version: options.version || await this.getProjectVersion()
    };
    
    // Add tags - ensure no duplicates and proper formatting
    const consolidatedTags = await this.consolidateTags(options.tags);
    frontmatter.tags = consolidatedTags;
    
    // Add description if provided
    if (options.description) {
      frontmatter.description = options.description;
    }
    
    // Add related files as frontlinks
    if (options.relatedFiles && options.relatedFiles.length > 0) {
      frontmatter.related = options.relatedFiles.map(file => `[[${file}]]`);
    }
    
    // Add backlinks if provided
    if (options.backlinks && options.backlinks.length > 0) {
      frontmatter.backlinks = options.backlinks.map(link => `[[${link}]]`);
    }
    
    // Add frontlinks if provided
    if (options.frontlinks && options.frontlinks.length > 0) {
      frontmatter.frontlinks = options.frontlinks.map(link => `[[${link}]]`);
    }
    
    // Add metadata
    frontmatter.metadata = {
      generatedBy: 'DocuMentor v2.0.0',
      generatedAt: new Date().toISOString(),
      projectPath: this.projectPath,
      documentPath: options.title.toLowerCase().replace(/\s+/g, '-')
    };
    
    // Convert to YAML format
    return this.toYamlFrontmatter(frontmatter);
  }
  
  /**
   * Consolidate tags - ensure proper hierarchy and no duplicates
   */
  private async consolidateTags(tags: string[]): Promise<string[]> {
    const consolidatedTags = new Set<string>();
    
    // Always add base tags
    consolidatedTags.add('docuMentor');
    consolidatedTags.add('documentation');
    consolidatedTags.add(`project/${this.projectName}`);
    consolidatedTags.add('auto-generated');
    
    // Add provided tags
    for (const tag of tags) {
      // Ensure tag format (no # prefix in frontmatter)
      const cleanTag = tag.replace(/^#/, '');
      consolidatedTags.add(cleanTag);
    }
    
    // Add date-based tag
    const year = new Date().getFullYear();
    const month = new Date().toLocaleDateString('en-US', { month: 'short' }).toLowerCase();
    consolidatedTags.add(`${year}/${month}`);
    
    // Limit to 10 tags as per requirements
    const tagArray = Array.from(consolidatedTags);
    if (tagArray.length > 10) {
      // Prioritize: keep docuMentor, documentation, project, and most specific tags
      const priorityTags = tagArray.filter(t => 
        t === 'docuMentor' || 
        t === 'documentation' || 
        t.startsWith('project/') ||
        t.includes('/')
      );
      const otherTags = tagArray.filter(t => !priorityTags.includes(t));
      return [...priorityTags.slice(0, 7), ...otherTags.slice(0, 3)];
    }
    
    return tagArray;
  }
  
  /**
   * Get project version from package.json or other sources
   */
  private async getProjectVersion(): Promise<string> {
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      const packageData = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageData);
      return packageJson.version || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }
  
  /**
   * Convert object to YAML frontmatter format
   */
  private toYamlFrontmatter(obj: any): string {
    const lines = ['---'];
    
    // Simple fields first
    const simpleFields = ['title', 'date', 'time', 'lastModified', 'type', 'project', 'status', 'verified', 'author', 'version', 'description'];
    for (const field of simpleFields) {
      if (obj[field] !== undefined) {
        const value = typeof obj[field] === 'string' ? obj[field] : String(obj[field]);
        lines.push(`${field}: ${this.escapeYamlValue(value)}`);
      }
    }
    
    // Tags array
    if (obj.tags && obj.tags.length > 0) {
      lines.push('tags:');
      for (const tag of obj.tags) {
        lines.push(`  - ${this.escapeYamlValue(tag)}`);
      }
    }
    
    // Related links arrays
    const linkFields = ['related', 'backlinks', 'frontlinks'];
    for (const field of linkFields) {
      if (obj[field] && obj[field].length > 0) {
        lines.push(`${field}:`);
        for (const link of obj[field]) {
          lines.push(`  - "${link}"`);
        }
      }
    }
    
    // Metadata object
    if (obj.metadata) {
      lines.push('metadata:');
      for (const [key, value] of Object.entries(obj.metadata)) {
        lines.push(`  ${key}: ${this.escapeYamlValue(String(value))}`);
      }
    }
    
    lines.push('---');
    
    return lines.join('\n');
  }
  
  /**
   * Escape YAML value if needed
   */
  private escapeYamlValue(value: string): string {
    // Check if value needs quotes
    if (value.includes(':') || value.includes('#') || value.includes('[') || 
        value.includes(']') || value.includes('{') || value.includes('}') ||
        value.includes('|') || value.includes('>') || value.includes('@') ||
        value.includes('`') || value.includes('"') || value.includes("'")) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }
  
  /**
   * Update existing frontmatter in a document
   */
  async updateFrontmatter(content: string, updates: Partial<FrontmatterOptions>): Promise<string> {
    // Check if content has frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    
    if (!frontmatterMatch) {
      // No existing frontmatter, add new one
      const newFrontmatter = await this.generateFrontmatter({
        title: updates.title || 'Untitled',
        type: updates.type || 'documentation',
        project: updates.project || this.projectName,
        tags: updates.tags || []
      });
      return newFrontmatter + '\n\n' + content;
    }
    
    // Parse existing frontmatter and merge with updates
    // This is simplified - in production would use a proper YAML parser
    const existingFrontmatter = frontmatterMatch[1];
    const updatedOptions: FrontmatterOptions = {
      title: updates.title || this.extractField(existingFrontmatter, 'title') || 'Untitled',
      type: updates.type || this.extractField(existingFrontmatter, 'type') || 'documentation',
      project: updates.project || this.extractField(existingFrontmatter, 'project') || this.projectName,
      tags: updates.tags || this.extractTags(existingFrontmatter) || []
    };
    
    const newFrontmatter = await this.generateFrontmatter(updatedOptions);
    const contentWithoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n\n?/, '');
    
    return newFrontmatter + '\n\n' + contentWithoutFrontmatter;
  }
  
  /**
   * Extract field from YAML frontmatter
   */
  private extractField(yaml: string, field: string): string | null {
    const match = yaml.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
    return match ? match[1].replace(/^["']|["']$/g, '') : null;
  }
  
  /**
   * Extract tags from YAML frontmatter
   */
  private extractTags(yaml: string): string[] {
    const tags: string[] = [];
    const tagSection = yaml.match(/^tags:\n((?:  - .+\n?)+)/m);
    
    if (tagSection) {
      const tagLines = tagSection[1].split('\n');
      for (const line of tagLines) {
        const match = line.match(/^  - (.+)$/);
        if (match) {
          tags.push(match[1].replace(/^["']|["']$/g, ''));
        }
      }
    }
    
    return tags;
  }
  
  /**
   * Validate that frontmatter has all required fields
   */
  validateFrontmatter(content: string): boolean {
    // Check if content has frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    
    if (!frontmatterMatch) {
      return false; // No frontmatter found
    }
    
    const frontmatter = frontmatterMatch[1];
    
    // Required fields for validation
    const requiredFields = [
      'title:',
      'date:',
      'time:',
      'type:',
      'project:',
      'status:',
      'verified:',
      'author:',
      'tags:',
      'metadata:'
    ];
    
    // Check each required field exists
    for (const field of requiredFields) {
      if (!frontmatter.includes(field)) {
        return false;
      }
    }
    
    // Validate tags section has at least one tag
    const tagsMatch = frontmatter.match(/^tags:\n((?:  - .+\n?)+)/m);
    if (!tagsMatch || tagsMatch[1].trim().length === 0) {
      return false;
    }
    
    return true;
  }
}