import * as fs from 'fs/promises';
import * as path from 'path';
import { UltraTerminalUI } from './UltraTerminalUI';

interface TagDefinition {
  tag: string;
  aliases: string[];
  parent?: string;
  category: 'project' | 'language' | 'framework' | 'tool' | 'concept' | 'meta';
  count: number;
  firstSeen: Date;
  lastUsed: Date;
}

interface TagHierarchy {
  projectRoot: string; // Main parent tag for entire project
  categories: Map<string, Set<string>>;
  relationships: Map<string, Set<string>>; // tag -> related tags
  consolidationRules: Map<string, string>; // alias -> canonical tag
}

export class SmartTagManager {
  private vaultPath: string;
  private tagRegistry: Map<string, TagDefinition> = new Map();
  private hierarchy: TagHierarchy;
  private display: UltraTerminalUI | null;
  private similarityThreshold: number = 0.8; // 80% similarity
  
  constructor(vaultPath: string, projectName: string, display?: UltraTerminalUI) {
    this.vaultPath = vaultPath;
    this.display = display || null;
    
    // Initialize hierarchy with project root tag
    this.hierarchy = {
      projectRoot: this.normalizeTag(projectName),
      categories: new Map(),
      relationships: new Map(),
      consolidationRules: new Map()
    };
    
    this.initializeCommonConsolidations();
  }
  
  /**
   * Initialize common tag consolidation rules
   */
  private initializeCommonConsolidations(): void {
    // Common consolidations
    const rules = [
      // Animations
      ['animation', 'animations', 'animate', 'animated'],
      ['after-effects', 'adobe-after-effects', 'ae', 'aftereffects'],
      
      // JavaScript variations
      ['javascript', 'js', 'node-js', 'nodejs', 'node'],
      ['typescript', 'ts'],
      
      // Frameworks
      ['react', 'reactjs', 'react-js'],
      ['vue', 'vuejs', 'vue-js'],
      ['angular', 'angularjs'],
      
      // Testing
      ['test', 'tests', 'testing', 'unit-test', 'unit-tests'],
      ['e2e', 'end-to-end', 'e2e-test', 'integration-test'],
      
      // Documentation
      ['docs', 'documentation', 'doc'],
      ['readme', 'read-me'],
      ['api', 'apis', 'api-reference'],
      
      // Development
      ['dev', 'development', 'develop'],
      ['prod', 'production'],
      ['config', 'configuration', 'configs'],
      
      // Common concepts
      ['auth', 'authentication', 'authorize', 'authorization'],
      ['db', 'database', 'databases'],
      ['ui', 'user-interface', 'frontend', 'front-end'],
      ['backend', 'back-end', 'server', 'server-side'],
      ['cli', 'command-line', 'terminal'],
      ['util', 'utils', 'utility', 'utilities', 'helper', 'helpers'],
      
      // File types
      ['img', 'image', 'images', 'graphics'],
      ['vid', 'video', 'videos', 'media'],
      ['css', 'styles', 'styling', 'stylesheet'],
      
      // Actions
      ['create', 'creation', 'generate', 'generator'],
      ['update', 'modify', 'edit'],
      ['delete', 'remove', 'deletion'],
      ['get', 'fetch', 'retrieve', 'read'],
      ['set', 'save', 'write', 'store']
    ];
    
    // Set up consolidation rules (all aliases map to first item)
    for (const group of rules) {
      const canonical = group[0];
      for (let i = 1; i < group.length; i++) {
        this.hierarchy.consolidationRules.set(group[i], canonical);
      }
    }
  }
  
  /**
   * Load existing tags from vault
   */
  async loadExistingTags(): Promise<void> {
    if (this.display) {
      this.display.stream('📋 Scanning vault for existing tags...');
    }
    
    try {
      await this.scanDirectory(this.vaultPath);
      
      if (this.display) {
        this.display.stream(`✓ Found ${this.tagRegistry.size} unique tags`);
      }
    } catch (error) {
      console.error('Failed to load existing tags:', error);
    }
  }
  
  /**
   * Scan directory for tags in markdown files
   */
  private async scanDirectory(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        await this.scanDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        await this.extractTagsFromFile(fullPath);
      }
    }
  }
  
  /**
   * Extract tags from a markdown file
   */
  private async extractTagsFromFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Extract from frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        const tagsMatch = frontmatter.match(/tags:\s*\[(.*?)\]/);
        if (tagsMatch) {
          const tags = tagsMatch[1].split(',').map(t => t.trim().replace(/['"]/g, ''));
          tags.forEach(tag => this.registerExistingTag(tag));
        }
      }
      
      // Extract inline tags
      const inlineTags = content.matchAll(/#([a-zA-Z0-9-_]+)/g);
      for (const match of inlineTags) {
        this.registerExistingTag(match[1]);
      }
    } catch (error) {
      // File might not be readable
    }
  }
  
  /**
   * Register an existing tag
   */
  private registerExistingTag(tag: string): void {
    const normalized = this.normalizeTag(tag);
    const existing = this.tagRegistry.get(normalized);
    
    if (existing) {
      existing.count++;
      existing.lastUsed = new Date();
    } else {
      this.tagRegistry.set(normalized, {
        tag: normalized,
        aliases: [],
        category: this.categorizeTag(normalized),
        count: 1,
        firstSeen: new Date(),
        lastUsed: new Date()
      });
    }
  }
  
  /**
   * Process and validate tags for a document
   */
  processDocumentTags(proposedTags: string[], documentType?: string): string[] {
    const processed: string[] = [];
    
    // Always include project root tag
    processed.push(this.hierarchy.projectRoot);
    
    // Add document type tag if provided
    if (documentType) {
      processed.push(this.normalizeTag(documentType));
    }
    
    // Process each proposed tag
    for (const tag of proposedTags) {
      const normalized = this.normalizeTag(tag);
      
      // Check consolidation rules
      const canonical = this.hierarchy.consolidationRules.get(normalized) || normalized;
      
      // Check for similar existing tags
      const similar = this.findSimilarTag(canonical);
      if (similar && similar !== canonical) {
        if (this.display) {
          this.display.stream(`🔄 Consolidating '${canonical}' → '${similar}'`);
        }
        processed.push(similar);
        
        // Add to consolidation rules for future
        this.hierarchy.consolidationRules.set(canonical, similar);
      } else {
        processed.push(canonical);
        this.registerTag(canonical);
      }
    }
    
    // Remove duplicates and limit count
    const unique = [...new Set(processed)];
    
    // If too many tags, prioritize by category
    if (unique.length > 10) {
      return this.prioritizeTags(unique);
    }
    
    return unique;
  }
  
  /**
   * Find similar existing tag
   */
  private findSimilarTag(tag: string): string | null {
    let bestMatch: string | null = null;
    let bestScore = 0;
    
    for (const [existingTag, definition] of this.tagRegistry.entries()) {
      // Skip if very rarely used
      if (definition.count < 2) continue;
      
      const score = this.calculateSimilarity(tag, existingTag);
      if (score > this.similarityThreshold && score > bestScore) {
        bestScore = score;
        bestMatch = existingTag;
      }
      
      // Check aliases
      for (const alias of definition.aliases) {
        const aliasScore = this.calculateSimilarity(tag, alias);
        if (aliasScore > this.similarityThreshold && aliasScore > bestScore) {
          bestScore = aliasScore;
          bestMatch = existingTag;
        }
      }
    }
    
    return bestMatch;
  }
  
  /**
   * Calculate similarity between two tags
   */
  private calculateSimilarity(tag1: string, tag2: string): number {
    // Exact match
    if (tag1 === tag2) return 1;
    
    // One contains the other
    if (tag1.includes(tag2) || tag2.includes(tag1)) {
      return 0.9;
    }
    
    // Levenshtein distance
    const distance = this.levenshteinDistance(tag1, tag2);
    const maxLength = Math.max(tag1.length, tag2.length);
    const similarity = 1 - (distance / maxLength);
    
    // Boost if they share common words
    const words1 = tag1.split(/[-_]/);
    const words2 = tag2.split(/[-_]/);
    const commonWords = words1.filter(w => words2.includes(w));
    if (commonWords.length > 0) {
      return Math.min(1, similarity + (commonWords.length * 0.1));
    }
    
    return similarity;
  }
  
  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
  
  /**
   * Register a new tag
   */
  private registerTag(tag: string): void {
    const existing = this.tagRegistry.get(tag);
    
    if (existing) {
      existing.count++;
      existing.lastUsed = new Date();
    } else {
      const definition: TagDefinition = {
        tag,
        aliases: [],
        category: this.categorizeTag(tag),
        count: 1,
        firstSeen: new Date(),
        lastUsed: new Date()
      };
      
      // Set parent if applicable
      if (definition.category !== 'project') {
        definition.parent = this.hierarchy.projectRoot;
      }
      
      this.tagRegistry.set(tag, definition);
    }
  }
  
  /**
   * Categorize a tag
   */
  private categorizeTag(tag: string): 'project' | 'language' | 'framework' | 'tool' | 'concept' | 'meta' {
    // Languages
    if (['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'c', 'cpp', 'ruby', 'php'].includes(tag)) {
      return 'language';
    }
    
    // Frameworks
    if (['react', 'vue', 'angular', 'express', 'django', 'rails', 'spring'].includes(tag)) {
      return 'framework';
    }
    
    // Tools
    if (['git', 'docker', 'webpack', 'vite', 'eslint', 'prettier', 'jest'].includes(tag)) {
      return 'tool';
    }
    
    // Meta tags
    if (['readme', 'documentation', 'api', 'guide', 'tutorial', 'example'].includes(tag)) {
      return 'meta';
    }
    
    // Project (if matches project root)
    if (tag === this.hierarchy.projectRoot) {
      return 'project';
    }
    
    // Default to concept
    return 'concept';
  }
  
  /**
   * Prioritize tags by importance
   */
  private prioritizeTags(tags: string[]): string[] {
    // Priority order: project > language > framework > tool > meta > concept
    const priorityMap = {
      'project': 0,
      'language': 1,
      'framework': 2,
      'tool': 3,
      'meta': 4,
      'concept': 5
    };
    
    return tags
      .sort((a, b) => {
        const catA = this.categorizeTag(a);
        const catB = this.categorizeTag(b);
        return priorityMap[catA] - priorityMap[catB];
      })
      .slice(0, 10); // Keep top 10
  }
  
  /**
   * Normalize a tag
   */
  private normalizeTag(tag: string): string {
    return tag
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  /**
   * Perform tag review and consolidation
   */
  async reviewAndConsolidate(): Promise<{
    consolidated: Map<string, string>;
    removed: string[];
    hierarchy: any;
  }> {
    if (this.display) {
      this.display.createTask('tag-review', 'Reviewing Tags', 100);
      this.display.updateTask('tag-review', 20, 'Analyzing tag usage...');
    }
    
    const consolidated = new Map<string, string>();
    const removed: string[] = [];
    
    // Remove single-use tags that aren't important
    for (const [tag, definition] of this.tagRegistry.entries()) {
      if (definition.count === 1 && definition.category === 'concept') {
        removed.push(tag);
        this.tagRegistry.delete(tag);
      }
    }
    
    if (this.display) {
      this.display.updateTask('tag-review', 50, 'Finding similar tags...');
    }
    
    // Find and consolidate similar tags
    const tags = Array.from(this.tagRegistry.keys());
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const similarity = this.calculateSimilarity(tags[i], tags[j]);
        if (similarity > this.similarityThreshold) {
          const def1 = this.tagRegistry.get(tags[i])!;
          const def2 = this.tagRegistry.get(tags[j])!;
          
          // Keep the more frequently used one
          if (def1.count > def2.count) {
            consolidated.set(tags[j], tags[i]);
            def1.aliases.push(tags[j]);
            this.tagRegistry.delete(tags[j]);
          } else {
            consolidated.set(tags[i], tags[j]);
            def2.aliases.push(tags[i]);
            this.tagRegistry.delete(tags[i]);
          }
        }
      }
    }
    
    if (this.display) {
      this.display.updateTask('tag-review', 80, 'Building hierarchy...');
    }
    
    // Build final hierarchy
    const hierarchy = this.buildHierarchy();
    
    if (this.display) {
      this.display.completeTask('tag-review', true);
    }
    
    return { consolidated, removed, hierarchy };
  }
  
  /**
   * Build tag hierarchy
   */
  private buildHierarchy(): any {
    const hierarchy: any = {
      root: this.hierarchy.projectRoot,
      categories: {},
      relationships: {}
    };
    
    // Group by category
    for (const [tag, definition] of this.tagRegistry.entries()) {
      const category = definition.category;
      if (!hierarchy.categories[category]) {
        hierarchy.categories[category] = [];
      }
      
      hierarchy.categories[category].push({
        tag,
        count: definition.count,
        aliases: definition.aliases,
        parent: definition.parent
      });
    }
    
    // Sort each category by usage
    for (const category in hierarchy.categories) {
      hierarchy.categories[category].sort((a: any, b: any) => b.count - a.count);
    }
    
    return hierarchy;
  }
  
  /**
   * Generate tag report
   */
  generateTagReport(): string {
    const hierarchy = this.buildHierarchy();
    
    let report = `# Tag Analysis Report\n\n`;
    report += `## Project Root Tag\n\n`;
    report += `\`${this.hierarchy.projectRoot}\` - All documents include this tag\n\n`;
    
    report += `## Tag Statistics\n\n`;
    report += `- Total unique tags: ${this.tagRegistry.size}\n`;
    report += `- Consolidation rules: ${this.hierarchy.consolidationRules.size}\n\n`;
    
    report += `## Tags by Category\n\n`;
    
    for (const [category, tags] of Object.entries(hierarchy.categories)) {
      if (!tags || (tags as any[]).length === 0) continue;
      
      report += `### ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;
      
      for (const tag of (tags as any[])) {
        report += `- **${tag.tag}** (${tag.count} uses)`;
        if (tag.aliases.length > 0) {
          report += ` - Aliases: ${tag.aliases.join(', ')}`;
        }
        report += `\n`;
      }
      report += `\n`;
    }
    
    report += `## Consolidation Rules\n\n`;
    
    for (const [alias, canonical] of this.hierarchy.consolidationRules.entries()) {
      report += `- \`${alias}\` → \`${canonical}\`\n`;
    }
    
    return report;
  }
  
  /**
   * Update all documents with consolidated tags
   */
  async updateDocumentTags(consolidated: Map<string, string>): Promise<number> {
    let updated = 0;
    
    // This would scan all documents and update tags
    // Implementation depends on your document structure
    
    return updated;
  }
  
  /**
   * Save tag registry for future use
   */
  async saveRegistry(): Promise<void> {
    const registryPath = path.join(this.vaultPath, '.tag-registry.json');
    
    const data = {
      projectRoot: this.hierarchy.projectRoot,
      registry: Array.from(this.tagRegistry.entries()),
      consolidationRules: Array.from(this.hierarchy.consolidationRules.entries()),
      lastUpdated: new Date().toISOString()
    };
    
    await fs.writeFile(registryPath, JSON.stringify(data, null, 2));
  }
  
  /**
   * Load saved registry
   */
  async loadRegistry(): Promise<void> {
    const registryPath = path.join(this.vaultPath, '.tag-registry.json');
    
    try {
      const content = await fs.readFile(registryPath, 'utf-8');
      const data = JSON.parse(content);
      
      this.hierarchy.projectRoot = data.projectRoot;
      this.tagRegistry = new Map(data.registry);
      this.hierarchy.consolidationRules = new Map(data.consolidationRules);
      
      if (this.display) {
        this.display.stream(`📚 Loaded tag registry (${this.tagRegistry.size} tags)`);
      }
    } catch (error) {
      // No saved registry
      if (this.display) {
        this.display.stream('📚 No existing tag registry found');
      }
    }
  }
  
  /**
   * Get statistics about tags
   */
  getStatistics(): any {
    const totalTags = this.tagRegistry.size;
    const consolidated = Array.from(this.tagRegistry.values()).filter(t => t.aliases.length > 0).length;
    const singleUse = Array.from(this.tagRegistry.values()).filter(t => t.count === 1).length;
    const categories = new Map<string, number>();
    
    for (const tag of this.tagRegistry.values()) {
      categories.set(tag.category, (categories.get(tag.category) || 0) + 1);
    }
    
    return {
      totalTags,
      consolidated,
      removed: singleUse,
      uniqueTags: totalTags - singleUse,
      categories: Object.fromEntries(categories),
      hierarchy: this.hierarchy
    };
  }
}