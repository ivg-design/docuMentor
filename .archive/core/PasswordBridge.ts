/**
 * PasswordBridge.ts - Secure, transient password handling with Go TUI integration
 *
 * CRITICAL SECURITY RULES:
 * 1. NEVER store passwords anywhere
 * 2. Clear from memory immediately after use
 * 3. No passwords in logs
 * 4. 30-second timeout on prompts
 * 5. User can always cancel
 * 6. Continue gracefully without restricted files
 */

import { EventEmitter } from 'events'
import { spawn, ChildProcess } from 'child_process'
import { promisify } from 'util'
import { randomBytes } from 'crypto'
import { Logger } from './Logger'

/**
 * Password request message format for Go TUI
 */
interface PasswordRequest {
    type: 'password_request';
    requestId: string;
    prompt: string;
    context: string;
    timeout?: number; // Optional timeout in seconds (defaults to 30)
}

/**
 * Password response message format from Go TUI
 */
interface PasswordResponse {
    type: 'password_response';
    requestId: string;
    password?: string;
    cancelled: boolean;
    error?: string;
}

/**
 * Internal pending request tracker
 */
interface PendingRequest {
    resolve: (password: string | null) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
    context: string;
}

/**
 * Sudo execution result
 */
interface SudoResult {
    success: boolean;
    stdout: string;
    stderr: string;
    error?: Error;
}

/**
 * Security utilities for immediate memory clearing
 */
class SecureString {
  private buffer: Buffer | null = null
  private cleared = false

  constructor(value: string) {
    this.buffer = Buffer.from(value, 'utf-8')
    // Immediately clear the input string from V8's string pool (best effort)
    try {
      // Force garbage collection if available (development environments)
      if (global.gc) {
        global.gc()
      }
    } catch (e) {
      // Ignore - gc() not available in production
    }
  }

  /**
     * Get the password value (use immediately and then clear)
     */
  getValue(): string {
    if (this.cleared || !this.buffer) {
      throw new Error('SecureString has been cleared')
    }
    return this.buffer.toString('utf-8')
  }

  /**
     * Immediately clear the password from memory
     */
  clear(): void {
    if (this.buffer) {
      // Overwrite buffer with random data
      const random = randomBytes(this.buffer.length)
      random.copy(this.buffer)
      // Fill with zeros
      this.buffer.fill(0)
      this.buffer = null
    }
    this.cleared = true
  }

  /**
     * Ensure cleanup on destruction
     */
  destroy(): void {
    this.clear()
  }
}

/**
 * Secure password bridge for Go TUI communication
 * Extends EventEmitter for clean async handling
 */
export class PasswordBridge extends EventEmitter {
  private pendingRequests = new Map<string, PendingRequest>()
  private defaultTimeout = 30000 // 30 seconds
  private initialized = false
  private destroyed = false

  constructor() {
    super()
    this.initializeMessageHandling()
  }

  /**
     * Initialize message handling from stdin
     */
  private initializeMessageHandling(): void {
    if (this.initialized) return

    // Listen for responses from Go TUI on stdin
    process.stdin.on('data', (data: Buffer) => {
      try {
        const lines = data.toString().split('\n').filter(line => line.trim())
        for (const line of lines) {
          this.handleIncomingMessage(line)
        }
      } catch (error) {
        this.emit('error', new Error(`Failed to parse TUI response: ${error instanceof Error ? error.message : String(error)}`))
      }
    })

    // Cleanup on process exit
    process.on('exit', () => this.cleanup())
    process.on('SIGINT', () => this.cleanup())
    process.on('SIGTERM', () => this.cleanup())
    process.on('uncaughtException', () => this.cleanup())
    process.on('unhandledRejection', () => this.cleanup())

    this.initialized = true
  }

  /**
     * Handle incoming messages from Go TUI
     */
  private handleIncomingMessage(line: string): void {
    if (!line.trim()) return

    try {
      const message = JSON.parse(line) as PasswordResponse
      if (message.type === 'password_response') {
        this.handlePasswordResponse(message)
      }
    } catch (error) {
      // Not a JSON message or not a password response - ignore
      // This allows other message types to flow through normally
    }
  }

  /**
     * Handle password response from Go TUI
     */
  private handlePasswordResponse(response: PasswordResponse): void {
    const pending = this.pendingRequests.get(response.requestId)
    if (!pending) {
      // Request may have timed out already
      return
    }

    // Clear timeout
    clearTimeout(pending.timeout)
    this.pendingRequests.delete(response.requestId)

    if (response.cancelled) {
      // User cancelled - resolve with null (not an error)
      pending.resolve(null)
      return
    }

    if (response.error) {
      pending.reject(new Error(response.error))
      return
    }

    if (response.password !== undefined) {
      // SUCCESS: Password received
      pending.resolve(response.password)
    } else {
      pending.reject(new Error('Invalid password response: no password or cancellation'))
    }
  }

  /**
     * Generate unique request ID
     */
  private generateRequestId(): string {
    const timestamp = Date.now().toString(36)
    const random = randomBytes(4).toString('hex')
    return `pwd-${timestamp}-${random}`
  }

  /**
     * Send password request to Go TUI
     */
  private sendPasswordRequest(request: PasswordRequest): void {
    const message = JSON.stringify(request) + '\n'

    // Send to Go TUI via stdout
    process.stdout.write(message)

    // Emit event for logging (without sensitive data)
    this.emit('request_sent', {
      requestId: request.requestId,
      context: request.context,
      timeout: request.timeout
    })
  }

  /**
     * Request password from user via Go TUI modal
     * @param prompt - User-friendly prompt message
     * @param context - File/directory context (for display)
     * @param timeoutSeconds - Timeout in seconds (default: 30)
     * @returns Promise<string | null> - Password or null if cancelled
     */
  async requestPassword(prompt: string, context: string, timeoutSeconds = 30): Promise<string | null> {
    if (this.destroyed) {
      throw new Error('PasswordBridge has been destroyed')
    }

    const requestId = this.generateRequestId()
    const timeout = timeoutSeconds * 1000

    return new Promise<string | null>((resolve, reject) => {
      // Set up timeout handler
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        this.emit('request_timeout', { requestId, context })
        resolve(null) // Timeout = user cancelled
      }, timeout)

      // Store pending request
      const pending: PendingRequest = {
        resolve,
        reject,
        timeout: timeoutHandle,
        context
      }
      this.pendingRequests.set(requestId, pending)

      // Send request to Go TUI
      const request: PasswordRequest = {
        type: 'password_request',
        requestId,
        prompt,
        context,
        timeout: timeoutSeconds
      }

      try {
        this.sendPasswordRequest(request)
      } catch (error) {
        clearTimeout(timeoutHandle)
        this.pendingRequests.delete(requestId)
        reject(new Error(`Failed to send password request: ${error instanceof Error ? error.message : String(error)}`))
      }
    })
  }

  /**
     * Execute command with sudo using provided password
     * @param command - Command to execute
     * @param args - Command arguments
     * @param password - Password to use (will be cleared immediately)
     * @returns Promise<SudoResult>
     */
  async sudoExec(command: string, args: string[], password: string): Promise<SudoResult> {
    if (this.destroyed) {
      throw new Error('PasswordBridge has been destroyed')
    }

    // Wrap password in SecureString for immediate clearing
    const securePassword = new SecureString(password)

    // Clear input password parameter (best effort)
    password = '' // Clear parameter

    try {
      return await this.executeSudoCommand(command, args, securePassword)
    } finally {
      // CRITICAL: Always clear password from memory
      securePassword.clear()
    }
  }

  /**
     * Internal sudo execution with SecureString
     */
  private async executeSudoCommand(command: string, args: string[], securePassword: SecureString): Promise<SudoResult> {
    return new Promise<SudoResult>((resolve) => {
      let resolved = false

      const resolveOnce = (result: SudoResult) => {
        if (resolved) return
        resolved = true
        resolve(result)
      }

      // Prepare sudo command
      const sudoArgs = ['-S', command, ...args]
      const sudoProcess = spawn('sudo', sudoArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, LC_ALL: 'C' } // Ensure consistent output
      })

      let stdout = ''
      let stderr = ''
      let passwordSent = false

      // Set up timeout for sudo execution (30 seconds)
      const execTimeout = setTimeout(() => {
        if (!resolved) {
          sudoProcess.kill('SIGTERM')
          resolveOnce({
            success: false,
            stdout,
            stderr,
            error: new Error('Sudo execution timeout')
          })
        }
      }, 30000)

      // Handle stdout
      sudoProcess.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString()
      })

      // Handle stderr and password prompt
      sudoProcess.stderr?.on('data', (data: Buffer) => {
        const output = data.toString()
        stderr += output

        // Check for password prompt (sudo -S expects password on stdin)
        if (!passwordSent && (output.includes('[sudo]') || output.includes('Password'))) {
          try {
            const passwordValue = securePassword.getValue()
            sudoProcess.stdin?.write(passwordValue + '\n')
            passwordSent = true

            // Clear the local variable immediately
            // (Note: securePassword will be cleared by caller)
          } catch (error) {
            clearTimeout(execTimeout)
            resolveOnce({
              success: false,
              stdout,
              stderr,
              error: new Error(`Failed to send password: ${error instanceof Error ? error.message : String(error)}`)
            })
            return
          }
        }
      })

      // Handle process completion
      sudoProcess.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
        clearTimeout(execTimeout)

        const success = code === 0
        const result: SudoResult = {
          success,
          stdout,
          stderr
        }

        if (!success) {
          if (signal) {
            result.error = new Error(`Process killed with signal: ${signal}`)
          } else if (code !== null) {
            result.error = new Error(`Process exited with code: ${code}`)
          } else {
            result.error = new Error('Process terminated unexpectedly')
          }
        }

        resolveOnce(result)
      })

      // Handle process errors
      sudoProcess.on('error', (error: Error) => {
        clearTimeout(execTimeout)
        resolveOnce({
          success: false,
          stdout,
          stderr,
          error: new Error(`Failed to spawn sudo process: ${error instanceof Error ? error.message : String(error)}`)
        })
      })

      // Send password immediately if sudo doesn't prompt (some configurations)
      if (!passwordSent) {
        setTimeout(() => {
          if (!passwordSent && !resolved) {
            try {
              const passwordValue = securePassword.getValue()
              sudoProcess.stdin?.write(passwordValue + '\n')
              passwordSent = true
            } catch (error) {
              // Password might have been cleared already - ignore
            }
          }
        }, 100)
      }
    })
  }

  /**
     * Check if there are pending password requests
     */
  hasPendingRequests(): boolean {
    return this.pendingRequests.size > 0
  }

  /**
     * Cancel all pending password requests
     */
  cancelAllRequests(reason = 'Cancelled by system'): void {
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new Error(reason))
    }
    this.pendingRequests.clear()
    this.emit('all_requests_cancelled', { reason })
  }

  /**
     * Clean up all resources and clear any remaining passwords
     */
  cleanup(): void {
    if (this.destroyed) return

    // Cancel all pending requests
    this.cancelAllRequests('Bridge cleanup')

    // Clear all listeners
    this.removeAllListeners()

    // Mark as destroyed
    this.destroyed = true

    this.emit('cleanup_complete')
  }

  /**
     * Destroy the bridge and clean up
     */
  destroy(): void {
    this.cleanup()
  }
}

/**
 * Create and configure a new PasswordBridge instance
 * @returns PasswordBridge instance
 */
export function createPasswordBridge(): PasswordBridge {
  const bridge = new PasswordBridge()

  // Set up error handling
  bridge.on('error', (error: Error) => {
    Logger.error(`PasswordBridge Error: ${error.message}`)
    // Note: Never log the actual password
  })

  // Set up request logging (safe - no passwords)
  bridge.on('request_sent', (data: { requestId: string; context: string; timeout?: number }) => {
    Logger.debug(`Password requested for: ${data.context} (${data.requestId})`)
  })

  bridge.on('request_timeout', (data: { requestId: string; context: string }) => {
    Logger.debug(`Password request timeout for: ${data.context} (${data.requestId})`)
  })

  return bridge
}

/**
 * Global instance (singleton pattern)
 */
let globalBridge: PasswordBridge | null = null

/**
 * Get the global password bridge instance
 * @returns PasswordBridge instance
 */
export function getPasswordBridge(): PasswordBridge {
  if (!globalBridge) {
    globalBridge = createPasswordBridge()

    // Clean up on process exit
    process.on('exit', () => {
      if (globalBridge) {
        globalBridge.cleanup()
        globalBridge = null
      }
    })
  }

  return globalBridge
}
