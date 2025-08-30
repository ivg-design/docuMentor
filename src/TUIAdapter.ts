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

  start(projectName?: string) {
    if (projectName) {
      this.displayTitle(projectName);
    }
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

  updateTask(id: string, progress: number, status?: string, detail?: string) {
    const task = this.tasks.get(id);
    if (task) {
      task.progress = progress;
      if (status) {
        const content = detail ? `${status} - ${detail}` : status;
        this.send({
          type: 'log',
          level: 'info',
          content: content
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

  streamFile(action: string, fileName: string, options?: any) {
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
    // Options like { size: number } are ignored for now
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

  logError(title: string, message?: string | any) {
    const msg = message ? 
      (typeof message === 'string' ? message : 
       message instanceof Error ? message.message :
       JSON.stringify(message)) : title;
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

  // Additional compatibility methods
  log(level: string, message: string | Error) {
    const content = typeof message === 'string' ? message : message.toString();
    this.send({
      type: 'log',
      level: level === 'info' ? 'info' : 
             level === 'warn' || level === 'warning' ? 'warning' :
             level === 'error' ? 'error' : 
             level === 'success' ? 'success' : 'info',
      content: content
    });
  }

  stream(message: string): void;
  stream(icon: string, message: string): void;
  stream(arg1: string, arg2?: string): void {
    const content = arg2 ? `${arg1} ${arg2}` : arg1;
    this.send({
      type: 'log',
      level: 'info',
      content: content
    });
  }

  streamAnalysis(title: string, analysis?: string): void {
    const content = analysis ? `${title}\n${analysis}` : title;
    this.send({
      type: 'raw',
      content: content
    });
  }

  debugEvent(event: any) {
    this.send({
      type: 'debug',
      content: typeof event === 'string' ? event : JSON.stringify(event)
    });
  }

  updateStatus(status: string, subStatus?: string): void {
    const content = subStatus ? `${status}: ${subStatus}` : status;
    this.send({
      type: 'log',
      level: 'info',
      content: content
    });
  }

  setPhase(phase: string | number, current?: number | string, total?: number | string): void {
    // Handle different call patterns
    if (typeof phase === 'number' && typeof current === 'number' && typeof total === 'string') {
      // Called as setPhase(1, 7, 'PhaseName')
      this.phaseIndex = phase;
      this.totalPhases = current;
      this.updatePhase(total);
    } else if (typeof phase === 'string' && typeof current === 'number' && typeof total === 'number') {
      // Called as setPhase('PhaseName', 1, 7)
      this.phaseIndex = current;
      this.totalPhases = total;
      this.updatePhase(phase);
    } else if (typeof phase === 'string') {
      // Called as setPhase('PhaseName')
      this.updatePhase(phase);
    }
  }

  setWorking(working: boolean) {
    if (working) {
      this.send({
        type: 'log',
        level: 'info',
        content: 'Working...'
      });
    }
  }

  addDiagnostic(title: string, diagnostic?: string | any, extra?: any): void {
    let content = title;
    if (diagnostic) {
      if (typeof diagnostic === 'string') {
        content = `${title}: ${diagnostic}`;
        if (extra) {
          content += ` - ${JSON.stringify(extra)}`;
        }
      } else {
        content = `${title}: ${JSON.stringify(diagnostic)}`;
      }
    }
    this.send({
      type: 'log',
      level: 'warning',
      content: content
    });
  }

  showSummary(summary: any) {
    this.send({
      type: 'log',
      level: 'success',
      content: JSON.stringify(summary, null, 2)
    });
  }

  updateDocumentProgress(current: number, total: number, name?: string): void {
    this.filesProcessed = current;
    this.totalFiles = total;
    if (name) {
      this.currentFile = name;
    }
    this.send({
      type: 'file',
      files: {
        processed: current,
        total: total,
        current: name || this.currentFile
      }
    });
  }
}

// Export a singleton instance for compatibility
export const tuiAdapter = new TUIAdapter();