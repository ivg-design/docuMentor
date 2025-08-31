export interface ProcessedDocument {
  filePath: string;
  title: string;
  type: string;
  content: string;
  frontmatter: any;
  tags: string[];
  backlinks: string[];
  sourceFiles: string[];
  errors: string[];
  warnings: string[];
}

export interface ProcessingContext {
  config: any;
  existingDocs: Map<string, ProcessedDocument>;
  tagHierarchy: Map<string, string[]>;
  documentGraph: Map<string, string[]>;
  sourceFileMap: Map<string, string[]>;
  processingStats: any;
}

export interface VerificationResult {
  passed: boolean;
  score: number;
  errors: string[];
  warnings: string[];
  checks: VerificationCheck[];
  summary: string;
}

export interface VerificationCheck {
  name: string;
  category: 'critical' | 'important' | 'recommended';
  passed: boolean;
  message: string;
  details?: string;
}

/**
 * Simple verification system for Obsidian integration
 * Performs basic checks to ensure documents meet integration requirements
 */
export class ObsidianVerifier {
  private config: any

  constructor(config: any) {
    this.config = config
  }

  /**
   * Verifies a document against Obsidian integration requirements
   */
  public async verifyDocument(
    document: ProcessedDocument,
    context: ProcessingContext
  ): Promise<VerificationResult> {
    const checks: VerificationCheck[] = []

    // Run all verification checks
    checks.push(this.checkProjectTag(document))
    checks.push(this.checkBasicFrontmatter(document))
    checks.push(this.checkMinimumTags(document))
    checks.push(this.checkHierarchicalTags(document))
    checks.push(this.checkBacklinks(document))
    checks.push(this.checkSourceReferences(document))
    checks.push(this.checkFooter(document))
    checks.push(this.checkContentQuality(document))
    checks.push(this.checkDocumentStructure(document))
    checks.push(this.checkTagConsistency(document, context))

    // Calculate results
    const result = this.calculateVerificationResult(checks)

    return result
  }

  /**
   * Checks if project tag is present and correctly positioned
   */
  private checkProjectTag(document: ProcessedDocument): VerificationCheck {
    const projectTag = this.config.projectTag

    if (!document.tags.includes(projectTag)) {
      return {
        name: 'Project Tag Missing',
        category: 'critical',
        passed: false,
        message: `Project tag "${projectTag}" is missing`,
        details: 'Every document must include the project tag for proper categorization'
      }
    }

    if (document.tags[0] !== projectTag) {
      return {
        name: 'Project Tag Position',
        category: 'important',
        passed: false,
        message: `Project tag should be first, but found "${document.tags[0]}" instead`,
        details: 'Project tag should always be the first tag for consistent organization'
      }
    }

    return {
      name: 'Project Tag',
      category: 'critical',
      passed: true,
      message: 'Project tag is properly positioned'
    }
  }

  /**
   * Checks basic frontmatter completeness
   */
  private checkBasicFrontmatter(document: ProcessedDocument): VerificationCheck {
    const required = ['project', 'project_tag', 'title', 'type', 'status', 'created', 'modified']
    const missing = required.filter(field => !document.frontmatter[field])

    if (missing.length > 0) {
      return {
        name: 'Basic Frontmatter',
        category: 'critical',
        passed: false,
        message: `Missing required frontmatter fields: ${missing.join(', ')}`,
        details: 'All documents must have complete frontmatter for proper indexing'
      }
    }

    return {
      name: 'Basic Frontmatter',
      category: 'critical',
      passed: true,
      message: 'All required frontmatter fields are present'
    }
  }

  /**
   * Checks minimum tag requirement
   */
  private checkMinimumTags(document: ProcessedDocument): VerificationCheck {
    const minTags = this.config.minTagsPerDocument || 3

    if (document.tags.length < minTags) {
      return {
        name: 'Minimum Tags',
        category: 'important',
        passed: false,
        message: `Document has ${document.tags.length} tags, minimum is ${minTags}`,
        details: 'Adequate tagging improves discoverability and organization'
      }
    }

    return {
      name: 'Minimum Tags',
      category: 'important',
      passed: true,
      message: `Document has ${document.tags.length} tags (≥${minTags})`
    }
  }

  /**
   * Checks for hierarchical tag structure
   */
  private checkHierarchicalTags(document: ProcessedDocument): VerificationCheck {
    const hierarchicalTags = document.tags.filter(tag => tag.includes('/'))
    const totalTags = document.tags.length
    const hierarchicalRatio = hierarchicalTags.length / totalTags

    if (hierarchicalRatio < 0.3) {
      return {
        name: 'Hierarchical Tags',
        category: 'recommended',
        passed: false,
        message: 'Less than 30% of tags are hierarchical',
        details: 'Hierarchical tags (e.g., #type/api, #component/auth) improve organization'
      }
    }

    return {
      name: 'Hierarchical Tags',
      category: 'recommended',
      passed: true,
      message: `${hierarchicalTags.length}/${totalTags} tags are hierarchical`
    }
  }

  /**
   * Checks backlink presence and quality
   */
  private checkBacklinks(document: ProcessedDocument): VerificationCheck {
    if (document.backlinks.length === 0) {
      // Allow minimal documents to have no backlinks
      if (document.content.length < 300) {
        return {
          name: 'Backlinks',
          category: 'recommended',
          passed: true,
          message: 'No backlinks (acceptable for minimal document)'
        }
      }

      return {
        name: 'Backlinks',
        category: 'recommended',
        passed: false,
        message: 'Document has no backlinks',
        details: 'Backlinks help create connections between related documents'
      }
    }

    // Check for excessive backlinking
    const backlinkDensity = document.backlinks.length / (document.content.length / 1000)
    if (backlinkDensity > 10) {
      return {
        name: 'Backlinks',
        category: 'recommended',
        passed: false,
        message: 'Excessive backlinking detected',
        details: 'Too many backlinks can make documents hard to read'
      }
    }

    return {
      name: 'Backlinks',
      category: 'recommended',
      passed: true,
      message: `Document has ${document.backlinks.length} appropriate backlinks`
    }
  }

  /**
   * Checks source file references
   */
  private checkSourceReferences(document: ProcessedDocument): VerificationCheck {
    if (document.sourceFiles.length === 0) {
      return {
        name: 'Source References',
        category: 'important',
        passed: false,
        message: 'No source files referenced',
        details: 'Documents should reference their source files for traceability'
      }
    }

    // Check if source files are properly formatted
    const invalidSources = document.sourceFiles.filter(source =>
      !source.includes('.') || source.length < 3
    )

    if (invalidSources.length > 0) {
      return {
        name: 'Source References',
        category: 'important',
        passed: false,
        message: `Invalid source file references: ${invalidSources.join(', ')}`,
        details: 'Source file references should be valid file paths'
      }
    }

    return {
      name: 'Source References',
      category: 'important',
      passed: true,
      message: `${document.sourceFiles.length} source files properly referenced`
    }
  }

  /**
   * Checks for proper document footer
   */
  private checkFooter(document: ProcessedDocument): VerificationCheck {
    const footerPatterns = [
      /Generated: .+ by DocuMentor/,
      /Source: .+/,
      /---\s*$/m
    ]

    const hasFooter = footerPatterns.some(pattern => pattern.test(document.content))

    if (!hasFooter) {
      return {
        name: 'Document Footer',
        category: 'recommended',
        passed: false,
        message: 'Missing proper document footer',
        details: 'Footer should include generation info and source references'
      }
    }

    return {
      name: 'Document Footer',
      category: 'recommended',
      passed: true,
      message: 'Document has proper footer'
    }
  }

  /**
   * Checks content quality and completeness
   */
  private checkContentQuality(document: ProcessedDocument): VerificationCheck {
    const content = document.content.trim()

    if (content.length < 50) {
      return {
        name: 'Content Quality',
        category: 'important',
        passed: false,
        message: 'Document content is too short',
        details: 'Documents should have meaningful content for usefulness'
      }
    }

    // Check for placeholder text
    const placeholders = ['TODO', 'FIXME', 'PLACEHOLDER', 'XXX']
    const hasPlaceholders = placeholders.some(placeholder =>
      content.toUpperCase().includes(placeholder)
    )

    if (hasPlaceholders) {
      return {
        name: 'Content Quality',
        category: 'recommended',
        passed: false,
        message: 'Document contains placeholder text',
        details: 'Placeholder text should be replaced with actual content'
      }
    }

    // Check for proper sentence structure
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0)
    if (sentences.length < 2 && content.length > 100) {
      return {
        name: 'Content Quality',
        category: 'recommended',
        passed: false,
        message: 'Content may lack proper sentence structure',
        details: 'Well-structured content improves readability'
      }
    }

    return {
      name: 'Content Quality',
      category: 'important',
      passed: true,
      message: 'Content quality is acceptable'
    }
  }

  /**
   * Checks document structure (headers, formatting)
   */
  private checkDocumentStructure(document: ProcessedDocument): VerificationCheck {
    const content = document.content

    // Check for proper markdown structure
    const hasHeaders = /^#+\s+.+$/m.test(content)
    const hasFrontmatter = content.startsWith('---') || Object.keys(document.frontmatter).length > 0

    if (!hasFrontmatter) {
      return {
        name: 'Document Structure',
        category: 'critical',
        passed: false,
        message: 'Missing frontmatter',
        details: 'Documents must have proper YAML frontmatter'
      }
    }

    if (!hasHeaders && content.length > 500) {
      return {
        name: 'Document Structure',
        category: 'recommended',
        passed: false,
        message: 'No headers found in substantial document',
        details: 'Headers improve document navigation and readability'
      }
    }

    return {
      name: 'Document Structure',
      category: 'important',
      passed: true,
      message: 'Document structure is appropriate'
    }
  }

  /**
   * Checks tag consistency with project standards
   */
  private checkTagConsistency(
    document: ProcessedDocument,
    context: ProcessingContext
  ): VerificationCheck {
    const issues: string[] = []

    // Check for malformed tags
    const malformedTags = document.tags.filter(tag =>
      !tag.startsWith('#') || tag.length < 3
    )

    if (malformedTags.length > 0) {
      issues.push(`Malformed tags: ${malformedTags.join(', ')}`)
    }

    // Check for duplicate tags
    const uniqueTags = new Set(document.tags)
    if (uniqueTags.size !== document.tags.length) {
      issues.push('Duplicate tags found')
    }

    // Check for overly generic tags
    const genericTags = document.tags.filter(tag =>
      ['#general', '#misc', '#other', '#stuff'].includes(tag.toLowerCase())
    )

    if (genericTags.length > 0) {
      issues.push(`Generic tags should be more specific: ${genericTags.join(', ')}`)
    }

    if (issues.length > 0) {
      return {
        name: 'Tag Consistency',
        category: 'important',
        passed: false,
        message: 'Tag consistency issues found',
        details: issues.join('; ')
      }
    }

    return {
      name: 'Tag Consistency',
      category: 'important',
      passed: true,
      message: 'Tags are consistent with project standards'
    }
  }

  /**
   * Calculates overall verification result
   */
  private calculateVerificationResult(checks: VerificationCheck[]): VerificationResult {
    const errors: string[] = []
    const warnings: string[] = []
    let score = 0
    let totalWeight = 0

    for (const check of checks) {
      const weight = this.getCheckWeight(check.category)
      totalWeight += weight

      if (check.passed) {
        score += weight
      } else {
        if (check.category === 'critical') {
          errors.push(`${check.name}: ${check.message}`)
        } else {
          warnings.push(`${check.name}: ${check.message}`)
        }
      }
    }

    const normalizedScore = totalWeight > 0 ? (score / totalWeight) * 100 : 0
    const passed = errors.length === 0 && normalizedScore >= 70

    const summary = this.generateSummary(checks, normalizedScore, passed)

    return {
      passed,
      score: Math.round(normalizedScore),
      errors,
      warnings,
      checks,
      summary
    }
  }

  /**
   * Gets weight for check category
   */
  private getCheckWeight(category: 'critical' | 'important' | 'recommended'): number {
    switch (category) {
    case 'critical': return 3
    case 'important': return 2
    case 'recommended': return 1
    }
  }

  /**
   * Generates verification summary
   */
  private generateSummary(
    checks: VerificationCheck[],
    score: number,
    passed: boolean
  ): string {
    const passedChecks = checks.filter(c => c.passed).length
    const totalChecks = checks.length
    const criticalIssues = checks.filter(c => !c.passed && c.category === 'critical').length
    const importantIssues = checks.filter(c => !c.passed && c.category === 'important').length

    if (passed) {
      return `✅ Verification passed (${score}% - ${passedChecks}/${totalChecks} checks passed)`
    } else {
      const issues = []
      if (criticalIssues > 0) issues.push(`${criticalIssues} critical`)
      if (importantIssues > 0) issues.push(`${importantIssues} important`)

      return `❌ Verification failed (${score}% - ${issues.join(', ')} issues found)`
    }
  }

  /**
   * Verifies multiple documents and returns summary statistics
   */
  public async verifyDocuments(
    documents: ProcessedDocument[],
    context: ProcessingContext
  ): Promise<{
    results: VerificationResult[];
    summary: {
      totalDocuments: number;
      passedDocuments: number;
      averageScore: number;
      commonIssues: string[];
    };
  }> {
    const results: VerificationResult[] = []

    for (const document of documents) {
      const result = await this.verifyDocument(document, context)
      results.push(result)
    }

    const summary = {
      totalDocuments: documents.length,
      passedDocuments: results.filter(r => r.passed).length,
      averageScore: results.reduce((sum, r) => sum + r.score, 0) / results.length,
      commonIssues: this.findCommonIssues(results)
    }

    return { results, summary }
  }

  /**
   * Finds common issues across all documents
   */
  private findCommonIssues(results: VerificationResult[]): string[] {
    const issueCounts = new Map<string, number>()

    for (const result of results) {
      const allIssues = [...result.errors, ...result.warnings]
      for (const issue of allIssues) {
        const issueType = issue.split(':')[0]
        issueCounts.set(issueType, (issueCounts.get(issueType) || 0) + 1)
      }
    }

    // Return issues that affect more than 25% of documents
    const threshold = Math.max(1, Math.floor(results.length * 0.25))

    return Array.from(issueCounts.entries())
      .filter(([, count]) => count >= threshold)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue, count]) => `${issue} (${count} documents)`)
  }
}
