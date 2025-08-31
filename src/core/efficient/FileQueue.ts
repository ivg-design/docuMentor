/**
 * File Queue Manager
 * Manages the queue of files to be processed
 */

export class FileQueue {
  private queue: string[] = []
  private processed: Set<string> = new Set()
  
  /**
   * Add files to the queue
   */
  async addFiles(files: string[]): Promise<void> {
    this.queue.push(...files)
  }

  /**
   * Get next file from queue
   */
  async getNext(): Promise<string | null> {
    const file = this.queue.shift()
    if (file) {
      this.processed.add(file)
    }
    return file || null
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length
  }

  /**
   * Get processed count
   */
  processedCount(): number {
    return this.processed.size
  }

  /**
   * Reset queue
   */
  reset(): void {
    this.queue = []
    this.processed.clear()
  }
}