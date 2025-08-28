import * as path from 'path';
import * as fs from 'fs/promises';
import { ProjectAnalyzer } from './ProjectAnalyzer';
import { ObsidianFormatter } from './ObsidianFormatter';
import { CodeVerifier } from './CodeVerifier';
import { TagManager } from './TagManager';
import { queryClaudeCode } from './claudeCodeClient';

export interface DocConfig {
  targetPath: string;
  outputPath?: string;
  excludePaths?: string[];
  verifyCode?: boolean;
  includeTests?: boolean;
  updateExisting?: boolean;
}

export class DocumentationAgent {
  private config: DocConfig;
  private projectAnalyzer: ProjectAnalyzer;
  private obsidianFormatter: ObsidianFormatter;
  private codeVerifier: CodeVerifier;
  private tagManager: TagManager;
  private obsidianVaultPath = path.join(process.env.HOME!, 'github/obsidian_vault/docs');

  constructor(config: DocConfig) {
    this.config = {
      ...config,
      outputPath: config.outputPath || this.obsidianVaultPath,
      excludePaths: [
        ...(config.excludePaths || []),
        path.join(process.env.HOME!, 'github/docuMentor'),
        path.join(process.env.HOME!, 'github/obsidian_vault'),
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**'
      ],
      verifyCode: config.verifyCode !== false
    };

    this.projectAnalyzer = new ProjectAnalyzer();
    this.obsidianFormatter = new ObsidianFormatter();
    this.codeVerifier = new CodeVerifier();
    this.tagManager = new TagManager(this.obsidianVaultPath);
  }

  async generateDocumentation(): Promise<void> {
    console.log('🚀 DocuMentor starting analysis...');
    console.log(`📁 Target: ${this.config.targetPath}`);
    console.log(`📝 Output: ${this.config.outputPath}`);

    try {
      // Step 1: Analyze project structure and type
      const projectAnalysis = await this.analyzeProject();
      
      // Step 2: Load existing tags from Obsidian vault
      await this.tagManager.loadExistingTags();
      
      // Step 3: Check existing documentation (use as reference, not truth)
      const existingDocs = await this.checkExistingDocumentation();
      
      // Step 4: Verify code functionality if enabled
      if (this.config.verifyCode) {
        await this.verifyCodeFunctionality(projectAnalysis);
      }
      
      // Step 5: Generate documentation based on project type
      const documentation = await this.generateDocsForProjectType(projectAnalysis, existingDocs);
      
      // Step 6: Format for Obsidian with tags and links
      const formattedDocs = await this.formatForObsidian(documentation, projectAnalysis);
      
      // Step 7: Save documentation with proper structure
      await this.saveDocumentation(formattedDocs, projectAnalysis);
      
      // Step 8: Update tag registry
      await this.tagManager.saveTagRegistry();
      
      console.log('✅ Documentation generation complete!');
      console.log(`📚 View in Obsidian: ${this.config.outputPath}`);
      
    } catch (error) {
      console.error('❌ Error generating documentation:', error);
      throw error;
    }
  }

  private async analyzeProject(): Promise<any & { versionControl?: any; projectType?: string }> {
    console.log('🔍 Analyzing project structure...');
    
    const analysis = await this.projectAnalyzer.analyze(this.config.targetPath);
    
    // Determine if it's GitHub synced
    const isGitRepo = await this.checkGitStatus();
    analysis.versionControl = isGitRepo;
    
    // Detect project type
    analysis.projectType = await this.detectProjectType(analysis);
    
    console.log(`📊 Project type: ${analysis.projectType}`);
    console.log(`🔗 Git synced: ${isGitRepo.isGitRepo}`);
    
    return analysis;
  }

  private async checkGitStatus(): Promise<any> {
    const gitCheck = await queryClaudeCode(`
      Check if ${this.config.targetPath} is a git repository:
      1. Look for .git directory
      2. Check for remote origin
      3. Get current branch
      4. Check if it's GitHub synced
      Return as JSON with: isGitRepo, hasRemote, remoteUrl, branch
    `);
    
    return JSON.parse(gitCheck);
  }

  private async detectProjectType(analysis: any): Promise<string> {
    const detection = await queryClaudeCode(`
      Based on this project analysis, determine the project type:
      ${JSON.stringify(analysis)}
      
      Possible types:
      - single-project: One cohesive application/library
      - multi-tool: Multiple independent scripts/tools
      - monorepo: Multiple related packages with shared dependencies
      - library: Reusable code library/package
      - application: Standalone application
      - scripts-collection: Collection of utility scripts
      
      Also check for:
      - Workspace configurations (npm, yarn, pnpm workspaces)
      - Multiple package.json files
      - Lerna, Rush, Nx configurations
      
      Return the most appropriate type.
    `);
    
    return detection.trim();
  }

  private async checkExistingDocumentation(): Promise<any> {
    console.log('📖 Checking existing documentation...');
    
    const existingDocs = await queryClaudeCode(`
      Search for existing documentation in ${this.config.targetPath}:
      1. README files at any level
      2. docs/ or documentation/ directories
      3. Wiki references
      4. API documentation
      5. CHANGELOG, CONTRIBUTING files
      
      Extract key information but note that code verification will validate claims.
      Return findings as structured data.
    `);
    
    return existingDocs;
  }

  private async verifyCodeFunctionality(analysis: any): Promise<void> {
    console.log('✅ Verifying code functionality...');
    
    await this.codeVerifier.verifyProject(this.config.targetPath, analysis);
  }

  private async generateDocsForProjectType(analysis: any, existingDocs: any): Promise<any> {
    console.log('📝 Generating documentation...');
    
    const strategy = this.getDocumentationStrategy(analysis.projectType);
    
    const documentation = await queryClaudeCode(`
      Generate comprehensive documentation for this ${analysis.projectType} project.
      
      Project analysis: ${JSON.stringify(analysis)}
      Existing docs (reference only): ${JSON.stringify(existingDocs)}
      
      Documentation structure required:
      ${JSON.stringify(strategy)}
      
      IMPORTANT:
      - Verify all code claims by reading actual implementation
      - Document only working, verified functionality
      - Include code examples from actual codebase
      - Note deprecated or non-functional code
      - Create accurate architecture descriptions
      - Generate honest API documentation
      
      Return as structured JSON matching the strategy.
    `);
    
    return JSON.parse(documentation);
  }

  private getDocumentationStrategy(projectType: string): any {
    const strategies = {
      'single-project': {
        structure: ['README', 'Architecture', 'API', 'Setup', 'Usage', 'Contributing'],
        depth: 'detailed',
        organization: 'flat'
      },
      'multi-tool': {
        structure: ['Overview', 'Tools/*', 'Common', 'Setup'],
        depth: 'tool-focused',
        organization: 'hierarchical'
      },
      'monorepo': {
        structure: ['Root', 'Packages/*', 'Shared', 'Architecture', 'Development'],
        depth: 'package-detailed',
        organization: 'nested'
      },
      'library': {
        structure: ['README', 'API', 'Examples', 'Advanced', 'Migration'],
        depth: 'api-focused',
        organization: 'flat'
      },
      'scripts-collection': {
        structure: ['Index', 'Scripts/*', 'Usage', 'Development'],
        depth: 'script-focused',
        organization: 'categorized'
      }
    };
    
    return strategies[projectType as keyof typeof strategies] || strategies['single-project'];
  }

  private async formatForObsidian(documentation: any, analysis: any): Promise<any> {
    console.log('🔗 Formatting for Obsidian...');
    
    // Get appropriate tags from TagManager
    const tags = await this.tagManager.getTagsForProject(analysis);
    
    // Format with Obsidian features
    return await this.obsidianFormatter.format(documentation, {
      projectName: path.basename(this.config.targetPath),
      projectType: analysis.projectType,
      tags: tags,
      createBacklinks: true,
      addMetadata: true,
      linkToRelated: true
    });
  }

  private async saveDocumentation(formattedDocs: any, analysis: any): Promise<void> {
    console.log('💾 Saving documentation...');
    
    const projectName = path.basename(this.config.targetPath);
    const projectDocsPath = path.join(this.config.outputPath!, projectName);
    
    // Create documentation structure based on project type
    const structure = this.createDocumentationStructure(
      formattedDocs,
      analysis.projectType,
      projectDocsPath
    );
    
    await this.writeDocumentationFiles(structure);
  }

  private createDocumentationStructure(docs: any, projectType: string, basePath: string): any {
    const structure: any = {};
    
    switch (projectType) {
      case 'monorepo':
        structure[path.join(basePath, 'index.md')] = docs.overview;
        structure[path.join(basePath, 'architecture.md')] = docs.architecture;
        
        for (const [pkg, content] of Object.entries(docs.packages || {})) {
          structure[path.join(basePath, 'packages', `${pkg}.md`)] = content;
        }
        break;
        
      case 'multi-tool':
        structure[path.join(basePath, 'index.md')] = docs.overview;
        
        for (const [tool, content] of Object.entries(docs.tools || {})) {
          structure[path.join(basePath, 'tools', `${tool}.md`)] = content;
        }
        break;
        
      default:
        structure[path.join(basePath, 'README.md')] = docs.readme;
        structure[path.join(basePath, 'architecture.md')] = docs.architecture;
        structure[path.join(basePath, 'api.md')] = docs.api;
        structure[path.join(basePath, 'setup.md')] = docs.setup;
    }
    
    return structure;
  }

  private async writeDocumentationFiles(structure: any): Promise<void> {
    for (const [filePath, content] of Object.entries(structure)) {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, content as string);
      console.log(`  📄 Created: ${path.basename(filePath)}`);
    }
  }
}