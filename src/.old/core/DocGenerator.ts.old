import { promises as fs, existsSync, statSync } from 'fs'
import * as path from 'path'
import { ClaudeClient } from './ClaudeClient'

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

export interface GenerationContext {
  sourceFile: string;
  existingDocument?: ProcessedDocument;
  projectContext: ProjectContext;
  relatedDocuments: ProcessedDocument[];
  documentType: string;
  contentLength: 'minimal' | 'standard' | 'comprehensive';
}

export interface ProjectContext {
  name: string;
  type: string;
  description?: string;
  technologies: string[];
  structure: FileStructureInfo[];
  conventions: string[];
}

export interface FileStructureInfo {
  path: string;
  type: 'file' | 'directory';
  size?: number;
  extension?: string;
  purpose?: string;
}

export interface GenerationPrompt {
  type: 'analysis' | 'documentation' | 'enhancement' | 'optimization';
  content: string;
  context: string;
  instructions: string[];
  constraints: string[];
}

/**
 * AI-driven documentation generator with complete creative freedom
 * Lets AI decide structure, content, and approach based on source material
 */
export class DocGenerator {
  private config: any
  private claudeClient: ClaudeClient
  private generationCache: Map<string, string> = new Map()

  constructor(config: any, claudeClient: ClaudeClient) {
    this.config = config
    this.claudeClient = claudeClient
  }

  /**
   * Generates documentation for a source file with AI freedom
   */
  public async generateDocumentation(
    sourceFile: string,
    existingDocument?: ProcessedDocument | null
  ): Promise<string> {
    try {
      // Check cache first
      const cacheKey = this.createCacheKey(sourceFile, existingDocument)
      if (this.generationCache.has(cacheKey)) {
        return this.generationCache.get(cacheKey)!
      }

      // Build generation context
      const context = await this.buildGenerationContext(sourceFile, existingDocument)

      // Determine generation strategy
      const strategy = this.determineGenerationStrategy(context)

      // Generate content with AI freedom
      const generatedContent = await this.generateWithAI(context, strategy)

      // Post-process and enhance
      const finalContent = await this.postProcessContent(generatedContent, context)

      // Cache result
      this.generationCache.set(cacheKey, finalContent)

      return finalContent
    } catch (error) {
      console.warn(`AI generation failed for ${sourceFile}, using fallback:`, error)
      return this.generateFallbackContent(sourceFile, existingDocument)
    }
  }

  /**
   * Creates cache key for generated content
   */
  private createCacheKey(sourceFile: string, existingDocument?: ProcessedDocument | null): string {
    const docHash = existingDocument ?
      this.simpleHash(existingDocument.content) : 'new'
    return `${sourceFile}:${docHash}`
  }

  /**
   * Simple hash function for caching
   */
  private simpleHash(content: string): string {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return hash.toString()
  }

  /**
   * Builds comprehensive generation context
   */
  private async buildGenerationContext(
    sourceFile: string,
    existingDocument?: ProcessedDocument | null
  ): Promise<GenerationContext> {
    const projectContext = await this.buildProjectContext(sourceFile)
    const relatedDocuments = await this.findRelatedDocuments(sourceFile, existingDocument)
    const documentType = this.determineDocumentType(sourceFile, existingDocument)
    const contentLength = this.determineContentLength(sourceFile, existingDocument)

    return {
      sourceFile,
      existingDocument: existingDocument || undefined,
      projectContext,
      relatedDocuments,
      documentType,
      contentLength
    }
  }

  /**
   * Builds project context by analyzing project structure
   */
  private async buildProjectContext(sourceFile: string): Promise<ProjectContext> {
    const projectRoot = this.findProjectRoot(sourceFile)

    try {
      // Analyze package.json if available
      const packageInfo = await this.analyzePackageJson(projectRoot)

      // Analyze project structure
      const structure = await this.analyzeProjectStructure(projectRoot)

      // Detect technologies
      const technologies = this.detectTechnologies(structure, packageInfo)

      // Identify conventions
      const conventions = this.identifyConventions(structure)

      return {
        name: packageInfo?.name || path.basename(projectRoot),
        type: packageInfo?.type || this.inferProjectType(structure),
        description: packageInfo?.description,
        technologies,
        structure: structure.slice(0, 50), // Limit for context
        conventions
      }
    } catch (error) {
      console.warn('Error building project context:', error)
      return this.createBasicProjectContext(sourceFile)
    }
  }

  /**
   * Finds project root directory
   */
  private findProjectRoot(sourceFile: string): string {
    let current = path.dirname(sourceFile)

    while (current !== path.dirname(current)) {
      const packageJsonPath = path.join(current, 'package.json')
      const gitPath = path.join(current, '.git')

      try {
        if (existsSync(packageJsonPath) || existsSync(gitPath)) {
          return current
        }
      } catch (error) {
        // Continue searching
      }

      current = path.dirname(current)
    }

    return path.dirname(sourceFile) // Fallback
  }

  /**
   * Analyzes package.json for project information
   */
  private async analyzePackageJson(projectRoot: string): Promise<any> {
    const packagePath = path.join(projectRoot, 'package.json')

    try {
      const content = await fs.readFile(packagePath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      return null
    }
  }

  /**
   * Analyzes project structure
   */
  private async analyzeProjectStructure(projectRoot: string): Promise<FileStructureInfo[]> {
    const structure: FileStructureInfo[] = []

    try {
      await this.walkDirectory(projectRoot, structure, 0, 3) // Max depth 3
    } catch (error) {
      console.warn('Error analyzing project structure:', error)
    }

    return structure
  }

  /**
   * Recursively walks directory structure
   */
  private async walkDirectory(
    dirPath: string,
    structure: FileStructureInfo[],
    depth: number,
    maxDepth: number
  ): Promise<void> {
    if (depth > maxDepth) return

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        // Skip hidden files and common ignore patterns
        if (entry.name.startsWith('.') ||
            entry.name === 'node_modules' ||
            entry.name === 'dist' ||
            entry.name === 'build') {
          continue
        }

        const fullPath = path.join(dirPath, entry.name)
        const relativePath = path.relative(dirPath, fullPath)

        if (entry.isDirectory()) {
          structure.push({
            path: relativePath,
            type: 'directory',
            purpose: this.inferDirectoryPurpose(entry.name)
          })

          if (depth < maxDepth) {
            await this.walkDirectory(fullPath, structure, depth + 1, maxDepth)
          }
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath)
          structure.push({
            path: relativePath,
            type: 'file',
            size: stats.size,
            extension: path.extname(entry.name),
            purpose: this.inferFilePurpose(entry.name, path.extname(entry.name))
          })
        }
      }
    } catch (error) {
      console.warn(`Error walking directory ${dirPath}:`, error)
    }
  }

  /**
   * Infers directory purpose from name
   */
  private inferDirectoryPurpose(dirName: string): string {
    const purposes: Record<string, string> = {
      'src': 'source code',
      'lib': 'library code',
      'test': 'test files',
      'tests': 'test files',
      'spec': 'specification files',
      'docs': 'documentation',
      'examples': 'example code',
      'scripts': 'utility scripts',
      'config': 'configuration files',
      'assets': 'static assets',
      'public': 'public files',
      'components': 'React components',
      'pages': 'page components',
      'utils': 'utility functions',
      'helpers': 'helper functions',
      'services': 'service layer',
      'api': 'API definitions',
      'types': 'type definitions'
    }

    return purposes[dirName.toLowerCase()] || 'general purpose'
  }

  /**
   * Infers file purpose from name and extension
   */
  private inferFilePurpose(fileName: string, extension: string): string {
    const baseName = path.basename(fileName, extension).toLowerCase()

    // Special file names
    const specialFiles: Record<string, string> = {
      'readme': 'project documentation',
      'index': 'entry point',
      'config': 'configuration',
      'app': 'main application',
      'main': 'main entry point',
      'server': 'server implementation',
      'client': 'client implementation'
    }

    if (specialFiles[baseName]) {
      return specialFiles[baseName]
    }

    // Extension-based purposes
    const extensionPurposes: Record<string, string> = {
      '.ts': 'TypeScript source',
      '.js': 'JavaScript source',
      '.py': 'Python source',
      '.java': 'Java source',
      '.cpp': 'C++ source',
      '.go': 'Go source',
      '.rs': 'Rust source',
      '.md': 'markdown documentation',
      '.json': 'JSON data/config',
      '.yaml': 'YAML configuration',
      '.yml': 'YAML configuration',
      '.toml': 'TOML configuration',
      '.test.ts': 'TypeScript test',
      '.spec.ts': 'TypeScript spec',
      '.d.ts': 'TypeScript definitions'
    }

    return extensionPurposes[extension] || 'general file'
  }

  /**
   * Detects technologies used in the project
   */
  private detectTechnologies(structure: FileStructureInfo[], packageInfo: any): string[] {
    const technologies = new Set<string>()

    // From package.json dependencies
    if (packageInfo?.dependencies) {
      const deps = Object.keys(packageInfo.dependencies)
      if (deps.includes('react')) technologies.add('React')
      if (deps.includes('vue')) technologies.add('Vue')
      if (deps.includes('angular')) technologies.add('Angular')
      if (deps.includes('express')) technologies.add('Express')
      if (deps.includes('fastify')) technologies.add('Fastify')
      if (deps.includes('next')) technologies.add('Next.js')
      if (deps.includes('nuxt')) technologies.add('Nuxt.js')
      if (deps.includes('typescript')) technologies.add('TypeScript')
    }

    // From file extensions
    const extensions = structure
      .filter(item => item.type === 'file')
      .map(item => item.extension)
      .filter(ext => ext)

    if (extensions.includes('.ts')) technologies.add('TypeScript')
    if (extensions.includes('.js')) technologies.add('JavaScript')
    if (extensions.includes('.py')) technologies.add('Python')
    if (extensions.includes('.java')) technologies.add('Java')
    if (extensions.includes('.go')) technologies.add('Go')
    if (extensions.includes('.rs')) technologies.add('Rust')
    if (extensions.includes('.cpp')) technologies.add('C++')

    return Array.from(technologies)
  }

  /**
   * Identifies project conventions
   */
  private identifyConventions(structure: FileStructureInfo[]): string[] {
    const conventions: string[] = []

    // Naming conventions
    const fileNames = structure
      .filter(item => item.type === 'file')
      .map(item => path.basename(item.path))

    const hasKebabCase = fileNames.some(name => name.includes('-'))
    const hasCamelCase = fileNames.some(name => /[a-z][A-Z]/.test(name))
    const hasSnakeCase = fileNames.some(name => name.includes('_'))

    if (hasKebabCase) conventions.push('kebab-case file naming')
    if (hasCamelCase) conventions.push('camelCase file naming')
    if (hasSnakeCase) conventions.push('snake_case file naming')

    // Directory structure conventions
    const directories = structure
      .filter(item => item.type === 'directory')
      .map(item => item.path)

    if (directories.includes('src')) conventions.push('src/ for source code')
    if (directories.includes('lib')) conventions.push('lib/ for library code')
    if (directories.includes('test') || directories.includes('tests')) {
      conventions.push('dedicated test directory')
    }

    return conventions
  }

  /**
   * Infers project type from structure
   */
  private inferProjectType(structure: FileStructureInfo[]): string {
    const files = structure.filter(item => item.type === 'file')
    const directories = structure.filter(item => item.type === 'directory')

    // Web app indicators
    if (directories.some(d => d.path === 'public') ||
        files.some(f => f.path.includes('index.html'))) {
      return 'web application'
    }

    // Library indicators
    if (files.some(f => f.path === 'index.ts' || f.path === 'index.js')) {
      return 'library'
    }

    // CLI tool indicators
    if (files.some(f => f.path.includes('cli') || f.path.includes('bin'))) {
      return 'CLI tool'
    }

    // API indicators
    if (directories.some(d => d.path.includes('api') || d.path.includes('routes'))) {
      return 'API/service'
    }

    return 'application'
  }

  /**
   * Creates basic project context when analysis fails
   */
  private createBasicProjectContext(sourceFile: string): ProjectContext {
    return {
      name: this.config.projectName || 'Project',
      type: 'application',
      technologies: [this.inferTechnologyFromFile(sourceFile)],
      structure: [],
      conventions: []
    }
  }

  /**
   * Infers technology from source file extension
   */
  private inferTechnologyFromFile(sourceFile: string): string {
    const ext = path.extname(sourceFile).toLowerCase()
    const techMap: Record<string, string> = {
      '.ts': 'TypeScript',
      '.js': 'JavaScript',
      '.py': 'Python',
      '.java': 'Java',
      '.go': 'Go',
      '.rs': 'Rust',
      '.cpp': 'C++',
      '.c': 'C'
    }

    return techMap[ext] || 'Unknown'
  }

  /**
   * Finds related documents for context
   */
  private async findRelatedDocuments(
    sourceFile: string,
    existingDocument?: ProcessedDocument | null
  ): Promise<ProcessedDocument[]> {
    // This would typically search through existing documentation
    // For now, return empty array as we don't have access to all documents here
    return []
  }

  /**
   * Determines document type from source file
   */
  private determineDocumentType(
    sourceFile: string,
    existingDocument?: ProcessedDocument | null
  ): string {
    if (existingDocument) {
      return existingDocument.type
    }

    const fileName = path.basename(sourceFile).toLowerCase()
    const extension = path.extname(sourceFile).toLowerCase()

    if (fileName.includes('readme')) return 'readme'
    if (fileName.includes('api')) return 'api'
    if (fileName.includes('component')) return 'component'
    if (fileName.includes('util') || fileName.includes('helper')) return 'utility'
    if (fileName.includes('config')) return 'configuration'
    if (fileName.includes('test') || fileName.includes('spec')) return 'test'

    // By extension
    if (['.ts', '.js', '.py', '.java', '.go', '.rs', '.cpp'].includes(extension)) {
      return 'code'
    }

    if (extension === '.md') return 'documentation'
    if (['.json', '.yaml', '.yml', '.toml'].includes(extension)) return 'configuration'

    return 'file'
  }

  /**
   * Determines appropriate content length
   */
  private determineContentLength(
    sourceFile: string,
    existingDocument?: ProcessedDocument | null
  ): 'minimal' | 'standard' | 'comprehensive' {
    try {
      const stats = statSync(sourceFile)
      const fileSize = stats.size

      if (fileSize < 1000) return 'minimal'
      if (fileSize < 5000) return 'standard'
      return 'comprehensive'
    } catch (error) {
      return 'standard'
    }
  }

  /**
   * Determines generation strategy
   */
  private determineGenerationStrategy(context: GenerationContext): string {
    if (context.existingDocument) {
      if (context.existingDocument.content.length < 200) {
        return 'enhance_minimal'
      } else if (context.existingDocument.errors.length > 0) {
        return 'fix_and_enhance'
      } else {
        return 'update_and_improve'
      }
    }

    switch (context.documentType) {
    case 'readme':
      return 'create_readme'
    case 'api':
      return 'create_api_docs'
    case 'component':
      return 'create_component_docs'
    case 'utility':
      return 'create_utility_docs'
    case 'code':
      return 'create_code_docs'
    default:
      return 'create_general_docs'
    }
  }

  /**
   * Generates content with AI using the determined strategy
   */
  private async generateWithAI(context: GenerationContext, strategy: string): Promise<string> {
    const prompt = this.createGenerationPrompt(context, strategy)

    try {
      const sourceContent = await this.readSourceFile(context.sourceFile)
      const response = await this.claudeClient.generateDocumentation({
        ...prompt,
        sourceContent,
        strategy
      })

      return response || this.generateFallbackContent(context.sourceFile, context.existingDocument)
    } catch (error) {
      console.warn('AI generation failed:', error)
      return this.generateFallbackContent(context.sourceFile, context.existingDocument)
    }
  }

  /**
   * Reads source file content
   */
  private async readSourceFile(sourceFile: string): Promise<string> {
    try {
      return await fs.readFile(sourceFile, 'utf-8')
    } catch (error) {
      console.warn(`Could not read source file ${sourceFile}:`, error)
      return ''
    }
  }

  /**
   * Creates generation prompt for AI
   */
  private createGenerationPrompt(context: GenerationContext, strategy: string): GenerationPrompt {
    const baseInstructions = [
      'Create natural, readable documentation',
      'Use appropriate technical depth for the audience',
      'Include practical examples when helpful',
      'Structure content logically and clearly',
      'Focus on what matters most to users/developers'
    ]

    const constraints = [
      'Do not use rigid templates or forced sections',
      'Let the content dictate the structure',
      'Be concise but comprehensive',
      'Use clear, professional language',
      'Include only relevant information'
    ]

    let promptContent = ''
    let specificInstructions: string[] = []

    switch (strategy) {
    case 'create_readme':
      promptContent = 'Create a comprehensive README that helps users understand and use this project.'
      specificInstructions = [
        'Start with a clear project description',
        'Include installation/setup instructions if applicable',
        'Show key usage examples',
        'Mention important features or capabilities',
        'Add any necessary technical details'
      ]
      break

    case 'create_api_docs':
      promptContent = 'Document this API/interface with clear usage information.'
      specificInstructions = [
        'Explain the API\'s purpose and scope',
        'Document key methods/endpoints with parameters',
        'Provide usage examples',
        'Include response formats where relevant',
        'Note any important limitations or requirements'
      ]
      break

    case 'create_component_docs':
      promptContent = 'Document this component for developers who will use or maintain it.'
      specificInstructions = [
        'Explain the component\'s purpose and behavior',
        'Document props/parameters and their types',
        'Show usage examples',
        'Explain any important implementation details',
        'Note dependencies or requirements'
      ]
      break

    case 'create_code_docs':
      promptContent = 'Create developer documentation for this code file.'
      specificInstructions = [
        'Explain the file\'s purpose and role',
        'Document key functions/classes',
        'Explain important algorithms or logic',
        'Show usage examples where helpful',
        'Note any dependencies or integration points'
      ]
      break

    default:
      promptContent = 'Create appropriate documentation for this file based on its content and purpose.'
      specificInstructions = [
        'Analyze the content to determine the best documentation approach',
        'Structure information in a logical, helpful way',
        'Include relevant details without overwhelming the reader',
        'Focus on practical information that users need'
      ]
    }

    return {
      type: 'documentation',
      content: promptContent,
      context: this.buildContextString(context),
      instructions: [...baseInstructions, ...specificInstructions],
      constraints
    }
  }

  /**
   * Builds context string for AI prompt
   */
  private buildContextString(context: GenerationContext): string {
    const parts = [
      `Project: ${context.projectContext.name} (${context.projectContext.type})`,
      `Technologies: ${context.projectContext.technologies.join(', ')}`,
      `Document type: ${context.documentType}`,
      `Content length: ${context.contentLength}`,
      `Source file: ${path.basename(context.sourceFile)}`
    ]

    if (context.existingDocument) {
      parts.push(`Existing content length: ${context.existingDocument.content.length} chars`)
    }

    if (context.projectContext.description) {
      parts.push(`Project description: ${context.projectContext.description}`)
    }

    return parts.join('\n')
  }

  /**
   * Post-processes generated content
   */
  private async postProcessContent(content: string, context: GenerationContext): Promise<string> {
    let processed = content

    // Ensure content starts with a header if it's substantial
    if (processed.length > 200 && !processed.match(/^#+\s/)) {
      const title = this.generateTitle(context)
      processed = `# ${title}\n\n${processed}`
    }

    // Clean up excessive whitespace
    processed = processed.replace(/\n{3,}/g, '\n\n')

    // Ensure proper ending
    processed = processed.trim()

    return processed
  }

  /**
   * Generates appropriate title for the document
   */
  private generateTitle(context: GenerationContext): string {
    if (context.existingDocument?.title) {
      return context.existingDocument.title
    }

    const baseName = path.basename(context.sourceFile, path.extname(context.sourceFile))

    // Convert various naming conventions to title case
    return baseName
      .replace(/[-_]/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^\w/, c => c.toUpperCase())
      .trim()
  }

  /**
   * Generates fallback content when AI is unavailable
   */
  private generateFallbackContent(
    sourceFile: string,
    existingDocument?: ProcessedDocument | null
  ): string {
    const fileName = path.basename(sourceFile)
    const title = this.generateTitle({ sourceFile } as GenerationContext)

    const sections = [
      `# ${title}`,
      '',
      `This document provides information about \`${fileName}\`.`,
      ''
    ]

    // Add basic file information
    try {
      const stats = statSync(sourceFile)
      const ext = path.extname(sourceFile)
      sections.push(
        '## File Information',
        '',
        `- **File**: \`${fileName}\``,
        `- **Type**: ${this.getFileTypeDescription(ext)}`,
        `- **Size**: ${stats.size} bytes`,
        ''
      )
    } catch (error) {
      // Ignore file stat errors
    }

    if (existingDocument) {
      sections.push(
        '## Notes',
        '',
        'This document was automatically generated. AI enhancement was not available.',
        ''
      )
    }

    sections.push(
      '## Development',
      '',
      'This file is part of the project\'s source code. Refer to the main project documentation for more context.',
      ''
    )

    return sections.join('\n')
  }

  /**
   * Gets human-readable description for file type
   */
  private getFileTypeDescription(extension: string): string {
    const descriptions: Record<string, string> = {
      '.ts': 'TypeScript source file',
      '.js': 'JavaScript source file',
      '.py': 'Python source file',
      '.java': 'Java source file',
      '.go': 'Go source file',
      '.rs': 'Rust source file',
      '.cpp': 'C++ source file',
      '.c': 'C source file',
      '.md': 'Markdown documentation',
      '.json': 'JSON data file',
      '.yaml': 'YAML configuration file',
      '.yml': 'YAML configuration file',
      '.toml': 'TOML configuration file'
    }

    return descriptions[extension.toLowerCase()] || 'Source file'
  }

  /**
   * Clears the generation cache
   */
  public clearCache(): void {
    this.generationCache.clear()
  }

  /**
   * Gets cache statistics
   */
  public getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.generationCache.size,
      keys: Array.from(this.generationCache.keys())
    }
  }
}
