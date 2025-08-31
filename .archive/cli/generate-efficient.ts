/**
 * Efficient Generate Command
 * Uses the new parallel processing architecture
 */

import { Command } from 'commander'
import { resolve, basename } from 'path'
import { existsSync, statSync } from 'fs'
import { ConfigManager } from './config'
import { DocumentorConfig } from '../../types'
import { DocumentProcessor } from '../../core/efficient/DocumentProcessor'
import { tuiAdapter } from '../../core/TUIAdapter'
import { Logger } from '../../core/Logger'
import { LockFileManager } from '../../core/LockFileManager'
import { expandPath } from '../../utils/paths'

interface GenerateOptions {
  output?: string
  format?: 'obsidian' | 'markdown'
  verbose?: boolean
  workers?: string
}

/**
 * Efficient generation command using new architecture
 */
const generateEfficientCommand = new Command('generate')
  .description('Generate comprehensive documentation for a project (efficient mode)')
  .argument('<project>', 'Path to project directory')
  .option('-o, --output <path>', 'Output directory (overrides config)')
  .option('-f, --format <format>', 'Output format: obsidian|markdown', 'obsidian')
  .option('-v, --verbose', 'Verbose output')
  .option('-w, --workers <count>', 'Number of parallel workers', '4')
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

      // Initialize TUI
      tuiAdapter.start(resolvedProjectPath)

      // Get project name
      const projectName = basename(resolvedProjectPath)
      const outputPath = expandPath(config.output.path)

      // Send initial messages
      tuiAdapter.log('info', `🚀 Starting efficient documentation generation`)
      tuiAdapter.log('info', `📁 Project: ${projectName}`)
      tuiAdapter.log('info', `📝 Output: ${outputPath}`)

      // Initialize lock file
      const lockManager = LockFileManager.getInstance(resolvedProjectPath)
      await lockManager.create(resolvedProjectPath, outputPath)

      // Create and run the efficient processor
      const processor = new DocumentProcessor(config, resolvedProjectPath)
      
      // Override worker count if specified
      if (options.workers) {
        const workerCount = parseInt(options.workers, 10)
        if (workerCount > 0 && workerCount <= 10) {
          (processor as any).WORKER_COUNT = workerCount
          tuiAdapter.log('info', `🔧 Using ${workerCount} parallel workers`)
        }
      }

      // Start processing
      const startTime = Date.now()
      await processor.process()

      // Calculate duration
      const duration = Date.now() - startTime
      const seconds = Math.round(duration / 1000)

      // Success summary
      tuiAdapter.log('success', `✅ Documentation generated successfully!`)
      tuiAdapter.log('info', `⏱️  Duration: ${seconds}s`)
      tuiAdapter.log('info', `📂 Output directory: ${outputPath}`)

      // Mark lock file as complete
      await lockManager.complete()

      // Exit gracefully
      process.exit(0)

    } catch (error) {
      Logger.error(`Generation failed: ${(error as Error).message}`)
      tuiAdapter.log('error', `❌ ${(error as Error).message}`)
      
      // Mark lock file as failed
      const lockManager = LockFileManager.getInstance(resolve(projectPath))
      await lockManager.fail((error as Error).message)
      
      process.exit(1)
    }
  })

export { generateEfficientCommand }