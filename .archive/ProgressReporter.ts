import { CLIInterface } from './CLIInterface';
import { EventEmitter } from 'events';

export interface TaskProgress {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total: number;
  startTime?: Date;
  endTime?: Date;
  subtasks?: TaskProgress[];
  message?: string;
  details?: string[];
}

export class ProgressReporter extends EventEmitter {
  private cli: CLIInterface;
  private tasks: Map<string, TaskProgress> = new Map();
  private currentTask: string | null = null;
  private startTime: Date;
  
  constructor(cli: CLIInterface) {
    super();
    this.cli = cli;
    this.startTime = new Date();
  }
  
  // Register a new task
  registerTask(id: string, name: string, total: number = 100): void {
    const task: TaskProgress = {
      id,
      name,
      status: 'pending',
      progress: 0,
      total,
      startTime: undefined,
      subtasks: []
    };
    
    this.tasks.set(id, task);
    this.cli.log(`Task registered: ${name}`, 'debug');
  }
  
  // Start a task
  startTask(id: string, message?: string): void {
    const task = this.tasks.get(id);
    if (!task) {
      this.cli.log(`Unknown task: ${id}`, 'warning');
      return;
    }
    
    task.status = 'running';
    task.startTime = new Date();
    task.message = message;
    this.currentTask = id;
    
    this.cli.createProgressBar(id, task.name, task.total);
    this.cli.log(`Started: ${task.name}`, 'info');
    
    this.emit('taskStart', task);
  }
  
  // Update task progress with granular details
  updateTask(id: string, progress: number, message?: string, details?: string[]): void {
    const task = this.tasks.get(id);
    if (!task) {
      return;
    }
    
    task.progress = Math.min(progress, task.total);
    task.message = message;
    task.details = details;
    
    this.cli.updateProgressBar(id, task.progress, message);
    
    // Log details in verbose mode
    if (details && details.length > 0) {
      details.forEach(detail => {
        this.cli.log(`  ${detail}`, 'debug');
      });
    }
    
    this.emit('taskProgress', task);
  }
  
  // Add subtask for granular tracking
  addSubtask(parentId: string, subtaskId: string, name: string, total: number = 100): void {
    const parent = this.tasks.get(parentId);
    if (!parent) {
      return;
    }
    
    const subtask: TaskProgress = {
      id: subtaskId,
      name,
      status: 'pending',
      progress: 0,
      total,
      subtasks: []
    };
    
    parent.subtasks?.push(subtask);
    this.cli.log(`  → ${name}`, 'debug');
  }
  
  // Update subtask progress
  updateSubtask(parentId: string, subtaskId: string, progress: number, message?: string): void {
    const parent = this.tasks.get(parentId);
    if (!parent || !parent.subtasks) {
      return;
    }
    
    const subtask = parent.subtasks.find(s => s.id === subtaskId);
    if (subtask) {
      subtask.progress = Math.min(progress, subtask.total);
      subtask.message = message;
      
      // Calculate parent progress based on subtasks
      const totalSubProgress = parent.subtasks.reduce((sum, s) => sum + (s.progress / s.total), 0);
      const avgProgress = (totalSubProgress / parent.subtasks.length) * parent.total;
      
      this.updateTask(parentId, avgProgress, `${subtask.name}: ${message || ''}`);
    }
  }
  
  // Complete a task
  completeTask(id: string, message?: string): void {
    const task = this.tasks.get(id);
    if (!task) {
      return;
    }
    
    task.status = 'completed';
    task.progress = task.total;
    task.endTime = new Date();
    task.message = message || 'Completed';
    
    this.cli.completeProgressBar(id, task.message);
    this.cli.log(`Completed: ${task.name}`, 'success');
    
    this.emit('taskComplete', task);
    
    // Auto-start next pending task
    this.startNextTask();
  }
  
  // Fail a task
  failTask(id: string, error: string, details?: string[]): void {
    const task = this.tasks.get(id);
    if (!task) {
      return;
    }
    
    task.status = 'failed';
    task.endTime = new Date();
    task.message = error;
    task.details = details;
    
    this.cli.completeProgressBar(id, `Failed: ${error}`);
    this.cli.showError(error, details);
    
    this.emit('taskFailed', task);
  }
  
  // Start next pending task
  private startNextTask(): void {
    const nextTask = Array.from(this.tasks.values()).find(t => t.status === 'pending');
    if (nextTask) {
      this.startTask(nextTask.id);
    }
  }
  
  // Get overall progress
  getOverallProgress(): { completed: number; total: number; percentage: number } {
    const tasks = Array.from(this.tasks.values());
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { completed, total, percentage };
  }
  
  // Generate summary report
  generateSummary(): void {
    const tasks = Array.from(this.tasks.values());
    const successful = tasks.filter(t => t.status === 'completed');
    const failed = tasks.filter(t => t.status === 'failed');
    const duration = new Date().getTime() - this.startTime.getTime();
    const durationStr = this.formatDuration(duration);
    
    this.cli.showSummary({
      title: 'Documentation Generation Summary',
      stats: {
        'Total Tasks': tasks.length,
        'Successful': successful.length,
        'Failed': failed.length,
        'Duration': durationStr
      },
      items: tasks.map(t => ({
        label: t.name,
        value: t.message || t.status,
        status: t.status === 'completed' ? 'success' : 
                t.status === 'failed' ? 'error' : 
                'warning'
      })),
      footer: `Generated at ${new Date().toLocaleString()}`
    });
  }
  
  // Format duration
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
  
  // Cleanup
  cleanup(): void {
    this.cli.cleanup();
    this.removeAllListeners();
  }
}