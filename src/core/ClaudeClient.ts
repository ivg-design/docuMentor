// Claude CLI client implementation - uses claude-code CLI tool
import { spawn } from 'child_process'
import * as readline from 'readline'
import { logger } from '../cli/display'

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
  projectPath?: string;
}

export interface RequestMetrics {
  requestCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  averageResponseTime: number;
  averageInputTokens: number;
  averageOutputTokens: number;
  successRate: number;
  errorCount: number;
  lastRequestTime?: Date;
}

export class ClaudeClient {
  private options: Required<ClientOptions>
  private metrics: RequestMetrics
  private projectPath: string

  constructor(options: ClientOptions = {}) {
    this.projectPath = options.projectPath || process.cwd()
    
    this.options = {
      model: options.model || 'claude-3-opus',
      maxRetries: options.maxRetries || 3,
      timeout: options.timeout || 120000, // 2 minutes
      temperature: options.temperature || 0.3,
      maxTokens: options.maxTokens || 100000,
      blockedTools: options.blockedTools || ['TodoWrite', 'Task'],
      projectPath: this.projectPath
    }

    this.metrics = {
      requestCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      averageResponseTime: 0,
      averageInputTokens: 0,
      averageOutputTokens: 0,
      successRate: 100,
      errorCount: 0
    }
  }

  // Generate documentation
  async generateDocumentation(request: GenerationRequest): Promise<string> {
    const prompt = this.buildDocumentationPrompt(request)
    return this.executeClaudeQuery(prompt, 'documentation')
  }

  // Optimize tags
  async optimizeTags(request: TagOptimizationRequest): Promise<any> {
    const prompt = this.buildTagOptimizationPrompt(request)
    const response = await this.executeClaudeQuery(prompt, 'tag-optimization')
    
    try {
      return JSON.parse(response)
    } catch (error) {
      logger.warn('Failed to parse tag optimization response as JSON, returning raw response')
      return response
    }
  }

  // Enhance frontmatter
  async enhanceFrontmatter(request: FrontmatterEnhancementRequest): Promise<any> {
    const prompt = this.buildFrontmatterPrompt(request)
    const response = await this.executeClaudeQuery(prompt, 'frontmatter-enhancement')
    
    try {
      return JSON.parse(response)
    } catch (error) {
      logger.warn('Failed to parse frontmatter enhancement response as JSON, returning raw response')
      return response
    }
  }

  // Send raw prompt
  async sendPrompt(prompt: string, context?: string): Promise<string> {
    const fullPrompt = context ? `${context}\n\n${prompt}` : prompt
    return this.executeClaudeQuery(fullPrompt, 'custom')
  }

  // Core execution method using claude CLI
  private async executeClaudeQuery(prompt: string, operation: string): Promise<string> {
    const startTime = Date.now()
    
    return new Promise((resolve, reject) => {
      let result = ''
      let filesProcessed = 0
      let lineCount = 0
      let outputTokens = 0
      
      // Build command with correct syntax
      const args: string[] = [
        '--print',
        '--verbose',
        '--output-format', 'stream-json',
        '--dangerously-skip-permissions'
      ]
      
      // Block TodoWrite and Task tools to prevent output pollution
      args.push('--disallowedTools')
      args.push('TodoWrite')
      args.push('Task')
      
      // Add default allowed tools
      args.push('--allowedTools')
      const allowedTools = ['Read', 'Grep', 'Glob', 'Bash', 'Write', 'Edit']
      allowedTools.forEach(tool => args.push(tool))
      
      logger.debug(`Launching Claude CLI for ${operation} from ${this.projectPath}`)
      
      const claudeProcess = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
        cwd: this.projectPath
      })
      
      // Write prompt to stdin and close it
      logger.debug(`Sending prompt to Claude (${prompt.length} chars)`)
      claudeProcess.stdin!.write(prompt)
      claudeProcess.stdin!.end()
      
      // Handle spawn errors
      claudeProcess.on('error', (err) => {
        if (err.message.includes('ENOENT')) {
          logger.error('Claude CLI not found. Please install: npm install -g @anthropic-ai/claude-code')
          reject(new Error('Claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code'))
        } else {
          logger.error('Failed to start Claude:', err)
          reject(err)
        }
      })
      
      // Create readline for parsing JSON events
      const rl = readline.createInterface({
        input: claudeProcess.stdout!,
        crlfDelay: Infinity
      })
      
      // Handle each JSON event
      rl.on('line', (line) => {
        lineCount++
        
        if (!line.trim()) return
        
        try {
          const event = JSON.parse(line)
          
          // Handle different event types
          switch (event.type) {
          case 'system':
            if (event.subtype === 'init') {
              logger.debug('Claude initializing...')
            }
            break
            
          case 'assistant':
            // Assistant message with content
            if (event.message?.content) {
              for (const content of event.message.content) {
                if (content.type === 'text') {
                  result += content.text
                } else if (content.type === 'tool_use') {
                  filesProcessed++
                  logger.debug(`Claude using tool: ${content.name}`)
                }
              }
            }
            // Track token usage
            if (event.message?.usage) {
              outputTokens = event.message.usage.output_tokens || 0
            }
            break
            
          case 'tool_use':
            filesProcessed++
            logger.debug(`Tool call: ${event.name || 'unknown'}`)
            break
            
          case 'result':
            if (event.subtype === 'success') {
              logger.debug(`${operation} completed successfully`)
            } else if (event.is_error) {
              logger.error('Claude error:', event.result || 'Unknown error')
            }
            break
            
          case 'error':
            logger.error('Claude error:', event.error?.message || 'Unknown error')
            break
          }
          
        } catch (error) {
          // Not JSON, could be regular output or error
          if (line.includes('[ERROR]') || line.includes('Error:')) {
            logger.error('Claude Error:', line)
          } else if (line.trim().length > 0 && !line.startsWith('Thinking')) {
            // Ignore Claude's thinking output
            logger.debug(`Claude output: ${line.substring(0, 100)}`)
          }
        }
      })
      
      // Handle stderr
      claudeProcess.stderr?.on('data', (data) => {
        const output = data.toString()
        if (output.includes('error') || output.includes('Error')) {
          logger.error('Claude stderr:', output)
        }
      })
      
      // Handle completion
      claudeProcess.on('close', (code) => {
        const responseTime = Date.now() - startTime
        
        if (code === 0) {
          // Update metrics
          this.updateMetrics({
            success: true,
            responseTime,
            inputTokens: prompt.length / 4, // Rough estimate
            outputTokens: outputTokens || result.length / 4
          })
          
          logger.debug(`${operation} completed in ${responseTime}ms (${outputTokens} tokens)`)
          resolve(result)
        } else {
          this.updateMetrics({
            success: false,
            responseTime,
            inputTokens: prompt.length / 4,
            outputTokens: 0
          })
          
          reject(new Error(`Claude process exited with code ${code}`))
        }
      })
    })
  }

  // Build documentation prompt
  private buildDocumentationPrompt(request: GenerationRequest): string {
    const sections = [
      `Task: Generate ${request.type} documentation`,
      '',
      'Context:',
      request.context,
      '',
      'Source Content:',
      request.sourceContent || 'No source content provided',
      '',
      'Instructions:',
      ...request.instructions.map(i => `- ${i}`),
      '',
      'Constraints:',
      ...request.constraints.map(c => `- ${c}`)
    ]

    if (request.strategy) {
      sections.push('', 'Strategy:', request.strategy)
    }

    return sections.join('\n')
  }

  // Build tag optimization prompt
  private buildTagOptimizationPrompt(request: TagOptimizationRequest): string {
    return `You are a tag optimization expert for Obsidian documentation.

Project Tag: ${request.projectTag}
Minimum Tags per Document: ${request.minTags}
Maximum Tags per Document: ${request.maxTags}

Documents to optimize:
${JSON.stringify(request.documents, null, 2)}

Current Tag Analysis:
${JSON.stringify(request.tagAnalysis, null, 2)}

Task: Optimize the tags for each document following these rules:
1. Each document must have between ${request.minTags} and ${request.maxTags} tags
2. Include the project tag (${request.projectTag}) for all documents
3. Create a hierarchical tag structure where appropriate
4. Ensure tags are relevant and useful for navigation
5. Remove redundant or overly specific tags
6. Add missing important conceptual tags

Return a JSON object with the following structure:
{
  "documents": [
    {
      "id": "document-id",
      "optimizedTags": ["tag1", "tag2", "tag3"],
      "reasoning": "Brief explanation of tag choices"
    }
  ],
  "tagHierarchy": {
    "parent/tag": ["child1", "child2"]
  },
  "statistics": {
    "totalTags": number,
    "averageTagsPerDoc": number,
    "mostCommonTags": ["tag1", "tag2"]
  }
}`
  }

  // Build frontmatter enhancement prompt
  private buildFrontmatterPrompt(request: FrontmatterEnhancementRequest): string {
    return `You are a documentation metadata expert specializing in Obsidian frontmatter.

Current Frontmatter:
${JSON.stringify(request.frontmatter, null, 2)}

Document Information:
${JSON.stringify(request.document, null, 2)}

Content Preview:
${request.contentPreview}

Task: Enhance the frontmatter metadata by:
1. Adding missing but valuable metadata fields
2. Ensuring all dates are in ISO format
3. Calculating accurate metrics (word count, reading time, etc.)
4. Adding relevant Dataview fields for queries
5. Including proper type categorization
6. Setting appropriate status indicators

Return a JSON object with the enhanced frontmatter that includes all original fields plus enhancements.
Ensure the response is valid JSON that can be directly used as frontmatter.`
  }

  // Update metrics
  private updateMetrics(result: {
    success: boolean;
    responseTime: number;
    inputTokens: number;
    outputTokens: number;
  }): void {
    this.metrics.requestCount++
    this.metrics.totalInputTokens += result.inputTokens
    this.metrics.totalOutputTokens += result.outputTokens
    
    if (!result.success) {
      this.metrics.errorCount++
    }

    // Calculate averages
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.requestCount - 1) + result.responseTime) / 
      this.metrics.requestCount

    this.metrics.averageInputTokens = this.metrics.totalInputTokens / this.metrics.requestCount
    this.metrics.averageOutputTokens = this.metrics.totalOutputTokens / this.metrics.requestCount
    this.metrics.successRate = ((this.metrics.requestCount - this.metrics.errorCount) / this.metrics.requestCount) * 100
    this.metrics.lastRequestTime = new Date()
  }

  // Get metrics
  getMetrics(): RequestMetrics {
    return { ...this.metrics }
  }

  // Reset metrics
  resetMetrics(): void {
    this.metrics = {
      requestCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      averageResponseTime: 0,
      averageInputTokens: 0,
      averageOutputTokens: 0,
      successRate: 100,
      errorCount: 0
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.executeClaudeQuery(
        'Hi, please respond with "OK" if you are working.', 
        'health-check'
      )
      return response.toLowerCase().includes('ok')
    } catch (error) {
      logger.warn('Health check failed:', error)
      return false
    }
  }

  // Get client info
  getClientInfo(): {
    model: string;
    temperature: number;
    maxTokens: number;
    hasClaudeCLI: boolean;
    } {
    return {
      model: this.options.model,
      temperature: this.options.temperature,
      maxTokens: this.options.maxTokens,
      hasClaudeCLI: true // Assumed if constructed
    }
  }
}

// Export singleton instance for convenience
let clientInstance: ClaudeClient | null = null

export function getClaudeClient(options?: ClientOptions): ClaudeClient {
  if (!clientInstance) {
    clientInstance = new ClaudeClient(options)
  }
  return clientInstance
}

export default ClaudeClient