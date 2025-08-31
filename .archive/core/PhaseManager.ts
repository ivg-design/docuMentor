/**
 * Unified Phase Manager with Integrated Progress Tracking
 * Single source of truth for phase execution and progress monitoring
 */

import { EventEmitter } from 'events'
import { tuiAdapter } from './TUIAdapter'
import { LockFileManager } from './LockFileManager'

/**
 * Phase definition with consistent IDs and names
 */
export interface Phase {
  id: number           // Phase number (1-9)
  name: string         // Display name
  description: string  // Phase description
  tasks: Task[]        // Tasks within this phase
}

export interface Task {
  id: string
  name: string
  description: string
}

export interface FileProgress {
  path: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'
  progress: number  // 0-100
  error?: string
}

export interface PhaseProgress {
  phaseId: number
  phaseName: string
  subPhase?: string
  filesProcessed: number
  filesTotal: number
  currentFile?: string
  taskProgress: Map<string, number>
  fileProgress: Map<string, FileProgress>
  startTime: Date
  endTime?: Date
}

/**
 * Unified Phase Manager
 */
export class PhaseManager extends EventEmitter {
  private static instance: PhaseManager
  
  // Define 9 phases with correct IDs and names
  private readonly phases: Phase[] = [
    {
      id: 1,
      name: 'Project Analysis',
      description: 'Analyze project structure and dependencies',
      tasks: [
        { id: 'scan', name: 'Scan Files', description: 'Scan project files' },
        { id: 'deps', name: 'Analyze Dependencies', description: 'Analyze dependencies' },
        { id: 'structure', name: 'Map Structure', description: 'Map project structure' }
      ]
    },
    {
      id: 2,
      name: 'Security Validation',
      description: 'Validate security and check for issues',
      tasks: [
        { id: 'scan-vulnerabilities', name: 'Scan Vulnerabilities', description: 'Check for security issues' },
        { id: 'validate-deps', name: 'Validate Dependencies', description: 'Check dependency security' }
      ]
    },
    {
      id: 3,
      name: 'Documentation Generation',
      description: 'Generate core documentation',
      tasks: [
        { id: 'readme', name: 'Generate README', description: 'Create README documentation' },
        { id: 'api', name: 'Generate API Docs', description: 'Create API documentation' },
        { id: 'technical', name: 'Generate Technical Docs', description: 'Create technical documentation' }
      ]
    },
    {
      id: 4,
      name: 'Enhancement',
      description: 'Enhance documentation with AI',
      tasks: [
        { id: 'claude-enhance', name: 'Claude Enhancement', description: 'Enhance with Claude AI' },
        { id: 'format', name: 'Format Documents', description: 'Format documentation' }
      ]
    },
    {
      id: 5,
      name: 'Obsidian Integration',
      description: 'Integrate with Obsidian',
      tasks: [
        { id: 'frontmatter', name: 'Add Frontmatter', description: 'Add Obsidian frontmatter' },
        { id: 'links', name: 'Create Links', description: 'Create wiki links' }
      ]
    },
    {
      id: 6,
      name: 'Tag Optimization',
      description: 'Optimize tags and metadata',
      tasks: [
        { id: 'generate-tags', name: 'Generate Tags', description: 'Generate relevant tags' },
        { id: 'optimize-tags', name: 'Optimize Tags', description: 'Optimize tag structure' }
      ]
    },
    {
      id: 7,
      name: 'Backlink Generation',
      description: 'Generate backlinks and connections',
      tasks: [
        { id: 'find-links', name: 'Find Links', description: 'Find potential backlinks' },
        { id: 'create-links', name: 'Create Links', description: 'Create backlink connections' }
      ]
    },
    {
      id: 8,
      name: 'Quality Verification',
      description: 'Verify documentation quality',
      tasks: [
        { id: 'validate', name: 'Validate Docs', description: 'Validate documentation' },
        { id: 'check-links', name: 'Check Links', description: 'Verify all links' }
      ]
    },
    {
      id: 9,
      name: 'Final Assembly',
      description: 'Final assembly and output',
      tasks: [
        { id: 'compile', name: 'Compile Documentation', description: 'Compile final documentation' },
        { id: 'save', name: 'Save Files', description: 'Save documentation files' },
        { id: 'cleanup', name: 'Cleanup', description: 'Clean up temporary files' }
      ]
    }
  ]
  
  private currentPhase: number = 0
  private currentTask: string = ''
  private phaseProgress: Map<number, PhaseProgress> = new Map()
  private lockFileManager: LockFileManager | null = null
  private totalFiles: number = 0
  private processedFiles: number = 0
  
  private constructor() {
    super()
  }
  
  static getInstance(): PhaseManager {
    if (!PhaseManager.instance) {
      PhaseManager.instance = new PhaseManager()
    }
    return PhaseManager.instance
  }
  
  /**
   * Initialize with project path
   */
  initialize(projectPath: string, lockFileManager?: LockFileManager): void {
    this.lockFileManager = lockFileManager || LockFileManager.getInstance(projectPath)
    this.reset()
  }
  
  /**
   * Reset all progress
   */
  reset(): void {
    this.currentPhase = 0
    this.currentTask = ''
    this.phaseProgress.clear()
    this.totalFiles = 0
    this.processedFiles = 0
  }
  
  /**
   * Start a phase
   */
  async startPhase(phaseId: number): Promise<void> {
    const phase = this.phases.find(p => p.id === phaseId)
    if (!phase) {
      throw new Error(`Invalid phase ID: ${phaseId}`)
    }
    
    this.currentPhase = phaseId
    
    // Initialize phase progress
    const progress: PhaseProgress = {
      phaseId,
      phaseName: phase.name,
      filesProcessed: 0,
      filesTotal: 0,
      taskProgress: new Map(),
      fileProgress: new Map(),
      startTime: new Date()
    }
    
    this.phaseProgress.set(phaseId, progress)
    
    // Update TUI
    tuiAdapter.updatePhase(phaseId, this.phases.length, phase.name)
    tuiAdapter.logInfo(`Starting ${phase.name}`)
    
    // Update lock file
    if (this.lockFileManager) {
      await this.lockFileManager.updatePhase(phaseId, phase.name)
    }
    
    this.emit('phase:start', { phase, progress })
  }
  
  /**
   * Complete current phase
   */
  async completePhase(): Promise<void> {
    const progress = this.phaseProgress.get(this.currentPhase)
    if (progress) {
      progress.endTime = new Date()
      
      const phase = this.phases.find(p => p.id === this.currentPhase)
      if (phase) {
        tuiAdapter.logSuccess(`Completed ${phase.name}`)
        this.emit('phase:complete', { phase, progress })
      }
    }
  }
  
  /**
   * Start a task within current phase
   */
  async startTask(taskId: string): Promise<void> {
    const phase = this.phases.find(p => p.id === this.currentPhase)
    const task = phase?.tasks.find(t => t.id === taskId)
    
    if (!phase || !task) {
      throw new Error(`Invalid task: ${taskId} in phase ${this.currentPhase}`)
    }
    
    this.currentTask = taskId
    
    // Update phase sub-task
    tuiAdapter.updatePhase(this.currentPhase, this.phases.length, phase.name, task.name)
    
    // Update lock file
    if (this.lockFileManager) {
      await this.lockFileManager.updatePhase(this.currentPhase, phase.name, task.name)
    }
    
    const progress = this.phaseProgress.get(this.currentPhase)
    if (progress) {
      progress.subPhase = task.name
      progress.taskProgress.set(taskId, 0)
    }
    
    this.emit('task:start', { phase, task, progress })
  }
  
  /**
   * Update task progress
   */
  updateTaskProgress(taskId: string, percentage: number): void {
    const progress = this.phaseProgress.get(this.currentPhase)
    if (progress) {
      progress.taskProgress.set(taskId, Math.min(100, Math.max(0, percentage)))
      this.emit('task:progress', { taskId, percentage })
    }
  }
  
  /**
   * Complete current task
   */
  async completeTask(): Promise<void> {
    if (!this.currentTask) return
    
    const progress = this.phaseProgress.get(this.currentPhase)
    if (progress) {
      progress.taskProgress.set(this.currentTask, 100)
    }
    
    const phase = this.phases.find(p => p.id === this.currentPhase)
    const task = phase?.tasks.find(t => t.id === this.currentTask)
    
    if (task) {
      tuiAdapter.logSuccess(`✓ ${task.name}`)
      this.emit('task:complete', { phase, task })
    }
    
    this.currentTask = ''
  }
  
  /**
   * Set total files for progress tracking
   */
  setTotalFiles(count: number): void {
    this.totalFiles = count
    const progress = this.phaseProgress.get(this.currentPhase)
    if (progress) {
      progress.filesTotal = count
    }
  }
  
  /**
   * Start processing a file
   */
  startFile(filePath: string): void {
    const progress = this.phaseProgress.get(this.currentPhase)
    if (progress) {
      progress.currentFile = filePath
      progress.fileProgress.set(filePath, {
        path: filePath,
        status: 'processing',
        progress: 0
      })
      
      // Update TUI
      tuiAdapter.updateFileProgress(this.processedFiles, this.totalFiles, filePath)
      
      // Update lock file
      if (this.lockFileManager) {
        this.lockFileManager.updateFileProgress(this.processedFiles, this.totalFiles, filePath).catch(() => {})
      }
    }
    
    this.emit('file:start', { file: filePath })
  }
  
  /**
   * Update file progress
   */
  updateFileProgress(filePath: string, percentage: number): void {
    const progress = this.phaseProgress.get(this.currentPhase)
    if (progress) {
      const fileProgress = progress.fileProgress.get(filePath)
      if (fileProgress) {
        fileProgress.progress = Math.min(100, Math.max(0, percentage))
        this.emit('file:progress', { file: filePath, percentage })
      }
    }
  }
  
  /**
   * Complete file processing
   */
  completeFile(filePath: string, success: boolean = true, error?: string): void {
    const progress = this.phaseProgress.get(this.currentPhase)
    if (progress) {
      const fileProgress = progress.fileProgress.get(filePath)
      if (fileProgress) {
        fileProgress.status = success ? 'completed' : 'failed'
        fileProgress.progress = success ? 100 : fileProgress.progress
        if (error) {
          fileProgress.error = error
        }
      }
      
      if (success) {
        this.processedFiles++
        progress.filesProcessed = this.processedFiles
      }
      
      // Update TUI
      tuiAdapter.updateFileProgress(this.processedFiles, this.totalFiles)
      
      // Update lock file
      if (this.lockFileManager) {
        this.lockFileManager.updateFileProgress(this.processedFiles, this.totalFiles).catch(() => {})
      }
    }
    
    this.emit('file:complete', { file: filePath, success, error })
  }
  
  /**
   * Skip a file
   */
  skipFile(filePath: string, reason?: string): void {
    const progress = this.phaseProgress.get(this.currentPhase)
    if (progress) {
      progress.fileProgress.set(filePath, {
        path: filePath,
        status: 'skipped',
        progress: 0,
        error: reason
      })
    }
    
    this.emit('file:skip', { file: filePath, reason })
  }
  
  /**
   * Get current phase
   */
  getCurrentPhase(): Phase | undefined {
    return this.phases.find(p => p.id === this.currentPhase)
  }
  
  /**
   * Get phase progress
   */
  getPhaseProgress(phaseId: number): PhaseProgress | undefined {
    return this.phaseProgress.get(phaseId)
  }
  
  /**
   * Get overall progress percentage
   */
  getOverallProgress(): number {
    const completedPhases = Array.from(this.phaseProgress.values())
      .filter(p => p.endTime !== undefined).length
    return Math.round((completedPhases / this.phases.length) * 100)
  }
  
  /**
   * Get current file progress percentage
   */
  getFileProgress(): number {
    if (this.totalFiles === 0) return 0
    return Math.round((this.processedFiles / this.totalFiles) * 100)
  }
  
  /**
   * Execute a phase with work function
   */
  async executePhase(phaseId: number, workFunction: () => Promise<void>): Promise<void> {
    await this.startPhase(phaseId)
    
    try {
      await workFunction()
      await this.completePhase()
    } catch (error) {
      const phase = this.phases.find(p => p.id === phaseId)
      tuiAdapter.logError(`Failed ${phase?.name}: ${error}`)
      throw error
    }
  }
  
  /**
   * Report a tool/operation usage
   */
  reportOperation(tool: string, target: string): void {
    tuiAdapter.reportTool(tool, target)
    this.emit('operation', { tool, target })
  }
}

// Export singleton instance
export const phaseManager = PhaseManager.getInstance()