/**
 * File utilities - Centralized file operations
 * Standardizes all file I/O with consistent encoding and error handling
 */

import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import { existsSync } from 'fs'

// Standardize on 'utf-8' encoding everywhere
const ENCODING = 'utf-8' as const

/**
 * Reads a JSON file
 * @param filePath - Path to JSON file
 * @returns Parsed JSON object
 */
export async function readJson<T = any>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, ENCODING)
  return JSON.parse(content)
}

/**
 * Writes a JSON file
 * @param filePath - Path to JSON file
 * @param data - Data to write
 * @param pretty - Whether to pretty-print
 */
export async function writeJson(filePath: string, data: any, pretty = true): Promise<void> {
  const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data)
  await ensureDir(dirname(filePath))
  await fs.writeFile(filePath, content, ENCODING)
}

/**
 * Reads package.json from a project directory
 * @param projectPath - Project root directory
 * @returns Parsed package.json
 */
export async function readPackageJson(projectPath: string): Promise<any> {
  const packageJsonPath = join(projectPath, 'package.json')
  return readJson(packageJsonPath)
}

/**
 * Checks if package.json exists in directory
 * @param projectPath - Project root directory
 * @returns True if package.json exists
 */
export function hasPackageJson(projectPath: string): boolean {
  return existsSync(join(projectPath, 'package.json'))
}

/**
 * Ensures directory exists, creates if not
 * @param dirPath - Directory path
 */
export async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await fs.mkdir(dirPath, { recursive: true })
  }
}

/**
 * Reads a text file
 * @param filePath - Path to file
 * @returns File content
 */
export async function readTextFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, ENCODING)
}

/**
 * Writes a text file
 * @param filePath - Path to file
 * @param content - Content to write
 */
export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await ensureDir(dirname(filePath))
  await fs.writeFile(filePath, content, ENCODING)
}

/**
 * Safe file exists check
 * @param filePath - Path to check
 * @returns True if file exists and is accessible
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Lists files in directory
 * @param dirPath - Directory path
 * @param recursive - Whether to recurse into subdirectories
 * @returns Array of file paths
 */
export async function listFiles(dirPath: string, recursive = false): Promise<string[]> {
  const files: string[] = []
  
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)
    
    if (entry.isDirectory() && recursive) {
      const subFiles = await listFiles(fullPath, true)
      files.push(...subFiles)
    } else if (entry.isFile()) {
      files.push(fullPath)
    }
  }
  
  return files
}