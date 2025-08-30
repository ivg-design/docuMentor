import * as path from 'path'
import { ClaudeClient, FrontmatterEnhancementRequest } from './ClaudeClient'
import { formatDocumentDate } from '../utils/datetime'

export interface UniversalFrontmatter {
  project: string;
  project_tag: string;
  title: string;
  type: string;
  status: string;
  created: string;
  modified: string;
  source_files: string[];
  related: string[];
  tags?: string[];
  description?: string;
  author?: string;
  version?: string;
  dependencies?: string[];
}

export interface ProcessedDocument {
  filePath: string;
  title: string;
  type: string;
  content: string;
  frontmatter: any;
  tags: string[];
  backlinks: string[];
  sourceFiles: string[];
  errors: string[];
  warnings: string[];
}

export interface ProcessingContext {
  config: any;
  existingDocs: Map<string, ProcessedDocument>;
  tagHierarchy: Map<string, string[]>;
  documentGraph: Map<string, string[]>;
  sourceFileMap: Map<string, string[]>;
  processingStats: any;
}

/**
 * Universal frontmatter generator for Obsidian integration
 * Generates simple, flexible frontmatter that works with all document types
 */
export class ObsidianFrontmatter {
  private config: any
  private claudeClient: ClaudeClient

  constructor(config: any, claudeClient: ClaudeClient) {
    this.config = config
    this.claudeClient = claudeClient
  }

  /**
   * Generates universal frontmatter for a document
   * Always includes core fields, optionally enhances with AI
   */
  public async generateFrontmatter(
    document: ProcessedDocument,
    context: ProcessingContext
  ): Promise<UniversalFrontmatter> {
    // Start with base frontmatter
    const baseFrontmatter = this.generateBaseFrontmatter(document)

    // Enhance with context-aware fields
    const enhancedFrontmatter = this.enhanceWithContext(baseFrontmatter, document, context)

    // Optionally enhance with AI insights
    const finalFrontmatter = await this.enhanceWithAI(enhancedFrontmatter, document)

    return finalFrontmatter
  }

  /**
   * Generates base universal frontmatter structure
   * Includes all required fields with sensible defaults
   */
  private generateBaseFrontmatter(document: ProcessedDocument): UniversalFrontmatter {
    const now = new Date()
    const timestamp = this.formatTimestamp(now)

    // Determine creation time (use existing if available, otherwise current time)
    const createdTime = document.frontmatter?.created || timestamp

    return {
      project: this.config.projectName,
      project_tag: this.config.projectTag,
      title: this.cleanTitle(document.title),
      type: this.normalizeDocumentType(document.type),
      status: this.determineDocumentStatus(document),
      created: createdTime,
      modified: timestamp,
      source_files: [...document.sourceFiles],
      related: [],
      description: this.generateBasicDescription(document),
      tags: [...document.tags]
    }
  }

  /**
   * Enhances frontmatter with contextual information
   */
  private enhanceWithContext(
    frontmatter: UniversalFrontmatter,
    document: ProcessedDocument,
    context: ProcessingContext
  ): UniversalFrontmatter {
    // Add related documents
    frontmatter.related = this.findRelatedDocuments(document, context)

    // Add dependencies if this is a code document
    if (this.isCodeDocument(document)) {
      frontmatter.dependencies = this.extractDependencies(document)
    }

    // Add version information if available
    frontmatter.version = this.extractVersionInfo(document, context)

    // Enhance description with context
    frontmatter.description = this.enhanceDescription(frontmatter.description || '', document, context)

    return frontmatter
  }

  /**
   * Enhances frontmatter with AI-generated insights
   */
  private async enhanceWithAI(
    frontmatter: UniversalFrontmatter,
    document: ProcessedDocument
  ): Promise<UniversalFrontmatter> {
    try {
      // Only use AI enhancement for complex documents
      if (document.content.length < 500 || document.errors.length > 0) {
        return frontmatter
      }

      const request: FrontmatterEnhancementRequest = {
        frontmatter,
        document,
        contentPreview: document.content.substring(0, 500)
      }
      const enhancement = await this.claudeClient.enhanceFrontmatter(request)

      if (enhancement) {
        return this.mergeAIEnhancement(frontmatter, enhancement)
      }
    } catch (error) {
      console.warn('AI enhancement failed, using base frontmatter:', error)
    }

    return frontmatter
  }

  /**
   * Creates prompt for AI frontmatter enhancement
   */
  private createAIEnhancementPrompt(
    frontmatter: UniversalFrontmatter,
    document: ProcessedDocument
  ): string {
    const contentPreview = document.content.substring(0, 1000)

    return `Enhance this document's frontmatter with better description and appropriate tags.

Current frontmatter:
${JSON.stringify(frontmatter, null, 2)}

Document content preview:
${contentPreview}

Please suggest:
1. A better description (1-2 sentences, clear and specific)
2. Additional relevant tags (hierarchical format like #type/api #component/auth)
3. Any other relevant metadata

Keep the core structure intact. Focus on accuracy and usefulness.`
  }

  /**
   * Merges AI enhancement with base frontmatter
   */
  private mergeAIEnhancement(
    baseFrontmatter: UniversalFrontmatter,
    enhancement: any
  ): UniversalFrontmatter {
    const enhanced = { ...baseFrontmatter }

    // Merge description if provided and better than original
    if (enhancement.description && enhancement.description.length > (enhanced.description?.length || 0)) {
      enhanced.description = enhancement.description
    }

    // Merge tags if provided
    if (enhancement.tags && Array.isArray(enhancement.tags)) {
      const newTags = enhancement.tags.filter((tag: string) =>
        tag.startsWith('#') && !enhanced.tags?.includes(tag)
      )
      if (enhanced.tags) {
        enhanced.tags.push(...newTags)
      } else {
        enhanced.tags = [...baseFrontmatter.tags || [], ...newTags]
      }
    }

    // Merge other metadata if safe
    if (enhancement.author && typeof enhancement.author === 'string') {
      enhanced.author = enhancement.author
    }

    return enhanced
  }

  /**
   * Cleans and normalizes document title
   */
  private cleanTitle(title: string): string {
    return title
      .replace(/[^\w\s\-_]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100) // Limit length
  }

  /**
   * Normalizes document type to standard values
   */
  private normalizeDocumentType(type: string): string {
    const typeMap: Record<string, string> = {
      'readme': 'readme',
      'documentation': 'docs',
      'code': 'code',
      'api': 'api',
      'component': 'component',
      'utility': 'util',
      'configuration': 'config',
      'test': 'test',
      'error': 'error'
    }

    return typeMap[type.toLowerCase()] || 'unknown'
  }

  /**
   * Determines document processing status
   */
  private determineDocumentStatus(document: ProcessedDocument): string {
    if (document.errors.length > 0) {
      return 'error'
    }

    if (document.warnings.length > 0) {
      return 'warning'
    }

    if (document.content.length < 100) {
      return 'minimal'
    }

    return 'complete'
  }

  /**
   * Generates basic description from document content
   */
  private generateBasicDescription(document: ProcessedDocument): string {
    // Try to extract first meaningful sentence
    const sentences = document.content
      .replace(/^#+\s*/gm, '') // Remove headers
      .replace(/\*\*/g, '') // Remove bold
      .split(/[.!?]\s+/)
      .filter(s => s.length > 10)

    if (sentences.length > 0) {
      return sentences[0].substring(0, 200) + '.'
    }

    // Fallback to type-based description
    return this.getTypeBasedDescription(document.type)
  }

  /**
   * Gets description based on document type
   */
  private getTypeBasedDescription(type: string): string {
    const descriptions: Record<string, string> = {
      'readme': 'Project documentation and overview.',
      'api': 'API documentation and interface definitions.',
      'component': 'Component documentation and usage guide.',
      'utility': 'Utility functions and helper documentation.',
      'configuration': 'Configuration settings and options.',
      'code': 'Source code documentation and implementation details.',
      'test': 'Test documentation and specifications.',
      'docs': 'General documentation and guides.'
    }

    return descriptions[type] || 'Documentation file.'
  }

  /**
   * Finds related documents based on tags, content, and source files
   */
  private findRelatedDocuments(
    document: ProcessedDocument,
    context: ProcessingContext
  ): string[] {
    const related = new Set<string>()
    const maxRelated = 5

    // Find documents with similar tags
    for (const [docPath, doc] of context.existingDocs) {
      if (doc.filePath === document.filePath) continue

      const commonTags = document.tags.filter(tag => doc.tags.includes(tag))
      if (commonTags.length >= 2) {
        related.add(doc.title)
      }

      if (related.size >= maxRelated) break
    }

    // Find documents from related source files
    const sourceDir = path.dirname(document.sourceFiles[0] || '')
    for (const [docPath, doc] of context.existingDocs) {
      if (doc.filePath === document.filePath) continue

      const docSourceDir = path.dirname(doc.sourceFiles[0] || '')
      if (sourceDir === docSourceDir) {
        related.add(doc.title)
      }

      if (related.size >= maxRelated) break
    }

    return Array.from(related)
  }

  /**
   * Checks if document is code-related
   */
  private isCodeDocument(document: ProcessedDocument): boolean {
    return document.type === 'code' ||
           document.sourceFiles.some(file => /\.(ts|js|py|java|cpp|c|go|rs)$/i.test(file))
  }

  /**
   * Extracts dependencies from code documents
   */
  private extractDependencies(document: ProcessedDocument): string[] {
    const dependencies = new Set<string>()

    // Extract from imports/requires in content
    const importPatterns = [
      /import\s+.*?from\s+['"]([^'"]+)['"]/g,
      /require\(['"]([^'"]+)['"]\)/g,
      /import\s+['"]([^'"]+)['"]/g
    ]

    for (const pattern of importPatterns) {
      let match
      while ((match = pattern.exec(document.content)) !== null) {
        const dep = match[1]
        if (!dep.startsWith('.') && !dep.startsWith('/')) {
          dependencies.add(dep)
        }
        if (dependencies.size >= 10) break // Limit dependencies
      }
    }

    return Array.from(dependencies)
  }

  /**
   * Extracts version information from context
   */
  private extractVersionInfo(
    document: ProcessedDocument,
    context: ProcessingContext
  ): string | undefined {
    // Try to find version from package.json or similar
    for (const sourceFile of document.sourceFiles) {
      if (sourceFile.endsWith('package.json')) {
        // In a real implementation, we'd parse the file
        return '1.0.0' // Placeholder
      }
    }

    return undefined
  }

  /**
   * Enhances description with contextual information
   */
  private enhanceDescription(
    baseDescription: string,
    document: ProcessedDocument,
    context: ProcessingContext
  ): string {
    let enhanced = baseDescription

    // Add context about related documents
    if (document.backlinks.length > 0) {
      enhanced += ` Related to ${document.backlinks.length} other documents.`
    }

    // Add source file context
    if (document.sourceFiles.length > 1) {
      enhanced += ` Generated from ${document.sourceFiles.length} source files.`
    }

    return enhanced
  }

  /**
   * Formats timestamp in local time
   */
  private formatTimestamp(date: Date): string {
    return formatDocumentDate(date)
  }

  /**
   * Parses existing frontmatter from document content
   */
  public parseFrontmatter(content: string): any {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/
    const match = content.match(frontmatterRegex)

    if (!match) {
      return {}
    }

    try {
      // Simple YAML parsing for basic frontmatter
      const yamlContent = match[1]
      const result: any = {}

      const lines = yamlContent.split('\n')
      let currentKey = ''
      let isArray = false

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        if (trimmed.startsWith('-')) {
          // Array item
          if (isArray && currentKey) {
            const value = trimmed.substring(1).trim().replace(/^["']|["']$/g, '')
            result[currentKey] = result[currentKey] || []
            result[currentKey].push(value)
          }
        } else if (trimmed.includes(':')) {
          // Key-value pair
          const [key, ...valueParts] = trimmed.split(':')
          const value = valueParts.join(':').trim()
          currentKey = key.trim()

          if (value === '' || value === '[]') {
            isArray = true
            result[currentKey] = []
          } else {
            isArray = false
            result[currentKey] = value.replace(/^["']|["']$/g, '')
          }
        }
      }

      return result
    } catch (error) {
      console.warn('Error parsing frontmatter:', error)
      return {}
    }
  }

  /**
   * Extracts content without frontmatter
   */
  public extractContent(fullContent: string): { content: string; frontmatter: string } {
    const frontmatterRegex = /^(---\n[\s\S]*?\n---\n)([\s\S]*)$/
    const match = fullContent.match(frontmatterRegex)

    if (match) {
      return {
        frontmatter: match[1],
        content: match[2]
      }
    }

    return {
      frontmatter: '',
      content: fullContent
    }
  }

  /**
   * Generates YAML string from frontmatter object
   */
  public generateYaml(frontmatter: UniversalFrontmatter): string {
    const lines: string[] = []

    // Core fields first
    lines.push(`project: "${frontmatter.project}"`)
    lines.push(`project_tag: "${frontmatter.project_tag}"`)
    lines.push(`title: "${frontmatter.title}"`)
    lines.push(`type: "${frontmatter.type}"`)
    lines.push(`status: "${frontmatter.status}"`)
    lines.push(`created: ${frontmatter.created}`)
    lines.push(`modified: ${frontmatter.modified}`)

    // Source files
    if (frontmatter.source_files.length > 0) {
      lines.push('source_files:')
      frontmatter.source_files.forEach(file => {
        lines.push(`  - "${file}"`)
      })
    } else {
      lines.push('source_files: []')
    }

    // Related documents
    if (frontmatter.related.length > 0) {
      lines.push('related:')
      frontmatter.related.forEach(rel => {
        lines.push(`  - "${rel}"`)
      })
    } else {
      lines.push('related: []')
    }

    // Optional fields
    if (frontmatter.description) {
      lines.push(`description: "${frontmatter.description}"`)
    }

    if (frontmatter.author) {
      lines.push(`author: "${frontmatter.author}"`)
    }

    if (frontmatter.version) {
      lines.push(`version: "${frontmatter.version}"`)
    }

    if (frontmatter.dependencies && frontmatter.dependencies.length > 0) {
      lines.push('dependencies:')
      frontmatter.dependencies.forEach(dep => {
        lines.push(`  - "${dep}"`)
      })
    }

    return lines.join('\n')
  }
}
