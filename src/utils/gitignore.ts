import * as path from 'path'
import * as fs from 'fs/promises'

/**
 * Represents a parsed gitignore rule
 */
interface GitignoreRule {
  pattern: string;
  isNegation: boolean;
  isDirectoryOnly: boolean;
  regex: RegExp;
  original: string;
}

/**
 * Options for gitignore pattern matching
 */
export interface GitignoreOptions {
  /** Whether to match directories only */
  matchDirectories?: boolean;
  /** Whether to use case-sensitive matching */
  caseSensitive?: boolean;
  /** Whether to handle negation patterns */
  handleNegation?: boolean;
}

/**
 * Gitignore pattern matcher with support for standard gitignore syntax
 */
export class GitignoreParser {
  private rules: GitignoreRule[] = []
  private options: Required<GitignoreOptions>

  constructor(options: GitignoreOptions = {}) {
    this.options = {
      matchDirectories: options.matchDirectories ?? true,
      caseSensitive: options.caseSensitive ?? process.platform !== 'win32',
      handleNegation: options.handleNegation ?? true
    }
  }

  /**
   * Loads gitignore patterns from a file
   */
  async loadFromFile(gitignorePath: string): Promise<void> {
    try {
      const content = await fs.readFile(gitignorePath, 'utf-8')
      this.parseContent(content)
    } catch (error) {
      // File doesn't exist or can't be read, ignore silently
      this.rules = []
    }
  }

  /**
   * Loads gitignore patterns from content string
   */
  parseContent(content: string): void {
    const lines = content.split(/\r?\n/)
    this.rules = []

    for (const line of lines) {
      const rule = this.parseLine(line.trim())
      if (rule) {
        this.rules.push(rule)
      }
    }
  }

  /**
   * Adds a pattern directly
   */
  addPattern(pattern: string): void {
    const rule = this.parseLine(pattern)
    if (rule) {
      this.rules.push(rule)
    }
  }

  /**
   * Tests if a path should be ignored
   */
  shouldIgnore(filePath: string, isDirectory: boolean = false): boolean {
    const normalizedPath = this.normalizePath(filePath)
    let ignored = false

    for (const rule of this.rules) {
      if (this.matchesRule(rule, normalizedPath, isDirectory)) {
        ignored = rule.isNegation ? false : true
      }
    }

    return ignored
  }

  /**
   * Tests multiple paths at once
   */
  filterIgnored(paths: string[], isDirectory?: (path: string) => boolean): string[] {
    return paths.filter(filePath => {
      const isDirCheck = isDirectory ? isDirectory(filePath) : false
      return !this.shouldIgnore(filePath, isDirCheck)
    })
  }

  /**
   * Gets all rules for debugging
   */
  getRules(): GitignoreRule[] {
    return [...this.rules]
  }

  /**
   * Parses a single line into a rule
   */
  private parseLine(line: string): GitignoreRule | null {
    // Skip empty lines and comments
    if (!line || line.startsWith('#')) {
      return null
    }

    let pattern = line
    let isNegation = false
    let isDirectoryOnly = false

    // Handle negation
    if (pattern.startsWith('!')) {
      isNegation = true
      pattern = pattern.slice(1)
    }

    // Handle directory-only patterns
    if (pattern.endsWith('/')) {
      isDirectoryOnly = true
      pattern = pattern.slice(0, -1)
    }

    // Skip empty patterns after processing
    if (!pattern) {
      return null
    }

    const regex = this.patternToRegex(pattern)

    return {
      pattern,
      isNegation,
      isDirectoryOnly,
      regex,
      original: line
    }
  }

  /**
   * Converts a gitignore pattern to a regular expression
   */
  private patternToRegex(pattern: string): RegExp {
    let regexPattern = pattern

    // Escape special regex characters except * and ?
    regexPattern = regexPattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')

    // Handle ** (match any number of directories)
    regexPattern = regexPattern.replace(/\*\*/g, '___GLOBSTAR___')

    // Handle * (match any characters except path separator)
    regexPattern = regexPattern.replace(/\*/g, '[^/]*')

    // Handle ? (match any single character except path separator)
    regexPattern = regexPattern.replace(/\?/g, '[^/]')

    // Restore ** handling
    regexPattern = regexPattern.replace(/___GLOBSTAR___/g, '.*')

    // Handle leading slash (absolute path)
    if (pattern.startsWith('/')) {
      regexPattern = '^' + regexPattern.slice(1)
    } else {
      // Pattern can match at any level
      regexPattern = '(?:^|/)' + regexPattern
    }

    // Handle trailing patterns
    regexPattern = regexPattern + '(?:/.*)?$'

    const flags = this.options.caseSensitive ? '' : 'i'
    return new RegExp(regexPattern, flags)
  }

  /**
   * Tests if a rule matches a path
   */
  private matchesRule(rule: GitignoreRule, filePath: string, isDirectory: boolean): boolean {
    // If rule is directory-only but file is not a directory, skip
    if (rule.isDirectoryOnly && !isDirectory) {
      return false
    }

    return rule.regex.test(filePath)
  }

  /**
   * Normalizes a path for consistent matching
   */
  private normalizePath(filePath: string): string {
    // Convert to forward slashes
    let normalized = filePath.replace(/\\/g, '/')

    // Remove leading ./
    if (normalized.startsWith('./')) {
      normalized = normalized.slice(2)
    }

    // Remove leading slash for relative path matching
    if (normalized.startsWith('/')) {
      normalized = normalized.slice(1)
    }

    return normalized
  }
}

/**
 * Utility function to create a gitignore parser from file
 */
export async function createGitignoreParser(
  gitignoreFile: string,
  options: GitignoreOptions = {}
): Promise<GitignoreParser> {
  const parser = new GitignoreParser(options)
  await parser.loadFromFile(gitignoreFile)
  return parser
}

/**
 * Utility function to create a gitignore parser from content
 */
export function createGitignoreParserFromContent(
  content: string,
  options: GitignoreOptions = {}
): GitignoreParser {
  const parser = new GitignoreParser(options)
  parser.parseContent(content)
  return parser
}

/**
 * Standard patterns that are commonly ignored
 */
export const COMMON_IGNORE_PATTERNS = [
  // Dependencies
  'node_modules/',
  'bower_components/',
  'vendor/',

  // Build outputs
  'dist/',
  'build/',
  'out/',
  '.next/',
  '.nuxt/',
  '.output/',

  // Cache and temporary files
  '.cache/',
  'tmp/',
  'temp/',
  '*.tmp',
  '*.temp',
  '.DS_Store',
  'Thumbs.db',

  // Logs
  '*.log',
  'logs/',

  // Runtime data
  'pids/',
  '*.pid',
  '*.seed',

  // Coverage and test outputs
  'coverage/',
  '.nyc_output/',
  '.coverage/',
  'test-results/',

  // IDE and editor files
  '.vscode/',
  '.idea/',
  '*.swp',
  '*.swo',
  '*~',

  // OS generated files
  '.DS_Store',
  '.DS_Store?',
  '._*',
  '.Spotlight-V100',
  '.Trashes',
  'ehthumbs.db',
  'Thumbs.db'
]

/**
 * Creates a parser with common ignore patterns pre-loaded
 */
export function createDefaultGitignoreParser(options: GitignoreOptions = {}): GitignoreParser {
  const parser = new GitignoreParser(options)
  for (const pattern of COMMON_IGNORE_PATTERNS) {
    parser.addPattern(pattern)
  }
  return parser
}

/**
 * Utility class for handling multiple gitignore files (e.g., global, project, subdirectory)
 */
export class MultiGitignoreParser {
  private parsers: { parser: GitignoreParser; basePath: string }[] = []

  /**
   * Adds a gitignore parser for a specific base path
   */
  addParser(parser: GitignoreParser, basePath: string = ''): void {
    this.parsers.push({ parser, basePath: this.normalizePath(basePath) })
  }

  /**
   * Loads gitignore from a file and adds it with the file's directory as base path
   */
  async loadFromFile(gitignoreFile: string, options: GitignoreOptions = {}): Promise<void> {
    const parser = new GitignoreParser(options)
    await parser.loadFromFile(gitignoreFile)
    const basePath = path.dirname(gitignoreFile)
    this.addParser(parser, basePath)
  }

  /**
   * Tests if a path should be ignored by any of the parsers
   */
  shouldIgnore(filePath: string, isDirectory: boolean = false): boolean {
    const normalizedPath = this.normalizePath(filePath)

    for (const { parser, basePath } of this.parsers) {
      // Check if the file is within this parser's scope
      if (basePath === '' || normalizedPath.startsWith(basePath)) {
        // Make path relative to the parser's base path
        const relativePath = basePath === ''
          ? normalizedPath
          : path.relative(basePath, normalizedPath)

        if (parser.shouldIgnore(relativePath, isDirectory)) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Clears all parsers
   */
  clear(): void {
    this.parsers = []
  }

  /**
   * Gets the number of loaded parsers
   */
  getParserCount(): number {
    return this.parsers.length
  }

  private normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/\/$/, '')
  }
}

/**
 * Creates a comprehensive gitignore system with global, project, and custom patterns
 */
export async function createComprehensiveGitignoreParser(
  projectRoot: string,
  options: GitignoreOptions = {}
): Promise<MultiGitignoreParser> {
  const multiParser = new MultiGitignoreParser()

  // Add common patterns
  const commonParser = createDefaultGitignoreParser(options)
  multiParser.addParser(commonParser, '')

  // Try to load project .gitignore
  const projectGitignore = path.join(projectRoot, '.gitignore')
  try {
    await multiParser.loadFromFile(projectGitignore, options)
  } catch (error) {
    // Project .gitignore doesn't exist, continue
  }

  // Try to load .documentor-ignore
  const documentorIgnore = path.join(projectRoot, '.documentor-ignore')
  try {
    await multiParser.loadFromFile(documentorIgnore, options)
  } catch (error) {
    // .documentor-ignore doesn't exist, continue
  }

  return multiParser
}
