import * as path from 'path';
import { queryClaudeCode } from './claudeCodeClient';

export interface ProjectStructure {
  rootPath: string;
  files: string[];
  directories: string[];
  languages: { [key: string]: number };
  frameworks: string[];
  packageManagers: string[];
  hasTests: boolean;
  testFrameworks: string[];
  entryPoints: string[];
  configFiles: string[];
  dependencies: any;
  devDependencies: any;
  scripts: any;
  workspaceInfo?: any;
  versionControl?: any;
  projectType?: string;
  tools?: any[];
}

export class ProjectAnalyzer {
  constructor() {}

  async analyze(targetPath: string): Promise<ProjectStructure> {
    console.log(`  🔍 Analyzing structure of ${targetPath}`);
    
    // Get comprehensive project structure
    const structureAnalysis = await queryClaudeCode(`
      Analyze the complete project structure at ${targetPath}:
      
      1. List all significant files and directories
      2. Identify programming languages used (count files)
      3. Detect frameworks and libraries
      4. Find package managers (npm, yarn, pnpm, pip, cargo, etc.)
      5. Locate test directories and test frameworks
      6. Identify entry points (main, index, app files)
      7. Find all config files
      8. Check for workspace/monorepo configurations
      9. Extract dependencies from package files
      10. Identify build tools and scripts
      
      Return as detailed JSON with all findings.
    `);
    
    const structure = JSON.parse(structureAnalysis) as ProjectStructure;
    structure.rootPath = targetPath;
    
    // Deep analysis for monorepo detection
    if (await this.isMonorepo(targetPath, structure)) {
      structure.workspaceInfo = await this.analyzeWorkspace(targetPath);
    }
    
    // Detect if it's a multi-tool repository
    if (await this.isMultiToolRepo(targetPath, structure)) {
      structure.tools = await this.identifyTools(targetPath);
    }
    
    return structure;
  }

  private async isMonorepo(targetPath: string, structure: any): Promise<boolean> {
    const monorepoCheck = await queryClaudeCode(`
      Check if ${targetPath} is a monorepo:
      
      1. Look for workspace configuration in package.json
      2. Check for lerna.json, rush.json, nx.json
      3. Look for packages/, apps/, services/ directories
      4. Check for multiple package.json files in subdirectories
      5. Look for pnpm-workspace.yaml or yarn workspaces
      
      Return true if monorepo, false otherwise.
    `);
    
    return monorepoCheck.trim().toLowerCase() === 'true';
  }

  private async analyzeWorkspace(targetPath: string): Promise<any> {
    const workspaceAnalysis = await queryClaudeCode(`
      Analyze the monorepo/workspace structure at ${targetPath}:
      
      1. List all packages/workspaces
      2. Identify shared dependencies
      3. Map inter-package dependencies
      4. Find shared configuration
      5. Identify build order if defined
      6. Check for shared tools/scripts
      
      Return detailed workspace information as JSON.
    `);
    
    return JSON.parse(workspaceAnalysis);
  }

  private async isMultiToolRepo(targetPath: string, structure: any): Promise<boolean> {
    const multiToolCheck = await queryClaudeCode(`
      Check if ${targetPath} contains multiple independent tools/scripts:
      
      1. Look for multiple executable files
      2. Check for separate tool directories
      3. Look for independent script files with different purposes
      4. Check if there's a tools/, scripts/, or bin/ directory
      5. See if README describes multiple tools
      
      Determine if this is a collection of tools rather than a single application.
      Return true if multi-tool repository, false otherwise.
    `);
    
    return multiToolCheck.trim().toLowerCase() === 'true';
  }

  private async identifyTools(targetPath: string): Promise<any[]> {
    const toolsAnalysis = await queryClaudeCode(`
      Identify all individual tools/scripts in ${targetPath}:
      
      For each tool found:
      1. Name and purpose
      2. Location/entry point
      3. Dependencies (if separate)
      4. Documentation location
      5. Usage examples if found
      
      Return as array of tool objects.
    `);
    
    return JSON.parse(toolsAnalysis);
  }

  async detectProjectCategory(structure: ProjectStructure): Promise<string> {
    const detection = await queryClaudeCode(`
      Based on this project structure, categorize the project:
      ${JSON.stringify(structure)}
      
      Categories:
      - web-frontend (React, Vue, Angular, etc.)
      - web-backend (Express, Django, Rails, etc.)
      - web-fullstack (Next.js, Nuxt, etc.)
      - cli-tool (Command line application)
      - library (npm package, Python package, etc.)
      - desktop-app (Electron, etc.)
      - mobile-app (React Native, Flutter, etc.)
      - data-science (Jupyter, data analysis)
      - devops (Infrastructure, CI/CD)
      - documentation (Docs only)
      - mixed (Multiple categories)
      
      Return the most appropriate category.
    `);
    
    return detection.trim();
  }

  async identifyKeyComponents(targetPath: string, structure: ProjectStructure): Promise<any> {
    const components = await queryClaudeCode(`
      Identify key components and modules in ${targetPath}:
      
      1. Core business logic locations
      2. API/Route definitions
      3. Database models/schemas
      4. UI components (if applicable)
      5. Utility/Helper modules
      6. Configuration modules
      7. Test suites
      8. Build/Deploy scripts
      
      For each component:
      - Location
      - Purpose
      - Key files
      - Dependencies on other components
      
      Return as structured JSON.
    `);
    
    return JSON.parse(components);
  }

  async analyzeCodeQuality(targetPath: string): Promise<any> {
    const qualityCheck = await queryClaudeCode(`
      Analyze code quality indicators in ${targetPath}:
      
      1. Check for linting configuration (ESLint, Prettier, etc.)
      2. Look for type checking (TypeScript, Flow, etc.)
      3. Find test coverage configuration
      4. Check for CI/CD pipelines
      5. Look for pre-commit hooks
      6. Find code quality badges in README
      7. Check for security scanning configs
      
      Return findings as JSON.
    `);
    
    return JSON.parse(qualityCheck);
  }
}