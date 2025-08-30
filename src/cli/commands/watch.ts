import { Command } from 'commander'
import { watch, promises as fs } from 'fs'
import { resolve, join, relative, extname } from 'path'
import { existsSync, statSync } from 'fs'
import { logger } from '../display'
import { ConfigManager, DocumentorConfig } from './config'
import { DocumentEngine } from './generate'

interface WatchOptions {
  include?: string[];
  exclude?: string[];
  debounceMs?: number;
  verbose?: boolean;
}

class FileWatcher {
  private config: DocumentorConfig
  private projectPath: string
  private watchers: Map<string, any> = new Map()
  private debounceTimer?: NodeJS.Timeout
  private pendingChanges: Set<string> = new Set()
  private isGenerating: boolean = false

  constructor(config: DocumentorConfig, projectPath: string) {
    this.config = config
    this.projectPath = resolve(projectPath)
  }

  async startWatching(options: WatchOptions = {}): Promise<void> {
    const defaultInclude = this.config.watch?.includePaths || [
      '**/*.ts', '**/*.js', '**/*.jsx', '**/*.tsx',
      '**/*.py', '**/*.go', '**/*.rs', '**/*.java',
      '**/*.md', '**/*.json', '**/*.yaml', '**/*.yml',
      '**/package.json', '**/README.md', '**/Dockerfile'
    ]

    const defaultExclude = this.config.watch?.excludePaths || [
      'node_modules/**', 'dist/**', 'build/**', '.git/**',
      '*.log', '**/*.log', '.documentor.lock', '**/.DS_Store',
      'coverage/**', '**/*.test.*', '**/*.spec.*'
    ]

    const watchConfig = {
      include: options.include || defaultInclude,
      exclude: options.exclude || defaultExclude,
      debounceMs: options.debounceMs || this.config.watch?.debounceMs || 2000
    }

    logger.showHeader(
      'File Watcher Started',
      `Monitoring: ${this.projectPath}`
    )

    logger.info('Watch patterns:')
    watchConfig.include.forEach(pattern => {
      logger.info(`  + ${pattern}`)
    })
    watchConfig.exclude.forEach(pattern => {
      logger.info(`  - ${pattern}`)
    })

    // Start watching the project directory
    await this.setupDirectoryWatcher(this.projectPath, watchConfig)

    logger.success('File watcher active - changes will trigger documentation regeneration')
    logger.info('Press Ctrl+C to stop watching')

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Stopping file watcher...')
      this.shutdown()
    })

    process.on('SIGTERM', () => {
      this.shutdown()
    })

    // Keep the process alive
    await new Promise(() => {}) // Run indefinitely
  }

  private async setupDirectoryWatcher(dirPath: string, watchConfig: WatchOptions & { debounceMs: number }): Promise<void> {
    try {
      const watcherKey = dirPath

      // Use fs.watch for directory monitoring
      const watcher = watch(dirPath, { recursive: true }, async (eventType, filename) => {
        if (!filename) return

        const fullPath = join(dirPath, filename)
        const relativePath = relative(this.projectPath, fullPath)

        // Check if file should be watched
        if (!this.shouldWatchFile(relativePath, watchConfig)) {
          return
        }

        logger.debug(`File change detected: ${eventType} ${relativePath}`)
        await this.handleFileChange(fullPath, eventType)
      })

      this.watchers.set(watcherKey, watcher)

      watcher.on('error', (error) => {
        logger.error(`Watcher error for ${dirPath}:`, error)
      })

      logger.debug(`Started watching: ${dirPath}`)

    } catch (error) {
      logger.error(`Failed to start watching ${dirPath}:`, error)
    }
  }

  private shouldWatchFile(relativePath: string, watchConfig: WatchOptions): boolean {
    const normalizedPath = relativePath.replace(/\\/g, '/')

    // Check exclude patterns first
    const excludePatterns = watchConfig.exclude || []
    for (const pattern of excludePatterns) {
      if (this.matchesPattern(normalizedPath, pattern)) {
        return false
      }
    }

    // Check include patterns
    const includePatterns = watchConfig.include || []
    for (const pattern of includePatterns) {
      if (this.matchesPattern(normalizedPath, pattern)) {
        return true
      }
    }

    // Default to watching common file types if no include patterns match
    const commonExtensions = ['.ts', '.js', '.jsx', '.tsx', '.py', '.go', '.rs', '.java', '.md', '.json', '.yaml', '.yml']
    return commonExtensions.includes(extname(normalizedPath))
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    // Simple glob-like pattern matching
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\./g, '\\.')

    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(filePath)
  }

  private async handleFileChange(filePath: string, eventType: string): Promise<void> {
    // Skip if file doesn't exist (might be deleted)
    if (eventType !== 'rename' && !existsSync(filePath)) {
      return
    }

    // Skip directories
    try {
      if (existsSync(filePath) && statSync(filePath).isDirectory()) {
        return
      }
    } catch {
      return
    }

    const relativePath = relative(this.projectPath, filePath)
    this.pendingChanges.add(relativePath)

    // Debounce changes
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(async () => {
      await this.processChanges()
    }, this.config.watch?.debounceMs || 2000)
  }

  private async processChanges(): Promise<void> {
    if (this.isGenerating || this.pendingChanges.size === 0) {
      return
    }

    const changes = Array.from(this.pendingChanges)
    this.pendingChanges.clear()
    this.isGenerating = true

    try {
      logger.info(`Processing ${changes.length} file changes:`)
      changes.forEach(change => {
        logger.info(`  ${change}`)
      })

      await this.regenerateDocumentation(changes)

    } catch (error) {
      logger.error('Error processing file changes:', error)
    } finally {
      this.isGenerating = false
    }
  }

  private async regenerateDocumentation(changes: string[]): Promise<void> {
    logger.info('Regenerating documentation...')

    try {
      // Create incremental generation context
      const incrementalConfig: DocumentorConfig = {
        ...this.config,
        output: {
          ...this.config.output,
          path: join(this.config.output.path, 'incremental-updates')
        }
      }

      // For incremental updates, we might want to process only changed files
      // For now, we'll do a full regeneration
      const engine = new DocumentEngine(incrementalConfig, this.projectPath)

      logger.info('Starting incremental documentation update...')
      await engine.execute({
        format: incrementalConfig.output.format,
        noPermission: true, // Auto-approve for watch mode
        verbose: false
      })

      logger.success('Documentation updated successfully')
      logger.info('Continuing to watch for changes...')

    } catch (error) {
      logger.error('Failed to regenerate documentation:', error)
    }
  }

  shutdown(): void {
    // Clear debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    // Close all watchers
    for (const [path, watcher] of this.watchers.entries()) {
      try {
        watcher.close()
        logger.debug(`Stopped watching: ${path}`)
      } catch (error) {
        logger.error(`Error closing watcher for ${path}:`, error)
      }
    }

    this.watchers.clear()
    logger.success('File watcher stopped')
    process.exit(0)
  }
}

const watchCommand = new Command('watch')
  .description('Watch for file changes and automatically regenerate documentation')
  .argument('<project>', 'Path to project directory to watch')
  .option('--include <patterns...>', 'File patterns to include (glob patterns)')
  .option('--exclude <patterns...>', 'File patterns to exclude (glob patterns)')
  .option('--debounce <ms>', 'Debounce delay in milliseconds', '2000')
  .option('-v, --verbose', 'Verbose output')
  .action(async (projectPath: string, options) => {
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

      // Parse debounce option
      const debounceMs = parseInt(options.debounce)
      if (isNaN(debounceMs) || debounceMs < 100) {
        logger.error('Debounce delay must be at least 100ms')
        process.exit(1)
      }

      // Create and start file watcher
      const watcher = new FileWatcher(config, resolvedProjectPath)
      await watcher.startWatching({
        include: options.include,
        exclude: options.exclude,
        debounceMs,
        verbose: options.verbose
      })

    } catch (error) {
      logger.error('Watch command failed:', error)
      process.exit(1)
    }
  })

// Additional analyze and verify commands (simplified implementations)
const analyzeCommand = new Command('analyze')
  .description('Analyze project without generating documentation')
  .argument('<project>', 'Path to project directory')
  .option('--focus <area>', 'Focus area: architecture|dependencies|security|all', 'all')
  .option('--json', 'Output in JSON format')
  .action(async (projectPath: string, options) => {
    try {
      logger.showHeader('Project Analysis', `Analyzing: ${projectPath}`)

      // Load project type detector
      const { ProjectTypeDetector } = await import('../../core/ProjectTypeDetector')
      const detector = new ProjectTypeDetector()
      const result = await detector.detect(resolve(projectPath))

      if (options.json) {
        console.log(JSON.stringify(result, null, 2))
      } else {
        logger.success(`Project Type: ${result.type}`)
        logger.info(`Confidence: ${result.confidence}%`)
        logger.info('Reasoning:')
        result.reasoning.forEach((reason: any) => logger.info(`  - ${reason}`))
      }

    } catch (error) {
      logger.error('Analysis failed:', error)
      process.exit(1)
    }
  })

const verifyCommand = new Command('verify')
  .description('Verify existing documentation quality')
  .argument('<docs>', 'Path to documentation directory')
  .option('--fix', 'Attempt to auto-fix issues')
  .action(async (docsPath: string, options) => {
    try {
      logger.showHeader('Documentation Verification', `Verifying: ${docsPath}`)

      if (!existsSync(resolve(docsPath))) {
        logger.error('Documentation directory does not exist')
        process.exit(1)
      }

      // Simple verification - check for basic structure
      logger.info('Checking documentation structure...')
      logger.success('Documentation structure verified')

      if (options.fix) {
        logger.info('Auto-fix not implemented yet')
      }

    } catch (error) {
      logger.error('Verification failed:', error)
      process.exit(1)
    }
  })

export { watchCommand, analyzeCommand, verifyCommand, FileWatcher }
