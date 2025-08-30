#!/usr/bin/env node

// DocuMentor V3.1 - CLI Entry Point
// Production-ready documentation generator with Claude integration

import { program } from 'commander'
import { logger } from './cli/display'
import { configCommand } from './cli/commands/config'
import { generateCommand } from './cli/commands/generate'
import { watchCommand } from './cli/commands/watch'
import { githubWatchCommand } from './cli/commands/github-watch'
import { selfDocumentCommand } from './cli/commands/self-document'
import { analyzeCommand } from './cli/commands/analyze'
import { verifyCommand } from './cli/commands/verify'

// Set up the main program
program
  .name('documentor')
  .description('DocuMentor - AI-powered documentation generator with Obsidian integration')
  .version('3.1.0')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-q, --quiet', 'Suppress all output except errors')

// Add commands
program.addCommand(configCommand)
program.addCommand(generateCommand)
program.addCommand(watchCommand)
program.addCommand(githubWatchCommand)
program.addCommand(selfDocumentCommand)
program.addCommand(analyzeCommand)
program.addCommand(verifyCommand)

// Handle verbose/quiet flags globally
program.hook('preAction', (thisCommand) => {
  const options = thisCommand.opts()
  if (options.verbose) {
    process.env.DOCUMENTOR_VERBOSE = 'true'
    // TUI handles display modes
  }
  if (options.quiet) {
    process.env.DOCUMENTOR_QUIET = 'true'
    // TUI handles display modes
  }
})

// Error handling
program.exitOverride()

try {
  program.parse(process.argv)
} catch (error: any) {
  if (error.code === 'commander.help') {
    process.exit(0)
  }
  logger.error(`Error: ${error.message}`)
  process.exit(1)
}

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp()
}