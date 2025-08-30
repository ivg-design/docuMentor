import { spawn } from 'child_process';
import * as readline from 'readline';
import { TUIAdapter } from './TUIAdapter';

/**
 * Unified Claude Client - Single implementation for all Claude queries
 * Consolidates EnhancedClaudeClientV2, ClaudeStreamClient, and claudeCodeClient
 */

export type ProgressCallback = (progress: number) => void;

/**
 * Main streaming Claude query function with real JSON event streaming
 * This is the primary function that all other wrappers call
 */
export async function streamingClaudeQuery(
  prompt: string,
  display?: TUIAdapter | null,
  taskId?: string,
  tools?: string[],
  projectPath?: string
): Promise<string> {
  // Create minimal display if not provided
  const ui = display || createMinimalDisplay();
  const task = taskId || 'claude-query';
  
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
    
    // CRITICAL: Block TodoWrite and Task tools to prevent output pollution
    // Use both --allowedTools and --disallowedTools for maximum protection
    args.push('--disallowedTools');
    args.push('TodoWrite');
    args.push('Task');
    
    // Add allowed tools if specified (NEVER include TodoWrite/Task)
    if (tools && tools.length > 0) {
      // Filter out TodoWrite/Task tool to prevent output pollution
      const filteredTools = tools.filter(t => t !== 'Task' && t !== 'TodoWrite');
      if (filteredTools.length > 0) {
        args.push('--allowedTools');
        filteredTools.forEach(tool => args.push(tool));
      }
    } else {
      // Default tools (without TodoWrite/Task)
      args.push('--allowedTools');
      ['Read', 'Grep', 'Glob', 'Bash', 'Write', 'Edit'].forEach(tool => args.push(tool));
    }
    
    // Spawn claude process with correct working directory
    ui.log('info', `Launching Claude AI from ${projectPath || process.cwd()}`);
    const claudeProcess = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
      cwd: projectPath || process.cwd()  // Set working directory to project path!
    });
    
    // Write prompt to stdin and close it
    ui.log('debug', `Sending prompt to Claude (${prompt.length} chars)`);
    claudeProcess.stdin!.write(prompt);
    claudeProcess.stdin!.end();
    
    // Log process spawn
    claudeProcess.on('spawn', () => {
      ui.log('info', 'Claude process started');
    });
    
    claudeProcess.on('error', (err) => {
      ui.logError('Failed to start Claude', err);
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
      ui.log('debug', `Received line ${lineCount}: ${line.substring(0, 200)}`);
      
      if (!line.trim()) return;
      
      try {
        const event = JSON.parse(line);
        ui.debugEvent(event);
        
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
              ui.streamAnalysis('Claude', 'Initializing...');
              ui.logInfo('Claude', 'Initializing...');
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
                    ui.streamAnalysis('Claude', preview);
                  }
                } else if (content.type === 'tool_use') {
                  // Show tool usage in real-time
                  handleToolCall(content, ui, timestamp, filesProcessed++);
                }
              }
            }
            // Show token usage if available
            if (event.message?.usage) {
              const tokens = event.message.usage.output_tokens || 0;
              if (tokens > 0) {
                ui.updateStatus('Analysis', `Claude is generating comprehensive analysis (${tokens} tokens processed)`);
              }
            }
            break;
            
          case 'tool_use':
            // Direct tool use event
            handleToolCall(event, ui, timestamp, filesProcessed++);
            break;
            
          case 'user':
            // User events are tool results
            if (event.message?.content) {
              for (const content of event.message.content) {
                if (content.type === 'tool_result') {
                  ui.log('debug', `Tool result: ${JSON.stringify(content).substring(0, 200)}`);
                  
                  const resultStr = JSON.stringify(content);
                  if (resultStr.includes('tool_use_error')) {
                    ui.logError('Tool failed', 'Claude cannot access the requested resource');
                    ui.log('debug', `Tool error: ${resultStr.substring(0, 500)}`);
                  }
                }
              }
            }
            break;
            
          case 'result':
            // Final result
            if (event.subtype === 'success') {
              ui.updateTask(task, 100, 'Complete');
            } else if (event.is_error) {
              ui.logError('Claude error', event.result || 'Unknown error');
            }
            break;
            
          case 'error':
            ui.logError(event.error?.message || 'Claude error', event);
            break;
            
          default:
            // Log unknown event types for debugging
            if (event.type && !['ping', 'heartbeat'].includes(event.type)) {
              ui.log('debug', `Unknown event type: ${event.type}`);
            }
        }
        
        // Update progress based on files processed
        if (filesProcessed > 0) {
          const estimatedProgress = Math.min(90, filesProcessed * 2);
          ui.updateTask(task, estimatedProgress, `Claude is analyzing project structure (${filesProcessed} files examined)`);
        }
        
      } catch (error) {
        // Not JSON, could be regular output or error
        if (line.includes('[ERROR]') || line.includes('Error:')) {
          ui.logError('Claude Error', line);
        } else if (!isClaudeThought(line) && line.trim().length > 0) {
          // Regular output
          ui.log('info', line.substring(0, 100));
        }
      }
    });
    
    // Handle stderr (errors and sudo prompts)
    claudeProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      
      if (output.includes('error') || output.includes('Error')) {
        ui.logError('Claude error', output);
      } else {
        // Log other stderr for debugging
        if (output.trim()) {
          ui.log('debug', output.substring(0, 100));
        }
      }
    });
    
    // Handle completion
    claudeProcess.on('close', (code) => {
      ui.log('debug', `Claude process closed with code ${code}, received ${lineCount} lines`);
      
      if (code === 0) {
        ui.updateTask(task, 100, 'Complete');
        resolve(result);
      } else {
        reject(new Error(`Claude process exited with code ${code}`));
      }
    });
    
    claudeProcess.on('error', (error) => {
      // Common error: command not found
      if (error.message.includes('ENOENT')) {
        ui.logError('Claude CLI not found. Please ensure "claude" is installed and in PATH', error);
        reject(new Error('Claude CLI not found. Run: npm install -g @anthropic-ai/claude-code'));
      } else {
        ui.logError('Failed to start Claude', error);
        reject(error);
      }
    });
  });
}

/**
 * Legacy wrapper for backwards compatibility with claudeCodeClient
 */
export async function queryClaudeCode(
  prompt: string,
  progressCallback?: ProgressCallback,
  tools?: string[],
  projectPath?: string
): Promise<string> {
  // Create a minimal display interface that reports progress
  const display = createMinimalDisplay(progressCallback);
  
  return streamingClaudeQuery(prompt, display, 'legacy', tools, projectPath);
}

/**
 * Simple query without display (for non-interactive use)
 */
export async function simpleClaudeQuery(
  prompt: string,
  tools?: string[],
  projectPath?: string
): Promise<string> {
  return streamingClaudeQuery(prompt, null, 'simple', tools, projectPath);
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
      const bashCmd = args.command || args.bash_command || '';
      display.streamFile('[BASH]', bashCmd.substring(0, 50) || 'command');
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
 * Create minimal display interface for non-TUI usage
 */
function createMinimalDisplay(progressCallback?: ProgressCallback): TUIAdapter {
  const display = {
    streamFile: () => {},
    streamAnalysis: () => {},
    stream: () => {},
    log: (level: string, msg: string) => {
      if (level === 'error') console.error(msg);
      else if (level === 'warning') console.warn(msg);
      else if (process.env.DEBUG) console.log(msg);
    },
    logInfo: (title: string, msg?: string) => {
      if (process.env.DEBUG) console.log(`[${title}] ${msg || ''}`);
    },
    logError: (title: string, error: any) => {
      console.error(`[${title}]`, error);
    },
    updateTask: (id: string, progress: number) => {
      if (progressCallback) progressCallback(progress);
    },
    updatePhase: () => {},
    updateStatus: () => {},
    debugEvent: () => {},
    pause: () => {},
    resume: () => {},
    setWorking: () => {},
    addDiagnostic: () => {}
  } as any;
  
  return display;
}