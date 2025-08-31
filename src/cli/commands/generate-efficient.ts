/**
 * Generate Command - Efficient Implementation
 * Uses the new TUI-first architecture with 4-worker parallel processing
 */

import { Command } from 'commander'
import * as path from 'path'
import * as os from 'os'
import { DocumentProcessor } from '../../core/efficient/DocumentProcessor'

export const generateEfficientCommand = new Command('generate')
  .description('Generate documentation using efficient TUI-first architecture')
  .argument('<project>', 'Project directory to document')
  .option('-o, --output <path>', 'Output directory', '~/obsidian_vault/docs')
  .option('--workers <number>', 'Number of parallel workers', '4')
  .option('--no-tui', 'Disable TUI output')
  .option('--api-key <key>', 'Claude API key (or use CLAUDE_API_KEY env)')
  .action(async (projectPath: string, options) => {
    try {
      // Resolve paths
      projectPath = path.resolve(projectPath.replace('~', os.homedir()))
      const outputPath = path.resolve(
        options.output.replace('~', os.homedir()),
        path.basename(projectPath) + '_docs'
      )
      
      // Get API key
      const apiKey = options.apiKey || process.env.CLAUDE_API_KEY
      if (!apiKey) {
        console.error('Error: Claude API key not provided')
        console.error('Set CLAUDE_API_KEY environment variable or use --api-key option')
        process.exit(1)
      }
      
      // Log to stderr if in TUI mode (stdout is for JSON messages)
      const log = process.env.TUI_MODE === 'true' ? console.error : console.log
      
      log(`Documenting: ${projectPath}`)
      log(`Output: ${outputPath}`)
      log(`Workers: ${options.workers}`)
      log(`TUI: ${options.tui ? 'enabled' : 'disabled'}`)
      
      // Create processor
      const processor = new DocumentProcessor({
        projectPath,
        outputPath,
        workers: parseInt(options.workers),
        enableTUI: options.tui,
        claudeApiKey: apiKey,
        maxRetries: 3,
        batchSize: 10
      })
      
      // Process
      const stats = await processor.process()
      
      // Report results
      log('\n=== Processing Complete ===')
      log(`Total files: ${stats.totalFiles}`)
      log(`Processed: ${stats.processedFiles}`)
      log(`Failed: ${stats.failedFiles}`)
      log(`Time: ${((stats.endTime || Date.now()) - stats.startTime) / 1000}s`)
      
      if (stats.errors.length > 0) {
        log('\nErrors:')
        stats.errors.forEach(err => log(`  - ${err}`))
      }
      
      // Exit with appropriate code
      process.exit(stats.failedFiles > 0 ? 1 : 0)
      
    } catch (error) {
      console.error('Fatal error:', error)
      process.exit(1)
    }
  })

// Export for use in main CLI
export default generateEfficientCommand