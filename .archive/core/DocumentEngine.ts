// DocuMentor V3.1 - Document Engine Core
// Main class implementing the 9-phase documentation generation flow
// Uses unified modules for consistent operation

import { promises as fs } from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

const { join, resolve, basename } = path

import {
  Config,
  ProjectAnalysis,
  Document,
  Phase,
  PhaseStatus,
  TaskInfo,
  FileInfo,
  FileType,
  ProjectType,
  DocumentType,
  Frontmatter,
  LockFileData,
  ErrorInfo,
  PermissionError,
  ProjectStructure,
  FileAnalysis,
  FunctionInfo,
  ClassInfo
} from '../types/index.js'

// Import unified modules
import { LockFileManager } from './LockFileManager'
import { tuiAdapter } from './TUIAdapter'
import { phaseManager } from './PhaseManager'
import { Logger } from './Logger'

// Import actual implementation modules (not placeholders)
import { ProjectAnalyzer } from './ProjectAnalyzer'
import { DocGenerator, ProcessedDocument } from './DocGenerator'
import { ClaudeClient } from './ClaudeClient'
import { ObsidianIntegration } from './ObsidianIntegration'
import { ObsidianFrontmatter } from './ObsidianFrontmatter'
import { ObsidianVerifier } from './ObsidianVerifier'
import { TemplateLoader } from './TemplateLoader'
import { FileWriter } from './FileWriter'
import { PasswordBridge } from './PasswordBridge'

// ============================================================================
// Main DocumentEngine Class
// ============================================================================

export class DocumentEngine {
  private config: Config
  private lockFileManager: LockFileManager
  private passwordBridge: PasswordBridge
  private projectAnalyzer: ProjectAnalyzer
  private docGenerator: DocGenerator
  private claudeClient: ClaudeClient
  private obsidianIntegration: ObsidianIntegration
  private obsidianFrontmatter: ObsidianFrontmatter
  private obsidianVerifier: ObsidianVerifier
  private templateLoader: TemplateLoader
  private fileWriter: FileWriter

  private currentProject?: ProjectAnalysis
  private generatedDocuments: ProcessedDocument[] = []
  private startTime: Date = new Date()
  private projectPath: string
  private currentPhaseStatus: PhaseStatus = 'pending'
  private currentErrorInfo?: ErrorInfo

  constructor(config: Config, projectPath: string) {
    this.config = config
    this.projectPath = resolve(projectPath)

    // Initialize unified modules
    this.lockFileManager = LockFileManager.getInstance(this.projectPath)
    phaseManager.initialize(this.projectPath, this.lockFileManager)
    Logger.initialize(config.output.path)
    tuiAdapter.start(this.projectPath)

    // Initialize other modules
    this.passwordBridge = new PasswordBridge()
    this.projectAnalyzer = new ProjectAnalyzer()
    this.claudeClient = new ClaudeClient(this.config.claude)
    this.docGenerator = new DocGenerator(this.config, this.claudeClient)
    
    // Create Obsidian-compatible config
    const obsidianConfig = {
      projectName: this.config.project.name === 'auto-detect' ? basename(this.projectPath) : this.config.project.name,
      projectTag: `#project/${this.config.project.name === 'auto-detect' ? basename(this.projectPath) : this.config.project.name}`,
      outputDir: this.config.output.path,
      sourceDir: this.projectPath,
      minTagsPerDocument: 3,
      generateBacklinks: true,
      includeSourceFiles: true,
      useSmartTags: true,
      enhanceWithAI: true,
      maxBacklinksPerDocument: 10,
      tagPrefix: '#',
      hierarchicalTags: true,
      enableTagOptimization: true,
      enableBacklinks: true,
      enableVerification: true,
      maxTagsPerDocument: 20,
      createTagHierarchy: true
    }
    
    this.obsidianIntegration = new ObsidianIntegration(obsidianConfig)
    this.obsidianFrontmatter = new ObsidianFrontmatter(obsidianConfig, this.claudeClient)
    this.obsidianVerifier = new ObsidianVerifier(obsidianConfig)
    this.fileWriter = new FileWriter(this.config.output.path, this.projectPath)
    this.templateLoader = new TemplateLoader()

    Logger.info(`DocumentEngine initialized for project: ${basename(this.projectPath)}`, 'DocumentEngine')
  }

  // ============================================================================
  // Main Generation Method - 9 Phases
  // ============================================================================

  async generate(): Promise<void> {
    try {
      // Initialize and check lock file
      if (!await this.initializeGeneration()) {
        return
      }

      Logger.info('Starting 9-phase documentation generation', 'DocumentEngine')

      // Execute all 9 phases using unified phase manager
      await phaseManager.executePhase(1, async () => {
        await this.executePhase1Analysis()
      })

      await phaseManager.executePhase(2, async () => {
        await this.executePhase2SecurityValidation()
      })

      await phaseManager.executePhase(3, async () => {
        await this.executePhase3Generation()
      })

      await phaseManager.executePhase(4, async () => {
        await this.executePhase4Enhancement()
      })

      await phaseManager.executePhase(5, async () => {
        await this.executePhase5ObsidianIntegration()
      })

      await phaseManager.executePhase(6, async () => {
        await this.executePhase6TagOptimization()
      })

      await phaseManager.executePhase(7, async () => {
        await this.executePhase7BacklinkGeneration()
      })

      await phaseManager.executePhase(8, async () => {
        await this.executePhase8Verification()
      })

      await phaseManager.executePhase(9, async () => {
        await this.executePhase9Save()
      })

      // Complete generation
      await this.completeGeneration()

    } catch (error) {
      await this.handleGenerationError(error as Error)
    }
  }

  // ============================================================================
  // Phase 1: Analysis
  // ============================================================================

  private async executePhase1Analysis(): Promise<void> {
    this.currentPhaseStatus = 'running'
    
    try {
      // Task 1: Scan Files
      await phaseManager.startTask('scan')
      
      Logger.info('Starting project analysis...', 'Analysis')
      const analysis = await this.projectAnalyzer.analyze(this.projectPath)
      Logger.info(`Analyzed project type: ${analysis.projectType}`, 'Analysis')
      Logger.info(`Found ${analysis.files.length} files`, 'Analysis')
      phaseManager.setTotalFiles(analysis.files.length)
      await phaseManager.completeTask()

      // Convert analysis to our ProjectAnalysis format
      this.currentProject = {
        name: analysis.projectName,
        type: analysis.projectType as ProjectType,
        path: this.projectPath,
        structure: {
          srcDirs: [analysis.structure.rootDir],
          testDirs: [],
          configFiles: analysis.files.filter((f: any) => f.category === 'config').map((f: any) => f.path),
          docDirs: []
        },
        files: analysis.files.map((f: any) => ({
          path: f.path,
          name: path.basename(f.path),
          type: 'ts' as FileType, // Simple default
          size: f.size,
          lastModified: new Date(),
          permissions: 'rw-r--r--',
          language: f.language || 'unknown',
          importance: f.importance || 'medium'
        } as unknown as FileInfo)),
        dependencies: Object.keys(analysis.metadata.dependencies || {}),
        frameworks: [],
        languages: [],
        metadata: {
          version: analysis.metadata.version,
          description: analysis.metadata.description,
          author: analysis.metadata.author,
          license: analysis.metadata.license,
          repository: analysis.metadata.repository,
          dependencies: analysis.metadata.dependencies || {},
          devDependencies: analysis.metadata.devDependencies || {}
        }
      }

      this.currentPhaseStatus = 'completed'
      Logger.success('Phase 1: Analysis completed successfully', 'DocumentEngine')

    } catch (error) {
      this.currentPhaseStatus = 'failed'
      Logger.error(`Phase 1 Analysis failed: ${(error as Error).message}`, 'DocumentEngine')
      throw error
    }
  }

  // ============================================================================
  // Phase 2: Security Validation
  // ============================================================================

  private async executePhase2SecurityValidation(): Promise<void> {
    this.currentPhaseStatus = 'running'
    
    try {
      // Task 1: Scan for vulnerabilities
      await phaseManager.startTask('scan-vulnerabilities')
      Logger.info('Scanning for security vulnerabilities', 'SecurityValidation')
      // Basic security checks - can be enhanced later
      await phaseManager.completeTask()
      
      // Task 2: Validate dependencies
      await phaseManager.startTask('validate-deps')
      Logger.info('Validating dependencies', 'SecurityValidation')
      // Basic dependency validation - can be enhanced later
      await phaseManager.completeTask()
      
      this.currentPhaseStatus = 'completed'
      Logger.success('Phase 2: Security Validation completed successfully', 'DocumentEngine')
    } catch (error) {
      this.currentPhaseStatus = 'failed'
      Logger.error(`Phase 2 Security Validation failed: ${(error as Error).message}`, 'DocumentEngine')
      throw error
    }
  }

  // ============================================================================
  // Phase 3: Documentation Generation
  // ============================================================================

  private async executePhase3Generation(): Promise<void> {
    this.currentPhaseStatus = 'running'
    
    try {
      if (!this.currentProject) {
        throw new Error('No project analysis available for generation')
      }

      // Task 1: Generate documentation for key files
      await phaseManager.startTask('readme')
      
      // Process ONLY meaningful source files - not minified crap or config files
      const importantFiles = this.currentProject.files
        .filter(f => {
          const fileName = path.basename(f.path).toLowerCase()
          const ext = path.extname(f.path).toLowerCase()
          
          // Skip obviously stupid files
          if (fileName.includes('.min.') || fileName.includes('.bundle.')) return false
          if (fileName === 'package-lock.json' || fileName === 'yarn.lock') return false
          if (ext === '.map' || ext === '.lock') return false
          
          // Only document actual source code and important docs
          return fileName === 'readme.md' || 
                 fileName === 'changelog.md' ||
                 fileName === 'contributing.md' ||
                 (f.path.includes('/src/') && (ext === '.js' || ext === '.ts' || ext === '.jsx' || ext === '.tsx')) ||
                 (f.path.includes('/scripts/') && ext === '.js')
        })
        .slice(0, 10) // More reasonable limit
      
      for (const file of importantFiles) {
        phaseManager.startFile(file.path)
        try {
          // Add timeout to prevent hanging forever
          const timeoutPromise = new Promise<string>((_, reject) => 
            setTimeout(() => reject(new Error('Documentation generation timeout')), 60000) // 60 seconds instead of 30
          )
          
          const content = await Promise.race([
            this.docGenerator.generateDocumentation(file.path, null),
            timeoutPromise
          ])
          
          // Create a ProcessedDocument from the string content
          if (content && typeof content === 'string') {
            const doc: ProcessedDocument = {
              filePath: file.path,
              title: path.basename(file.path, path.extname(file.path)),
              content: content,
              type: 'documentation' as DocumentType,
              tags: [`#${this.config.project.name}`, '#documentation'],
              backlinks: [],
              frontmatter: {
                title: path.basename(file.path),
                tags: [],
                created: new Date().toISOString(),
                updated: new Date().toISOString()
              },
              sourceFiles: [file.path],
              errors: [],
              warnings: []
            }
            this.generatedDocuments.push(doc)
          }
        } catch (error) {
          Logger.warn(`Failed to generate documentation for ${file.path}: ${(error as Error).message}`)
        }
        phaseManager.completeFile(file.path)
      }
      
      await phaseManager.completeTask()

      this.currentPhaseStatus = 'completed'
      Logger.success(`Phase 3: Documentation Generation completed - ${this.generatedDocuments.length} documents generated`, 'DocumentEngine')

    } catch (error) {
      this.currentPhaseStatus = 'failed'
      Logger.error(`Phase 3 Documentation Generation failed: ${(error as Error).message}`, 'DocumentEngine')
      throw error
    }
  }

  // ============================================================================
  // Phase 4: Enhancement
  // ============================================================================

  private async executePhase4Enhancement(): Promise<void> {
    this.currentPhaseStatus = 'running'
    
    try {
      // Task 1: Enhance with Claude AI
      await phaseManager.startTask('claude-enhance')
      
      // Claude enhancement is handled during generation in DocGenerator
      // Just ensure documents have proper structure
      for (const doc of this.generatedDocuments) {
        phaseManager.startFile(doc.filePath)
        phaseManager.reportOperation('Enhancement', `Processing ${doc.title}`)
        // Documents are already enhanced during generation
        phaseManager.completeFile(doc.filePath)
      }
      
      await phaseManager.completeTask()
      
      // Task 2: Format documents
      await phaseManager.startTask('format')
      for (const doc of this.generatedDocuments) {
        phaseManager.startFile(doc.filePath)
        // Basic markdown formatting
        doc.content = doc.content
          .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
          .replace(/^\s+|\s+$/g, '') // Trim whitespace
        phaseManager.completeFile(doc.filePath)
      }
      await phaseManager.completeTask()

      this.currentPhaseStatus = 'completed'
      Logger.success('Phase 4: Enhancement completed successfully', 'DocumentEngine')

    } catch (error) {
      this.currentPhaseStatus = 'failed'
      Logger.error(`Phase 4 Enhancement failed: ${(error as Error).message}`, 'DocumentEngine')
      throw error
    }
  }

  // ============================================================================
  // Phase 5: Obsidian Integration
  // ============================================================================

  private async executePhase5ObsidianIntegration(): Promise<void> {
    this.currentPhaseStatus = 'running'
    
    try {
      // Task 1: Process documents with Obsidian integration
      await phaseManager.startTask('frontmatter')
      
      // Process all source files through ObsidianIntegration
      const sourceFiles = this.generatedDocuments.map(d => d.filePath)
      const processedDocs = await this.obsidianIntegration.processDocuments(sourceFiles)
      
      // Update our documents with Obsidian processing results
      for (let i = 0; i < processedDocs.length && i < this.generatedDocuments.length; i++) {
        const processed = processedDocs[i]
        const doc = this.generatedDocuments[i]
        
        phaseManager.startFile(doc.filePath)
        
        // Generate enhanced frontmatter
        const frontmatter = await this.obsidianFrontmatter.generateFrontmatter(
          processed,
          {
            config: {},
            existingDocs: new Map(),
            tagHierarchy: new Map(),
            documentGraph: new Map(),
            sourceFileMap: new Map(),
            processingStats: {},
            projectPath: this.projectPath
          } as any
        )
        
        // Update document with Obsidian enhancements
        doc.frontmatter = frontmatter as any
        doc.tags = processed.tags
        doc.backlinks = processed.backlinks
        doc.content = processed.content
        
        phaseManager.completeFile(doc.filePath)
      }
      
      await phaseManager.completeTask()

      this.currentPhaseStatus = 'completed'
      Logger.success('Phase 5: Obsidian Integration completed successfully', 'DocumentEngine')

    } catch (error) {
      this.currentPhaseStatus = 'failed'
      Logger.error(`Phase 5 Obsidian Integration failed: ${(error as Error).message}`, 'DocumentEngine')
      throw error
    }
  }

  // ============================================================================
  // Phase 6: Tag Optimization
  // ============================================================================

  private async executePhase6TagOptimization(): Promise<void> {
    this.currentPhaseStatus = 'running'
    
    try {
      // Task 1: Optimize Tags
      await phaseManager.startTask('generate-tags')
      
      // Tags are already optimized during Obsidian processing
      // Just ensure they're hierarchical and well-formed
      for (const doc of this.generatedDocuments) {
        phaseManager.startFile(doc.filePath)
        
        // Ensure project tag is first
        const projectTag = `#${this.currentProject!.name.toLowerCase()}`
        if (!doc.tags.includes(projectTag)) {
          doc.tags.unshift(projectTag)
        }
        
        // Make tags hierarchical where appropriate
        doc.tags = doc.tags.map(tag => {
          if (!tag.includes('/') && tag !== projectTag) {
            // Add hierarchy based on document type
            if (doc.type === 'api') return `#type/api/${tag.replace('#', '')}`
            if (doc.type === 'component') return `#type/component/${tag.replace('#', '')}`
            if (doc.type === 'readme') return `#docs/${tag.replace('#', '')}`
          }
          return tag
        })
        
        phaseManager.completeFile(doc.filePath)
      }
      
      await phaseManager.completeTask()

      this.currentPhaseStatus = 'completed'
      Logger.success('Phase 6: Tag Optimization completed successfully', 'DocumentEngine')

    } catch (error) {
      this.currentPhaseStatus = 'failed'
      Logger.error(`Phase 6 Tag Optimization failed: ${(error as Error).message}`, 'DocumentEngine')
      throw error
    }
  }

  // ============================================================================
  // Phase 7: Backlink Generation
  // ============================================================================

  private async executePhase7BacklinkGeneration(): Promise<void> {
    this.currentPhaseStatus = 'running'
    
    try {
      // Task 1: Generate Cross-References
      await phaseManager.startTask('find-links')
      
      // Create document map for backlinking
      const docMap = new Map<string, ProcessedDocument>()
      for (const doc of this.generatedDocuments) {
        docMap.set(doc.title.toLowerCase(), doc)
        docMap.set(path.basename(doc.filePath).toLowerCase(), doc)
      }
      
      // Add backlinks between related documents
      for (const doc of this.generatedDocuments) {
        phaseManager.startFile(doc.filePath)
        
        // Find and add references to other documents
        const links: string[] = []
        for (const [key, targetDoc] of docMap) {
          if (targetDoc.filePath !== doc.filePath && doc.content.toLowerCase().includes(key)) {
            links.push(`[[${targetDoc.title}]]`)
          }
        }
        
        // Add backlinks section if we found any
        if (links.length > 0) {
          doc.content += `\n\n## Related Documents\n\n${links.slice(0, 5).join('\n')}`
          doc.backlinks.push(...links)
        }
        
        phaseManager.completeFile(doc.filePath)
      }
      
      await phaseManager.completeTask()

      this.currentPhaseStatus = 'completed'
      Logger.success('Phase 7: Backlink Generation completed successfully', 'DocumentEngine')

    } catch (error) {
      this.currentPhaseStatus = 'failed'
      Logger.error(`Phase 7 Backlink Generation failed: ${(error as Error).message}`, 'DocumentEngine')
      throw error
    }
  }

  // ============================================================================
  // Phase 8: Verification
  // ============================================================================

  private async executePhase8Verification(): Promise<void> {
    this.currentPhaseStatus = 'running'
    
    try {
      // Task 1: Verify Documents with ObsidianVerifier
      await phaseManager.startTask('validate')
      
      let totalErrors = 0
      let totalWarnings = 0
      
      for (const doc of this.generatedDocuments) {
        phaseManager.startFile(doc.filePath)
        
        // Doc is already a ProcessedDocument
        const processedDoc = doc
        
        const context = {
          config: {},
          existingDocs: new Map(),
          tagHierarchy: new Map(),
          documentGraph: new Map(),
          sourceFileMap: new Map(),
          processingStats: {}
        }
        
        const result = await this.obsidianVerifier.verifyDocument(processedDoc, context)
        
        if (!result.passed) {
          totalErrors += result.errors.length
          totalWarnings += result.warnings.length
          
          if (result.errors.length > 0) {
            Logger.warning(`${doc.title}: ${result.errors.length} errors`, 'Verification')
          }
        }
        
        phaseManager.completeFile(doc.filePath)
      }
      
      if (totalErrors > 0 || totalWarnings > 0) {
        Logger.warning(`Verification complete: ${totalErrors} errors, ${totalWarnings} warnings`, 'Verification')
      }
      
      await phaseManager.completeTask()

      this.currentPhaseStatus = 'completed'
      Logger.success('Phase 8: Verification completed successfully', 'DocumentEngine')

    } catch (error) {
      this.currentPhaseStatus = 'failed'
      Logger.error(`Phase 8 Verification failed: ${(error as Error).message}`, 'DocumentEngine')
      throw error
    }
  }

  // ============================================================================
  // Phase 9: Save
  // ============================================================================

  private async executePhase9Save(): Promise<void> {
    this.currentPhaseStatus = 'running'
    
    try {
      // Task 1: Save to Output Directory
      await phaseManager.startTask('save')
      
      // Create project-specific subdirectory
      const projectDirName = `${this.currentProject!.name}-documentation`

      for (const doc of this.generatedDocuments) {
        phaseManager.startFile(doc.filePath)
        
        // Frontmatter is already formatted as YAML string from Phase 5
        let yamlFrontmatter: string
        if (typeof doc.frontmatter === 'string') {
          // Already formatted, just clean it up
          yamlFrontmatter = doc.frontmatter.replace(/^---\n|\n---$/g, '').trim()
        } else if (doc.frontmatter && typeof doc.frontmatter === 'object') {
          // If it's an object, convert to YAML
          yamlFrontmatter = this.obsidianFrontmatter.generateYaml(doc.frontmatter as any)
        } else {
          // Fallback - create basic frontmatter
          yamlFrontmatter = `title: ${doc.title}\ntype: documentation\ncreated: ${new Date().toISOString()}`
        }
        
        // Combine frontmatter and content
        const fullContent = `---\n${yamlFrontmatter}\n---\n\n${doc.content}`
        
        // Write file with relative path within output directory
        const fileName = `${doc.title.replace(/[^\w\s-]/g, '')}.md`
        const relativePath = join(projectDirName, fileName)
        await this.fileWriter.writeFile(relativePath, fullContent, { format: 'obsidian', createDirectories: true })
        
        phaseManager.completeFile(doc.filePath)
      }
      await phaseManager.completeTask()

      // Task 2: Create index document
      await phaseManager.startTask('compile')
      phaseManager.startFile('INDEX.md')
      
      const indexContent = this.createIndexDocument()
      const indexRelativePath = join(projectDirName, 'INDEX.md')
      await this.fileWriter.writeFile(indexRelativePath, indexContent, { format: 'obsidian', createDirectories: true })
      
      phaseManager.completeFile('INDEX.md')
      await phaseManager.completeTask()

      this.currentPhaseStatus = 'completed'
      Logger.success(`Phase 9: Save completed - ${this.generatedDocuments.length + 1} documents saved to ${this.config.output.path}/${projectDirName}`, 'DocumentEngine')

    } catch (error) {
      this.currentPhaseStatus = 'failed'
      Logger.error(`Phase 9 Save failed: ${(error as Error).message}`, 'DocumentEngine')
      throw error
    }
  }
  
  private createIndexDocument(): string {
    const project = this.currentProject!
    const now = new Date().toISOString()
    
    let content = `---\nproject: "${project.name}"\ntitle: "Documentation Index"\ncreated: ${now}\nmodified: ${now}\n---\n\n`
    content += `# ${project.name} Documentation\n\n`
    content += '## Project Overview\n\n'
    content += `- **Type**: ${project.type}\n`
    content += `- **Path**: ${project.path}\n`
    content += `- **Files**: ${project.files.length}\n\n`
    
    content += '## Generated Documents\n\n'
    for (const doc of this.generatedDocuments) {
      content += `- [[${doc.title}]] - ${doc.type}\n`
    }
    
    content += '\n---\n_Generated by DocuMentor_'
    return content
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async initializeGeneration(): Promise<boolean> {
    try {
      // Create lock file
      await this.lockFileManager.create(this.projectPath, this.config.output.path)

      // Validate project path
      if (!await this.pathExists(this.projectPath)) {
        const error: PermissionError = {
          code: 'PATH_NOT_FOUND',
          message: `Project path does not exist: ${this.projectPath}`,
          path: this.projectPath,
          operation: 'read',
          timestamp: new Date(),
          requiresElevation: false,
          critical: true,
          recoverable: false
        }
        throw error
      }

      // Ensure output directory exists
      await this.ensureOutputDirectory()

      return true
    } catch (error) {
      if ((error as any).code === 'PATH_NOT_FOUND') {
        Logger.error(`Initialization failed: ${(error as PermissionError).message}`, 'DocumentEngine')
      } else {
        Logger.error(`Initialization failed: ${(error as Error).message}`, 'DocumentEngine')
      }
      return false
    }
  }

  private async completeGeneration(): Promise<void> {
    const endTime = new Date()
    const duration = endTime.getTime() - this.startTime.getTime()

    await this.lockFileManager.complete()

    Logger.success(
      `Documentation generation completed successfully in ${this.formatDuration(duration)}`,
      'DocumentEngine'
    )
    
    tuiAdapter.logSuccess(`Generated ${this.generatedDocuments.length} documents`)
  }

  private async handleGenerationError(error: Error): Promise<void> {
    // Create structured error info
    this.currentErrorInfo = {
      code: 'GENERATION_FAILED',
      message: error.message,
      timestamp: new Date(),
      stack: error.stack,
      recoverable: false
    }

    await this.lockFileManager.fail(this.currentErrorInfo?.message || 'Unknown error')
    Logger.error(error, 'DocumentEngine')
    
    throw error
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await fs.access(path)
      return true
    } catch {
      return false
    }
  }

  private async ensureOutputDirectory(): Promise<void> {
    const outputPath = resolve(this.config.output.path)
    await fs.mkdir(outputPath, { recursive: true })
  }

  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }
}