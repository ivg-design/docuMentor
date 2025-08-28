import { CLIInterface } from './CLIInterface';
import { EventEmitter } from 'events';
import * as readline from 'readline';

export interface StreamEvent {
  type: 'file' | 'task' | 'analysis' | 'output' | 'progress' | 'error';
  timestamp: Date;
  message: string;
  details?: any;
  level?: 'debug' | 'info' | 'warning' | 'error';
}

export class StreamingReporter extends EventEmitter {
  private cli: CLIInterface;
  private currentLines: string[] = [];
  private maxLines: number = 10;
  private isStreaming: boolean = false;
  private streamBuffer: StreamEvent[] = [];
  private updateInterval: NodeJS.Timeout | null = null;
  private lastUpdate: Date = new Date();
  private startTime: Date = new Date();
  private taskStartTimes: Map<string, Date> = new Map();
  private taskCompletionRates: Map<string, number> = new Map();
  private pulseFrame: number = 0;
  private pulseChars: string[] = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private lastActivity: Date = new Date();
  private activityTimeout: number = 5000; // 5 seconds without activity = warning
  
  constructor(cli: CLIInterface) {
    super();
    this.cli = cli;
  }
  
  /**
   * Start streaming mode
   */
  startStreaming(): void {
    this.isStreaming = true;
    this.currentLines = [];
    
    // Clear screen and set up streaming area
    if (process.stdout.isTTY) {
      console.clear();
    }
    
    // Start update loop
    this.updateInterval = setInterval(() => {
      this.renderStream();
    }, 100); // Update every 100ms
  }
  
  /**
   * Stop streaming
   */
  stopStreaming(): void {
    this.isStreaming = false;
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    // Clear streaming area
    this.clearStreamArea();
  }
  
  /**
   * Stream a file operation
   */
  streamFile(operation: string, filePath: string, details?: any): void {
    this.addStreamEvent({
      type: 'file',
      timestamp: new Date(),
      message: `📄 ${operation}: ${filePath}`,
      details,
      level: 'info'
    });
  }
  
  /**
   * Stream a task update
   */
  streamTask(task: string, status: string, details?: any): void {
    this.addStreamEvent({
      type: 'task',
      timestamp: new Date(),
      message: `⚡ ${task}: ${status}`,
      details,
      level: 'info'
    });
  }
  
  /**
   * Stream analysis details
   */
  streamAnalysis(component: string, action: string, details?: any): void {
    this.addStreamEvent({
      type: 'analysis',
      timestamp: new Date(),
      message: `🔍 [${component}] ${action}`,
      details,
      level: 'debug'
    });
  }
  
  /**
   * Stream output/results
   */
  streamOutput(message: string, details?: any): void {
    this.addStreamEvent({
      type: 'output',
      timestamp: new Date(),
      message: `→ ${message}`,
      details,
      level: 'info'
    });
  }
  
  /**
   * Stream progress update
   */
  streamProgress(task: string, current: number, total: number, detail?: string): void {
    const percentage = Math.round((current / total) * 100);
    this.addStreamEvent({
      type: 'progress',
      timestamp: new Date(),
      message: `[${task}] ${percentage}% (${current}/${total}) ${detail || ''}`,
      details: { current, total, percentage },
      level: 'info'
    });
  }
  
  /**
   * Stream error
   */
  streamError(error: string, details?: any): void {
    this.addStreamEvent({
      type: 'error',
      timestamp: new Date(),
      message: `❌ ${error}`,
      details,
      level: 'error'
    });
  }
  
  /**
   * Add event to stream
   */
  private addStreamEvent(event: StreamEvent): void {
    this.streamBuffer.push(event);
    this.emit('stream', event);
    
    // Update last activity time
    this.lastActivity = new Date();
    
    // Keep buffer size manageable
    if (this.streamBuffer.length > 100) {
      this.streamBuffer.shift();
    }
    
    // Update display lines
    this.updateDisplayLines(event);
  }
  
  /**
   * Update display lines
   */
  private updateDisplayLines(event: StreamEvent): void {
    const timestamp = event.timestamp.toISOString().split('T')[1].split('.')[0];
    const line = `[${timestamp}] ${event.message}`;
    
    this.currentLines.push(line);
    
    // Keep only last N lines
    if (this.currentLines.length > this.maxLines) {
      this.currentLines.shift();
    }
    
    this.lastUpdate = new Date();
  }
  
  /**
   * Render the stream
   */
  private renderStream(): void {
    if (!this.isStreaming || !process.stdout.isTTY) {
      return;
    }
    
    // Update pulse
    this.pulseFrame = (this.pulseFrame + 1) % this.pulseChars.length;
    const pulse = this.pulseChars[this.pulseFrame];
    
    // Calculate timers
    const elapsed = this.formatDuration(Date.now() - this.startTime.getTime());
    const eta = this.calculateETA();
    const timeSinceActivity = Date.now() - this.lastActivity.getTime();
    
    // Activity indicator
    let activityStatus = pulse;
    if (timeSinceActivity > this.activityTimeout) {
      activityStatus = '⚠️'; // Warning if no activity
    }
    
    // Move cursor to streaming area
    readline.cursorTo(process.stdout, 0, process.stdout.rows - this.maxLines - 5);
    readline.clearScreenDown(process.stdout);
    
    // Draw status bar
    console.log('─'.repeat(process.stdout.columns));
    console.log(`${activityStatus} Elapsed: ${elapsed} | ETA: ${eta} | Last Activity: ${Math.round(timeSinceActivity / 1000)}s ago`);
    console.log('─'.repeat(process.stdout.columns));
    console.log('Live Stream:');
    
    // Draw current lines
    this.currentLines.forEach(line => {
      // Truncate if too long
      const maxWidth = process.stdout.columns - 2;
      const truncated = line.length > maxWidth ? 
        line.substring(0, maxWidth - 3) + '...' : 
        line;
      console.log(truncated);
    });
    
    // Draw bottom separator
    console.log('─'.repeat(process.stdout.columns));
  }
  
  /**
   * Clear stream area
   */
  private clearStreamArea(): void {
    if (!process.stdout.isTTY) {
      return;
    }
    
    readline.cursorTo(process.stdout, 0, process.stdout.rows - this.maxLines - 5);
    readline.clearScreenDown(process.stdout);
  }
  
  /**
   * Format duration
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
  
  /**
   * Calculate ETA based on completion rates
   */
  private calculateETA(): string {
    // Get average completion rate from recent tasks
    const rates = Array.from(this.taskCompletionRates.values());
    if (rates.length === 0) {
      return 'Calculating...';
    }
    
    const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
    const remainingTasks = this.estimateRemainingTasks();
    
    if (remainingTasks === 0) {
      return 'Almost done';
    }
    
    const etaMs = remainingTasks * avgRate;
    return this.formatDuration(etaMs);
  }
  
  /**
   * Estimate remaining tasks
   */
  private estimateRemainingTasks(): number {
    // This would be updated based on actual task queue
    // For now, return a placeholder
    return 10;
  }
  
  /**
   * Track task timing
   */
  startTaskTiming(taskId: string): void {
    this.taskStartTimes.set(taskId, new Date());
  }
  
  /**
   * Complete task timing
   */
  completeTaskTiming(taskId: string): void {
    const startTime = this.taskStartTimes.get(taskId);
    if (startTime) {
      const duration = Date.now() - startTime.getTime();
      this.taskCompletionRates.set(taskId, duration);
      this.taskStartTimes.delete(taskId);
    }
  }
  
  /**
   * Get stream history
   */
  getHistory(): StreamEvent[] {
    return [...this.streamBuffer];
  }
  
  /**
   * Set max display lines
   */
  setMaxLines(lines: number): void {
    this.maxLines = lines;
  }
  
  /**
   * Create a streaming context for Claude API calls
   */
  createClaudeStreamContext(taskName: string) {
    let toolCallCount = 0;
    let lastTool = '';
    
    return {
      onToolCall: (tool: string, args: any) => {
        toolCallCount++;
        lastTool = tool;
        
        // Stream tool usage
        if (tool === 'Read') {
          this.streamFile('Reading', args.file_path || args.path || 'unknown');
        } else if (tool === 'Grep') {
          this.streamAnalysis('Search', `Pattern: "${args.pattern}" in ${args.path || 'project'}`);
        } else if (tool === 'Glob') {
          this.streamAnalysis('Scan', `Finding files: ${args.pattern}`);
        } else if (tool === 'LS') {
          this.streamFile('Listing', args.path || 'directory');
        } else if (tool === 'Bash') {
          this.streamTask('Command', args.command || 'executing');
        } else {
          this.streamTask('Tool', `${tool} (${toolCallCount} calls)`);
        }
      },
      
      onChunk: (chunk: any) => {
        // Stream chunk processing
        if (chunk.type === 'tool_result') {
          this.streamOutput(`Tool result from ${lastTool}`);
        } else if (chunk.type === 'thinking') {
          this.streamAnalysis('AI', 'Processing information...');
        }
      },
      
      onProgress: (progress: number) => {
        this.streamProgress(taskName, progress, 100, 'AI analysis in progress');
      }
    };
  }
}

/**
 * Enhanced streaming for multi-file operations
 */
export class MultiFileStreamer {
  private streamer: StreamingReporter;
  private fileQueue: string[] = [];
  private processedFiles: Set<string> = new Set();
  private currentFile: string | null = null;
  
  constructor(streamer: StreamingReporter) {
    this.streamer = streamer;
  }
  
  /**
   * Queue files for processing
   */
  queueFiles(files: string[]): void {
    this.fileQueue.push(...files);
    this.streamer.streamTask('Queue', `${files.length} files added to queue`);
  }
  
  /**
   * Process next file
   */
  processNext(): string | null {
    if (this.fileQueue.length === 0) {
      return null;
    }
    
    this.currentFile = this.fileQueue.shift()!;
    this.processedFiles.add(this.currentFile);
    
    this.streamer.streamFile('Processing', this.currentFile, {
      remaining: this.fileQueue.length,
      processed: this.processedFiles.size
    });
    
    return this.currentFile;
  }
  
  /**
   * Mark current file as complete
   */
  completeFile(results?: any): void {
    if (this.currentFile) {
      this.streamer.streamFile('Completed', this.currentFile, results);
      this.currentFile = null;
    }
  }
  
  /**
   * Get progress
   */
  getProgress(): { processed: number; total: number; percentage: number } {
    const total = this.processedFiles.size + this.fileQueue.length + (this.currentFile ? 1 : 0);
    const processed = this.processedFiles.size;
    const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
    
    return { processed, total, percentage };
  }
}