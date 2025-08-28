#!/usr/bin/env node

import { Command } from 'commander';
import { DocumentationAgent } from './DocumentationAgent';
import { ConfigManager } from './ConfigManager';
import { ProgressMonitor } from './ProgressMonitor';
import { SafetyValidator } from './SafetyValidator';
import { GitHubMonitor } from './GitHubMonitor';
import { FullMontyGenerator } from './FullMontyGenerator';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

const program = new Command();

program
  .name('documentor')
  .description('DocuMentor - Intelligent documentation generator with Obsidian integration')
  .version('2.0.0');

// Generate command
program
  .command('generate')
  .description('Generate documentation for a codebase')
  .argument('[path]', 'Path to the codebase to document')
  .option('-o, --output <path>', 'Output path for documentation')
  .option('--no-verify', 'Skip code functionality verification')
  .option('--update', 'Update existing documentation')
  .option('-e, --exclude <paths...>', 'Additional paths to exclude')
  .action(async (targetPath, options) => {
    try {
      const config = new ConfigManager();
      const safety = new SafetyValidator();
      const progress = new ProgressMonitor();
      
      // Load configuration first to get defaultTargetPath
      const configData = await config.loadConfig();
      
      // Use provided path, or fall back to config defaultTargetPath, or current directory
      const pathToUse = targetPath || configData.defaultTargetPath || process.cwd();
      const resolvedPath = path.resolve(pathToUse);
      
      console.log(`
╔════════════════════════════════════════╗
║          DocuMentor v2.0.0             ║
║   Intelligent Documentation Generator   ║
╚════════════════════════════════════════╝
      `);
      
      // Validate target
      const validation = await safety.validateDirectory(resolvedPath);
      if (!validation.valid) {
        console.error(`❌ Error: ${validation.errors.join(', ')}`);
        process.exit(1);
      }
      
      // Create agent with config
      const agent = new DocumentationAgent({
        targetPath: resolvedPath,
        outputPath: options.output || configData.obsidianVaultPath,
        verifyCode: options.verify !== false,
        updateExisting: options.update,
        excludePaths: options.exclude
      });

      // Set up interrupt handling
      progress.on('interrupt', async () => {
        console.log('⚠️ Documentation interrupted. Saving progress...');
        const state = progress.getProgress();
        await fs.writeFile(
          path.join(os.homedir(), '.documentor', 'interrupted-state.json'),
          JSON.stringify(state, null, 2)
        );
        process.exit(0);
      });

      await agent.generateDocumentation();
      progress.displaySummary();
      progress.cleanup();
      
      console.log(`
✨ Documentation generation complete!
📚 View your documentation in Obsidian at:
   ${options.output || configData.obsidianVaultPath}
      `);
      
    } catch (error) {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    }
  });

// Full Monty command
program
  .command('full-monty')
  .description('Generate comprehensive documentation with all features')
  .argument('[path]', 'Path to document comprehensively')
  .option('-v, --verbose', 'Enable verbose output')
  .action(async (targetPath, options) => {
    try {
      const config = new ConfigManager();
      const configData = await config.loadConfig();
      
      // Use provided path, or fall back to config defaultTargetPath, or current directory
      const pathToUse = targetPath || configData.defaultTargetPath || process.cwd();
      const resolvedPath = path.resolve(pathToUse);
      
      const generator = new FullMontyGenerator(options.verbose || false);
      
      const report = await generator.generate(resolvedPath);
      
      // Save report
      const reportPath = path.join(os.homedir(), '.documentor', 'reports', `full-monty-${Date.now()}.json`);
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      
      console.log(`\n📊 Report saved to: ${reportPath}`);
      
    } catch (error) {
      console.error('❌ Full Monty failed:', error);
      process.exit(1);
    }
  });

// Monitor command
program
  .command('monitor')
  .description('Monitor GitHub repositories for changes')
  .option('--add <repo>', 'Add repository (format: owner/repo)')
  .option('--remove <repo>', 'Remove repository')
  .option('--list', 'List monitored repositories')
  .option('--start', 'Start monitoring')
  .option('--stop', 'Stop monitoring')
  .option('--interval <minutes>', 'Polling interval in minutes', '5')
  .action(async (options) => {
    try {
      const config = new ConfigManager();
      const configData = await config.loadConfig();
      
      const monitor = new GitHubMonitor(
        configData.github.accessToken,
        configData.obsidianVaultPath
      );
      
      // Load previous state
      await monitor.loadState();
      
      if (options.add) {
        const [owner, repo] = options.add.split('/');
        await monitor.addRepository(owner, repo);
        await monitor.saveState();
      }
      
      if (options.remove) {
        const [owner, repo] = options.remove.split('/');
        await monitor.removeRepository(owner, repo);
        await monitor.saveState();
      }
      
      if (options.list) {
        const status = monitor.getStatus();
        console.log('\n📚 Monitored Repositories:');
        status.repositories.forEach((repo: any) => {
          console.log(`  • ${repo.owner}/${repo.repo} (${repo.branch})`);
          console.log(`    Last checked: ${repo.lastChecked || 'Never'}`);
        });
      }
      
      if (options.start) {
        const interval = parseInt(options.interval) * 60 * 1000;
        await monitor.startMonitoring(interval);
        
        // Keep process alive
        process.stdin.resume();
        process.on('SIGINT', () => {
          monitor.stopMonitoring();
          process.exit(0);
        });
      }
      
      if (options.stop) {
        monitor.stopMonitoring();
      }
      
    } catch (error) {
      console.error('❌ Monitor error:', error);
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('Manage DocuMentor configuration')
  .option('--show', 'Show current configuration')
  .option('--edit', 'Open configuration in editor')
  .option('--validate', 'Validate configuration')
  .option('--reset', 'Reset to default configuration')
  .option('--set-path <path>', 'Set default target path')
  .option('--set-vault <path>', 'Set Obsidian vault path')
  .action(async (options) => {
    try {
      const config = new ConfigManager();
      
      if (options.setPath) {
        const newPath = path.resolve(options.setPath);
        const configData = await config.getConfig();
        configData.defaultTargetPath = newPath;
        await config.updateConfig(configData);
        console.log(`✅ Default target path updated to: ${newPath}`);
        return;
      }
      
      if (options.setVault) {
        const newPath = path.resolve(options.setVault);
        const configData = await config.getConfig();
        configData.obsidianVaultPath = newPath;
        await config.updateConfig(configData);
        console.log(`✅ Obsidian vault path updated to: ${newPath}`);
        return;
      }
      
      if (options.show || (!options.edit && !options.validate && !options.reset)) {
        const configData = await config.getConfig();
        console.log('\n📋 Current Configuration:');
        console.log('========================');
        console.log(`📁 Default Target Path: ${configData.defaultTargetPath}`);
        console.log(`📚 Obsidian Vault Path: ${configData.obsidianVaultPath}`);
        console.log(`🔗 GitHub Enabled: ${configData.github.enabled}`);
        console.log(`🏷️  Max Tags: ${configData.maxTags}`);
        console.log(`🛡️  Safety Mode: ${configData.safetyMode.enabled}`);
        console.log('\n💡 Use --edit to modify or --validate to check');
        console.log('   Use --set-path <path> to change default target');
        console.log('   Use --set-vault <path> to change vault location');
        return;
      }
      
      if (options.edit) {
        const configPath = path.join(os.homedir(), '.documentor', 'config.json');
        console.log(`Opening config in default editor: ${configPath}`);
        const { exec } = require('child_process');
        exec(`${process.env.EDITOR || 'nano'} ${configPath}`);
      }
      
      if (options.validate) {
        const validation = await config.validateConfig();
        if (validation.valid) {
          console.log('✅ Configuration is valid');
        } else {
          console.log('❌ Configuration errors:');
          validation.errors.forEach(err => console.log(`  • ${err}`));
        }
      }
      
      if (options.reset) {
        await config.createDefaultConfig();
        console.log('✅ Configuration reset to defaults');
      }
      
    } catch (error) {
      console.error('❌ Config error:', error);
      process.exit(1);
    }
  });

// Safety command
program
  .command('safety')
  .description('Safety and integrity checks')
  .option('--check <path>', 'Check directory safety')
  .option('--backup <path>', 'Create backup of path')
  .option('--restore <backup>', 'Restore from backup')
  .option('--cleanup', 'Clean up old backups')
  .option('--report', 'Show safety report')
  .action(async (options) => {
    try {
      const safety = new SafetyValidator();
      
      if (options.check) {
        const validation = await safety.validateDirectory(options.check);
        console.log('\n🔒 Safety Check Results:');
        console.log(`Valid: ${validation.valid ? '✅' : '❌'}`);
        
        if (validation.errors.length > 0) {
          console.log('\nErrors:');
          validation.errors.forEach(err => console.log(`  ❌ ${err}`));
        }
        
        if (validation.warnings.length > 0) {
          console.log('\nWarnings:');
          validation.warnings.forEach(warn => console.log(`  ⚠️ ${warn}`));
        }
        
        if (validation.suggestions.length > 0) {
          console.log('\nSuggestions:');
          validation.suggestions.forEach(sug => console.log(`  💡 ${sug}`));
        }
      }
      
      if (options.backup) {
        const backupPath = await safety.createBackup(options.backup);
        console.log(`✅ Backup created: ${backupPath}`);
      }
      
      if (options.restore) {
        // Parse format: original:backup
        const [original, backup] = options.restore.split(':');
        await safety.restoreFromBackup(original, backup);
      }
      
      if (options.cleanup) {
        const deleted = await safety.cleanupBackups(7);
        console.log(`🧹 Cleaned up ${deleted} old backups`);
      }
      
      if (options.report) {
        console.log(safety.getSafetyReport());
      }
      
    } catch (error) {
      console.error('❌ Safety error:', error);
      process.exit(1);
    }
  });

// Self-document command
program
  .command('self-document')
  .description('Generate documentation for DocuMentor itself')
  .action(async () => {
    try {
      console.log('📚 Self-documenting DocuMentor...');
      
      const docuMentorPath = path.join(os.homedir(), 'github/docuMentor');
      const generator = new FullMontyGenerator();
      
      // Generate comprehensive documentation
      const report = await generator.generate(docuMentorPath);
      
      // Also copy to obsidian_vault
      const config = new ConfigManager();
      const configData = await config.getConfig();
      const targetPath = path.join(configData.obsidianVaultPath, 'docuMentor');
      
      console.log(`📋 Copying documentation to Obsidian vault: ${targetPath}`);
      
      // Create comprehensive self-documentation
      const selfDoc = `---
title: DocuMentor Documentation
version: 2.0.0
tags: [docuMentor, documentation, tool, self]
---

# DocuMentor - Intelligent Documentation Generator

## 🎯 Overview
DocuMentor is a comprehensive documentation generator that analyzes codebases, verifies functionality, and creates Obsidian-compatible documentation with intelligent tagging and cross-referencing.

## ✨ Features

### Core Features
- **Intelligent Project Analysis**: Automatically detects project types
- **Code Verification**: Validates documented functionality
- **Obsidian Integration**: Full compatibility with backlinks and tags
- **Safety Validation**: Prevents file corruption with backups
- **GitHub Monitoring**: Continuous documentation of commits

### New in v2.0
- **Full Monty Mode**: Comprehensive documentation with quality scores
- **Progress Monitoring**: Real-time progress with interrupt capability
- **Configuration Management**: Auto-generated config with templates
- **Safety Validator**: Protects against file corruption
- **GitHub Monitor**: Tracks and documents repository changes

## 🏗️ Architecture

### Components
- **DocumentationAgent**: Core documentation engine
- **ConfigManager**: Configuration handling with auto-generation
- **ProgressMonitor**: Real-time progress tracking with interrupts
- **SafetyValidator**: File integrity and safety checks
- **GitHubMonitor**: Repository change tracking
- **FullMontyGenerator**: Comprehensive analysis generator
- **ProjectAnalyzer**: Project type detection
- **CodeVerifier**: Functionality validation
- **ObsidianFormatter**: Obsidian-compatible formatting
- **TagManager**: Intelligent tag management

## 📁 Project Structure
\`\`\`
docuMentor/
├── src/
│   ├── index.ts              # CLI interface
│   ├── DocumentationAgent.ts  # Core agent
│   ├── ConfigManager.ts      # Configuration
│   ├── ProgressMonitor.ts    # Progress tracking
│   ├── SafetyValidator.ts    # Safety checks
│   ├── GitHubMonitor.ts      # GitHub integration
│   ├── FullMontyGenerator.ts # Comprehensive docs
│   ├── ProjectAnalyzer.ts    # Project analysis
│   ├── CodeVerifier.ts       # Code verification
│   ├── ObsidianFormatter.ts  # Obsidian formatting
│   ├── TagManager.ts         # Tag management
│   └── claudeCodeClient.ts   # Claude SDK client
├── config/
│   └── (auto-generated)
├── package.json
├── tsconfig.json
└── README.md
\`\`\`

## 🚀 Commands

### Basic Documentation
\`\`\`bash
documentor generate [path]      # Generate documentation
documentor verify [path]        # Verify code functionality
documentor analyze [path]       # Analyze project structure
\`\`\`

### Advanced Features
\`\`\`bash
documentor full-monty [path]    # Comprehensive documentation
documentor monitor --add owner/repo  # Monitor GitHub repo
documentor config --show        # View configuration
documentor safety --check [path] # Safety validation
documentor self-document        # Document DocuMentor itself
\`\`\`

## ⚙️ Configuration

Configuration file: \`~/.documentor/config.json\`

### Key Settings
- **obsidianVaultPath**: Output location for documentation
- **excludePaths**: Paths to exclude from documentation
- **safetyMode**: Backup and validation settings
- **github**: GitHub integration settings
- **monitoring**: Progress and interrupt settings
- **fullMonty**: Comprehensive documentation options

## 🔒 Safety Features

### File Protection
- Automatic backups before writes
- Checksum verification
- Protected path detection
- Sensitive data scanning

### Validation
- JSON/YAML syntax validation
- File size limits
- Directory permission checks
- Content integrity verification

## 📊 Full Monty Mode

Generates comprehensive documentation including:
- Project overview
- Architecture analysis
- API documentation
- Security analysis
- Performance analysis
- Dependency analysis
- Test coverage
- Code metrics
- Changelog generation
- Architecture diagrams

Quality scores provided for:
- Code quality (0-100)
- Documentation coverage (0-100)
- Test coverage (0-100)
- Security score (0-100)

## 🔍 GitHub Monitoring

Continuous monitoring features:
- Automatic commit detection
- Commit analysis and documentation
- File change tracking
- Impact assessment
- Daily summaries

## 🏷️ Tag System

Intelligent tagging with:
- Automatic tag detection
- Tag hierarchy management
- Existing tag reuse
- Tag statistics tracking
- Cross-reference generation

## 📈 Progress Monitoring

Real-time progress with:
- Task tracking
- Interrupt handling (Ctrl+C, ESC)
- Progress persistence
- Auto-save functionality
- Detailed logging

## 🛠️ Development

### Requirements
- Node.js 16+
- Claude Code SDK subscription
- TypeScript 5.0+

### Installation
\`\`\`bash
git clone ~/github/docuMentor
cd ~/github/docuMentor
npm install
npm run build
npm link
\`\`\`

### Testing
\`\`\`bash
documentor generate ./test-project
documentor full-monty ./test-project
\`\`\`

## 📄 License
MIT

## 🤝 Contributing
Contributions welcome! The project uses:
- TypeScript for type safety
- Claude Code SDK for AI analysis
- Commander for CLI
- Async/await for control flow

---
*Generated by DocuMentor v2.0.0*
`;
      
      await fs.mkdir(targetPath, { recursive: true });
      await fs.writeFile(path.join(targetPath, 'README.md'), selfDoc);
      
      console.log('✅ Self-documentation complete!');
      
    } catch (error) {
      console.error('❌ Self-documentation failed:', error);
      process.exit(1);
    }
  });

// Verify command
program
  .command('verify')
  .description('Verify code functionality without generating documentation')
  .argument('[path]', 'Path to the codebase to verify', process.cwd())
  .action(async (targetPath) => {
    try {
      const resolvedPath = path.resolve(targetPath);
      
      console.log(`
🔬 Code Verification Mode
📁 Target: ${resolvedPath}
      `);

      const { CodeVerifier } = await import('./CodeVerifier');
      const { ProjectAnalyzer } = await import('./ProjectAnalyzer');

      const analyzer = new ProjectAnalyzer();
      const verifier = new CodeVerifier();

      const analysis = await analyzer.analyze(resolvedPath);
      const results = await verifier.verifyProject(resolvedPath, analysis);
      
      const report = verifier.generateVerificationReport();
      console.log(report);
      
    } catch (error) {
      console.error('❌ Verification failed:', error);
      process.exit(1);
    }
  });

// Analyze command
program
  .command('analyze')
  .description('Analyze project structure without generating documentation')
  .argument('[path]', 'Path to analyze', process.cwd())
  .action(async (targetPath) => {
    try {
      const resolvedPath = path.resolve(targetPath);
      
      console.log(`
🔍 Project Analysis Mode
📁 Target: ${resolvedPath}
      `);

      const { ProjectAnalyzer } = await import('./ProjectAnalyzer');

      const analyzer = new ProjectAnalyzer();
      const analysis = await analyzer.analyze(resolvedPath);
      
      console.log('\n📊 Analysis Results:');
      console.log(JSON.stringify(analysis, null, 2));
      
    } catch (error) {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    }
  });

// Tags command
program
  .command('tags')
  .description('Manage and view Obsidian tags')
  .option('--generate-index', 'Generate tag index page')
  .option('--scan', 'Scan vault for tags')
  .action(async (options) => {
    try {
      const { TagManager } = await import('./TagManager');
      const vaultPath = path.join(os.homedir(), 'github/obsidian_vault/docs');
      
      const tagManager = new TagManager(vaultPath);
      await tagManager.loadExistingTags();
      
      if (options.generateIndex) {
        const index = await tagManager.generateTagIndex();
        const indexPath = path.join(vaultPath, 'tag-index.md');
        await fs.writeFile(indexPath, index);
        console.log(`✅ Tag index generated at: ${indexPath}`);
      }
      
      if (options.scan) {
        await tagManager.loadExistingTags();
        await tagManager.saveTagRegistry();
        console.log('✅ Tag scan complete');
      }
      
      if (!options.generateIndex && !options.scan) {
        const index = await tagManager.generateTagIndex();
        console.log(index);
      }
      
    } catch (error) {
      console.error('❌ Tag operation failed:', error);
      process.exit(1);
    }
  });

// Add help text
program.addHelpText('after', `

Examples:
  $ documentor generate ~/projects/my-app
  $ documentor full-monty ./
  $ documentor monitor --add facebook/react --start
  $ documentor config --validate
  $ documentor safety --check ~/projects/sensitive
  $ documentor self-document

Configuration:
  Config file: ~/.documentor/config.json
  Backup directory: ~/.documentor/backups
  State files: ~/.documentor/*.json

Features:
  ✅ Automatic project type detection
  ✅ Code functionality verification
  ✅ Obsidian-compatible formatting
  ✅ GitHub repository monitoring
  ✅ Progress tracking with interrupts
  ✅ Safety validation and backups
  ✅ Comprehensive "Full Monty" mode
  ✅ Self-documentation capability
`);

program.parse(process.argv);