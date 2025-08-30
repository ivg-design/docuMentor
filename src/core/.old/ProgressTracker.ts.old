// DocuMentor V3.1 - Progress Tracker
// Single source of truth for all progress tracking
// Direct communication with TUIBridge, no abstractions

import {
  Phase,
  PhaseStatus,
  TaskStatus,
  FileStatus,
  ProgressState,
  ProgressStatus,
  PhaseInfo,
  TaskInfo,
  FileProgress,
  ErrorInfo
} from '../types/index.js'

import { TUIBridge } from './TUIBridge.js'

// ============================================================================
// Progress Tracker - Single Source of Truth
// ============================================================================

export class ProgressTracker {
  private state: ProgressState
  private phases: Map<Phase, PhaseInfo> = new Map()
  private tasks: Map<string, TaskInfo> = new Map()
  private files: Map<string, FileProgress> = new Map()
  private performanceMetrics: PerformanceMetrics

  constructor(private tuiBridge: TUIBridge) {
    this.state = {
      currentPhase: this.createPhaseInfo('analysis', 'Analysis', 1, 9),
      totalPhases: 9,
      overallProgress: 0,
      startTime: new Date(),
      elapsedTime: 0,
      status: 'initializing'
    }

    this.performanceMetrics = {
      memoryPeakUsage: 0,
      avgProcessingTime: 0,
      filesPerSecond: 0,
      totalFilesProcessed: 0,
      errorsCount: 0,
      warningsCount: 0
    }

    // Start performance monitoring
    this.startPerformanceMonitoring()
  }

  // ============================================================================
  // Generation Lifecycle
  // ============================================================================

  startGeneration(totalPhases: number): void {
    this.state.totalPhases = totalPhases
    this.state.startTime = new Date()
    this.state.status = 'running'
    this.state.overallProgress = 0

    // Initialize all phases
    this.initializePhases(totalPhases)

    this.tuiBridge.log('info', `Starting documentation generation with ${totalPhases} phases`)
    this.updateTUI()
  }

  completeGeneration(): void {
    this.state.status = 'completed'
    this.state.overallProgress = 100
    this.state.elapsedTime = Date.now() - this.state.startTime.getTime()

    this.tuiBridge.log('info', 'Documentation generation completed successfully')
    this.tuiBridge.finalStats({
      totalFiles: this.performanceMetrics.totalFilesProcessed,
      documentsGenerated: this.getCompletedDocumentsCount(),
      duration: this.state.elapsedTime,
      peakMemoryUsage: this.performanceMetrics.memoryPeakUsage,
      avgProcessingTime: this.performanceMetrics.avgProcessingTime,
      errors: this.performanceMetrics.errorsCount,
      warnings: this.performanceMetrics.warningsCount
    })
  }

  failGeneration(error: Error): void {
    this.state.status = 'failed'
    this.state.error = {
      code: 'GENERATION_FAILED',
      message: error.message,
      stack: error.stack,
      timestamp: new Date(),
      recoverable: false
    }

    this.performanceMetrics.errorsCount++
    this.tuiBridge.detailedError({
      code: 'GENERATION_FAILED',
      message: error.message,
      stack: error.stack,
      recoverable: false
    })
  }

  // ============================================================================
  // Phase Management
  // ============================================================================

  startPhase(phase: Phase, displayName: string, index: number, total: number): void {
    const phaseInfo = this.createPhaseInfo(phase, displayName, index, total)
    phaseInfo.status = 'running'
    phaseInfo.startTime = new Date()

    this.phases.set(phase, phaseInfo)
    this.state.currentPhase = phaseInfo

    // Clear tasks for this phase
    this.clearTasksForPhase(phase)

    this.tuiBridge.log('info', `Starting Phase ${index}/${total}: ${displayName}`)
    this.updateTUI()
  }

  completePhase(phase: Phase): void {
    const phaseInfo = this.phases.get(phase)
    if (!phaseInfo) {
      this.tuiBridge.log('error', `Attempted to complete unknown phase: ${phase}`)
      return
    }

    phaseInfo.status = 'completed'
    phaseInfo.endTime = new Date()
    phaseInfo.progress = 100

    // Complete all tasks in this phase
    this.completeAllTasksInPhase(phase)

    // Calculate overall progress
    this.calculateOverallProgress()

    this.tuiBridge.log('info', `Completed Phase ${phaseInfo.index}/${phaseInfo.total}: ${phaseInfo.displayName}`)
    this.updateTUI()
  }

  failPhase(phase: Phase, error: Error): void {
    const phaseInfo = this.phases.get(phase)
    if (!phaseInfo) {
      this.tuiBridge.log('error', `Attempted to fail unknown phase: ${phase}`)
      return
    }

    phaseInfo.status = 'failed'
    phaseInfo.endTime = new Date()

    const errorInfo: ErrorInfo = {
      code: 'PHASE_FAILED',
      message: error.message,
      phase,
      stack: error.stack,
      timestamp: new Date(),
      recoverable: this.isPhaseRecoverable(phase)
    }

    this.state.error = errorInfo
    this.performanceMetrics.errorsCount++

    this.tuiBridge.detailedError({
      code: 'PHASE_FAILED',
      message: error.message,
      phase,
      stack: error.stack,
      recoverable: this.isPhaseRecoverable(phase)
    })
  }

  // ============================================================================
  // Task Management
  // ============================================================================

  startTask(taskName: string, displayName: string, phase?: Phase): void {
    const currentPhase = phase || this.state.currentPhase.name

    const taskInfo: TaskInfo = {
      name: taskName,
      displayName,
      phase: currentPhase,
      status: 'running',
      startTime: new Date(),
      progress: 0,
      files: []
    }

    this.tasks.set(taskName, taskInfo)
    this.state.currentTask = taskInfo

    // Add to phase tasks
    const phaseInfo = this.phases.get(currentPhase)
    if (phaseInfo) {
      phaseInfo.tasks.push(taskInfo)
    }

    this.tuiBridge.log('info', `Starting task: ${displayName}`)
    this.updateTUI()
  }

  completeTask(taskName: string): void {
    const taskInfo = this.tasks.get(taskName)
    if (!taskInfo) {
      this.tuiBridge.log('error', `Attempted to complete unknown task: ${taskName}`)
      return
    }

    taskInfo.status = 'completed'
    taskInfo.endTime = new Date()
    taskInfo.progress = 100

    // Complete all files in this task
    this.completeAllFilesInTask(taskName)

    // Update phase progress
    this.updatePhaseProgress(taskInfo.phase)

    this.tuiBridge.log('info', `Completed task: ${taskInfo.displayName}`)
    this.updateTUI()
  }

  failTask(taskName: string, error: Error): void {
    const taskInfo = this.tasks.get(taskName)
    if (!taskInfo) {
      this.tuiBridge.log('error', `Attempted to fail unknown task: ${taskName}`)
      return
    }

    taskInfo.status = 'failed'
    taskInfo.endTime = new Date()
    taskInfo.error = {
      code: 'TASK_FAILED',
      message: error.message,
      phase: taskInfo.phase,
      task: taskName,
      stack: error.stack,
      timestamp: new Date(),
      recoverable: this.isTaskRecoverable(taskName)
    }

    this.performanceMetrics.errorsCount++

    this.tuiBridge.detailedError({
      code: 'TASK_FAILED',
      message: error.message,
      phase: taskInfo.phase,
      task: taskName,
      stack: error.stack,
      recoverable: this.isTaskRecoverable(taskName)
    })
  }

  updateTaskProgress(taskName: string, progress: number): void {
    const taskInfo = this.tasks.get(taskName)
    if (!taskInfo) {
      return
    }

    taskInfo.progress = Math.min(100, Math.max(0, progress))
    this.updatePhaseProgress(taskInfo.phase)
    this.updateTUI()
  }

  // ============================================================================
  // File Management
  // ============================================================================

  startFile(filePath: string, taskName?: string): void {
    const fileProgress: FileProgress = {
      path: filePath,
      status: 'reading',
      progress: 0,
      startTime: new Date()
    }

    this.files.set(filePath, fileProgress)
    // Note: currentFile in state expects FileInfo type, not FileProgress
    // This is tracked separately in the files Map

    // Add to task files if specified
    if (taskName) {
      const taskInfo = this.tasks.get(taskName)
      if (taskInfo) {
        taskInfo.files = taskInfo.files || []
        taskInfo.files.push(fileProgress)
      }
    }

    this.updateTUI()
  }

  completeFile(filePath: string): void {
    const fileProgress = this.files.get(filePath)
    if (!fileProgress) {
      return
    }

    fileProgress.status = 'completed'
    fileProgress.endTime = new Date()
    fileProgress.progress = 100

    this.performanceMetrics.totalFilesProcessed++
    this.updatePerformanceMetrics()
    this.updateTUI()
  }

  failFile(filePath: string, error: Error): void {
    const fileProgress = this.files.get(filePath)
    if (!fileProgress) {
      return
    }

    fileProgress.status = 'failed'
    fileProgress.endTime = new Date()
    fileProgress.error = {
      code: 'FILE_PROCESSING_FAILED',
      message: error.message,
      file: filePath,
      stack: error.stack,
      timestamp: new Date(),
      recoverable: true
    }

    this.performanceMetrics.errorsCount++
    this.tuiBridge.log('error', `Failed to process file ${filePath}: ${error.message}`)
  }

  updateFileProgress(filePath: string, progress: number): void {
    const fileProgress = this.files.get(filePath)
    if (!fileProgress) {
      return
    }

    fileProgress.progress = Math.min(100, Math.max(0, progress))
    this.updateTUI()
  }

  setFileStatus(filePath: string, status: FileStatus): void {
    const fileProgress = this.files.get(filePath)
    if (!fileProgress) {
      return
    }

    fileProgress.status = status
    this.updateTUI()
  }

  // ============================================================================
  // Progress Calculations
  // ============================================================================

  private calculateOverallProgress(): void {
    if (this.phases.size === 0) {
      this.state.overallProgress = 0
      return
    }

    let totalProgress = 0
    let completedPhases = 0

    for (const phaseInfo of this.phases.values()) {
      if (phaseInfo.status === 'completed') {
        totalProgress += 100
        completedPhases++
      } else if (phaseInfo.status === 'running') {
        totalProgress += phaseInfo.progress
      }
    }

    this.state.overallProgress = Math.min(100, totalProgress / this.state.totalPhases)
  }

  private updatePhaseProgress(phase: Phase): void {
    const phaseInfo = this.phases.get(phase)
    if (!phaseInfo) {
      return
    }

    const phaseTasks = Array.from(this.tasks.values()).filter(t => t.phase === phase)
    if (phaseTasks.length === 0) {
      phaseInfo.progress = 0
      return
    }

    const totalProgress = phaseTasks.reduce((sum, task) => sum + task.progress, 0)
    phaseInfo.progress = totalProgress / phaseTasks.length

    this.calculateOverallProgress()
  }

  // ============================================================================
  // TUI Communication
  // ============================================================================

  private updateTUI(): void {
    this.state.elapsedTime = Date.now() - this.state.startTime.getTime()

    // Update current file count
    const completedFiles = Array.from(this.files.values()).filter(f => f.status === 'completed').length
    const totalFiles = this.files.size

    this.tuiBridge.progressUpdate(
      this.state.currentPhase.name,
      this.state.currentPhase.progress,
      this.state.overallProgress,
      completedFiles,
      totalFiles,
      this.state.currentFile?.path
    )
  }

  // ============================================================================
  // Performance Monitoring
  // ============================================================================

  private startPerformanceMonitoring(): void {
    setInterval(() => {
      this.updatePerformanceMetrics()
    }, 5000) // Update every 5 seconds
  }

  private updatePerformanceMetrics(): void {
    const memoryUsage = process.memoryUsage()
    this.performanceMetrics.memoryPeakUsage = Math.max(
      this.performanceMetrics.memoryPeakUsage,
      memoryUsage.heapUsed
    )

    // Calculate processing speed
    const elapsedSeconds = this.state.elapsedTime / 1000
    if (elapsedSeconds > 0) {
      this.performanceMetrics.filesPerSecond = this.performanceMetrics.totalFilesProcessed / elapsedSeconds
    }

    // Send performance update to TUI
    this.tuiBridge.performanceUpdate({
      memoryUsage: memoryUsage.heapUsed,
      cpuUsage: process.cpuUsage().user,
      activeFiles: Array.from(this.files.values()).filter(f => f.status === 'reading' || f.status === 'processing').length,
      queuedFiles: Array.from(this.files.values()).filter(f => f.status === 'pending').length
    })
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private createPhaseInfo(phase: Phase, displayName: string, index: number, total: number): PhaseInfo {
    return {
      name: phase,
      displayName,
      index,
      total,
      status: 'pending',
      tasks: [],
      progress: 0
    }
  }

  private initializePhases(totalPhases: number): void {
    const phases: Phase[] = [
      'analysis',
      'generation',
      'enhancement',
      'formatting',
      'obsidian-integration',
      'tag-optimization',
      'backlink-generation',
      'verification',
      'save'
    ]

    phases.slice(0, totalPhases).forEach((phase, index) => {
      const displayName = this.getPhaseDisplayName(phase)
      const phaseInfo = this.createPhaseInfo(phase, displayName, index + 1, totalPhases)
      this.phases.set(phase, phaseInfo)
    })
  }

  private getPhaseDisplayName(phase: Phase): string {
    const displayNames: Record<Phase, string> = {
      'analysis': 'Project Analysis',
      'generation': 'Document Generation',
      'enhancement': 'AI Enhancement',
      'formatting': 'Document Formatting',
      'obsidian-integration': 'Obsidian Integration',
      'tag-optimization': 'Tag Optimization',
      'backlink-generation': 'Backlink Generation',
      'verification': 'Document Verification',
      'save': 'Saving Documents'
    }
    return displayNames[phase] || phase
  }

  private clearTasksForPhase(phase: Phase): void {
    const tasksToRemove = Array.from(this.tasks.keys()).filter(taskName => {
      const task = this.tasks.get(taskName)
      return task && task.phase === phase
    })

    tasksToRemove.forEach(taskName => {
      this.tasks.delete(taskName)
    })
  }

  private completeAllTasksInPhase(phase: Phase): void {
    for (const taskInfo of this.tasks.values()) {
      if (taskInfo.phase === phase && taskInfo.status !== 'completed' && taskInfo.status !== 'failed') {
        taskInfo.status = 'completed'
        taskInfo.endTime = new Date()
        taskInfo.progress = 100
      }
    }
  }

  private completeAllFilesInTask(taskName: string): void {
    const taskInfo = this.tasks.get(taskName)
    if (!taskInfo || !taskInfo.files) {
      return
    }

    for (const fileProgress of taskInfo.files) {
      if (fileProgress.status !== 'completed' && fileProgress.status !== 'failed') {
        fileProgress.status = 'completed'
        fileProgress.endTime = new Date()
        fileProgress.progress = 100
      }
    }
  }

  private isPhaseRecoverable(phase: Phase): boolean {
    // Some phases are more critical than others
    const criticalPhases: Phase[] = ['analysis', 'save']
    return !criticalPhases.includes(phase)
  }

  private isTaskRecoverable(taskName: string): boolean {
    // Most tasks are recoverable except critical ones
    const criticalTasks = ['project-detection', 'document-saving']
    return !criticalTasks.includes(taskName)
  }

  private getCompletedDocumentsCount(): number {
    // Count completed files that are documents
    return Array.from(this.files.values()).filter(f =>
      f.status === 'completed' &&
      f.path.endsWith('.md')
    ).length
  }

  // ============================================================================
  // Public Getters
  // ============================================================================

  getState(): ProgressState {
    return { ...this.state }
  }

  getPhaseInfo(phase: Phase): PhaseInfo | undefined {
    return this.phases.get(phase)
  }

  getTaskInfo(taskName: string): TaskInfo | undefined {
    return this.tasks.get(taskName)
  }

  getFileProgress(filePath: string): FileProgress | undefined {
    return this.files.get(filePath)
  }

  getCurrentStats(): {
    totalFiles: number
    processedFiles: number
    completedFiles: number
    failedFiles: number
    currentPhase: string
    overallProgress: number
    } {
    const processedFiles = Array.from(this.files.values()).filter(f => f.status !== 'pending').length
    const completedFiles = Array.from(this.files.values()).filter(f => f.status === 'completed').length
    const failedFiles = Array.from(this.files.values()).filter(f => f.status === 'failed').length

    return {
      totalFiles: this.files.size,
      processedFiles,
      completedFiles,
      failedFiles,
      currentPhase: this.state.currentPhase.displayName,
      overallProgress: this.state.overallProgress
    }
  }
}

// ============================================================================
// Performance Metrics Interface
// ============================================================================

interface PerformanceMetrics {
  memoryPeakUsage: number
  avgProcessingTime: number
  filesPerSecond: number
  totalFilesProcessed: number
  errorsCount: number
  warningsCount: number
}

// ============================================================================
// Export
// ============================================================================

export default ProgressTracker
