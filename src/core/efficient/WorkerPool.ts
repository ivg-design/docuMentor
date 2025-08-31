/**
 * Worker Pool Manager
 * Manages parallel processing workers with TUI integration
 */

import { TUIInterface } from '../TUIInterface'

export interface WorkerStats {
  completed: number
  failed: number
  processing: number
  totalTime: number
}

export class WorkerPool {
  private workers: Map<number, WorkerStats> = new Map()
  
  constructor(
    public readonly size: number,
    private tui: TUIInterface
  ) {
    // Initialize worker stats
    for (let i = 1; i <= size; i++) {
      this.workers.set(i, {
        completed: 0,
        failed: 0,
        processing: 0,
        totalTime: 0
      })
    }
  }

  /**
   * Get stats for a specific worker
   */
  getStats(workerId: number): WorkerStats {
    return this.workers.get(workerId) || {
      completed: 0,
      failed: 0,
      processing: 0,
      totalTime: 0
    }
  }

  /**
   * Update worker stats
   */
  updateStats(workerId: number, update: Partial<WorkerStats>): void {
    const current = this.getStats(workerId)
    this.workers.set(workerId, { ...current, ...update })
  }

  /**
   * Shutdown all workers
   */
  shutdown(): void {
    for (let i = 1; i <= this.size; i++) {
      this.tui.updateWorker(i, { state: 'complete' })
    }
  }
}