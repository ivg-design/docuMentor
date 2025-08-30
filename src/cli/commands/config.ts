import { Command } from 'commander'
import { Logger } from '../../core/Logger'
import { promises as fs } from 'fs'
import { resolve, join, dirname } from 'path'
import { existsSync } from 'fs'
import { spawn } from 'child_process'
import { logger } from '../display'
import { Config, DocumentorConfig } from '../../types'
import { ConfigLoader } from '../../core/Config'
import { expandPath } from '../../utils/paths'

// Use the centralized default config and add CLI-specific defaults
const defaultConfig: DocumentorConfig = {
  ...ConfigLoader.DEFAULT_CONFIG,
  github: {
    defaultBranch: 'main'
  },
  watch: {
    includePaths: ['src/**/*', 'lib/**/*', '*.md', '*.json'],
    excludePaths: ['node_modules/**', 'dist/**', '.git/**', '*.log'],
    debounceMs: 2000
  }
}

class ConfigManager {
  private configPath: string

  constructor(configPath?: string) {
    this.configPath = configPath || join(process.cwd(), '.documentor', 'config.json')
  }

  // expandPath method removed - using utility function

  async ensureConfigDirectory(): Promise<void> {
    const dir = dirname(this.configPath)
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true })
    }
  }

  async loadConfig(): Promise<DocumentorConfig> {
    try {
      if (!existsSync(this.configPath)) {
        logger.debug(`Config file not found: ${this.configPath}`)
        return defaultConfig
      }

      const content = await fs.readFile(this.configPath, 'utf-8')
      const config = JSON.parse(content) as Partial<DocumentorConfig>

      // Merge with defaults
      const mergedConfig: DocumentorConfig = {
        ...defaultConfig,
        ...config,
        output: { ...defaultConfig.output, ...config.output },
        permissions: { ...defaultConfig.permissions, ...config.permissions },
        claude: { ...defaultConfig.claude, ...config.claude },
        github: config.github ? { ...defaultConfig.github, ...config.github } : defaultConfig.github,
        watch: config.watch ? { ...defaultConfig.watch, ...config.watch } : defaultConfig.watch
      }

      logger.debug(`Config loaded from: ${this.configPath}`)
      return mergedConfig
    } catch (error) {
      logger.error(`Failed to load config from ${this.configPath}:`, error)
      throw new Error(`Config loading failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async saveConfig(config: DocumentorConfig): Promise<void> {
    try {
      await this.ensureConfigDirectory()
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8')
      logger.success(`Config saved to: ${this.configPath}`)
    } catch (error) {
      logger.error(`Failed to save config to ${this.configPath}:`, error)
      throw new Error(`Config saving failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  getConfigPath(): string {
    return this.configPath
  }

  getExpandedOutputPath(config: DocumentorConfig): string {
    return resolve(expandPath(config.output.path))
  }
}

const configCommand = new Command('config')
  .description('Manage DocuMentor configuration')
  .option('--config <path>', 'Custom config file path')

// Initialize configuration
configCommand
  .command('init')
  .description('Initialize configuration file')
  .option('--output <path>', 'Documentation output path', '~/obsidian_vault/docs')
  .option('--format <format>', 'Output format (obsidian|markdown)', 'obsidian')
  .option('--overwrite', 'Overwrite existing config file')
  .action(async (options) => {
    try {
      const manager = new ConfigManager(configCommand.getOptionValue('config'))
      const configPath = manager.getConfigPath()

      if (existsSync(configPath) && !options.overwrite) {
        logger.warn(`Config file already exists: ${configPath}`)
        logger.info('Use --overwrite to replace existing config')
        return
      }

      const config: DocumentorConfig = {
        ...defaultConfig,
        output: {
          path: options.output,
          format: options.format as 'obsidian' | 'markdown',
          features: {
            frontmatter: true,
            backlinks: true,
            tags: { optimize: true, hierarchy: true, minPerDoc: 3 },
            moc: true,
            dataview: true
          }
        }
      }

      await manager.saveConfig(config)
      logger.showHeader('Configuration Initialized', `Config file: ${configPath}`)
      logger.info(`Output path: ${manager.getExpandedOutputPath(config)}`)
      logger.info(`Format: ${config.output.format}`)

    } catch (error) {
      logger.error('Failed to initialize configuration:', error)
      process.exit(1)
    }
  })

// Show current configuration
configCommand
  .command('show')
  .description('Show current configuration')
  .option('--expanded', 'Show expanded paths')
  .action(async (options) => {
    try {
      const manager = new ConfigManager(configCommand.getOptionValue('config'))
      const config = await manager.loadConfig()

      logger.showHeader('Current Configuration', `Config file: ${manager.getConfigPath()}`)

      if (options.expanded) {
        // Use Logger for all output
        Logger.info(`Output Path (expanded): ${manager.getExpandedOutputPath(config)}`)
        Logger.info(`Config Path: ${manager.getConfigPath()}`)
      }

      // For JSON output, write directly to stderr to avoid mixing with TUI protocol
      process.stderr.write(JSON.stringify(config, null, 2) + '\n')

    } catch (error) {
      logger.error('Failed to show configuration:', error)
      process.exit(1)
    }
  })

// Set configuration value
configCommand
  .command('set <key> <value>')
  .description('Set configuration value (e.g., output.path ~/my-docs)')
  .action(async (key: string, value: string) => {
    try {
      const manager = new ConfigManager(configCommand.getOptionValue('config'))
      const config = await manager.loadConfig()

      // Parse nested key (e.g., "output.path")
      const keys = key.split('.')
      let current: any = config

      for (let i = 0; i < keys.length - 1; i++) {
        if (!(keys[i] in current)) {
          current[keys[i]] = {}
        }
        current = current[keys[i]]
      }

      const lastKey = keys[keys.length - 1]

      // Type conversion
      let parsedValue: any = value
      if (value === 'true') parsedValue = true
      else if (value === 'false') parsedValue = false
      else if (!isNaN(Number(value))) parsedValue = Number(value)

      current[lastKey] = parsedValue

      await manager.saveConfig(config)
      logger.success(`Set ${key} = ${parsedValue}`)

      if (key === 'output.path') {
        logger.info(`Expanded path: ${manager.getExpandedOutputPath(config)}`)
      }

    } catch (error) {
      logger.error('Failed to set configuration:', error)
      process.exit(1)
    }
  })

// Edit configuration file
configCommand
  .command('edit')
  .description('Open configuration file in default editor')
  .action(async () => {
    try {
      const manager = new ConfigManager(configCommand.getOptionValue('config'))
      const configPath = manager.getConfigPath()

      // Ensure config exists
      if (!existsSync(configPath)) {
        logger.info('Config file does not exist. Creating default configuration...')
        await manager.saveConfig(defaultConfig)
      }

      // Try to open with default editor
      // spawn already imported at top
      const editor = process.env.EDITOR || process.env.VISUAL || 'nano'

      logger.info(`Opening config file with ${editor}: ${configPath}`)

      const child = spawn(editor, [configPath], {
        stdio: 'inherit'
      })

      child.on('exit', (code: number) => {
        if (code === 0) {
          logger.success('Configuration file updated')
        } else {
          logger.error(`Editor exited with code ${code}`)
        }
      })

    } catch (error) {
      logger.error('Failed to edit configuration:', error)
      process.exit(1)
    }
  })

// Validate configuration
configCommand
  .command('validate')
  .description('Validate configuration file')
  .action(async () => {
    try {
      const manager = new ConfigManager(configCommand.getOptionValue('config'))
      const config = await manager.loadConfig()

      logger.showHeader('Configuration Validation')

      let hasErrors = false

      // Validate output path
      const outputPath = manager.getExpandedOutputPath(config)
      try {
        await fs.access(dirname(outputPath))
        logger.success(`Output path accessible: ${outputPath}`)
      } catch {
        logger.error(`Output path not accessible: ${outputPath}`)
        hasErrors = true
      }

      // Validate format
      if (!['obsidian', 'markdown'].includes(config.output.format)) {
        logger.error(`Invalid output format: ${config.output.format}`)
        hasErrors = true
      } else {
        logger.success(`Output format valid: ${config.output.format}`)
      }

      // Validate Claude settings
      if (!config.claude.model) {
        logger.error('Claude model not specified')
        hasErrors = true
      } else {
        logger.success(`Claude model: ${config.claude.model}`)
      }

      if (config.claude.maxTokens < 1000 || config.claude.maxTokens > 200000) {
        logger.warn(`Claude maxTokens might be too low/high: ${config.claude.maxTokens}`)
      } else {
        logger.success(`Claude maxTokens: ${config.claude.maxTokens}`)
      }

      if (hasErrors) {
        logger.error('Configuration validation failed')
        process.exit(1)
      } else {
        logger.success('Configuration is valid')
      }

    } catch (error) {
      logger.error('Configuration validation failed:', error)
      process.exit(1)
    }
  })

export { configCommand, ConfigManager, defaultConfig }
export type { DocumentorConfig } from '../../types'
