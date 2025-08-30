import * as path from 'path'

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

export interface BacklinkCandidate {
  targetTitle: string;
  targetPath: string;
  relevanceScore: number;
  linkType: 'document' | 'source' | 'concept' | 'tag';
  context: string;
  position: number;
  naturalPhrase: string;
}

export interface BacklinkInsertionPoint {
  position: number;
  originalText: string;
  linkedText: string;
  linkType: 'document' | 'source';
  confidence: number;
}

/**
 * Natural backlink generation for Obsidian integration
 * Creates meaningful, readable links between documents and to source files
 */
export class ObsidianBacklinks {
  private config: any
  private linkPatterns: RegExp[] = []
  private sourcePatterns: RegExp[] = []

  constructor(config: any) {
    this.config = config
    this.initializePatterns()
  }

  /**
   * Initializes patterns for natural link detection
   */
  private initializePatterns(): void {
    // Patterns for document references
    this.linkPatterns = [
      /\b(see|check|refer to|as described in|mentioned in|detailed in)\s+([A-Z][A-Za-z\s]+)/gi,
      /\b(the|this|that)\s+([A-Z][A-Za-z\s]+)\s+(component|module|function|class|interface)/gi,
      /\b([A-Z][A-Za-z]+)\s+(API|component|module|service|utility)/gi,
      /\b(similar to|like|unlike|compared to)\s+([A-Z][A-Za-z\s]+)/gi
    ]

    // Patterns for source file references
    this.sourcePatterns = [
      /\b(in|from|at)\s+([A-Za-z0-9/.\-_]+\.(ts|js|py|java|cpp|go|rs|md))/gi,
      /\b(file|implementation|code)\s+([A-Za-z0-9/.\-_]+\.(ts|js|py|java|cpp|go|rs))/gi,
      /\b([A-Za-z0-9/.\-_]+\.(ts|js|py|java|cpp|go|rs)):(\d+)/gi
    ]
  }

  /**
   * Generates backlinks for a document
   */
  public async generateBacklinks(
    document: ProcessedDocument,
    allDocuments: ProcessedDocument[],
    _context: ProcessingContext
  ): Promise<string[]> {
    const candidates: BacklinkCandidate[] = []

    // Find document links
    const documentLinks = this.findDocumentLinks(document, allDocuments, _context)
    candidates.push(...documentLinks)

    // Find source file links
    const sourceLinks = this.findSourceFileLinks(document, _context)
    candidates.push(...sourceLinks)

    // Find concept/tag-based links
    const conceptLinks = this.findConceptLinks(document, allDocuments, _context)
    candidates.push(...conceptLinks)

    // Filter and rank candidates
    const filteredCandidates = this.filterAndRankCandidates(candidates, document)

    // Convert to backlink strings
    return this.convertCandidatesToBacklinks(filteredCandidates)
  }

  /**
   * Finds natural document links in the content
   */
  private findDocumentLinks(
    document: ProcessedDocument,
    allDocuments: ProcessedDocument[],
    _context: ProcessingContext
  ): BacklinkCandidate[] {
    const candidates: BacklinkCandidate[] = []
    const content = document.content.toLowerCase()

    for (const otherDoc of allDocuments) {
      if (otherDoc.filePath === document.filePath) continue

      // Check for title mentions
      const titleVariations = this.generateTitleVariations(otherDoc.title)

      for (const variation of titleVariations) {
        const positions = this.findTextPositions(content, variation.toLowerCase())

        for (const position of positions) {
          const context = this.extractContext(document.content, position, variation.length)

          candidates.push({
            targetTitle: otherDoc.title,
            targetPath: otherDoc.filePath,
            relevanceScore: this.calculateDocumentRelevance(document, otherDoc),
            linkType: 'document',
            context,
            position,
            naturalPhrase: variation
          })
        }
      }

      // Check for concept mentions
      const concepts = this.extractConceptsFromDocument(otherDoc)
      for (const concept of concepts) {
        if (content.includes(concept.toLowerCase())) {
          const positions = this.findTextPositions(content, concept.toLowerCase())

          for (const position of positions) {
            const contextStr = this.extractContext(document.content, position, concept.length)

            candidates.push({
              targetTitle: otherDoc.title,
              targetPath: otherDoc.filePath,
              relevanceScore: this.calculateConceptRelevance(concept, document, otherDoc),
              linkType: 'concept',
              context: contextStr,
              position,
              naturalPhrase: concept
            })
          }
        }
      }
    }

    return candidates
  }

  /**
   * Generates variations of document titles for linking
   */
  private generateTitleVariations(title: string): string[] {
    const variations = [title]

    // Add camelCase version
    const camelCase = title.replace(/\s+(\w)/g, (_, char) => char.toUpperCase()).replace(/^\w/, c => c.toLowerCase())
    if (camelCase !== title) {
      variations.push(camelCase)
    }

    // Add PascalCase version
    const pascalCase = title.replace(/\s+(\w)/g, (_, char) => char.toUpperCase()).replace(/^\w/, c => c.toUpperCase())
    if (pascalCase !== title) {
      variations.push(pascalCase)
    }

    // Add kebab-case version
    const kebabCase = title.toLowerCase().replace(/\s+/g, '-')
    if (kebabCase !== title.toLowerCase()) {
      variations.push(kebabCase)
    }

    // Add snake_case version
    const snakeCase = title.toLowerCase().replace(/\s+/g, '_')
    if (snakeCase !== title.toLowerCase()) {
      variations.push(snakeCase)
    }

    return variations
  }

  /**
   * Finds positions where text appears in content
   */
  private findTextPositions(content: string, searchText: string): number[] {
    const positions: number[] = []
    let startIndex = 0

    let index = content.indexOf(searchText, startIndex)
    while (index !== -1) {
      // Process the found index

      // Check if it's a whole word
      if (this.isWholeWord(content, index, searchText.length)) {
        positions.push(index)
      }

      startIndex = index + 1
      index = content.indexOf(searchText, startIndex)
    }

    return positions
  }

  /**
   * Checks if found text is a whole word
   */
  private isWholeWord(content: string, position: number, length: number): boolean {
    const wordBoundary = /\b/
    const before = position === 0 ? ' ' : content[position - 1]
    const after = position + length >= content.length ? ' ' : content[position + length]

    return wordBoundary.test(before) && wordBoundary.test(after)
  }

  /**
   * Extracts context around a found text position
   */
  private extractContext(content: string, position: number, textLength: number): string {
    const contextRadius = 50
    const start = Math.max(0, position - contextRadius)
    const end = Math.min(content.length, position + textLength + contextRadius)

    return content.substring(start, end).trim()
  }

  /**
   * Calculates relevance between two documents
   */
  private calculateDocumentRelevance(doc1: ProcessedDocument, doc2: ProcessedDocument): number {
    let score = 0

    // Same type bonus
    if (doc1.type === doc2.type) score += 0.3

    // Common tags bonus
    const commonTags = doc1.tags.filter(tag => doc2.tags.includes(tag))
    score += commonTags.length * 0.2

    // Same source directory bonus
    const dir1 = path.dirname(doc1.sourceFiles[0] || '')
    const dir2 = path.dirname(doc2.sourceFiles[0] || '')
    if (dir1 === dir2 && dir1 !== '') score += 0.2

    // Content similarity bonus (simplified)
    const words1 = doc1.content.toLowerCase().split(/\s+/)
    const words2 = doc2.content.toLowerCase().split(/\s+/)
    const commonWords = words1.filter(word => word.length > 4 && words2.includes(word))
    score += Math.min(commonWords.length / 50, 0.3)

    return Math.min(score, 1.0)
  }

  /**
   * Extracts key concepts from a document
   */
  private extractConceptsFromDocument(document: ProcessedDocument): string[] {
    const concepts: string[] = []

    // Extract from title
    const titleWords = document.title.split(/\s+/).filter(word => word.length > 3)
    concepts.push(...titleWords)

    // Extract from tags (remove # and split by /)
    for (const tag of document.tags) {
      const tagParts = tag.replace('#', '').split('/')
      concepts.push(...tagParts.filter(part => part.length > 2))
    }

    // Extract capitalized words from content (likely class/function names)
    const capitalizedWords = document.content.match(/\b[A-Z][A-Za-z]{3,}\b/g) || []
    concepts.push(...capitalizedWords.slice(0, 10)) // Limit to avoid noise

    // Remove duplicates and common words
    const filtered = [...new Set(concepts)]
      .filter(concept => !this.isCommonWord(concept))
      .filter(concept => concept.length > 2)

    return filtered.slice(0, 15) // Limit to most important concepts
  }

  /**
   * Checks if a word is too common to be a useful concept
   */
  private isCommonWord(word: string): boolean {
    const commonWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
      'above', 'below', 'between', 'among', 'this', 'that', 'these', 'those',
      'document', 'file', 'code', 'function', 'class', 'method', 'property'
    ])

    return commonWords.has(word.toLowerCase())
  }

  /**
   * Calculates concept relevance
   */
  private calculateConceptRelevance(
    concept: string,
    sourceDoc: ProcessedDocument,
    targetDoc: ProcessedDocument
  ): number {
    let score = 0.5 // Base score for concept match

    // Boost if concept is in target document title
    if (targetDoc.title.toLowerCase().includes(concept.toLowerCase())) {
      score += 0.3
    }

    // Boost if concept is in target document tags
    if (targetDoc.tags.some(tag => tag.toLowerCase().includes(concept.toLowerCase()))) {
      score += 0.2
    }

    // Reduce score if concept is very common in source document
    const conceptCount = (sourceDoc.content.toLowerCase().match(
      new RegExp(concept.toLowerCase(), 'g')
    ) || []).length

    if (conceptCount > 5) {
      score *= 0.7
    }

    return Math.min(score, 1.0)
  }

  /**
   * Finds source file links in the content
   */
  private findSourceFileLinks(
    document: ProcessedDocument,
    _context: ProcessingContext
  ): BacklinkCandidate[] {
    const candidates: BacklinkCandidate[] = []
    const content = document.content

    // Find explicit source file mentions
    for (const pattern of this.sourcePatterns) {
      let match
      pattern.lastIndex = 0 // Reset regex state

      while ((match = pattern.exec(content)) !== null) {
        const filePath = match[2] || match[1]
        if (filePath && this.isValidSourceFile(filePath)) {
          candidates.push({
            targetTitle: path.basename(filePath),
            targetPath: filePath,
            relevanceScore: 0.8, // High relevance for explicit source mentions
            linkType: 'source',
            context: this.extractContext(content, match.index, match[0].length),
            position: match.index,
            naturalPhrase: match[0]
          })
        }
      }
    }

    // Add links to document's own source files
    for (const sourceFile of document.sourceFiles) {
      if (!candidates.some(c => c.targetPath === sourceFile)) {
        candidates.push({
          targetTitle: path.basename(sourceFile),
          targetPath: sourceFile,
          relevanceScore: 0.9, // Very high relevance for document's own sources
          linkType: 'source',
          context: 'Document source file',
          position: -1, // Will be added at the end
          naturalPhrase: path.basename(sourceFile)
        })
      }
    }

    return candidates
  }

  /**
   * Checks if a file path represents a valid source file
   */
  private isValidSourceFile(filePath: string): boolean {
    const sourceExtensions = ['.ts', '.js', '.py', '.java', '.cpp', '.c', '.go', '.rs', '.md']
    return sourceExtensions.some(ext => filePath.toLowerCase().endsWith(ext))
  }

  /**
   * Finds concept and tag-based links
   */
  private findConceptLinks(
    document: ProcessedDocument,
    allDocuments: ProcessedDocument[],
    _context: ProcessingContext
  ): BacklinkCandidate[] {
    const candidates: BacklinkCandidate[] = []

    // Find documents with overlapping tags
    for (const otherDoc of allDocuments) {
      if (otherDoc.filePath === document.filePath) continue

      const commonTags = document.tags.filter(tag => otherDoc.tags.includes(tag))

      if (commonTags.length >= 2) { // Significant tag overlap
        candidates.push({
          targetTitle: otherDoc.title,
          targetPath: otherDoc.filePath,
          relevanceScore: 0.4 + (commonTags.length * 0.1),
          linkType: 'tag',
          context: `Related via tags: ${commonTags.join(', ')}`,
          position: -1,
          naturalPhrase: otherDoc.title
        })
      }
    }

    return candidates
  }

  /**
   * Filters and ranks candidates to avoid over-linking
   */
  private filterAndRankCandidates(
    candidates: BacklinkCandidate[],
    document: ProcessedDocument
  ): BacklinkCandidate[] {
    // Remove duplicates (same target, prefer higher relevance)
    const uniqueCandidates = new Map<string, BacklinkCandidate>()

    for (const candidate of candidates) {
      const key = candidate.targetPath
      if (!uniqueCandidates.has(key) ||
          uniqueCandidates.get(key)!.relevanceScore < candidate.relevanceScore) {
        uniqueCandidates.set(key, candidate)
      }
    }

    // Convert back to array and sort by relevance
    const filtered = Array.from(uniqueCandidates.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore)

    // Limit number of backlinks to avoid over-linking
    const maxBacklinks = this.calculateMaxBacklinks(document)

    // Prefer document links over concept links
    const documentLinks = filtered.filter(c => c.linkType === 'document' || c.linkType === 'source')
    const conceptLinks = filtered.filter(c => c.linkType === 'concept' || c.linkType === 'tag')

    const selected = [
      ...documentLinks.slice(0, Math.floor(maxBacklinks * 0.7)),
      ...conceptLinks.slice(0, Math.ceil(maxBacklinks * 0.3))
    ].slice(0, maxBacklinks)

    return selected
  }

  /**
   * Calculates maximum backlinks based on document characteristics
   */
  private calculateMaxBacklinks(document: ProcessedDocument): number {
    const contentLength = document.content.length

    if (contentLength < 500) return 2
    if (contentLength < 1500) return 4
    if (contentLength < 3000) return 6
    return 8
  }

  /**
   * Converts candidates to backlink strings
   */
  private convertCandidatesToBacklinks(candidates: BacklinkCandidate[]): string[] {
    return candidates.map(candidate => {
      if (candidate.linkType === 'source') {
        return `${candidate.targetTitle}`
      } else {
        return candidate.targetTitle
      }
    })
  }

  /**
   * Inserts backlinks into document content naturally
   */
  public async insertBacklinks(content: string, backlinks: string[]): Promise<string> {
    let modifiedContent = content
    const insertionPoints: BacklinkInsertionPoint[] = []

    // Find natural insertion points for each backlink
    for (const backlink of backlinks) {
      const points = this.findInsertionPoints(modifiedContent, backlink)
      insertionPoints.push(...points)
    }

    // Sort insertion points by position (reverse order to maintain positions)
    insertionPoints.sort((a, b) => b.position - a.position)

    // Apply insertions
    for (const point of insertionPoints) {
      if (point.confidence > 0.6) { // Only insert high-confidence links
        modifiedContent =
          modifiedContent.substring(0, point.position) +
          point.linkedText +
          modifiedContent.substring(point.position + point.originalText.length)
      }
    }

    return modifiedContent
  }

  /**
   * Finds natural points to insert backlinks
   */
  private findInsertionPoints(content: string, backlink: string): BacklinkInsertionPoint[] {
    const points: BacklinkInsertionPoint[] = []
    const variations = this.generateTitleVariations(backlink)

    for (const variation of variations) {
      const positions = this.findTextPositions(content.toLowerCase(), variation.toLowerCase())

      for (const position of positions) {
        // Check if already linked
        if (this.isAlreadyLinked(content, position, variation.length)) {
          continue
        }

        const context = this.extractContext(content, position, variation.length)
        const confidence = this.calculateLinkConfidence(variation, context)

        if (confidence > 0.5) {
          points.push({
            position,
            originalText: content.substring(position, position + variation.length),
            linkedText: `[[${backlink}]]`,
            linkType: this.isSourceFile(backlink) ? 'source' : 'document',
            confidence
          })
        }
      }
    }

    // Limit to one link per backlink to avoid over-linking
    return points.slice(0, 1)
  }

  /**
   * Checks if text is already linked
   */
  private isAlreadyLinked(content: string, position: number, length: number): boolean {
    const before = content.substring(Math.max(0, position - 2), position)
    const after = content.substring(position + length, position + length + 2)

    return before.includes('[[') || after.includes(']]') || before.includes('](') || after.includes(')')
  }

  /**
   * Calculates confidence for inserting a link
   */
  private calculateLinkConfidence(variation: string, context: string): number {
    let confidence = 0.7 // Base confidence

    // Boost confidence if in a meaningful sentence
    if (context.includes('.') || context.includes(',')) {
      confidence += 0.1
    }

    // Reduce confidence if in code block
    if (context.includes('```') || context.includes('`')) {
      confidence -= 0.3
    }

    // Reduce confidence if surrounded by special characters
    if (/[{}[\]()#*_]/.test(context)) {
      confidence -= 0.2
    }

    // Boost confidence if variation is exact match
    if (variation.length > 5) {
      confidence += 0.1
    }

    return Math.max(0, Math.min(1, confidence))
  }

  /**
   * Checks if backlink refers to a source file
   */
  private isSourceFile(backlink: string): boolean {
    return this.isValidSourceFile(backlink)
  }
}
