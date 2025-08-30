import { ClaudeClient } from './ClaudeClient'

export interface ProcessedDocument {
  id?: string;
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

export interface TagAnalysis {
  tag: string;
  frequency: number;
  score?: number;
  documents: string[];
  parentTag?: string;
  childTags: string[];
  isRedundant: boolean;
  suggestedReplacement?: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
}

export interface TagOptimizationResult {
  originalTags: string[];
  optimizedTags: string[];
  changes: TagChange[];
  reasoning: string;
}

export interface TagChange {
  type: 'add' | 'remove' | 'replace' | 'merge' | 'hierarchize';
  originalTag?: string;
  newTag: string;
  reason: string;
}

export interface TagHierarchyNode {
  tag: string;
  level: number;
  parent?: string;
  children: string[];
  documentCount: number;
  examples: string[];
}

/**
 * AI-driven tag optimization for Obsidian integration
 * Ensures project tag consistency, creates hierarchical structures, and eliminates redundancy
 */
export class ObsidianTagOptimizer {
  private config: any
  private claudeClient: ClaudeClient
  private tagAnalysisCache: Map<string, TagAnalysis> = new Map()
  private projectTag: string
  private MIN_TAGS_PER_DOC: number = 3
  private MAX_TAGS_PER_DOC: number = 7

  constructor(config: any, claudeClient: ClaudeClient) {
    this.config = config
    this.claudeClient = claudeClient
    this.projectTag = config.project?.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'project'
  }

  /**
   * Optimizes tags for all documents using AI-driven analysis
   */
  public async optimizeTags(
    documents: ProcessedDocument[],
    context: ProcessingContext
  ): Promise<string[][]> {
    console.log('Starting AI-driven tag optimization...')

    // Phase 1: Analyze all existing tags
    const tagAnalysis = await this.analyzeAllTags(documents, context)

    // Phase 2: Generate optimization strategy with AI
    const optimizationStrategy = await this.generateOptimizationStrategy(tagAnalysis, documents)

    // Phase 3: Apply optimizations to each document
    const optimizedTagsPerDocument = await this.applyOptimizations(
      documents,
      optimizationStrategy,
      context
    )

    // Phase 4: Ensure consistency and project tag compliance
    const finalTags = this.ensureTagConsistency(optimizedTagsPerDocument, documents)

    console.log('Tag optimization completed')
    return finalTags
  }

  /**
   * Analyzes all tags across all documents to identify patterns and issues
   */
  private async analyzeAllTags(
    documents: ProcessedDocument[],
    context: ProcessingContext
  ): Promise<TagAnalysis[]> {
    const tagFrequency = new Map<string, number>()
    const tagDocuments = new Map<string, Set<string>>()

    // Collect tag statistics
    for (const doc of documents) {
      for (const tag of doc.tags) {
        tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1)

        if (!tagDocuments.has(tag)) {
          tagDocuments.set(tag, new Set())
        }
        tagDocuments.get(tag)!.add(doc.title)
      }
    }

    // Include existing tags from context
    for (const doc of context.existingDocs.values()) {
      for (const tag of doc.tags) {
        tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1)

        if (!tagDocuments.has(tag)) {
          tagDocuments.set(tag, new Set())
        }
        tagDocuments.get(tag)!.add(doc.title)
      }
    }

    // Generate analysis for each tag
    const analyses: TagAnalysis[] = []

    for (const [tag, frequency] of tagFrequency) {
      const analysis: TagAnalysis = {
        tag,
        frequency,
        documents: Array.from(tagDocuments.get(tag) || []),
        childTags: this.findChildTags(tag, Array.from(tagFrequency.keys())),
        parentTag: this.findParentTag(tag, Array.from(tagFrequency.keys())),
        isRedundant: this.isTagRedundant(tag, frequency, tagFrequency),
        importance: this.calculateTagImportance(tag, frequency, documents.length)
      }

      // Suggest replacement if redundant
      if (analysis.isRedundant) {
        analysis.suggestedReplacement = this.suggestReplacement(tag, tagFrequency)
      }

      analyses.push(analysis)
    }

    return analyses
  }

  /**
   * Finds child tags (tags that start with the current tag)
   */
  private findChildTags(parentTag: string, allTags: string[]): string[] {
    const normalized = parentTag.endsWith('/') ? parentTag : parentTag + '/'
    return allTags.filter(tag => tag.startsWith(normalized) && tag !== parentTag)
  }

  /**
   * Finds parent tag (tag that this tag is a child of)
   */
  private findParentTag(tag: string, allTags: string[]): string | undefined {
    const parts = tag.split('/')
    if (parts.length <= 1) return undefined

    for (let i = parts.length - 1; i > 0; i--) {
      const potentialParent = parts.slice(0, i).join('/')
      if (allTags.includes(potentialParent)) {
        return potentialParent
      }
    }

    return undefined
  }

  /**
   * Determines if a tag is redundant
   */
  private isTagRedundant(tag: string, frequency: number, allTagFrequency: Map<string, number>): boolean {
    // Single-use tags might be redundant unless they're very specific
    if (frequency === 1 && !this.isSpecificTag(tag)) {
      return true
    }

    // Tags with very similar alternatives might be redundant
    for (const [otherTag, otherFreq] of allTagFrequency) {
      if (otherTag !== tag && this.areTagsSimilar(tag, otherTag) && otherFreq > frequency) {
        return true
      }
    }

    return false
  }

  /**
   * Checks if a tag is specific enough to warrant keeping
   */
  private isSpecificTag(tag: string): boolean {
    const specificPatterns = [
      /^#project\//, // Project tags
      /^#type\/\w+\/\w+/, // Hierarchical type tags
      /^#component\/\w+\/\w+/, // Specific components
      /^\w+\/\w+\/\w+/ // Deep hierarchical tags
    ]

    return specificPatterns.some(pattern => pattern.test(tag))
  }

  /**
   * Checks if two tags are similar and potentially redundant
   */
  private areTagsSimilar(tag1: string, tag2: string): boolean {
    // Remove # and convert to lowercase
    const clean1 = tag1.replace('#', '').toLowerCase()
    const clean2 = tag2.replace('#', '').toLowerCase()

    // Check for similar words
    const words1 = clean1.split(/[/\-_]/)
    const words2 = clean2.split(/[/\-_]/)

    const commonWords = words1.filter(word => words2.includes(word))

    // If more than 50% of words are common, consider similar
    return commonWords.length > Math.min(words1.length, words2.length) * 0.5
  }

  /**
   * Suggests a replacement for a redundant tag
   */
  private suggestReplacement(tag: string, allTagFrequency: Map<string, number>): string | undefined {
    for (const [otherTag ] of allTagFrequency) {
      if (otherTag !== tag && this.areTagsSimilar(tag, otherTag)) {
        return otherTag
      }
    }
    return undefined
  }

  /**
   * Calculates tag importance based on frequency and context
   */
  private calculateTagImportance(
    tag: string,
    frequency: number,
    totalDocuments: number
  ): 'critical' | 'high' | 'medium' | 'low' {
    // Project tag is always critical
    if (tag.startsWith('#project/')) {
      return 'critical'
    }

    // Calculate relative frequency
    const relativeFrequency = frequency / totalDocuments

    if (relativeFrequency > 0.7) return 'critical'
    if (relativeFrequency > 0.4) return 'high'
    if (relativeFrequency > 0.1) return 'medium'
    return 'low'
  }

  /**
   * Generates optimization strategy using AI
   */
  private async generateOptimizationStrategy(
    tagAnalyses: TagAnalysis[],
    documents: ProcessedDocument[]
  ): Promise<Map<string, TagOptimizationResult>> {
    console.log('Generating AI-driven optimization strategy...')

    const strategy = new Map<string, TagOptimizationResult>()

    // Group documents by similarity for batch processing
    const documentGroups = this.groupDocumentsByType(documents)

    for (const [groupType, groupDocs] of documentGroups) {
      console.log(`Optimizing tags for ${groupType} documents (${groupDocs.length} docs)...`)

      const groupStrategy = await this.optimizeTagsForGroup(groupDocs, tagAnalyses)

      for (const [docTitle, optimization] of groupStrategy) {
        strategy.set(docTitle, optimization)
      }
    }

    return strategy
  }

  /**
   * Groups documents by type for batch optimization
   */
  private groupDocumentsByType(documents: ProcessedDocument[]): Map<string, ProcessedDocument[]> {
    const groups = new Map<string, ProcessedDocument[]>()

    for (const doc of documents) {
      const groupKey = doc.type

      if (!groups.has(groupKey)) {
        groups.set(groupKey, [])
      }
      groups.get(groupKey)!.push(doc)
    }

    return groups
  }

  /**
   * Optimizes tags for a group of similar documents
   */
  private async optimizeTagsForGroup(
    documents: ProcessedDocument[],
    tagAnalyses: TagAnalysis[]
  ): Promise<Map<string, TagOptimizationResult>> {
    try {
      const request = {
        documents: documents.map(d => ({
          id: d.id || d.filePath,
          title: d.title,
          tags: d.tags,
          type: d.type
        })),
        tagAnalysis: tagAnalyses.map(t => ({
          tag: t.tag,
          frequency: t.frequency,
          score: t.score
        })),
        projectTag: this.projectTag,
        minTags: this.MIN_TAGS_PER_DOC,
        maxTags: this.MAX_TAGS_PER_DOC
      }
      const aiResponse = await this.claudeClient.optimizeTags(request)

      return this.parseOptimizationResponse(aiResponse, documents)
    } catch (error) {
      console.warn('AI optimization failed for group, using fallback:', error)
      return this.generateFallbackOptimization(documents, tagAnalyses)
    }
  }

  /**
   * Creates AI prompt for tag optimization
   */
  private createGroupOptimizationPrompt(
    documents: ProcessedDocument[],
    tagAnalyses: TagAnalysis[]
  ): string {
    const redundantTags = tagAnalyses.filter(a => a.isRedundant).map(a => a.tag)
    const singleUseTags = tagAnalyses.filter(a => a.frequency === 1).map(a => a.tag)

    return `Optimize tags for ${documents.length} documents of type "${documents[0]?.type || 'mixed'}".

Project tag (MUST be first): ${this.config.projectTag}
Minimum tags per document: ${this.config.minTagsPerDocument}
Maximum tags per document: ${this.config.maxTagsPerDocument}

Documents and current tags:
${documents.map(doc => `${doc.title}: ${doc.tags.join(', ')}`).join('\n')}

Tag analysis:
- Redundant tags to consolidate: ${redundantTags.join(', ')}
- Single-use tags to review: ${singleUseTags.join(', ')}

Please optimize tags following these rules:
1. ALWAYS keep project tag first: ${this.config.projectTag}
2. Create hierarchical structure (e.g., #type/api, #component/auth)
3. Consolidate redundant tags
4. Keep important single-use tags if they're specific
5. Ensure ${this.config.minTagsPerDocument}-${this.config.maxTagsPerDocument} tags per document
6. Create meaningful tag relationships

Provide optimized tags for each document with reasoning.`
  }

  /**
   * Parses AI optimization response
   */
  private parseOptimizationResponse(
    aiResponse: any,
    documents: ProcessedDocument[]
  ): Map<string, TagOptimizationResult> {
    const results = new Map<string, TagOptimizationResult>()

    try {
      if (aiResponse && aiResponse.optimizations) {
        for (const doc of documents) {
          const optimization = aiResponse.optimizations[doc.title]
          if (optimization) {
            results.set(doc.title, {
              originalTags: [...doc.tags],
              optimizedTags: optimization.tags || doc.tags,
              changes: optimization.changes || [],
              reasoning: optimization.reasoning || 'AI-optimized tags'
            })
          }
        }
      }
    } catch (error) {
      console.warn('Error parsing AI response, using fallback:', error)
    }

    // Fill in missing documents with fallback
    for (const doc of documents) {
      if (!results.has(doc.title)) {
        results.set(doc.title, this.generateFallbackOptimizationForDoc(doc))
      }
    }

    return results
  }

  /**
   * Generates fallback optimization when AI fails
   */
  private generateFallbackOptimization(
    documents: ProcessedDocument[],
    tagAnalyses: TagAnalysis[]
  ): Map<string, TagOptimizationResult> {
    const results = new Map<string, TagOptimizationResult>()

    for (const doc of documents) {
      results.set(doc.title, this.generateFallbackOptimizationForDoc(doc))
    }

    return results
  }

  /**
   * Generates fallback optimization for a single document
   */
  private generateFallbackOptimizationForDoc(doc: ProcessedDocument): TagOptimizationResult {
    const optimized = [...doc.tags]

    // Ensure project tag is first
    const projectTagIndex = optimized.indexOf(this.config.projectTag)
    if (projectTagIndex > 0) {
      optimized.splice(projectTagIndex, 1)
      optimized.unshift(this.config.projectTag)
    } else if (projectTagIndex === -1) {
      optimized.unshift(this.config.projectTag)
    }

    // Add type tag if missing
    const typeTag = `#type/${doc.type}`
    if (!optimized.includes(typeTag)) {
      optimized.push(typeTag)
    }

    // Ensure minimum tags
    while (optimized.length < this.config.minTagsPerDocument) {
      const fallbackTag = this.generateFallbackTag(doc, optimized.length)
      if (!optimized.includes(fallbackTag)) {
        optimized.push(fallbackTag)
      } else {
        break // Avoid infinite loop
      }
    }

    // Trim to maximum tags
    if (optimized.length > this.config.maxTagsPerDocument) {
      optimized.splice(this.config.maxTagsPerDocument)
    }

    return {
      originalTags: [...doc.tags],
      optimizedTags: optimized,
      changes: [{
        type: 'add',
        newTag: 'fallback-optimization',
        reason: 'Applied fallback tag optimization'
      }],
      reasoning: 'Fallback optimization applied due to AI unavailability'
    }
  }

  /**
   * Generates a fallback tag based on document properties
   */
  private generateFallbackTag(doc: ProcessedDocument, position: number): string {
    const fallbackTags = [
      `#status/${doc.frontmatter?.status || 'unknown'}`,
      `#source/${doc.sourceFiles[0]?.split('.').pop() || 'unknown'}`,
      '#auto/generated',
      '#category/general'
    ]

    return fallbackTags[position % fallbackTags.length]
  }

  /**
   * Applies optimizations to all documents
   */
  private async applyOptimizations(
    documents: ProcessedDocument[],
    strategy: Map<string, TagOptimizationResult>,
    context: ProcessingContext
  ): Promise<string[][]> {
    const optimizedTagsPerDocument: string[][] = []

    for (const doc of documents) {
      const optimization = strategy.get(doc.title)

      if (optimization) {
        optimizedTagsPerDocument.push(optimization.optimizedTags)
        console.log(`Applied tag optimization to "${doc.title}": ${optimization.changes.length} changes`)
      } else {
        // No optimization found, use original tags but ensure project tag compliance
        const tags = this.ensureProjectTagCompliance([...doc.tags])
        optimizedTagsPerDocument.push(tags)
      }
    }

    return optimizedTagsPerDocument
  }

  /**
   * Ensures project tag compliance for tag array
   */
  private ensureProjectTagCompliance(tags: string[]): string[] {
    const projectTagIndex = tags.indexOf(this.config.projectTag)

    if (projectTagIndex > 0) {
      tags.splice(projectTagIndex, 1)
      tags.unshift(this.config.projectTag)
    } else if (projectTagIndex === -1) {
      tags.unshift(this.config.projectTag)
    }

    return tags
  }

  /**
   * Ensures consistency across all optimized tags
   */
  private ensureTagConsistency(
    optimizedTagsPerDocument: string[][],
    documents: ProcessedDocument[]
  ): string[][] {
    // Final consistency pass
    for (let i = 0; i < optimizedTagsPerDocument.length; i++) {
      const tags = optimizedTagsPerDocument[i]
      const doc = documents[i]

      // Ensure project tag is first
      const projectTagIndex = tags.indexOf(this.config.projectTag)
      if (projectTagIndex !== 0) {
        if (projectTagIndex > 0) {
          tags.splice(projectTagIndex, 1)
        }
        tags.unshift(this.config.projectTag)
      }

      // Ensure minimum tag count
      while (tags.length < this.config.minTagsPerDocument) {
        const fallbackTag = this.generateFallbackTag(doc, tags.length)
        if (!tags.includes(fallbackTag)) {
          tags.push(fallbackTag)
        } else {
          break
        }
      }

      // Ensure maximum tag count
      if (tags.length > this.config.maxTagsPerDocument) {
        tags.splice(this.config.maxTagsPerDocument)
      }

      // Remove duplicates while preserving order
      optimizedTagsPerDocument[i] = [...new Set(tags)]
    }

    return optimizedTagsPerDocument
  }

  /**
   * Generates TAG_HIERARCHY.md document
   */
  public async generateTagHierarchyDocument(
    documents: ProcessedDocument[],
    context: ProcessingContext
  ): Promise<string> {
    console.log('Generating TAG_HIERARCHY.md...')

    const tagHierarchy = this.buildTagHierarchy(documents, context)
    const sections = []

    // Header
    sections.push('---')
    sections.push(`project: "${this.config.projectName}"`)
    sections.push(`project_tag: "${this.config.projectTag}"`)
    sections.push('title: "Tag Hierarchy"')
    sections.push('type: "reference"')
    sections.push('status: "complete"')
    sections.push(`created: ${new Date().toISOString()}`)
    sections.push(`modified: ${new Date().toISOString()}`)
    sections.push('source_files: []')
    sections.push('related: []')
    sections.push('---')
    sections.push('')
    sections.push('# Tag Hierarchy')
    sections.push('')
    sections.push('This document provides an overview of the tag structure used throughout the documentation.')
    sections.push('')

    // Hierarchy visualization
    sections.push('## Tag Structure')
    sections.push('')
    for (const node of tagHierarchy) {
      const indent = '  '.repeat(node.level)
      sections.push(`${indent}- **${node.tag}** (${node.documentCount} docs)`)

      if (node.examples.length > 0) {
        const exampleText = node.examples.slice(0, 3).join(', ')
        sections.push(`${indent}  _Examples: ${exampleText}_`)
      }
    }

    // Tag statistics
    sections.push('')
    sections.push('## Statistics')
    sections.push(`- Total unique tags: ${tagHierarchy.length}`)
    sections.push(`- Average tags per document: ${this.calculateAverageTagsPerDocument(documents)}`)
    sections.push(`- Most used tag: ${this.getMostUsedTag(documents)}`)

    // Footer
    sections.push('')
    sections.push('---')
    sections.push('## Tags')
    sections.push(this.config.projectTag)
    sections.push('#type/reference')
    sections.push('#meta/hierarchy')
    sections.push('')
    sections.push('---')
    sections.push(`Generated: ${new Date().toISOString().split('T')[0]} by DocuMentor v3.1`)

    return sections.join('\n')
  }

  /**
   * Builds tag hierarchy structure
   */
  private buildTagHierarchy(
    documents: ProcessedDocument[],
    _context: ProcessingContext
  ): TagHierarchyNode[] {
    const tagCounts = new Map<string, { count: number; examples: Set<string> }>()

    // Count tag usage
    for (const doc of documents) {
      for (const tag of doc.tags) {
        if (!tagCounts.has(tag)) {
          tagCounts.set(tag, { count: 0, examples: new Set() })
        }
        const tagInfo = tagCounts.get(tag)!
        tagInfo.count++
        tagInfo.examples.add(doc.title)
      }
    }

    // Build hierarchy
    const hierarchy: TagHierarchyNode[] = []
    const processedTags = new Set<string>()

    // Sort tags to process parents before children
    const sortedTags = Array.from(tagCounts.keys()).sort()

    for (const tag of sortedTags) {
      if (processedTags.has(tag)) continue

      const node = this.createHierarchyNode(tag, tagCounts, processedTags)
      hierarchy.push(node)
    }

    return hierarchy.sort((a, b) => a.level - b.level || a.tag.localeCompare(b.tag))
  }

  /**
   * Creates a hierarchy node for a tag
   */
  private createHierarchyNode(
    tag: string,
    tagCounts: Map<string, { count: number; examples: Set<string> }>,
    processedTags: Set<string>
  ): TagHierarchyNode {
    const tagInfo = tagCounts.get(tag)!
    const level = (tag.match(/\//g) || []).length
    const parts = tag.split('/')
    const parent = parts.length > 1 ? parts.slice(0, -1).join('/') : undefined

    const node: TagHierarchyNode = {
      tag,
      level,
      parent,
      children: this.findChildTags(tag, Array.from(tagCounts.keys())),
      documentCount: tagInfo.count,
      examples: Array.from(tagInfo.examples).slice(0, 5)
    }

    processedTags.add(tag)
    return node
  }

  /**
   * Calculates average tags per document
   */
  private calculateAverageTagsPerDocument(documents: ProcessedDocument[]): number {
    const total = documents.reduce((sum, doc) => sum + doc.tags.length, 0)
    return Number((total / documents.length).toFixed(1))
  }

  /**
   * Gets the most frequently used tag
   */
  private getMostUsedTag(documents: ProcessedDocument[]): string {
    const tagCounts = new Map<string, number>()

    for (const doc of documents) {
      for (const tag of doc.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      }
    }

    let mostUsed = ''
    let maxCount = 0

    for (const [tag, count] of tagCounts) {
      if (count > maxCount) {
        maxCount = count
        mostUsed = tag
      }
    }

    return `${mostUsed} (${maxCount} uses)`
  }
}
