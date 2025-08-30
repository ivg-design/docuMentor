import { spawn } from 'child_process';
import * as readline from 'readline';
import { TUIAdapter } from './TUIAdapter';

/**
 * Streaming Claude query with real JSON event streaming
 */
export async function streamingClaudeQuery(
  prompt: string,
  display: TUIAdapter,
  taskId: string,
  tools?: string[],
  projectPath?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    let result = '';
    let filesProcessed = 0;
    let lineCount = 0;
    
    // Build command with correct syntax - prompt via stdin!
    const args: string[] = [
      '--print',  // Required for output-format
      '--verbose',  // Required for stream-json
      '--output-format', 'stream-json',  // JSON streaming
      '--dangerously-skip-permissions'  // Allow Claude to access all files
    ];
    
    // Add allowed tools if specified
    if (tools && tools.length > 0) {
      args.push('--allowedTools');
      tools.forEach(tool => args.push(tool));
    }
    
    // Spawn claude process with correct working directory
    display.log('info', `Launching Claude AI from ${projectPath || process.cwd()}`);
    const claudeProcess = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
      cwd: projectPath || process.cwd()  // Set working directory to project path!
    });
    
    // Write prompt to stdin and close it
    display.log('debug', `Sending prompt to Claude (${prompt.length} chars)`);
    claudeProcess.stdin!.write(prompt);
    claudeProcess.stdin!.end();
    
    // Log process spawn
    claudeProcess.on('spawn', () => {
      display.log('info', 'Claude process started');
    });
    
    claudeProcess.on('error', (err) => {
      display.logError('Failed to start Claude', err);
      reject(err);
    });
    
    // Create readline for parsing JSON events
    const rl = readline.createInterface({
      input: claudeProcess.stdout!,
      crlfDelay: Infinity
    });
    
    // Handle each JSON event
    rl.on('line', (line) => {
      lineCount++;
      display.log('debug', `Received line ${lineCount}: ${line.substring(0, 200)}`);
      
      if (!line.trim()) return;
      
      try {
        const event = JSON.parse(line);
        display.debugEvent(event);
        
        // Get local timestamp
        const timestamp = new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        
        // Handle different event types based on Claude's actual JSON structure
        switch (event.type) {
          case 'system':
            if (event.subtype === 'init') {
              display.streamAnalysis('Claude', 'Initializing...');
              display.updatePhase('Claude Initialization');
            }
            break;
            
          case 'assistant':
            // Assistant message with content
            if (event.message?.content) {
              for (const content of event.message.content) {
                if (content.type === 'text') {
                  result += content.text;
                  const preview = content.text.substring(0, 80).replace(/\n/g, ' ');
                  if (preview.trim().length > 10) {
                    display.streamAnalysis('Claude', preview);
                  }
                } else if (content.type === 'tool_use') {
                  // Show tool usage in real-time
                  handleToolCall(content, display, timestamp, filesProcessed++);
                }
              }
            }
            // Show token usage if available
            if (event.message?.usage) {
              const tokens = event.message.usage.output_tokens || 0;
              if (tokens > 0) {
                display.updateStatus('Analysis', `Claude is generating comprehensive analysis (${tokens} tokens processed)`);
              }
            }
            break;
            
          case 'tool_use':
            // Direct tool use event
            handleToolCall(event, display, timestamp, filesProcessed++);
            break;
            
          case 'user':
            // User events are tool results
            if (event.message?.content) {
              for (const content of event.message.content) {
                if (content.type === 'tool_result') {
                  display.log('debug', `Tool result: ${JSON.stringify(content).substring(0, 200)}`);
                  
                  const resultStr = JSON.stringify(content);
                  if (resultStr.includes('tool_use_error')) {
                    display.logError('Tool failed', 'Claude cannot access the requested resource');
                    display.log('debug', `Tool error: ${resultStr.substring(0, 500)}`);
                  }
                }
              }
            }
            break;
            
          case 'result':
            // Final result
            if (event.subtype === 'success') {
              display.updateTask(taskId, 100, 'Complete');
            } else if (event.is_error) {
              display.logError('Claude error', event.result || 'Unknown error');
            }
            break;
            
          case 'error':
            display.logError(event.error?.message || 'Claude error', event);
            break;
            
          default:
            // Log unknown event types for debugging
            if (event.type && !['ping', 'heartbeat'].includes(event.type)) {
              display.log('debug', `Unknown event type: ${event.type}`);
            }
        }
        
        // Update progress based on files processed
        if (filesProcessed > 0) {
          const estimatedProgress = Math.min(90, filesProcessed * 2);
          display.updateTask(taskId, estimatedProgress, `Claude is analyzing project structure (${filesProcessed} files examined)`);
        }
        
      } catch (error) {
        // Not JSON, could be regular output or error
        if (line.includes('[ERROR]') || line.includes('Error:')) {
          display.logError('Claude Error', line);
        } else if (!isClaudeThought(line) && line.trim().length > 0) {
          // Regular output
          display.log('info', line.substring(0, 100));
        }
      }
    });
    
    // Handle stderr (errors and sudo prompts)
    claudeProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      
      // Check for sudo password prompt
      if (output.includes('Password:') || output.includes('sudo')) {
        handleSudoPrompt(claudeProcess, display);
      } else if (output.includes('error') || output.includes('Error')) {
        display.logError('Claude error', output);
      } else {
        // Log other stderr for debugging
        if (output.trim()) {
          display.log('debug', output.substring(0, 100));
        }
      }
    });
    
    // Handle completion
    claudeProcess.on('close', (code) => {
      display.log('debug', `Claude process closed with code ${code}, received ${lineCount} lines`);
      
      if (code === 0) {
        display.updateTask(taskId, 100, 'Complete');
        resolve(result);
      } else {
        reject(new Error(`Claude process exited with code ${code}`));
      }
    });
    
    claudeProcess.on('error', (error) => {
      // Common error: command not found
      if (error.message.includes('ENOENT')) {
        display.logError('Claude CLI not found. Please ensure "claude" is installed and in PATH', error);
        reject(new Error('Claude CLI not found. Run: npm install -g @anthropic-ai/claude-code'));
      } else {
        display.logError('Failed to start Claude', error);
        reject(error);
      }
    });
  });
}

/**
 * Handle tool calls with real-time display
 */
function handleToolCall(event: any, display: TUIAdapter, timestamp: string, fileCount: number) {
  const tool = event.name || event.tool;
  const args = event.input || event.args || {};
  
  let target = args.file_path || args.path || args.pattern || args.command || '';
  
  // Display tool usage with appropriate icon and timestamp
  switch (tool) {
    case 'str_replace_based_edit_tool':
    case 'Edit':
      display.streamFile('[EDIT]', target);
      break;
      
    case 'read_file':
    case 'Read':
      display.streamFile('[READ]', target);
      break;
      
    case 'write_file':
    case 'Write':
      display.streamFile('[WRITE]', target);
      break;
      
    case 'run_bash':
    case 'Bash':
      // Check if sudo command
      const cmd = args.command || args.bash_command || '';
      if (cmd.includes('sudo')) {
        display.log('warning', 'Sudo command detected - may require password');
      }
      display.streamFile('[BASH]', cmd.substring(0, 50) || 'command');
      break;
      
    case 'search_files':
    case 'Grep':
      display.streamFile('[SEARCH]', `${args.pattern || args.regex} in ${args.path || '.'}`);
      break;
      
    case 'list_files':
    case 'LS':
      display.streamFile('[LIST]', args.path || args.directory);
      break;
      
    case 'find_files':
    case 'Glob':
      display.streamFile('[FIND]', args.pattern || args.glob);
      break;
      
    case 'WebSearch':
      display.streamFile('[WEB]', args.query);
      break;
      
    default:
      if (tool) {
        display.streamFile(`[${tool.toUpperCase()}]`, target.substring(0, 50));
      }
  }
}

/**
 * Handle sudo password prompts with timeout
 */
function handleSudoPrompt(process: any, display: TUIAdapter) {
  // Pause display updates
  display.log('warning', 'Sudo password required for privileged operation');
  
  // Skip password prompts in automated mode
  display.log('warning', 'Skipping sudo password prompt - operation may fail');
  process.stdin?.write('\n');
}

/**
 * Check if text is Claude's internal thought
 */
function isClaudeThought(text: string): boolean {
  const thoughts = [
    "I'll analyze", "I'll create", "I'll now", "I'll start", "I'll examine",
    "I need to", "I should", "I will", "I'm going to", "I want to",
    "Let me", "I see that", "I notice", "I can see", "I observe",
    "I've analyzed", "I understand", "Looking at", "I'm thinking",
    "Here's what I", "Based on", "After reviewing"
  ];
  
  const lowerText = text.toLowerCase();
  return thoughts.some(thought => lowerText.includes(thought.toLowerCase()));
}

/**
 * Legacy wrapper for backwards compatibility  
 */
export async function queryClaudeCode(
  prompt: string,
  progressCallback?: (progress: number) => void,
  tools?: string[],
  projectPath?: string
): Promise<string> {
  // Create a minimal display interface
  const display = {
    streamFile: () => {},
    streamAnalysis: () => {},
    stream: () => {},
    log: console.log,
    logError: console.error,
    updateTask: (id: string, progress: number) => {
      if (progressCallback) progressCallback(progress);
    },
    updatePhase: () => {},
    updateStatus: () => {},
    debugEvent: () => {}
  } as any;
  
  return streamingClaudeQuery(prompt, display, 'legacy', tools, projectPath);
}