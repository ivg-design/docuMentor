/**
 * Base Command Class - Eliminates CLI command boilerplate
 * All commands should extend this class for consistent behavior
 */

import { Command } from 'commander'
import { existsSync, statSync } from 'fs'
import { resolve } from 'path'
import { logger } from './display'
import { handleCLIError } from '../utils/errors'

export interface CommandOptions {
  verbose?: boolean;
  quiet?: boolean;
  json?: boolean;
  output?: string;
}

export abstract class BaseCommand {
  protected command: Command
  protected commandName: string

  constructor(name: string, description: string) {
    this.commandName = name
    this.command = new Command(name)
    this.command.description(description)
    this.setupCommonOptions()
    this.setupAction()
  }

  /**
   * Setup common options available to all commands
   */
  protected setupCommonOptions(): void {
    this.command
      .option('-v, --verbose', 'Enable verbose output')
      .option('-q, --quiet', 'Suppress all output except errors')
      .option('--json', 'Output results as JSON')
  }

  /**
   * Setup the action handler with error handling
   */
  private setupAction(): void {
    this.command.action(async (...args) => {
      try {
        // Set display mode based on options
        const options = args[args.length - 1]
        if (options.quiet) {
          process.env.DISPLAY_MODE = 'quiet'
        } else if (options.verbose) {
          process.env.DISPLAY_MODE = 'debug'
        } else if (options.json) {
          process.env.DISPLAY_MODE = 'raw'
        }

        // Execute the command
        await this.execute(...args)
      } catch (error) {
        handleCLIError(error, this.commandName)
      }
    })
  }

  /**
   * Validate that a path exists
   * @param path - Path to validate
   * @param type - Expected type (file or directory)
   * @returns Resolved absolute path
   */
  protected validatePath(path: string, type: 'file' | 'directory' | 'any' = 'any'): string {
    const resolvedPath = resolve(path)
    
    if (!existsSync(resolvedPath)) {
      throw new Error(`Path does not exist: ${resolvedPath}`)
    }

    const stats = statSync(resolvedPath)
    
    if (type === 'file' && !stats.isFile()) {
      throw new Error(`Expected file but found directory: ${resolvedPath}`)
    }
    
    if (type === 'directory' && !stats.isDirectory()) {
      throw new Error(`Expected directory but found file: ${resolvedPath}`)
    }

    return resolvedPath
  }

  /**
   * Validate output path (creates directory if needed)
   * @param outputPath - Output path to validate
   * @returns Resolved output path
   */
  protected async validateOutputPath(outputPath: string): Promise<string> {
    const resolvedPath = resolve(outputPath)
    const { ensureDir } = await import('../utils/files')
    await ensureDir(resolvedPath)
    return resolvedPath
  }

  /**
   * Log header information for the command
   */
  protected logHeader(title?: string, subtitle?: string): void {
    logger.showHeader(title || this.commandName, subtitle)
  }

  /**
   * Log summary information
   */
  protected logSummary(summary: {
    project: string;
    output: string;
    duration: number;
    files: number;
    success: boolean;
  }): void {
    logger.showSummary(summary)
  }

  /**
   * Abstract method to be implemented by subclasses
   */
  protected abstract execute(...args: any[]): Promise<void>

  /**
   * Get the Commander command instance
   */
  public getCommand(): Command {
    return this.command
  }
}