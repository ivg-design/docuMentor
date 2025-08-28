import * as fs from 'fs/promises';
import * as path from 'path';
import { StreamingReporter } from './StreamingReporter';
import { ObsidianLinker } from './ObsidianLinker';

export interface SubProject {
  name: string;
  path: string;
  type: 'script' | 'tool' | 'library' | 'component' | 'module';
  description?: string;
  mainFile?: string;
  dependencies?: string[];
  relatedProjects?: string[];
  tags: string[];
}

export interface MultiProjectStructure {
  isMultiProject: boolean;
  projectType: 'monorepo' | 'multi-tool' | 'single' | 'collection';
  rootPath: string;
  subProjects: SubProject[];
  sharedDependencies?: string[];
  sharedConfigs?: string[];
  documentation?: {
    hasRootReadme: boolean;
    hasPerProjectDocs: boolean;
  };
}

export class MultiProjectAnalyzer {
  private streamer: StreamingReporter;
  
  constructor(streamer: StreamingReporter) {
    this.streamer = streamer;
  }
  
  /**
   * Analyze directory structure to detect multi-project setup
   */
  async analyzeStructure(rootPath: string): Promise<MultiProjectStructure> {
    this.streamer.streamTask('Analysis', 'Detecting project structure...');
    
    const structure: MultiProjectStructure = {
      isMultiProject: false,
      projectType: 'single',
      rootPath,
      subProjects: []
    };
    
    try {
      // Check for common multi-project patterns
      const files = await fs.readdir(rootPath);
      
      // Pattern 1: Individual script files (like jsx repo)
      const scriptFiles = files.filter(f => 
        (f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.py') || 
         f.endsWith('.sh') || f.endsWith('.rb')) && 
        !f.includes('.test.') && !f.includes('.spec.') &&
        !f.startsWith('_') && !f.startsWith('.')
      );
      
      if (scriptFiles.length > 5) {
        // Likely a collection of scripts/tools
        this.streamer.streamAnalysis('Detection', `Found ${scriptFiles.length} script files - treating as multi-tool collection`);
        structure.isMultiProject = true;
        structure.projectType = 'multi-tool';
        
        // Create subproject for each script
        for (const scriptFile of scriptFiles) {
          const scriptPath = path.join(rootPath, scriptFile);
          const scriptName = path.parse(scriptFile).name;
          
          this.streamer.streamFile('Analyzing', scriptFile);
          
          const subProject = await this.analyzeScript(scriptPath, scriptName);
          structure.subProjects.push(subProject);
        }
      }
      
      // Pattern 2: Subdirectories with package.json (monorepo)
      const dirs = await this.getSubdirectories(rootPath);
      const packagesWithJson = [];
      
      for (const dir of dirs) {
        const packageJsonPath = path.join(rootPath, dir, 'package.json');
        try {
          await fs.access(packageJsonPath);
          packagesWithJson.push(dir);
        } catch {
          // No package.json
        }
      }
      
      if (packagesWithJson.length > 2 && !structure.isMultiProject) {
        this.streamer.streamAnalysis('Detection', `Found ${packagesWithJson.length} packages - treating as monorepo`);
        structure.isMultiProject = true;
        structure.projectType = 'monorepo';
        
        for (const pkg of packagesWithJson) {
          const subProject = await this.analyzePackage(path.join(rootPath, pkg), pkg);
          structure.subProjects.push(subProject);
        }
      }
      
      // Pattern 3: Directories with similar structure (component library)
      const componentDirs = dirs.filter(d => 
        !d.startsWith('.') && 
        !['node_modules', 'dist', 'build', 'coverage', 'docs'].includes(d)
      );
      
      if (componentDirs.length > 5 && !structure.isMultiProject) {
        // Check if directories have similar structure
        const hasConsistentStructure = await this.checkConsistentStructure(rootPath, componentDirs);
        
        if (hasConsistentStructure) {
          this.streamer.streamAnalysis('Detection', `Found ${componentDirs.length} components - treating as collection`);
          structure.isMultiProject = true;
          structure.projectType = 'collection';
          
          for (const dir of componentDirs) {
            const subProject = await this.analyzeComponent(path.join(rootPath, dir), dir);
            structure.subProjects.push(subProject);
          }
        }
      }
      
      // Check for shared configs
      if (structure.isMultiProject) {
        structure.sharedConfigs = files.filter(f => 
          f.includes('config') || f.includes('tsconfig') || 
          f.includes('eslint') || f.includes('prettier')
        );
        
        // Check documentation
        structure.documentation = {
          hasRootReadme: files.includes('README.md'),
          hasPerProjectDocs: false // Will be checked per subproject
        };
      }
      
    } catch (error) {
      this.streamer.streamError(`Structure analysis failed: ${error}`);
    }
    
    this.streamer.streamTask('Analysis', `Detected ${structure.subProjects.length} subprojects`);
    
    return structure;
  }
  
  /**
   * Analyze individual script file
   */
  private async analyzeScript(scriptPath: string, scriptName: string): Promise<SubProject> {
    const content = await fs.readFile(scriptPath, 'utf-8');
    
    // Extract description from comments
    const description = this.extractDescription(content);
    
    // Detect dependencies/imports
    const dependencies = this.extractDependencies(content);
    
    // Generate tags based on content
    const tags = this.generateTags(scriptName, content);
    
    return {
      name: scriptName,
      path: scriptPath,
      type: 'script',
      description,
      mainFile: path.basename(scriptPath),
      dependencies,
      tags
    };
  }
  
  /**
   * Analyze package directory
   */
  private async analyzePackage(pkgPath: string, pkgName: string): Promise<SubProject> {
    let packageJson: any = {};
    
    try {
      const packageJsonContent = await fs.readFile(path.join(pkgPath, 'package.json'), 'utf-8');
      packageJson = JSON.parse(packageJsonContent);
    } catch {
      // No package.json or invalid
    }
    
    return {
      name: packageJson.name || pkgName,
      path: pkgPath,
      type: 'library',
      description: packageJson.description,
      mainFile: packageJson.main || 'index.js',
      dependencies: Object.keys(packageJson.dependencies || {}),
      tags: this.generateTags(pkgName, JSON.stringify(packageJson))
    };
  }
  
  /**
   * Analyze component directory
   */
  private async analyzeComponent(compPath: string, compName: string): Promise<SubProject> {
    const files = await fs.readdir(compPath);
    
    // Find main file
    const mainFile = files.find(f => 
      f === 'index.js' || f === 'index.ts' || 
      f === `${compName}.js` || f === `${compName}.ts`
    );
    
    return {
      name: compName,
      path: compPath,
      type: 'component',
      mainFile,
      tags: ['component', compName.toLowerCase()]
    };
  }
  
  /**
   * Generate documentation structure for multi-project
   */
  async generateMultiProjectDocs(
    structure: MultiProjectStructure,
    outputPath: string,
    linker: ObsidianLinker
  ): Promise<void> {
    this.streamer.streamTask('Documentation', 'Creating multi-project documentation structure...');
    
    // Create root index
    await this.createRootIndex(structure, outputPath, linker);
    
    // Create documentation for each subproject
    for (const subProject of structure.subProjects) {
      this.streamer.streamFile('Documenting', subProject.name);
      
      // Create subfolder for each project
      const subProjectPath = path.join(outputPath, subProject.name);
      await fs.mkdir(subProjectPath, { recursive: true });
      
      // Register with linker
      const doc = linker.registerDocument(
        `${path.basename(structure.rootPath)}/${subProject.name}/README`,
        `${subProject.name} Documentation`,
        [...subProject.tags, 'tool', path.basename(structure.rootPath)],
        [subProject.name, `${subProject.name} tool`]
      );
      
      // Create README for each subproject
      await this.createSubProjectReadme(subProject, subProjectPath, linker, doc);
      
      // Create usage documentation
      await this.createUsageDoc(subProject, subProjectPath, linker);
      
      // Create technical documentation
      await this.createTechnicalDoc(subProject, subProjectPath, linker);
      
      // Create examples if applicable
      await this.createExamplesDoc(subProject, subProjectPath, linker);
      
      // Link related projects
      await this.linkRelatedProjects(subProject, structure.subProjects, linker);
    }
    
    // Create cross-reference index
    await this.createCrossReferenceIndex(structure, outputPath, linker);
  }
  
  /**
   * Create root index for multi-project
   */
  private async createRootIndex(
    structure: MultiProjectStructure,
    outputPath: string,
    linker: ObsidianLinker
  ): Promise<void> {
    const projectName = path.basename(structure.rootPath);
    
    const doc = linker.registerDocument(
      `${projectName}/INDEX`,
      `${projectName} - Multi-Tool Collection`,
      ['index', 'collection', projectName, 'tools'],
      ['Main Index', 'Tool Collection']
    );
    
    const content = `${linker.generateFrontmatter(doc)}

# ${projectName} - Multi-Tool Collection

## Overview

This repository contains ${structure.subProjects.length} individual tools and scripts, each serving a specific purpose.

## Project Type: ${structure.projectType}

## Tools Directory

| Tool | Type | Description | Documentation |
|------|------|-------------|---------------|
${structure.subProjects.map(sp => 
  `| **${sp.name}** | ${sp.type} | ${sp.description || 'No description'} | [[${sp.name}/README\\|Documentation]] |`
).join('\n')}

## Quick Navigation

### By Category

${this.categorizeProjects(structure.subProjects)}

### By Type

${this.groupByType(structure.subProjects)}

## Shared Resources

${structure.sharedConfigs?.map(config => `- [[${config}]]`).join('\n') || 'No shared configurations'}

## Tags

${[...new Set(structure.subProjects.flatMap(sp => sp.tags))].map(tag => `#${tag}`).join(' ')}

${linker.generateRelatedSection(doc)}
${linker.generateBacklinksSection(doc)}

---
*Generated by DocuMentor - Multi-Project Documentation*
`;
    
    await fs.writeFile(path.join(outputPath, 'INDEX.md'), content);
  }
  
  /**
   * Create README for subproject
   */
  private async createSubProjectReadme(
    subProject: SubProject,
    outputPath: string,
    linker: ObsidianLinker,
    doc: any
  ): Promise<void> {
    const content = `${linker.generateFrontmatter(doc)}

# ${subProject.name}

## Description

${subProject.description || 'Tool/script documentation'}

## Type

\`${subProject.type}\`

## Main File

\`${subProject.mainFile || 'N/A'}\`

## Dependencies

${subProject.dependencies?.map(dep => `- ${dep}`).join('\n') || 'No external dependencies'}

## Documentation

- [[${subProject.name}/usage|Usage Guide]]
- [[${subProject.name}/technical|Technical Details]]
- [[${subProject.name}/examples|Examples]]

## Related Tools

${subProject.relatedProjects?.map(related => `- [[${related}/README|${related}]]`).join('\n') || 'No related tools'}

## Tags

${subProject.tags.map(tag => `#${tag}`).join(' ')}

${linker.generateRelatedSection(doc)}
${linker.generateBacklinksSection(doc)}
`;
    
    await fs.writeFile(path.join(outputPath, 'README.md'), content);
  }
  
  // Helper methods
  private async getSubdirectories(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  }
  
  private async checkConsistentStructure(rootPath: string, dirs: string[]): Promise<boolean> {
    // Check if directories have similar file patterns
    const structures = await Promise.all(
      dirs.slice(0, 5).map(async dir => {
        const files = await fs.readdir(path.join(rootPath, dir));
        return files.sort().join(',');
      })
    );
    
    // If most have similar structure, consider it consistent
    const uniqueStructures = new Set(structures);
    return uniqueStructures.size <= 2;
  }
  
  private extractDescription(content: string): string {
    // Look for description in comments
    const match = content.match(/(?:\/\*\*?[\s\S]*?\*\/|\/\/.*|#.*)/);
    if (match) {
      return match[0].replace(/[/*#]/g, '').trim().split('\n')[0];
    }
    return '';
  }
  
  private extractDependencies(content: string): string[] {
    const deps: string[] = [];
    
    // JavaScript/TypeScript imports
    const importMatches = content.matchAll(/import .* from ['"](.+?)['"]/g);
    for (const match of importMatches) {
      deps.push(match[1]);
    }
    
    // Require statements
    const requireMatches = content.matchAll(/require\(['"](.+?)['"]\)/g);
    for (const match of requireMatches) {
      deps.push(match[1]);
    }
    
    return [...new Set(deps)];
  }
  
  private generateTags(name: string, content: string): string[] {
    const tags: string[] = [name.toLowerCase()];
    
    // Add language tags
    if (content.includes('import') || content.includes('export')) {
      tags.push('javascript');
    }
    if (content.includes('async') || content.includes('await')) {
      tags.push('async');
    }
    if (content.includes('#!/usr/bin/env')) {
      tags.push('cli', 'script');
    }
    
    return tags;
  }
  
  private categorizeProjects(subProjects: SubProject[]): string {
    const categories: Record<string, SubProject[]> = {};
    
    for (const project of subProjects) {
      const category = project.type;
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(project);
    }
    
    return Object.entries(categories)
      .map(([cat, projects]) => 
        `#### ${cat}\n${projects.map(p => `- [[${p.name}/README|${p.name}]]`).join('\n')}`
      )
      .join('\n\n');
  }
  
  private groupByType(subProjects: SubProject[]): string {
    const types = ['script', 'tool', 'library', 'component', 'module'];
    
    return types
      .map(type => {
        const projects = subProjects.filter(p => p.type === type);
        if (projects.length === 0) return '';
        
        return `#### ${type}s (${projects.length})\n${projects.map(p => `- [[${p.name}/README|${p.name}]]`).join('\n')}`;
      })
      .filter(s => s)
      .join('\n\n');
  }
  
  private async createUsageDoc(subProject: SubProject, outputPath: string, linker: ObsidianLinker): Promise<void> {
    // Implementation would generate usage documentation
  }
  
  private async createTechnicalDoc(subProject: SubProject, outputPath: string, linker: ObsidianLinker): Promise<void> {
    // Implementation would generate technical documentation
  }
  
  private async createExamplesDoc(subProject: SubProject, outputPath: string, linker: ObsidianLinker): Promise<void> {
    // Implementation would generate examples documentation
  }
  
  private async linkRelatedProjects(
    subProject: SubProject,
    allProjects: SubProject[],
    linker: ObsidianLinker
  ): Promise<void> {
    // Find and link related projects based on dependencies and tags
  }
  
  private async createCrossReferenceIndex(
    structure: MultiProjectStructure,
    outputPath: string,
    linker: ObsidianLinker
  ): Promise<void> {
    // Create comprehensive cross-reference index
  }
}