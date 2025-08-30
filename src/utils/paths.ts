/**
 * Path utilities - Single source of truth for path operations
 * Eliminates duplication across config.ts, FileWriter.ts, and Config.ts
 */

import { join } from 'path'
import { homedir } from 'os'

/**
 * Expands path with tilde and environment variables
 * @param path - Path to expand
 * @returns Expanded absolute path
 */
export function expandPath(path: string): string {
  if (!path) return path
  
  // Expand tilde to home directory
  if (path.startsWith('~/')) {
    path = join(homedir(), path.slice(2))
  }
  
  // Expand environment variables
  path = path.replace(/\$(\w+)/g, (match, varName) => {
    return process.env[varName] || match
  })
  
  // Handle ${VAR} syntax
  path = path.replace(/\$\{(\w+)\}/g, (match, varName) => {
    return process.env[varName] || match
  })
  
  return path
}

/**
 * Resolves tilde in path
 * @param path - Path with potential tilde
 * @returns Path with tilde expanded
 */
export function resolveTilde(path: string): string {
  if (path.startsWith('~/')) {
    return join(homedir(), path.slice(2))
  }
  return path
}

/**
 * Normalizes path separators for the current OS
 * @param path - Path to normalize
 * @returns Normalized path
 */
export function normalizePath(path: string): string {
  return path.replace(/[/\\]+/g, '/')
}