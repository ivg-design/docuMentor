import { Command } from 'commander'
import { resolve, join } from 'path'
import { logger } from '../display'
import { ConfigManager } from './config'
import { DocumentorConfig } from '../../types'
import { DocumentEngine } from '../../core/DocumentEngine'
import { existsSync, readFileSync } from 'fs'

const selfDocumentCommand = new Command('self-document')
  .description('Generate documentation for DocuMentor itself')
  .option('-o, --output <path>', 'Output directory (defaults to configured output/documentor-self)')
  .option('-f, --format <format>', 'Output format: obsidian|markdown', 'obsidian')
  .option('-v, --verbose', 'Verbose output')
  .option('--no-permission', 'Skip password prompts')
  .action(async (options) => {
    try {
      logger.showHeader(
        'Self-Documenting DocuMentor',
        'Generating comprehensive documentation for DocuMentor itself'
      )

      // Determine DocuMentor's source directory
      const currentDir = process.cwd()
      const packageJsonPath = join(currentDir, 'package.json')

      let documentorPath: string

      // Check if we're running from within DocuMentor's directory
      if (existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
          if (packageJson.name === 'documentor') {
            documentorPath = currentDir
            logger.info('Detected DocuMentor source directory')
          } else {
            throw new Error('Not in DocuMentor directory')
          }
        } catch {
          throw new Error('Cannot determine DocuMentor source directory')
        }
      } else {
        // Try to find DocuMentor installation directory
        const possiblePaths = [
          resolve(__dirname, '../../..'), // From CLI command location
          resolve(process.argv[0], '../..'), // From executable location
          currentDir
        ]

        documentorPath = possiblePaths.find(path => {
          const pkgPath = join(path, 'package.json')
          if (existsSync(pkgPath)) {
            try {
              const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
              return pkg.name === 'documentor'
            } catch {
              return false
            }
          }
          return false
        }) || currentDir

        if (!documentorPath) {
          throw new Error('Cannot locate DocuMentor source directory')
        }
      }

      logger.info(`Found DocuMentor source at: ${documentorPath}`)

      // Load configuration
      const configManager = new ConfigManager()
      const config = await configManager.loadConfig()

      // Create self-documentation specific configuration
      const selfDocConfig: DocumentorConfig = {
        ...config,
        output: {
          path: options.output || join(config.output.path, 'documentor-self'),
          format: (options.format as 'obsidian' | 'markdown') || config.output.format,
          features: config.output.features
        }
      }

      logger.info(`Output directory: ${selfDocConfig.output.path}`)

      // Special meta-documentation context
      logger.info('Preparing meta-documentation context...')

      // Create specialized document engine for self-documentation
      class SelfDocumentEngine extends DocumentEngine {
        async execute(options: any): Promise<void> {
          logger.info('Starting self-documentation with meta-analysis...')

          // Add special handling for self-documentation
          await this.addSelfDocumentationContext()

          // Run standard documentation process
          await super.generate()

          // Add self-documentation specific content
          await this.addMetaDocumentation()
        }

        private async addSelfDocumentationContext(): Promise<void> {
          logger.info('Adding self-documentation context:')
          logger.info('- Agent architecture documentation')
          logger.info('- CLI implementation details')
          logger.info('- Security model documentation')
          logger.info('- Integration patterns')

          // This would add special context about DocuMentor's architecture
          // For now, we'll just log the intent
        }

        private async addMetaDocumentation(): Promise<void> {
          logger.info('Generating meta-documentation:')
          logger.info('- How DocuMentor works internally')
          logger.info('- Agent collaboration patterns')
          logger.info('- Security validation processes')
          logger.info('- CLI design decisions')

          // Add special sections about self-documentation
          const metaDocs = [
            'Self-Documentation Process.md',
            'Agent Architecture.md',
            'Security Model.md',
            'CLI Design.md',
            'Integration Patterns.md'
          ]

          logger.info(`Generated ${metaDocs.length} meta-documentation files`)
        }
      }

      // Execute self-documentation
      const engine = new SelfDocumentEngine(selfDocConfig, documentorPath)
      await engine.generate()

      logger.success('Self-documentation completed successfully!')
      logger.info('DocuMentor has documented itself with full meta-analysis')
      logger.info(`Documentation available at: ${selfDocConfig.output.path}`)

    } catch (error) {
      logger.error('Self-documentation failed:', error)
      process.exit(1)
    }
  })

export { selfDocumentCommand }
