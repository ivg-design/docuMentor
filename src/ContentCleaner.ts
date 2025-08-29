/**
 * ContentCleaner - Removes Claude's internal monologue from generated documentation
 */
export class ContentCleaner {
  /**
   * Clean Claude's response to remove internal monologue and thinking patterns
   */
  static cleanContent(content: string): string {
    if (!content) return '';
    
    // Split into lines for line-by-line processing
    const lines = content.split('\n');
    const cleanedLines: string[] = [];
    let skipNextLine = false;
    
    for (const line of lines) {
      // Skip empty lines after skipped content
      if (skipNextLine && line.trim() === '') {
        skipNextLine = false;
        continue;
      }
      
      // Check if this line contains Claude's internal monologue
      if (this.isInternalMonologue(line)) {
        skipNextLine = true;
        continue;
      }
      
      // Check if this is a meta-commentary line
      if (this.isMetaCommentary(line)) {
        continue;
      }
      
      cleanedLines.push(line);
      skipNextLine = false;
    }
    
    // Remove any remaining artifacts
    let cleaned = cleanedLines.join('\n');
    
    // Remove common phrase patterns that indicate internal thinking
    cleaned = this.removeThinkingPhrases(cleaned);
    
    // Remove analysis announcements
    cleaned = this.removeAnalysisAnnouncements(cleaned);
    
    // Clean up excessive whitespace
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    return cleaned.trim();
  }
  
  /**
   * Check if a line contains internal monologue patterns
   */
  private static isInternalMonologue(line: string): boolean {
    const patterns = [
      // First person thinking
      /^I'll\s+(analyze|create|examine|look|check|start|help|generate|explore|document)/i,
      /^I\s+(need|want|should|will|can|see|notice|understand|found|discovered|identified)/i,
      /^I'm\s+(going|looking|analyzing|creating|examining|starting|working)/i,
      /^I've\s+(analyzed|created|examined|found|identified|discovered|completed)/i,
      
      // Action announcements
      /^Let\s+me\s+(analyze|create|examine|look|check|start|help|generate|explore)/i,
      /^Let's\s+(analyze|create|examine|look|check|start|help|generate|explore)/i,
      /^Now\s+let\s+me/i,
      /^Now\s+I'll/i,
      /^Now\s+I\s+will/i,
      /^Next,?\s+I'll/i,
      
      // Process descriptions
      /^Looking\s+at/i,
      /^Analyzing\s+the/i,
      /^Examining\s+the/i,
      /^Checking\s+the/i,
      /^Based\s+on\s+my\s+analysis/i,
      /^After\s+analyzing/i,
      /^After\s+examining/i,
      
      // Meta-process
      /^First,?\s+I'll/i,
      /^Second,?\s+I'll/i,
      /^Finally,?\s+I'll/i,
      /^To\s+start/i,
      /^Starting\s+with/i,
      /^Beginning\s+with/i
    ];
    
    return patterns.some(pattern => pattern.test(line.trim()));
  }
  
  /**
   * Check if a line is meta-commentary about the documentation process
   */
  private static isMetaCommentary(line: string): boolean {
    const patterns = [
      /^Here's\s+the\s+(comprehensive|complete|updated|improved|detailed)/i,
      /^This\s+(documentation|README|guide|document)\s+(includes|contains|provides)/i,
      /^The\s+(documentation|README|guide|document)\s+(is|has been|includes)/i,
      /^I've\s+(successfully|now|just)\s+(created|generated|updated|completed)/i,
      /^The\s+new\s+README/i,
      /^Key\s+improvements/i,
      /^This\s+includes/i
    ];
    
    return patterns.some(pattern => pattern.test(line.trim()));
  }
  
  /**
   * Remove thinking phrases from the content
   */
  private static removeThinkingPhrases(content: string): string {
    const phrases = [
      // Remove sentences starting with thinking patterns
      /(?:^|\n)I'll\s+[^.!?]+[.!?]\s*/gm,
      /(?:^|\n)I\s+need\s+to\s+[^.!?]+[.!?]\s*/gm,
      /(?:^|\n)Let\s+me\s+[^.!?]+[.!?]\s*/gm,
      /(?:^|\n)Now\s+I'll\s+[^.!?]+[.!?]\s*/gm,
      /(?:^|\n)I'm\s+going\s+to\s+[^.!?]+[.!?]\s*/gm,
      
      // Remove inline thinking
      /\.\s*I'll\s+[^.!?]+[.!?]/g,
      /\.\s*Let\s+me\s+[^.!?]+[.!?]/g,
      /\.\s*I\s+need\s+to\s+[^.!?]+[.!?]/g
    ];
    
    let cleaned = content;
    for (const phrase of phrases) {
      cleaned = cleaned.replace(phrase, '');
    }
    
    return cleaned;
  }
  
  /**
   * Remove analysis announcements
   */
  private static removeAnalysisAnnouncements(content: string): string {
    const announcements = [
      /Based\s+on\s+my\s+analysis[^.!?]*[.!?]\s*/gi,
      /After\s+analyzing[^.!?]*[.!?]\s*/gi,
      /After\s+examining[^.!?]*[.!?]\s*/gi,
      /I've\s+successfully[^.!?]*[.!?]\s*/gi,
      /The\s+following\s+documentation[^.!?]*[.!?]\s*/gi
    ];
    
    let cleaned = content;
    for (const announcement of announcements) {
      cleaned = cleaned.replace(announcement, '');
    }
    
    return cleaned;
  }
  
  /**
   * Clean a documentation object (recursive)
   */
  static cleanDocumentationObject(docs: any): any {
    if (typeof docs === 'string') {
      return this.cleanContent(docs);
    }
    
    if (Array.isArray(docs)) {
      return docs.map(item => this.cleanDocumentationObject(item));
    }
    
    if (typeof docs === 'object' && docs !== null) {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(docs)) {
        cleaned[key] = this.cleanDocumentationObject(value);
      }
      return cleaned;
    }
    
    return docs;
  }
}