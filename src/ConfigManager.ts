import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface DocumentorConfig {
  // Core settings
  defaultTargetPath: string;
  obsidianVaultPath: string;
  excludePaths: string[];
  verifyCode: boolean;
  generateBacklinks: boolean;
  maxTags: number;
  
  // Safety settings
  safetyMode: {
    enabled: boolean;
    backupBeforeWrite: boolean;
    validateJson: boolean;
    maxFileSize: number; // in MB
    preventOverwrite: boolean;
  };
  
  // GitHub monitoring settings
  github: {
    enabled: boolean;
    accessToken: string; // GitHub Personal Access Token (classic or fine-grained)
    username?: string; // GitHub username (optional)
    repositories: string[];
    pollInterval: number; // in minutes
    webhookUrl?: string;
    documentOnCommit: boolean;
    documentOnPR: boolean;
    ignorePatterns: string[];
    scopes: string[]; // Required scopes: repo, read:user, read:project
  };
  
  // Progress monitoring
  monitoring: {
    showProgress: boolean;
    verboseLogging: boolean;
    logFile?: string;
    interruptKey: string; // e.g., 'ctrl+c'
    autoSave: boolean;
    saveInterval: number; // in seconds
  };
  
  // Full-monty settings
  fullMonty: {
    analyzeCode: boolean;
    verifyFunctionality: boolean;
    generateDiagrams: boolean;
    createTests: boolean;
    generateChangelog: boolean;
    analyzeSecurity: boolean;
    checkDependencies: boolean;
    generateMetrics: boolean;
  };
  
  // Output settings
  output: {
    format: 'markdown' | 'html' | 'pdf';
    includeTimestamps: boolean;
    includeAuthor: boolean;
    customTemplates?: string;
    theme: string;
  };
  
  // API settings
  api: {
    claudeApiKey?: string;
    maxTokens: number;
    temperature: number;
    model: string;
  };
}

export class ConfigManager {
  private configDir: string;
  private configPath: string;
  private config: DocumentorConfig | null = null;
  
  constructor() {
    this.configDir = path.join(os.homedir(), '.documentor');
    this.configPath = path.join(this.configDir, 'config.json');
  }
  
  async loadConfig(): Promise<DocumentorConfig> {
    try {
      // Check if config exists
      await fs.access(this.configPath);
      
      // Load and parse config
      const configContent = await fs.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(configContent);
      
      // Validate and merge with defaults
      this.config = this.mergeWithDefaults(this.config!);
      
      console.log('✅ Configuration loaded from', this.configPath);
      return this.config;
      
    } catch (error) {
      console.log('📝 No configuration found, creating default config...');
      return await this.createDefaultConfig();
    }
  }
  
  async createDefaultConfig(): Promise<DocumentorConfig> {
    const defaultConfig: DocumentorConfig = {
      defaultTargetPath: process.cwd(), // Current working directory by default
      obsidianVaultPath: path.join(os.homedir(), 'github/obsidian_vault/docs'),
      excludePaths: [
        path.join(os.homedir(), 'github/docuMentor'),
        path.join(os.homedir(), 'github/obsidian_vault'),
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.DS_Store',
        '**/coverage/**',
        '**/.env*',
        '**/secrets/**'
      ],
      verifyCode: true,
      generateBacklinks: true,
      maxTags: 10,
      
      safetyMode: {
        enabled: true,
        backupBeforeWrite: true,
        validateJson: true,
        maxFileSize: 10, // 10 MB
        preventOverwrite: false
      },
      
      github: {
        enabled: false,
        accessToken: 'YOUR_GITHUB_PERSONAL_ACCESS_TOKEN_HERE', // Generate at https://github.com/settings/tokens
        username: '', // Optional: your GitHub username
        repositories: [
          // Format: 'owner/repo' e.g., 'facebook/react'
        ],
        pollInterval: 5, // 5 minutes
        documentOnCommit: true,
        documentOnPR: true,
        ignorePatterns: [
          '*.min.js',
          '*.min.css',
          'package-lock.json',
          'yarn.lock',
          '*.map'
        ],
        scopes: ['repo', 'read:user', 'read:project'] // Required GitHub token scopes
      },
      
      monitoring: {
        showProgress: true,
        verboseLogging: false,
        interruptKey: 'ctrl+c',
        autoSave: true,
        saveInterval: 30 // 30 seconds
      },
      
      fullMonty: {
        analyzeCode: true,
        verifyFunctionality: true,
        generateDiagrams: true,
        createTests: false,
        generateChangelog: true,
        analyzeSecurity: true,
        checkDependencies: true,
        generateMetrics: true
      },
      
      output: {
        format: 'markdown',
        includeTimestamps: true,
        includeAuthor: true,
        theme: 'default'
      },
      
      api: {
        maxTokens: 100000,
        temperature: 0.3,
        model: 'claude-3-opus-20240229'
      }
    };
    
    // Create config directory
    await fs.mkdir(this.configDir, { recursive: true });
    
    // Write config file
    await fs.writeFile(
      this.configPath,
      JSON.stringify(defaultConfig, null, 2)
    );
    
    // Also create a config template
    await this.createConfigTemplate();
    
    console.log('✅ Default configuration created at', this.configPath);
    console.log('📋 Template created at', path.join(this.configDir, 'config.template.json'));
    
    this.config = defaultConfig;
    return defaultConfig;
  }
  
  private async createConfigTemplate(): Promise<void> {
    const template = {
      "// Documentation": "DocuMentor Configuration File",
      "// Info": "Copy this template to config.json and modify as needed",
      "// Version": "2.0.0",
      "// Instructions": {
        "defaultTargetPath": "Set to your most commonly documented project path",
        "github.accessToken": "Generate at https://github.com/settings/tokens with 'repo' scope",
        "excludePaths": "Add paths that should never be documented"
      },
      
      defaultTargetPath: "~/projects/my-main-project",
      obsidianVaultPath: "~/github/obsidian_vault/docs",
      excludePaths: [
        "// Add paths to exclude from documentation",
        "node_modules",
        ".git",
        "dist",
        "build",
        "coverage",
        ".env"
      ],
      
      github: {
        "// Info": "GitHub integration settings - REQUIRED for monitor mode",
        "// Token": "Generate Personal Access Token at https://github.com/settings/tokens",
        "// Scopes": "Required scopes: repo, read:user, read:project",
        enabled: false,
        accessToken: "ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        username: "your-github-username",
        repositories: [
          "// Add repositories to monitor",
          "// Format: owner/repo",
          "// Example: facebook/react",
          "// Example: myusername/myproject"
        ],
        scopes: ["repo", "read:user", "read:project"]
      },
      
      fullMonty: {
        "// Info": "Settings for comprehensive documentation",
        analyzeCode: true,
        verifyFunctionality: true,
        generateDiagrams: true,
        "// Note": "Enable all features for maximum documentation"
      }
    };
    
    await fs.writeFile(
      path.join(this.configDir, 'config.template.json'),
      JSON.stringify(template, null, 2)
    );
  }
  
  private mergeWithDefaults(userConfig: Partial<DocumentorConfig>): DocumentorConfig {
    const defaultConfig = {
      defaultTargetPath: process.cwd(),
      obsidianVaultPath: path.join(os.homedir(), 'github/obsidian_vault/docs'),
      excludePaths: [],
      verifyCode: true,
      generateBacklinks: true,
      maxTags: 10,
      safetyMode: {
        enabled: true,
        backupBeforeWrite: true,
        validateJson: true,
        maxFileSize: 10,
        preventOverwrite: false
      },
      github: {
        enabled: false,
        accessToken: 'YOUR_GITHUB_PERSONAL_ACCESS_TOKEN_HERE',
        username: '',
        repositories: [],
        pollInterval: 5,
        documentOnCommit: true,
        documentOnPR: true,
        ignorePatterns: [],
        scopes: ['repo', 'read:user', 'read:project']
      },
      monitoring: {
        showProgress: true,
        verboseLogging: false,
        interruptKey: 'ctrl+c',
        autoSave: true,
        saveInterval: 30
      },
      fullMonty: {
        analyzeCode: true,
        verifyFunctionality: true,
        generateDiagrams: true,
        createTests: false,
        generateChangelog: true,
        analyzeSecurity: true,
        checkDependencies: true,
        generateMetrics: true
      },
      output: {
        format: 'markdown' as const,
        includeTimestamps: true,
        includeAuthor: true,
        theme: 'default'
      },
      api: {
        maxTokens: 100000,
        temperature: 0.3,
        model: 'claude-3-opus-20240229'
      }
    };
    
    // Deep merge user config with defaults
    return this.deepMerge(defaultConfig, userConfig) as DocumentorConfig;
  }
  
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }
  
  async updateConfig(updates: Partial<DocumentorConfig>): Promise<void> {
    if (!this.config) {
      await this.loadConfig();
    }
    
    this.config = this.mergeWithDefaults({ ...this.config, ...updates });
    
    await fs.writeFile(
      this.configPath,
      JSON.stringify(this.config, null, 2)
    );
    
    console.log('✅ Configuration updated');
  }
  
  async getConfig(): Promise<DocumentorConfig> {
    if (!this.config) {
      await this.loadConfig();
    }
    return this.config!;
  }
  
  async validateConfig(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    if (!this.config) {
      errors.push('No configuration loaded');
      return { valid: false, errors };
    }
    
    // Validate paths
    try {
      await fs.access(this.config.obsidianVaultPath);
    } catch {
      errors.push(`Obsidian vault path does not exist: ${this.config.obsidianVaultPath}`);
    }
    
    // Validate GitHub token if enabled
    if (this.config.github.enabled) {
      if (!this.config.github.accessToken || this.config.github.accessToken === 'YOUR_GITHUB_PERSONAL_ACCESS_TOKEN_HERE') {
        errors.push('GitHub integration enabled but no valid access token provided. Generate one at https://github.com/settings/tokens');
      }
      if (this.config.github.accessToken && !this.config.github.accessToken.startsWith('ghp_') && !this.config.github.accessToken.startsWith('github_pat_')) {
        errors.push('GitHub access token appears to be invalid. Should start with "ghp_" or "github_pat_"');
      }
    }
    
    // Validate monitoring settings
    if (this.config.monitoring.saveInterval < 10) {
      errors.push('Save interval should be at least 10 seconds');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  async backupConfig(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.configDir, `config.backup.${timestamp}.json`);
    
    if (this.config) {
      await fs.writeFile(backupPath, JSON.stringify(this.config, null, 2));
      console.log(`📦 Config backed up to ${backupPath}`);
    }
    
    return backupPath;
  }
}