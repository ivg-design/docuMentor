// Mock Claude client - will be replaced with actual implementation

export interface ClaudeResponse {
  content: string | Array<{ type: string; text: string }>;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  model?: string;
  finishReason?: string;
}

export interface GenerationRequest {
  type: 'documentation' | 'enhancement' | 'optimization' | 'analysis';
  content: string;
  context: string;
  instructions: string[];
  constraints: string[];
  sourceContent?: string;
  strategy?: string;
}

export interface TagOptimizationRequest {
  documents: any[];
  tagAnalysis: any[];
  projectTag: string;
  minTags: number;
  maxTags: number;
}

export interface FrontmatterEnhancementRequest {
  frontmatter: any;
  document: any;
  contentPreview: string;
}

export interface ClientOptions {
  model?: string;
  maxRetries?: number;
  timeout?: number;
  temperature?: number;
  maxTokens?: number;
  blockedTools?: string[];
}

export interface RequestMetrics {
  requestCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  averageResponseTime: number;
  errorCount: number;
  lastRequestTime?: Date;
}

/**
 * Claude client for DocuMentor with tool restrictions and error handling
 * Blocks TodoWrite and Task tools while providing AI capabilities
 */
export class ClaudeClient {
  private claude: any
  private options: ClientOptions
  private metrics: RequestMetrics = {
    requestCount: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    averageResponseTime: 0,
    errorCount: 0
  }
  private requestQueue: Array<() => Promise<any>> = []
  private isProcessingQueue = false

  constructor(options: ClientOptions = {}) {
    this.options = {
      model: 'claude-3-sonnet-20240229',
      maxRetries: 3,
      timeout: 30000,
      temperature: 0.3,
      maxTokens: 4000,
      blockedTools: ['TodoWrite', 'Task', 'todo', 'task'],
      ...options
    }

    this.claude = {} // Mock implementation
    this.initializeMetrics()
  }

  /**
   * Initializes metrics tracking
   */
  private initializeMetrics(): void {
    this.metrics = {
      requestCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      averageResponseTime: 0,
      errorCount: 0
    }
  }

  /**
   * Generates documentation content with AI
   */
  public async generateDocumentation(request: GenerationRequest): Promise<string> {
    return this.executeRequest('generateDocumentation', async () => {
      const prompt = this.buildDocumentationPrompt(request)

      const response = await this.callClaude({
        messages: [{
          role: 'user',
          content: prompt
        }],
        model: this.options.model,
        max_tokens: this.options.maxTokens,
        temperature: this.options.temperature
      })

      return this.extractContent(response)
    })
  }

  /**
   * Optimizes tags for a group of documents
   */
  public async optimizeTagsForDocumentGroup(prompt: string): Promise<any> {
    return this.executeRequest('optimizeTagsForDocumentGroup', async () => {
      const enhancedPrompt = this.buildTagOptimizationPrompt(prompt)

      const response = await this.callClaude({
        messages: [{
          role: 'user',
          content: enhancedPrompt
        }],
        model: this.options.model,
        max_tokens: this.options.maxTokens,
        temperature: 0.2 // Lower temperature for structured output
      })

      return this.parseStructuredResponse(response)
    })
  }

  /**
   * Enhances frontmatter with AI insights
   */
  public async enhanceFrontmatter(prompt: string): Promise<any> {
    return this.executeRequest('enhanceFrontmatter', async () => {
      const enhancedPrompt = this.buildFrontmatterPrompt(prompt)

      const response = await this.callClaude({
        messages: [{
          role: 'user',
          content: enhancedPrompt
        }],
        model: this.options.model,
        max_tokens: 1000, // Smaller response for frontmatter
        temperature: 0.1 // Very low temperature for consistency
      })

      return this.parseFrontmatterResponse(response)
    })
  }

  /**
   * Analyzes project structure and provides insights
   */
  public async analyzeProject(projectData: any): Promise<any> {
    return this.executeRequest('analyzeProject', async () => {
      const prompt = this.buildProjectAnalysisPrompt(projectData)

      const response = await this.callClaude({
        messages: [{
          role: 'user',
          content: prompt
        }],
        model: this.options.model,
        max_tokens: this.options.maxTokens,
        temperature: 0.4
      })

      return this.parseAnalysisResponse(response)
    })
  }

  /**
   * Generates enhancement suggestions for content
   */
  public async generateEnhancements(content: string, type: string): Promise<string[]> {
    return this.executeRequest('generateEnhancements', async () => {
      const prompt = this.buildEnhancementPrompt(content, type)

      const response = await this.callClaude({
        messages: [{
          role: 'user',
          content: prompt
        }],
        model: this.options.model,
        max_tokens: 1500,
        temperature: 0.5
      })

      return this.parseEnhancementResponse(response)
    })
  }

  /**
   * Executes a request with error handling, retries, and metrics
   */
  private async executeRequest<T>(
    operation: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now()

    try {
      // Add to queue if necessary
      if (this.shouldQueue()) {
        return await this.queueRequest(requestFn)
      }

      let lastError: Error | null = null

      for (let attempt = 1; attempt <= this.options.maxRetries!; attempt++) {
        try {
          const result = await Promise.race([
            requestFn(),
            this.createTimeoutPromise()
          ])

          // Update metrics on success
          this.updateMetrics(startTime, true)

          return result as T
        } catch (error) {
          lastError = error as Error
          console.warn(`${operation} attempt ${attempt} failed:`, error)

          // Handle specific error types
          if (this.isRateLimitError(error)) {
            await this.handleRateLimit(attempt)
          } else if (this.isPermissionError(error)) {
            throw new Error(`Permission denied for ${operation}: ${error}`)
          } else if (this.isToolBlockedError(error)) {
            console.warn(`Blocked tool usage detected in ${operation}:`, error)
            // Continue with fallback
          } else if (attempt === this.options.maxRetries) {
            break // No more retries
          }

          // Exponential backoff
          await this.sleep(Math.pow(2, attempt) * 1000)
        }
      }

      // Update metrics on failure
      this.updateMetrics(startTime, false)

      throw new Error(`${operation} failed after ${this.options.maxRetries} attempts: ${lastError?.message}`)
    } catch (error) {
      this.updateMetrics(startTime, false)
      throw error
    }
  }

  /**
   * Calls Claude API with tool restrictions
   */
  private async callClaude(request: any): Promise<ClaudeResponse> {
    // Apply tool restrictions
    const restrictedRequest = this.applyToolRestrictions(request)

    try {
      const response = await this.claude.complete(restrictedRequest)

      return {
        content: response.content,
        usage: response.usage,
        model: response.model,
        finishReason: response.stop_reason
      }
    } catch (error) {
      // Transform Claude errors
      throw this.transformError(error)
    }
  }

  /**
   * Applies tool restrictions to prevent TodoWrite and Task usage
   */
  private applyToolRestrictions(request: any): any {
    const restricted = { ...request }

    // Add system message about tool restrictions
    const systemMessage = {
      role: 'system',
      content: `You are a documentation assistant. IMPORTANT: Do not use TodoWrite, Task, todo, or task tools. Focus on generating high-quality documentation content directly. If you need to track progress, mention it in your response text instead of using tools.

Blocked tools: ${this.options.blockedTools?.join(', ')}

Provide complete, well-structured responses without relying on external tool calls.`
    }

    if (restricted.messages) {
      restricted.messages.unshift(systemMessage)
    }

    // Explicitly disable tools if Claude supports tool restrictions
    if (restricted.tools) {
      restricted.tools = restricted.tools.filter((tool: any) =>
        !this.options.blockedTools?.includes(tool.name)
      )
    }

    return restricted
  }

  /**
   * Builds documentation generation prompt
   */
  private buildDocumentationPrompt(request: GenerationRequest): string {
    const sections = [
      'Create comprehensive, natural documentation for the provided content.',
      '',
      `Type: ${request.type}`,
      `Strategy: ${request.strategy || 'adaptive'}`,
      '',
      'Context:',
      request.context,
      ''
    ]

    if (request.sourceContent) {
      sections.push(
        'Source Content:',
        '```',
        request.sourceContent.substring(0, 3000), // Limit for context
        '```',
        ''
      )
    }

    if (request.instructions.length > 0) {
      sections.push(
        'Instructions:',
        ...request.instructions.map(inst => `- ${inst}`),
        ''
      )
    }

    if (request.constraints.length > 0) {
      sections.push(
        'Constraints:',
        ...request.constraints.map(constraint => `- ${constraint}`),
        ''
      )
    }

    sections.push(
      'Generate clear, useful documentation that follows best practices.',
      'Focus on providing practical value to developers and users.',
      'Structure the content logically and make it easy to understand.'
    )

    return sections.join('\n')
  }

  /**
   * Builds tag optimization prompt
   */
  private buildTagOptimizationPrompt(basePrompt: string): string {
    return `${basePrompt}

IMPORTANT: Respond with a structured JSON format that can be parsed programmatically.
Do not use TodoWrite, Task, or similar tools. Provide the optimization results directly.

Expected response format:
{
  "optimizations": {
    "Document Title 1": {
      "tags": ["#project/name", "#type/category", "#specific/tag"],
      "changes": [
        {
          "type": "add|remove|replace",
          "newTag": "#new/tag",
          "reason": "explanation"
        }
      ],
      "reasoning": "brief explanation"
    }
  },
  "summary": "overall optimization summary"
}

Focus on creating logical, hierarchical tag structures that improve organization.`
  }

  /**
   * Builds frontmatter enhancement prompt
   */
  private buildFrontmatterPrompt(basePrompt: string): string {
    return `${basePrompt}

Provide enhancements in JSON format:
{
  "description": "improved description",
  "tags": ["additional", "relevant", "tags"],
  "author": "if determinable",
  "metadata": "any other relevant fields"
}

Keep enhancements practical and accurate. Only suggest improvements that add real value.`
  }

  /**
   * Builds project analysis prompt
   */
  private buildProjectAnalysisPrompt(projectData: any): string {
    return `Analyze this project structure and provide insights:

Project Data:
${JSON.stringify(projectData, null, 2)}

Provide analysis in this format:
{
  "projectType": "detected project type",
  "technologies": ["list", "of", "technologies"],
  "architecture": "architectural pattern description",
  "recommendations": ["improvement", "suggestions"],
  "documentation": "documentation strategy recommendations"
}

Focus on actionable insights that improve documentation quality.`
  }

  /**
   * Builds enhancement suggestion prompt
   */
  private buildEnhancementPrompt(content: string, type: string): string {
    return `Analyze this ${type} content and suggest specific improvements:

Content:
${content.substring(0, 2000)}

Provide 3-5 specific, actionable enhancement suggestions.
Focus on clarity, completeness, and usefulness.
Format as a simple list of improvements.`
  }

  /**
   * Extracts content from Claude response
   */
  private extractContent(response: ClaudeResponse): string {
    if (typeof response.content === 'string') {
      return response.content.trim()
    }

    if (Array.isArray(response.content)) {
      return response.content
        .filter((item: any) => item.type === 'text')
        .map((item: any) => item.text)
        .join('\n')
        .trim()
    }

    return ''
  }

  /**
   * Parses structured response from Claude
   */
  private parseStructuredResponse(response: ClaudeResponse): any {
    const content = this.extractContent(response)

    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch (error) {
      console.warn('Failed to parse structured response:', error)
    }

    // Fallback to text response
    return { content, parsed: false }
  }

  /**
   * Parses frontmatter enhancement response
   */
  private parseFrontmatterResponse(response: ClaudeResponse): any {
    return this.parseStructuredResponse(response)
  }

  /**
   * Parses project analysis response
   */
  private parseAnalysisResponse(response: ClaudeResponse): any {
    return this.parseStructuredResponse(response)
  }

  /**
   * Parses enhancement suggestions response
   */
  private parseEnhancementResponse(response: ClaudeResponse): string[] {
    const content = this.extractContent(response)

    // Extract list items
    const lines = content.split('\n')
    const suggestions = lines
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*') || /^\d+\./.test(line.trim()))
      .map(line => line.replace(/^[-*\d.]\s*/, '').trim())
      .filter(suggestion => suggestion.length > 0)

    return suggestions.length > 0 ? suggestions : [content]
  }

  /**
   * Checks if request should be queued
   */
  private shouldQueue(): boolean {
    // Simple rate limiting - queue if too many recent requests
    return this.requestQueue.length > 5
  }

  /**
   * Queues a request for later execution
   */
  private async queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await requestFn()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })

      this.processQueue()
    })
  }

  /**
   * Processes the request queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return
    }

    this.isProcessingQueue = true

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()
      if (request) {
        try {
          await request()
        } catch (error) {
          console.warn('Queued request failed:', error)
        }

        // Small delay between queued requests
        await this.sleep(500)
      }
    }

    this.isProcessingQueue = false
  }

  /**
   * Creates timeout promise
   */
  private createTimeoutPromise<T>(): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timeout after ${this.options.timeout}ms`))
      }, this.options.timeout)
    })
  }

  /**
   * Checks if error is rate limit related
   */
  private isRateLimitError(error: any): boolean {
    return error?.status === 429 ||
           error?.message?.toLowerCase().includes('rate limit') ||
           error?.message?.toLowerCase().includes('too many requests')
  }

  /**
   * Checks if error is permission related
   */
  private isPermissionError(error: any): boolean {
    return error?.status === 403 ||
           error?.message?.toLowerCase().includes('permission') ||
           error?.message?.toLowerCase().includes('unauthorized') ||
           error?.message?.toLowerCase().includes('forbidden')
  }

  /**
   * Checks if error is due to blocked tool usage
   */
  private isToolBlockedError(error: any): boolean {
    const message = error?.message?.toLowerCase() || ''
    return this.options.blockedTools?.some(tool =>
      message.includes(tool.toLowerCase())
    ) || false
  }

  /**
   * Handles rate limit with backoff
   */
  private async handleRateLimit(attempt: number): Promise<void> {
    const backoffTime = Math.min(Math.pow(2, attempt) * 1000, 30000) // Max 30s
    console.log(`Rate limited, waiting ${backoffTime}ms before retry...`)
    await this.sleep(backoffTime)
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Transforms Claude errors to our format
   */
  private transformError(error: any): Error {
    if (this.isToolBlockedError(error)) {
      return new Error(`Blocked tool usage detected: ${error.message}`)
    }

    if (this.isPermissionError(error)) {
      return new Error(`Permission denied: ${error.message}`)
    }

    if (this.isRateLimitError(error)) {
      return new Error(`Rate limit exceeded: ${error.message}`)
    }

    return new Error(`Claude API error: ${error.message || 'Unknown error'}`)
  }

  /**
   * Updates metrics tracking
   */
  private updateMetrics(startTime: number, success: boolean): void {
    const responseTime = Date.now() - startTime

    this.metrics.requestCount++
    this.metrics.lastRequestTime = new Date()

    if (success) {
      // Update average response time
      this.metrics.averageResponseTime =
        (this.metrics.averageResponseTime * (this.metrics.requestCount - 1) + responseTime) /
        this.metrics.requestCount
    } else {
      this.metrics.errorCount++
    }
  }

  /**
   * Gets client metrics
   */
  public getMetrics(): RequestMetrics {
    return { ...this.metrics }
  }

  /**
   * Resets metrics
   */
  public resetMetrics(): void {
    this.initializeMetrics()
  }

  /**
   * Gets client configuration
   */
  public getConfig(): ClientOptions {
    return { ...this.options }
  }

  /**
   * Updates client configuration
   */
  public updateConfig(newOptions: Partial<ClientOptions>): void {
    this.options = { ...this.options, ...newOptions }
  }

  /**
   * Checks if client is healthy (can make requests)
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const response = await this.callClaude({
        messages: [{
          role: 'user',
          content: 'Respond with "OK" if you can receive this message.'
        }],
        model: this.options.model,
        max_tokens: 10,
        temperature: 0
      })

      return this.extractContent(response).toLowerCase().includes('ok')
    } catch (error) {
      console.warn('Health check failed:', error)
      return false
    }
  }
}
