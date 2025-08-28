import * as claudeCode from '@anthropic-ai/claude-code';

export async function queryClaudeCode(prompt: string, tools?: string[]): Promise<string> {
  const result = await claudeCode.query({
    prompt,
    options: {
      allowedTools: tools || ['Read', 'Grep', 'Glob', 'LS', 'Task', 'Bash']
    }
  });
  
  let response = '';
  
  for await (const chunk of result) {
    if (chunk.type === 'assistant' && chunk.message?.content) {
      // Extract text from content blocks
      for (const content of chunk.message.content) {
        if (content.type === 'text') {
          response += content.text;
        }
      }
    }
  }
  
  return response;
}