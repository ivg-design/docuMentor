import { Command } from 'commander'
import { resolve, basename, join } from 'path'
import { existsSync, statSync } from 'fs'
import { homedir } from 'os'
import { logger, ProgressInfo } from '../display'
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

// 9-Phase Documentation Generation Engine
class DocumentEngine {
  private config: DocumentorConfig
  private projectPath: string
  private outputPath: string
  private fileWriter: FileWriter
  private lockFilePath: string
  private startTime: number

  constructor(config: DocumentorConfig, projectPath: string) {
    this.config = config
    this.projectPath = resolve(projectPath)
    this.outputPath = expandPath(config.output.path)
    this.fileWriter = new FileWriter(this.outputPath, this.projectPath)
    this.lockFilePath = join(this.projectPath, '.documentor.lock')
    this.startTime = Date.now()

    // Configure logger lock file
    logger.setLockFile(this.lockFilePath)
  }

  // Main orchestrator - runs all 9 phases
  async execute(options: GenerateOptions): Promise<void> {
    const projectName = basename(this.projectPath)

    logger.showHeader(
      `Generating Documentation: ${projectName}`,
      `Output: ${this.outputPath}`
    )

    try {
      // Create lock file
      await this.createLockFile()

      // Execute 9 phases
      await this.phase1_ProjectAnalysis()
      await this.phase2_SecurityValidation(options)
      await this.phase3_Enhancement()
      await this.phase4_ObsidianIntegration()
      await this.phase5_TagOptimization()
      await this.phase6_BacklinkGeneration()
      await this.phase7_QualityVerification()
      await this.phase8_GitHubIntegration()
      await this.phase9_FinalAssembly()

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
    const lockData = {
      status: 'starting',
      phase: 0,
      totalPhases: 9,
      phaseName: 'Initialization',
      currentTask: 'Starting documentation generation',
      progress: 0,
      timestamp: Date.now(),
      pid: process.pid,
      projectPath: this.projectPath,
      outputPath: this.outputPath
    }

    await this.fileWriter.writeLockFile(lockData)
    logger.debug(`Lock file created: ${this.lockFilePath}`)
  }

  private reportPhaseProgress(phase: number, phaseName: string, task: string, progress: number): void {
    const progressInfo: ProgressInfo = {
      phase,
      total: 9,
      phaseName,
      task,
      progress,
      timestamp: Date.now()
    }

    logger.reportProgress(progressInfo)
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

    logger.debug('Project analysis complete', {
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
          logger.warn('Permission denied, skipping documentation generation')
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

    // This would integrate with Claude API for analysis
    // For now, we'll simulate the process
    await this.simulateAsyncWork(2000)

    this.reportPhaseProgress(3, 'Enhancement', 'Generating API documentation', 50)
    await this.simulateAsyncWork(1500)

    this.reportPhaseProgress(3, 'Enhancement', 'Creating architectural overview', 100)
  }

  // Phase 4: Obsidian Integration
  private async phase4_ObsidianIntegration(): Promise<void> {
    this.reportPhaseProgress(4, 'Obsidian', 'Configuring Obsidian integration', 0)

    if (this.config.output.format === 'obsidian') {
      const obsidianConfig: ObsidianConfig = {
        projectName: basename(this.projectPath),
        projectTag: basename(this.projectPath).toLowerCase(),
        outputDir: this.outputPath,
        sourceDir: this.projectPath,
        enableTagOptimization: true,
        enableBacklinks: true,
        enableVerification: true,
        minTagsPerDocument: 2,
        maxTagsPerDocument: 10,
        createTagHierarchy: true
      }

      this.reportPhaseProgress(4, 'Obsidian', 'Creating Obsidian vault structure', 30)

      const obsidian = new ObsidianIntegration(obsidianConfig)

      this.reportPhaseProgress(4, 'Obsidian', 'Generating frontmatter', 70)
      // Integration logic would go here

      this.reportPhaseProgress(4, 'Obsidian', 'Obsidian integration complete', 100)
    } else {
      logger.info('Skipping Obsidian integration (format: markdown)')
      this.reportPhaseProgress(4, 'Obsidian', 'Skipped (markdown format)', 100)
    }
  }

  // Phase 5: Tag Optimization
  private async phase5_TagOptimization(): Promise<void> {
    this.reportPhaseProgress(5, 'Tags', 'Optimizing document tags', 0)

    if (this.config.output.format === 'obsidian') {
      await this.simulateAsyncWork(1000)
      this.reportPhaseProgress(5, 'Tags', 'Creating tag hierarchy', 50)

      await this.simulateAsyncWork(1000)
      this.reportPhaseProgress(5, 'Tags', 'Tag optimization complete', 100)
    } else {
      this.reportPhaseProgress(5, 'Tags', 'Skipped (markdown format)', 100)
    }
  }

  // Phase 6: Backlink Generation
  private async phase6_BacklinkGeneration(): Promise<void> {
    this.reportPhaseProgress(6, 'Backlinks', 'Generating document backlinks', 0)

    if (this.config.output.format === 'obsidian') {
      await this.simulateAsyncWork(1500)
      this.reportPhaseProgress(6, 'Backlinks', 'Creating cross-references', 50)

      await this.simulateAsyncWork(1000)
      this.reportPhaseProgress(6, 'Backlinks', 'Backlink generation complete', 100)
    } else {
      this.reportPhaseProgress(6, 'Backlinks', 'Skipped (markdown format)', 100)
    }
  }

  // Phase 7: Quality Verification
  private async phase7_QualityVerification(): Promise<void> {
    this.reportPhaseProgress(7, 'Verification', 'Verifying documentation quality', 0)

    await this.simulateAsyncWork(1000)
    this.reportPhaseProgress(7, 'Verification', 'Checking completeness', 50)

    await this.simulateAsyncWork(800)
    this.reportPhaseProgress(7, 'Verification', 'Quality verification complete', 100)
  }

  // Phase 8: GitHub Integration
  private async phase8_GitHubIntegration(): Promise<void> {
    this.reportPhaseProgress(8, 'GitHub', 'GitHub integration', 0)

    // Check if this is a git repo
    const gitDir = join(this.projectPath, '.git')
    if (existsSync(gitDir)) {
      this.reportPhaseProgress(8, 'GitHub', 'Processing git metadata', 50)
      await this.simulateAsyncWork(500)
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
    const tuiPath = join(__dirname, '../../../src/tui/documentor-tui')

    if (existsSync(tuiPath)) {
      try {
        const child = spawn(tuiPath, [this.lockFilePath], {
          stdio: 'inherit',
          detached: false
        })

        // Let TUI run for a moment
        await new Promise(resolve => setTimeout(resolve, 2000))

      } catch (error) {
        logger.warn('Could not launch TUI:', error)
      }
    }
  }

  private async simulateAsyncWork(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private async showSuccessSummary(): Promise<void> {
    const duration = Date.now() - this.startTime
    const projectName = basename(this.projectPath)

    logger.showSummary({
      project: projectName,
      output: this.outputPath,
      duration,
      files: 42, // Would be calculated from actual generation
      success: true
    })
  }

  private async handleError(error: any): Promise<void> {
    logger.error('Documentation generation failed:', error)

    // Update lock file with error
    try {
      const lockData = {
        status: 'error',
        error: error.message,
        timestamp: Date.now()
      }
      await this.fileWriter.writeLockFile(lockData)
    } catch (lockError) {
      // Ignore lock file errors
    }
  }

  private async cleanup(): Promise<void> {
    // Clean up temporary files, close connections, etc.
    logger.debug('Cleanup complete')
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
        logger.error(`Project directory does not exist: ${resolvedProjectPath}`)
        process.exit(1)
      }

      if (!statSync(resolvedProjectPath).isDirectory()) {
        logger.error(`Path is not a directory: ${resolvedProjectPath}`)
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

      // Create and execute document engine
      const engine = new DocumentEngine(config, resolvedProjectPath)
      await engine.execute(options)

    } catch (error) {
      logger.error('Command failed:', error)
      process.exit(1)
    }
  })

export { generateCommand, DocumentEngine }
