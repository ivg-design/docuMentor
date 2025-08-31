/**
 * DocumentQueue - Thread-safe queue for document processing
 */

import { SourceFile } from './DocumentProcessor'

export class DocumentQueue {
  private queue: SourceFile[] = []
  private processing = new Set<string>()

  /**
   * Add a file to the queue
   */
  add(file: SourceFile): void {
    this.queue.push(file)
  }

  /**
   * Take a file from the queue (thread-safe)
   */
  take(): SourceFile | null {
    const file = this.queue.shift()
    if (file) {
      this.processing.add(file.path)
    }
    return file || null
  }

  /**
   * Mark a file as completed
   */
  complete(filePath: string): void {
    this.processing.delete(filePath)
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
   * Get number of files being processed
   */
  processingCount(): number {
    return this.processing.size
  }

  /**
   * Check if all work is done
   */
  isDone(): boolean {
    return this.queue.length === 0 && this.processing.size === 0
  }
}