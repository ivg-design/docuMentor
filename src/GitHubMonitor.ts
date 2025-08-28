import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import { queryClaudeCode } from './claudeCodeClient';

export interface GitHubRepo {
  owner: string;
  repo: string;
  branch?: string;
  lastCommit?: string;
  lastChecked?: Date;
}

export interface CommitAnalysis {
  sha: string;
  author: string;
  date: Date;
  message: string;
  files: FileChange[];
  summary: string;
  impact: 'breaking' | 'major' | 'minor' | 'patch';
  documentation: string;
}

export interface FileChange {
  filename: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  patch?: string;
  analysis?: string;
}

export class GitHubMonitor extends EventEmitter {
  private repos: Map<string, GitHubRepo> = new Map();
  private accessToken?: string;
  private pollInterval: number = 5 * 60 * 1000; // 5 minutes
  private isMonitoring: boolean = false;
  private pollTimer?: NodeJS.Timeout;
  private outputPath: string;
  
  constructor(accessToken?: string, outputPath?: string) {
    super();
    this.accessToken = accessToken;
    this.outputPath = outputPath || path.join(process.env.HOME!, 'github/obsidian_vault/docs/commits');
  }
  
  async addRepository(owner: string, repo: string, branch: string = 'main'): Promise<void> {
    const key = `${owner}/${repo}`;
    
    // Get current commit SHA
    const lastCommit = await this.getLatestCommit(owner, repo, branch);
    
    this.repos.set(key, {
      owner,
      repo,
      branch,
      lastCommit,
      lastChecked: new Date()
    });
    
    console.log(`📦 Added repository: ${key} (branch: ${branch})`);
    this.emit('repo-added', { owner, repo, branch });
  }
  
  async removeRepository(owner: string, repo: string): Promise<void> {
    const key = `${owner}/${repo}`;
    this.repos.delete(key);
    console.log(`🗑️ Removed repository: ${key}`);
    this.emit('repo-removed', { owner, repo });
  }
  
  async startMonitoring(interval?: number): Promise<void> {
    if (this.isMonitoring) {
      console.log('⚠️ Already monitoring repositories');
      return;
    }
    
    this.pollInterval = interval || this.pollInterval;
    this.isMonitoring = true;
    
    console.log(`🔍 Starting GitHub monitoring (interval: ${this.pollInterval / 1000}s)`);
    console.log(`📚 Monitoring ${this.repos.size} repositories`);
    
    // Initial check
    await this.checkAllRepos();
    
    // Set up polling
    this.pollTimer = setInterval(async () => {
      await this.checkAllRepos();
    }, this.pollInterval);
    
    this.emit('monitoring-started');
  }
  
  stopMonitoring(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
    
    this.isMonitoring = false;
    console.log('⏹️ Stopped GitHub monitoring');
    this.emit('monitoring-stopped');
  }
  
  private async checkAllRepos(): Promise<void> {
    console.log(`🔄 Checking ${this.repos.size} repositories for updates...`);
    
    for (const [key, repo] of this.repos) {
      try {
        await this.checkRepository(repo);
      } catch (error) {
        console.error(`❌ Error checking ${key}: ${error}`);
        this.emit('check-error', { repo, error });
      }
    }
  }
  
  private async checkRepository(repo: GitHubRepo): Promise<void> {
    const latestCommit = await this.getLatestCommit(repo.owner, repo.repo, repo.branch!);
    
    if (latestCommit && latestCommit !== repo.lastCommit) {
      console.log(`🆕 New commits detected in ${repo.owner}/${repo.repo}`);
      
      // Get commits since last check
      const commits = await this.getCommitsSince(repo.owner, repo.repo, repo.lastCommit!, latestCommit);
      
      // Analyze each commit
      for (const commit of commits) {
        const analysis = await this.analyzeCommit(repo.owner, repo.repo, commit);
        await this.documentCommit(repo, analysis);
        this.emit('commit-documented', { repo, analysis });
      }
      
      // Update last commit
      repo.lastCommit = latestCommit;
      repo.lastChecked = new Date();
      
      // Save state
      await this.saveState();
    }
  }
  
  private async getLatestCommit(owner: string, repo: string, branch: string): Promise<string> {
    const result = await queryClaudeCode(`
      Get the latest commit SHA for ${owner}/${repo} on branch ${branch}.
      Use git commands or GitHub API to fetch this information.
      Return only the commit SHA as a string.
    `);
    
    return result.trim();
  }
  
  private async getCommitsSince(owner: string, repo: string, since: string, until: string): Promise<any[]> {
    const result = await queryClaudeCode(`
      Get all commits between ${since} and ${until} for ${owner}/${repo}.
      Include commit SHA, author, date, message, and changed files.
      Return as JSON array.
    `);
    
    return JSON.parse(result);
  }
  
  async analyzeCommit(owner: string, repo: string, commit: any): Promise<CommitAnalysis> {
    console.log(`🔬 Analyzing commit ${commit.sha.substring(0, 7)}: ${commit.message}`);
    
    // Get detailed file changes
    const fileChanges = await this.getCommitFiles(owner, repo, commit.sha);
    
    // Analyze each file change
    const analyzedFiles: FileChange[] = [];
    for (const file of fileChanges) {
      const fileAnalysis = await this.analyzeFileChange(file);
      analyzedFiles.push(fileAnalysis);
    }
    
    // Generate comprehensive analysis
    const analysis = await queryClaudeCode(`
      Analyze this commit and its changes:
      
      Commit: ${commit.sha}
      Message: ${commit.message}
      Author: ${commit.author}
      Date: ${commit.date}
      
      File Changes:
      ${JSON.stringify(analyzedFiles, null, 2)}
      
      Generate:
      1. A detailed summary of what this commit does
      2. The impact level (breaking/major/minor/patch)
      3. How this affects the codebase
      4. Any potential issues or improvements
      5. Documentation of the changes with file references and line numbers
      
      Return as JSON with fields: summary, impact, documentation
    `);
    
    const result = JSON.parse(analysis);
    
    return {
      sha: commit.sha,
      author: commit.author,
      date: new Date(commit.date),
      message: commit.message,
      files: analyzedFiles,
      summary: result.summary,
      impact: result.impact,
      documentation: result.documentation
    };
  }
  
  private async getCommitFiles(owner: string, repo: string, sha: string): Promise<any[]> {
    const result = await queryClaudeCode(`
      Get all files changed in commit ${sha} for ${owner}/${repo}.
      Include filename, status, additions, deletions, and the patch/diff.
      Return as JSON array.
    `);
    
    return JSON.parse(result);
  }
  
  private async analyzeFileChange(file: any): Promise<FileChange> {
    const analysis = await queryClaudeCode(`
      Analyze this file change:
      
      File: ${file.filename}
      Status: ${file.status}
      Additions: ${file.additions}
      Deletions: ${file.deletions}
      
      Patch:
      ${file.patch || 'No patch available'}
      
      Explain:
      1. What changed in this file
      2. Why this change was made (based on context)
      3. Impact on functionality
      4. Any notable patterns or practices
      
      Return a concise analysis as a string.
    `);
    
    return {
      filename: file.filename,
      status: file.status,
      additions: file.additions || 0,
      deletions: file.deletions || 0,
      patch: file.patch,
      analysis: analysis
    };
  }
  
  private async documentCommit(repo: GitHubRepo, analysis: CommitAnalysis): Promise<void> {
    const timestamp = analysis.date.toISOString().split('T')[0];
    const repoPath = path.join(this.outputPath, `${repo.owner}_${repo.repo}`);
    
    // Create repository directory
    await fs.mkdir(repoPath, { recursive: true });
    
    // Generate commit documentation
    const documentation = `---
title: Commit ${analysis.sha.substring(0, 7)}
repository: ${repo.owner}/${repo.repo}
author: ${analysis.author}
date: ${analysis.date.toISOString()}
impact: ${analysis.impact}
tags: [commit, ${repo.owner}, ${repo.repo}, ${analysis.impact}]
---

# Commit: ${analysis.sha.substring(0, 7)}

## Summary
${analysis.summary}

## Commit Message
\`\`\`
${analysis.message}
\`\`\`

## Impact Level: ${analysis.impact.toUpperCase()}

## Files Changed (${analysis.files.length})

${analysis.files.map(file => `
### ${file.filename}
- **Status**: ${file.status}
- **Changes**: +${file.additions} -${file.deletions}
- **Analysis**: ${file.analysis}

${file.patch ? `
<details>
<summary>View Diff</summary>

\`\`\`diff
${file.patch}
\`\`\`

</details>
` : ''}
`).join('\n')}

## Comprehensive Documentation

${analysis.documentation}

## Links
- [View on GitHub](https://github.com/${repo.owner}/${repo.repo}/commit/${analysis.sha})
- [[${repo.owner}/${repo.repo}|Repository Documentation]]
- [[commits/${timestamp}|Daily Commits]]

---
*Generated by DocuMentor GitHub Monitor*
`;
    
    // Save documentation
    const filename = `${timestamp}_${analysis.sha.substring(0, 7)}_${this.sanitizeFilename(analysis.message)}.md`;
    const filePath = path.join(repoPath, filename);
    
    await fs.writeFile(filePath, documentation);
    console.log(`📄 Documented commit: ${filePath}`);
    
    // Update daily summary
    await this.updateDailySummary(timestamp, repo, analysis);
  }
  
  private async updateDailySummary(date: string, repo: GitHubRepo, analysis: CommitAnalysis): Promise<void> {
    const summaryPath = path.join(this.outputPath, 'daily', `${date}.md`);
    
    // Create directory
    await fs.mkdir(path.dirname(summaryPath), { recursive: true });
    
    let content = '';
    try {
      content = await fs.readFile(summaryPath, 'utf-8');
    } catch {
      // File doesn't exist, create new
      content = `---
title: Daily Commits - ${date}
date: ${date}
tags: [daily, commits, summary]
---

# Daily Commit Summary - ${date}

## Repositories Updated
`;
    }
    
    // Append commit info
    const commitInfo = `
### ${repo.owner}/${repo.repo}
- **Commit**: ${analysis.sha.substring(0, 7)}
- **Author**: ${analysis.author}
- **Message**: ${analysis.message}
- **Impact**: ${analysis.impact}
- **Files**: ${analysis.files.length} changed
- [[commits/${repo.owner}_${repo.repo}/${date}_${analysis.sha.substring(0, 7)}|View Details]]
`;
    
    content += commitInfo;
    
    await fs.writeFile(summaryPath, content);
  }
  
  private sanitizeFilename(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .substring(0, 50);
  }
  
  async saveState(): Promise<void> {
    const statePath = path.join(this.outputPath, '.monitor-state.json');
    const state = {
      repos: Array.from(this.repos.entries()).map(([key, repo]) => ({
        key,
        ...repo
      })),
      lastSaved: new Date()
    };
    
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  }
  
  async loadState(): Promise<void> {
    try {
      const statePath = path.join(this.outputPath, '.monitor-state.json');
      const content = await fs.readFile(statePath, 'utf-8');
      const state = JSON.parse(content);
      
      for (const repo of state.repos) {
        this.repos.set(repo.key, {
          owner: repo.owner,
          repo: repo.repo,
          branch: repo.branch,
          lastCommit: repo.lastCommit,
          lastChecked: new Date(repo.lastChecked)
        });
      }
      
      console.log(`📥 Loaded state for ${this.repos.size} repositories`);
    } catch {
      console.log('📝 No previous state found');
    }
  }
  
  getStatus(): any {
    return {
      isMonitoring: this.isMonitoring,
      repositories: Array.from(this.repos.values()),
      pollInterval: this.pollInterval,
      outputPath: this.outputPath
    };
  }
}