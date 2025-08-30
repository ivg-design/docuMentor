import { Command } from 'commander'
import * as path from 'path'
import * as fs from 'fs/promises'
import { ObsidianVerifier } from '../../core/ObsidianVerifier'
import { logger as display } from '../display'

export const verifyCommand = new Command('verify')
  .description('Verify documentation quality and completeness')
  .argument('<path>', 'Path to documentation to verify')
  .option('--check <type>', 'Specific checks: completeness|links|outdated|quality|all', 'all')
  .option('--fix', 'Attempt to fix issues automatically')
  .option('--report <path>', 'Generate verification report')
  .action(async (docPath: string, options) => {
    try {
      const resolvedPath = path.resolve(docPath)
      display.info(`Verifying documentation: ${resolvedPath}`)

      const verifier = new ObsidianVerifier({
        projectName: path.basename(resolvedPath),
        strict: true
      })

      // Get all markdown files
      const files = await findMarkdownFiles(resolvedPath)
      display.info(`Found ${files.length} documentation files`)

      const issues: any[] = []
      let fixed = 0

      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8')
        const doc = { path: file, content }

        const context = { projectName: path.basename(resolvedPath) }
        const result = await verifier.verifyDocument(doc as any, context as any)

        if (!result.passed || result.errors.length > 0) {
          issues.push({
            file: path.relative(resolvedPath, file),
            issues: [...result.errors, ...result.warnings],
            score: result.score
          })

          if (options.fix && result.errors.length > 0) {
            // Attempt fixes
            const fixedContent = await applyFixes(content, [...result.errors, ...result.warnings])
            await fs.writeFile(file, fixedContent)
            fixed++
          }
        }
      }

      // Display results
      if (issues.length === 0) {
        display.success('✅ All documentation verified successfully!')
      } else {
        display.warn(`Found issues in ${issues.length} files`)

        if (!options.report) {
          displayIssues(issues)
        }

        if (options.fix) {
          display.success(`Fixed ${fixed} files`)
        }
      }

      // Generate report if requested
      if (options.report) {
        const report = generateReport(issues, files.length)
        await fs.writeFile(options.report, report)
        display.success(`Report saved to ${options.report}`)
      }

    } catch (error) {
      display.error(`Verification failed: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    }
  })

async function findMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = []

  async function scan(currentPath: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name)

      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        await scan(fullPath)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath)
      }
    }
  }

  await scan(dir)
  return files
}

async function applyFixes(content: string, issues: any[]): Promise<string> {
  let fixed = content

  for (const issue of issues) {
    if (issue.fix) {
      fixed = fixed.replace(issue.location, issue.fix)
    }
  }

  return fixed
}

function displayIssues(issues: any[]): void {
  for (const fileIssues of issues) {
    console.log(`\n📄 ${fileIssues.file}`)
    console.log(`   Score: ${fileIssues.score}%`)

    for (const issue of fileIssues.issues) {
      const icon = issue.type === 'critical' ? '❌' : '⚠️'
      console.log(`   ${icon} ${issue.message}`)
    }
  }
}

function generateReport(issues: any[], totalFiles: number): string {
  const report = [
    '# Documentation Verification Report',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    `- Total Files: ${totalFiles}`,
    `- Files with Issues: ${issues.length}`,
    `- Pass Rate: ${((totalFiles - issues.length) / totalFiles * 100).toFixed(1)}%`,
    '',
    '## Issues by File',
    ''
  ]

  for (const fileIssues of issues) {
    report.push(`### ${fileIssues.file}`)
    report.push(`Score: ${fileIssues.score}%`)
    report.push('')

    for (const issue of fileIssues.issues) {
      report.push(`- **${issue.type}**: ${issue.message}`)
    }
    report.push('')
  }

  return report.join('\n')
}
