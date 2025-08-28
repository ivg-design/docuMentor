import * as path from 'path';
import * as fs from 'fs/promises';
import { DocumentationAgent } from './DocumentationAgent';
import { ProgressMonitor } from './ProgressMonitor';
import { SafetyValidator } from './SafetyValidator';
import { ConfigManager } from './ConfigManager';
import { queryClaudeCode } from './claudeCodeClient';

export interface FullMontyReport {
  targetPath: string;
  timestamp: Date;
  duration: number;
  sections: {
    overview: boolean;
    architecture: boolean;
    api: boolean;
    security: boolean;
    performance: boolean;
    dependencies: boolean;
    tests: boolean;
    metrics: boolean;
    changelog: boolean;
    diagrams: boolean;
  };
  statistics: {
    filesAnalyzed: number;
    linesOfCode: number;
    documentsGenerated: number;
    issuesFound: number;
    suggestionsProvided: number;
  };
  quality: {
    codeQuality: number; // 0-100
    documentationCoverage: number; // 0-100
    testCoverage: number; // 0-100
    securityScore: number; // 0-100
  };
}

export class FullMontyGenerator {
  private config: ConfigManager;
  private progress: ProgressMonitor;
  private safety: SafetyValidator;
  private agent: DocumentationAgent;
  private report: FullMontyReport;
  
  constructor() {
    this.config = new ConfigManager();
    this.progress = new ProgressMonitor();
    this.safety = new SafetyValidator();
    this.agent = null!; // Will be initialized with config
    this.report = null!; // Will be initialized in generate
  }
  
  async generate(targetPath: string): Promise<FullMontyReport> {
    const startTime = Date.now();
    
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║           🎯 FULL MONTY DOCUMENTATION GENERATOR           ║
║                    Comprehensive Analysis                  ║
╚═══════════════════════════════════════════════════════════╝
    `);
    
    // Initialize report
    this.report = {
      targetPath,
      timestamp: new Date(),
      duration: 0,
      sections: {
        overview: false,
        architecture: false,
        api: false,
        security: false,
        performance: false,
        dependencies: false,
        tests: false,
        metrics: false,
        changelog: false,
        diagrams: false
      },
      statistics: {
        filesAnalyzed: 0,
        linesOfCode: 0,
        documentsGenerated: 0,
        issuesFound: 0,
        suggestionsProvided: 0
      },
      quality: {
        codeQuality: 0,
        documentationCoverage: 0,
        testCoverage: 0,
        securityScore: 0
      }
    };
    
    try {
      // Step 1: Load configuration
      this.progress.startTask('Loading Configuration', 100);
      const config = await this.config.loadConfig();
      this.progress.completeTask('Loading Configuration', '✅ Configuration loaded');
      
      // Step 2: Validate target directory
      this.progress.startTask('Validating Target', 100);
      const validation = await this.safety.validateDirectory(targetPath);
      if (!validation.valid) {
        throw new Error(`Target validation failed: ${validation.errors.join(', ')}`);
      }
      this.progress.completeTask('Validating Target', '✅ Target validated');
      
      // Step 3: Create safety backups
      if (config.safetyMode.backupBeforeWrite) {
        this.progress.startTask('Creating Backups', 100);
        await this.createSafetyBackups(targetPath);
        this.progress.completeTask('Creating Backups', '✅ Backups created');
      }
      
      // Step 4: Generate Overview Documentation
      this.progress.startTask('Generating Overview', 100);
      await this.generateOverview(targetPath);
      this.report.sections.overview = true;
      this.progress.completeTask('Generating Overview', '✅ Overview complete');
      
      // Step 5: Analyze Architecture
      this.progress.startTask('Analyzing Architecture', 100);
      await this.analyzeArchitecture(targetPath);
      this.report.sections.architecture = true;
      this.progress.completeTask('Analyzing Architecture', '✅ Architecture analyzed');
      
      // Step 6: Document APIs
      this.progress.startTask('Documenting APIs', 100);
      await this.documentAPIs(targetPath);
      this.report.sections.api = true;
      this.progress.completeTask('Documenting APIs', '✅ APIs documented');
      
      // Step 7: Security Analysis
      if (config.fullMonty.analyzeSecurity) {
        this.progress.startTask('Security Analysis', 100);
        await this.analyzeSecurity(targetPath);
        this.report.sections.security = true;
        this.progress.completeTask('Security Analysis', '✅ Security analyzed');
      }
      
      // Step 8: Performance Analysis
      this.progress.startTask('Performance Analysis', 100);
      await this.analyzePerformance(targetPath);
      this.report.sections.performance = true;
      this.progress.completeTask('Performance Analysis', '✅ Performance analyzed');
      
      // Step 9: Dependency Analysis
      if (config.fullMonty.checkDependencies) {
        this.progress.startTask('Dependency Analysis', 100);
        await this.analyzeDependencies(targetPath);
        this.report.sections.dependencies = true;
        this.progress.completeTask('Dependency Analysis', '✅ Dependencies analyzed');
      }
      
      // Step 10: Test Analysis
      this.progress.startTask('Test Analysis', 100);
      await this.analyzeTests(targetPath);
      this.report.sections.tests = true;
      this.progress.completeTask('Test Analysis', '✅ Tests analyzed');
      
      // Step 11: Generate Metrics
      if (config.fullMonty.generateMetrics) {
        this.progress.startTask('Generating Metrics', 100);
        await this.generateMetrics(targetPath);
        this.report.sections.metrics = true;
        this.progress.completeTask('Generating Metrics', '✅ Metrics generated');
      }
      
      // Step 12: Generate Changelog
      if (config.fullMonty.generateChangelog) {
        this.progress.startTask('Generating Changelog', 100);
        await this.generateChangelog(targetPath);
        this.report.sections.changelog = true;
        this.progress.completeTask('Generating Changelog', '✅ Changelog generated');
      }
      
      // Step 13: Generate Diagrams
      if (config.fullMonty.generateDiagrams) {
        this.progress.startTask('Generating Diagrams', 100);
        await this.generateDiagrams(targetPath);
        this.report.sections.diagrams = true;
        this.progress.completeTask('Generating Diagrams', '✅ Diagrams generated');
      }
      
      // Step 14: Calculate Quality Scores
      this.progress.startTask('Calculating Quality', 100);
      await this.calculateQualityScores(targetPath);
      this.progress.completeTask('Calculating Quality', '✅ Quality calculated');
      
      // Step 15: Generate Final Report
      this.progress.startTask('Generating Report', 100);
      await this.generateFinalReport();
      this.progress.completeTask('Generating Report', '✅ Report generated');
      
      // Calculate duration
      this.report.duration = Date.now() - startTime;
      
      // Display summary
      this.progress.displaySummary();
      this.displayFullMontyReport();
      
      // Clean up
      this.progress.cleanup();
      
      return this.report;
      
    } catch (error) {
      this.progress.failTask('Full Monty Generation', `Error: ${error}`);
      this.progress.cleanup();
      throw error;
    }
  }
  
  private async createSafetyBackups(targetPath: string): Promise<void> {
    // Backup existing documentation if it exists
    const docsPath = path.join(targetPath, 'docs');
    try {
      await fs.access(docsPath);
      await this.safety.createBackup(docsPath);
    } catch {
      // No existing docs, that's fine
    }
  }
  
  private async generateOverview(targetPath: string): Promise<void> {
    const overview = await queryClaudeCode(`
      Generate a comprehensive overview of the project at ${targetPath}:
      
      1. Project purpose and goals
      2. Key features and functionality
      3. Technology stack
      4. Project structure
      5. Getting started guide
      6. Key contributors (from git history)
      7. License information
      8. Current status and roadmap
      
      Return as structured markdown documentation.
    `);
    
    await this.saveDocument('overview.md', overview, targetPath);
    this.report.statistics.documentsGenerated++;
  }
  
  private async analyzeArchitecture(targetPath: string): Promise<void> {
    const architecture = await queryClaudeCode(`
      Analyze the architecture of ${targetPath}:
      
      1. System design patterns
      2. Component relationships
      3. Data flow diagrams
      4. Module dependencies
      5. Architectural decisions (ADRs)
      6. Scalability considerations
      7. Integration points
      8. Technology choices rationale
      
      Create comprehensive architecture documentation with diagrams.
    `);
    
    await this.saveDocument('architecture.md', architecture, targetPath);
    this.report.statistics.documentsGenerated++;
  }
  
  private async documentAPIs(targetPath: string): Promise<void> {
    const apis = await queryClaudeCode(`
      Document all APIs in ${targetPath}:
      
      1. REST endpoints
      2. GraphQL schemas
      3. WebSocket events
      4. Internal APIs
      5. External integrations
      6. Authentication methods
      7. Rate limiting
      8. Error responses
      9. OpenAPI/Swagger spec generation
      
      Create complete API reference documentation.
    `);
    
    await this.saveDocument('api-reference.md', apis, targetPath);
    this.report.statistics.documentsGenerated++;
  }
  
  private async analyzeSecurity(targetPath: string): Promise<void> {
    const security = await queryClaudeCode(`
      Perform security analysis on ${targetPath}:
      
      1. Authentication & authorization review
      2. Input validation checks
      3. SQL injection vulnerabilities
      4. XSS vulnerabilities
      5. CSRF protection
      6. Sensitive data exposure
      7. Security headers
      8. Dependency vulnerabilities
      9. Security best practices compliance
      10. OWASP Top 10 checklist
      
      Generate security report with recommendations.
    `);
    
    await this.saveDocument('security-analysis.md', security, targetPath);
    this.report.statistics.documentsGenerated++;
    
    // Parse for issues
    const issues = (security.match(/\[ISSUE\]/g) || []).length;
    this.report.statistics.issuesFound += issues;
  }
  
  private async analyzePerformance(targetPath: string): Promise<void> {
    const performance = await queryClaudeCode(`
      Analyze performance characteristics of ${targetPath}:
      
      1. Algorithm complexity analysis
      2. Database query optimization
      3. Memory usage patterns
      4. Load time analysis
      5. Bundle size optimization
      6. Caching strategies
      7. Async operation handling
      8. Resource utilization
      9. Performance bottlenecks
      10. Optimization recommendations
      
      Generate performance analysis report.
    `);
    
    await this.saveDocument('performance-analysis.md', performance, targetPath);
    this.report.statistics.documentsGenerated++;
  }
  
  private async analyzeDependencies(targetPath: string): Promise<void> {
    const dependencies = await queryClaudeCode(`
      Analyze dependencies in ${targetPath}:
      
      1. Direct dependencies list
      2. Transitive dependencies
      3. Version compatibility
      4. Security vulnerabilities (CVEs)
      5. License compliance
      6. Outdated packages
      7. Unused dependencies
      8. Dependency graph visualization
      9. Update recommendations
      10. Alternative package suggestions
      
      Generate dependency analysis report.
    `);
    
    await this.saveDocument('dependency-analysis.md', dependencies, targetPath);
    this.report.statistics.documentsGenerated++;
  }
  
  private async analyzeTests(targetPath: string): Promise<void> {
    const tests = await queryClaudeCode(`
      Analyze test suite in ${targetPath}:
      
      1. Test coverage percentage
      2. Test types (unit, integration, e2e)
      3. Test framework usage
      4. Missing test scenarios
      5. Test quality assessment
      6. Test execution time
      7. Flaky tests identification
      8. Test documentation
      9. Coverage gaps
      10. Testing best practices compliance
      
      Generate test analysis report.
    `);
    
    await this.saveDocument('test-analysis.md', tests, targetPath);
    this.report.statistics.documentsGenerated++;
  }
  
  private async generateMetrics(targetPath: string): Promise<void> {
    const metrics = await queryClaudeCode(`
      Calculate code metrics for ${targetPath}:
      
      1. Lines of code (LOC)
      2. Cyclomatic complexity
      3. Code duplication
      4. Technical debt
      5. Maintainability index
      6. Code churn
      7. Comment density
      8. File/folder statistics
      9. Language distribution
      10. Complexity hotspots
      
      Generate metrics dashboard.
    `);
    
    await this.saveDocument('metrics.md', metrics, targetPath);
    this.report.statistics.documentsGenerated++;
    
    // Parse metrics
    const locMatch = metrics.match(/Lines of Code:\s*(\d+)/);
    if (locMatch) {
      this.report.statistics.linesOfCode = parseInt(locMatch[1]);
    }
  }
  
  private async generateChangelog(targetPath: string): Promise<void> {
    const changelog = await queryClaudeCode(`
      Generate changelog for ${targetPath}:
      
      1. Recent commits analysis
      2. Version history
      3. Breaking changes
      4. New features
      5. Bug fixes
      6. Performance improvements
      7. Security updates
      8. Deprecated features
      9. Migration guides
      10. Release notes
      
      Format as CHANGELOG.md following Keep a Changelog format.
    `);
    
    await this.saveDocument('CHANGELOG.md', changelog, targetPath);
    this.report.statistics.documentsGenerated++;
  }
  
  private async generateDiagrams(targetPath: string): Promise<void> {
    const diagrams = await queryClaudeCode(`
      Generate architecture and flow diagrams for ${targetPath}:
      
      1. System architecture diagram
      2. Component interaction diagram
      3. Database ER diagram
      4. API flow diagrams
      5. Deployment architecture
      6. Data flow diagrams
      7. Sequence diagrams
      8. State diagrams
      9. Class diagrams (for OOP)
      10. Network topology
      
      Generate as Mermaid diagrams embedded in markdown.
    `);
    
    await this.saveDocument('diagrams.md', diagrams, targetPath);
    this.report.statistics.documentsGenerated++;
  }
  
  private async calculateQualityScores(targetPath: string): Promise<void> {
    const qualityAnalysis = await queryClaudeCode(`
      Calculate quality scores for ${targetPath}:
      
      1. Code quality (0-100): Based on linting, formatting, best practices
      2. Documentation coverage (0-100): Based on inline docs, README, guides
      3. Test coverage (0-100): Based on test suite completeness
      4. Security score (0-100): Based on security best practices
      
      Return as JSON with scores and justifications.
    `);
    
    const scores = JSON.parse(qualityAnalysis);
    this.report.quality = {
      codeQuality: scores.codeQuality || 0,
      documentationCoverage: scores.documentationCoverage || 0,
      testCoverage: scores.testCoverage || 0,
      securityScore: scores.securityScore || 0
    };
  }
  
  private async generateFinalReport(): Promise<void> {
    const reportContent = `---
title: Full Monty Documentation Report
project: ${path.basename(this.report.targetPath)}
generated: ${this.report.timestamp.toISOString()}
tags: [full-monty, comprehensive, report]
---

# Full Monty Documentation Report

## Project: ${path.basename(this.report.targetPath)}
**Generated:** ${this.report.timestamp.toLocaleString()}
**Duration:** ${Math.round(this.report.duration / 1000)}s

## 📊 Quality Scores

| Metric | Score | Grade |
|--------|-------|-------|
| Code Quality | ${this.report.quality.codeQuality}% | ${this.getGrade(this.report.quality.codeQuality)} |
| Documentation | ${this.report.quality.documentationCoverage}% | ${this.getGrade(this.report.quality.documentationCoverage)} |
| Test Coverage | ${this.report.quality.testCoverage}% | ${this.getGrade(this.report.quality.testCoverage)} |
| Security | ${this.report.quality.securityScore}% | ${this.getGrade(this.report.quality.securityScore)} |

## 📈 Statistics

- **Files Analyzed:** ${this.report.statistics.filesAnalyzed}
- **Lines of Code:** ${this.report.statistics.linesOfCode.toLocaleString()}
- **Documents Generated:** ${this.report.statistics.documentsGenerated}
- **Issues Found:** ${this.report.statistics.issuesFound}
- **Suggestions:** ${this.report.statistics.suggestionsProvided}

## ✅ Completed Sections

${Object.entries(this.report.sections)
  .filter(([_, completed]) => completed)
  .map(([section]) => `- [x] ${this.capitalize(section)}`)
  .join('\n')}

## 📁 Generated Documentation

- [[overview|Project Overview]]
- [[architecture|Architecture Documentation]]
- [[api-reference|API Reference]]
- [[security-analysis|Security Analysis]]
- [[performance-analysis|Performance Analysis]]
- [[dependency-analysis|Dependency Analysis]]
- [[test-analysis|Test Analysis]]
- [[metrics|Code Metrics]]
- [[CHANGELOG|Changelog]]
- [[diagrams|Architecture Diagrams]]

## 🎯 Next Steps

1. Review security findings and address critical issues
2. Improve test coverage to reach 80% minimum
3. Update outdated dependencies
4. Document undocumented APIs
5. Optimize performance bottlenecks

---
*Generated by DocuMentor Full Monty Generator*
`;
    
    await this.saveDocument('REPORT.md', reportContent, this.report.targetPath);
  }
  
  private async saveDocument(filename: string, content: string, targetPath: string): Promise<void> {
    const config = await this.config.getConfig();
    const outputPath = path.join(config.obsidianVaultPath, path.basename(targetPath), filename);
    
    // Validate before writing
    const validation = await this.safety.validateBeforeWrite(outputPath, content);
    if (!validation.valid) {
      console.error(`❌ Cannot save ${filename}: ${validation.errors.join(', ')}`);
      return;
    }
    
    // Create directory
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    
    // Write file
    await fs.writeFile(outputPath, content);
    console.log(`📄 Saved: ${filename}`);
  }
  
  private getGrade(score: number): string {
    if (score >= 90) return '🌟 A+';
    if (score >= 80) return '⭐ A';
    if (score >= 70) return '✨ B';
    if (score >= 60) return '⚡ C';
    if (score >= 50) return '💫 D';
    return '⚠️ F';
  }
  
  private capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  
  private displayFullMontyReport(): void {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                  FULL MONTY REPORT CARD                    ║
╠═══════════════════════════════════════════════════════════╣
║  Code Quality:      ${this.getGrade(this.report.quality.codeQuality)} (${this.report.quality.codeQuality}%)                          ║
║  Documentation:     ${this.getGrade(this.report.quality.documentationCoverage)} (${this.report.quality.documentationCoverage}%)                          ║
║  Test Coverage:     ${this.getGrade(this.report.quality.testCoverage)} (${this.report.quality.testCoverage}%)                          ║
║  Security Score:    ${this.getGrade(this.report.quality.securityScore)} (${this.report.quality.securityScore}%)                          ║
╠═══════════════════════════════════════════════════════════╣
║  Documents Generated: ${String(this.report.statistics.documentsGenerated).padEnd(37)}║
║  Issues Found:        ${String(this.report.statistics.issuesFound).padEnd(37)}║
║  Lines Analyzed:      ${String(this.report.statistics.linesOfCode).padEnd(37)}║
╠═══════════════════════════════════════════════════════════╣
║  Duration: ${Math.round(this.report.duration / 1000)}s                                          ║
╚═══════════════════════════════════════════════════════════╝
    `);
  }
}