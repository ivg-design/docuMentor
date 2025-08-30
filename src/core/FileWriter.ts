import { promises as fs } from 'fs'
import { resolve, dirname, relative, join, normalize, isAbsolute } from 'path'
import { existsSync, statSync } from 'fs'
import { homedir } from 'os'
import { logger } from '../cli/display'

export interface FileWriteOptions {
  format: 'obsidian' | 'markdown';
  createDirectories?: boolean;
  overwrite?: boolean;
  encoding?: BufferEncoding;
}

export interface SecurityPolicy {
  allowedBasePaths: string[];
  blockedPaths: string[];
  allowProjectDirectory: boolean;
  allowedExtensions: string[];
}

export class FileWriter {
  private securityPolicy: SecurityPolicy
  private outputBasePath: string
  private projectPath: string

  constructor(outputBasePath: string, projectPath: string, policy?: Partial<SecurityPolicy>) {
    this.outputBasePath = this.expandPath(outputBasePath)
    this.projectPath = resolve(projectPath)

    this.securityPolicy = {
      allowedBasePaths: [this.outputBasePath],
      blockedPaths: [
        this.projectPath, // Block writing to project directory
        '/etc',
        '/usr',
        '/bin',
        '/System',
        '/Library'
      ],
      allowProjectDirectory: false, // NEVER write to project directory
      allowedExtensions: ['.md', '.json', '.txt', '.html', '.css', '.js', '.png', '.jpg', '.gif', '.svg'],
      ...policy
    }

    // Exception: Allow .documentor.lock in project directory
    this.securityPolicy.blockedPaths = this.securityPolicy.blockedPaths.filter(
      path => path !== this.projectPath
    )
  }

  // Expand ~ and environment variables in paths
  private expandPath(path: string): string {
    if (path.startsWith('~/')) {
      return join(homedir(), path.slice(2))
    }

    // Expand environment variables like $HOME, $USER
    return path.replace(/\$(\w+)/g, (match, varName) => {
      return process.env[varName] || match
    })
  }

  // Validate that the target path is secure and allowed
  private validatePath(targetPath: string): { isValid: boolean; reason?: string; resolvedPath: string } {
    const resolvedPath = resolve(targetPath)
    const normalizedPath = normalize(resolvedPath)

    // Special case: Allow .documentor.lock in project directory
    if (normalizedPath === join(this.projectPath, '.documentor.lock')) {
      return { isValid: true, resolvedPath: normalizedPath }
    }

    // Block writing to project directory (except .documentor.lock)
    if (!this.securityPolicy.allowProjectDirectory) {
      const relativeToPProject = relative(this.projectPath, normalizedPath)
      if (!relativeToPProject || !relativeToPProject.startsWith('..')) {
        return {
          isValid: false,
          reason: `Blocked: Cannot write to project directory ${this.projectPath}`,
          resolvedPath: normalizedPath
        }
      }
    }

    // Check blocked paths
    for (const blockedPath of this.securityPolicy.blockedPaths) {
      const resolvedBlockedPath = resolve(blockedPath)
      const relativeToBlocked = relative(resolvedBlockedPath, normalizedPath)
      if (!relativeToBlocked || !relativeToBlocked.startsWith('..')) {
        return {
          isValid: false,
          reason: `Blocked path: ${blockedPath}`,
          resolvedPath: normalizedPath
        }
      }
    }

    // Check if within allowed base paths
    let isWithinAllowedPath = false
    for (const allowedPath of this.securityPolicy.allowedBasePaths) {
      const resolvedAllowedPath = resolve(allowedPath)
      const relativeToAllowed = relative(resolvedAllowedPath, normalizedPath)
      if (!relativeToAllowed || !relativeToAllowed.startsWith('..')) {
        isWithinAllowedPath = true
        break
      }
    }

    if (!isWithinAllowedPath) {
      return {
        isValid: false,
        reason: `Path not within allowed base paths: ${this.securityPolicy.allowedBasePaths.join(', ')}`,
        resolvedPath: normalizedPath
      }
    }

    // Check file extension
    const ext = targetPath.toLowerCase().substring(targetPath.lastIndexOf('.'))
    if (ext && !this.securityPolicy.allowedExtensions.includes(ext)) {
      return {
        isValid: false,
        reason: `File extension '${ext}' not allowed`,
        resolvedPath: normalizedPath
      }
    }

    return { isValid: true, resolvedPath: normalizedPath }
  }

  // Write a file with security validation
  async writeFile(relativePath: string, content: string, options: FileWriteOptions = { format: 'markdown' }): Promise<string> {
    const targetPath = join(this.outputBasePath, relativePath)
    const validation = this.validatePath(targetPath)

    if (!validation.isValid) {
      logger.error(`FileWriter security violation: ${validation.reason}`)
      logger.error(`Attempted path: ${targetPath}`)
      throw new Error(`Security violation: ${validation.reason}`)
    }

    const finalPath = validation.resolvedPath

    try {
      // Create directory if needed
      if (options.createDirectories !== false) {
        const dir = dirname(finalPath)
        await fs.mkdir(dir, { recursive: true })
      }

      // Check if file exists and overwrite is disabled
      if (!options.overwrite && existsSync(finalPath)) {
        logger.warn(`File already exists: ${finalPath}`)
        return finalPath
      }

      // Write file
      await fs.writeFile(finalPath, content, { encoding: options.encoding || 'utf8' })

      logger.debug(`File written: ${finalPath}`, { size: content.length, format: options.format })
      return finalPath

    } catch (error) {
      logger.error(`Failed to write file: ${finalPath}`, error)
      throw new Error(`Failed to write file: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Write lock file (special exception for project directory)
  async writeLockFile(content: any): Promise<string> {
    const lockPath = join(this.projectPath, '.documentor.lock')

    try {
      const lockContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2)
      await fs.writeFile(lockPath, lockContent, 'utf8')

      logger.debug(`Lock file written: ${lockPath}`)
      return lockPath

    } catch (error) {
      logger.error(`Failed to write lock file: ${lockPath}`, error)
      throw new Error(`Failed to write lock file: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Write multiple files with transaction-like behavior
  async writeFiles(files: { path: string; content: string; options?: FileWriteOptions }[]): Promise<string[]> {
    const results: string[] = []
    const written: string[] = []

    try {
      for (const file of files) {
        const writtenPath = await this.writeFile(file.path, file.content, file.options)
        results.push(writtenPath)
        written.push(writtenPath)
      }

      logger.success(`Successfully wrote ${files.length} files to ${this.outputBasePath}`)
      return results

    } catch (error) {
      logger.error(`Failed to write files. Wrote ${written.length}/${files.length} files`)
      throw error
    }
  }

  // Create directory structure
  async createDirectoryStructure(structure: string[]): Promise<void> {
    for (const dir of structure) {
      const targetPath = join(this.outputBasePath, dir)
      const validation = this.validatePath(targetPath)

      if (!validation.isValid) {
        logger.error(`Cannot create directory: ${validation.reason}`)
        continue
      }

      try {
        await fs.mkdir(validation.resolvedPath, { recursive: true })
        logger.debug(`Directory created: ${validation.resolvedPath}`)
      } catch (error) {
        logger.warn(`Failed to create directory: ${validation.resolvedPath}`, error)
      }
    }
  }

  // Copy file with security validation
  async copyFile(sourcePath: string, relativePath: string): Promise<string> {
    if (!existsSync(sourcePath)) {
      throw new Error(`Source file does not exist: ${sourcePath}`)
    }

    const targetPath = join(this.outputBasePath, relativePath)
    const validation = this.validatePath(targetPath)

    if (!validation.isValid) {
      logger.error(`FileWriter security violation: ${validation.reason}`)
      throw new Error(`Security violation: ${validation.reason}`)
    }

    try {
      const dir = dirname(validation.resolvedPath)
      await fs.mkdir(dir, { recursive: true })

      await fs.copyFile(sourcePath, validation.resolvedPath)

      logger.debug(`File copied: ${sourcePath} -> ${validation.resolvedPath}`)
      return validation.resolvedPath

    } catch (error) {
      logger.error(`Failed to copy file: ${sourcePath} -> ${validation.resolvedPath}`, error)
      throw new Error(`Failed to copy file: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Get output path info
  getOutputInfo(): { basePath: string; projectName: string; isObsidian: boolean } {
    const projectName = this.projectPath.split('/').pop() || 'unknown'
    return {
      basePath: this.outputBasePath,
      projectName,
      isObsidian: this.outputBasePath.toLowerCase().includes('obsidian')
    }
  }

  // Verify output directory is writable
  async verifyOutputDirectory(): Promise<boolean> {
    try {
      const validation = this.validatePath(this.outputBasePath)
      if (!validation.isValid) {
        logger.error(`Output directory validation failed: ${validation.reason}`)
        return false
      }

      // Create directory if it doesn't exist
      await fs.mkdir(validation.resolvedPath, { recursive: true })

      // Test write access
      const testFile = join(validation.resolvedPath, '.documentor-test')
      await fs.writeFile(testFile, 'test', 'utf8')
      await fs.unlink(testFile)

      logger.debug(`Output directory verified: ${validation.resolvedPath}`)
      return true

    } catch (error) {
      logger.error(`Output directory verification failed: ${this.outputBasePath}`, error)
      return false
    }
  }

  // Get security policy (for debugging)
  getSecurityPolicy(): SecurityPolicy {
    return { ...this.securityPolicy }
  }
}

export default FileWriter
