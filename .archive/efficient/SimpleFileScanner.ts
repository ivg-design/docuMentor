/**
 * SimpleFileScanner - Fast file discovery without AI
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { SourceFile } from './DocumentProcessor'
import { Logger } from '../Logger'

export class SimpleFileScanner {
  private readonly IGNORE_DIRS = [
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    '.next',
    '.nuxt',
    'vendor',
    'tmp',
    'temp',
    '.cache',
    '__pycache__'
  ]

  private readonly DOCUMENTABLE_EXTENSIONS = [
    '.js', '.jsx', '.ts', '.tsx',
    '.py', '.go', '.java', '.c', '.cpp', '.h',
    '.md', '.mdx',
    '.json', '.yaml', '.yml', '.toml'
  ]

  private readonly SKIP_PATTERNS = [
    '.min.js', '.min.css', '.bundle.js',
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
    '.map', '.test.', '.spec.', '.d.ts'
  ]

  /**
   * Scan directory for documentable files
   */
  async scan(projectPath: string): Promise<SourceFile[]> {
    const files: SourceFile[] = []
    
    try {
      await this.scanDirectory(projectPath, files, projectPath)
      
      // Filter and prioritize files
      return this.filterAndPrioritize(files)
      
    } catch (error) {
      Logger.error(`Scan failed: ${(error as Error).message}`, 'Scanner')
      throw error
    }
  }

  /**
   * Recursively scan directory
   */
  private async scanDirectory(
    dirPath: string, 
    files: SourceFile[], 
    rootPath: string
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        const relativePath = path.relative(rootPath, fullPath)
        
        if (entry.isDirectory()) {
          // Skip ignored directories
          if (!this.IGNORE_DIRS.includes(entry.name) && !entry.name.startsWith('.')) {
            await this.scanDirectory(fullPath, files, rootPath)
          }
        } else if (entry.isFile()) {
          // Check if file should be documented
          if (this.shouldDocument(entry.name, relativePath)) {
            const stats = await fs.stat(fullPath)
            files.push({
              path: fullPath,
              name: entry.name,
              size: stats.size,
              extension: path.extname(entry.name)
            })
          }
        }
      }
    } catch (error) {
      Logger.warn(`Cannot scan ${dirPath}: ${(error as Error).message}`, 'Scanner')
    }
  }

  /**
   * Check if file should be documented
   */
  private shouldDocument(fileName: string, relativePath: string): boolean {
    const lowerName = fileName.toLowerCase()
    const ext = path.extname(fileName).toLowerCase()
    
    // Skip patterns
    for (const pattern of this.SKIP_PATTERNS) {
      if (lowerName.includes(pattern)) {
        return false
      }
    }
    
    // Skip hidden files
    if (fileName.startsWith('.')) {
      return false
    }
    
    // Check extension
    if (!this.DOCUMENTABLE_EXTENSIONS.includes(ext)) {
      return false
    }
    
    // Special cases - always document these
    const importantFiles = [
      'readme.md', 'changelog.md', 'contributing.md',
      'license', 'license.md', 'license.txt'
    ]
    
    if (importantFiles.includes(lowerName)) {
      return true
    }
    
    // Only document source code in src/ or lib/ directories
    if (ext === '.js' || ext === '.ts' || ext === '.jsx' || ext === '.tsx') {
      return relativePath.includes('/src/') || 
             relativePath.includes('/lib/') ||
             relativePath.includes('/components/') ||
             relativePath.includes('/pages/') ||
             relativePath.includes('/api/')
    }
    
    // Document config files in root only
    if (ext === '.json' || ext === '.yaml' || ext === '.yml') {
      return !relativePath.includes('/')
    }
    
    return true
  }

  /**
   * Filter and prioritize files for documentation
   */
  private filterAndPrioritize(files: SourceFile[]): SourceFile[] {
    // Sort by priority
    return files.sort((a, b) => {
      const aPriority = this.getFilePriority(a)
      const bPriority = this.getFilePriority(b)
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority
      }
      
      // Secondary sort by path depth (shallower first)
      const aDepth = a.path.split('/').length
      const bDepth = b.path.split('/').length
      
      if (aDepth !== bDepth) {
        return aDepth - bDepth
      }
      
      // Tertiary sort by name
      return a.name.localeCompare(b.name)
    })
  }

  /**
   * Get file priority (lower is higher priority)
   */
  private getFilePriority(file: SourceFile): number {
    const name = file.name.toLowerCase()
    
    // Highest priority
    if (name === 'readme.md') return 1
    if (name === 'package.json') return 2
    if (name === 'index.js' || name === 'index.ts') return 3
    
    // High priority
    if (name === 'changelog.md') return 10
    if (name === 'contributing.md') return 11
    if (name.includes('license')) return 12
    
    // Source code
    if (file.path.includes('/src/')) return 20
    if (file.path.includes('/lib/')) return 21
    
    // Config files
    if (file.extension === '.json' || file.extension === '.yaml') return 30
    
    // Documentation
    if (file.extension === '.md') return 40
    
    // Everything else
    return 50
  }
}