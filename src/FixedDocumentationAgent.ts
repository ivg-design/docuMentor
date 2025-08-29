import * as path from 'path';
import * as fs from 'fs/promises';
import { ProjectAnalyzer } from './ProjectAnalyzer';
import { ObsidianFormatter } from './ObsidianFormatter';
import { CodeVerifier } from './CodeVerifier';
import { SmartTagManager } from './SmartTagManager';
import { queryClaudeCode } from './claudeCodeClient';
import { ContentCleaner } from './ContentCleaner';
import { UltraTerminalUI } from './UltraTerminalUI';
import { ImprovedFrontmatterGenerator } from './ImprovedFrontmatterGenerator';

export interface DocConfig {
  targetPath: string;
  outputPath?: string;
  excludePaths?: string[];
  verifyCode?: boolean;
  includeTests?: boolean;
  updateExisting?: boolean;
}

export class FixedDocumentationAgent {
  private config: DocConfig;
  private projectAnalyzer: ProjectAnalyzer;
  private obsidianFormatter: ObsidianFormatter;
  private codeVerifier: CodeVerifier;
  private tagManager: SmartTagManager;
  private frontmatterGen: ImprovedFrontmatterGenerator;
  private ui: UltraTerminalUI;
  private obsidianVaultPath: string;
  private documentsGenerated: number = 0;
  private totalDocuments: number = 0;

  constructor(config: DocConfig) {
    this.obsidianVaultPath = config.outputPath || path.join(process.env.HOME!, 'github/obsidian_vault/docs');
    
    this.config = {
      ...config,
      outputPath: this.obsidianVaultPath, // ALWAYS output to Obsidian vault
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

    const projectName = path.basename(this.config.targetPath);
    this.projectAnalyzer = new ProjectAnalyzer();
    this.obsidianFormatter = new ObsidianFormatter();
    this.codeVerifier = new CodeVerifier();
    this.tagManager = new SmartTagManager(this.obsidianVaultPath, projectName);
    this.frontmatterGen = new ImprovedFrontmatterGenerator(this.config.targetPath);
    this.ui = new UltraTerminalUI();
  }

  async generateDocumentation(): Promise<void> {
    this.ui.start(path.join(this.config.targetPath, '.documentor.lock'));
    this.ui.log('info', '[START] DocuMentor starting analysis...');
    this.ui.log('info', `[TARGET] ${this.config.targetPath}`);
    this.ui.log('info', `[OUTPUT] ${this.config.outputPath}`);

    try {
      // Phase 1: Initialization
      this.ui.setPhase(1, 7, 'Initialization');
      this.ui.setWorking(true);
      
      // Phase 2: Analysis - NO HEURISTICS, use DocumentorAgent
      this.ui.setPhase(2, 7, 'Analysis');
      const projectAnalysis = await this.analyzeProjectProperly();
      
      // Phase 3: Tag Loading & Consolidation
      this.ui.setPhase(3, 7, 'Tag Consolidation');
      await this.consolidateTags(projectAnalysis);
      
      // Phase 4: Verification
      this.ui.setPhase(4, 7, 'Verification');
      if (this.config.verifyCode) {
        await this.verifyCodeFunctionality(projectAnalysis);
      }
      
      // Phase 5: Documentation Generation
      this.ui.setPhase(5, 7, 'Documentation');
      const documentation = await this.generateDocsForProject(projectAnalysis);
      
      // Phase 6: Formatting & Frontmatter
      this.ui.setPhase(6, 7, 'Formatting');
      const formattedDocs = await this.formatWithFrontmatter(documentation, projectAnalysis);
      
      // Phase 7: Save to Obsidian Vault
      this.ui.setPhase(7, 7, 'Saving to Obsidian');
      await this.saveToObsidianVault(formattedDocs, projectAnalysis);
      
      this.ui.log('success', '[SUCCESS] Documentation generation complete!');
      this.ui.log('info', `[INFO] View in Obsidian: ${this.config.outputPath}`);
      this.ui.setWorking(false);
      
    } catch (error) {
      this.ui.logError('[ERROR] Error generating documentation:', error);
      this.ui.setWorking(false);
      throw error;
    } finally {
      this.ui.stop();
    }
  }

  /**
   * Analyze project WITHOUT heuristics - let DocumentorAgent decide everything
   */
  private async analyzeProjectProperly(): Promise<any> {
    this.ui.log('info', '[ANALYZE] Analyzing project structure...');
    this.ui.addDiagnostic('Agent', 'Starting project analysis');
    
    // Use DocumentorAgent to determine EVERYTHING
    const agentAnalysis = await queryClaudeCode(`
      Analyze the project at ${this.config.targetPath} and determine:
      
      1. Project Structure:
         - Is this a single project or multi-project repository?
         - If multi-project, list all sub-projects with their paths
         - Identify the type: monorepo, multi-tool, library, application, scripts collection
      
      2. For each project/sub-project identify:
         - Name and purpose
         - Main entry points
         - Dependencies
         - Documentation needs
      
      3. Documentation Structure Required:
         - If single project: generate comprehensive docs in one folder
         - If multi-project: create folder hierarchy with:
           * Root folder for the repository
           * Subfolders for each project
           * Overview document for the repository
           * Individual docs for each sub-project
      
      4. Return as structured JSON with:
         {
           "type": "single|multi",
           "projectType": "monorepo|library|application|multi-tool|scripts",
           "projects": [
             {
               "name": "project-name",
               "path": "relative/path",
               "type": "tool|library|app|script",
               "description": "what it does",
               "entryPoints": ["main files"],
               "needsOwnFolder": true/false
             }
           ],
           "documentationStructure": {
             "rootFolder": "name-for-obsidian-folder",
             "needsOverview": true/false,
             "subFolders": ["list of subfolder names"]
           }
         }
      
      IMPORTANT: Do NOT use heuristics. Actually examine the code structure.
    `);
    
    const analysis = JSON.parse(ContentCleaner.cleanContent(agentAnalysis));
    
    this.ui.log('info', `[TYPE] ${analysis.projectType}`);
    this.ui.log('info', `[STRUCTURE] ${analysis.type} with ${analysis.projects.length} project(s)`);
    
    // Count total documents needed
    this.totalDocuments = analysis.projects.length;
    if (analysis.documentationStructure.needsOverview) {
      this.totalDocuments++;
    }
    this.ui.updateDocumentProgress(0, this.totalDocuments);
    
    return analysis;
  }

  /**
   * Tag consolidation step - REQUIRED
   */
  private async consolidateTags(analysis: any): Promise<void> {
    this.ui.log('info', '[TAGS] Consolidating project tags...');
    this.ui.addDiagnostic('Tag', 'Loading existing tags from vault');
    
    // Load existing tags from vault
    await this.tagManager.loadExistingTags();
    
    // Get project-specific tags from the registry
    const stats = this.tagManager.getStatistics();
    const projectTags = stats.topTags || [];
    
    // Consolidate with analysis
    const consolidatedTags = await queryClaudeCode(`
      Consolidate tags for project documentation:
      
      Project: ${analysis.projectType}
      Existing vault tags: ${JSON.stringify(projectTags)}
      
      Rules:
      1. Reuse existing tags where appropriate
      2. Create hierarchical tag structure
      3. Maximum 10 tags per document
      4. Include project type, language, framework tags
      5. Add status tags: #documented, #verified
      
      Return as JSON array of tags to use.
    `);
    
    const tags = JSON.parse(ContentCleaner.cleanContent(consolidatedTags));
    this.ui.log('info', `[TAGS] Using ${tags.length} consolidated tags`);
    this.ui.addDiagnostic('Tag', 'Tags consolidated', tags);
  }

  private async verifyCodeFunctionality(analysis: any): Promise<void> {
    this.ui.log('info', '[VERIFY] Verifying code functionality...');
    await this.codeVerifier.verifyProject(this.config.targetPath, analysis);
  }

  private async generateDocsForProject(analysis: any): Promise<any> {
    this.ui.log('info', '[GENERATE] Generating documentation...');
    const docs: any = {};
    
    // Generate overview if needed
    if (analysis.documentationStructure.needsOverview) {
      this.ui.updateDocumentProgress(0, this.totalDocuments, 'Repository Overview');
      docs.overview = await this.generateOverviewDoc(analysis);
      this.documentsGenerated++;
      this.ui.updateDocumentProgress(this.documentsGenerated, this.totalDocuments);
    }
    
    // Generate docs for each project
    for (const project of analysis.projects) {
      this.ui.updateDocumentProgress(
        this.documentsGenerated, 
        this.totalDocuments, 
        project.name
      );
      
      const projectDoc = await this.generateProjectDoc(project, analysis);
      docs[project.name] = projectDoc;
      
      this.documentsGenerated++;
      this.ui.updateDocumentProgress(this.documentsGenerated, this.totalDocuments);
    }
    
    return docs;
  }

  private async generateOverviewDoc(analysis: any): Promise<string> {
    const doc = await queryClaudeCode(`
      Generate a comprehensive overview document for this repository:
      ${JSON.stringify(analysis)}
      
      Include:
      - Repository purpose and description
      - Project structure
      - List of all sub-projects/tools
      - How they relate to each other
      - Installation instructions
      - Common usage patterns
      
      Format as clean Markdown without any AI commentary.
    `);
    
    return ContentCleaner.cleanContent(doc);
  }

  private async generateProjectDoc(project: any, analysis: any): Promise<string> {
    const doc = await queryClaudeCode(`
      Generate comprehensive documentation for:
      Project: ${project.name}
      Path: ${project.path}
      Type: ${project.type}
      
      Include:
      - Purpose and functionality
      - Installation/setup
      - Usage examples
      - API documentation (if applicable)
      - Configuration options
      - Dependencies
      
      Format as clean Markdown without any AI commentary.
    `);
    
    return ContentCleaner.cleanContent(doc);
  }

  /**
   * Format with REQUIRED frontmatter
   */
  private async formatWithFrontmatter(docs: any, analysis: any): Promise<any> {
    this.ui.log('info', '[FORMAT] Adding frontmatter to all documents...');
    const formatted: any = {};
    
    for (const [key, content] of Object.entries(docs)) {
      if (typeof content === 'string') {
        // Generate frontmatter for this document
        const frontmatter = await this.frontmatterGen.generateFrontmatter({
          title: key === 'overview' ? `${path.basename(this.config.targetPath)} Overview` : key,
          type: key === 'overview' ? 'overview' : 'documentation',
          project: path.basename(this.config.targetPath),
          tags: this.tagManager.getStatistics().topTags || [],
          relatedFiles: analysis.projects.map((p: any) => p.name)
        });
        
        // Add frontmatter to document
        formatted[key] = frontmatter + '\n\n' + content;
        
        this.ui.addDiagnostic('Doc', `Added frontmatter to ${key}`);
      } else {
        formatted[key] = content;
      }
    }
    
    return formatted;
  }

  /**
   * Save to Obsidian Vault with proper structure
   */
  private async saveToObsidianVault(docs: any, analysis: any): Promise<void> {
    this.ui.log('info', '[SAVE] Saving to Obsidian vault...');
    
    const projectName = analysis.documentationStructure.rootFolder || 
                       path.basename(this.config.targetPath);
    const projectDocsPath = path.join(this.config.outputPath!, projectName);
    
    // Create root folder
    await fs.mkdir(projectDocsPath, { recursive: true });
    this.ui.addDiagnostic('File', `Created folder: ${projectDocsPath}`);
    
    // Save overview if exists
    if (docs.overview) {
      const overviewPath = path.join(projectDocsPath, 'README.md');
      await fs.writeFile(overviewPath, docs.overview);
      this.ui.log('info', `[FILE] Created: README.md`);
    }
    
    // Save project docs
    for (const project of analysis.projects) {
      if (docs[project.name]) {
        let docPath: string;
        
        if (project.needsOwnFolder && analysis.type === 'multi') {
          // Create subfolder for this project
          const subFolder = path.join(projectDocsPath, project.name);
          await fs.mkdir(subFolder, { recursive: true });
          docPath = path.join(subFolder, 'README.md');
        } else {
          // Save in root folder with project name
          docPath = path.join(projectDocsPath, `${project.name}.md`);
        }
        
        await fs.writeFile(docPath, docs[project.name]);
        this.ui.log('info', `[FILE] Created: ${path.relative(projectDocsPath, docPath)}`);
      }
    }
    
    // Save tag registry
    await this.tagManager.saveRegistry();
    
    this.ui.log('success', `[COMPLETE] Documentation saved to Obsidian vault`);
  }
}