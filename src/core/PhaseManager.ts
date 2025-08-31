/**
 * PhaseManager - Compatibility stub
 * Phase management is now handled by TUIInterface
 */

export class PhaseManager {
  private currentPhase = 0
  private totalPhases = 9
  
  initialize(projectPath?: string | string[], lockFileManager?: any) {
    // Initialize phases - stub implementation
    // Handle both old (phases array) and new (projectPath, lockFileManager) signatures
    this.currentPhase = 0
  }
  
  updatePhase(phase: number, name: string) {
    this.currentPhase = phase
    // Phase updates now handled by TUIInterface
  }
  
  start(phaseName: string) {
    this.currentPhase++
    // Start phase - stub implementation
  }
  
  complete(phaseName: string) {
    // Complete phase - stub implementation
  }
  
  getPhase() {
    return {
      current: this.currentPhase,
      total: this.totalPhases
    }
  }
  
  startTask(taskName: string) {
    // Start task - stub implementation
  }
  
  executePhase(phaseNameOrNumber: string | number, callback?: () => Promise<void>) {
    // Execute phase - stub implementation
    if (typeof phaseNameOrNumber === 'number') {
      this.currentPhase = phaseNameOrNumber
    }
    // If callback provided, execute it (for compatibility)
    if (callback) {
      callback().catch(() => {})
    }
  }
}