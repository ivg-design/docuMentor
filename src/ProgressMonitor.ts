import * as readline from 'readline';
import { EventEmitter } from 'events';

export interface ProgressUpdate {
  task: string;
  subtask?: string;
  progress: number; // 0-100
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'interrupted';
  message?: string;
  timestamp: Date;
}

export class ProgressMonitor extends EventEmitter {
  private tasks: Map<string, ProgressUpdate> = new Map();
  private currentTask: string | null = null;
  private interrupted: boolean = false;
  private startTime: Date;
  private rl?: readline.Interface;
  private progressBar: string = '';
  private isInteractive: boolean = true;
  private logBuffer: string[] = [];
  
  constructor() {
    super();
    this.startTime = new Date();
    this.setupInterruptHandler();
  }
  
  private setupInterruptHandler(): void {
    if (!this.isInteractive) return;
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    // Handle Ctrl+C
    process.on('SIGINT', () => {
      this.handleInterrupt();
    });
    
    // Handle ESC key
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.on('data', (key) => {
        // ESC key
        if (key.toString() === '\u001b') {
          this.handleInterrupt();
        }
        // Ctrl+C
        if (key.toString() === '\u0003') {
          this.handleInterrupt();
        }
      });
    }
  }
  
  private handleInterrupt(): void {
    if (this.interrupted) {
      console.log('\n\n❌ Force quitting...');
      process.exit(1);
    }
    
    this.interrupted = true;
    this.emit('interrupt');
    
    console.log('\n\n⚠️  Interrupt received. Press Ctrl+C again to force quit.');
    console.log('📝 Saving current progress...');
    
    // Mark current task as interrupted
    if (this.currentTask && this.tasks.has(this.currentTask)) {
      const task = this.tasks.get(this.currentTask)!;
      task.status = 'interrupted';
      this.tasks.set(this.currentTask, task);
    }
    
    this.emit('save-progress', this.getProgress());
  }
  
  startTask(taskName: string, totalSteps: number = 100): void {
    const update: ProgressUpdate = {
      task: taskName,
      progress: 0,
      status: 'in-progress',
      timestamp: new Date()
    };
    
    this.tasks.set(taskName, update);
    this.currentTask = taskName;
    
    this.displayProgress(update);
    this.emit('task-start', update);
  }
  
  updateTask(taskName: string, progress: number, message?: string, subtask?: string): void {
    if (!this.tasks.has(taskName)) {
      this.startTask(taskName);
    }
    
    const update = this.tasks.get(taskName)!;
    update.progress = Math.min(100, Math.max(0, progress));
    update.message = message;
    update.subtask = subtask;
    update.timestamp = new Date();
    
    if (progress >= 100) {
      update.status = 'completed';
    }
    
    this.tasks.set(taskName, update);
    this.displayProgress(update);
    this.emit('task-update', update);
  }
  
  completeTask(taskName: string, message?: string): void {
    if (this.tasks.has(taskName)) {
      const update = this.tasks.get(taskName)!;
      update.progress = 100;
      update.status = 'completed';
      update.message = message;
      update.timestamp = new Date();
      
      this.tasks.set(taskName, update);
      this.displayProgress(update);
      this.emit('task-complete', update);
    }
    
    // Move to next task if this was current
    if (this.currentTask === taskName) {
      this.currentTask = null;
    }
  }
  
  failTask(taskName: string, error: string): void {
    if (this.tasks.has(taskName)) {
      const update = this.tasks.get(taskName)!;
      update.status = 'failed';
      update.message = error;
      update.timestamp = new Date();
      
      this.tasks.set(taskName, update);
      this.displayProgress(update);
      this.emit('task-fail', update);
    }
  }
  
  private displayProgress(update: ProgressUpdate): void {
    if (!this.isInteractive || !process.stdout.isTTY) {
      console.log(`[${update.task}] ${update.progress}% - ${update.message || ''}`);
      return;
    }
    
    // Clear previous line
    if (process.stdout.clearLine && process.stdout.cursorTo) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
    }
    
    // Create progress bar
    const barLength = 30;
    const filled = Math.floor((update.progress / 100) * barLength);
    const empty = barLength - filled;
    
    this.progressBar = `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
    
    // Build status line
    const statusIcons: Record<string, string> = {
      'pending': '⏳',
      'in-progress': '⚡',
      'completed': '✅',
      'failed': '❌',
      'interrupted': '⚠️'
    };
    
    const icon = statusIcons[update.status] || '📝';
    const percentage = `${update.progress.toFixed(0)}%`.padStart(4);
    const taskName = update.task.padEnd(30);
    const subtask = update.subtask ? ` → ${update.subtask}` : '';
    const message = update.message ? ` | ${update.message}` : '';
    
    const output = `${icon} ${taskName}${subtask} ${this.progressBar} ${percentage}${message}`;
    
    process.stdout.write(output);
    
    // Add to log buffer for later review
    this.logBuffer.push(`[${update.timestamp.toISOString()}] ${output}`);
  }
  
  displaySummary(): void {
    console.log('\n\n' + '═'.repeat(60));
    console.log('📊 Documentation Generation Summary');
    console.log('═'.repeat(60));
    
    const completed = Array.from(this.tasks.values()).filter(t => t.status === 'completed');
    const failed = Array.from(this.tasks.values()).filter(t => t.status === 'failed');
    const interrupted = Array.from(this.tasks.values()).filter(t => t.status === 'interrupted');
    
    console.log(`\n✅ Completed: ${completed.length}`);
    completed.forEach(task => {
      console.log(`   • ${task.task}`);
    });
    
    if (failed.length > 0) {
      console.log(`\n❌ Failed: ${failed.length}`);
      failed.forEach(task => {
        console.log(`   • ${task.task}: ${task.message}`);
      });
    }
    
    if (interrupted.length > 0) {
      console.log(`\n⚠️ Interrupted: ${interrupted.length}`);
      interrupted.forEach(task => {
        console.log(`   • ${task.task} (${task.progress}% complete)`);
      });
    }
    
    const duration = Date.now() - this.startTime.getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    
    console.log(`\n⏱️ Total time: ${minutes}m ${seconds}s`);
    console.log('═'.repeat(60) + '\n');
  }
  
  getProgress(): any {
    return {
      tasks: Array.from(this.tasks.entries()).map(([name, update]) => ({
        name,
        ...update
      })),
      currentTask: this.currentTask,
      startTime: this.startTime,
      interrupted: this.interrupted,
      logs: this.logBuffer
    };
  }
  
  async restoreProgress(savedProgress: any): Promise<void> {
    if (savedProgress.tasks) {
      savedProgress.tasks.forEach((task: any) => {
        this.tasks.set(task.name, {
          task: task.task,
          subtask: task.subtask,
          progress: task.progress,
          status: task.status === 'in-progress' ? 'pending' : task.status,
          message: task.message,
          timestamp: new Date(task.timestamp)
        });
      });
    }
    
    console.log(`📥 Restored ${this.tasks.size} tasks from saved progress`);
  }
  
  cleanup(): void {
    if (this.rl) {
      this.rl.close();
    }
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.removeAllListeners('data');
  }
  
  isInterrupted(): boolean {
    return this.interrupted;
  }
}