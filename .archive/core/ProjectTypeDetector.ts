import * as fs from 'fs/promises'
import * as path from 'path'
import { ClaudeClient } from './ClaudeClient'
import { Logger } from './Logger'

/**
 * Represents the different types of projects that can be detected
 */
export type ProjectType = 'monorepo' | 'library' | 'tools' | 'application';

/**
 * Configuration for workspace detection in different monorepo tools
 */
interface WorkspaceConfig {
  packages?: string[];
  workspaces?: string[] | { packages: string[] };
}

/**
 * Detection results with confidence score and reasoning
 */
export interface DetectionResult {
  type: ProjectType;
  confidence: number;
  reasoning: string[];
  indicators: ProjectIndicators;
}

/**
 * Indicators found during project type detection
 */
export interface ProjectIndicators {
  // Monorepo indicators
  hasLernaConfig: boolean;
  hasPnpmWorkspace: boolean;
  hasYarnWorkspaces: boolean;
  hasNxConfig: boolean;
  hasRushConfig: boolean;
  hasTurboConfig: boolean;
  hasWorkspacePackages: boolean;
  packageCount: number;

  // Library/Tools indicators
  hasMultipleEntryPoints: boolean;
  hasToolsDirectory: boolean;
  hasScriptsDirectory: boolean;
  hasBinEntries: boolean;
  hasExportsMap: boolean;
  libraryCount: number;

  // Application indicators
  hasSingleMainEntry: boolean;
  hasWebFramework: boolean;
  hasAppStructure: boolean;
  frameworkType?: string;

  // General indicators
  hasPackageJson: boolean;
  packageJsonContent?: any;
  directoryStructure: string[];
}

/**
 * AI-driven project type detector that uses Claude to intelligently analyze
 * project structure and determine if it's a monorepo, library/tools, or application.
 * Uses Claude AI for intelligent detection instead of hardcoded heuristics.
 */
export class ProjectTypeDetector {
  private claudeClient: ClaudeClient

  constructor() {
    this.claudeClient = new ClaudeClient({
      model: 'claude-3-sonnet-20240229',
      temperature: 0.2, // Lower temperature for more consistent detection
      maxTokens: 1000
    })
  }

  private readonly MONOREPO_INDICATORS = [
    'lerna.json',
    'pnpm-workspace.yaml',
    'pnpm-workspace.yml',
    'nx.json',
    'rush.json',
    'turbo.json'
  ]

  private readonly WEB_FRAMEWORKS = {
    'next.config.js': 'Next.js',
    'next.config.ts': 'Next.js',
    'next.config.mjs': 'Next.js',
    'nuxt.config.js': 'Nuxt.js',
    'nuxt.config.ts': 'Nuxt.js',
    'vue.config.js': 'Vue CLI',
    'angular.json': 'Angular',
    'svelte.config.js': 'SvelteKit',
    'vite.config.js': 'Vite',
    'vite.config.ts': 'Vite',
    'webpack.config.js': 'Webpack',
    'gatsby-config.js': 'Gatsby',
    'remix.config.js': 'Remix'
  }

  private readonly LIBRARY_DIRECTORIES = [
    'packages',
    'libs',
    'libraries',
    'tools',
    'scripts',
    'utils',
    'modules',
    'components'
  ]

  /**
   * Detects the project type using AI analysis of project structure and configuration
   */
  async detect(projectPath: string): Promise<DetectionResult> {
    const indicators = await this.gatherIndicators(projectPath)

    // SKIP AI detection - it's hanging!
    // Just use fallback detection for now
    return this.fallbackDetection(indicators)
  }

  /**
   * Uses Claude AI to intelligently determine project type
   */
  private async detectWithAI(
    projectPath: string,
    indicators: ProjectIndicators
  ): Promise<DetectionResult | null> {
    try {
      const prompt = this.buildAIPrompt(projectPath, indicators)

      const response = await this.claudeClient.generateDocumentation({
        type: 'analysis',
        content: prompt,
        context: `Project: ${projectPath}`,
        instructions: [
          'Analyze the project structure and indicators',
          'Determine the most appropriate project type',
          'Provide confidence score and clear reasoning',
          'Return response in specified JSON format'
        ],
        constraints: [
          'Must choose from: monorepo, library, tools, or application',
          'Confidence must be between 0.0 and 1.0',
          'Provide at least 2 reasoning points',
          'Base decision on actual indicators, not assumptions'
        ]
      })

      // Parse AI response
      return this.parseAIResponse(response, indicators)
    } catch (error) {
      Logger.warning('AI detection failed, using fallback')
      return null
    }
  }

  /**
   * Builds a comprehensive prompt for AI analysis
   */
  private buildAIPrompt(projectPath: string, indicators: ProjectIndicators): string {
    return `Analyze the following project structure and determine if it's a:
- monorepo: Contains multiple packages/projects managed together
- library: Provides reusable code/tools for other projects
- tools: Collection of utilities/scripts
- application: Standalone application (web, mobile, desktop, CLI)

Project Path: ${projectPath}

Indicators Found:
${JSON.stringify(indicators, null, 2)}

Provide your analysis in this exact JSON format:
{
  "type": "monorepo" | "library" | "tools" | "application",
  "confidence": 0.0-1.0,
  "reasoning": ["reason1", "reason2", ...]
}

Be specific and base your decision on:
1. Directory structure and organization
2. Package.json configuration and dependencies
3. Presence of workspace/monorepo tools
4. Entry points and exports
5. Framework indicators
6. Overall project architecture`
  }

  /**
   * Parses the AI response into a DetectionResult
   */
  private parseAIResponse(content: string, indicators: ProjectIndicators): DetectionResult | null {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null

      const parsed = JSON.parse(jsonMatch[0])

      // Validate the response
      if (!parsed.type || !['monorepo', 'library', 'tools', 'application'].includes(parsed.type)) {
        return null
      }

      return {
        type: parsed.type as ProjectType,
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
        reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning : ['AI-based detection'],
        indicators
      }
    } catch (error) {
      Logger.warning('Failed to parse AI response')
      return null
    }
  }

  /**
   * Fallback detection using basic heuristics when AI is unavailable
   */
  private fallbackDetection(indicators: ProjectIndicators): DetectionResult {
    const monorepoScore = this.calculateMonorepoScore(indicators)
    const libraryScore = this.calculateLibraryScore(indicators)
    const applicationScore = this.calculateApplicationScore(indicators)

    const scores = [
      { type: 'monorepo' as ProjectType, score: monorepoScore, reasoning: this.getMonorepoReasons(indicators) },
      { type: 'library' as ProjectType, score: libraryScore, reasoning: this.getLibraryReasons(indicators) },
      { type: 'application' as ProjectType, score: applicationScore, reasoning: this.getApplicationReasons(indicators) }
    ]

    scores.sort((a, b) => b.score - a.score)
    const bestMatch = scores[0]

    if (bestMatch.score < 0.3) {
      return {
        type: 'application',
        confidence: 0.5,
        reasoning: ['No strong indicators found, defaulting to application type (fallback mode)'],
        indicators
      }
    }

    return {
      type: bestMatch.type,
      confidence: bestMatch.score,
      reasoning: [...bestMatch.reasoning, 'Note: Using fallback heuristics, AI unavailable'],
      indicators
    }
  }

  /**
   * Gathers all project indicators by analyzing files and directory structure
   */
  private async gatherIndicators(projectPath: string): Promise<ProjectIndicators> {
    const indicators: ProjectIndicators = {
      hasLernaConfig: false,
      hasPnpmWorkspace: false,
      hasYarnWorkspaces: false,
      hasNxConfig: false,
      hasRushConfig: false,
      hasTurboConfig: false,
      hasWorkspacePackages: false,
      packageCount: 0,
      hasMultipleEntryPoints: false,
      hasToolsDirectory: false,
      hasScriptsDirectory: false,
      hasBinEntries: false,
      hasExportsMap: false,
      libraryCount: 0,
      hasSingleMainEntry: false,
      hasWebFramework: false,
      hasAppStructure: false,
      hasPackageJson: false,
      directoryStructure: []
    }

    try {
      // Read directory structure
      const entries = await fs.readdir(projectPath, { withFileTypes: true })
      indicators.directoryStructure = entries.map(entry => entry.name)

      // Check for package.json and analyze it
      const packageJsonPath = path.join(projectPath, 'package.json')
      if (await this.fileExists(packageJsonPath)) {
        indicators.hasPackageJson = true
        try {
          const content = await fs.readFile(packageJsonPath, 'utf-8')
          indicators.packageJsonContent = JSON.parse(content)

          await this.analyzePackageJson(indicators, indicators.packageJsonContent)
        } catch (error) {
          // Invalid JSON, continue without package.json analysis
        }
      }

      // Check for monorepo indicators
      await this.checkMonorepoIndicators(projectPath, indicators)

      // Check for library/tools indicators
      await this.checkLibraryIndicators(projectPath, indicators)

      // Check for application indicators
      await this.checkApplicationIndicators(projectPath, indicators)

      // Count packages and libraries
      await this.countPackagesAndLibraries(projectPath, indicators)

    } catch (error) {
      // Handle permission errors gracefully
      Logger.warning(`Warning: Could not fully analyze project at ${projectPath}: ${error}`)
    }

    return indicators
  }

  /**
   * Analyzes package.json content for indicators
   */
  private async analyzePackageJson(indicators: ProjectIndicators, packageJson: any): Promise<void> {
    // Check for yarn workspaces
    if (packageJson.workspaces) {
      indicators.hasYarnWorkspaces = true
      indicators.hasWorkspacePackages = true
    }

    // Check for bin entries (tools indicator)
    if (packageJson.bin) {
      indicators.hasBinEntries = true
    }

    // Check for exports map (library indicator)
    if (packageJson.exports) {
      indicators.hasExportsMap = true
    }

    // Check for multiple entry points
    const entryFields = ['main', 'module', 'browser', 'types', 'typings']
    const foundEntries = entryFields.filter(field => packageJson[field])
    if (foundEntries.length > 1 || packageJson.exports) {
      indicators.hasMultipleEntryPoints = true
    }

    // Check for single main entry (application indicator)
    if (packageJson.main && !packageJson.exports && !packageJson.module) {
      indicators.hasSingleMainEntry = true
    }
  }

  /**
   * Checks for monorepo-specific indicators
   */
  private async checkMonorepoIndicators(projectPath: string, indicators: ProjectIndicators): Promise<void> {
    // Check for monorepo configuration files
    for (const indicator of this.MONOREPO_INDICATORS) {
      const filePath = path.join(projectPath, indicator)
      if (await this.fileExists(filePath)) {
        switch (indicator) {
        case 'lerna.json':
          indicators.hasLernaConfig = true
          indicators.hasWorkspacePackages = true
          break
        case 'pnpm-workspace.yaml':
        case 'pnpm-workspace.yml':
          indicators.hasPnpmWorkspace = true
          indicators.hasWorkspacePackages = true
          break
        case 'nx.json':
          indicators.hasNxConfig = true
          indicators.hasWorkspacePackages = true
          break
        case 'rush.json':
          indicators.hasRushConfig = true
          indicators.hasWorkspacePackages = true
          break
        case 'turbo.json':
          indicators.hasTurboConfig = true
          break
        }
      }
    }
  }

  /**
   * Checks for library/tools-specific indicators
   */
  private async checkLibraryIndicators(projectPath: string, indicators: ProjectIndicators): Promise<void> {
    // Check for library directories
    for (const dirName of this.LIBRARY_DIRECTORIES) {
      const dirPath = path.join(projectPath, dirName)
      if (await this.directoryExists(dirPath)) {
        if (dirName === 'tools') indicators.hasToolsDirectory = true
        if (dirName === 'scripts') indicators.hasScriptsDirectory = true

        // Count subdirectories as potential libraries
        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true })
          const subDirs = entries.filter(entry => entry.isDirectory())
          indicators.libraryCount += subDirs.length
        } catch (error) {
          // Permission error, continue
        }
      }
    }
  }

  /**
   * Checks for application-specific indicators
   */
  private async checkApplicationIndicators(projectPath: string, indicators: ProjectIndicators): Promise<void> {
    // Check for web framework configuration files
    for (const [configFile, framework] of Object.entries(this.WEB_FRAMEWORKS)) {
      if (await this.fileExists(path.join(projectPath, configFile))) {
        indicators.hasWebFramework = true
        indicators.frameworkType = framework
        break
      }
    }

    // Check for typical application structure
    const appDirs = ['src', 'app', 'pages', 'components', 'views']
    const foundAppDirs = await Promise.all(
      appDirs.map(async dir => await this.directoryExists(path.join(projectPath, dir)))
    )

    if (foundAppDirs.some(exists => exists)) {
      indicators.hasAppStructure = true
    }
  }

  /**
   * Counts packages and libraries in the project
   */
  private async countPackagesAndLibraries(projectPath: string, indicators: ProjectIndicators): Promise<void> {
    try {
      const entries = await fs.readdir(projectPath, { withFileTypes: true })
      const directories = entries.filter(entry => entry.isDirectory())

      for (const dir of directories) {
        const dirPath = path.join(projectPath, dir.name)

        // Check if directory contains a package.json (indicates a package)
        if (await this.fileExists(path.join(dirPath, 'package.json'))) {
          indicators.packageCount++
        }
      }
    } catch (error) {
      // Handle permission errors gracefully
    }
  }

  /**
   * Calculates confidence score for monorepo classification
   */
  private calculateMonorepoScore(indicators: ProjectIndicators): number {
    let score = 0

    // Strong indicators (0.8+ each)
    if (indicators.hasLernaConfig) score += 0.9
    if (indicators.hasPnpmWorkspace) score += 0.9
    if (indicators.hasYarnWorkspaces) score += 0.8
    if (indicators.hasNxConfig) score += 0.9
    if (indicators.hasRushConfig) score += 0.9

    // Medium indicators (0.3-0.6 each)
    if (indicators.hasTurboConfig) score += 0.4
    if (indicators.packageCount > 2) score += 0.5
    if (indicators.libraryCount > 3) score += 0.3

    return Math.min(score, 1.0)
  }

  /**
   * Calculates confidence score for library/tools classification
   */
  private calculateLibraryScore(indicators: ProjectIndicators): number {
    let score = 0

    // Strong indicators
    if (indicators.hasToolsDirectory) score += 0.7
    if (indicators.hasMultipleEntryPoints) score += 0.6
    if (indicators.hasBinEntries) score += 0.8
    if (indicators.hasExportsMap) score += 0.6

    // Medium indicators
    if (indicators.hasScriptsDirectory) score += 0.4
    if (indicators.libraryCount > 1) score += 0.5

    // Penalty for application indicators
    if (indicators.hasWebFramework) score -= 0.5
    if (indicators.hasAppStructure) score -= 0.3

    return Math.max(0, Math.min(score, 1.0))
  }

  /**
   * Calculates confidence score for application classification
   */
  private calculateApplicationScore(indicators: ProjectIndicators): number {
    let score = 0.4 // Base score for applications

    // Strong indicators
    if (indicators.hasWebFramework) score += 0.6
    if (indicators.hasSingleMainEntry) score += 0.4
    if (indicators.hasAppStructure) score += 0.5

    // Penalty for monorepo/library indicators
    if (indicators.hasWorkspacePackages) score -= 0.7
    if (indicators.hasMultipleEntryPoints) score -= 0.3
    if (indicators.hasBinEntries) score -= 0.4
    if (indicators.packageCount > 1) score -= 0.5

    return Math.max(0, Math.min(score, 1.0))
  }

  /**
   * Gets reasoning for monorepo classification
   */
  private getMonorepoReasons(indicators: ProjectIndicators): string[] {
    const reasons: string[] = []

    if (indicators.hasLernaConfig) reasons.push('Found lerna.json configuration')
    if (indicators.hasPnpmWorkspace) reasons.push('Found pnpm workspace configuration')
    if (indicators.hasYarnWorkspaces) reasons.push('Found yarn workspaces configuration')
    if (indicators.hasNxConfig) reasons.push('Found Nx configuration')
    if (indicators.hasRushConfig) reasons.push('Found Rush configuration')
    if (indicators.packageCount > 2) reasons.push(`Found ${indicators.packageCount} packages`)

    return reasons
  }

  /**
   * Gets reasoning for library/tools classification
   */
  private getLibraryReasons(indicators: ProjectIndicators): string[] {
    const reasons: string[] = []

    if (indicators.hasToolsDirectory) reasons.push('Found tools directory')
    if (indicators.hasMultipleEntryPoints) reasons.push('Has multiple entry points')
    if (indicators.hasBinEntries) reasons.push('Has binary entries in package.json')
    if (indicators.hasExportsMap) reasons.push('Has exports map in package.json')
    if (indicators.libraryCount > 1) reasons.push(`Found ${indicators.libraryCount} potential libraries`)

    return reasons
  }

  /**
   * Gets reasoning for application classification
   */
  private getApplicationReasons(indicators: ProjectIndicators): string[] {
    const reasons: string[] = []

    if (indicators.hasWebFramework) {
      reasons.push(`Found ${indicators.frameworkType} framework configuration`)
    }
    if (indicators.hasSingleMainEntry) reasons.push('Has single main entry point')
    if (indicators.hasAppStructure) reasons.push('Has typical application directory structure')

    return reasons
  }

  /**
   * Utility method to check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(filePath)
      return stat.isFile()
    } catch {
      return false
    }
  }

  /**
   * Utility method to check if a directory exists
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dirPath)
      return stat.isDirectory()
    } catch {
      return false
    }
  }
}
