# CRITICAL: Claude Code CLI Integration (NOT API!)

## ⚠️ IMPORTANT DISTINCTION ⚠️

This entire system is built around **Claude Code CLI** (`/Users/ivg/.nvm/versions/node/v24.6.0/bin/claude`), **NOT** the Anthropic API!

### What This Means:

#### ✅ CORRECT: Claude Code CLI
```typescript
// This is what we're using - Claude Code CLI
const claudePath = '/Users/ivg/.nvm/versions/node/v24.6.0/bin/claude'
const result = await execAsync(`${claudePath} "${prompt}"`)
```

#### ❌ WRONG: Anthropic API
```typescript
// NOT THIS - We are NOT using the API
import Anthropic from '@anthropic-ai/sdk'
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
```

## Claude Code CLI Architecture

### Current Implementation Location
```
src/core/ClaudeClient.ts - Uses Claude Code CLI via exec()
```

### How It Works
1. **Claude Code CLI** is installed locally at `/Users/ivg/.nvm/versions/node/v24.6.0/bin/claude`
2. We execute it as a subprocess with prompts
3. It returns generated documentation directly
4. **NO API KEYS REQUIRED**
5. **NO RATE LIMITS** (beyond what Claude Code itself has)
6. **NO NETWORK API CALLS** (Claude Code handles this internally)

## Critical Implementation Notes

### 1. ClaudeClient Class (ALREADY CORRECT)
```typescript
// src/core/ClaudeClient.ts
export class ClaudeClient {
  private claudePath = '/Users/ivg/.nvm/versions/node/v24.6.0/bin/claude'
  
  async generateDocumentation(request: DocumentationRequest): Promise<string> {
    // Build prompt for Claude Code CLI
    const prompt = this.buildPrompt(request)
    
    // Execute Claude Code CLI
    const { stdout } = await execAsync(`${this.claudePath} "${prompt}"`)
    
    return stdout
  }
}
```

### 2. Request Format for Claude Code CLI
```typescript
interface DocumentationRequest {
  type: 'documentation'
  sourceContent: string  // ← FIXED: Was 'content', now 'sourceContent'
  context: string
  instructions: string[]
  constraints: string[]
  strategy: string
}
```

### 3. Prompt Building for CLI
```typescript
private buildPrompt(request: DocumentationRequest): string {
  return `
Generate documentation for the following code:

Context: ${request.context}

Instructions:
${request.instructions.join('\n')}

Constraints:
${request.constraints.join('\n')}

Code to document:
\`\`\`
${request.sourceContent}
\`\`\`

Please provide comprehensive documentation in Markdown format.
`
}
```

## What This Means for Each System

### 1. Lockfile System
- Works exactly as designed
- No changes needed for Claude Code CLI

### 2. Template System  
- Works exactly as designed
- Templates are applied AFTER Claude generates documentation

### 3. Config System
- Remove any API key configuration
- No rate limiting configuration needed
- Claude Code CLI handles its own configuration

### 4. Obsidian Enrichment (Agent-Driven)
```typescript
class ObsidianEnrichmentAgent {
  private claudeClient: ClaudeClient  // ← Uses Claude Code CLI, not API
  
  async analyzeDocument(doc: ProcessedDocument): Promise<DocumentAnalysis> {
    // This goes through Claude Code CLI
    const prompt = this.buildAnalysisPrompt(doc)
    const response = await this.claudeClient.analyze(prompt)
    return JSON.parse(response)
  }
}
```

### 5. Intelligent Tag Manager (Agent-Driven)
```typescript
class IntelligentTagManager {
  private claudeClient: ClaudeClient  // ← Uses Claude Code CLI, not API
  
  async suggestTags(document: ProcessedDocument): Promise<string[]> {
    // This goes through Claude Code CLI
    const prompt = this.buildTagPrompt(document)
    const response = await this.claudeClient.analyze(prompt)
    return JSON.parse(response)
  }
}
```

## Performance Considerations

### Claude Code CLI Characteristics
- **Startup Time**: ~1-2 seconds per invocation
- **Processing Time**: 5-30 seconds per file (depending on size)
- **Memory**: Handled by Claude Code process
- **Concurrency**: Can run multiple Claude Code processes (our 4 workers)

### Optimization Strategy
1. **Batch Small Files**: Combine multiple small files into one Claude request
2. **Parallel Workers**: Run 4 Claude Code CLI processes simultaneously
3. **Smart Caching**: Cache results to avoid re-processing
4. **Incremental Updates**: Only process changed files

## Error Handling for CLI

### Common Claude Code CLI Errors
```typescript
class ClaudeClientError extends Error {
  constructor(message: string, public exitCode?: number) {
    super(message)
  }
}

// Handle CLI-specific errors
try {
  const result = await execAsync(`${claudePath} "${prompt}"`)
} catch (error) {
  if (error.code === 'ENOENT') {
    throw new ClaudeClientError('Claude Code CLI not found. Please install it.')
  }
  if (error.code === 127) {
    throw new ClaudeClientError('Claude Code CLI command failed')
  }
  if (error.signal === 'SIGTERM') {
    throw new ClaudeClientError('Claude Code CLI was terminated')
  }
  throw error
}
```

## Testing with Claude Code CLI

### Mock for Testing
```typescript
// tests/mocks/claudeMock.ts
export function mockClaudeCodeCLI() {
  return {
    exec: jest.fn().mockResolvedValue({
      stdout: '# Mocked Documentation\n\nThis is test documentation.',
      stderr: '',
      exitCode: 0
    })
  }
}
```

### Integration Testing
```bash
# Test with real Claude Code CLI
npm run test:integration -- --use-real-claude

# Test with mock (faster)
npm run test
```

## Migration from API to CLI

### If Any Code Still Uses API
1. **Remove** all `@anthropic-ai/sdk` imports
2. **Remove** all API key references
3. **Replace** with `ClaudeClient` that uses CLI
4. **Update** error handling for CLI errors

### Config Changes
```json
// .documentor.config.json
{
  "claude": {
    // REMOVE THESE:
    // "apiKey": "...",
    // "maxTokens": 4096,
    
    // ADD THESE:
    "cliPath": "/Users/ivg/.nvm/versions/node/v24.6.0/bin/claude",
    "timeout": 300000,  // 5 minutes per file
    "maxRetries": 3
  }
}
```

## Implementation Checklist

- [x] **DocumentPipeline.ts** - Fixed 'sourceContent' field
- [ ] **Verify ClaudeClient.ts** - Ensure it uses CLI, not API
- [ ] **Remove API dependencies** - No @anthropic-ai/sdk
- [ ] **Update config schema** - Remove API keys, add CLI path
- [ ] **Test with real Claude Code CLI** - Not mocks
- [ ] **Document CLI installation** - How to install Claude Code

## Critical Success Factors

1. **Claude Code CLI Must Be Installed**
   ```bash
   # Verify installation
   /Users/ivg/.nvm/versions/node/v24.6.0/bin/claude --version
   ```

2. **Prompts Must Be CLI-Compatible**
   - Single string input
   - Clear instructions
   - Proper escaping for shell

3. **Error Handling for CLI**
   - Handle process errors
   - Handle timeouts
   - Handle Claude Code being unavailable

4. **Performance Optimization**
   - Parallel CLI processes
   - Smart queuing
   - Caching results

## Summary

**WE ARE USING CLAUDE CODE CLI, NOT THE ANTHROPIC API!**

This is critical because:
1. No API keys needed
2. No rate limits (beyond Claude Code's own)
3. Different error handling required
4. Different performance characteristics
5. Must have Claude Code CLI installed locally

The entire efficient pipeline and TUI integration is built around executing Claude Code CLI as a subprocess, NOT making API calls to Anthropic's servers.