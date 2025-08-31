import * as path from 'path'
import * as fs from 'fs/promises'
import { ProjectTypeDetector, ProjectType, DetectionResult } from './ProjectTypeDetector'
import { FileScanner, ScannedFile, ScanStatistics, ScanOptions } from './FileScanner'

/**
 * Analyzed file with additional metadata and analysis
 */
export interface AnalyzedFile extends ScannedFile {
  isDocumentable: boolean;
  language?: string;
  framework?: string;
  category: FileCategory;
  importance: ImportanceLevel;
  dependencies?: string[];
  exports?: string[];
  complexity?: number;
}

/**
 * File categories for documentation organization
 */
export type FileCategory =
  | 'source'
  | 'test'
  | 'config'
  | 'documentation'
  | 'build'
  | 'asset'
  | 'dependency';

/**
 * Importance levels for prioritizing documentation
 */
export type ImportanceLevel = 'critical' | 'high' | 'medium' | 'low';

/**
 * Project metadata extracted during analysis
 */
export interface ProjectMetadata {
  name: string;
  version?: string;
  description?: string;
  author?: string;
  license?: string;
  repository?: string;
  homepage?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  main?: string;
  exports?: any;
  workspaces?: string[] | { packages: string[] };
  engines?: Record<string, string>;
}

/**
 * Documentation structure adapted to project type
 */
export interface DocumentationStructure {
  type: ProjectType;
  rootDir: string;
  sections: DocumentationSection[];
  navigationOrder: string[];
  specialFiles: Record<string, string>;
}

/**
 * Documentation section definition
 */
export interface DocumentationSection {
  name: string;
  path: string;
  files: string[];
  subsections?: DocumentationSection[];
  priority: number;
  template?: string;
}

/**
 * Complete project analysis results
 */
export interface ProjectAnalysis {
  projectPath: string;
  projectType: ProjectType;
  projectName: string;
  files: AnalyzedFile[];
  skippedFiles: string[];
  statistics: ScanStatistics;
  structure: DocumentationStructure;
  metadata: ProjectMetadata;
  detectionResult: DetectionResult;
  recommendations: string[];
  timestamp: Date;
}

/**
 * Analysis options for customizing behavior
 */
export interface AnalysisOptions extends ScanOptions {
  analyzeComplexity?: boolean;
  extractDependencies?: boolean;
  generateRecommendations?: boolean;
  customTemplates?: Record<ProjectType, string>;
}

/**
 * Main project analyzer that orchestrates type detection, file scanning,
 * and provides adaptive analysis based on detected project type
 */
export class ProjectAnalyzer {
  private readonly typeDetector: ProjectTypeDetector
  private readonly fileScanner: FileScanner

  private readonly LANGUAGE_EXTENSIONS: Record<string, string> = {
    '.js': 'JavaScript',
    '.mjs': 'JavaScript',
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript',
    '.jsx': 'JavaScript',
    '.py': 'Python',
    '.rb': 'Ruby',
    '.php': 'PHP',
    '.java': 'Java',
    '.c': 'C',
    '.cpp': 'C++',
    '.cc': 'C++',
    '.cxx': 'C++',
    '.cs': 'C#',
    '.go': 'Go',
    '.rs': 'Rust',
    '.swift': 'Swift',
    '.kt': 'Kotlin',
    '.scala': 'Scala',
    '.clj': 'Clojure',
    '.hs': 'Haskell',
    '.elm': 'Elm',
    '.dart': 'Dart',
    '.vue': 'Vue',
    '.svelte': 'Svelte'
  }

  private readonly TEST_PATTERNS = [
    /\.test\./,
    /\.spec\./,
    /__tests__/,
    /\/tests?\//,
    /\/spec\//
  ]

  private readonly CONFIG_PATTERNS = [
    /\.config\./,
    /^\..*rc$/,
    /^\..*ignore$/,
    /package\.json$/,
    /tsconfig\.json$/,
    /webpack\..*\.js$/,
    /rollup\..*\.js$/,
    /vite\..*\.(js|ts)$/
  ]

  constructor() {
    this.typeDetector = new ProjectTypeDetector()
    this.fileScanner = new FileScanner()
  }

  /**
   * Performs comprehensive analysis of a project
   */
  async analyze(projectPath: string, options: AnalysisOptions = {}): Promise<ProjectAnalysis> {
    const startTime = new Date()

    // Step 1: Detect project type
    const detectionResult = await this.typeDetector.detect(projectPath)

    // Step 2: Scan files
    const scanResult = await this.fileScanner.scanDirectory(projectPath, options)

    // Step 3: Analyze files based on project type
    const analyzedFiles = await this.analyzeFiles(scanResult.files, detectionResult.type, options)

    // Step 4: Extract project metadata
    const metadata = await this.extractMetadata(projectPath)

    // Step 5: Generate documentation structure
    const structure = await this.generateDocumentationStructure(
      detectionResult.type,
      analyzedFiles,
      metadata,
      projectPath
    )

    // Step 6: Generate recommendations
    const recommendations = options.generateRecommendations !== false
      ? this.generateRecommendations(detectionResult, analyzedFiles, metadata)
      : []

    const skippedFiles = scanResult.statistics.errors.map(error => error.path)

    return {
      projectPath,
      projectType: detectionResult.type,
      projectName: metadata.name,
      files: analyzedFiles,
      skippedFiles,
      statistics: scanResult.statistics,
      structure,
      metadata,
      detectionResult,
      recommendations,
      timestamp: startTime
    }
  }

  /**
   * Analyzes files and adds project-type-specific metadata
   */
  private async analyzeFiles(
    files: ScannedFile[],
    projectType: ProjectType,
    options: AnalysisOptions
  ): Promise<AnalyzedFile[]> {
    const analyzedFiles: AnalyzedFile[] = []

    for (const file of files) {
      const analyzed = await this.analyzeFile(file, projectType, options)
      analyzedFiles.push(analyzed)
    }

    return this.prioritizeFiles(analyzedFiles, projectType)
  }

  /**
   * Analyzes a single file
   */
  private async analyzeFile(
    file: ScannedFile,
    projectType: ProjectType,
    options: AnalysisOptions
  ): Promise<AnalyzedFile> {
    const analyzed: AnalyzedFile = {
      ...file,
      isDocumentable: false,
      category: this.categorizeFile(file),
      importance: 'low'
    }

    // Determine if file is documentable
    analyzed.isDocumentable = this.isDocumentableFile(file, projectType)

    // Detect language
    if (file.extension && this.LANGUAGE_EXTENSIONS[file.extension]) {
      analyzed.language = this.LANGUAGE_EXTENSIONS[file.extension]
    }

    // Detect framework/library
    analyzed.framework = this.detectFramework(file)

    // Set importance based on project type and file characteristics
    analyzed.importance = this.calculateImportance(analyzed, projectType)

    // Extract dependencies and exports if requested
    if (options.extractDependencies && analyzed.isAccessible && this.isSourceFile(analyzed)) {
      try {
        const deps = await this.extractFileDependencies(file.path)
        analyzed.dependencies = deps.dependencies
        analyzed.exports = deps.exports
      } catch (error) {
        // Failed to extract dependencies, continue without them
      }
    }

    // Calculate complexity if requested
    if (options.analyzeComplexity && this.isSourceFile(analyzed) && file.lineCount) {
      analyzed.complexity = this.calculateComplexity(file.lineCount, analyzed.language)
    }

    return analyzed
  }

  /**
   * Categorizes a file based on its path and name
   */
  private categorizeFile(file: ScannedFile): FileCategory {
    const filePath = file.relativePath.toLowerCase()
    const fileName = file.name.toLowerCase()

    // Test files
    if (this.TEST_PATTERNS.some(pattern => pattern.test(filePath))) {
      return 'test'
    }

    // Configuration files
    if (this.CONFIG_PATTERNS.some(pattern => pattern.test(fileName))) {
      return 'config'
    }

    // Documentation files
    if (file.extension === '.md' || file.extension === '.rst' || file.extension === '.txt') {
      return 'documentation'
    }

    // Build/dist files
    if (filePath.includes('build/') || filePath.includes('dist/') || filePath.includes('.next/')) {
      return 'build'
    }

    // Asset files
    if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'].includes(file.extension)) {
      return 'asset'
    }

    // Dependency files
    if (filePath.includes('node_modules/') || filePath.includes('vendor/')) {
      return 'dependency'
    }

    // Default to source
    return 'source'
  }

  /**
   * Determines if a file should be documented
   */
  private isDocumentableFile(file: ScannedFile, projectType: ProjectType): boolean {
    if (file.isDirectory || !file.isAccessible) {
      return false
    }

    const category = this.categorizeFile(file)

    // Always document these categories
    if (category === 'source' || category === 'documentation') {
      return true
    }

    // For monorepos, also document important config files
    if (projectType === 'monorepo' && category === 'config') {
      return ['package.json', 'lerna.json', 'nx.json', 'rush.json'].includes(file.name)
    }

    // For libraries/tools, document config and test files
    if (projectType === 'library' || projectType === 'tools') {
      return category === 'config' || category === 'test'
    }

    return false
  }

  /**
   * Detects the framework used in a file
   */
  private detectFramework(file: ScannedFile): string | undefined {
    const fileName = file.name.toLowerCase()

    if (fileName.includes('react') || file.extension === '.jsx' || file.extension === '.tsx') {
      return 'React'
    }

    if (fileName.includes('vue') || file.extension === '.vue') {
      return 'Vue'
    }

    if (fileName.includes('angular') || fileName.includes('ng')) {
      return 'Angular'
    }

    if (file.extension === '.svelte') {
      return 'Svelte'
    }

    return undefined
  }

  /**
   * Calculates the importance level of a file
   */
  private calculateImportance(file: AnalyzedFile, projectType: ProjectType): ImportanceLevel {
    // Critical files
    if (['package.json', 'readme.md', 'index.ts', 'index.js', 'main.ts', 'main.js'].includes(file.name.toLowerCase())) {
      return 'critical'
    }

    // High importance for main source files
    if (file.category === 'source' && file.lineCount && file.lineCount > 50) {
      return 'high'
    }

    // Medium importance for configuration and documentation
    if (file.category === 'config' || file.category === 'documentation') {
      return 'medium'
    }

    // Project-type specific importance
    if (projectType === 'monorepo') {
      if (['lerna.json', 'nx.json', 'rush.json'].includes(file.name.toLowerCase())) {
        return 'critical'
      }
    }

    return 'low'
  }

  /**
   * Checks if a file is a source code file
   */
  private isSourceFile(file: AnalyzedFile): boolean {
    return file.category === 'source' && file.language !== undefined
  }

  /**
   * Extracts dependencies and exports from a source file
   */
  private async extractFileDependencies(filePath: string): Promise<{ dependencies: string[]; exports: string[] }> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const dependencies: string[] = []
      const exports: string[] = []

      // Extract import statements (simplified regex)
      const importMatches = content.match(/(?:import|require)\s*\(?['"`]([^'"`]+)['"`]/g)
      if (importMatches) {
        for (const match of importMatches) {
          const depMatch = match.match(/['"`]([^'"`]+)['"`]/)
          if (depMatch && !depMatch[1].startsWith('.')) {
            dependencies.push(depMatch[1])
          }
        }
      }

      // Extract export statements (simplified)
      const exportMatches = content.match(/export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g)
      if (exportMatches) {
        for (const match of exportMatches) {
          const exportMatch = match.match(/(\w+)$/)
          if (exportMatch) {
            exports.push(exportMatch[1])
          }
        }
      }

      return { dependencies: [...new Set(dependencies)], exports: [...new Set(exports)] }
    } catch (error) {
      return { dependencies: [], exports: [] }
    }
  }

  /**
   * Calculates complexity score for a file
   */
  private calculateComplexity(lineCount: number, language?: string): number {
    let baseComplexity = lineCount / 100 // Base complexity per 100 lines

    // Adjust for language complexity
    const languageMultipliers: Record<string, number> = {
      'JavaScript': 1.0,
      'TypeScript': 1.2,
      'Python': 0.8,
      'Java': 1.3,
      'C++': 1.5,
      'Go': 0.9,
      'Rust': 1.4
    }

    if (language && languageMultipliers[language]) {
      baseComplexity *= languageMultipliers[language]
    }

    return Math.round(baseComplexity * 100) / 100
  }

  /**
   * Prioritizes files based on project type and importance
   */
  private prioritizeFiles(files: AnalyzedFile[], projectType: ProjectType): AnalyzedFile[] {
    return files.sort((a, b) => {
      // First sort by importance
      const importanceOrder: Record<ImportanceLevel, number> = {
        'critical': 4,
        'high': 3,
        'medium': 2,
        'low': 1
      }

      const importanceDiff = importanceOrder[b.importance] - importanceOrder[a.importance]
      if (importanceDiff !== 0) return importanceDiff

      // Then by category relevance
      const categoryOrder: Record<FileCategory, number> = {
        'source': 6,
        'documentation': 5,
        'config': 4,
        'test': 3,
        'build': 2,
        'asset': 1,
        'dependency': 0
      }

      const categoryDiff = categoryOrder[b.category] - categoryOrder[a.category]
      if (categoryDiff !== 0) return categoryDiff

      // Finally by file size (larger files first for source)
      if (a.category === 'source' && b.category === 'source') {
        return b.size - a.size
      }

      return a.name.localeCompare(b.name)
    })
  }

  /**
   * Extracts project metadata from package.json and other sources
   */
  private async extractMetadata(projectPath: string): Promise<ProjectMetadata> {
    const metadata: ProjectMetadata = {
      name: path.basename(projectPath)
    }

    try {
      const packageJsonPath = path.join(projectPath, 'package.json')
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8')
      const packageJson = JSON.parse(packageContent)

      // Extract standard package.json fields
      const fields: (keyof ProjectMetadata)[] = [
        'name', 'version', 'description', 'author', 'license',
        'repository', 'homepage', 'keywords', 'dependencies',
        'devDependencies', 'scripts', 'main', 'exports', 'workspaces', 'engines'
      ]

      for (const field of fields) {
        if (packageJson[field] !== undefined) {
          (metadata as any)[field] = packageJson[field]
        }
      }

      // Handle repository object format
      if (typeof packageJson.repository === 'object' && packageJson.repository.url) {
        metadata.repository = packageJson.repository.url
      }

    } catch (error) {
      // No package.json or parse error, use defaults
    }

    return metadata
  }

  /**
   * Generates documentation structure based on project type
   */
  private async generateDocumentationStructure(
    projectType: ProjectType,
    files: AnalyzedFile[],
    metadata: ProjectMetadata,
    projectPath: string
  ): Promise<DocumentationStructure> {
    const docsDir = path.join(projectPath, 'docs', metadata.name)

    switch (projectType) {
    case 'monorepo':
      return this.generateMonorepoStructure(files, metadata, docsDir)
    case 'library':
    case 'tools':
      return this.generateLibraryStructure(files, metadata, docsDir, projectType)
    default:
      return this.generateApplicationStructure(files, metadata, docsDir)
    }
  }

  /**
   * Generates documentation structure for monorepos
   */
  private generateMonorepoStructure(
    files: AnalyzedFile[],
    metadata: ProjectMetadata,
    docsDir: string
  ): DocumentationStructure {
    const packages = files.filter(f =>
      f.relativePath.includes('packages/') && f.name === 'package.json'
    ).map(f => path.dirname(f.relativePath))

    const sections: DocumentationSection[] = [
      {
        name: 'Overview',
        path: path.join(docsDir, 'README.md'),
        files: ['README.md'],
        priority: 1
      },
      {
        name: 'Architecture',
        path: path.join(docsDir, 'ARCHITECTURE.md'),
        files: [],
        priority: 2
      }
    ]

    // Add package sections
    packages.forEach((pkg, index) => {
      const packageName = path.basename(pkg)
      sections.push({
        name: `Package: ${packageName}`,
        path: path.join(docsDir, 'packages', packageName),
        files: files.filter(f => f.relativePath.startsWith(pkg + '/') && f.isDocumentable).map(f => f.relativePath),
        priority: 3 + index
      })
    })

    return {
      type: 'monorepo',
      rootDir: docsDir,
      sections,
      navigationOrder: sections.map(s => s.name),
      specialFiles: {
        'main': 'README.md',
        'architecture': 'ARCHITECTURE.md',
        'contributing': 'CONTRIBUTING.md'
      }
    }
  }

  /**
   * Generates documentation structure for libraries/tools
   */
  private generateLibraryStructure(
    files: AnalyzedFile[],
    metadata: ProjectMetadata,
    docsDir: string,
    projectType: ProjectType
  ): DocumentationStructure {
    const sections: DocumentationSection[] = [
      {
        name: 'Overview',
        path: path.join(docsDir, 'README.md'),
        files: ['README.md'],
        priority: 1
      },
      {
        name: 'API Reference',
        path: path.join(docsDir, 'API.md'),
        files: files.filter(f => f.category === 'source' && f.importance === 'critical').map(f => f.relativePath),
        priority: 2
      },
      {
        name: 'Usage Guide',
        path: path.join(docsDir, 'USAGE.md'),
        files: [],
        priority: 3
      }
    ]

    if (projectType === 'tools') {
      const toolDirs = files.filter(f =>
        f.isDirectory && (f.relativePath.startsWith('tools/') || f.relativePath.startsWith('scripts/'))
      )

      toolDirs.forEach((tool, index) => {
        sections.push({
          name: `Tool: ${path.basename(tool.relativePath)}`,
          path: path.join(docsDir, 'tools', path.basename(tool.relativePath)),
          files: files.filter(f => f.relativePath.startsWith(tool.relativePath + '/') && f.isDocumentable).map(f => f.relativePath),
          priority: 4 + index
        })
      })
    }

    return {
      type: projectType,
      rootDir: docsDir,
      sections,
      navigationOrder: sections.map(s => s.name),
      specialFiles: {
        'main': 'README.md',
        'api': 'API.md',
        'usage': 'USAGE.md'
      }
    }
  }

  /**
   * Generates documentation structure for applications
   */
  private generateApplicationStructure(
    files: AnalyzedFile[],
    metadata: ProjectMetadata,
    docsDir: string
  ): DocumentationStructure {
    const sections: DocumentationSection[] = [
      {
        name: 'Overview',
        path: path.join(docsDir, 'README.md'),
        files: ['README.md'],
        priority: 1
      },
      {
        name: 'Getting Started',
        path: path.join(docsDir, 'GETTING_STARTED.md'),
        files: [],
        priority: 2
      },
      {
        name: 'Configuration',
        path: path.join(docsDir, 'CONFIGURATION.md'),
        files: files.filter(f => f.category === 'config' && f.importance !== 'low').map(f => f.relativePath),
        priority: 3
      },
      {
        name: 'Deployment',
        path: path.join(docsDir, 'DEPLOYMENT.md'),
        files: [],
        priority: 4
      }
    ]

    return {
      type: 'application',
      rootDir: docsDir,
      sections,
      navigationOrder: sections.map(s => s.name),
      specialFiles: {
        'main': 'README.md',
        'getting-started': 'GETTING_STARTED.md',
        'config': 'CONFIGURATION.md',
        'deployment': 'DEPLOYMENT.md'
      }
    }
  }

  /**
   * Generates recommendations based on analysis results
   */
  private generateRecommendations(
    detection: DetectionResult,
    files: AnalyzedFile[],
    metadata: ProjectMetadata
  ): string[] {
    const recommendations: string[] = []

    // Detection confidence recommendations
    if (detection.confidence < 0.7) {
      recommendations.push(
        `Project type detection confidence is low (${(detection.confidence * 100).toFixed(1)}%). ` +
        'Consider adding more standard configuration files for clearer project structure.'
      )
    }

    // Documentation recommendations
    const hasReadme = files.some(f => f.name.toLowerCase() === 'readme.md')
    if (!hasReadme) {
      recommendations.push('Consider adding a README.md file to provide project overview and setup instructions.')
    }

    // Package.json recommendations
    if (!metadata.description) {
      recommendations.push('Add a description field to package.json for better project documentation.')
    }

    if (!metadata.repository) {
      recommendations.push('Add repository URL to package.json for better project visibility.')
    }

    // Type-specific recommendations
    if (detection.type === 'monorepo') {
      const hasLernaOrNx = detection.indicators.hasLernaConfig || detection.indicators.hasNxConfig
      if (!hasLernaOrNx && detection.indicators.packageCount > 3) {
        recommendations.push('Consider using Lerna, Nx, or Rush for better monorepo management.')
      }
    }

    // File organization recommendations
    const sourceFiles = files.filter(f => f.category === 'source')
    const criticalFiles = sourceFiles.filter(f => f.importance === 'critical')

    if (criticalFiles.length === 0 && sourceFiles.length > 5) {
      recommendations.push('Consider organizing source files with clearer entry points (index.ts, main.ts).')
    }

    // Complexity recommendations
    const complexFiles = files.filter(f => f.complexity && f.complexity > 5)
    if (complexFiles.length > 0) {
      recommendations.push(
        `${complexFiles.length} files have high complexity. Consider refactoring for better maintainability.`
      )
    }

    return recommendations
  }
}
