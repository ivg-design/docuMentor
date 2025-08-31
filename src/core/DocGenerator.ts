/**
 * DocGenerator - Compatibility stub
 * Document generation is now handled by DocumentProcessor
 */

export class DocGenerator {
  constructor(config?: any, claudeClient?: any) {
    // Stub constructor - accepts config and claude client for compatibility
  }
  
  async generateDocumentation(filePath: string, content?: string): Promise<string> {
    // Stub implementation - actual generation handled by DocumentProcessor
    return `# Documentation for ${filePath}\n\n${content}`
  }
  
  async processFile(file: any): Promise<any> {
    return {
      path: file.path,
      content: await this.generateDocumentation(file.path, file.content || ''),
      metadata: {}
    }
  }
}