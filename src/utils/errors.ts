/**
 * Error utilities - Centralized error handling patterns
 * Eliminates duplicate error handling code across the codebase
 */

import { Logger } from '../core/Logger'

/**
 * Wraps an unknown error with context
 * @param error - Unknown error (could be Error, string, etc)
 * @param context - Context message for the error
 * @returns Proper Error object with context
 */
export function wrapError(error: unknown, context: string): Error {
  if (error instanceof Error) {
    return new Error(`${context}: ${error.message}`)
  }
  return new Error(`${context}: ${String(error)}`)
}

/**
 * Handles CLI command errors consistently
 * @param error - Error to handle
 * @param commandName - Name of the command that failed
 */
export function handleCLIError(error: unknown, commandName: string): never {
  const errorMessage = error instanceof Error ? error.message : String(error)
  Logger.error(`${commandName} failed: ${errorMessage}`)
  process.exit(1)
}

/**
 * Logs warning and continues execution
 * @param context - Context for the warning
 * @param error - Error that occurred
 */
export function warnAndContinue(context: string, error: unknown): void {
  const errorMessage = error instanceof Error ? error.message : String(error)
  Logger.warn(`${context}: ${errorMessage}`)
}

/**
 * Safe JSON parse with fallback
 * @param content - JSON string to parse
 * @param fallback - Fallback value if parsing fails
 * @returns Parsed object or fallback
 */
export function safeJsonParse<T = any>(content: string, fallback: T): T {
  try {
    return JSON.parse(content)
  } catch {
    return fallback
  }
}

/**
 * Ensures error is an Error object
 * @param error - Unknown error value
 * @returns Error object
 */
export function ensureError(error: unknown): Error {
  if (error instanceof Error) return error
  if (typeof error === 'string') return new Error(error)
  return new Error(String(error))
}

/**
 * Retries an async operation with exponential backoff
 * @param fn - Async function to retry
 * @param maxRetries - Maximum number of retries
 * @param baseDelay - Base delay in milliseconds
 * @returns Result of the function
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = ensureError(error)
      
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError!
}