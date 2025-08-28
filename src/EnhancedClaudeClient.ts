import * as claudeCode from '@anthropic-ai/claude-code';
import { RealTimeDisplay } from './RealTimeDisplay';

export interface ClaudeStreamContext {
  onToolCall?: (tool: string, args: any) => void;
  onProgress?: (progress: number) => void;
  onComplete?: (result: string) => void;
  onChunk?: (chunk: any) => void;
}

export async function streamingClaudeQuery(
  prompt: string,
  display: RealTimeDisplay,
  taskId: string,
  tools?: string[]
): Promise<string> {
  const context = display.createClaudeContext(taskId);
  
  const result = await claudeCode.query({
    prompt,
    options: {
      allowedTools: tools || ['Read', 'Grep', 'Glob', 'LS', 'Task', 'Bash']
    }
  });
  
  let response = '';
  let chunks = 0;
  let lastToolCall: string | null = null;
  
  for await (const chunk of result) {
    chunks++;
    
    // Update progress based on chunks (rough estimate)
    const progress = Math.min((chunks * 2), 99); // Each chunk ~2% progress
    context.onProgress(progress);
    
    // Handle assistant messages
    if (chunk.type === 'assistant' && chunk.message?.content) {
      // Extract text from content blocks
      for (const content of chunk.message.content) {
        if (content.type === 'text') {
          response += content.text;
          
          // Stream snippets of the response
          const lines = content.text.split('\n');
          if (lines.length > 0 && lines[0].trim()) {
            const preview = lines[0].substring(0, 100);
            if (preview.length > 10) {
              display.stream(`💭 ${preview}${preview.length === 100 ? '...' : ''}`);
            }
          }
        }
      }
    }
    
    // Note: The Claude Code SDK doesn't expose tool_use events directly
    // We can only see the final results in the assistant messages
  }
  
  // Complete
  context.onProgress(100);
  context.onComplete(response);
  
  return response;
}

/**
 * Wrapper for backwards compatibility
 */
export async function queryClaudeCode(
  prompt: string,
  progressCallback?: (progress: number) => void,
  tools?: string[]
): Promise<string> {
  const result = await claudeCode.query({
    prompt,
    options: {
      allowedTools: tools || ['Read', 'Grep', 'Glob', 'LS', 'Task', 'Bash']
    }
  });
  
  let response = '';
  let chunks = 0;
  
  for await (const chunk of result) {
    chunks++;
    
    if (progressCallback) {
      const progress = Math.min((chunks * 2), 100);
      progressCallback(progress);
    }
    
    if (chunk.type === 'assistant' && chunk.message?.content) {
      for (const content of chunk.message.content) {
        if (content.type === 'text') {
          response += content.text;
        }
      }
    }
  }
  
  return response;
}