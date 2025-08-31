import * as fs from 'fs/promises'
import * as path from 'path'

/**
 * Information about a scanned file
 */
export interface ScannedFile {
  path: string;
  relativePath: string;
  name: string;
  extension: string;
  size: number;
  isDirectory: boolean;
  isAccessible: boolean;
  lineCount?: number;
  encoding?: string;
}

/**
 * Statistics collected during file scanning
 */
export interface ScanStatistics {
  totalFiles: number;
  totalDirectories: number;
  totalSize: number;
  totalLines: number;
  accessibleFiles: number;
  skippedFiles: number;
  fileTypeDistribution: Map<string, number>;
  largestFiles: ScannedFile[];
  errors: ScanError[];
}

/**
 * Error that occurred during scanning
 */
export interface ScanError {
  path: string;
  error: string;
  type: 'permission' | 'access' | 'read' | 'unknown';
}

/**
 * Configuration options for file scanning
 */
export interface ScanOptions {
  maxDepth?: number;
  followSymlinks?: boolean;
  respectGitignore?: boolean;
  respectDocumentorIgnore?: boolean;
  includeHidden?: boolean;
  maxFileSize?: number; // in bytes
  fileExtensions?: string[]; // if specified, only these extensions
  excludePatterns?: string[];
  includeLineCount?: boolean;
}

/**
 * Intelligent file scanner that respects .gitignore patterns,
 * handles permissions gracefully, and provides detailed statistics
 */
export class FileScanner {
  private readonly DEFAULT_EXCLUDE_PATTERNS = [
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
    '.next/**',
    '.nuxt/**',
    'coverage/**',
    '.nyc_output/**',
    '*.log',
    '*.tmp',
    '*.temp',
    '.DS_Store',
    'Thumbs.db'
  ]

  private readonly TEXT_EXTENSIONS = new Set([
    '.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte',
    '.py', '.rb', '.php', '.java', '.c', '.cpp', '.h', '.hpp',
    '.cs', '.go', '.rs', '.swift', '.kt', '.scala',
    '.html', '.htm', '.css', '.scss', '.sass', '.less',
    '.json', '.yaml', '.yml', '.xml', '.toml',
    '.md', '.txt', '.rst', '.asciidoc',
    '.sh', '.bat', '.ps1', '.fish', '.zsh',
    '.sql', '.graphql', '.proto',
    '.dockerfile', '.gitignore', '.env'
  ])

  private gitignorePatterns: string[] = []
  private documentorIgnorePatterns: string[] = []
  private statistics!: ScanStatistics

  constructor() {
    this.resetStatistics()
  }

  /**
   * Scans a directory and returns all accessible files with metadata
   */
  async scanDirectory(
    rootPath: string,
    options: ScanOptions = {}
  ): Promise<{ files: ScannedFile[]; statistics: ScanStatistics }> {
    this.resetStatistics()

    // Apply default options
    const scanOptions: Required<ScanOptions> = {
      maxDepth: options.maxDepth ?? 10,
      followSymlinks: options.followSymlinks ?? false,
      respectGitignore: options.respectGitignore ?? true,
      respectDocumentorIgnore: options.respectDocumentorIgnore ?? true,
      includeHidden: options.includeHidden ?? false,
      maxFileSize: options.maxFileSize ?? 10 * 1024 * 1024, // 10MB default
      fileExtensions: options.fileExtensions ?? [],
      excludePatterns: [...this.DEFAULT_EXCLUDE_PATTERNS, ...(options.excludePatterns ?? [])],
      includeLineCount: options.includeLineCount ?? true
    }

    // Load ignore patterns
    if (scanOptions.respectGitignore) {
      await this.loadGitignorePatterns(rootPath)
    }

    if (scanOptions.respectDocumentorIgnore) {
      await this.loadDocumentorIgnorePatterns(rootPath)
    }

    const files: ScannedFile[] = []

    try {
      await this.scanRecursive(rootPath, rootPath, files, scanOptions, 0)
    } catch (error) {
      this.addError(rootPath, error, 'access')
    }

    // Update final statistics
    this.updateFinalStatistics(files)

    return {
      files,
      statistics: this.statistics
    }
  }

  /**
   * Recursively scans directories and collects file information
   */
  private async scanRecursive(
    currentPath: string,
    rootPath: string,
    files: ScannedFile[],
    options: Required<ScanOptions>,
    depth: number
  ): Promise<void> {
    // Check depth limit
    if (depth > options.maxDepth) {
      return
    }

    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name)
        const relativePath = path.relative(rootPath, fullPath)

        // Skip hidden files if not included
        if (!options.includeHidden && entry.name.startsWith('.') && entry.name !== '.gitignore') {
          continue
        }

        // Check if path should be ignored
        if (this.shouldIgnore(relativePath, entry.isDirectory())) {
          this.statistics.skippedFiles++
          continue
        }

        // Check custom exclude patterns
        if (this.matchesExcludePatterns(relativePath, options.excludePatterns)) {
          this.statistics.skippedFiles++
          continue
        }

        try {
          if (entry.isDirectory()) {
            this.statistics.totalDirectories++

            // Add directory info
            const dirInfo: ScannedFile = {
              path: fullPath,
              relativePath,
              name: entry.name,
              extension: '',
              size: 0,
              isDirectory: true,
              isAccessible: true
            }
            files.push(dirInfo)

            // Recursively scan subdirectory
            await this.scanRecursive(fullPath, rootPath, files, options, depth + 1)

          } else if (entry.isFile() || (entry.isSymbolicLink() && options.followSymlinks)) {
            const fileInfo = await this.processFile(fullPath, relativePath, entry.name, options)
            if (fileInfo) {
              files.push(fileInfo)
              this.updateStatistics(fileInfo)
            }
          }
        } catch (error) {
          this.addError(fullPath, error, 'access')

          // Still add file info but mark as inaccessible
          const fileInfo: ScannedFile = {
            path: fullPath,
            relativePath,
            name: entry.name,
            extension: path.extname(entry.name).toLowerCase(),
            size: 0,
            isDirectory: entry.isDirectory(),
            isAccessible: false
          }
          files.push(fileInfo)
        }
      }
    } catch (error) {
      this.addError(currentPath, error, 'permission')
    }
  }

  /**
   * Processes a single file and returns its metadata
   */
  private async processFile(
    fullPath: string,
    relativePath: string,
    name: string,
    options: Required<ScanOptions>
  ): Promise<ScannedFile | null> {
    try {
      const stats = await fs.stat(fullPath)

      // Check file size limit
      if (stats.size > options.maxFileSize) {
        this.statistics.skippedFiles++
        return null
      }

      const extension = path.extname(name).toLowerCase()

      // Check file extension filter
      if (options.fileExtensions.length > 0 && !options.fileExtensions.includes(extension)) {
        this.statistics.skippedFiles++
        return null
      }

      const fileInfo: ScannedFile = {
        path: fullPath,
        relativePath,
        name,
        extension,
        size: stats.size,
        isDirectory: false,
        isAccessible: true
      }

      // Count lines for text files if requested
      if (options.includeLineCount && this.isTextFile(extension)) {
        try {
          const lineCount = await this.countLines(fullPath)
          fileInfo.lineCount = lineCount
          fileInfo.encoding = 'utf-8'
        } catch (error) {
          this.addError(fullPath, error, 'read')
          fileInfo.isAccessible = false
        }
      }

      return fileInfo
    } catch (error) {
      this.addError(fullPath, error, 'access')
      return null
    }
  }

  /**
   * Counts lines in a text file
   */
  private async countLines(filePath: string): Promise<number> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return content.split('\n').length
    } catch (error) {
      // Try reading as buffer if UTF-8 fails
      const buffer = await fs.readFile(filePath)
      const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 1024))
      return content.split('\n').length
    }
  }

  /**
   * Loads .gitignore patterns from the project root
   */
  private async loadGitignorePatterns(rootPath: string): Promise<void> {
    const gitignorePath = path.join(rootPath, '.gitignore')

    try {
      const content = await fs.readFile(gitignorePath, 'utf-8')
      this.gitignorePatterns = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(this.normalizeGitignorePattern)
    } catch (error) {
      // No .gitignore file or permission error
      this.gitignorePatterns = []
    }
  }

  /**
   * Loads .documentor-ignore patterns from the project root
   */
  private async loadDocumentorIgnorePatterns(rootPath: string): Promise<void> {
    const ignorePath = path.join(rootPath, '.documentor-ignore')

    try {
      const content = await fs.readFile(ignorePath, 'utf-8')
      this.documentorIgnorePatterns = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(this.normalizeGitignorePattern)
    } catch (error) {
      // No .documentor-ignore file
      this.documentorIgnorePatterns = []
    }
  }

  /**
   * Normalizes a gitignore pattern for matching
   */
  private normalizeGitignorePattern(pattern: string): string {
    // Convert gitignore pattern to regex-friendly format
    let normalized = pattern

    // Handle directory patterns
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1)
    }

    // Handle negation patterns
    if (normalized.startsWith('!')) {
      // TODO: Implement negation support
      return normalized
    }

    // Convert * to regex
    normalized = normalized.replace(/\*/g, '[^/]*')
    normalized = normalized.replace(/\*\*/g, '.*')

    return normalized
  }

  /**
   * Checks if a path should be ignored based on gitignore and documentor-ignore patterns
   */
  private shouldIgnore(relativePath: string, isDirectory: boolean): boolean {
    const allPatterns = [...this.gitignorePatterns, ...this.documentorIgnorePatterns]

    for (const pattern of allPatterns) {
      if (this.matchesPattern(relativePath, pattern, isDirectory)) {
        return true
      }
    }

    return false
  }

  /**
   * Checks if a path matches exclude patterns
   */
  private matchesExcludePatterns(relativePath: string, excludePatterns: string[]): boolean {
    for (const pattern of excludePatterns) {
      if (this.matchesGlob(relativePath, pattern)) {
        return true
      }
    }
    return false
  }

  /**
   * Matches a path against a gitignore pattern
   */
  private matchesPattern(filePath: string, pattern: string, isDirectory: boolean): boolean {
    // Simple pattern matching (could be enhanced with a proper gitignore library)
    const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*'))
    return regex.test(filePath) || (isDirectory && regex.test(filePath + '/'))
  }

  /**
   * Matches a path against a glob pattern
   */
  private matchesGlob(filePath: string, pattern: string): boolean {
    const regex = new RegExp(
      pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '[^/]*')
        .replace(/\*\*/g, '.*')
    )
    return regex.test(filePath)
  }

  /**
   * Checks if a file extension indicates a text file
   */
  private isTextFile(extension: string): boolean {
    return this.TEXT_EXTENSIONS.has(extension)
  }

  /**
   * Updates running statistics for a processed file
   */
  private updateStatistics(fileInfo: ScannedFile): void {
    this.statistics.totalFiles++
    this.statistics.totalSize += fileInfo.size

    if (fileInfo.isAccessible) {
      this.statistics.accessibleFiles++
    } else {
      this.statistics.skippedFiles++
    }

    if (fileInfo.lineCount) {
      this.statistics.totalLines += fileInfo.lineCount
    }

    // Update file type distribution
    const ext = fileInfo.extension || 'no-extension'
    this.statistics.fileTypeDistribution.set(
      ext,
      (this.statistics.fileTypeDistribution.get(ext) || 0) + 1
    )

    // Track largest files (keep top 10)
    this.statistics.largestFiles.push(fileInfo)
    this.statistics.largestFiles.sort((a, b) => b.size - a.size)
    if (this.statistics.largestFiles.length > 10) {
      this.statistics.largestFiles = this.statistics.largestFiles.slice(0, 10)
    }
  }

  /**
   * Updates final statistics after scanning is complete
   */
  private updateFinalStatistics(files: ScannedFile[]): void {
    // Additional processing if needed
    this.statistics.totalFiles = files.filter(f => !f.isDirectory).length
    this.statistics.totalDirectories = files.filter(f => f.isDirectory).length
  }

  /**
   * Adds an error to the statistics
   */
  private addError(filePath: string, error: any, type: ScanError['type']): void {
    this.statistics.errors.push({
      path: filePath,
      error: error.message || String(error),
      type
    })
    this.statistics.skippedFiles++
  }

  /**
   * Resets statistics for a new scan
   */
  private resetStatistics(): void {
    this.statistics = {
      totalFiles: 0,
      totalDirectories: 0,
      totalSize: 0,
      totalLines: 0,
      accessibleFiles: 0,
      skippedFiles: 0,
      fileTypeDistribution: new Map(),
      largestFiles: [],
      errors: []
    }
  }

  /**
   * Gets a summary of the scan statistics
   */
  getStatisticsSummary(): string {
    const stats = this.statistics
    const lines: string[] = [
      `Total files: ${stats.totalFiles}`,
      `Total directories: ${stats.totalDirectories}`,
      `Accessible files: ${stats.accessibleFiles}`,
      `Skipped files: ${stats.skippedFiles}`,
      `Total size: ${this.formatBytes(stats.totalSize)}`,
      `Total lines: ${stats.totalLines.toLocaleString()}`,
      `Errors encountered: ${stats.errors.length}`
    ]

    if (stats.fileTypeDistribution.size > 0) {
      lines.push('\nFile type distribution:')
      const sortedTypes = Array.from(stats.fileTypeDistribution.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)

      for (const [ext, count] of sortedTypes) {
        lines.push(`  ${ext}: ${count}`)
      }
    }

    return lines.join('\n')
  }

  /**
   * Formats bytes into human-readable format
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`
  }
}
