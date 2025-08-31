/**
 * Direct Claude API Client using Anthropic SDK
 * This replaces the broken CLI-based client
 */

import Anthropic from '@anthropic-ai/sdk'
import { Logger } from './Logger'
import { GenerationRequest } from './ClaudeClient'

export class ClaudeAPIClient {
  private client: Anthropic
  private model: string = 'claude-3-5-sonnet-20241022'
  
  constructor(apiKey?: string) {
    // Use provided key or environment variable
    const key = apiKey || process.env.ANTHROPIC_API_KEY
    
    if (!key) {
      throw new Error('No Anthropic API key found. Set ANTHROPIC_API_KEY environment variable.')
    }
    
    this.client = new Anthropic({
      apiKey: key
    })
  }
  
  /**
   * Generate documentation using Claude API
   */
  async generateDocumentation(request: GenerationRequest): Promise<string> {
    try {
      const prompt = this.buildPrompt(request)
      
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4000,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
      
      // Extract text from response
      const content = response.content[0]
      if (content.type === 'text') {
        return content.text
      }
      
      return 'Failed to generate documentation'
      
    } catch (error) {
      Logger.error(`Claude API error: ${(error as Error).message}`, 'ClaudeAPI')
      throw error
    }
  }
  
  /**
   * Build prompt for documentation generation
   */
  private buildPrompt(request: GenerationRequest): string {
    let prompt = `Generate comprehensive documentation for the following ${request.type}.\n\n`
    
    if (request.context) {
      prompt += `Context:\n${request.context}\n\n`
    }
    
    if (request.sourceContent) {
      prompt += `Source Code:\n\`\`\`\n${request.sourceContent}\n\`\`\`\n\n`
    }
    
    if (request.instructions && request.instructions.length > 0) {
      prompt += `Instructions:\n`
      request.instructions.forEach(inst => {
        prompt += `- ${inst}\n`
      })
      prompt += '\n'
    }
    
    if (request.constraints && request.constraints.length > 0) {
      prompt += `Constraints:\n`
      request.constraints.forEach(con => {
        prompt += `- ${con}\n`
      })
      prompt += '\n'
    }
    
    prompt += `Please provide clear, well-structured documentation in Markdown format.`
    
    return prompt
  }
  
  /**
   * Test connection to Claude API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Reply with OK'
          }
        ]
      })
      
      return response.content[0].type === 'text'
    } catch (error) {
      Logger.error(`Claude API test failed: ${(error as Error).message}`, 'ClaudeAPI')
      return false
    }
  }
}