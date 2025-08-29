import * as fs from 'fs/promises';
import * as path from 'path';
import { streamingClaudeQuery } from './EnhancedClaudeClientV2';

export interface AuditIssue {
  file: string;
  type: 'missing_frontmatter' | 'missing_tags' | 'missing_backlinks' | 'outdated_content' | 'deprecated' | 'broken_link';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion: string;
}

export interface AuditReport {
  timestamp: Date;
  filesAudited: number;
  issuesFound: number;
  issues: AuditIssue[];
  recommendations: string[];
}

export class DocumentationAuditor {
  private vaultPath: string;
  private newFiles: Set<string> = new Set();
  private existingFiles: Set<string> = new Set();
  
  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
  }
  
  /**
   * Track newly created documentation
   */
  trackNewFile(filePath: string) {
    this.newFiles.add(filePath);
  }
  
  /**
   * Track existing documentation
   */
  trackExistingFile(filePath: string) {
    this.existingFiles.add(filePath);
  }
  
  /**
   * Perform comprehensive audit of documentation
   */
  async performAudit(display: any): Promise<AuditReport> {
    display.updateStatus('audit', 'Starting documentation audit...');
    
    const issues: AuditIssue[] = [];
    let filesAudited = 0;
    
    // Get all markdown files in vault
    const allFiles = await this.getAllMarkdownFiles(this.vaultPath);
    
    // Check each file for issues
    for (const file of allFiles) {
      filesAudited++;
      const relativePath = path.relative(this.vaultPath, file);
      display.streamFile('Audit', relativePath);
      
      const content = await fs.readFile(file, 'utf-8');
      const fileIssues = await this.auditFile(file, content);
      issues.push(...fileIssues);
    }
    
    // Use Claude to perform intelligent audit
    const claudeAudit = await this.performClaudeAudit(allFiles, display);
    issues.push(...claudeAudit);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(issues);
    
    return {
      timestamp: new Date(),
      filesAudited,
      issuesFound: issues.length,
      issues,
      recommendations
    };
  }
  
  /**
   * Audit individual file for common issues
   */
  private async auditFile(filePath: string, content: string): Promise<AuditIssue[]> {
    const issues: AuditIssue[] = [];
    const fileName = path.basename(filePath);
    
    // Check for frontmatter
    if (!content.startsWith('---')) {
      issues.push({
        file: fileName,
        type: 'missing_frontmatter',
        severity: 'high',
        description: 'File is missing frontmatter',
        suggestion: 'Add frontmatter with id, title, tags, and dates'
      });
    } else {
      // Parse frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        
        // Check required fields
        const requiredFields = ['id', 'title', 'tags', 'created', 'updated'];
        for (const field of requiredFields) {
          if (!frontmatter.includes(`${field}:`)) {
            issues.push({
              file: fileName,
              type: 'missing_frontmatter',
              severity: 'medium',
              description: `Missing required frontmatter field: ${field}`,
              suggestion: `Add ${field} to frontmatter`
            });
          }
        }
        
        // Check for empty tags
        if (frontmatter.includes('tags: []')) {
          issues.push({
            file: fileName,
            type: 'missing_tags',
            severity: 'medium',
            description: 'No tags defined',
            suggestion: 'Add relevant tags for better organization'
          });
        }
        
        // Check for backlinks
        if (!frontmatter.includes('backlinks:') || frontmatter.includes('backlinks: []')) {
          issues.push({
            file: fileName,
            type: 'missing_backlinks',
            severity: 'low',
            description: 'No backlinks defined',
            suggestion: 'Add backlinks to related documents'
          });
        }
      }
    }
    
    // Check for broken links
    const linkPattern = /\[\[([^\]]+)\]\]/g;
    let match;
    while ((match = linkPattern.exec(content)) !== null) {
      const linkedFile = match[1];
      const linkedPath = path.join(this.vaultPath, `${linkedFile}.md`);
      
      try {
        await fs.access(linkedPath);
      } catch {
        issues.push({
          file: fileName,
          type: 'broken_link',
          severity: 'high',
          description: `Broken link to: ${linkedFile}`,
          suggestion: `Fix or remove link to ${linkedFile}`
        });
      }
    }
    
    // Check for deprecated patterns
    const deprecatedPatterns = [
      { pattern: /console\.log/g, message: 'Uses console.log instead of proper logging' },
      { pattern: /var\s+/g, message: 'Uses deprecated var keyword' },
      { pattern: /TODO:/gi, message: 'Contains unresolved TODO' }
    ];
    
    for (const { pattern, message } of deprecatedPatterns) {
      if (pattern.test(content)) {
        issues.push({
          file: fileName,
          type: 'deprecated',
          severity: 'low',
          description: message,
          suggestion: 'Update to modern patterns'
        });
      }
    }
    
    return issues;
  }
  
  /**
   * Use Claude to perform intelligent audit
   */
  private async performClaudeAudit(files: string[], display: any): Promise<AuditIssue[]> {
    const sampleFiles = files.slice(0, 5); // Sample first 5 files
    const samples = await Promise.all(
      sampleFiles.map(async f => ({
        path: path.relative(this.vaultPath, f),
        content: await fs.readFile(f, 'utf-8')
      }))
    );
    
    const prompt = `
Audit the following documentation files and identify issues:

${samples.map(s => `File: ${s.path}\n${s.content.substring(0, 500)}...\n`).join('\n---\n')}

Look for:
1. Inconsistent formatting or style
2. Missing cross-references that should exist
3. Outdated or incorrect information
4. Duplicate content that could be consolidated
5. Missing context or explanations

Return a JSON array of issues found:
[{
  "file": "filename",
  "type": "outdated_content",
  "severity": "medium",
  "description": "description of issue",
  "suggestion": "how to fix"
}]

IMPORTANT: Return ONLY the JSON array, no other text or markdown.
`;
    
    try {
      const result = await streamingClaudeQuery(prompt, display, 'audit', ['Read'], this.vaultPath);
      
      // Extract JSON from response
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      display.logError('Claude audit failed', error);
    }
    
    return [];
  }
  
  /**
   * Generate recommendations based on issues found
   */
  private generateRecommendations(issues: AuditIssue[]): string[] {
    const recommendations: string[] = [];
    
    // Count issue types
    const issueCounts = new Map<string, number>();
    for (const issue of issues) {
      issueCounts.set(issue.type, (issueCounts.get(issue.type) || 0) + 1);
    }
    
    // Generate recommendations
    if (issueCounts.get('missing_frontmatter')) {
      recommendations.push('Run a batch process to add missing frontmatter to all files');
    }
    
    if (issueCounts.get('missing_tags')) {
      recommendations.push('Review and add appropriate tags to improve discoverability');
    }
    
    if (issueCounts.get('broken_link')) {
      recommendations.push('Fix broken links to maintain documentation integrity');
    }
    
    if (issueCounts.get('outdated_content')) {
      recommendations.push('Review and update outdated content to reflect current state');
    }
    
    if (issues.filter(i => i.severity === 'high').length > 0) {
      recommendations.push('Address high-severity issues immediately');
    }
    
    return recommendations;
  }
  
  /**
   * Get all markdown files in directory
   */
  private async getAllMarkdownFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const items = await fs.readdir(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        
        if (item.isDirectory() && !item.name.startsWith('.')) {
          const subFiles = await this.getAllMarkdownFiles(fullPath);
          files.push(...subFiles);
        } else if (item.isFile() && item.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
    
    return files;
  }
  
  /**
   * Write audit report to file
   */
  async writeReport(report: AuditReport, outputPath: string) {
    const content = `# Documentation Audit Report

Generated: ${report.timestamp.toLocaleString()}

## Summary
- Files Audited: ${report.filesAudited}
- Issues Found: ${report.issuesFound}

## Issues by Severity

### High Severity (${report.issues.filter(i => i.severity === 'high').length})
${report.issues.filter(i => i.severity === 'high').map(i => 
  `- **${i.file}**: ${i.description}\n  - Suggestion: ${i.suggestion}`
).join('\n')}

### Medium Severity (${report.issues.filter(i => i.severity === 'medium').length})
${report.issues.filter(i => i.severity === 'medium').map(i => 
  `- **${i.file}**: ${i.description}\n  - Suggestion: ${i.suggestion}`
).join('\n')}

### Low Severity (${report.issues.filter(i => i.severity === 'low').length})
${report.issues.filter(i => i.severity === 'low').map(i => 
  `- **${i.file}**: ${i.description}\n  - Suggestion: ${i.suggestion}`
).join('\n')}

## Recommendations
${report.recommendations.map(r => `- ${r}`).join('\n')}
`;
    
    await fs.writeFile(outputPath, content);
  }
}