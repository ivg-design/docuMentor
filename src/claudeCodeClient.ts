import * as claudeCode from '@anthropic-ai/claude-code';

export type ProgressCallback = (progress: number) => void;

export async function queryClaudeCode(
  prompt: string,
  progressCallback?: ProgressCallback,
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
  const estimatedChunks = 100; // Estimate for progress calculation
  
  for await (const chunk of result) {
    chunks++;
    
    // Update progress callback
    if (progressCallback) {
      const progress = Math.min((chunks / estimatedChunks) * 100, 99);
      progressCallback(progress);
    }
    
    if (chunk.type === 'assistant' && chunk.message?.content) {
      // Extract text from content blocks
      for (const content of chunk.message.content) {
        if (content.type === 'text') {
          response += content.text;
        }
      }
    }
  }
  
  // Complete progress
  if (progressCallback) {
    progressCallback(100);
  }
  
  return response;
}