/**
 * ClaudeClient - Compatibility layer
 * Redirects to new ClaudeAPIClient
 */

import { ClaudeAPIClient } from './efficient/ClaudeAPIClient'

export interface FrontmatterEnhancementRequest {
  content: string
  metadata?: any
  tags?: string[]
  frontmatter?: any
  document?: any
  contentPreview?: string
}

export class ClaudeClient {
  private apiClient: ClaudeAPIClient
  
  constructor(options?: any) {
    this.apiClient = new ClaudeAPIClient()
  }
  
  async generateDocumentation(request: any): Promise<string> {
    // Convert old request format to simple prompt
    let prompt = ''
    if (typeof request === 'string') {
      prompt = request
    } else if (request.content) {
      prompt = request.content
    } else {
      prompt = JSON.stringify(request)
    }
    
    return this.apiClient.generateDocumentation(prompt)
  }
  
  async optimizeTags(tags: any): Promise<string[]> {
    // Handle both string[] and complex objects
    let tagList: string[] = []
    if (Array.isArray(tags)) {
      tagList = tags
    } else if (tags && tags.documents) {
      // Extract tags from documents
      tagList = tags.documents.flatMap((d: any) => d.tags || [])
    }
    
    const prompt = `Optimize these tags for better organization: ${tagList.join(', ')}`
    const response = await this.apiClient.generateDocumentation(prompt)
    // Simple parsing - in reality would need better parsing
    return response.split(',').map(t => t.trim())
  }
  
  async enhanceFrontmatter(request: FrontmatterEnhancementRequest): Promise<any> {
    const prompt = `Enhance frontmatter for document:
Content: ${request.content}
Tags: ${request.tags?.join(', ') || 'none'}
Metadata: ${JSON.stringify(request.metadata || {})}

Generate enhanced frontmatter with title, description, tags, and metadata.`
    
    const response = await this.apiClient.generateDocumentation(prompt)
    
    // Simple parsing - return a basic structure
    return {
      title: 'Document',
      description: 'Generated documentation',
      tags: request.tags || [],
      metadata: request.metadata || {}
    }
  }
}