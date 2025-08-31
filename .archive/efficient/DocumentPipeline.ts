/**
 * DocumentPipeline - Processes a single document through all phases
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { SourceFile, ProcessedDocument } from './DocumentProcessor'
import { DocumentorConfig } from '../../types'
import { Logger } from '../Logger'
import { ClaudeClient } from '../ClaudeClient'
import { TemplateLoader } from '../TemplateLoader'
import { formatLocalTimestamp } from '../../utils/datetime'

export class DocumentPipeline {
  private config: DocumentorConfig
  private projectPath: string
  private claudeClient: ClaudeClient
  private templateLoader: TemplateLoader
  private projectName: string

  constructor(config: DocumentorConfig, projectPath: string) {
    this.config = config
    this.projectPath = projectPath
    this.projectName = path.basename(projectPath)
    
    // Initialize Claude client for documentation generation
    this.claudeClient = new ClaudeClient(config.claude)
    this.templateLoader = new TemplateLoader()
  }

  /**
   * Process a single file through all phases
   */
  async process(file: SourceFile): Promise<ProcessedDocument> {
    try {
      // Phase 1: Read & Parse
      Logger.debug(`Phase 1: Reading ${file.name}`, 'Pipeline')
      const content = await this.readFile(file)
      
      // Phase 2: Determine document type
      Logger.debug(`Phase 2: Analyzing ${file.name}`, 'Pipeline')
      const docType = this.determineDocType(file)
      
      // Phase 3: Generate documentation (NO FALLBACK - Claude only)
      Logger.debug(`Phase 3: Generating docs for ${file.name}`, 'Pipeline')
      const documentation = await this.generateDocumentation(file, content, docType)
      
      // Phase 4: Add Obsidian features
      Logger.debug(`Phase 4: Enhancing ${file.name}`, 'Pipeline')
      const enhanced = await this.enhanceWithObsidian(documentation, file, docType)
      
      // Phase 5: Validate
      Logger.debug(`Phase 5: Validating ${file.name}`, 'Pipeline')
      const validated = this.validate(enhanced)
      
      return validated
      
    } catch (error) {
      Logger.error(`Pipeline failed for ${file.name}: ${(error as Error).message}`, 'Pipeline')
      
      // Create an error document that explains the failure
      const errorDoc: ProcessedDocument = {
        filePath: file.path,
        outputPath: '',
        title: file.name,
        content: `# ${file.name}\n\n## Documentation Generation Failed\n\nClaude was unable to generate documentation for this file.\n\nError: ${(error as Error).message}\n\nThis usually means the file is too large or complex for processing.`,
        frontmatter: {
          title: file.name,
          type: 'error',
          error: true,
          message: (error as Error).message
        },
        tags: [`#error`],
        success: false,
        error: (error as Error).message
      }
      
      return errorDoc
    }
  }

  /**
   * Read file content
   */
  private async readFile(file: SourceFile): Promise<string> {
    try {
      return await fs.readFile(file.path, 'utf-8')
    } catch (error) {
      throw new Error(`Failed to read file: ${(error as Error).message}`)
    }
  }

  /**
   * Determine document type based on file
   */
  private determineDocType(file: SourceFile): string {
    const name = file.name.toLowerCase()
    const ext = file.extension.toLowerCase()
    
    if (name === 'readme.md') return 'readme'
    if (name === 'changelog.md') return 'changelog'
    if (name === 'contributing.md') return 'contributing'
    if (name.includes('license')) return 'license'
    if (ext === '.json' && name === 'package.json') return 'config'
    if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) return 'code'
    if (['.md', '.mdx'].includes(ext)) return 'documentation'
    
    return 'general'
  }

  /**
   * Generate documentation with timeout and fallback
   */
  private async generateDocumentation(
    file: SourceFile, 
    content: string, 
    docType: string
  ): Promise<string> {
    // Skip documentation for certain files
    if (this.shouldSkipDocumentation(file)) {
      console.log(`[Pipeline] Skipping ${file.name} (minified/lock/test file)`)
      return `# ${file.name}\n\nThis file type is automatically skipped (minified, lock file, or test file).`
    }
    
    // Wait for Claude - NO FALLBACK, we need real documentation
    console.log(`[Pipeline] Calling Claude for ${file.name}`)
    
    // Start progress indicator
    let progressInterval = setInterval(() => {
      console.log(`[Pipeline] Still processing ${file.name}...`)
    }, 10000) // Log every 10 seconds
    
    try {
      const claudePromise = this.generateWithClaude(file, content, docType)
      
      // Much longer timeout - give Claude time to work
      const timeoutPromise = new Promise<string>((_, reject) => 
        setTimeout(() => {
          console.log(`[Pipeline] Claude timeout after 5 MINUTES for ${file.name} - this file may be too large`)
          reject(new Error('Claude timeout after 5 minutes'))
        }, 300000) // 5 minute timeout
      )
      
      const result = await Promise.race([claudePromise, timeoutPromise])
      clearInterval(progressInterval)
      console.log(`[Pipeline] Claude completed for ${file.name}`)
      return result
      
    } catch (error) {
      clearInterval(progressInterval)
      // NO FALLBACK - throw error to retry or skip this file
      console.log(`[Pipeline] Claude FAILED for ${file.name}: ${(error as Error).message}`)
      console.log(`[Pipeline] This file will be skipped - Claude is required for documentation`)
      throw error
    }
  }

  /**
   * Check if we should skip AI documentation
   */
  private shouldSkipDocumentation(file: SourceFile): boolean {
    const skipPatterns = [
      '.min.js', '.min.css', '.bundle.js',
      'package-lock.json', 'yarn.lock',
      '.map', '.test.', '.spec.'
    ]
    
    return skipPatterns.some(pattern => file.name.includes(pattern))
  }

  /**
   * Generate documentation using Claude
   */
  private async generateWithClaude(
    file: SourceFile, 
    content: string, 
    docType: string
  ): Promise<string> {
    console.log(`[Claude] Starting generation for ${file.name}`)
    
    const request = {
      type: 'documentation' as const,
      sourceContent: content.substring(0, 10000), // Limit content size - FIX: Changed from 'content' to 'sourceContent'
      context: `File: ${file.name}\nProject: ${this.projectName}\nType: ${docType}`,
      instructions: [
        'Generate clear, professional documentation',
        'Focus on what the code/file does',
        'Include usage examples if applicable',
        'Be concise but comprehensive'
      ],
      constraints: [
        'No meta-commentary',
        'No first-person statements',
        'Pure documentation only'
      ],
      strategy: `create_${docType}`
    }
    
    try {
      const result = await this.claudeClient.generateDocumentation(request)
      console.log(`[Claude] Successfully generated docs for ${file.name}`)
      return result
    } catch (error) {
      console.log(`[Claude] Error for ${file.name}: ${(error as Error).message}`)
      throw error
    }
  }

  /**
   * Generate simple documentation without AI
   */
  private generateSimpleDoc(file: SourceFile, content: string, docType: string): string {
    const lines = content.split('\n')
    const preview = lines.slice(0, 50).join('\n')
    
    let doc = `# ${file.name}\n\n`
    doc += `> ⚠️ **Warning**: Documentation generated without Claude AI. This is basic content extraction only.\n`
    doc += `> To enable intelligent documentation, set ANTHROPIC_API_KEY environment variable.\n\n`
    doc += `Type: ${docType}\n`
    doc += `Size: ${file.size} bytes\n`
    doc += `Path: ${file.path}\n\n`
    
    if (docType === 'code') {
      doc += '## Code Preview (First 50 lines)\n\n'
      doc += '```' + file.extension.slice(1) + '\n'
      doc += preview + '\n'
      doc += '```\n\n'
      doc += '## Full Documentation Not Available\n'
      doc += 'Claude AI is required to generate:\n'
      doc += '- Function/method descriptions\n'
      doc += '- Usage examples\n'
      doc += '- API documentation\n'
      doc += '- Dependencies and relationships\n'
    } else {
      doc += '## Content Preview\n\n'
      doc += preview
    }
    
    return doc
  }

  /**
   * Enhance with Obsidian features
   */
  private async enhanceWithObsidian(
    content: string, 
    file: SourceFile, 
    docType: string
  ): Promise<ProcessedDocument> {
    // Generate frontmatter
    const frontmatter = {
      title: this.generateTitle(file),
      type: docType,
      project: this.projectName,
      source: file.path,
      created: formatLocalTimestamp(),
      modified: formatLocalTimestamp(),
      tags: this.generateTags(file, docType)
    }
    
    // Generate output path
    const outputFileName = this.sanitizeFileName(file.name) + '.md'
    const outputPath = path.join(
      this.config.output.path,
      `${this.projectName}-documentation`,
      outputFileName
    )
    
    return {
      filePath: file.path,
      outputPath,
      title: frontmatter.title,
      content,
      frontmatter,
      tags: frontmatter.tags,
      success: true
    }
  }

  /**
   * Generate title from file
   */
  private generateTitle(file: SourceFile): string {
    const name = path.basename(file.name, file.extension)
    return name.charAt(0).toUpperCase() + name.slice(1).replace(/[-_]/g, ' ')
  }

  /**
   * Generate tags for document
   */
  private generateTags(file: SourceFile, docType: string): string[] {
    const tags = [
      `#${this.projectName}`,
      `#type/${docType}`
    ]
    
    // Add language tag
    const langMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript', 
      '.py': 'python',
      '.java': 'java',
      '.go': 'go'
    }
    
    if (langMap[file.extension]) {
      tags.push(`#lang/${langMap[file.extension]}`)
    }
    
    return tags
  }

  /**
   * Sanitize filename for output
   */
  private sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9-_]/g, '_')
  }

  /**
   * Validate document
   */
  private validate(doc: ProcessedDocument): ProcessedDocument {
    // Basic validation
    if (!doc.content || doc.content.length === 0) {
      doc.content = '# Empty Document\n\nNo content was generated for this file.'
      doc.success = false
    }
    
    if (!doc.frontmatter.title) {
      doc.frontmatter.title = 'Untitled'
    }
    
    if (doc.tags.length === 0) {
      doc.tags = [`#${this.projectName}`, '#untagged']
    }
    
    return doc
  }
}