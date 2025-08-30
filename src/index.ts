// DocuMentor V3.1 - Main Entry Point
// Clean, simple, direct implementation
// NO dependency injection, NO event buses, NO abstractions

import { DocumentEngine } from './core/DocumentEngine.js'
import { loadConfig } from './core/Config.js'
import { Logger } from './core/Logger'
import type { Config } from './types/index.js'

// ============================================================================
// Main Entry Point
// ============================================================================

export async function main(projectPath: string, overrides: Partial<Config> = {}): Promise<void> {
  try {
    // Load configuration
    const config = await loadConfig(projectPath, overrides)

    // Create and run DocumentEngine
    const engine = new DocumentEngine(config)
    await engine.generate(projectPath)

  } catch (error) {
    Logger.error(`Documentation generation failed: ${(error as Error).message}`)
    process.exit(1)
  }
}

// ============================================================================
// CLI Entry Point (when run directly)
// ============================================================================

async function runCLI(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    Logger.error('Usage: documentor <project-path>')
    process.exit(1)
  }

  const projectPath = args[0]

  // Parse basic CLI flags
  const overrides: Partial<Config> = {}

  // --output flag
  const outputIndex = args.indexOf('--output')
  if (outputIndex !== -1 && args[outputIndex + 1]) {
    overrides.output = {
      path: args[outputIndex + 1],
      format: 'obsidian',
      features: {
        frontmatter: true,
        backlinks: true,
        tags: { optimize: true, hierarchy: true, minPerDoc: 3 },
        moc: true,
        dataview: true
      }
    }
  }

  // --no-password flag
  if (args.includes('--no-password')) {
    overrides.permissions = {
      requestPassword: false,
      skipOnDenial: true,
      importantPaths: []
    }
  }

  await main(projectPath, overrides)
}

// ============================================================================
// Exports
// ============================================================================

export { DocumentEngine } from './core/DocumentEngine.js'
export { TUIBridge } from './core/TUIBridge.js'
export { ConfigLoader, loadConfig } from './core/Config.js'
export { ProgressTracker } from './core/ProgressTracker.js'
export * from './types/index.js'

// ============================================================================
// Run CLI if called directly
// ============================================================================

if (require.main === module) {
  runCLI().catch(error => {
    Logger.error(`Fatal error: ${error}`)
    process.exit(1)
  })
}
