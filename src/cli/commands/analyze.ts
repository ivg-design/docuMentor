import { Command } from 'commander'
import * as path from 'path'
import { ProjectAnalyzer } from '../../core/ProjectAnalyzer'
import { ProjectTypeDetector } from '../../core/ProjectTypeDetector'
import { FileScanner } from '../../core/FileScanner'
import { logger as display } from '../display'
import { Logger } from '../../core/Logger'
import { getSecureFileOps } from '../../core/SecureFileOps'

export const analyzeCommand = new Command('analyze')
  .description('Analyze project without generating documentation')
  .argument('<path>', 'Path to project to analyze')
  .option('--focus <type>', 'Focus on specific analysis (architecture|dependencies|security|quality)')
  .option('--output <path>', 'Save analysis to file')
  .option('--depth <level>', 'Analysis depth: shallow|normal|deep', 'normal')
  .option('--json', 'Output as JSON')
  .action(async (projectPath: string, options) => {
    try {
      const resolvedPath = path.resolve(projectPath)
      display.info(`Analyzing project: ${resolvedPath}`)

      // Detect project type
      const detector = new ProjectTypeDetector()
      const projectType = await detector.detect(resolvedPath)
      display.info(`Project type: ${projectType}`)

      // Scan files
      const scanner = new FileScanner()
      const scanResult = await scanner.scanDirectory(resolvedPath)
      display.info(`Found ${scanResult.files.length} files`)

      // Analyze project
      const analyzer = new ProjectAnalyzer()
      const analysis = await analyzer.analyze(resolvedPath)

      // Apply focus if specified
      let focusedAnalysis = analysis
      if (options.focus) {
        focusedAnalysis = filterAnalysisByFocus(analysis, options.focus)
      }

      // Output results
      if (options.json) {
        Logger.info(JSON.stringify(focusedAnalysis, null, 2))
      } else {
        displayAnalysisResults(focusedAnalysis)
      }

      // Save to file if requested
      if (options.output) {
        const secureFileOps = getSecureFileOps()
        const result = await secureFileOps.writeFileSecure(
          options.output,
          JSON.stringify(focusedAnalysis, null, 2)
        )
        if (result.success) {
          display.success(`Analysis saved to ${options.output}`)
        } else {
          display.error(`Failed to save analysis: ${result.error?.message}`)
        }
      }

    } catch (error) {
      display.error(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    }
  })

function filterAnalysisByFocus(analysis: any, focus: string): any {
  switch (focus) {
  case 'architecture':
    return {
      projectType: analysis.projectType,
      structure: analysis.structure,
      components: analysis.components
    }
  case 'dependencies':
    return {
      dependencies: analysis.dependencies,
      devDependencies: analysis.devDependencies
    }
  case 'security':
    return {
      permissions: analysis.permissions,
      vulnerabilities: analysis.vulnerabilities
    }
  case 'quality':
    return {
      statistics: analysis.statistics,
      complexity: analysis.complexity,
      testCoverage: analysis.testCoverage
    }
  default:
    return analysis
  }
}

function displayAnalysisResults(analysis: any): void {
  Logger.info('\n📊 Project Analysis Results\n')
  Logger.info(`Type: ${analysis.projectType}`)
  Logger.info(`Files: ${analysis.statistics?.totalFiles || 0}`)
  Logger.info(`Lines: ${analysis.statistics?.totalLines || 0}`)

  if (analysis.statistics?.fileTypeDistribution) {
    Logger.info('\n📁 File Distribution:')
    for (const [type, count] of analysis.statistics.fileTypeDistribution) {
      Logger.info(`  ${type}: ${count} files`)
    }
  }

  if (analysis.skippedFiles?.length > 0) {
    Logger.warn(`\n⚠️  Skipped ${analysis.skippedFiles.length} files due to permissions`)
  }
}
