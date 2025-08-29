import { spawn, ChildProcess } from 'child_process';
import * as readline from 'readline';
import { UltraTerminalUI } from './UltraTerminalUI';

export interface ClaudeEvent {
  type: 'tool_use' | 'tool_result' | 'thinking' | 'content' | 'error' | 'complete';
  tool?: string;
  args?: any;
  content?: string;
  error?: string;
  timestamp: string;
}

export interface ClaudeStreamOptions {
  allowedTools?: string[];
  maxTokens?: number;
  temperature?: number;
}

export class ClaudeStreamClient {
  private process: ChildProcess | null = null;
  private ui: UltraTerminalUI;
  private currentTaskId: string = '';
  private filesProcessed: number = 0;
  private totalFiles: number = 0;
  private startTime: Date;
  
  constructor(ui: UltraTerminalUI) {
    this.ui = ui;
    this.startTime = new Date();
  }
  
  /**
   * Execute Claude query with real-time JSON streaming
   */
  async streamQuery(
    prompt: string, 
    taskId: string,
    options: ClaudeStreamOptions = {}
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.currentTaskId = taskId;
      let result = '';
      let errorBuffer = '';
      
      // Build command arguments
      const args = [
        '--json-stream',
        '--print'
      ];
      
      // Add allowed tools
      if (options.allowedTools && options.allowedTools.length > 0) {
        args.push('--tools', options.allowedTools.join(','));
      }
      
      // Add other options
      if (options.maxTokens) {
        args.push('--max-tokens', options.maxTokens.toString());
      }
      
      // Spawn claude-code process
      this.process = spawn('claude-code', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      // Send prompt to stdin
      this.process.stdin?.write(prompt);
      this.process.stdin?.end();
      
      // Create readline interface for stdout
      const rl = readline.createInterface({
        input: this.process.stdout!,
        crlfDelay: Infinity
      });
      
      // Process each line of JSON output
      rl.on('line', (line) => {
        if (!line.trim()) return;
        
        try {
          const event: ClaudeEvent = JSON.parse(line);
          this.handleClaudeEvent(event);
          
          // Accumulate content for final result
          if (event.type === 'content' && event.content) {
            // Filter out Claude's internal thoughts
            if (!this.isClaudeThought(event.content)) {
              result += event.content;
            }
          }
          
        } catch (error) {
          // Not JSON, might be regular output
          if (!this.isClaudeThought(line)) {
            this.ui.stream(line);
          }
        }
      });
      
      // Handle stderr
      this.process.stderr?.on('data', (data) => {
        errorBuffer += data.toString();
      });
      
      // Handle process completion
      this.process.on('close', (code) => {
        if (code === 0) {
          resolve(result);
        } else {
          reject(new Error(`Claude process exited with code ${code}: ${errorBuffer}`));
        }
      });
      
      // Handle process errors
      this.process.on('error', (error) => {
        reject(error);
      });
    });
  }
  
  /**
   * Handle individual Claude events
   */
  private handleClaudeEvent(event: ClaudeEvent) {
    const localTime = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    switch (event.type) {
      case 'tool_use':
        this.handleToolUse(event, localTime);
        break;
        
      case 'tool_result':
        this.handleToolResult(event, localTime);
        break;
        
      case 'thinking':
        this.handleThinking(event, localTime);
        break;
        
      case 'content':
        this.handleContent(event, localTime);
        break;
        
      case 'error':
        this.ui.logError(event.error || 'Unknown error', event);
        break;
    }
  }
  
  /**
   * Handle tool use events
   */
  private handleToolUse(event: ClaudeEvent, timestamp: string) {
    if (!event.tool || !event.args) return;
    
    const tool = event.tool;
    const args = event.args;
    
    // Extract file/path information
    let target = args.file_path || args.path || args.pattern || args.command || 'unknown';
    
    // Update UI with actual tool usage
    switch (tool) {
      case 'Read':
        this.ui.streamFile('📖 Reading', target);
        this.filesProcessed++;
        break;
        
      case 'Write':
        this.ui.streamFile('📝 Writing', target);
        this.filesProcessed++;
        break;
        
      case 'Grep':
        this.ui.streamFile('🔍 Searching', `${args.pattern} in ${args.path || '.'}`);
        break;
        
      case 'Glob':
        this.ui.streamFile('📁 Scanning', args.pattern);
        break;
        
      case 'Bash':
        this.ui.streamFile('⚡ Executing', args.command?.substring(0, 50) || 'command');
        break;
        
      case 'LS':
        this.ui.streamFile('📂 Listing', args.path);
        break;
        
      default:
        this.ui.streamFile(`🔧 ${tool}`, target);
    }
    
    // Update progress based on files processed
    if (this.totalFiles > 0) {
      const progress = Math.min(100, Math.round((this.filesProcessed / this.totalFiles) * 100));
      this.ui.updateTask(this.currentTaskId, progress, `${tool}: ${target}`, target);
    } else {
      // Estimate progress
      const progress = Math.min(95, this.filesProcessed * 2);
      this.ui.updateTask(this.currentTaskId, progress, `${tool}: ${target}`, target);
    }
  }
  
  /**
   * Handle tool result events
   */
  private handleToolResult(event: ClaudeEvent, timestamp: string) {
    // Tool completed successfully
    if (event.content) {
      // If it's a file list, count files
      if (event.content.includes('\n') && event.content.includes('.')) {
        const files = event.content.split('\n').filter(line => line.includes('.'));
        if (files.length > 10) {
          this.totalFiles = Math.max(this.totalFiles, files.length);
          this.ui.stream(`Found ${files.length} files to process`);
        }
      }
    }
  }
  
  /**
   * Handle thinking events
   */
  private handleThinking(event: ClaudeEvent, timestamp: string) {
    if (event.content && !this.isClaudeThought(event.content)) {
      this.ui.streamAnalysis('Thinking', event.content.substring(0, 60));
    }
    // Show thinking indicator
    this.ui.updateTask(this.currentTaskId, -1, '🤔 Claude is thinking...');
  }
  
  /**
   * Handle content events
   */
  private handleContent(event: ClaudeEvent, timestamp: string) {
    if (event.content && !this.isClaudeThought(event.content)) {
      // Only show meaningful content
      const lines = event.content.split('\n');
      const firstLine = lines[0]?.trim();
      if (firstLine && firstLine.length > 10) {
        this.ui.stream(firstLine.substring(0, 80));
      }
    }
  }
  
  /**
   * Check if text is Claude's internal thought
   */
  private isClaudeThought(text: string): boolean {
    const thoughts = [
      "I'll ", "I need", "I should", "I will", "I'm ",
      "Let me", "I see", "I notice", "I can", "Here's",
      "I've ", "I understand", "Looking at", "I want"
    ];
    return thoughts.some(t => text.includes(t));
  }
  
  /**
   * Kill the Claude process
   */
  kill() {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }
}

/**
 * Enhanced streaming query function using JSON stream
 */
export async function enhancedStreamingQuery(
  prompt: string,
  ui: UltraTerminalUI,
  taskId: string,
  tools?: string[]
): Promise<string> {
  const client = new ClaudeStreamClient(ui);
  
  try {
    const result = await client.streamQuery(prompt, taskId, {
      allowedTools: tools || ['Read', 'Write', 'Grep', 'Glob', 'LS', 'Bash']
    });
    return result;
  } finally {
    client.kill();
  }
}