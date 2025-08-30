/**
 * TUI Adapter for Go TUI Integration
 * Sends JSON messages to stdout for the Go TUI to consume
 */

import { EventEmitter } from 'events';

export interface TUIMessage {
  type: string;
  [key: string]: any;
}

export class TUIAdapter extends EventEmitter {
  private projectPath: string = '';
  private currentPhase: string = '';
  private phaseIndex: number = 0;
  private totalPhases: number = 7;
  private filesProcessed: number = 0;
  private totalFiles: number = 0;
  private currentFile: string = '';
  private tasks: Map<string, any> = new Map();

  constructor() {
    super();
  }

  private send(message: TUIMessage) {
    // Send JSON message to stdout for Go TUI
    console.log(JSON.stringify(message));
  }

  start() {
    this.send({
      type: 'log',
      level: 'info',
      content: 'Documentation generation started'
    });
  }

  stop() {
    this.send({
      type: 'log',
      level: 'info',
      content: 'Documentation generation stopped'
    });
  }

  displayTitle(projectName: string) {
    this.projectPath = projectName;
    this.send({
      type: 'project',
      projectPath: projectName
    });
  }

  updatePhase(phaseName: string, subPhase?: string) {
    this.currentPhase = phaseName;
    this.phaseIndex++;
    this.send({
      type: 'phase',
      phase: {
        current: this.phaseIndex,
        total: this.totalPhases,
        name: phaseName,
        subPhase: subPhase
      }
    });
  }

  createTask(id: string, name: string, total: number) {
    this.tasks.set(id, { name, progress: 0, total });
    this.send({
      type: 'log',
      level: 'info',
      content: `Task: ${name}`
    });
  }

  updateTask(id: string, progress: number, status?: string) {
    const task = this.tasks.get(id);
    if (task) {
      task.progress = progress;
      if (status) {
        this.send({
          type: 'log',
          level: 'info',
          content: status
        });
      }
    }
  }

  completeTask(id: string, success: boolean) {
    const task = this.tasks.get(id);
    if (task) {
      this.send({
        type: 'log',
        level: success ? 'success' : 'error',
        content: `${task.name}: ${success ? 'completed' : 'failed'}`
      });
      this.tasks.delete(id);
    }
  }

  streamFile(action: string, fileName: string) {
    this.currentFile = fileName;
    this.filesProcessed++;
    this.send({
      type: 'file',
      files: {
        processed: this.filesProcessed,
        total: this.totalFiles || 100,
        current: fileName
      }
    });
    this.send({
      type: 'tool',
      tool: action,
      content: fileName
    });
  }

  logInfo(title: string, message?: string) {
    this.send({
      type: 'log',
      level: 'info',
      content: message ? `${title}: ${message}` : title
    });
  }

  logWarning(title: string, message?: string) {
    this.send({
      type: 'log',
      level: 'warning',
      content: message ? `${title}: ${message}` : title
    });
  }

  logError(title: string, message?: string) {
    this.send({
      type: 'log',
      level: 'error',
      content: message ? `${title}: ${message}` : title
    });
  }

  logSuccess(title: string, message?: string) {
    this.send({
      type: 'log',
      level: 'success',
      content: message ? `${title}: ${message}` : title
    });
  }

  displayMemory(mb: number) {
    this.send({
      type: 'memory',
      data: mb
    });
  }

  displayDebug(content: string) {
    this.send({
      type: 'debug',
      content: content
    });
  }

  displayRaw(content: string) {
    this.send({
      type: 'raw',
      content: content
    });
  }

  displayStats(stats: any) {
    // Convert stats to log messages
    if (stats.filesAnalyzed !== undefined) {
      this.totalFiles = stats.filesAnalyzed;
    }
    this.send({
      type: 'log',
      level: 'info',
      content: `Stats: ${JSON.stringify(stats)}`
    });
  }

  renderClaudeResponse(response: string) {
    this.send({
      type: 'raw',
      content: response
    });
  }

  requestPassword(prompt: string, context?: string): Promise<string> {
    const requestId = `pwd-${Date.now()}`;
    this.send({
      type: 'password_request',
      requestId: requestId,
      prompt: prompt,
      context: context
    });
    
    // For now, return empty string - will need to implement proper IPC
    // in the future to receive password response from Go TUI
    return Promise.resolve('');
  }

  // Compatibility methods for minimal disruption
  addToolCall(tool: string, content: string) {
    this.streamFile(tool, content);
  }

  updateInfo(info: any) {
    if (info.lockInfo) {
      this.send({
        type: 'lockInfo',
        lockInfo: info.lockInfo
      });
    }
  }

  pause() {
    // No-op for now
  }

  resume() {
    // No-op for now
  }
}

// Export a singleton instance for compatibility
export const tuiAdapter = new TUIAdapter();