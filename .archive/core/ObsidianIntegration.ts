import { promises as fs } from 'fs'
import * as path from 'path'
import { ObsidianFrontmatter } from './ObsidianFrontmatter'
import { ObsidianTagOptimizer } from './ObsidianTagOptimizer'
import { ObsidianBacklinks } from './ObsidianBacklinks'
import { Logger } from './Logger'
import { ObsidianVerifier } from './ObsidianVerifier'
import { DocGenerator } from './DocGenerator'
import { ClaudeClient } from './ClaudeClient'

export interface ObsidianConfig {
  projectName: string;
  projectTag: string;
  outputDir: string;
  vaultPath?: string;
  sourceDir: string;
  enableTagOptimization: boolean;
  enableBacklinks: boolean;
  enableVerification: boolean;
  minTagsPerDocument: number;
  maxTagsPerDocument: number;
  createTagHierarchy: boolean;
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
  config: ObsidianConfig;
  existingDocs: Map<string, ProcessedDocument>;
  tagHierarchy: Map<string, string[]>;
  documentGraph: Map<string, string[]>;
  sourceFileMap: Map<string, string[]>;
  processingStats: ProcessingStats;
}

export interface ProcessingStats {
  totalDocuments: number;
  processedDocuments: number;
  documentsWithErrors: number;
  documentsWithWarnings: number;
  tagsOptimized: number;
  backlinksCreated: number;
  verificationsPassed: number;
  processingTimeMs: number;
}

/**
 * Main orchestrator for Obsidian integration
 * Coordinates all Obsidian features and processes documents through the pipeline
 */
export class ObsidianIntegration {
  private config: ObsidianConfig
  private frontmatterGenerator!: ObsidianFrontmatter
  private tagOptimizer!: ObsidianTagOptimizer
  private backlinkGenerator!: ObsidianBacklinks
  private verifier!: ObsidianVerifier
  private docGenerator!: DocGenerator
  private claudeClient!: ClaudeClient
  private context!: ProcessingContext

  constructor(config: ObsidianConfig) {
    this.config = config
    this.validateConfig()
    this.initializeComponents()
    this.initializeContext()
  }

  /**
   * Validates the provided configuration
   */
  private validateConfig(): void {
    if (!this.config.projectName || this.config.projectName.trim().length === 0) {
      throw new Error('Project name is required')
    }

    if (!this.config.projectTag || !this.config.projectTag.startsWith('#project/')) {
      throw new Error('Project tag must start with #project/')
    }

    if (!this.config.outputDir || this.config.outputDir.trim().length === 0) {
      throw new Error('Output directory is required')
    }

    if (!this.config.sourceDir || this.config.sourceDir.trim().length === 0) {
      throw new Error('Source directory is required')
    }

    if (this.config.minTagsPerDocument < 1) {
      this.config.minTagsPerDocument = 3 // Default from specification
    }

    if (this.config.maxTagsPerDocument < this.config.minTagsPerDocument) {
      this.config.maxTagsPerDocument = this.config.minTagsPerDocument + 7
    }
  }

  /**
   * Initializes all component classes
   */
  private initializeComponents(): void {
    this.claudeClient = new ClaudeClient()
    this.frontmatterGenerator = new ObsidianFrontmatter(this.config, this.claudeClient)
    this.tagOptimizer = new ObsidianTagOptimizer(this.config, this.claudeClient)
    this.backlinkGenerator = new ObsidianBacklinks(this.config)
    this.verifier = new ObsidianVerifier(this.config)
    this.docGenerator = new DocGenerator(this.config, this.claudeClient)
  }

  /**
   * Initializes processing context
   */
  private initializeContext(): void {
    this.context = {
      config: this.config,
      existingDocs: new Map(),
      tagHierarchy: new Map(),
      documentGraph: new Map(),
      sourceFileMap: new Map(),
      processingStats: {
        totalDocuments: 0,
        processedDocuments: 0,
        documentsWithErrors: 0,
        documentsWithWarnings: 0,
        tagsOptimized: 0,
        backlinksCreated: 0,
        verificationsPassed: 0,
        processingTimeMs: 0
      }
    }
  }

  /**
   * Main processing method - processes documents through the Obsidian pipeline
   */
  public async processDocuments(sourceFiles: string[]): Promise<ProcessedDocument[]> {
    const startTime = Date.now()
    Logger.info(`Starting Obsidian integration for ${sourceFiles.length} files...`)

    try {
      // Phase 1: Initialize and scan existing documents
      await this.initializeProcessing(sourceFiles)

      // Phase 2: Generate base documentation
      const baseDocuments = await this.generateBaseDocuments(sourceFiles)

      // Phase 3: Process through Obsidian pipeline
      const processedDocuments = await this.processObsidianPipeline(baseDocuments)

      // Phase 4: Optimize and finalize
      const finalDocuments = await this.optimizeAndFinalize(processedDocuments)

      // Phase 5: Write documents and generate summaries
      await this.writeDocumentsAndSummaries(finalDocuments)

      this.context.processingStats.processingTimeMs = Date.now() - startTime
      Logger.info(`Obsidian integration completed in ${this.context.processingStats.processingTimeMs}ms`)

      return finalDocuments
    } catch (error) {
      Logger.error(`Error during Obsidian integration: ${(error as Error).message}`)
      throw error
    }
  }

  /**
   * Phase 1: Initialize processing and scan existing documents
   */
  private async initializeProcessing(sourceFiles: string[]): Promise<void> {
    Logger.info('Initializing Obsidian processing...')

    // Ensure output directory exists
    await fs.mkdir(this.config.outputDir, { recursive: true })

    // Scan existing documents if output directory has content
    await this.scanExistingDocuments()

    // Build source file mapping
    await this.buildSourceFileMapping(sourceFiles)

    // Initialize tag hierarchy from existing documents
    await this.initializeTagHierarchy()

    this.context.processingStats.totalDocuments = sourceFiles.length
  }

  /**
   * Scans existing documents in the output directory
   */
  private async scanExistingDocuments(): Promise<void> {
    try {
      const files = await this.getMarkdownFiles(this.config.outputDir)

      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf-8')
          const doc = await this.parseExistingDocument(file, content)
          if (doc) {
            this.context.existingDocs.set(path.relative(this.config.outputDir, file), doc)
          }
        } catch (error) {
          Logger.warning(`Warning: Could not parse existing document ${file}: ${(error as Error).message}`)
        }
      }

      Logger.info(`Scanned ${this.context.existingDocs.size} existing documents`)
    } catch (error) {
      Logger.info('No existing documents found or error scanning')
    }
  }

  /**
   * Gets all markdown files recursively from a directory
   */
  private async getMarkdownFiles(dir: string): Promise<string[]> {
    const files: string[] = []

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          const subFiles = await this.getMarkdownFiles(fullPath)
          files.push(...subFiles)
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
          files.push(fullPath)
        }
      }
    } catch (error) {
      Logger.warning(`Warning: Could not read directory ${dir}: ${(error as Error).message}`)
    }

    return files
  }

  /**
   * Parses an existing document and extracts metadata
   */
  private async parseExistingDocument(filePath: string, content: string): Promise<ProcessedDocument | null> {
    try {
      const frontmatter = this.frontmatterGenerator.parseFrontmatter(content)
      const { content: bodyContent } = this.frontmatterGenerator.extractContent(content)

      // Extract tags from content
      const tags = this.extractTagsFromContent(content)

      // Extract backlinks from content
      const backlinks = this.extractBacklinksFromContent(content)

      // Extract source files from frontmatter or content
      const sourceFiles = frontmatter?.source_files || []

      return {
        filePath,
        title: frontmatter?.title || path.basename(filePath, '.md'),
        type: frontmatter?.type || 'unknown',
        content: bodyContent,
        frontmatter,
        tags,
        backlinks,
        sourceFiles,
        errors: [],
        warnings: []
      }
    } catch (error) {
      Logger.warning(`Could not parse document ${filePath}: ${(error as Error).message}`)
      return null
    }
  }

  /**
   * Extracts tags from document content
   */
  private extractTagsFromContent(content: string): string[] {
    const tagRegex = /#[\w/\-_]+/g
    const matches = content.match(tagRegex) || []
    return [...new Set(matches)]
  }

  /**
   * Extracts backlinks from document content
   */
  private extractBacklinksFromContent(content: string): string[] {
    const backlinkRegex = /\[\[([^\]]+)\]\]/g
    const matches = []
    let match

    while ((match = backlinkRegex.exec(content)) !== null) {
      matches.push(match[1])
    }

    return [...new Set(matches)]
  }

  /**
   * Builds mapping between source files and their related documents
   */
  private async buildSourceFileMapping(sourceFiles: string[]): Promise<void> {
    for (const sourceFile of sourceFiles) {
      const relatedDocs = this.findRelatedDocuments(sourceFile)
      this.context.sourceFileMap.set(sourceFile, relatedDocs)
    }
  }

  /**
   * Finds documents related to a source file
   */
  private findRelatedDocuments(sourceFile: string): string[] {
    const related: string[] = []
    const basename = path.basename(sourceFile, path.extname(sourceFile))

    // Look for exact matches or similar names
    for (const [docPath, doc] of this.context.existingDocs) {
      if (doc.sourceFiles.includes(sourceFile) ||
          doc.title.toLowerCase().includes(basename.toLowerCase()) ||
          docPath.toLowerCase().includes(basename.toLowerCase())) {
        related.push(docPath)
      }
    }

    return related
  }

  /**
   * Initializes tag hierarchy from existing documents
   */
  private async initializeTagHierarchy(): Promise<void> {
    const allTags = new Set<string>()

    // Collect all tags from existing documents
    for (const doc of this.context.existingDocs.values()) {
      doc.tags.forEach(tag => allTags.add(tag))
    }

    // Build initial hierarchy structure
    const hierarchy = new Map<string, string[]>()

    for (const tag of allTags) {
      const parts = tag.split('/')
      if (parts.length > 1) {
        const parent = parts.slice(0, -1).join('/')
        if (!hierarchy.has(parent)) {
          hierarchy.set(parent, [])
        }
        hierarchy.get(parent)!.push(tag)
      }
    }

    this.context.tagHierarchy = hierarchy
    Logger.info(`Initialized tag hierarchy with ${hierarchy.size} parent categories`)
  }

  /**
   * Phase 2: Generate base documentation
   */
  private async generateBaseDocuments(sourceFiles: string[]): Promise<ProcessedDocument[]> {
    Logger.info('Generating base documentation...')
    const documents: ProcessedDocument[] = []

    for (let i = 0; i < sourceFiles.length; i++) {
      const sourceFile = sourceFiles[i]
      Logger.info(`Generating documentation for ${path.basename(sourceFile)} (${i + 1}/${sourceFiles.length})...`)

      try {
        const doc = await this.generateSingleDocument(sourceFile)
        documents.push(doc)
        this.context.processingStats.processedDocuments++
      } catch (error) {
        Logger.error(`Error generating documentation for ${sourceFile}: ${(error as Error).message}`)
        // Create error document
        const errorDoc: ProcessedDocument = {
          filePath: sourceFile,
          title: path.basename(sourceFile),
          type: 'error',
          content: `Error generating documentation: ${error}`,
          frontmatter: {},
          tags: [this.config.projectTag],
          backlinks: [],
          sourceFiles: [sourceFile],
          errors: [error instanceof Error ? error.message : String(error)],
          warnings: []
        }
        documents.push(errorDoc)
        this.context.processingStats.documentsWithErrors++
      }
    }

    return documents
  }

  /**
   * Generates documentation for a single source file
   */
  private async generateSingleDocument(sourceFile: string): Promise<ProcessedDocument> {
    // Check if we have an existing document for this source file
    const existingDocPath = this.context.sourceFileMap.get(sourceFile)?.[0]
    let baseDoc: ProcessedDocument | null = null

    if (existingDocPath) {
      baseDoc = this.context.existingDocs.get(existingDocPath) || null
    }

    // Generate new content using DocGenerator
    const generatedContent = await this.docGenerator.generateDocumentation(sourceFile, baseDoc)

    // Create document structure
    const doc: ProcessedDocument = {
      filePath: this.generateOutputPath(sourceFile),
      title: this.generateDocumentTitle(sourceFile),
      type: await this.determineDocumentType(sourceFile),
      content: generatedContent,
      frontmatter: {},
      tags: [this.config.projectTag], // Always start with project tag
      backlinks: [],
      sourceFiles: [sourceFile],
      errors: [],
      warnings: []
    }

    return doc
  }

  /**
   * Generates output path for a source file
   */
  private generateOutputPath(sourceFile: string): string {
    const relativePath = path.relative(this.config.sourceDir, sourceFile)
    const parsedPath = path.parse(relativePath)
    const outputFileName = `${parsedPath.name}.md`
    return path.join(this.config.outputDir, parsedPath.dir, outputFileName)
  }

  /**
   * Generates a document title from source file
   */
  private generateDocumentTitle(sourceFile: string): string {
    const basename = path.basename(sourceFile, path.extname(sourceFile))

    // Convert camelCase and PascalCase to Title Case
    const titleCase = basename
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim()

    return titleCase || basename
  }

  /**
   * Determines document type based on source file
   */
  private async determineDocumentType(sourceFile: string): Promise<string> {
    const ext = path.extname(sourceFile).toLowerCase()
    const basename = path.basename(sourceFile).toLowerCase()

    // Determine type based on file patterns
    if (basename === 'readme.md' || basename.includes('readme')) {
      return 'readme'
    }

    if (basename.includes('api') || basename.includes('interface')) {
      return 'api'
    }

    if (basename.includes('component')) {
      return 'component'
    }

    if (basename.includes('util') || basename.includes('helper')) {
      return 'utility'
    }

    if (basename.includes('config') || basename.includes('setting')) {
      return 'configuration'
    }

    // Type by extension
    switch (ext) {
    case '.ts':
    case '.js':
      return 'code'
    case '.md':
      return 'documentation'
    case '.json':
      return 'configuration'
    default:
      return 'file'
    }
  }

  /**
   * Phase 3: Process through Obsidian pipeline
   */
  private async processObsidianPipeline(documents: ProcessedDocument[]): Promise<ProcessedDocument[]> {
    Logger.info('Processing through Obsidian pipeline...')

    const processedDocs = [...documents]

    // Step 1: Generate frontmatter for all documents
    for (const doc of processedDocs) {
      doc.frontmatter = await this.frontmatterGenerator.generateFrontmatter(doc, this.context)
    }

    // Step 2: Generate and optimize tags
    if (this.config.enableTagOptimization) {
      await this.processTagOptimization(processedDocs)
    }

    // Step 3: Generate backlinks
    if (this.config.enableBacklinks) {
      await this.processBacklinks(processedDocs)
    }

    // Step 4: Verify documents
    if (this.config.enableVerification) {
      await this.processVerification(processedDocs)
    }

    return processedDocs
  }

  /**
   * Processes tag optimization for all documents
   */
  private async processTagOptimization(documents: ProcessedDocument[]): Promise<void> {
    Logger.info('Optimizing tags...')

    const optimizedTags = await this.tagOptimizer.optimizeTags(documents, this.context)

    // Apply optimized tags to documents
    for (let i = 0; i < documents.length; i++) {
      documents[i].tags = optimizedTags[i] || documents[i].tags
      this.context.processingStats.tagsOptimized++
    }
  }

  /**
   * Processes backlink generation for all documents
   */
  private async processBacklinks(documents: ProcessedDocument[]): Promise<void> {
    Logger.info('Generating backlinks...')

    for (const doc of documents) {
      const backlinks = await this.backlinkGenerator.generateBacklinks(doc, documents, this.context)
      doc.backlinks = backlinks
      doc.content = await this.backlinkGenerator.insertBacklinks(doc.content, backlinks)
      this.context.processingStats.backlinksCreated += backlinks.length
    }
  }

  /**
   * Processes verification for all documents
   */
  private async processVerification(documents: ProcessedDocument[]): Promise<void> {
    Logger.info('Verifying documents...')

    for (const doc of documents) {
      const verification = await this.verifier.verifyDocument(doc, this.context)

      if (verification.errors.length > 0) {
        doc.errors.push(...verification.errors)
        this.context.processingStats.documentsWithErrors++
      }

      if (verification.warnings.length > 0) {
        doc.warnings.push(...verification.warnings)
        this.context.processingStats.documentsWithWarnings++
      }

      if (verification.passed) {
        this.context.processingStats.verificationsPassed++
      }
    }
  }

  /**
   * Phase 4: Optimize and finalize documents
   */
  private async optimizeAndFinalize(documents: ProcessedDocument[]): Promise<ProcessedDocument[]> {
    Logger.info('Finalizing documents...')

    // Final optimization pass
    await this.performFinalOptimization(documents)

    // Generate final content with all components
    for (const doc of documents) {
      doc.content = await this.generateFinalContent(doc)
    }

    return documents
  }

  /**
   * Performs final optimization pass
   */
  private async performFinalOptimization(documents: ProcessedDocument[]): Promise<void> {
    // Update document graph
    this.updateDocumentGraph(documents)

    // Final tag cleanup
    if (this.config.enableTagOptimization) {
      await this.performFinalTagCleanup(documents)
    }
  }

  /**
   * Updates the document relationship graph
   */
  private updateDocumentGraph(documents: ProcessedDocument[]): void {
    for (const doc of documents) {
      const connections = new Set<string>()

      // Add backlink connections
      doc.backlinks.forEach(link => connections.add(link))

      // Add tag-based connections (documents with similar tags)
      for (const otherDoc of documents) {
        if (otherDoc !== doc) {
          const commonTags = doc.tags.filter(tag => otherDoc.tags.includes(tag))
          if (commonTags.length >= 2) {
            connections.add(otherDoc.title)
          }
        }
      }

      this.context.documentGraph.set(doc.filePath, Array.from(connections))
    }
  }

  /**
   * Performs final tag cleanup
   */
  private async performFinalTagCleanup(documents: ProcessedDocument[]): Promise<void> {
    // Ensure project tag is always first
    for (const doc of documents) {
      const projectTagIndex = doc.tags.indexOf(this.config.projectTag)
      if (projectTagIndex > 0) {
        doc.tags.splice(projectTagIndex, 1)
        doc.tags.unshift(this.config.projectTag)
      } else if (projectTagIndex === -1) {
        doc.tags.unshift(this.config.projectTag)
      }
    }
  }

  /**
   * Generates final content for a document
   */
  private async generateFinalContent(doc: ProcessedDocument): Promise<string> {
    // DON'T add frontmatter here - DocumentEngine will do it!
    // Just return the content with tags and footer
    const parts = []

    // Add main content
    parts.push(doc.content)

    // Add tags section
    if (doc.tags.length > 0) {
      parts.push('', '---', '## Tags')
      doc.tags.forEach(tag => parts.push(tag))
    }

    // Add footer
    const footer = this.generateFooter(doc)
    parts.push('', '---', footer)

    return parts.join('\n')
  }

  /**
   * Generates document footer
   */
  private generateFooter(doc: ProcessedDocument): string {
    const lines = []

    if (doc.sourceFiles.length > 0) {
      const sourceRefs = doc.sourceFiles.map(file => `\`${file}\``).join(', ')
      lines.push(`Source: ${sourceRefs}`)
    }

    const timestamp = new Date().toISOString().split('T')[0]
    lines.push(`Generated: ${timestamp} by DocuMentor v3.1`)

    return lines.join('\n')
  }

  /**
   * Phase 5: Write documents and generate summaries
   */
  private async writeDocumentsAndSummaries(documents: ProcessedDocument[]): Promise<void> {
    Logger.info('Writing documents...')

    // Write individual documents
    for (const doc of documents) {
      await this.writeDocument(doc)
    }

    // Generate and write tag hierarchy document
    if (this.config.createTagHierarchy) {
      await this.writeTagHierarchyDocument(documents)
    }

    // Generate processing summary
    await this.writeProcessingSummary()
  }

  /**
   * Writes a single document to filesystem
   */
  private async writeDocument(doc: ProcessedDocument): Promise<void> {
    try {
      const outputDir = path.dirname(doc.filePath)
      await fs.mkdir(outputDir, { recursive: true })
      await fs.writeFile(doc.filePath, doc.content, 'utf-8')
    } catch (error) {
      Logger.error(`Error writing document ${doc.filePath}: ${(error as Error).message}`)
      doc.errors.push(`Write error: ${error}`)
    }
  }

  /**
   * Writes tag hierarchy document
   */
  private async writeTagHierarchyDocument(documents: ProcessedDocument[]): Promise<void> {
    const content = await this.tagOptimizer.generateTagHierarchyDocument(documents, this.context)
    const filePath = path.join(this.config.outputDir, 'TAG_HIERARCHY.md')

    try {
      await fs.writeFile(filePath, content, 'utf-8')
      Logger.info('Generated TAG_HIERARCHY.md')
    } catch (error) {
      Logger.error(`Error writing TAG_HIERARCHY.md: ${(error as Error).message}`)
    }
  }

  /**
   * Writes processing summary
   */
  private async writeProcessingSummary(): Promise<void> {
    const stats = this.context.processingStats
    const summary = [
      '# Documentation Processing Summary',
      '',
      '## Statistics',
      `- Total Documents: ${stats.totalDocuments}`,
      `- Successfully Processed: ${stats.processedDocuments}`,
      `- Documents with Errors: ${stats.documentsWithErrors}`,
      `- Documents with Warnings: ${stats.documentsWithWarnings}`,
      `- Tags Optimized: ${stats.tagsOptimized}`,
      `- Backlinks Created: ${stats.backlinksCreated}`,
      `- Verifications Passed: ${stats.verificationsPassed}`,
      `- Processing Time: ${stats.processingTimeMs}ms`,
      '',
      '## Project Configuration',
      `- Project: ${this.config.projectName}`,
      `- Project Tag: ${this.config.projectTag}`,
      `- Output Directory: ${this.config.outputDir}`,
      `- Source Directory: ${this.config.sourceDir}`,
      '',
      `Generated: ${new Date().toISOString()} by DocuMentor v3.1`
    ].join('\n')

    const filePath = path.join(this.config.outputDir, 'PROCESSING_SUMMARY.md')

    try {
      await fs.writeFile(filePath, summary, 'utf-8')
      Logger.info('Generated PROCESSING_SUMMARY.md')
    } catch (error) {
      Logger.error(`Error writing PROCESSING_SUMMARY.md: ${(error as Error).message}`)
    }
  }

  /**
   * Gets processing statistics
   */
  public getProcessingStats(): ProcessingStats {
    return { ...this.context.processingStats }
  }

  /**
   * Gets processing context (read-only)
   */
  public getProcessingContext(): Readonly<ProcessingContext> {
    return this.context
  }
}
