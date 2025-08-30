// DocuMentor V3.1 - Configuration Loader
// Simple, flat configuration loading with sensible defaults
// Supports .documentor/config.json, environment variables, and path expansion

import { promises as fs, readFileSync } from 'fs'
import { join, resolve, basename } from 'path'
import { homedir } from 'os'
import { Config, Phase } from '../types/index.js'

// ============================================================================
// Configuration Loader Class
// ============================================================================

export class ConfigLoader {
  public static readonly DEFAULT_CONFIG: Config = {
    version: '3.1.0',
    project: {
      name: 'auto-detect',
      type: 'auto'
    },
    output: {
      path: '~/obsidian_vault/docs',
      format: 'obsidian',
      features: {
        frontmatter: true,
        backlinks: true,
        tags: {
          optimize: true,
          hierarchy: true,
          minPerDoc: 3
        },
        moc: true,
        dataview: true
      }
    },
    permissions: {
      requestPassword: true,
      skipOnDenial: true,
      importantPaths: ['src', 'lib', 'config', 'docs']
    },
    claude: {
      model: 'claude-3-opus',
      maxTokens: 100000,
      temperature: 0.3
    },
    phases: [
      'analysis',
      'generation',
      'enhancement',
      'formatting',
      'obsidian-integration',
      'tag-optimization',
      'backlink-generation',
      'verification',
      'save'
    ]
  }

  private static readonly CONFIG_FILE_NAME = 'config.json'
  private static readonly CONFIG_DIR_NAME = '.documentor'

  /**
   * Load configuration from multiple sources with precedence:
   * 1. Command line arguments (passed as overrides)
   * 2. Environment variables
   * 3. Project config file (.documentor/config.json)
   * 4. User global config (~/.documentor/config.json)
   * 5. Default configuration
   */
  static async load(
    projectPath?: string,
    overrides: Partial<Config> = {}
  ): Promise<Config> {
    let config = { ...ConfigLoader.DEFAULT_CONFIG }

    // 1. Load user global config
    const userConfig = await ConfigLoader.loadUserConfig()
    if (userConfig) {
      config = ConfigLoader.mergeConfigs(config, userConfig)
    }

    // 2. Load project config
    if (projectPath) {
      const projectConfig = await ConfigLoader.loadProjectConfig(projectPath)
      if (projectConfig) {
        config = ConfigLoader.mergeConfigs(config, projectConfig)
      }
    }

    // 3. Apply environment variables
    const envConfig = ConfigLoader.loadEnvironmentConfig()
    config = ConfigLoader.mergeConfigs(config, envConfig)

    // 4. Apply command line overrides
    config = ConfigLoader.mergeConfigs(config, overrides)

    // 5. Process configuration (path expansion, validation)
    config = await ConfigLoader.processConfig(config, projectPath)

    return config
  }

  /**
   * Load user global configuration from ~/.documentor/config.json
   */
  private static async loadUserConfig(): Promise<Partial<Config> | null> {
    try {
      const configPath = join(homedir(), ConfigLoader.CONFIG_DIR_NAME, ConfigLoader.CONFIG_FILE_NAME)
      return await ConfigLoader.loadConfigFromFile(configPath)
    } catch (error) {
      // User config is optional
      return null
    }
  }

  /**
   * Load project configuration from PROJECT_PATH/.documentor/config.json
   */
  private static async loadProjectConfig(projectPath: string): Promise<Partial<Config> | null> {
    try {
      const configPath = join(projectPath, ConfigLoader.CONFIG_DIR_NAME, ConfigLoader.CONFIG_FILE_NAME)
      return await ConfigLoader.loadConfigFromFile(configPath)
    } catch (error) {
      // Project config is optional
      return null
    }
  }

  /**
   * Load configuration from environment variables
   */
  private static loadEnvironmentConfig(): Partial<Config> {
    const envConfig: Partial<Config> = {}

    // Output path
    if (process.env.DOCUMENTOR_OUTPUT) {
      envConfig.output = {
        ...ConfigLoader.DEFAULT_CONFIG.output,
        path: process.env.DOCUMENTOR_OUTPUT
      }
    }

    // Output format
    if (process.env.DOCUMENTOR_FORMAT) {
      envConfig.output = {
        ...envConfig.output || ConfigLoader.DEFAULT_CONFIG.output,
        format: process.env.DOCUMENTOR_FORMAT as 'obsidian' | 'markdown'
      }
    }

    // Password handling
    if (process.env.DOCUMENTOR_NO_PASSWORD === 'true') {
      envConfig.permissions = {
        ...ConfigLoader.DEFAULT_CONFIG.permissions,
        requestPassword: false
      }
    }

    // Claude model
    if (process.env.CLAUDE_MODEL) {
      envConfig.claude = {
        ...ConfigLoader.DEFAULT_CONFIG.claude,
        model: process.env.CLAUDE_MODEL
      }
    }

    // Claude temperature
    if (process.env.CLAUDE_TEMPERATURE) {
      const temperature = parseFloat(process.env.CLAUDE_TEMPERATURE)
      if (!isNaN(temperature) && temperature >= 0 && temperature <= 1) {
        envConfig.claude = {
          ...envConfig.claude || ConfigLoader.DEFAULT_CONFIG.claude,
          temperature
        }
      }
    }

    // Debug mode affects configuration
    if (process.env.DOCUMENTOR_DEBUG === 'true') {
      // Enable verbose logging, disable optimizations for debugging
      envConfig.claude = {
        ...envConfig.claude || ConfigLoader.DEFAULT_CONFIG.claude,
        temperature: 0.1 // More deterministic output for debugging
      }
    }

    return envConfig
  }

  /**
   * Load configuration from a specific file path
   */
  private static async loadConfigFromFile(filePath: string): Promise<Partial<Config> | null> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const parsed = JSON.parse(fileContent)

      // Validate basic structure
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Configuration must be a JSON object')
      }

      return parsed as Partial<Config>
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null // File doesn't exist
      }
      throw new Error(`Failed to load config from ${filePath}: ${(error as Error).message}`)
    }
  }

  /**
   * Deep merge configuration objects
   */
  private static mergeConfigs(base: Config, override: Partial<Config>): Config {
    const result = { ...base }

    for (const [key, value] of Object.entries(override)) {
      if (value === null || value === undefined) {
        continue
      }

      if (typeof value === 'object' && !Array.isArray(value) && key in base) {
        // Deep merge objects
        result[key as keyof Config] = {
          ...base[key as keyof Config] as any,
          ...value
        }
      } else {
        // Direct assignment for primitives and arrays
        result[key as keyof Config] = value as any
      }
    }

    return result
  }

  /**
   * Process configuration after loading (path expansion, validation)
   */
  private static async processConfig(config: Config, projectPath?: string): Promise<Config> {
    // Expand paths
    config.output.path = ConfigLoader.expandPath(config.output.path)

    // Auto-detect project name if needed
    if (config.project.name === 'auto-detect' && projectPath) {
      const projectName = ConfigLoader.detectProjectName(projectPath)
      config.project.name = projectName
    }

    // Validate phases
    config.phases = ConfigLoader.validatePhases(config.phases)

    // Ensure output directory exists
    await ConfigLoader.ensureOutputDirectory(config.output.path)

    // Validate Claude configuration
    ConfigLoader.validateClaudeConfig(config.claude)

    return config
  }

  /**
   * Expand path with ~ and environment variables
   */
  private static expandPath(path: string): string {
    // Expand tilde
    if (path.startsWith('~/')) {
      path = join(homedir(), path.slice(2))
    }

    // Expand environment variables
    path = path.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
      return process.env[envVar] || match
    })

    path = path.replace(/\$([A-Z_][A-Z0-9_]*)/g, (match, envVar) => {
      return process.env[envVar] || match
    })

    return resolve(path)
  }

  /**
   * Auto-detect project name from path
   */
  private static detectProjectName(projectPath: string): string {
    try {
      // Try to get name from package.json
      const packageJsonPath = join(projectPath, 'package.json')
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      if (packageJson.name) {
        return packageJson.name
      }
    } catch {
      // Ignore package.json errors
    }

    // Fall back to directory name
    return basename(resolve(projectPath))
  }

  /**
   * Validate and normalize phases array
   */
  private static validatePhases(phases: Phase[]): Phase[] {
    const validPhases: Phase[] = [
      'analysis',
      'generation',
      'enhancement',
      'formatting',
      'obsidian-integration',
      'tag-optimization',
      'backlink-generation',
      'verification',
      'save'
    ]

    // Ensure all required phases are present and in correct order
    const normalizedPhases = validPhases.filter(phase => phases.includes(phase))

    if (normalizedPhases.length !== validPhases.length) {
      console.warn('Some phases were missing from configuration, using default phase order')
      return validPhases
    }

    return normalizedPhases
  }

  /**
   * Ensure output directory exists
   */
  private static async ensureOutputDirectory(outputPath: string): Promise<void> {
    try {
      await fs.mkdir(outputPath, { recursive: true })
    } catch (error) {
      throw new Error(`Failed to create output directory ${outputPath}: ${(error as Error).message}`)
    }
  }

  /**
   * Validate Claude configuration
   */
  private static validateClaudeConfig(claudeConfig: Config['claude']): void {
    // Validate temperature
    if (claudeConfig.temperature < 0 || claudeConfig.temperature > 1) {
      throw new Error('Claude temperature must be between 0 and 1')
    }

    // Validate max tokens
    if (claudeConfig.maxTokens < 1000 || claudeConfig.maxTokens > 200000) {
      throw new Error('Claude maxTokens must be between 1000 and 200000')
    }

    // Validate model
    const validModels = ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku']
    if (!validModels.includes(claudeConfig.model)) {
      console.warn(`Unknown Claude model: ${claudeConfig.model}. Proceeding anyway.`)
    }
  }

  // ============================================================================
  // Configuration Utilities
  // ============================================================================

  /**
   * Save configuration to project directory
   */
  static async saveProjectConfig(projectPath: string, config: Partial<Config>): Promise<void> {
    const configDir = join(projectPath, ConfigLoader.CONFIG_DIR_NAME)
    const configPath = join(configDir, ConfigLoader.CONFIG_FILE_NAME)

    try {
      await fs.mkdir(configDir, { recursive: true })
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
    } catch (error) {
      throw new Error(`Failed to save project config: ${(error as Error).message}`)
    }
  }

  /**
   * Save configuration to user global directory
   */
  static async saveUserConfig(config: Partial<Config>): Promise<void> {
    const configDir = join(homedir(), ConfigLoader.CONFIG_DIR_NAME)
    const configPath = join(configDir, ConfigLoader.CONFIG_FILE_NAME)

    try {
      await fs.mkdir(configDir, { recursive: true })
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
    } catch (error) {
      throw new Error(`Failed to save user config: ${(error as Error).message}`)
    }
  }

  /**
   * Initialize configuration in project directory
   */
  static async initializeProjectConfig(projectPath: string): Promise<Config> {
    const projectName = ConfigLoader.detectProjectName(projectPath)

    const initialConfig: Partial<Config> = {
      project: {
        name: projectName,
        type: 'auto'
      },
      output: {
        path: '~/obsidian_vault/docs',
        format: 'obsidian',
        features: ConfigLoader.DEFAULT_CONFIG.output.features
      }
    }

    await ConfigLoader.saveProjectConfig(projectPath, initialConfig)
    return await ConfigLoader.load(projectPath, initialConfig)
  }

  /**
   * Get configuration file paths for debugging
   */
  static getConfigPaths(projectPath?: string): {
    user: string
    project?: string
  } {
    const paths = {
      user: join(homedir(), ConfigLoader.CONFIG_DIR_NAME, ConfigLoader.CONFIG_FILE_NAME)
    }

    if (projectPath) {
      return {
        ...paths,
        project: join(projectPath, ConfigLoader.CONFIG_DIR_NAME, ConfigLoader.CONFIG_FILE_NAME)
      }
    }

    return paths
  }

  /**
   * Validate configuration object
   */
  static validateConfig(config: Config): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!config.project?.name) {
      errors.push('Project name is required')
    }

    if (!config.output?.path) {
      errors.push('Output path is required')
    }

    if (!['obsidian', 'markdown'].includes(config.output?.format)) {
      errors.push('Output format must be "obsidian" or "markdown"')
    }

    if (!Array.isArray(config.phases) || config.phases.length === 0) {
      errors.push('Phases array cannot be empty')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Load configuration with simplified interface
 */
export async function loadConfig(
  projectPath?: string,
  overrides?: Partial<Config>
): Promise<Config> {
  return ConfigLoader.load(projectPath, overrides)
}

/**
 * Initialize configuration for a new project
 */
export async function initializeConfig(projectPath: string): Promise<Config> {
  return ConfigLoader.initializeProjectConfig(projectPath)
}

/**
 * Get default configuration
 */
export function getDefaultConfig(): Config {
  return { ...ConfigLoader.DEFAULT_CONFIG }
}

// ============================================================================
// Export
// ============================================================================

export default ConfigLoader
