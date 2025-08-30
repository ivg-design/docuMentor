// DocuMentor V3.1 - Core TypeScript Interfaces
// Foundation types for clean, simple, direct implementation

// ============================================================================
// Configuration Interfaces
// ============================================================================

export interface Config {
  version: string
  project: {
    name: string
    type: 'auto' | 'monorepo' | 'library' | 'application' | 'tools'
  }
  output: {
    path: string
    format: 'obsidian' | 'markdown'
    features: OutputFeatures
  }
  permissions: {
    requestPassword: boolean
    skipOnDenial: boolean
    importantPaths: string[]
  }
  claude: ClaudeConfig
  phases: Phase[]
}

export interface OutputFeatures {
  frontmatter: boolean
  backlinks: boolean
  tags: TagConfig
  moc: boolean
  dataview: boolean
}

export interface TagConfig {
  optimize: boolean
  hierarchy: boolean
  minPerDoc: number
}

export interface ClaudeConfig {
  model: string
  maxTokens: number
  temperature: number
}

// CLI-specific configuration extensions
export interface DocumentorConfig extends Config {
  github?: {
    token?: string
    webhookSecret?: string
    defaultBranch: string
  }
  watch?: {
    includePaths: string[]
    excludePaths: string[]
    debounceMs: number
  }
}

// ============================================================================
// Project Analysis Interfaces
// ============================================================================

export interface ProjectAnalysis {
  name: string
  type: ProjectType
  path: string
  structure: ProjectStructure
  files: FileInfo[]
  dependencies: string[]
  frameworks: string[]
  languages: string[]
  metadata: ProjectMetadata
}

export type ProjectType = 'monorepo' | 'library' | 'application' | 'tools'

export interface ProjectStructure {
  srcDirs: string[]
  testDirs: string[]
  configFiles: string[]
  docDirs: string[]
  packages?: PackageInfo[] // For monorepos
}

export interface PackageInfo {
  name: string
  path: string
  type: string
  dependencies: string[]
}

export interface FileInfo {
  path: string
  type: FileType
  language: string
  size: number
  lastModified: Date
  importance: 'critical' | 'important' | 'normal' | 'low'
  permissions: FilePermissions
  content?: string
  analysis?: FileAnalysis
}

export type FileType = 'source' | 'config' | 'test' | 'docs' | 'asset' | 'other'

export interface FilePermissions {
  readable: boolean
  requiresElevation: boolean
  error?: string
}

export interface FileAnalysis {
  complexity: 'low' | 'medium' | 'high'
  testCoverage?: number
  linesOfCode: number
  functions: FunctionInfo[]
  classes: ClassInfo[]
  exports: ExportInfo[]
  imports: ImportInfo[]
}

export interface ProjectMetadata {
  version?: string
  description?: string
  repository?: string
  author?: string
  license?: string
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}

// ============================================================================
// Code Element Interfaces
// ============================================================================

export interface FunctionInfo {
  name: string
  line: number
  type: 'function' | 'method' | 'arrow' | 'async'
  parameters: ParameterInfo[]
  returnType?: string
  documentation?: string
  complexity: 'low' | 'medium' | 'high'
}

export interface ClassInfo {
  name: string
  line: number
  extends?: string
  implements?: string[]
  methods: FunctionInfo[]
  properties: PropertyInfo[]
  documentation?: string
}

export interface ParameterInfo {
  name: string
  type?: string
  optional: boolean
  defaultValue?: string
}

export interface PropertyInfo {
  name: string
  type?: string
  visibility: 'public' | 'private' | 'protected'
  static: boolean
}

export interface ExportInfo {
  name: string
  type: 'function' | 'class' | 'variable' | 'type' | 'default'
  line: number
}

export interface ImportInfo {
  module: string
  imports: string[]
  type: 'named' | 'default' | 'namespace'
  line: number
}

// ============================================================================
// Documentation Interfaces
// ============================================================================

export interface Document {
  id: string
  title: string
  type: DocumentType
  content: string
  frontmatter: Frontmatter
  sourceFiles: string[]
  tags: string[]
  backlinks: string[]
  metadata: DocumentMetadata
  status: DocumentStatus
}

export type DocumentType = 'readme' | 'api' | 'guide' | 'architecture' | 'overview' | 'component' | 'reference'
export type DocumentStatus = 'draft' | 'in-progress' | 'complete' | 'deprecated'

export interface Frontmatter {
  project: string
  projectTag: string
  title: string
  type: DocumentType
  status: DocumentStatus
  created: string
  modified: string
  sourceFiles?: string[]
  sourceRepo?: string
  version?: string
  language?: string
  framework?: string[]
  parent?: string
  children?: string[]
  related?: string[]
  dependencies?: string[]
  complexity?: 'low' | 'medium' | 'high'
  importance?: 'critical' | 'important' | 'normal'
  testCoverage?: number
  loc?: number
  tags: string[]
}

export interface DocumentMetadata {
  wordCount: number
  readingTime: number
  lastGenerated: string
  generator: string
  version: string
}

// ============================================================================
// Progress Tracking Interfaces
// ============================================================================

export interface ProgressState {
  currentPhase: PhaseInfo
  totalPhases: number
  overallProgress: number
  currentTask?: TaskInfo
  currentFile?: FileInfo
  startTime: Date
  elapsedTime: number
  estimatedRemaining?: number
  status: ProgressStatus
  error?: ErrorInfo
}

export type ProgressStatus = 'initializing' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

export interface PhaseInfo {
  name: Phase
  displayName: string
  index: number
  total: number
  status: PhaseStatus
  startTime?: Date
  endTime?: Date
  tasks: TaskInfo[]
  progress: number
}

export type Phase =
  | 'analysis'
  | 'generation'
  | 'enhancement'
  | 'formatting'
  | 'obsidian-integration'
  | 'tag-optimization'
  | 'backlink-generation'
  | 'verification'
  | 'save'

export type PhaseStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export interface TaskInfo {
  name: string
  displayName: string
  phase: Phase
  status: TaskStatus
  startTime?: Date
  endTime?: Date
  progress: number
  files?: FileProgress[]
  error?: ErrorInfo
}

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export interface FileProgress {
  path: string
  status: FileStatus
  progress: number
  startTime?: Date
  endTime?: Date
  error?: ErrorInfo
}

export type FileStatus = 'pending' | 'reading' | 'analyzing' | 'processing' | 'completed' | 'failed' | 'skipped'

// ============================================================================
// Error Handling Interfaces
// ============================================================================

export interface ErrorInfo {
  code: string
  message: string
  phase?: Phase
  task?: string
  file?: string
  stack?: string
  timestamp: Date
  recoverable: boolean
  suggestions?: string[]
}

export interface PermissionError extends ErrorInfo {
  operation: 'read' | 'write' | 'execute'
  path: string
  requiresElevation: boolean
  critical: boolean
}

// ============================================================================
// Lock File Interfaces
// ============================================================================

export interface LockFileData {
  pid: number
  startTime: string
  lastUpdate: string
  status: LockStatus
  currentPhase: Phase
  completedTasks: string[]
  progress: number
  projectPath: string
  outputPath: string
  error?: ErrorInfo
}

export type LockStatus = 'initializing' | 'running' | 'completed' | 'failed' | 'interrupted' | 'cancelled'

// ============================================================================
// TUI Bridge Interfaces
// ============================================================================

export interface TUIMessage {
  type: TUIMessageType
  timestamp: string
  data: any
}

export type TUIMessageType =
  | 'phase_start'
  | 'phase_complete'
  | 'task_start'
  | 'task_complete'
  | 'file_start'
  | 'file_complete'
  | 'progress_update'
  | 'log'
  | 'error'
  | 'password_request'
  | 'password_response'
  | 'completion'
  | 'progress_batch'
  | 'performance_update'
  | 'detailed_error'
  | 'final_stats'
  | 'shutdown'

export interface PhaseMessage extends TUIMessage {
  type: 'phase_start' | 'phase_complete'
  data: {
    phase: Phase
    displayName: string
    index: number
    total: number
  }
}

export interface TaskMessage extends TUIMessage {
  type: 'task_start' | 'task_complete'
  data: {
    task: string
    displayName: string
    phase: Phase
  }
}

export interface FileMessage extends TUIMessage {
  type: 'file_start' | 'file_complete'
  data: {
    file: string
    operation: string
    progress?: number
  }
}

export interface ProgressMessage extends TUIMessage {
  type: 'progress_update'
  data: {
    phase: Phase
    phaseProgress: number
    overallProgress: number
    filesProcessed: number
    filesTotal: number
    currentFile?: string
  }
}

export interface LogMessage extends TUIMessage {
  type: 'log'
  data: {
    level: 'info' | 'warn' | 'error' | 'debug'
    message: string
    details?: any
  }
}

export interface PasswordRequest extends TUIMessage {
  type: 'password_request'
  data: {
    requestId: string
    operation: string
    path: string
    prompt: string
    timeout: number
  }
}

export interface PasswordResponse extends TUIMessage {
  type: 'password_response'
  data: {
    requestId: string
    password?: string
    cancelled: boolean
  }
}

// ============================================================================
// Utility Interfaces
// ============================================================================

export interface PathInfo {
  absolute: string
  relative: string
  basename: string
  dirname: string
  extension: string
  exists: boolean
}

export interface ProcessInfo {
  pid: number
  startTime: Date
  memoryUsage: number
  cpuUsage: number
  status: 'running' | 'idle' | 'busy'
}

// ============================================================================
// Export Collections
// ============================================================================

export type AllInterfaces = Config | ProjectAnalysis | Document | ProgressState | LockFileData | TUIMessage
