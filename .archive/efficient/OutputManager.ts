/**
 * OutputManager - Manages sequential output of processed documents
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { ProcessedDocument } from './DocumentProcessor'
import { DocumentorConfig } from '../../types'
import { Logger } from '../Logger'
import { tuiAdapter } from '../TUIAdapter'

export class OutputManager {
  private writeQueue: ProcessedDocument[] = []
  private writing = false
  private config: DocumentorConfig
  private projectPath: string
  private outputPath: string
  private writtenDocs: ProcessedDocument[] = []
  private completionPromise: Promise<void>
  private completionResolver?: () => void

  constructor(config: DocumentorConfig, projectPath: string) {
    this.config = config
    this.projectPath = projectPath
    
    // Expand output path
    const projectName = path.basename(projectPath)
    this.outputPath = path.join(
      this.expandPath(config.output.path),
      `${projectName}-documentation`
    )
    
    // Create completion promise
    this.completionPromise = new Promise(resolve => {
      this.completionResolver = resolve
    })
  }

  /**
   * Expand tilde in path
   */
  private expandPath(filePath: string): string {
    if (filePath.startsWith('~/')) {
      return path.join(process.env.HOME || '', filePath.slice(2))
    }
    return filePath
  }

  /**
   * Start the output writer
   */
  startWriting(): void {
    this.processQueue()
  }

  /**
   * Queue a document for writing
   */
  queue(doc: ProcessedDocument): void {
    this.writeQueue.push(doc)
    this.processQueue() // Try to write if not busy
  }

  /**
   * Process the write queue
   */
  private async processQueue(): Promise<void> {
    if (this.writing || this.writeQueue.length === 0) return
    
    this.writing = true
    
    while (this.writeQueue.length > 0) {
      const doc = this.writeQueue.shift()!
      
      try {
        // Report what we're saving
        console.log(`💾 Saving: ${doc.title}`)
        if (process.env.DOCUMENTOR_TUI === 'true') {
          tuiAdapter.log('info', `Saving ${doc.title}...`)
        }
        
        // Ensure output directory exists
        await this.ensureDirectory()
        
        // Write to disk
        await this.writeDocument(doc)
        
        // Track written docs
        this.writtenDocs.push(doc)
        
        // Report completion  
        if (process.env.DOCUMENTOR_TUI === 'true') {
          tuiAdapter.log('success', `Saved ${doc.title}`)
        }
        
      } catch (error) {
        console.log(`❌ Failed to save ${doc.title}`)
        Logger.error(`Failed to write ${doc.title}: ${(error as Error).message}`, 'OutputManager')
        if (process.env.DOCUMENTOR_TUI === 'true') {
          tuiAdapter.log('error', `Failed to save ${doc.title}`)
        }
      }
    }
    
    this.writing = false
    
    // Check if we're done
    if (this.writeQueue.length === 0 && this.completionResolver) {
      this.completionResolver()
    }
  }

  /**
   * Ensure output directory exists
   */
  private async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.outputPath, { recursive: true })
    } catch (error) {
      Logger.error(`Failed to create output directory: ${(error as Error).message}`, 'OutputManager')
    }
  }

  /**
   * Write a document to disk
   */
  private async writeDocument(doc: ProcessedDocument): Promise<void> {
    // Generate YAML frontmatter
    const frontmatter = this.generateFrontmatter(doc.frontmatter)
    
    // Combine frontmatter and content
    const fullContent = `---\n${frontmatter}\n---\n\n${doc.content}`
    
    // Generate output path
    const outputFile = path.join(this.outputPath, path.basename(doc.outputPath))
    
    // Write file
    await fs.writeFile(outputFile, fullContent, 'utf-8')
    
    Logger.debug(`Wrote document to ${outputFile}`, 'OutputManager')
  }

  /**
   * Generate YAML frontmatter
   */
  private generateFrontmatter(data: Record<string, any>): string {
    const lines: string[] = []
    
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        lines.push(`${key}:`)
        value.forEach(item => lines.push(`  - ${item}`))
      } else if (typeof value === 'object' && value !== null) {
        lines.push(`${key}: ${JSON.stringify(value)}`)
      } else {
        lines.push(`${key}: ${value}`)
      }
    }
    
    return lines.join('\n')
  }

  /**
   * Wait for all documents to be written
   */
  async waitForCompletion(): Promise<void> {
    await this.completionPromise
  }

  /**
   * Generate index document
   */
  async generateIndex(): Promise<void> {
    const projectName = path.basename(this.projectPath)
    
    let content = `# ${projectName} Documentation\n\n`
    content += `Generated: ${new Date().toISOString()}\n\n`
    content += `## Documents\n\n`
    
    // Group documents by type
    const byType = new Map<string, ProcessedDocument[]>()
    for (const doc of this.writtenDocs) {
      const type = doc.frontmatter.type || 'general'
      if (!byType.has(type)) {
        byType.set(type, [])
      }
      byType.get(type)!.push(doc)
    }
    
    // Write grouped documents
    for (const [type, docs] of byType) {
      content += `### ${type.charAt(0).toUpperCase() + type.slice(1)}\n\n`
      for (const doc of docs) {
        const fileName = path.basename(doc.outputPath, '.md')
        content += `- [[${fileName}]] - ${doc.title}\n`
      }
      content += '\n'
    }
    
    // Write index file
    const indexPath = path.join(this.outputPath, 'INDEX.md')
    await fs.writeFile(indexPath, content, 'utf-8')
    
    console.log(`📄 Generated INDEX.md`)
    if (process.env.DOCUMENTOR_TUI === 'true') {
      tuiAdapter.log('success', 'Generated INDEX.md')
    }
    Logger.info('Generated index document', 'OutputManager')
  }
}