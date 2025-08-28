import * as cliProgress from 'cli-progress';
import chalk from 'chalk';
import * as readline from 'readline';
import boxen from 'boxen';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error' | 'debug';
  message: string;
}

interface ActiveTask {
  id: string;
  name: string;
  bar?: any; // Progress bar instance
  startTime: Date;
  currentMessage: string;
  progress: number;
  total: number;
}

export class RealTimeDisplay {
  private multiBar: cliProgress.MultiBar | null = null;
  private tasks: Map<string, ActiveTask> = new Map();
  private logBuffer: LogEntry[] = [];
  private maxLogs: number = 20;
  private streamLines: string[] = [];
  private maxStreamLines: number = 10;
  private isInteractive: boolean;
  private startTime: Date = new Date();
  private lastActivity: Date = new Date();
  private pulseInterval: NodeJS.Timeout | null = null;
  private pulseFrame: number = 0;
  private pulseChars: string[] = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  
  constructor() {
    this.isInteractive = process.stdout.isTTY || false;
    
    if (this.isInteractive) {
      // Clear screen and setup
      console.clear();
      
      // Create multi-progress bar with custom format
      this.multiBar = new cliProgress.MultiBar({
        clearOnComplete: false,
        hideCursor: true,
        format: this.customFormat.bind(this),
        barCompleteChar: '█',
        barIncompleteChar: '░',
        fps: 10, // Limit updates to 10fps
        forceRedraw: false
      }, cliProgress.Presets.shades_grey);
      
      // Start pulse indicator
      this.startPulse();
    }
  }
  
  /**
   * Custom format for progress bars
   */
  private customFormat(options: any, params: any, payload: any): string {
    const bar = options.barCompleteString.substring(0, Math.round(params.progress * options.barsize)) +
                options.barIncompleteString.substring(0, options.barsize - Math.round(params.progress * options.barsize));
    
    const percentage = Math.floor(params.progress * 100);
    const elapsed = this.formatElapsed(payload.startTime);
    const eta = this.calculateETA(params.progress, payload.startTime);
    
    // Color based on status
    let statusColor = chalk.cyan;
    if (percentage === 100) statusColor = chalk.green;
    else if (percentage > 75) statusColor = chalk.yellow;
    
    return `${statusColor(payload.name.padEnd(25))} ${bar} ${statusColor(percentage.toString().padStart(3))}% | ${elapsed} | ETA: ${eta} | ${payload.message || ''}`;
  }
  
  /**
   * Create a new task with progress bar
   */
  createTask(id: string, name: string, total: number = 100): void {
    if (!this.isInteractive) {
      // Non-interactive mode: just log
      this.log('info', `Starting: ${name}`);
      return;
    }
    
    // Remove any existing task with same ID
    this.removeTask(id);
    
    // Create progress bar
    const bar = this.multiBar?.create(total, 0, {
      name,
      message: 'Initializing...',
      startTime: new Date()
    });
    
    // Store task
    this.tasks.set(id, {
      id,
      name,
      bar,
      startTime: new Date(),
      currentMessage: 'Initializing...',
      progress: 0,
      total
    });
    
    this.lastActivity = new Date();
  }
  
  /**
   * Update task progress
   */
  updateTask(id: string, progress: number, message?: string): void {
    const task = this.tasks.get(id);
    if (!task) return;
    
    task.progress = Math.min(progress, task.total);
    task.currentMessage = message || task.currentMessage;
    
    if (this.isInteractive && task.bar) {
      task.bar.update(task.progress, {
        name: task.name,
        message: task.currentMessage,
        startTime: task.startTime
      });
    } else {
      // Non-interactive: log significant updates only
      if (progress % 25 === 0 || progress === task.total) {
        this.log('info', `[${task.name}] ${progress}% - ${message || ''}`);
      }
    }
    
    this.lastActivity = new Date();
  }
  
  /**
   * Complete a task
   */
  completeTask(id: string, message?: string): void {
    const task = this.tasks.get(id);
    if (!task) return;
    
    // Update to 100%
    this.updateTask(id, task.total, message || 'Complete');
    
    // Log completion
    this.log('success', `✓ ${task.name} completed`);
    
    // Stop and remove the bar after a short delay
    setTimeout(() => {
      if (task.bar) {
        task.bar.stop();
      }
      this.tasks.delete(id);
    }, 1000);
  }
  
  /**
   * Remove a task
   */
  removeTask(id: string): void {
    const task = this.tasks.get(id);
    if (task?.bar) {
      task.bar.stop();
    }
    this.tasks.delete(id);
  }
  
  /**
   * Stream a line of real-time output
   */
  stream(message: string): void {
    // Add timestamp
    const timestamp = new Date().toLocaleTimeString();
    const line = `[${timestamp}] ${message}`;
    
    // Add to stream buffer
    this.streamLines.push(line);
    if (this.streamLines.length > this.maxStreamLines) {
      this.streamLines.shift();
    }
    
    // In non-interactive mode, just print
    if (!this.isInteractive) {
      console.log(line);
    }
    
    this.lastActivity = new Date();
  }
  
  /**
   * Log a message (stored in buffer, not immediately displayed)
   */
  log(level: 'info' | 'success' | 'warning' | 'error' | 'debug', message: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message
    };
    
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxLogs) {
      this.logBuffer.shift();
    }
    
    // In non-interactive mode, print immediately
    if (!this.isInteractive) {
      const colors = {
        info: chalk.blue,
        success: chalk.green,
        warning: chalk.yellow,
        error: chalk.red,
        debug: chalk.gray
      };
      
      console.log(`[${entry.timestamp}] ${colors[level](entry.message)}`);
    }
    
    this.lastActivity = new Date();
  }
  
  /**
   * Display status header
   */
  displayHeader(title: string, subtitle?: string): void {
    if (!this.isInteractive) {
      console.log(`\n${title}`);
      if (subtitle) console.log(subtitle);
      return;
    }
    
    // Position cursor at top
    readline.cursorTo(process.stdout, 0, 0);
    readline.clearLine(process.stdout, 0);
    
    const header = boxen(`${chalk.bold(title)}${subtitle ? '\n' + chalk.gray(subtitle) : ''}`, {
      padding: 0,
      margin: 0,
      borderStyle: 'round',
      borderColor: 'cyan'
    });
    
    console.log(header);
  }
  
  /**
   * Display status summary
   */
  displayStatus(): void {
    if (!this.isInteractive) return;
    
    const elapsed = this.formatDuration(Date.now() - this.startTime.getTime());
    const timeSinceActivity = Math.round((Date.now() - this.lastActivity.getTime()) / 1000);
    const pulse = this.pulseChars[this.pulseFrame];
    
    // Position below header
    readline.cursorTo(process.stdout, 0, 3);
    readline.clearLine(process.stdout, 0);
    
    const status = timeSinceActivity > 5 ? 
      chalk.yellow('⚠ No activity') : 
      chalk.green(`${pulse} Active`);
    
    console.log(chalk.gray(`Status: ${status} | Elapsed: ${elapsed} | Tasks: ${this.tasks.size} active`));
  }
  
  /**
   * Display streaming output section
   */
  displayStream(): void {
    if (!this.isInteractive || this.streamLines.length === 0) return;
    
    // Calculate position (below progress bars)
    const streamStartRow = 5 + (this.tasks.size * 2) + 2;
    
    // Draw stream section
    readline.cursorTo(process.stdout, 0, streamStartRow);
    console.log(chalk.gray('─'.repeat(process.stdout.columns)));
    console.log(chalk.gray('Live Output:'));
    
    this.streamLines.forEach(line => {
      // Truncate long lines
      const maxWidth = process.stdout.columns - 2;
      const truncated = line.length > maxWidth ? 
        line.substring(0, maxWidth - 3) + '...' : line;
      console.log(chalk.gray(truncated));
    });
  }
  
  /**
   * Display log section
   */
  displayLogs(): void {
    if (!this.isInteractive) return;
    
    // Calculate position (bottom of screen)
    const logStartRow = process.stdout.rows - this.maxLogs - 3;
    
    readline.cursorTo(process.stdout, 0, logStartRow);
    console.log(chalk.gray('─'.repeat(process.stdout.columns)));
    console.log(chalk.gray('Recent Activity:'));
    
    // Display recent logs
    const recentLogs = this.logBuffer.slice(-10);
    recentLogs.forEach(entry => {
      const colors = {
        info: chalk.blue,
        success: chalk.green,
        warning: chalk.yellow,
        error: chalk.red,
        debug: chalk.gray
      };
      
      const icon = {
        info: 'ℹ',
        success: '✓',
        warning: '⚠',
        error: '✗',
        debug: '○'
      };
      
      console.log(`${colors[entry.level](icon[entry.level])} [${entry.timestamp}] ${entry.message}`);
    });
  }
  
  /**
   * Start pulse animation
   */
  private startPulse(): void {
    this.pulseInterval = setInterval(() => {
      this.pulseFrame = (this.pulseFrame + 1) % this.pulseChars.length;
      this.displayStatus();
    }, 100);
  }
  
  /**
   * Stop pulse animation
   */
  private stopPulse(): void {
    if (this.pulseInterval) {
      clearInterval(this.pulseInterval);
      this.pulseInterval = null;
    }
  }
  
  /**
   * Format elapsed time
   */
  private formatElapsed(startTime: Date): string {
    const ms = Date.now() - startTime.getTime();
    return this.formatDuration(ms);
  }
  
  /**
   * Format duration
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h${(minutes % 60).toString().padStart(2, '0')}m`;
    } else if (minutes > 0) {
      return `${minutes}m${(seconds % 60).toString().padStart(2, '0')}s`;
    } else {
      return `${seconds}s`;
    }
  }
  
  /**
   * Calculate ETA
   */
  private calculateETA(progress: number, startTime: Date): string {
    if (progress === 0) return 'calculating...';
    if (progress >= 1) return 'done';
    
    const elapsed = Date.now() - startTime.getTime();
    const estimatedTotal = elapsed / progress;
    const remaining = estimatedTotal - elapsed;
    
    if (remaining < 0) return 'soon';
    
    return this.formatDuration(remaining);
  }
  
  /**
   * Create a streaming context for Claude API
   */
  createClaudeContext(taskId: string) {
    return {
      onToolCall: (tool: string, args: any) => {
        // Stream tool usage
        if (tool === 'Read') {
          this.stream(`📄 Reading: ${args.file_path || args.path || 'file'}`);
        } else if (tool === 'Grep') {
          this.stream(`🔍 Searching: "${args.pattern}"`);
        } else if (tool === 'Glob') {
          this.stream(`📁 Scanning: ${args.pattern}`);
        } else if (tool === 'LS') {
          this.stream(`📂 Listing: ${args.path || 'directory'}`);
        } else if (tool === 'Bash') {
          this.stream(`⚡ Command: ${args.command || 'executing'}`);
        } else {
          this.stream(`🔧 Tool: ${tool}`);
        }
      },
      
      onProgress: (progress: number) => {
        this.updateTask(taskId, progress, 'AI processing...');
      },
      
      onComplete: (result: string) => {
        // Extract key info from result if needed
        const lines = result.split('\n').slice(0, 3);
        if (lines.length > 0) {
          this.stream(`→ ${lines[0].substring(0, 80)}...`);
        }
      }
    };
  }
  
  /**
   * Cleanup and stop all displays
   */
  cleanup(): void {
    this.stopPulse();
    
    // Stop all progress bars
    if (this.multiBar) {
      this.multiBar.stop();
    }
    
    // Clear tasks
    this.tasks.clear();
    
    // Show final summary
    if (this.isInteractive) {
      console.log('\n' + chalk.gray('─'.repeat(process.stdout.columns)));
      console.log(chalk.bold('\nFinal Summary:'));
      
      // Show log summary
      const errorCount = this.logBuffer.filter(l => l.level === 'error').length;
      const warningCount = this.logBuffer.filter(l => l.level === 'warning').length;
      const successCount = this.logBuffer.filter(l => l.level === 'success').length;
      
      console.log(`  ${chalk.green('✓')} Successes: ${successCount}`);
      if (warningCount > 0) {
        console.log(`  ${chalk.yellow('⚠')} Warnings: ${warningCount}`);
      }
      if (errorCount > 0) {
        console.log(`  ${chalk.red('✗')} Errors: ${errorCount}`);
      }
      
      console.log(`\n  Total time: ${this.formatDuration(Date.now() - this.startTime.getTime())}`);
    }
  }
}