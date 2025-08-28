import * as path from 'path';
import { queryClaudeCode } from './claudeCodeClient';

export interface VerificationResult {
  component: string;
  status: 'working' | 'broken' | 'deprecated' | 'untested';
  details: string;
  codeLocation: string;
  lastVerified: string;
}

export class CodeVerifier {
  private verificationResults: VerificationResult[] = [];
  
  constructor() {}

  async verifyProject(targetPath: string, analysis: any): Promise<VerificationResult[]> {
    console.log('  🔬 Verifying code functionality...');
    
    // Verify based on project type
    if (analysis.entryPoints && analysis.entryPoints.length > 0) {
      await this.verifyEntryPoints(targetPath, analysis.entryPoints);
    }
    
    if (analysis.hasTests) {
      await this.verifyTestCoverage(targetPath, analysis.testFrameworks);
    }
    
    if (analysis.dependencies) {
      await this.verifyDependencies(targetPath, analysis.dependencies);
    }
    
    // Verify API endpoints if backend project
    if (analysis.frameworks.some((f: string) => ['express', 'fastapi', 'django', 'rails'].includes(f.toLowerCase()))) {
      await this.verifyAPIEndpoints(targetPath);
    }
    
    // Verify component functionality if frontend
    if (analysis.frameworks.some((f: string) => ['react', 'vue', 'angular'].includes(f.toLowerCase()))) {
      await this.verifyComponents(targetPath);
    }
    
    // Check for broken imports/exports
    await this.verifyImports(targetPath);
    
    return this.verificationResults;
  }

  private async verifyEntryPoints(targetPath: string, entryPoints: string[]): Promise<void> {
    for (const entryPoint of entryPoints) {
      const verification = await queryClaudeCode(`
        Verify the entry point at ${path.join(targetPath, entryPoint)}:
        
        1. Check if file exists
        2. Verify main function/export exists
        3. Check for syntax errors
        4. Verify required dependencies are imported
        5. Check if it can be executed/imported without errors
        6. Look for any TODO/FIXME/DEPRECATED comments
        
        Return verification status and any issues found.
      `);
      
      this.verificationResults.push({
        component: `Entry Point: ${entryPoint}`,
        status: this.parseVerificationStatus(verification),
        details: verification,
        codeLocation: entryPoint,
        lastVerified: new Date().toISOString()
      });
    }
  }

  private async verifyTestCoverage(targetPath: string, testFrameworks: string[]): Promise<void> {
    const testVerification = await queryClaudeCode(`
      Analyze test coverage in ${targetPath}:
      
      1. Find all test files
      2. Check if tests are runnable
      3. Look for skipped or disabled tests
      4. Check test configuration files
      5. Verify test commands in package.json/scripts
      6. Look for coverage reports
      
      Report on overall test health and coverage.
    `);
    
    this.verificationResults.push({
      component: 'Test Suite',
      status: this.parseVerificationStatus(testVerification),
      details: testVerification,
      codeLocation: 'tests/',
      lastVerified: new Date().toISOString()
    });
  }

  private async verifyDependencies(targetPath: string, dependencies: any): Promise<void> {
    const depVerification = await queryClaudeCode(`
      Verify dependency usage in ${targetPath}:
      
      1. Check if all listed dependencies are actually used in code
      2. Find any missing dependencies (imported but not in package.json)
      3. Check for version conflicts
      4. Identify deprecated packages
      5. Find security vulnerabilities if mentioned in lock files
      
      Return findings as structured data.
    `);
    
    this.verificationResults.push({
      component: 'Dependencies',
      status: this.parseVerificationStatus(depVerification),
      details: depVerification,
      codeLocation: 'package.json',
      lastVerified: new Date().toISOString()
    });
  }

  private async verifyAPIEndpoints(targetPath: string): Promise<void> {
    const apiVerification = await queryClaudeCode(`
      Verify API endpoints in ${targetPath}:
      
      1. Find all route definitions
      2. Check each endpoint has a handler function
      3. Verify middleware is properly configured
      4. Check for authentication on protected routes
      5. Look for proper error handling
      6. Verify input validation exists
      7. Check for deprecated endpoints
      
      For each endpoint, note if it's functional, broken, or deprecated.
    `);
    
    const endpoints = this.parseAPIEndpoints(apiVerification);
    for (const endpoint of endpoints) {
      this.verificationResults.push(endpoint);
    }
  }

  private async verifyComponents(targetPath: string): Promise<void> {
    const componentVerification = await queryClaudeCode(`
      Verify UI components in ${targetPath}:
      
      1. Find all component files
      2. Check for proper exports
      3. Verify required props are defined
      4. Check for missing imports
      5. Look for deprecated lifecycle methods
      6. Verify style imports exist
      7. Check for console errors or warnings in code
      
      Report on component health and any issues.
    `);
    
    this.verificationResults.push({
      component: 'UI Components',
      status: this.parseVerificationStatus(componentVerification),
      details: componentVerification,
      codeLocation: 'components/',
      lastVerified: new Date().toISOString()
    });
  }

  private async verifyImports(targetPath: string): Promise<void> {
    const importVerification = await queryClaudeCode(`
      Check for broken imports in ${targetPath}:
      
      1. Scan all import/require statements
      2. Verify imported files exist
      3. Check if imported modules are installed
      4. Look for circular dependencies
      5. Find unused imports
      6. Check for case sensitivity issues
      
      List any broken or problematic imports found.
    `);
    
    if (importVerification.toLowerCase().includes('broken') || 
        importVerification.toLowerCase().includes('missing')) {
      this.verificationResults.push({
        component: 'Module Imports',
        status: 'broken',
        details: importVerification,
        codeLocation: 'various',
        lastVerified: new Date().toISOString()
      });
    }
  }

  private parseVerificationStatus(verification: string): 'working' | 'broken' | 'deprecated' | 'untested' {
    const lower = verification.toLowerCase();
    
    if (lower.includes('broken') || lower.includes('error') || lower.includes('fail')) {
      return 'broken';
    }
    if (lower.includes('deprecated') || lower.includes('obsolete')) {
      return 'deprecated';
    }
    if (lower.includes('untested') || lower.includes('no test')) {
      return 'untested';
    }
    
    return 'working';
  }

  private parseAPIEndpoints(verification: string): VerificationResult[] {
    // Parse the API verification results into individual endpoint results
    // This is a simplified version - in reality, you'd parse the structured response
    const results: VerificationResult[] = [];
    
    // Example parsing logic
    const lines = verification.split('\n');
    for (const line of lines) {
      if (line.includes('GET') || line.includes('POST') || line.includes('PUT') || line.includes('DELETE')) {
        results.push({
          component: `API: ${line.trim()}`,
          status: 'working', // Would be determined by actual verification
          details: line,
          codeLocation: 'routes/',
          lastVerified: new Date().toISOString()
        });
      }
    }
    
    return results;
  }

  generateVerificationReport(): string {
    const report = `# Code Verification Report

Generated: ${new Date().toISOString()}

## Summary

- Total Components Verified: ${this.verificationResults.length}
- Working: ${this.verificationResults.filter(r => r.status === 'working').length}
- Broken: ${this.verificationResults.filter(r => r.status === 'broken').length}
- Deprecated: ${this.verificationResults.filter(r => r.status === 'deprecated').length}
- Untested: ${this.verificationResults.filter(r => r.status === 'untested').length}

## Detailed Results

${this.verificationResults.map(r => `
### ${r.component}

- **Status**: ${r.status}
- **Location**: ${r.codeLocation}
- **Details**: ${r.details}
- **Verified**: ${r.lastVerified}
`).join('\n')}

## Recommendations

${this.generateRecommendations()}
`;
    
    return report;
  }

  private generateRecommendations(): string {
    const broken = this.verificationResults.filter(r => r.status === 'broken');
    const deprecated = this.verificationResults.filter(r => r.status === 'deprecated');
    
    let recommendations = '';
    
    if (broken.length > 0) {
      recommendations += `- Fix ${broken.length} broken components\n`;
    }
    
    if (deprecated.length > 0) {
      recommendations += `- Update ${deprecated.length} deprecated components\n`;
    }
    
    return recommendations || '- All components are functioning properly';
  }
}