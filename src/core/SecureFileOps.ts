/**
 * SecureFileOps.ts - Secure file operations with permission handling
 *
 * CRITICAL SECURITY RULES:
 * 1. NEVER store passwords anywhere
 * 2. Clear from memory immediately after use
 * 3. No passwords in logs
 * 4. 30-second timeout on prompts
 * 5. User can always cancel
 * 6. Continue gracefully without restricted files
 */

import { promises as fs, constants as fsConstants, Stats } from 'fs'
import { dirname, join, relative, resolve, basename } from 'path'
import { access, readdir, stat, readFile, writeFile } from 'fs/promises'
import { EventEmitter } from 'events'
import { getPasswordBridge, PasswordBridge } from './PasswordBridge'

/**
 * File access result types
 */
export interface FileAccessResult {
    success: boolean;
    content?: string | Buffer;
    error?: Error;
    skipped?: boolean;
    usedSudo?: boolean;
}

export interface DirectoryScanResult {
    accessible: string[];
    skipped: string[];
    errors: Array<{ path: string; error: Error }>;
    totalProcessed: number;
    usedSudo: boolean;
}

export interface FileStats {
    path: string;
    stats: Stats;
    accessible: boolean;
    isDirectory: boolean;
    size: number;
    modified: Date;
}

/**
 * Permission check result
 */
interface PermissionCheck {
    readable: boolean;
    writable: boolean;
    executable: boolean;
    exists: boolean;
    requiresSudo: boolean;
    error?: Error;
}

/**
 * Important path patterns that warrant password requests
 */
const IMPORTANT_PATHS = [
  // System configuration
  '/etc/',
  '/usr/local/etc/',
  '/opt/homebrew/etc/',

  // User directories that might need elevated access
  '/usr/local/',
  '/opt/',

  // Common development paths
  '/var/log/',
  '/usr/share/',

  // Package managers
  'node_modules/',
  '.git/',

  // Configuration files
  '.env',
  'config/',
  'configs/',
  '.config/',

  // Docker and virtualization
  'docker-compose.yml',
  'Dockerfile',
  '.docker/',

  // Build and deployment
  'build/',
  'dist/',
  'target/',
  'out/',
  '.next/',
  '.nuxt/',

  // Documentation and important files
  'README',
  'CHANGELOG',
  'LICENSE',
  'docs/',
  'documentation/'
]

/**
 * Patterns to skip (never request password for these)
 */
const SKIP_PATTERNS = [
  'node_modules/.cache/',
  'node_modules/.bin/',
  '.git/objects/',
  '.git/refs/',
  '.DS_Store',
  'Thumbs.db',
  '*.tmp',
  '*.temp',
  '*.swp',
  '*.log',
  '*.pid',
  '.npm/',
  '.yarn/',
  '.pnpm/',
  'coverage/',
  '.nyc_output/',
  '*.min.js',
  '*.min.css'
]

/**
 * Secure file operations with permission handling
 */
export class SecureFileOps extends EventEmitter {
  private passwordBridge: PasswordBridge
  private passwordCache = new Map<string, number>() // Context -> timestamp (for rate limiting)
  private maxPasswordAttempts = 3
  private passwordCacheTimeout = 300000 // 5 minutes
  private destroyed = false

  constructor(passwordBridge?: PasswordBridge) {
    super()
    this.passwordBridge = passwordBridge || getPasswordBridge()

    // Clean up cache periodically
    setInterval(() => this.cleanPasswordCache(), this.passwordCacheTimeout)

    // Clean up on process exit
    process.on('exit', () => this.cleanup())
    process.on('SIGINT', () => this.cleanup())
    process.on('SIGTERM', () => this.cleanup())
  }

  /**
     * Clean expired entries from password cache
     */
  private cleanPasswordCache(): void {
    const now = Date.now()
    for (const [context, timestamp] of this.passwordCache) {
      if (now - timestamp > this.passwordCacheTimeout) {
        this.passwordCache.delete(context)
      }
    }
  }

  /**
     * Check if a path is important enough to warrant a password request
     */
  private isImportantPath(filePath: string): boolean {
    const normalizedPath = resolve(filePath)
    const relativePath = relative(process.cwd(), normalizedPath)

    // Check against important patterns
    return IMPORTANT_PATHS.some(pattern => {
      if (pattern.endsWith('/')) {
        // Directory pattern
        return normalizedPath.includes(pattern) || relativePath.startsWith(pattern.slice(0, -1))
      } else {
        // File pattern
        return normalizedPath.includes(pattern) ||
                       relativePath.includes(pattern) ||
                       basename(normalizedPath).includes(pattern)
      }
    })
  }

  /**
     * Check if a path should be skipped (never request password)
     */
  private shouldSkipPath(filePath: string): boolean {
    const normalizedPath = resolve(filePath)
    const relativePath = relative(process.cwd(), normalizedPath)
    const fileName = basename(normalizedPath)

    return SKIP_PATTERNS.some(pattern => {
      if (pattern.includes('*')) {
        // Wildcard pattern
        const regex = new RegExp(pattern.replace(/\*/g, '.*'))
        return regex.test(fileName) || regex.test(relativePath)
      } else if (pattern.endsWith('/')) {
        // Directory pattern
        return relativePath.includes(pattern) || normalizedPath.includes(pattern)
      } else {
        // Exact pattern
        return relativePath.includes(pattern) ||
                       normalizedPath.includes(pattern) ||
                       fileName === pattern
      }
    })
  }

  /**
     * Check file permissions without sudo
     */
  private async checkPermissions(filePath: string): Promise<PermissionCheck> {
    const result: PermissionCheck = {
      readable: false,
      writable: false,
      executable: false,
      exists: false,
      requiresSudo: false
    }

    try {
      await access(filePath, fsConstants.F_OK)
      result.exists = true

      // Check read permission
      try {
        await access(filePath, fsConstants.R_OK)
        result.readable = true
      } catch (error) {
        result.requiresSudo = true
      }

      // Check write permission
      try {
        await access(filePath, fsConstants.W_OK)
        result.writable = true
      } catch (error) {
        // Write permission failure doesn't necessarily require sudo for reading
      }

      // Check execute permission
      try {
        await access(filePath, fsConstants.X_OK)
        result.executable = true
      } catch (error) {
        // Execute permission failure doesn't necessarily require sudo for reading
      }

    } catch (error) {
      result.error = error as Error
      // File doesn't exist or no permission to check
      result.requiresSudo = true
    }

    return result
  }

  /**
     * Request password with rate limiting and caching
     */
  private async requestPasswordIfNeeded(context: string, filePath: string): Promise<string | null> {
    // Check if we recently failed to get password for this context
    const cacheKey = `${context}:${dirname(filePath)}`
    const lastAttempt = this.passwordCache.get(cacheKey)
    const now = Date.now()

    if (lastAttempt && (now - lastAttempt) < 60000) { // 1 minute cooldown
      this.emit('password_rate_limited', { context, path: filePath })
      return null
    }

    // Check if path should be skipped
    if (this.shouldSkipPath(filePath)) {
      this.emit('path_skipped', { path: filePath, reason: 'skip_pattern' })
      return null
    }

    // Check if path is important enough for password request
    if (!this.isImportantPath(filePath)) {
      this.emit('path_skipped', { path: filePath, reason: 'not_important' })
      return null
    }

    try {
      const prompt = `Permission needed to access ${context}`
      const password = await this.passwordBridge.requestPassword(prompt, filePath)

      if (password === null) {
        // User cancelled - cache the decision
        this.passwordCache.set(cacheKey, now)
        this.emit('password_cancelled', { context, path: filePath })
        return null
      }

      this.emit('password_received', { context, path: filePath })
      return password
    } catch (error) {
      // Error getting password - cache the failure
      this.passwordCache.set(cacheKey, now)
      this.emit('password_error', { context, path: filePath, error })
      return null
    }
  }

  /**
     * Attempt to read file with permission handling
     */
  async readFileSecure(filePath: string, encoding: BufferEncoding = 'utf8'): Promise<FileAccessResult> {
    if (this.destroyed) {
      return { success: false, error: new Error('SecureFileOps destroyed') }
    }

    const absolutePath = resolve(filePath)

    // First, try normal read
    try {
      const content = await readFile(absolutePath, encoding)
      this.emit('file_read_success', { path: absolutePath, method: 'normal' })
      return { success: true, content }
    } catch (error) {
      const err = error as NodeJS.ErrnoException

      // Check if it's a permission error
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        this.emit('permission_denied', { path: absolutePath, operation: 'read' })

        // Request password for sudo access
        const password = await this.requestPasswordIfNeeded('file reading', absolutePath)

        if (!password) {
          return {
            success: false,
            skipped: true,
            error: new Error('Access denied and no password provided')
          }
        }

        // Try with sudo
        try {
          const result = await this.passwordBridge.sudoExec('cat', [absolutePath], password)

          if (result.success) {
            this.emit('file_read_success', { path: absolutePath, method: 'sudo' })
            return {
              success: true,
              content: encoding === 'utf8' ? result.stdout : Buffer.from(result.stdout),
              usedSudo: true
            }
          } else {
            this.emit('sudo_failed', { path: absolutePath, operation: 'read', error: result.error })
            return {
              success: false,
              error: result.error || new Error('Sudo read failed'),
              usedSudo: true
            }
          }
        } catch (sudoError) {
          this.emit('sudo_error', { path: absolutePath, operation: 'read', error: sudoError })
          return {
            success: false,
            error: sudoError as Error,
            usedSudo: true
          }
        }
      } else {
        // Non-permission error (file not found, etc.)
        this.emit('file_error', { path: absolutePath, operation: 'read', error: err })
        return { success: false, error: err }
      }
    }
  }

  /**
     * Attempt to write file with permission handling
     */
  async writeFileSecure(filePath: string, content: string | Buffer, encoding: BufferEncoding = 'utf8'): Promise<FileAccessResult> {
    if (this.destroyed) {
      return { success: false, error: new Error('SecureFileOps destroyed') }
    }

    const absolutePath = resolve(filePath)

    // Ensure directory exists
    try {
      await fs.mkdir(dirname(absolutePath), { recursive: true })
    } catch (error) {
      // Directory creation might require sudo - handle below
    }

    // First, try normal write
    try {
      await writeFile(absolutePath, content, encoding)
      this.emit('file_write_success', { path: absolutePath, method: 'normal' })
      return { success: true }
    } catch (error) {
      const err = error as NodeJS.ErrnoException

      // Check if it's a permission error
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        this.emit('permission_denied', { path: absolutePath, operation: 'write' })

        // Request password for sudo access
        const password = await this.requestPasswordIfNeeded('file writing', absolutePath)

        if (!password) {
          return {
            success: false,
            skipped: true,
            error: new Error('Access denied and no password provided')
          }
        }

        // Create temporary file and move with sudo
        try {
          const tempFile = `/tmp/documentor-${Date.now()}-${Math.random().toString(36).slice(2)}`
          await writeFile(tempFile, content, encoding)

          const result = await this.passwordBridge.sudoExec('cp', [tempFile, absolutePath], password)

          // Clean up temp file
          try {
            await fs.unlink(tempFile)
          } catch (cleanupError) {
            // Ignore cleanup errors
          }

          if (result.success) {
            this.emit('file_write_success', { path: absolutePath, method: 'sudo' })
            return { success: true, usedSudo: true }
          } else {
            this.emit('sudo_failed', { path: absolutePath, operation: 'write', error: result.error })
            return {
              success: false,
              error: result.error || new Error('Sudo write failed'),
              usedSudo: true
            }
          }
        } catch (sudoError) {
          this.emit('sudo_error', { path: absolutePath, operation: 'write', error: sudoError })
          return {
            success: false,
            error: sudoError as Error,
            usedSudo: true
          }
        }
      } else {
        // Non-permission error
        this.emit('file_error', { path: absolutePath, operation: 'write', error: err })
        return { success: false, error: err }
      }
    }
  }

  /**
     * Get file stats with permission handling
     */
  async getFileStats(filePath: string): Promise<FileStats | null> {
    if (this.destroyed) {
      return null
    }

    const absolutePath = resolve(filePath)

    try {
      const stats = await stat(absolutePath)
      return {
        path: absolutePath,
        stats,
        accessible: true,
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modified: stats.mtime
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException

      if (err.code === 'EACCES' || err.code === 'EPERM') {
        // Try with sudo if it's an important path
        const password = await this.requestPasswordIfNeeded('file information', absolutePath)

        if (password) {
          try {
            const result = await this.passwordBridge.sudoExec('stat', ['-c', '%Y %s %F', absolutePath], password)

            if (result.success) {
              const [mtime, size, type] = result.stdout.trim().split(' ')
              const isDirectory = type.includes('directory')

              return {
                path: absolutePath,
                stats: {
                  size: parseInt(size, 10),
                  mtime: new Date(parseInt(mtime, 10) * 1000),
                  isDirectory: () => isDirectory
                } as Stats,
                accessible: false, // Accessible only with sudo
                isDirectory,
                size: parseInt(size, 10),
                modified: new Date(parseInt(mtime, 10) * 1000)
              }
            }
          } catch (sudoError) {
            this.emit('sudo_error', { path: absolutePath, operation: 'stat', error: sudoError })
          }
        }
      }

      return null
    }
  }

  /**
     * Scan directory with permission handling
     */
  async scanDirectory(dirPath: string, options: {
        recursive?: boolean;
        includeHidden?: boolean;
        maxDepth?: number;
        fileFilter?: (path: string) => boolean;
    } = {}): Promise<DirectoryScanResult> {
    if (this.destroyed) {
      return {
        accessible: [],
        skipped: [],
        errors: [],
        totalProcessed: 0,
        usedSudo: false
      }
    }

    const {
      recursive = true,
      includeHidden = false,
      maxDepth = 10,
      fileFilter
    } = options

    const result: DirectoryScanResult = {
      accessible: [],
      skipped: [],
      errors: [],
      totalProcessed: 0,
      usedSudo: false
    }

    await this.scanDirectoryRecursive(
      resolve(dirPath),
      result,
      0,
      maxDepth,
      recursive,
      includeHidden,
      fileFilter
    )

    return result
  }

  /**
     * Recursive directory scanning implementation
     */
  private async scanDirectoryRecursive(
    dirPath: string,
    result: DirectoryScanResult,
    currentDepth: number,
    maxDepth: number,
    recursive: boolean,
    includeHidden: boolean,
    fileFilter?: (path: string) => boolean
  ): Promise<void> {
    if (currentDepth > maxDepth) return

    try {
      // Try normal directory read
      const entries = await readdir(dirPath)

      for (const entry of entries) {
        if (!includeHidden && entry.startsWith('.')) continue

        const fullPath = join(dirPath, entry)
        result.totalProcessed++

        // Apply file filter if provided
        if (fileFilter && !fileFilter(fullPath)) {
          result.skipped.push(fullPath)
          continue
        }

        try {
          const stats = await stat(fullPath)
          result.accessible.push(fullPath)

          // Recursively scan subdirectories
          if (recursive && stats.isDirectory()) {
            await this.scanDirectoryRecursive(
              fullPath,
              result,
              currentDepth + 1,
              maxDepth,
              recursive,
              includeHidden,
              fileFilter
            )
          }
        } catch (statError) {
          const err = statError as NodeJS.ErrnoException
          if (err.code === 'EACCES' || err.code === 'EPERM') {
            // Try with sudo if important
            const password = await this.requestPasswordIfNeeded('directory scanning', fullPath)

            if (password) {
              try {
                const sudoResult = await this.passwordBridge.sudoExec('ls', ['-la', fullPath], password)
                if (sudoResult.success) {
                  result.accessible.push(fullPath)
                  result.usedSudo = true
                } else {
                  result.skipped.push(fullPath)
                  result.errors.push({ path: fullPath, error: err })
                }
              } catch (sudoError) {
                result.skipped.push(fullPath)
                result.errors.push({ path: fullPath, error: sudoError as Error })
              }
            } else {
              result.skipped.push(fullPath)
            }
          } else {
            result.errors.push({ path: fullPath, error: err })
          }
        }
      }

    } catch (error) {
      const err = error as NodeJS.ErrnoException

      if (err.code === 'EACCES' || err.code === 'EPERM') {
        this.emit('permission_denied', { path: dirPath, operation: 'scan' })

        // Try with sudo for directory listing
        const password = await this.requestPasswordIfNeeded('directory access', dirPath)

        if (password) {
          try {
            const sudoResult = await this.passwordBridge.sudoExec('find', [dirPath, '-maxdepth', '1'], password)
            if (sudoResult.success) {
              const entries = sudoResult.stdout.trim().split('\n')
                .filter(line => line && line !== dirPath)
                .map(line => basename(line))

              for (const entry of entries) {
                if (!includeHidden && entry.startsWith('.')) continue

                const fullPath = join(dirPath, entry)
                result.totalProcessed++
                result.accessible.push(fullPath)
              }
              result.usedSudo = true
            } else {
              result.errors.push({ path: dirPath, error: err })
            }
          } catch (sudoError) {
            result.errors.push({ path: dirPath, error: sudoError as Error })
          }
        }
      } else {
        result.errors.push({ path: dirPath, error: err })
      }
    }
  }

  /**
     * Helper to safely try an operation with permission handling
     */
  async tryWithPermission<T>(
    operation: () => Promise<T>,
    context: string,
    filePath: string,
    sudoFallback?: (password: string) => Promise<T>
  ): Promise<T | null> {
    if (this.destroyed) {
      return null
    }

    try {
      return await operation()
    } catch (error) {
      const err = error as NodeJS.ErrnoException

      if ((err.code === 'EACCES' || err.code === 'EPERM') && sudoFallback) {
        const password = await this.requestPasswordIfNeeded(context, filePath)

        if (password) {
          try {
            const result = await sudoFallback(password)
            this.emit('sudo_success', { context, path: filePath })
            return result
          } catch (sudoError) {
            this.emit('sudo_error', { context, path: filePath, error: sudoError })
            return null
          }
        }
      }

      this.emit('operation_failed', { context, path: filePath, error: err })
      return null
    }
  }

  /**
     * Clean up resources
     */
  cleanup(): void {
    if (this.destroyed) return

    this.passwordCache.clear()
    this.removeAllListeners()
    this.destroyed = true

    this.emit('cleanup_complete')
  }

  /**
     * Destroy the instance
     */
  destroy(): void {
    this.cleanup()
  }
}

/**
 * Create a new SecureFileOps instance
 */
export function createSecureFileOps(passwordBridge?: PasswordBridge): SecureFileOps {
  return new SecureFileOps(passwordBridge)
}

/**
 * Global instance (singleton pattern)
 */
let globalSecureFileOps: SecureFileOps | null = null

/**
 * Get the global secure file operations instance
 */
export function getSecureFileOps(): SecureFileOps {
  if (!globalSecureFileOps) {
    globalSecureFileOps = createSecureFileOps()

    // Clean up on process exit
    process.on('exit', () => {
      if (globalSecureFileOps) {
        globalSecureFileOps.cleanup()
        globalSecureFileOps = null
      }
    })
  }

  return globalSecureFileOps
}
