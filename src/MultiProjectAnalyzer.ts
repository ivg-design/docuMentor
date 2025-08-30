import * as path from 'path';
import * as fs from 'fs/promises';
import { StreamingReporter } from './StreamingReporter';
import { streamingClaudeQuery } from './EnhancedClaudeClientV2';
import { TUIAdapter } from './TUIAdapter';

export interface SubProject {
  name: string;
  path: string;
  type: 'script' | 'package' | 'component' | 'tool' | 'library' | 'application';
  description: string;
  dependencies?: string[];
  tags: string[];
}

export interface ProjectStructure {
  isMultiProject: boolean;
  projectType: 'single' | 'multi-tool' | 'monorepo' | 'collection';
  rootPath: string;
  subProjects: SubProject[];
  reasoning?: string;
}

export class MultiProjectAnalyzer {
  private streamer: StreamingReporter;
  private display: TUIAdapter;
  
  constructor(streamer: StreamingReporter, display?: TUIAdapter) {
    this.streamer = streamer;
    this.display = display || new TUIAdapter();
  }
  
  /**
   * Analyze project structure using Claude's intelligence
   */
  async analyzeStructure(rootPath: string): Promise<ProjectStructure> {
    this.streamer.streamAnalysis('Structure', 'Starting intelligent project analysis');
    
    // First, gather the complete directory structure
    const structure = await this.gatherDirectoryStructure(rootPath);
    
    // Now ask Claude to analyze it
    // Convert structure to string for Claude analysis
    const structureStr = JSON.stringify(structure, null, 2);
    
    const analysisPrompt = `
Analyze this project structure to determine if it contains a single project/tool or multiple distinct projects/tools.

Directory structure:
${structureStr}

Instructions:
1. Look for evidence of multiple independent tools, packages, or applications
2. Consider:
   - Separate package.json files indicating independent packages
   - Independent script files that serve different purposes
   - Subdirectories that contain complete, standalone tools
   - Monorepo structures (packages/, apps/, services/ directories)
   - Collection of utilities or scripts

3. Determine if this is:
   - A single cohesive project/application
   - A collection of multiple tools/scripts
   - A monorepo with multiple packages
   - A library with multiple components

Return a JSON object with this EXACT structure (no markdown, just JSON):
{
  "isMultiProject": boolean,
  "projectType": "single" | "multi-tool" | "monorepo" | "collection",
  "reasoning": "Brief explanation of your determination",
  "subProjects": [
    {
      "name": "project name",
      "path": "relative/path/from/root",
      "type": "script|package|component|tool|library|application",
      "description": "what this subproject does",
      "mainFiles": ["main files or entry points"],
      "tags": ["relevant", "tags", "for", "this", "subproject"]
    }
  ]
}

IMPORTANT: 
- If it's a single project, subProjects should be empty array
- Look at the actual code files, not just supporting directories like "tools" or "tests"
- Focus on the primary deliverables of the repository
`;

    this.display.stream('🤖 Asking Claude to analyze project structure...');
    
    const analysisResult = await streamingClaudeQuery(
      analysisPrompt,
      this.display,
      'structure-analysis',
      undefined,  // no specific tools
      rootPath  // Use the root path being analyzed
    );
    
    try {
      // Extract JSON from Claude's response (Claude may include thoughts before/after JSON)
      const jsonMatch = analysisResult.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }
      const analysis = JSON.parse(jsonMatch[0]);
      
      this.streamer.streamAnalysis(
        'Detection', 
        `Claude determined: ${analysis.projectType} - ${analysis.reasoning}`
      );
      
      // Convert Claude's analysis to our ProjectStructure format
      const projectStructure: ProjectStructure = {
        isMultiProject: analysis.isMultiProject,
        projectType: analysis.projectType,
        rootPath,
        subProjects: [],
        reasoning: analysis.reasoning
      };
      
      // If multi-project, process each subproject
      if (analysis.isMultiProject && analysis.subProjects) {
        for (const subProj of analysis.subProjects) {
          const subProject: SubProject = {
            name: subProj.name,
            path: path.join(rootPath, subProj.path),
            type: subProj.type,
            description: subProj.description,
            tags: subProj.tags || []
          };
          
          // Try to get dependencies if it's a package
          if (subProj.type === 'package' || subProj.type === 'application') {
            try {
              const packageJsonPath = path.join(rootPath, subProj.path, 'package.json');
              const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
              subProject.dependencies = Object.keys(packageJson.dependencies || {});
            } catch {
              // No package.json or can't read it
            }
          }
          
          projectStructure.subProjects.push(subProject);
        }
      }
      
      return projectStructure;
      
    } catch (error) {
      this.display.log('error', `Failed to parse Claude's analysis: ${error}`);
      
      // Fallback to single project if Claude's response can't be parsed
      return {
        isMultiProject: false,
        projectType: 'single',
        rootPath,
        subProjects: [],
        reasoning: 'Failed to analyze structure, treating as single project'
      };
    }
  }
  
  /**
   * Gather complete directory structure for analysis
   */
  private async gatherDirectoryStructure(
    dirPath: string, 
    depth: number = 0, 
    maxDepth: number = 2  // Reduced from 4 to 2 to limit data size
  ): Promise<any> {
    if (depth >= maxDepth) {
      return { _truncated: true };
    }
    
    const structure: any = {};
    
    try {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        // Skip common ignore patterns
        if (item.startsWith('.') || 
            item === 'node_modules' || 
            item === 'dist' || 
            item === 'build' ||
            item === 'coverage' ||
            item === '.git') {
          continue;
        }
        
        const itemPath = path.join(dirPath, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          structure[item] = await this.gatherDirectoryStructure(itemPath, depth + 1, maxDepth);
        } else {
          // Include file extensions and sizes for context
          const ext = path.extname(item);
          structure[item] = {
            type: 'file',
            extension: ext,
            size: stats.size
          };
          
          // For key files, include first few lines
          if (item === 'package.json' || item === 'README.md' || item === 'Cargo.toml') {
            try {
              const content = await fs.readFile(itemPath, 'utf-8');
              const lines = content.split('\n').slice(0, 10).join('\n');
              structure[item].preview = lines;
            } catch {
              // Can't read file
            }
          }
        }
      }
    } catch (error) {
      structure._error = `Could not read directory: ${error}`;
    }
    
    return structure;
  }
  
  /**
   * Get list of subdirectories
   */
  private async getSubdirectories(dirPath: string): Promise<string[]> {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    return items
      .filter(item => item.isDirectory())
      .map(item => item.name);
  }
}