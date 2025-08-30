/**
 * Unified Phase and Task Management System
 * Provides consistent progress tracking across all DocumentorAgent commands
 */

import { EventEmitter } from 'events';
import { TUIAdapter } from './TUIAdapter';

// Operation types that can be performed
export enum OperationType {
  READ = 'Read',
  WRITE = 'Write',
  EDIT = 'Edit',
  CREATE = 'Create',
  UPDATE = 'Update',
  DELETE = 'Delete',
  SEARCH = 'Search',
  SCAN = 'Scan',
  ANALYZE = 'Analyze',
  VERIFY = 'Verify',
  EXECUTE = 'Execute',
  COMPILE = 'Compile',
  VALIDATE = 'Validate',
  GENERATE = 'Generate',
  FORMAT = 'Format',
  OPTIMIZE = 'Optimize',
  CLEAN = 'Clean',
  BACKUP = 'Backup',
  RESTORE = 'Restore',
  INDEX = 'Index',
  LINK = 'Link',
  TAG = 'Tag',
  QUERY = 'Query'
}

// Standard phases used across commands
export enum PhaseType {
  // Universal phases
  INITIALIZATION = 'initialization',
  VALIDATION = 'validation',
  ANALYSIS = 'analysis',
  
  // Documentation phases
  PREPARATION = 'preparation',
  GENERATION = 'generation',
  ENHANCEMENT = 'enhancement',
  FORMATTING = 'formatting',
  INTEGRATION = 'integration',
  
  // Monitoring phases
  MONITORING_SETUP = 'monitoring_setup',
  REPOSITORY_SCAN = 'repository_scan',
  CHANGE_DETECTION = 'change_detection',
  UPDATE_GENERATION = 'update_generation',
  
  // Finalization
  FINALIZATION = 'finalization',
  CLEANUP = 'cleanup'
}

export interface Task {
  id: string;
  name: string;
  phaseId: string;
  progress: number; // 0-100
  status: 'pending' | 'active' | 'completed' | 'failed' | 'skipped';
  operation?: OperationType;
  target?: string; // File or resource being operated on
  details?: string;
  startTime?: Date;
  endTime?: Date;
  error?: string;
  weight: number; // Weight within phase (0-100)
}

export interface Phase {
  id: string;
  type: PhaseType;
  order: number;
  name: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'skipped';
  progress: number; // 0-100
  weight: number; // Weight of phase in overall process (0-100)
  tasks: Map<string, Task>;
  startTime?: Date;
  endTime?: Date;
  error?: string;
}

export interface PhaseConfig {
  type: PhaseType;
  name: string;
  description: string;
  weight: number;
  tasks: {
    id: string;
    name: string;
    weight: number;
  }[];
}

export interface OperationStatus {
  type: OperationType;
  target: string;
  progress?: number;
  message?: string;
}

export class PhaseManager extends EventEmitter {
  private phases: Map<string, Phase> = new Map();
  private currentPhase: Phase | null = null;
  private currentTask: Task | null = null;
  private currentOperation: OperationStatus | null = null;
  private ui: TUIAdapter;
  private command: string;
  private totalPhases: number = 0;
  private completedPhases: number = 0;
  private overallProgress: number = 0;

  constructor(ui: TUIAdapter, command: string) {
    super();
    this.ui = ui;
    this.command = command;
    this.initializePhases();
  }

  /**
   * Initialize phases based on command type
   */
  private initializePhases() {
    const phaseConfigs = this.getPhaseConfigForCommand(this.command);
    let order = 1;

    for (const config of phaseConfigs) {
      const phase: Phase = {
        id: config.type,
        type: config.type,
        order: order++,
        name: config.name,
        description: config.description,
        status: 'pending',
        progress: 0,
        weight: config.weight,
        tasks: new Map()
      };

      // Initialize tasks for this phase
      for (const taskConfig of config.tasks) {
        const task: Task = {
          id: taskConfig.id,
          name: taskConfig.name,
          phaseId: phase.id,
          progress: 0,
          status: 'pending',
          weight: taskConfig.weight
        };
        phase.tasks.set(task.id, task);
      }

      this.phases.set(phase.id, phase);
    }

    this.totalPhases = this.phases.size;
  }

  /**
   * Get phase configuration for a specific command
   */
  private getPhaseConfigForCommand(command: string): PhaseConfig[] {
    switch (command) {
      case 'generate':
      case 'self-document':
      case 'full-monty':
        return this.getDocumentationPhases();
      
      case 'monitor':
        return this.getMonitoringPhases();
      
      case 'verify':
        return this.getVerificationPhases();
      
      case 'analyze':
        return this.getAnalysisPhases();
      
      case 'config':
        return this.getConfigPhases();
      
      case 'tags':
        return this.getTagPhases();
      
      default:
        return this.getDefaultPhases();
    }
  }

  private getDocumentationPhases(): PhaseConfig[] {
    return [
      {
        type: PhaseType.INITIALIZATION,
        name: 'Initialization',
        description: 'Setting up environment and loading configuration',
        weight: 5,
        tasks: [
          { id: 'load-config', name: 'Loading configuration', weight: 25 },
          { id: 'check-lock', name: 'Checking lock file', weight: 25 },
          { id: 'validate-env', name: 'Validating environment', weight: 25 },
          { id: 'setup-ui', name: 'Setting up UI', weight: 25 }
        ]
      },
      {
        type: PhaseType.VALIDATION,
        name: 'Validation',
        description: 'Validating paths and permissions',
        weight: 5,
        tasks: [
          { id: 'safety-check', name: 'Running safety checks', weight: 30 },
          { id: 'path-validation', name: 'Validating paths', weight: 30 },
          { id: 'permission-check', name: 'Checking permissions', weight: 20 },
          { id: 'backup-check', name: 'Creating backups', weight: 20 }
        ]
      },
      {
        type: PhaseType.ANALYSIS,
        name: 'Analysis',
        description: 'Analyzing project structure and code',
        weight: 15,
        tasks: [
          { id: 'scan-structure', name: 'Scanning directory structure', weight: 20 },
          { id: 'detect-type', name: 'Detecting project type', weight: 20 },
          { id: 'analyze-patterns', name: 'Analyzing code patterns', weight: 20 },
          { id: 'identify-components', name: 'Identifying components', weight: 20 },
          { id: 'generate-metadata', name: 'Generating metadata', weight: 20 }
        ]
      },
      {
        type: PhaseType.PREPARATION,
        name: 'Preparation',
        description: 'Preparing tags and templates',
        weight: 10,
        tasks: [
          { id: 'load-tags', name: 'Loading existing tags', weight: 30 },
          { id: 'scan-vault', name: 'Scanning Obsidian vault', weight: 30 },
          { id: 'prepare-templates', name: 'Preparing templates', weight: 20 },
          { id: 'setup-workspace', name: 'Setting up workspace', weight: 20 }
        ]
      },
      {
        type: PhaseType.GENERATION,
        name: 'Document Generation',
        description: 'Generating documentation files',
        weight: 35,
        tasks: [
          { id: 'gen-readme', name: 'Generating README.md', weight: 15 },
          { id: 'gen-overview', name: 'Generating project overview', weight: 10 },
          { id: 'gen-api', name: 'Generating API documentation', weight: 20 },
          { id: 'gen-components', name: 'Documenting components', weight: 25 },
          { id: 'gen-examples', name: 'Creating usage examples', weight: 10 },
          { id: 'gen-guides', name: 'Creating guides', weight: 10 },
          { id: 'gen-changelog', name: 'Generating changelog', weight: 5 },
          { id: 'gen-license', name: 'Processing license', weight: 5 }
        ]
      },
      {
        type: PhaseType.ENHANCEMENT,
        name: 'Enhancement',
        description: 'Enhancing documentation quality',
        weight: 10,
        tasks: [
          { id: 'verify-code', name: 'Verifying code examples', weight: 30 },
          { id: 'add-links', name: 'Adding cross-references', weight: 25 },
          { id: 'gen-diagrams', name: 'Generating diagrams', weight: 25 },
          { id: 'optimize-content', name: 'Optimizing content', weight: 20 }
        ]
      },
      {
        type: PhaseType.FORMATTING,
        name: 'Formatting',
        description: 'Applying formatting and frontmatter',
        weight: 10,
        tasks: [
          { id: 'apply-frontmatter', name: 'Adding frontmatter', weight: 25 },
          { id: 'format-markdown', name: 'Formatting markdown', weight: 25 },
          { id: 'clean-content', name: 'Cleaning content', weight: 25 },
          { id: 'validate-syntax', name: 'Validating syntax', weight: 25 }
        ]
      },
      {
        type: PhaseType.INTEGRATION,
        name: 'Integration',
        description: 'Integrating with Obsidian vault',
        weight: 5,
        tasks: [
          { id: 'consolidate-tags', name: 'Consolidating tags', weight: 30 },
          { id: 'build-indexes', name: 'Building indexes', weight: 30 },
          { id: 'create-links', name: 'Creating Obsidian links', weight: 20 },
          { id: 'gen-toc', name: 'Generating table of contents', weight: 20 }
        ]
      },
      {
        type: PhaseType.FINALIZATION,
        name: 'Finalization',
        description: 'Saving documents and generating reports',
        weight: 5,
        tasks: [
          { id: 'save-docs', name: 'Saving documents to vault', weight: 40 },
          { id: 'gen-report', name: 'Generating quality report', weight: 30 },
          { id: 'update-registry', name: 'Updating tag registry', weight: 20 },
          { id: 'cleanup', name: 'Cleaning up', weight: 10 }
        ]
      }
    ];
  }

  private getMonitoringPhases(): PhaseConfig[] {
    return [
      {
        type: PhaseType.INITIALIZATION,
        name: 'Initialization',
        description: 'Setting up monitoring environment',
        weight: 10,
        tasks: [
          { id: 'load-config', name: 'Loading configuration', weight: 50 },
          { id: 'setup-github', name: 'Setting up GitHub client', weight: 50 }
        ]
      },
      {
        type: PhaseType.MONITORING_SETUP,
        name: 'Monitoring Setup',
        description: 'Configuring repositories to monitor',
        weight: 20,
        tasks: [
          { id: 'load-repos', name: 'Loading repository list', weight: 40 },
          { id: 'setup-webhooks', name: 'Setting up webhooks', weight: 30 },
          { id: 'config-interval', name: 'Configuring check interval', weight: 30 }
        ]
      },
      {
        type: PhaseType.REPOSITORY_SCAN,
        name: 'Repository Scan',
        description: 'Scanning repositories for changes',
        weight: 40,
        tasks: [
          { id: 'fetch-commits', name: 'Fetching recent commits', weight: 40 },
          { id: 'scan-changes', name: 'Scanning for changes', weight: 30 },
          { id: 'detect-updates', name: 'Detecting updates', weight: 30 }
        ]
      },
      {
        type: PhaseType.UPDATE_GENERATION,
        name: 'Update Generation',
        description: 'Generating documentation updates',
        weight: 25,
        tasks: [
          { id: 'gen-updates', name: 'Generating update docs', weight: 50 },
          { id: 'create-changelog', name: 'Creating changelogs', weight: 50 }
        ]
      },
      {
        type: PhaseType.FINALIZATION,
        name: 'Finalization',
        description: 'Saving state and scheduling',
        weight: 5,
        tasks: [
          { id: 'save-state', name: 'Saving monitor state', weight: 50 },
          { id: 'schedule-next', name: 'Scheduling next check', weight: 50 }
        ]
      }
    ];
  }

  private getVerificationPhases(): PhaseConfig[] {
    return [
      {
        type: PhaseType.INITIALIZATION,
        name: 'Initialization',
        description: 'Loading project for verification',
        weight: 20,
        tasks: [
          { id: 'load-project', name: 'Loading project', weight: 100 }
        ]
      },
      {
        type: PhaseType.ANALYSIS,
        name: 'Code Analysis',
        description: 'Analyzing code for verification',
        weight: 40,
        tasks: [
          { id: 'scan-code', name: 'Scanning code', weight: 50 },
          { id: 'identify-tests', name: 'Identifying test cases', weight: 50 }
        ]
      },
      {
        type: PhaseType.VALIDATION,
        name: 'Verification',
        description: 'Running verification tests',
        weight: 30,
        tasks: [
          { id: 'run-tests', name: 'Running tests', weight: 50 },
          { id: 'check-functionality', name: 'Checking functionality', weight: 50 }
        ]
      },
      {
        type: PhaseType.FINALIZATION,
        name: 'Report Generation',
        description: 'Generating verification report',
        weight: 10,
        tasks: [
          { id: 'gen-report', name: 'Generating report', weight: 100 }
        ]
      }
    ];
  }

  private getAnalysisPhases(): PhaseConfig[] {
    return [
      {
        type: PhaseType.INITIALIZATION,
        name: 'Initialization',
        description: 'Preparing for analysis',
        weight: 25,
        tasks: [
          { id: 'load-project', name: 'Loading project', weight: 100 }
        ]
      },
      {
        type: PhaseType.ANALYSIS,
        name: 'Deep Analysis',
        description: 'Performing deep code analysis',
        weight: 50,
        tasks: [
          { id: 'deep-scan', name: 'Deep scanning', weight: 50 },
          { id: 'pattern-analysis', name: 'Analyzing patterns', weight: 50 }
        ]
      },
      {
        type: PhaseType.FINALIZATION,
        name: 'Analysis Report',
        description: 'Generating analysis results',
        weight: 25,
        tasks: [
          { id: 'gen-analysis', name: 'Generating analysis', weight: 100 }
        ]
      }
    ];
  }

  private getConfigPhases(): PhaseConfig[] {
    return [
      {
        type: PhaseType.INITIALIZATION,
        name: 'Loading Configuration',
        description: 'Loading current configuration',
        weight: 33,
        tasks: [
          { id: 'load-config', name: 'Loading config', weight: 100 }
        ]
      },
      {
        type: PhaseType.VALIDATION,
        name: 'Validation',
        description: 'Validating configuration changes',
        weight: 34,
        tasks: [
          { id: 'validate-changes', name: 'Validating changes', weight: 50 },
          { id: 'check-paths', name: 'Checking paths', weight: 50 }
        ]
      },
      {
        type: PhaseType.FINALIZATION,
        name: 'Saving Configuration',
        description: 'Applying configuration changes',
        weight: 33,
        tasks: [
          { id: 'save-config', name: 'Saving configuration', weight: 100 }
        ]
      }
    ];
  }

  private getTagPhases(): PhaseConfig[] {
    return [
      {
        type: PhaseType.INITIALIZATION,
        name: 'Loading Vault',
        description: 'Loading Obsidian vault',
        weight: 25,
        tasks: [
          { id: 'load-vault', name: 'Loading vault', weight: 100 }
        ]
      },
      {
        type: PhaseType.ANALYSIS,
        name: 'Tag Analysis',
        description: 'Analyzing tag structure',
        weight: 50,
        tasks: [
          { id: 'scan-tags', name: 'Scanning tags', weight: 50 },
          { id: 'build-hierarchy', name: 'Building hierarchy', weight: 50 }
        ]
      },
      {
        type: PhaseType.FINALIZATION,
        name: 'Saving Registry',
        description: 'Saving tag registry',
        weight: 25,
        tasks: [
          { id: 'save-registry', name: 'Saving registry', weight: 100 }
        ]
      }
    ];
  }

  private getDefaultPhases(): PhaseConfig[] {
    return [
      {
        type: PhaseType.INITIALIZATION,
        name: 'Initialization',
        description: 'Starting process',
        weight: 50,
        tasks: [
          { id: 'init', name: 'Initializing', weight: 100 }
        ]
      },
      {
        type: PhaseType.FINALIZATION,
        name: 'Completion',
        description: 'Completing process',
        weight: 50,
        tasks: [
          { id: 'complete', name: 'Completing', weight: 100 }
        ]
      }
    ];
  }

  /**
   * Start a phase
   */
  startPhase(phaseType: PhaseType): void {
    const phase = this.phases.get(phaseType);
    if (!phase) {
      console.error(`Phase ${phaseType} not found`);
      return;
    }

    // Complete previous phase if any
    if (this.currentPhase && this.currentPhase.status === 'active') {
      this.completePhase(this.currentPhase.type);
    }

    phase.status = 'active';
    phase.startTime = new Date();
    this.currentPhase = phase;

    // Report to UI
    this.ui.setPhase(phase.name, phase.order, this.totalPhases);
    this.updateOverallProgress();
    
    this.emit('phase:start', phase);
  }

  /**
   * Start a task within current phase
   */
  startTask(taskId: string): void {
    if (!this.currentPhase) {
      console.error('No active phase');
      return;
    }

    const task = this.currentPhase.tasks.get(taskId);
    if (!task) {
      console.error(`Task ${taskId} not found in phase ${this.currentPhase.id}`);
      return;
    }

    // Complete previous task if any
    if (this.currentTask && this.currentTask.status === 'active') {
      this.completeTask(this.currentTask.id);
    }

    task.status = 'active';
    task.startTime = new Date();
    this.currentTask = task;

    // Report to UI
    this.ui.updateTask(
      `${this.currentPhase.id}-${taskId}`,
      0,
      task.name
    );

    this.emit('task:start', task);
  }

  /**
   * Report an operation being performed
   */
  reportOperation(
    type: OperationType,
    target: string,
    progress?: number,
    message?: string
  ): void {
    this.currentOperation = {
      type,
      target,
      progress,
      message
    };

    // Update current task if exists
    if (this.currentTask) {
      this.currentTask.operation = type;
      this.currentTask.target = target;
      this.currentTask.details = message;
      
      if (progress !== undefined) {
        this.currentTask.progress = progress;
        this.updatePhaseProgress();
      }
    }

    // Report to UI based on operation type
    const statusMessage = this.formatOperationStatus(type, target, message);
    this.ui.streamFile(type, target);
    
    if (this.currentTask) {
      this.ui.updateTask(
        `${this.currentPhase?.id}-${this.currentTask.id}`,
        this.currentTask.progress,
        statusMessage,
        target
      );
    }

    this.emit('operation', this.currentOperation);
  }

  /**
   * Report document-specific operations
   */
  reportDocumentOperation(
    operation: 'creating' | 'writing' | 'editing' | 'updating',
    filename: string,
    progress?: number
  ): void {
    let opType: OperationType;
    switch (operation) {
      case 'creating':
        opType = OperationType.CREATE;
        break;
      case 'writing':
        opType = OperationType.WRITE;
        break;
      case 'editing':
        opType = OperationType.EDIT;
        break;
      case 'updating':
        opType = OperationType.UPDATE;
        break;
    }

    const message = `${operation.charAt(0).toUpperCase() + operation.slice(1)} ${filename}`;
    this.reportOperation(opType, filename, progress, message);
  }

  /**
   * Update task progress
   */
  updateTaskProgress(taskId: string, progress: number, details?: string): void {
    if (!this.currentPhase) return;

    const task = this.currentPhase.tasks.get(taskId);
    if (!task) return;

    task.progress = Math.min(100, Math.max(0, progress));
    if (details) {
      task.details = details;
    }

    // Update phase progress based on task weights
    this.updatePhaseProgress();
    
    // Report to UI
    this.ui.updateTask(
      `${this.currentPhase.id}-${taskId}`,
      task.progress,
      task.name,
      details
    );

    this.emit('task:progress', task);
  }

  /**
   * Complete a task
   */
  completeTask(taskId: string, success: boolean = true): void {
    if (!this.currentPhase) return;

    const task = this.currentPhase.tasks.get(taskId);
    if (!task) return;

    task.status = success ? 'completed' : 'failed';
    task.progress = success ? 100 : task.progress;
    task.endTime = new Date();

    // Update phase progress
    this.updatePhaseProgress();

    // Report to UI
    this.ui.completeTask(
      `${this.currentPhase.id}-${taskId}`,
      success
    );

    this.emit('task:complete', task);

    // Clear current task if it's the one being completed
    if (this.currentTask?.id === taskId) {
      this.currentTask = null;
    }
  }

  /**
   * Complete a phase
   */
  completePhase(phaseType: PhaseType, success: boolean = true): void {
    const phase = this.phases.get(phaseType);
    if (!phase) return;

    phase.status = success ? 'completed' : 'failed';
    phase.progress = success ? 100 : phase.progress;
    phase.endTime = new Date();

    if (success) {
      this.completedPhases++;
    }

    this.updateOverallProgress();
    this.emit('phase:complete', phase);

    // Clear current phase if it's the one being completed
    if (this.currentPhase?.id === phaseType) {
      this.currentPhase = null;
      this.currentTask = null;
    }
  }

  /**
   * Update phase progress based on task completion
   */
  private updatePhaseProgress(): void {
    if (!this.currentPhase) return;

    let totalWeight = 0;
    let completedWeight = 0;

    for (const task of this.currentPhase.tasks.values()) {
      totalWeight += task.weight;
      completedWeight += (task.progress / 100) * task.weight;
    }

    this.currentPhase.progress = totalWeight > 0 
      ? Math.round((completedWeight / totalWeight) * 100)
      : 0;

    this.updateOverallProgress();
  }

  /**
   * Update overall progress
   */
  private updateOverallProgress(): void {
    let totalWeight = 0;
    let completedWeight = 0;

    for (const phase of this.phases.values()) {
      totalWeight += phase.weight;
      completedWeight += (phase.progress / 100) * phase.weight;
    }

    this.overallProgress = totalWeight > 0 
      ? Math.round((completedWeight / totalWeight) * 100)
      : 0;

    // Update lock file with progress
    this.emit('progress', {
      overall: this.overallProgress,
      phase: this.currentPhase?.name,
      task: this.currentTask?.name,
      operation: this.currentOperation
    });
  }

  /**
   * Format operation status for display
   */
  private formatOperationStatus(
    type: OperationType,
    target: string,
    message?: string
  ): string {
    if (message) return message;

    const icons: { [key in OperationType]: string } = {
      [OperationType.READ]: '📖',
      [OperationType.WRITE]: '📝',
      [OperationType.EDIT]: '✏️',
      [OperationType.CREATE]: '➕',
      [OperationType.UPDATE]: '🔄',
      [OperationType.DELETE]: '🗑️',
      [OperationType.SEARCH]: '🔍',
      [OperationType.SCAN]: '📁',
      [OperationType.ANALYZE]: '🔬',
      [OperationType.VERIFY]: '✅',
      [OperationType.EXECUTE]: '⚡',
      [OperationType.COMPILE]: '🔨',
      [OperationType.VALIDATE]: '✔️',
      [OperationType.GENERATE]: '🏗️',
      [OperationType.FORMAT]: '📐',
      [OperationType.OPTIMIZE]: '⚙️',
      [OperationType.CLEAN]: '🧹',
      [OperationType.BACKUP]: '💾',
      [OperationType.RESTORE]: '♻️',
      [OperationType.INDEX]: '📑',
      [OperationType.LINK]: '🔗',
      [OperationType.TAG]: '🏷️',
      [OperationType.QUERY]: '❓'
    };

    return `${icons[type]} ${type}: ${target}`;
  }

  /**
   * Get current status summary
   */
  getStatus(): {
    command: string;
    phase: string | null;
    task: string | null;
    operation: OperationStatus | null;
    progress: number;
    phases: number;
    completedPhases: number;
  } {
    return {
      command: this.command,
      phase: this.currentPhase?.name || null,
      task: this.currentTask?.name || null,
      operation: this.currentOperation,
      progress: this.overallProgress,
      phases: this.totalPhases,
      completedPhases: this.completedPhases
    };
  }

  /**
   * Handle errors
   */
  reportError(error: string, fatal: boolean = false): void {
    if (this.currentTask) {
      this.currentTask.error = error;
      this.completeTask(this.currentTask.id, false);
    }

    if (this.currentPhase) {
      this.currentPhase.error = error;
      if (fatal) {
        this.completePhase(this.currentPhase.type, false);
      }
    }

    this.ui.logError('Error', error);
    this.emit('error', { error, fatal });
  }
}

// Export singleton for easy access
let phaseManagerInstance: PhaseManager | null = null;

export function initializePhaseManager(ui: TUIAdapter, command: string): PhaseManager {
  phaseManagerInstance = new PhaseManager(ui, command);
  return phaseManagerInstance;
}

export function getPhaseManager(): PhaseManager | null {
  return phaseManagerInstance;
}