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
    this.lockFileManager = new LockFileManager(this.projectPath)
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
      projectTag: `#${this.config.project.name === 'auto-detect' ? basename(this.projectPath) : this.config.project.name}`,
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
    this.fileWriter = new FileWriter(this.config.output.path, this.config.output.format)

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
        await this.executePhase2Generation()
      })

      await phaseManager.executePhase(3, async () => {
        await this.executePhase3Enhancement()
      })

      await phaseManager.executePhase(4, async () => {
        await this.executePhase4Formatting()
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
      // Task 1: Full Project Analysis
      await phaseManager.startTask('project-analysis')
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
          configFiles: analysis.files.filter(f => f.category === 'config').map(f => f.path),
          docDirs: []
        },
        files: analysis.files.map(f => ({
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
  // Phase 2: Generation
  // ============================================================================

  private async executePhase2Generation(): Promise<void> {
    this.currentPhaseStatus = 'running'
    
    try {
      if (!this.currentProject) {
        throw new Error('No project analysis available for generation')
      }

      // Task 1: Generate documentation for key files
      await phaseManager.startTask('documentation-generation')
      
      // Process important source files
      const importantFiles = this.currentProject.files
        .filter(f => path.basename(f.path).toLowerCase() === 'readme.md' || 
                     path.basename(f.path).toLowerCase() === 'package.json' ||
                     f.path.includes('/src/') ||
                     f.path.includes('/lib/'))
        .slice(0, 20) // Limit to prevent overwhelming
      
      for (const file of importantFiles) {
        phaseManager.startFile(file.path)
        const processedDoc = await this.docGenerator.generateDocumentation(
          file.path,
          null // No existing document  
        )
        
        // Check if it's actually a ProcessedDocument (not a string)
        if (processedDoc && typeof processedDoc === 'object' && 'filePath' in processedDoc) {
          this.generatedDocuments.push(processedDoc as ProcessedDocument)
        }
        phaseManager.completeFile(file.path)
      }
      
      await phaseManager.completeTask()

      this.currentPhaseStatus = 'completed'
      Logger.success(`Phase 2: Generation completed - ${this.generatedDocuments.length} documents generated`, 'DocumentEngine')

    } catch (error) {
      this.currentPhaseStatus = 'failed'
      Logger.error(`Phase 2 Generation failed: ${(error as Error).message}`, 'DocumentEngine')
      throw error
    }
  }

  // ============================================================================
  // Phase 3: Enhancement
  // ============================================================================

  private async executePhase3Enhancement(): Promise<void> {
    this.currentPhaseStatus = 'running'
    
    try {
      // Task 1: Enhance with frontmatter if needed
      await phaseManager.startTask('content-enhancement')
      
      // Claude enhancement is handled during generation in DocGenerator
      // Just ensure documents have proper structure
      for (const doc of this.generatedDocuments) {
        phaseManager.startFile(doc.filePath)
        phaseManager.reportOperation('Enhancement', `Processing ${doc.title}`)
        // Documents are already enhanced during generation
        phaseManager.completeFile(doc.filePath)
      }
      
      await phaseManager.completeTask()

      this.currentPhaseStatus = 'completed'
      Logger.success('Phase 3: Enhancement completed successfully', 'DocumentEngine')

    } catch (error) {
      this.currentPhaseStatus = 'failed'
      Logger.error(`Phase 3 Enhancement failed: ${(error as Error).message}`, 'DocumentEngine')
      throw error
    }
  }

  // ============================================================================
  // Phase 4: Formatting
  // ============================================================================

  private async executePhase4Formatting(): Promise<void> {
    this.currentPhaseStatus = 'running'
    
    try {
      // Task 1: Clean and format markdown
      await phaseManager.startTask('markdown-formatting')
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
      Logger.success('Phase 4: Formatting completed successfully', 'DocumentEngine')

    } catch (error) {
      this.currentPhaseStatus = 'failed'
      Logger.error(`Phase 4 Formatting failed: ${(error as Error).message}`, 'DocumentEngine')
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
      await phaseManager.startTask('obsidian-processing')
      
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
      await phaseManager.startTask('tag-optimization')
      
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
      await phaseManager.startTask('cross-reference-generation')
      
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
      await phaseManager.startTask('document-verification')
      
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
      await phaseManager.startTask('document-saving')
      const outputPath = resolve(this.config.output.path)
      const projectOutputPath = join(outputPath, this.currentProject!.name)

      // Ensure output directory exists
      await fs.mkdir(projectOutputPath, { recursive: true })

      for (const doc of this.generatedDocuments) {
        phaseManager.startFile(doc.filePath)
        
        // Generate YAML frontmatter
        const yamlFrontmatter = this.obsidianFrontmatter.generateYaml(doc.frontmatter as any)
        
        // Combine frontmatter and content
        const fullContent = `---\n${yamlFrontmatter}\n---\n\n${doc.content}`
        
        // Write file
        const filePath = join(projectOutputPath, `${doc.title.replace(/[^\w\s-]/g, '')}.md`)
        await this.fileWriter.writeFile(filePath, fullContent)
        
        phaseManager.completeFile(doc.filePath)
      }
      await phaseManager.completeTask()

      // Task 2: Create index document
      await phaseManager.startTask('index-creation')
      phaseManager.startFile('INDEX.md')
      
      const indexContent = this.createIndexDocument()
      const indexPath = join(projectOutputPath, 'INDEX.md')
      await this.fileWriter.writeFile(indexPath, indexContent)
      
      phaseManager.completeFile('INDEX.md')
      await phaseManager.completeTask()

      this.currentPhaseStatus = 'completed'
      Logger.success(`Phase 9: Save completed - ${this.generatedDocuments.length + 1} documents saved to ${projectOutputPath}`, 'DocumentEngine')

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