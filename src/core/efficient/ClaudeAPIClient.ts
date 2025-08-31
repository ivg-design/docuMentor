/**
 * Claude API Client
 * Clean implementation for Claude API communication
 */

import axios from 'axios'

export class ClaudeAPIClient {
  private apiKey: string
  private apiUrl = 'https://api.anthropic.com/v1/messages'
  private model = 'claude-3-sonnet-20240229'
  private maxTokens = 4096

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.CLAUDE_API_KEY || ''
    if (!this.apiKey) {
      throw new Error('Claude API key not provided')
    }
  }

  /**
   * Generate documentation using Claude
   */
  async generateDocumentation(prompt: string): Promise<string> {
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          max_tokens: this.maxTokens,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          }
        }
      )

      if (response.data?.content?.[0]?.text) {
        return response.data.content[0].text
      }

      throw new Error('Invalid response from Claude API')
      
    } catch (error: any) {
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded - please wait before retrying')
      }
      if (error.response?.status === 401) {
        throw new Error('Invalid API key')
      }
      throw new Error(`Claude API error: ${error.message}`)
    }
  }
}