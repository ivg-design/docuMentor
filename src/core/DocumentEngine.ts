// DocuMentor V3.1 - Document Engine Core
// Main class implementing the 9-phase documentation generation flow
// NO dependency injection, NO event buses, direct function calls only

import { promises as fs } from 'fs'
import { join, resolve, basename } from 'path'
import { spawn } from 'child_process'
import * as crypto from 'crypto'

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

// ============================================================================
// Main DocumentEngine Class
// ============================================================================

export class DocumentEngine {
  private config: Config
  private progressTracker: ProgressTracker
  private tuiBridge: TUIBridge
  private lockFileManager: LockFileManager
  private passwordBridge: PasswordBridge
  private projectAnalyzer: ProjectAnalyzer
  private docGenerator: DocGenerator
  private claudeClient: ClaudeClient
  private obsidianIntegration: ObsidianIntegration
  private fileWriter: FileWriter

  private currentProject?: ProjectAnalysis
  private generatedDocuments: Document[] = []
  private startTime: Date = new Date()

  constructor(config: Config) {
    this.config = config

    // Direct instantiation - NO dependency injection
    this.tuiBridge = new TUIBridge()
    this.progressTracker = new ProgressTracker(this.tuiBridge)
    this.lockFileManager = new LockFileManager(this.config)
    this.passwordBridge = new PasswordBridge(this.tuiBridge)
    this.projectAnalyzer = new ProjectAnalyzer(this.config, this.passwordBridge)
    this.docGenerator = new DocGenerator(this.config)
    this.claudeClient = new ClaudeClient(this.config, this.passwordBridge)
    this.obsidianIntegration = new ObsidianIntegration(this.config)
    this.fileWriter = new FileWriter(this.config)

    this.tuiBridge.log('info', `DocumentEngine initialized for project: ${this.config.project.name}`)
  }

  // ============================================================================
  // Main Generation Method - 9 Phases
  // ============================================================================

  async generate(projectPath: string): Promise<void> {
    try {
      // Initialize and check lock file
      if (!await this.initializeGeneration(projectPath)) {
        return
      }

      this.tuiBridge.log('info', `Starting 9-phase documentation generation for: ${projectPath}`)
      this.progressTracker.startGeneration(9)

      // Phase 1: Analysis
      await this.executePhase1Analysis(projectPath)

      // Phase 2: Generation
      await this.executePhase2Generation()

      // Phase 3: Enhancement
      await this.executePhase3Enhancement()

      // Phase 4: Formatting
      await this.executePhase4Formatting()

      // Phase 5: Obsidian Integration
      await this.executePhase5ObsidianIntegration()

      // Phase 6: Tag Optimization
      await this.executePhase6TagOptimization()

      // Phase 7: Backlink Generation
      await this.executePhase7BacklinkGeneration()

      // Phase 8: Verification
      await this.executePhase8Verification()

      // Phase 9: Save
      await this.executePhase9Save()

      // Complete generation
      await this.completeGeneration()

    } catch (error) {
      await this.handleGenerationError(error as Error)
    }
  }

  // ============================================================================
  // Phase 1: Analysis
  // ============================================================================

  private async executePhase1Analysis(projectPath: string): Promise<void> {
    this.progressTracker.startPhase('analysis', 'Project Analysis', 1, 9)
    this.tuiBridge.phaseStart('analysis', 'Project Analysis', 1, 9)

    try {
      // Task 1: Project Type Detection
      this.progressTracker.startTask('project-detection', 'Detecting Project Type')
      this.tuiBridge.taskStart('project-detection', 'Detecting Project Type', 'analysis')

      const projectType = await this.projectAnalyzer.detectProjectType(projectPath)
      this.tuiBridge.log('info', `Detected project type: ${projectType}`)

      this.progressTracker.completeTask('project-detection')
      this.tuiBridge.taskComplete('project-detection', 'Detecting Project Type', 'analysis')

      // Task 2: File Discovery
      this.progressTracker.startTask('file-discovery', 'Discovering Files')
      this.tuiBridge.taskStart('file-discovery', 'Discovering Files', 'analysis')

      const files = await this.projectAnalyzer.discoverFiles(projectPath)
      this.tuiBridge.log('info', `Discovered ${files.length} files`)

      this.progressTracker.completeTask('file-discovery')
      this.tuiBridge.taskComplete('file-discovery', 'Discovering Files', 'analysis')

      // Task 3: File Analysis
      this.progressTracker.startTask('file-analysis', 'Analyzing Files')
      this.tuiBridge.taskStart('file-analysis', 'Analyzing Files', 'analysis')

      const analyzedFiles = await this.projectAnalyzer.analyzeFiles(files)

      this.progressTracker.completeTask('file-analysis')
      this.tuiBridge.taskComplete('file-analysis', 'Analyzing Files', 'analysis')

      // Task 4: Project Structure Mapping
      this.progressTracker.startTask('structure-mapping', 'Mapping Project Structure')
      this.tuiBridge.taskStart('structure-mapping', 'Mapping Project Structure', 'analysis')

      const structure = await this.projectAnalyzer.mapProjectStructure(projectPath, analyzedFiles)

      this.progressTracker.completeTask('structure-mapping')
      this.tuiBridge.taskComplete('structure-mapping', 'Mapping Project Structure', 'analysis')

      // Complete analysis
      this.currentProject = {
        name: this.config.project.name === 'auto-detect' ? basename(projectPath) : this.config.project.name,
        type: projectType,
        path: projectPath,
        structure,
        files: analyzedFiles,
        dependencies: await this.projectAnalyzer.extractDependencies(projectPath),
        frameworks: await this.projectAnalyzer.detectFrameworks(analyzedFiles),
        languages: await this.projectAnalyzer.detectLanguages(analyzedFiles),
        metadata: await this.projectAnalyzer.extractProjectMetadata(projectPath)
      }

      this.progressTracker.completePhase('analysis')
      this.tuiBridge.phaseComplete('analysis', 'Project Analysis', 1, 9)
      this.tuiBridge.log('info', 'Phase 1: Analysis completed successfully')

    } catch (error) {
      this.progressTracker.failPhase('analysis', error as Error)
      this.tuiBridge.error(`Phase 1 Analysis failed: ${(error as Error).message}`)
      throw error
    }
  }

  // ============================================================================
  // Phase 2: Generation
  // ============================================================================

  private async executePhase2Generation(): Promise<void> {
    this.progressTracker.startPhase('generation', 'Document Generation', 2, 9)
    this.tuiBridge.phaseStart('generation', 'Document Generation', 2, 9)

    try {
      if (!this.currentProject) {
        throw new Error('No project analysis available for generation')
      }

      // Task 1: Generate README
      this.progressTracker.startTask('readme-generation', 'Generating README')
      this.tuiBridge.taskStart('readme-generation', 'Generating README', 'generation')

      const readmeDoc = await this.docGenerator.generateReadme(this.currentProject)
      this.generatedDocuments.push(readmeDoc)

      this.progressTracker.completeTask('readme-generation')
      this.tuiBridge.taskComplete('readme-generation', 'Generating README', 'generation')

      // Task 2: Generate Architecture Overview
      this.progressTracker.startTask('architecture-generation', 'Generating Architecture Documentation')
      this.tuiBridge.taskStart('architecture-generation', 'Generating Architecture Documentation', 'generation')

      const archDoc = await this.docGenerator.generateArchitectureOverview(this.currentProject)
      this.generatedDocuments.push(archDoc)

      this.progressTracker.completeTask('architecture-generation')
      this.tuiBridge.taskComplete('architecture-generation', 'Generating Architecture Documentation', 'generation')

      // Task 3: Generate API Documentation
      this.progressTracker.startTask('api-generation', 'Generating API Documentation')
      this.tuiBridge.taskStart('api-generation', 'Generating API Documentation', 'generation')

      const apiDocs = await this.docGenerator.generateAPIDocumentation(this.currentProject)
      this.generatedDocuments.push(...apiDocs)

      this.progressTracker.completeTask('api-generation')
      this.tuiBridge.taskComplete('api-generation', 'Generating API Documentation', 'generation')

      // Task 4: Generate Component Documentation
      this.progressTracker.startTask('component-generation', 'Generating Component Documentation')
      this.tuiBridge.taskStart('component-generation', 'Generating Component Documentation', 'generation')

      const componentDocs = await this.docGenerator.generateComponentDocumentation(this.currentProject)
      this.generatedDocuments.push(...componentDocs)

      this.progressTracker.completeTask('component-generation')
      this.tuiBridge.taskComplete('component-generation', 'Generating Component Documentation', 'generation')

      this.progressTracker.completePhase('generation')
      this.tuiBridge.phaseComplete('generation', 'Document Generation', 2, 9)
      this.tuiBridge.log('info', `Phase 2: Generation completed - ${this.generatedDocuments.length} documents generated`)

    } catch (error) {
      this.progressTracker.failPhase('generation', error as Error)
      this.tuiBridge.error(`Phase 2 Generation failed: ${(error as Error).message}`)
      throw error
    }
  }

  // ============================================================================
  // Phase 3: Enhancement
  // ============================================================================

  private async executePhase3Enhancement(): Promise<void> {
    this.progressTracker.startPhase('enhancement', 'AI Enhancement', 3, 9)
    this.tuiBridge.phaseStart('enhancement', 'AI Enhancement', 3, 9)

    try {
      // Task 1: Claude Content Enhancement
      this.progressTracker.startTask('content-enhancement', 'Enhancing Content with Claude AI')
      this.tuiBridge.taskStart('content-enhancement', 'Enhancing Content with Claude AI', 'enhancement')

      const enhancedDocs: Document[] = []
      for (const doc of this.generatedDocuments) {
        this.tuiBridge.fileStart(doc.id, 'Enhancing with Claude AI')
        const enhanced = await this.claudeClient.enhanceDocument(doc)
        enhancedDocs.push(enhanced)
        this.tuiBridge.fileComplete(doc.id, 'Enhanced with Claude AI')
      }
      this.generatedDocuments = enhancedDocs

      this.progressTracker.completeTask('content-enhancement')
      this.tuiBridge.taskComplete('content-enhancement', 'Enhancing Content with Claude AI', 'enhancement')

      // Task 2: Code Example Generation
      this.progressTracker.startTask('example-generation', 'Generating Code Examples')
      this.tuiBridge.taskStart('example-generation', 'Generating Code Examples', 'enhancement')

      for (const doc of this.generatedDocuments) {
        if (doc.type === 'api' || doc.type === 'component') {
          this.tuiBridge.fileStart(doc.id, 'Generating code examples')
          doc.content = await this.claudeClient.addCodeExamples(doc.content, doc.sourceFiles)
          this.tuiBridge.fileComplete(doc.id, 'Code examples generated')
        }
      }

      this.progressTracker.completeTask('example-generation')
      this.tuiBridge.taskComplete('example-generation', 'Generating Code Examples', 'enhancement')

      this.progressTracker.completePhase('enhancement')
      this.tuiBridge.phaseComplete('enhancement', 'AI Enhancement', 3, 9)
      this.tuiBridge.log('info', 'Phase 3: Enhancement completed successfully')

    } catch (error) {
      this.progressTracker.failPhase('enhancement', error as Error)
      this.tuiBridge.error(`Phase 3 Enhancement failed: ${(error as Error).message}`)
      throw error
    }
  }

  // ============================================================================
  // Phase 4: Formatting
  // ============================================================================

  private async executePhase4Formatting(): Promise<void> {
    this.progressTracker.startPhase('formatting', 'Document Formatting', 4, 9)
    this.tuiBridge.phaseStart('formatting', 'Document Formatting', 4, 9)

    try {
      // Task 1: Apply Templates
      this.progressTracker.startTask('template-application', 'Applying Document Templates')
      this.tuiBridge.taskStart('template-application', 'Applying Document Templates', 'formatting')

      for (const doc of this.generatedDocuments) {
        this.tuiBridge.fileStart(doc.id, 'Applying template')
        doc.content = await this.docGenerator.applyTemplate(doc)
        this.tuiBridge.fileComplete(doc.id, 'Template applied')
      }

      this.progressTracker.completeTask('template-application')
      this.tuiBridge.taskComplete('template-application', 'Applying Document Templates', 'formatting')

      // Task 2: Format Markdown
      this.progressTracker.startTask('markdown-formatting', 'Formatting Markdown')
      this.tuiBridge.taskStart('markdown-formatting', 'Formatting Markdown', 'formatting')

      for (const doc of this.generatedDocuments) {
        this.tuiBridge.fileStart(doc.id, 'Formatting markdown')
        doc.content = this.docGenerator.formatMarkdown(doc.content)
        this.tuiBridge.fileComplete(doc.id, 'Markdown formatted')
      }

      this.progressTracker.completeTask('markdown-formatting')
      this.tuiBridge.taskComplete('markdown-formatting', 'Formatting Markdown', 'formatting')

      this.progressTracker.completePhase('formatting')
      this.tuiBridge.phaseComplete('formatting', 'Document Formatting', 4, 9)
      this.tuiBridge.log('info', 'Phase 4: Formatting completed successfully')

    } catch (error) {
      this.progressTracker.failPhase('formatting', error as Error)
      this.tuiBridge.error(`Phase 4 Formatting failed: ${(error as Error).message}`)
      throw error
    }
  }

  // ============================================================================
  // Phase 5: Obsidian Integration
  // ============================================================================

  private async executePhase5ObsidianIntegration(): Promise<void> {
    this.progressTracker.startPhase('obsidian-integration', 'Obsidian Integration', 5, 9)
    this.tuiBridge.phaseStart('obsidian-integration', 'Obsidian Integration', 5, 9)

    try {
      // Task 1: Generate Frontmatter
      this.progressTracker.startTask('frontmatter-generation', 'Generating Frontmatter')
      this.tuiBridge.taskStart('frontmatter-generation', 'Generating Frontmatter', 'obsidian-integration')

      for (const doc of this.generatedDocuments) {
        this.tuiBridge.fileStart(doc.id, 'Generating frontmatter')
        doc.frontmatter = await this.obsidianIntegration.generateFrontmatter(doc, this.currentProject!)
        this.tuiBridge.fileComplete(doc.id, 'Frontmatter generated')
      }

      this.progressTracker.completeTask('frontmatter-generation')
      this.tuiBridge.taskComplete('frontmatter-generation', 'Generating Frontmatter', 'obsidian-integration')

      // Task 2: Structure for Obsidian
      this.progressTracker.startTask('obsidian-structuring', 'Structuring for Obsidian')
      this.tuiBridge.taskStart('obsidian-structuring', 'Structuring for Obsidian', 'obsidian-integration')

      for (const doc of this.generatedDocuments) {
        this.tuiBridge.fileStart(doc.id, 'Structuring for Obsidian')
        doc.content = await this.obsidianIntegration.structureForObsidian(doc)
        this.tuiBridge.fileComplete(doc.id, 'Structured for Obsidian')
      }

      this.progressTracker.completeTask('obsidian-structuring')
      this.tuiBridge.taskComplete('obsidian-structuring', 'Structuring for Obsidian', 'obsidian-integration')

      this.progressTracker.completePhase('obsidian-integration')
      this.tuiBridge.phaseComplete('obsidian-integration', 'Obsidian Integration', 5, 9)
      this.tuiBridge.log('info', 'Phase 5: Obsidian Integration completed successfully')

    } catch (error) {
      this.progressTracker.failPhase('obsidian-integration', error as Error)
      this.tuiBridge.error(`Phase 5 Obsidian Integration failed: ${(error as Error).message}`)
      throw error
    }
  }

  // ============================================================================
  // Phase 6: Tag Optimization
  // ============================================================================

  private async executePhase6TagOptimization(): Promise<void> {
    this.progressTracker.startPhase('tag-optimization', 'Tag Optimization', 6, 9)
    this.tuiBridge.phaseStart('tag-optimization', 'Tag Optimization', 6, 9)

    try {
      // Task 1: Optimize Tags with Claude
      this.progressTracker.startTask('tag-optimization-claude', 'Optimizing Tags with Claude AI')
      this.tuiBridge.taskStart('tag-optimization-claude', 'Optimizing Tags with Claude AI', 'tag-optimization')

      const optimizedTags = await this.obsidianIntegration.optimizeTagsWithClaude(
        this.generatedDocuments,
        this.claudeClient
      )

      // Apply optimized tags
      this.generatedDocuments = optimizedTags

      this.progressTracker.completeTask('tag-optimization-claude')
      this.tuiBridge.taskComplete('tag-optimization-claude', 'Optimizing Tags with Claude AI', 'tag-optimization')

      // Task 2: Create Tag Hierarchy
      this.progressTracker.startTask('tag-hierarchy', 'Creating Tag Hierarchy Document')
      this.tuiBridge.taskStart('tag-hierarchy', 'Creating Tag Hierarchy Document', 'tag-optimization')

      const tagHierarchyDoc = await this.obsidianIntegration.createTagHierarchyDocument(
        this.generatedDocuments,
        this.currentProject!
      )
      this.generatedDocuments.push(tagHierarchyDoc)

      this.progressTracker.completeTask('tag-hierarchy')
      this.tuiBridge.taskComplete('tag-hierarchy', 'Creating Tag Hierarchy Document', 'tag-optimization')

      this.progressTracker.completePhase('tag-optimization')
      this.tuiBridge.phaseComplete('tag-optimization', 'Tag Optimization', 6, 9)
      this.tuiBridge.log('info', 'Phase 6: Tag Optimization completed successfully')

    } catch (error) {
      this.progressTracker.failPhase('tag-optimization', error as Error)
      this.tuiBridge.error(`Phase 6 Tag Optimization failed: ${(error as Error).message}`)
      throw error
    }
  }

  // ============================================================================
  // Phase 7: Backlink Generation
  // ============================================================================

  private async executePhase7BacklinkGeneration(): Promise<void> {
    this.progressTracker.startPhase('backlink-generation', 'Backlink Generation', 7, 9)
    this.tuiBridge.phaseStart('backlink-generation', 'Backlink Generation', 7, 9)

    try {
      // Task 1: Generate Cross-References
      this.progressTracker.startTask('cross-reference-generation', 'Generating Cross-References')
      this.tuiBridge.taskStart('cross-reference-generation', 'Generating Cross-References', 'backlink-generation')

      this.generatedDocuments = await this.obsidianIntegration.generateCrossReferences(
        this.generatedDocuments
      )

      this.progressTracker.completeTask('cross-reference-generation')
      this.tuiBridge.taskComplete('cross-reference-generation', 'Generating Cross-References', 'backlink-generation')

      // Task 2: Link Source Files
      this.progressTracker.startTask('source-file-linking', 'Linking Source Files')
      this.tuiBridge.taskStart('source-file-linking', 'Linking Source Files', 'backlink-generation')

      for (const doc of this.generatedDocuments) {
        this.tuiBridge.fileStart(doc.id, 'Linking source files')
        doc.content = await this.obsidianIntegration.linkSourceFiles(doc.content, doc.sourceFiles)
        this.tuiBridge.fileComplete(doc.id, 'Source files linked')
      }

      this.progressTracker.completeTask('source-file-linking')
      this.tuiBridge.taskComplete('source-file-linking', 'Linking Source Files', 'backlink-generation')

      this.progressTracker.completePhase('backlink-generation')
      this.tuiBridge.phaseComplete('backlink-generation', 'Backlink Generation', 7, 9)
      this.tuiBridge.log('info', 'Phase 7: Backlink Generation completed successfully')

    } catch (error) {
      this.progressTracker.failPhase('backlink-generation', error as Error)
      this.tuiBridge.error(`Phase 7 Backlink Generation failed: ${(error as Error).message}`)
      throw error
    }
  }

  // ============================================================================
  // Phase 8: Verification
  // ============================================================================

  private async executePhase8Verification(): Promise<void> {
    this.progressTracker.startPhase('verification', 'Document Verification', 8, 9)
    this.tuiBridge.phaseStart('verification', 'Document Verification', 8, 9)

    try {
      // Task 1: Verify Document Completeness
      this.progressTracker.startTask('completeness-verification', 'Verifying Document Completeness')
      this.tuiBridge.taskStart('completeness-verification', 'Verifying Document Completeness', 'verification')

      const verificationResults = await this.obsidianIntegration.verifyDocumentCompleteness(
        this.generatedDocuments
      )

      if (verificationResults.hasErrors) {
        this.tuiBridge.log('warn', `Verification found ${verificationResults.errors.length} issues`)
        for (const error of verificationResults.errors) {
          this.tuiBridge.log('warn', `- ${error}`)
        }
      }

      this.progressTracker.completeTask('completeness-verification')
      this.tuiBridge.taskComplete('completeness-verification', 'Verifying Document Completeness', 'verification')

      // Task 2: Validate Obsidian Requirements
      this.progressTracker.startTask('obsidian-validation', 'Validating Obsidian Requirements')
      this.tuiBridge.taskStart('obsidian-validation', 'Validating Obsidian Requirements', 'verification')

      const obsidianValidation = await this.obsidianIntegration.validateObsidianRequirements(
        this.generatedDocuments
      )

      if (!obsidianValidation.valid) {
        this.tuiBridge.log('warn', `Obsidian validation found ${obsidianValidation.errors.length} issues`)
        for (const error of obsidianValidation.errors) {
          this.tuiBridge.log('warn', `- ${error}`)
        }
      }

      this.progressTracker.completeTask('obsidian-validation')
      this.tuiBridge.taskComplete('obsidian-validation', 'Validating Obsidian Requirements', 'verification')

      this.progressTracker.completePhase('verification')
      this.tuiBridge.phaseComplete('verification', 'Document Verification', 8, 9)
      this.tuiBridge.log('info', 'Phase 8: Verification completed successfully')

    } catch (error) {
      this.progressTracker.failPhase('verification', error as Error)
      this.tuiBridge.error(`Phase 8 Verification failed: ${(error as Error).message}`)
      throw error
    }
  }

  // ============================================================================
  // Phase 9: Save
  // ============================================================================

  private async executePhase9Save(): Promise<void> {
    this.progressTracker.startPhase('save', 'Saving Documents', 9, 9)
    this.tuiBridge.phaseStart('save', 'Saving Documents', 9, 9)

    try {
      // Task 1: Save to Output Directory
      this.progressTracker.startTask('document-saving', 'Saving Documents to Output Directory')
      this.tuiBridge.taskStart('document-saving', 'Saving Documents to Output Directory', 'save')

      const outputPath = resolve(this.config.output.path)
      const projectOutputPath = join(outputPath, this.currentProject!.name)

      for (const doc of this.generatedDocuments) {
        this.tuiBridge.fileStart(doc.id, 'Saving document')
        await this.fileWriter.saveDocument(doc, projectOutputPath)
        this.tuiBridge.fileComplete(doc.id, 'Document saved')
      }

      this.progressTracker.completeTask('document-saving')
      this.tuiBridge.taskComplete('document-saving', 'Saving Documents to Output Directory', 'save')

      // Task 2: Create Index/MOC
      this.progressTracker.startTask('index-creation', 'Creating Master Index')
      this.tuiBridge.taskStart('index-creation', 'Creating Master Index', 'save')

      const indexDoc = await this.obsidianIntegration.createMasterIndex(
        this.generatedDocuments,
        this.currentProject!
      )
      await this.fileWriter.saveDocument(indexDoc, projectOutputPath)

      this.progressTracker.completeTask('index-creation')
      this.tuiBridge.taskComplete('index-creation', 'Creating Master Index', 'save')

      this.progressTracker.completePhase('save')
      this.tuiBridge.phaseComplete('save', 'Saving Documents', 9, 9)
      this.tuiBridge.log('info', `Phase 9: Save completed - ${this.generatedDocuments.length + 1} documents saved to ${projectOutputPath}`)

    } catch (error) {
      this.progressTracker.failPhase('save', error as Error)
      this.tuiBridge.error(`Phase 9 Save failed: ${(error as Error).message}`)
      throw error
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async initializeGeneration(projectPath: string): Promise<boolean> {
    try {
      // Check if generation already in progress
      if (!await this.lockFileManager.checkAndCreate(projectPath)) {
        this.tuiBridge.log('warn', 'Documentation generation already in progress!')
        return false
      }

      // Validate project path
      if (!await this.pathExists(projectPath)) {
        throw new Error(`Project path does not exist: ${projectPath}`)
      }

      // Ensure output directory exists
      await this.ensureOutputDirectory()

      return true
    } catch (error) {
      this.tuiBridge.error(`Initialization failed: ${(error as Error).message}`)
      return false
    }
  }

  private async completeGeneration(): Promise<void> {
    const endTime = new Date()
    const duration = endTime.getTime() - this.startTime.getTime()

    await this.lockFileManager.completeLock()
    this.progressTracker.completeGeneration()

    this.tuiBridge.log('info', `Documentation generation completed successfully in ${this.formatDuration(duration)}`)
    this.tuiBridge.completion({
      documentsGenerated: this.generatedDocuments.length,
      duration: duration,
      outputPath: this.config.output.path
    })
  }

  private async handleGenerationError(error: Error): Promise<void> {
    await this.lockFileManager.failLock(error.message)
    this.progressTracker.failGeneration(error)
    this.tuiBridge.error(`Documentation generation failed: ${error.message}`)
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

// ============================================================================
// Placeholder Classes (to be implemented in separate files)
// ============================================================================

// These classes will be implemented in their own files but are referenced here
// for the complete DocumentEngine implementation

class ProgressTracker {
  constructor(private tuiBridge: TUIBridge) {}
  startGeneration(totalPhases: number): void { /* Implementation */ }
  startPhase(phase: Phase, displayName: string, index: number, total: number): void { /* Implementation */ }
  completePhase(phase: Phase): void { /* Implementation */ }
  failPhase(phase: Phase, error: Error): void { /* Implementation */ }
  startTask(taskName: string, displayName: string): void { /* Implementation */ }
  completeTask(taskName: string): void { /* Implementation */ }
  completeGeneration(): void { /* Implementation */ }
  failGeneration(error: Error): void { /* Implementation */ }
}

class TUIBridge {
  phaseStart(phase: Phase, displayName: string, index: number, total: number): void { /* Implementation */ }
  phaseComplete(phase: Phase, displayName: string, index: number, total: number): void { /* Implementation */ }
  taskStart(taskName: string, displayName: string, phase: Phase): void { /* Implementation */ }
  taskComplete(taskName: string, displayName: string, phase: Phase): void { /* Implementation */ }
  fileStart(fileId: string, operation: string): void { /* Implementation */ }
  fileComplete(fileId: string, operation: string): void { /* Implementation */ }
  log(level: 'info' | 'warn' | 'error' | 'debug', message: string): void { /* Implementation */ }
  error(message: string): void { /* Implementation */ }
  completion(data: any): void { /* Implementation */ }
}

class LockFileManager {
  constructor(private config: Config) {}
  async checkAndCreate(projectPath: string): Promise<boolean> { /* Implementation */ return true }
  async completeLock(): Promise<void> { /* Implementation */ }
  async failLock(error: string): Promise<void> { /* Implementation */ }
}

class PasswordBridge {
  constructor(private tuiBridge: TUIBridge) {}
}

class ProjectAnalyzer {
  constructor(private config: Config, private passwordBridge: PasswordBridge) {}
  async detectProjectType(projectPath: string): Promise<ProjectType> { /* Implementation */ return 'application' }
  async discoverFiles(projectPath: string): Promise<FileInfo[]> { /* Implementation */ return [] }
  async analyzeFiles(files: FileInfo[]): Promise<FileInfo[]> { /* Implementation */ return files }
  async mapProjectStructure(projectPath: string, files: FileInfo[]): Promise<ProjectStructure> { /* Implementation */ return { srcDirs: [], testDirs: [], configFiles: [], docDirs: [] } }
  async extractDependencies(projectPath: string): Promise<string[]> { /* Implementation */ return [] }
  async detectFrameworks(files: FileInfo[]): Promise<string[]> { /* Implementation */ return [] }
  async detectLanguages(files: FileInfo[]): Promise<string[]> { /* Implementation */ return [] }
  async extractProjectMetadata(projectPath: string): Promise<any> { /* Implementation */ return {} }
}

class DocGenerator {
  constructor(private config: Config) {}
  async generateReadme(project: ProjectAnalysis): Promise<Document> { /* Implementation */ return {} as Document }
  async generateArchitectureOverview(project: ProjectAnalysis): Promise<Document> { /* Implementation */ return {} as Document }
  async generateAPIDocumentation(project: ProjectAnalysis): Promise<Document[]> { /* Implementation */ return [] }
  async generateComponentDocumentation(project: ProjectAnalysis): Promise<Document[]> { /* Implementation */ return [] }
  async applyTemplate(doc: Document): Promise<string> { /* Implementation */ return doc.content }
  formatMarkdown(content: string): string { /* Implementation */ return content }
}

class ClaudeClient {
  constructor(private config: Config, private passwordBridge: PasswordBridge) {}
  async enhanceDocument(doc: Document): Promise<Document> { /* Implementation */ return doc }
  async addCodeExamples(content: string, sourceFiles: string[]): Promise<string> { /* Implementation */ return content }
}

class ObsidianIntegration {
  constructor(private config: Config) {}
  async generateFrontmatter(doc: Document, project: ProjectAnalysis): Promise<Frontmatter> { /* Implementation */ return {} as Frontmatter }
  async structureForObsidian(doc: Document): Promise<string> { /* Implementation */ return doc.content }
  async optimizeTagsWithClaude(docs: Document[], claudeClient: ClaudeClient): Promise<Document[]> { /* Implementation */ return docs }
  async createTagHierarchyDocument(docs: Document[], project: ProjectAnalysis): Promise<Document> { /* Implementation */ return {} as Document }
  async generateCrossReferences(docs: Document[]): Promise<Document[]> { /* Implementation */ return docs }
  async linkSourceFiles(content: string, sourceFiles: string[]): Promise<string> { /* Implementation */ return content }
  async verifyDocumentCompleteness(docs: Document[]): Promise<{hasErrors: boolean, errors: string[]}> { /* Implementation */ return {hasErrors: false, errors: []} }
  async validateObsidianRequirements(docs: Document[]): Promise<{valid: boolean, errors: string[]}> { /* Implementation */ return {valid: true, errors: []} }
  async createMasterIndex(docs: Document[], project: ProjectAnalysis): Promise<Document> { /* Implementation */ return {} as Document }
}

class FileWriter {
  constructor(private config: Config) {}
  async saveDocument(doc: Document, outputPath: string): Promise<void> { /* Implementation */ }
}
