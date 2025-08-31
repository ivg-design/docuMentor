#!/usr/bin/env node

/**
 * DocuMentor ULTRA - Node.js Worker Process
 * This process is spawned by the Go TUI launcher
 */

import { DocumentProcessor } from '../core/efficient/DocumentProcessor'
import { ProcessorConfig } from '../core/efficient/DocumentProcessor'
import * as readline from 'readline'
import * as path from 'path'

// Check if running in TUI mode (spawned by Go TUI)
const isTUIMode = process.env.TUI_MODE === 'true'

interface CommandMessage {
  type: 'init' | 'start' | 'pause' | 'resume' | 'stop'
  data?: any
}

class DocumentorWorker {
  private processor?: DocumentProcessor
  private rl?: readline.Interface
  
  constructor() {
    if (isTUIMode) {
      this.setupStdinListener()
    }
  }

  /**
   * Setup stdin listener for TUI commands
   */
  private setupStdinListener(): void {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    })

    this.rl.on('line', (line: string) => {
      try {
        const msg: CommandMessage = JSON.parse(line)
        this.handleCommand(msg)
      } catch (error) {
        // Ignore invalid JSON
      }
    })
  }

  /**
   * Handle commands from TUI
   */
  private async handleCommand(msg: CommandMessage): Promise<void> {
    switch (msg.type) {
      case 'init':
        await this.initialize(msg.data)
        break
      case 'start':
        await this.start()
        break
      case 'pause':
        this.pause()
        break
      case 'resume':
        this.resume()
        break
      case 'stop':
        this.stop()
        break
    }
  }

  /**
   * Initialize processor with config
   */
  private async initialize(data: any): Promise<void> {
    const config: ProcessorConfig = {
      projectPath: data.projectPath || process.cwd(),
      outputPath: data.outputPath || path.join(process.env.HOME || '', 'obsidian_vault', 'docs'),
      workers: data.workers || 4,
      enableTUI: isTUIMode,
      claudeApiKey: data.apiKey || process.env.CLAUDE_API_KEY
    }

    // Validate API key
    if (!config.claudeApiKey) {
      this.sendMessage({
        type: 'error',
        data: { message: 'Claude API key not configured' }
      })
      return
    }

    this.processor = new DocumentProcessor(config)
    
    this.sendMessage({
      type: 'ready',
      data: { message: 'Processor initialized' }
    })
  }

  /**
   * Start processing
   */
  private async start(): Promise<void> {
    if (!this.processor) {
      this.sendMessage({
        type: 'error',
        data: { message: 'Processor not initialized' }
      })
      return
    }

    try {
      const stats = await this.processor.process()
      this.sendMessage({
        type: 'complete',
        data: stats
      })
    } catch (error: any) {
      this.sendMessage({
        type: 'error',
        data: { message: error.message }
      })
    }
  }

  /**
   * Pause processing
   */
  private pause(): void {
    if (this.processor) {
      this.processor.pause()
    }
  }

  /**
   * Resume processing
   */
  private resume(): void {
    if (this.processor) {
      this.processor.resume()
    }
  }

  /**
   * Stop and cleanup
   */
  private stop(): void {
    if (this.rl) {
      this.rl.close()
    }
    process.exit(0)
  }

  /**
   * Send message to TUI
   */
  private sendMessage(msg: any): void {
    if (isTUIMode) {
      console.log(JSON.stringify(msg))
    }
  }

  /**
   * Run in standalone mode (no TUI)
   */
  async runStandalone(args: string[]): Promise<void> {
    const projectPath = args[0] || process.cwd()
    const outputPath = args[1] || path.join(process.env.HOME || '', 'obsidian_vault', 'docs')
    
    const config: ProcessorConfig = {
      projectPath: path.resolve(projectPath),
      outputPath: path.resolve(outputPath),
      workers: 4,
      enableTUI: false,
      claudeApiKey: process.env.CLAUDE_API_KEY
    }

    if (!config.claudeApiKey) {
      console.error('ERROR: Claude API key not configured. Set CLAUDE_API_KEY environment variable.')
      process.exit(1)
    }

    const processor = new DocumentProcessor(config)
    
    try {
      console.log('Starting documentation generation...')
      const stats = await processor.process()
      console.log('Complete! Stats:', stats)
    } catch (error: any) {
      console.error('Error:', error.message)
      process.exit(1)
    }
  }
}

// Main entry point
async function main() {
  const worker = new DocumentorWorker()
  
  if (!isTUIMode) {
    // Standalone mode
    await worker.runStandalone(process.argv.slice(2))
  } else {
    // TUI mode - wait for commands
    // Send ready signal
    console.log(JSON.stringify({ type: 'ready' }))
  }
}

// Handle process signals
process.on('SIGINT', () => {
  process.exit(0)
})

process.on('SIGTERM', () => {
  process.exit(0)
})

// Run main
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}