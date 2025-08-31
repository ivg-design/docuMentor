// TemplateLoader - Loads and processes markdown templates with placeholders
import { promises as fs } from 'fs'
import * as path from 'path'
import { formatLocalTimestamp } from '../utils/datetime'

export interface TemplateContext {
  PROJECT_NAME: string
  PROJECT_PATH: string
  DESCRIPTION?: string
  VERSION?: string
  AUTHOR?: string
  STATUS?: string
  TAGS?: string[]
  ALIASES?: string[]
  CREATED_DATE?: string
  MODIFIED_DATE?: string
  GENERATION_DATE?: string
  [key: string]: any
}

export class TemplateLoader {
  private templatesDir: string
  private templateCache: Map<string, string> = new Map()

  constructor(templatesDir?: string) {
    this.templatesDir = templatesDir || path.join(__dirname, '../templates')
  }

  /**
   * Load a template by name and replace placeholders
   */
  async loadTemplate(templateName: string, context: TemplateContext): Promise<string> {
    const templatePath = path.join(this.templatesDir, `${templateName}.template`)
    
    // Load from cache or file
    let template = this.templateCache.get(templatePath)
    if (!template) {
      template = await fs.readFile(templatePath, 'utf-8')
      this.templateCache.set(templatePath, template)
    }

    // Process placeholders
    return this.processTemplate(template, context)
  }

  /**
   * Process template placeholders
   */
  private processTemplate(template: string, context: TemplateContext): string {
    // Add default values
    const fullContext: TemplateContext = {
      ...context,
      CREATED_DATE: context.CREATED_DATE || formatLocalTimestamp(),
      MODIFIED_DATE: context.MODIFIED_DATE || formatLocalTimestamp(),
      GENERATION_DATE: formatLocalTimestamp(),
      VERSION: context.VERSION || '1.0.0',
      AUTHOR: context.AUTHOR || 'DocuMentor',
      STATUS: context.STATUS || 'draft',
      TAGS: context.TAGS || []
    }

    // Replace all placeholders
    let processed = template
    for (const [key, value] of Object.entries(fullContext)) {
      const placeholder = `{{${key}}}`
      let replacement = value

      // Handle arrays
      if (Array.isArray(value)) {
        replacement = value.join(', ')
      } else if (value === undefined || value === null) {
        replacement = ''
      } else {
        replacement = String(value)
      }

      // Replace all occurrences
      processed = processed.replace(new RegExp(placeholder, 'g'), replacement)
    }

    return processed
  }

  /**
   * Get available templates
   */
  async getAvailableTemplates(): Promise<string[]> {
    const files = await fs.readdir(this.templatesDir)
    return files
      .filter(f => f.endsWith('.template'))
      .map(f => f.replace('.template', ''))
  }

  /**
   * Create custom template
   */
  async createTemplate(name: string, content: string): Promise<void> {
    const templatePath = path.join(this.templatesDir, `${name}.template`)
    await fs.writeFile(templatePath, content, 'utf-8')
    // Clear cache
    this.templateCache.delete(templatePath)
  }

  /**
   * Load template for specific document type
   */
  async loadDocumentTemplate(docType: string, context: TemplateContext): Promise<string> {
    const templateMap: { [key: string]: string } = {
      'readme': 'README.md',
      'api': 'API.md',
      'architecture': 'ARCHITECTURE.md',
      'component': 'COMPONENT.md',
      'guide': 'GUIDE.md',
      'changelog': 'CHANGELOG.md'
    }

    const templateName = templateMap[docType.toLowerCase()] || 'README.md'
    return this.loadTemplate(templateName, context)
  }

  /**
   * Generate frontmatter from context
   */
  generateFrontmatter(context: TemplateContext): string {
    const frontmatter: string[] = ['---']
    
    // Core metadata
    if (context.PROJECT_NAME) frontmatter.push(`title: ${context.PROJECT_NAME}`)
    if (context.CREATED_DATE) frontmatter.push(`created: ${context.CREATED_DATE}`)
    if (context.MODIFIED_DATE) frontmatter.push(`modified: ${context.MODIFIED_DATE}`)
    
    // Tags
    if (context.TAGS && context.TAGS.length > 0) {
      frontmatter.push(`tags: [${context.TAGS.join(', ')}]`)
    }
    
    // Additional metadata
    if (context.category) frontmatter.push(`category: ${context.category}`)
    if (context.type) frontmatter.push(`type: ${context.type}`)
    if (context.PROJECT_PATH) frontmatter.push(`project: ${context.PROJECT_PATH}`)
    if (context.VERSION) frontmatter.push(`version: ${context.VERSION}`)
    if (context.AUTHOR) frontmatter.push(`author: ${context.AUTHOR}`)
    if (context.STATUS) frontmatter.push(`status: ${context.STATUS}`)
    
    // Aliases
    if (context.ALIASES && context.ALIASES.length > 0) {
      frontmatter.push(`aliases: [${context.ALIASES.join(', ')}]`)
    }
    
    frontmatter.push('---')
    return frontmatter.join('\n')
  }

  /**
   * Apply template to existing content
   */
  async applyTemplateToContent(
    content: string,
    templateName: string,
    context: TemplateContext
  ): Promise<string> {
    const template = await this.loadTemplate(templateName, context)
    
    // Extract sections from content and merge with template
    // This would be more sophisticated in production
    return template
  }
}

export default TemplateLoader