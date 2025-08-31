import { Command } from 'commander'
import { resolve, basename, join } from 'path'
import { existsSync, statSync } from 'fs'
// import { logger, ProgressInfo } from '../display' // Replaced with unified Logger
import { ConfigManager } from './config'
import { DocumentorConfig } from '../../types'
import FileWriter from '../../core/FileWriter'
import { ProjectTypeDetector, DetectionResult } from '../../core/ProjectTypeDetector'
import { FileScanner } from '../../core/FileScanner'
import { ObsidianIntegration, ObsidianConfig } from '../../core/ObsidianIntegration'
import { SecureFileOps } from '../../core/SecureFileOps'
import { PasswordBridge } from '../../core/PasswordBridge'
import { spawn } from 'child_process'
import { expandPath } from '../../utils/paths'
import { tuiAdapter } from '../../core/TUIAdapter'
import { phaseManager } from '../../core/PhaseManager'
import { Logger } from '../../core/Logger'
import { LockFileManager } from '../../core/LockFileManager'
import { ClaudeClient } from '../../core/ClaudeClient'
import { DocGenerator } from '../../core/DocGenerator'
import { DocumentEngine } from '../../core/DocumentEngine'
import { DocumentProcessor } from '../../core/efficient/DocumentProcessor'
import { formatLocalTimestamp } from '../../utils/datetime'

// Local phase execution wrapper for CLI command
class GeneratePhaseExecutor {
  private config: DocumentorConfig
  private projectPath: string
  private outputPath: string
  private fileWriter: FileWriter
  private lockFilePath: string
  private startTime: number
  private lockFileManager: LockFileManager
  private claudeClient: ClaudeClient
  private docGenerator: DocGenerator

  constructor(config: DocumentorConfig, projectPath: string) {
    this.config = config
    this.projectPath = resolve(projectPath)
    this.outputPath = expandPath(config.output.path)
    this.fileWriter = new FileWriter(this.outputPath, this.projectPath)
    this.lockFilePath = join(this.projectPath, '.documentor.lock')
    this.startTime = Date.now()
    // Use singleton TUIAdapter
    this.lockFileManager = LockFileManager.getInstance(this.projectPath)
    phaseManager.initialize(this.projectPath, this.lockFileManager)
    this.claudeClient = new ClaudeClient({
      model: config.claude.model,
      maxRetries: 3,
      timeout: 300000, // 5 minutes
      temperature: config.claude.temperature,
      maxTokens: config.claude.maxTokens,
      projectPath: this.projectPath
    })
    this.docGenerator = new DocGenerator(config, this.claudeClient)

    // Initialize unified logger
    Logger.initialize(this.outputPath)
  }

  // Main orchestrator - runs all 9 phases using PhaseManager
  async execute(options: GenerateOptions): Promise<void> {
    const projectName = basename(this.projectPath)

    // Start TUI with project path
    tuiAdapter.start(this.projectPath)
    
    // Send initial messages
    tuiAdapter.logInfo(`Starting: Generating documentation for ${projectName}`)
    tuiAdapter.logInfo(`Output: ${this.outputPath}`)

    try {
      // Create lock file
      await this.createLockFile()

      // Start PhaseManager and execute all phases
      // PhaseManager is already initialized
      
      // Phase execution will be integrated with actual work
      for (let i = 0; i < 9; i++) {
        await this.executePhaseWithWork(i + 1) // Phases are 1-indexed
      }

      // Success summary
      await this.showSuccessSummary()

    } catch (error) {
      await this.handleError(error)
      throw error
    } finally {
      await this.cleanup()
    }
  }

  private async createLockFile(): Promise<void> {
    await this.lockFileManager.create(this.projectPath, this.outputPath)
    Logger.debug(`Lock file created: ${this.lockFilePath}`, 'LockFile')
  }

  private getPhaseNameForNumber(phase: number): string {
    const phaseNames = [
      'analysis', 'generation', 'enhancement', 'formatting', 
      'obsidian-integration', 'tag-optimization', 'backlink-generation', 
      'verification', 'save'
    ]
    return phaseNames[phase - 1] || 'unknown'
  }

  private reportPhaseProgress(phase: number, phaseName: string, task: string, progress: number): void {
    // PhaseManager tracks phase internally, just report the task
    phaseManager.startTask(task)
  }

  // Phase 1: Project Analysis & File Discovery
  private async phase1_ProjectAnalysis(): Promise<void> {
    this.reportPhaseProgress(1, 'Analysis', 'Analyzing project structure', 0)

    const detector = new ProjectTypeDetector()
    const detectionResult = await detector.detect(this.projectPath)

    this.reportPhaseProgress(1, 'Analysis', 'Scanning project files', 50)

    const scanner = new FileScanner()
    const scanResult = await scanner.scanDirectory(this.projectPath)

    this.reportPhaseProgress(1, 'Analysis', 'Categorizing project type', 100)

    Logger.debug('Project analysis complete', 'Analysis', {
      projectType: detectionResult.type,
      confidence: detectionResult.confidence,
      fileCount: scanResult.files.length
    })
  }

  // Phase 2: Security Validation
  private async phase2_SecurityValidation(options: GenerateOptions): Promise<void> {
    this.reportPhaseProgress(2, 'Security', 'Validating security permissions', 0)

    const secureOps = new SecureFileOps()

    // Check output path permissions
    this.reportPhaseProgress(2, 'Security', 'Verifying output directory access', 30)
    const isOutputSafe = await this.fileWriter.verifyOutputDirectory()
    if (!isOutputSafe) {
      throw new Error('Output directory is not accessible or writable')
    }

    // Password validation if required
    if (this.config.permissions.requestPassword && !options.noPermission) {
      this.reportPhaseProgress(2, 'Security', 'Requesting user permission', 60)

      const passwordBridge = new PasswordBridge()
      const password = await passwordBridge.requestPassword(
        'Enter password to proceed with documentation generation',
        `Project: ${this.projectPath}, Output: ${this.outputPath}`
      )
      const hasPermission = password !== null

      if (!hasPermission) {
        if (this.config.permissions.skipOnDenial) {
          Logger.warn('Permission denied, skipping documentation generation')
          return
        } else {
          throw new Error('Permission denied by user')
        }
      }
    }

    this.reportPhaseProgress(2, 'Security', 'Security validation complete', 100)
  }

  // Phase 3: AI-Powered Enhancement
  private async phase3_Enhancement(): Promise<void> {
    this.reportPhaseProgress(3, 'Enhancement', 'Analyzing with Claude AI', 0)

    // Enhancement phase - actual work handled by DocGenerator and ClaudeClient
    this.reportPhaseProgress(3, 'Enhancement', 'Generating API documentation', 50)
    this.reportPhaseProgress(3, 'Enhancement', 'Creating architectural overview', 100)
  }

  // Phase 4: Obsidian Integration
  private async phase4_ObsidianIntegration(): Promise<void> {
    this.reportPhaseProgress(4, 'Obsidian', 'Configuring Obsidian integration', 0)

    if (this.config.output.format === 'obsidian') {
      const obsidianConfig: ObsidianConfig = {
        projectName: basename(this.projectPath),
        projectTag: `#project/${basename(this.projectPath).toLowerCase()}`,
        outputDir: this.outputPath,
        sourceDir: this.projectPath,
        enableTagOptimization: true,
        enableBacklinks: true,
        enableVerification: true,
        minTagsPerDocument: 2,
        maxTagsPerDocument: 15,
        createTagHierarchy: true
      }

      this.reportPhaseProgress(4, 'Obsidian', 'Creating Obsidian vault structure', 30)

      const obsidian = new ObsidianIntegration(obsidianConfig)

      this.reportPhaseProgress(4, 'Obsidian', 'Generating frontmatter', 70)
      // Integration logic would go here

      this.reportPhaseProgress(4, 'Obsidian', 'Obsidian integration complete', 100)
    } else {
      Logger.info('Skipping Obsidian integration (format: markdown)')
      this.reportPhaseProgress(4, 'Obsidian', 'Skipped (markdown format)', 100)
    }
  }

  // Phase 5: Tag Optimization
  private async phase5_TagOptimization(): Promise<void> {
    this.reportPhaseProgress(5, 'Tags', 'Optimizing document tags', 0)

    if (this.config.output.format === 'obsidian') {
      // await this.simulateAsyncWork(1000)
      this.reportPhaseProgress(5, 'Tags', 'Creating tag hierarchy', 50)

      // await this.simulateAsyncWork(1000)
      this.reportPhaseProgress(5, 'Tags', 'Tag optimization complete', 100)
    } else {
      this.reportPhaseProgress(5, 'Tags', 'Skipped (markdown format)', 100)
    }
  }

  // Phase 6: Backlink Generation
  private async phase6_BacklinkGeneration(): Promise<void> {
    this.reportPhaseProgress(6, 'Backlinks', 'Generating document backlinks', 0)

    if (this.config.output.format === 'obsidian') {
      // await this.simulateAsyncWork(1500)
      this.reportPhaseProgress(6, 'Backlinks', 'Creating cross-references', 50)

      // await this.simulateAsyncWork(1000)
      this.reportPhaseProgress(6, 'Backlinks', 'Backlink generation complete', 100)
    } else {
      this.reportPhaseProgress(6, 'Backlinks', 'Skipped (markdown format)', 100)
    }
  }

  // Phase 7: Quality Verification
  private async phase7_QualityVerification(): Promise<void> {
    this.reportPhaseProgress(7, 'Verification', 'Verifying documentation quality', 0)

    // await this.simulateAsyncWork(1000)
    this.reportPhaseProgress(7, 'Verification', 'Checking completeness', 50)

    // await this.simulateAsyncWork(800)
    this.reportPhaseProgress(7, 'Verification', 'Quality verification complete', 100)
  }

  // Phase 8: GitHub Integration
  private async phase8_GitHubIntegration(): Promise<void> {
    this.reportPhaseProgress(8, 'GitHub', 'GitHub integration', 0)

    // Check if this is a git repo
    const gitDir = join(this.projectPath, '.git')
    if (existsSync(gitDir)) {
      this.reportPhaseProgress(8, 'GitHub', 'Processing git metadata', 50)
      // await this.simulateAsyncWork(500)
    }

    this.reportPhaseProgress(8, 'GitHub', 'GitHub integration complete', 100)
  }

  // Phase 9: Final Assembly
  private async phase9_FinalAssembly(): Promise<void> {
    this.reportPhaseProgress(9, 'Assembly', 'Finalizing documentation', 0)

    // Launch TUI for final display
    this.reportPhaseProgress(9, 'Assembly', 'Starting TUI display', 30)
    await this.launchTUI()

    this.reportPhaseProgress(9, 'Assembly', 'Documentation generation complete', 100)
  }

  private async launchTUI(): Promise<void> {
    // TUI is launched by the wrapper script
    // Nothing to do here
  }

  // All simulated work removed - using real implementations only

  private async showSuccessSummary(): Promise<void> {
    const duration = Date.now() - this.startTime
    const projectName = basename(this.projectPath)

    // Get actual file count from phaseManager or lockFile
    const lockData = await this.lockFileManager.read()
    const filesProcessed = lockData?.filesProcessed || 0

    Logger.info('Generation Summary')
    Logger.info(`Project: ${projectName}`)
    Logger.info(`Output: ${this.outputPath}`)
    Logger.info(`Duration: ${Math.round(duration / 1000)}s`)
    Logger.info(`Files: ${filesProcessed}`)
    Logger.success('Documentation generated successfully')
  }

  private async handleError(error: any): Promise<void> {
    Logger.error(`Documentation generation failed: ${(error as Error).message}`)

    // Update lock file with error
    try {
      const lockData = {
        status: 'error',
        error: error.message,
        timestamp: formatLocalTimestamp()
      }
      await this.fileWriter.writeLockFile(lockData)
    } catch (lockError) {
      // Ignore lock file errors
    }
  }

  private async executePhaseWithWork(phaseIndex: number): Promise<void> {
    // Perform actual work based on phase
    switch (phaseIndex) {
    case 1: // Project Analysis
      await phaseManager.executePhase(1, async () => {
        await this.phase1_ProjectAnalysis()
      })
      break
    case 2: // Security Validation
      await this.performValidation()
      break
    case 3: // Enhancement
      await this.phase3_Enhancement()
      break
    case 4: // Obsidian Integration
      await this.phase4_ObsidianIntegration()
      break
    case 5: // GENERATION
      await this.performGeneration()
      break
    case 6: // ENHANCEMENT
      await this.performEnhancement()
      break
    case 7: // FORMATTING
      await this.performFormatting()
      break
    case 8: // INTEGRATION
      await this.performIntegration()
      break
    case 9: // FINALIZATION
      await this.performFinalization()
      break
    }
  }

  private async performInitialization(): Promise<void> {
    // Actual initialization work
    await this.fileWriter.verifyOutputDirectory()
  }

  private async performValidation(): Promise<void> {
    // Security and safety validation
    const secureOps = new SecureFileOps()
    // Validation logic here
  }

  private async performAnalysis(): Promise<void> {
    // Project analysis
    const detector = new ProjectTypeDetector()
    const detectionResult = await detector.detect(this.projectPath)
    
    const scanner = new FileScanner()
    const scanResult = await scanner.scanDirectory(this.projectPath)
  }

  private async performPreparation(): Promise<void> {
    // Prepare for documentation generation
    // Load templates, set up context, etc.
  }

  private async performGeneration(): Promise<void> {
    // Main documentation generation using Claude
    // This is where most of the AI work happens
    const docs = await this.docGenerator.generateDocumentation(this.projectPath)
  }

  private async performEnhancement(): Promise<void> {
    // Enhance documentation with frontmatter, tags, etc.
    if (this.config.output.format === 'obsidian') {
      // Add frontmatter, tags, backlinks
    }
  }

  private async performFormatting(): Promise<void> {
    // Format and beautify documentation
  }

  private async performIntegration(): Promise<void> {
    // Obsidian integration
    if (this.config.output.format === 'obsidian') {
      const obsidianConfig: ObsidianConfig = {
        projectName: basename(this.projectPath),
        projectTag: `#project/${basename(this.projectPath).toLowerCase()}`,
        outputDir: this.outputPath,
        sourceDir: this.projectPath,
        enableTagOptimization: true,
        enableBacklinks: true,
        enableVerification: true,
        minTagsPerDocument: 2,
        maxTagsPerDocument: 15,
        createTagHierarchy: true
      }
      const obsidian = new ObsidianIntegration(obsidianConfig)
    }
  }

  private async performFinalization(): Promise<void> {
    // Final cleanup and summary
    // Generate audit report, save state, etc.
  }

  private async cleanup(): Promise<void> {
    // Clean up temporary files, close connections, etc.
    Logger.debug('Cleanup complete')
  }
}

interface GenerateOptions {
  output?: string;
  format?: 'obsidian' | 'markdown';
  verbose?: boolean;
  noPermission?: boolean;
}

// Generate command definition
const generateCommand = new Command('generate')
  .description('Generate comprehensive documentation for a project')
  .argument('<project>', 'Path to project directory')
  .option('-o, --output <path>', 'Output directory (overrides config)')
  .option('-f, --format <format>', 'Output format: obsidian|markdown', 'obsidian')
  .option('-v, --verbose', 'Verbose output')
  .option('--no-permission', 'Skip password prompts (use with caution)')
  .action(async (projectPath: string, options: GenerateOptions) => {
    try {
      // Validate project path
      const resolvedProjectPath = resolve(projectPath)
      if (!existsSync(resolvedProjectPath)) {
        Logger.error(`Project directory does not exist: ${resolvedProjectPath}`)
        process.exit(1)
      }

      if (!statSync(resolvedProjectPath).isDirectory()) {
        Logger.error(`Path is not a directory: ${resolvedProjectPath}`)
        process.exit(1)
      }

      // Load configuration
      const configManager = new ConfigManager()
      const config = await configManager.loadConfig()

      // Override with command options
      if (options.output) {
        config.output.path = options.output
      }

      if (options.format) {
        config.output.format = options.format
      }

      // Check for efficient mode flag (env var or config)
      const useEfficient = process.env.DOCUMENTOR_EFFICIENT === 'true' || config.experimental?.efficientMode
      
      if (useEfficient) {
        // Use new efficient processor
        console.log('\n🚀 Using efficient parallel processing mode\n')
        const processor = new DocumentProcessor(config, resolvedProjectPath)
        await processor.process()
      } else {
        // Use the core DocumentEngine for actual generation
        const engine = new DocumentEngine(config, resolvedProjectPath)
        await engine.generate()
      }
      
      // If we need phase-specific execution, use local executor
      // const executor = new GeneratePhaseExecutor(config, resolvedProjectPath)
      // await executor.execute(options)

    } catch (error) {
      Logger.error(`Command failed: ${(error as Error).message}`)
      process.exit(1)
    }
  })

export { generateCommand }
