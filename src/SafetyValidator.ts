import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface SafetyCheck {
  type: 'read' | 'write' | 'delete' | 'modify';
  path: string;
  size?: number;
  checksum?: string;
  timestamp: Date;
  approved: boolean;
  reason?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export class SafetyValidator {
  private fileChecksums: Map<string, string> = new Map();
  private backupDir: string;
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB default
  private readOnlyPaths: string[] = [];
  private protectedPaths: string[] = [];
  
  constructor(backupDir?: string) {
    this.backupDir = backupDir || path.join(process.env.HOME!, '.documentor', 'backups');
    this.initializeProtectedPaths();
  }
  
  private initializeProtectedPaths(): void {
    // Paths that should NEVER be modified
    this.readOnlyPaths = [
      '/System',
      '/usr/bin',
      '/usr/sbin',
      '/bin',
      '/sbin',
      process.env.HOME + '/.ssh',
      process.env.HOME + '/.gnupg',
      process.env.HOME + '/.aws',
      process.env.HOME + '/.kube'
    ];
    
    // Paths that require extra validation
    this.protectedPaths = [
      process.env.HOME + '/.gitconfig',
      process.env.HOME + '/.bashrc',
      process.env.HOME + '/.zshrc',
      process.env.HOME + '/.profile'
    ];
  }
  
  async validateBeforeWrite(filePath: string, content: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };
    
    // Check 1: Ensure we're not writing to system directories
    if (this.isSystemPath(filePath)) {
      result.valid = false;
      result.errors.push(`Cannot write to system path: ${filePath}`);
      return result;
    }
    
    // Check 2: Ensure we're not modifying protected files
    if (this.isProtectedPath(filePath)) {
      result.warnings.push(`Writing to protected path: ${filePath}`);
      result.suggestions.push('Consider creating a backup first');
    }
    
    // Check 3: Validate file size
    const sizeInBytes = Buffer.byteLength(content, 'utf8');
    if (sizeInBytes > this.maxFileSize) {
      result.valid = false;
      result.errors.push(`File size (${sizeInBytes} bytes) exceeds maximum allowed (${this.maxFileSize} bytes)`);
      return result;
    }
    
    // Check 4: Ensure we're only writing to documentation directories
    if (!this.isDocumentationPath(filePath)) {
      result.warnings.push(`Writing outside of standard documentation directories: ${filePath}`);
    }
    
    // Check 5: Validate content integrity
    const contentValidation = await this.validateContent(content, filePath);
    if (!contentValidation.valid) {
      result.valid = false;
      result.errors.push(...contentValidation.errors);
    }
    
    // Check 6: Ensure no sensitive data in content
    const sensitiveData = this.checkForSensitiveData(content);
    if (sensitiveData.length > 0) {
      result.valid = false;
      result.errors.push(`Content contains sensitive data: ${sensitiveData.join(', ')}`);
      return result;
    }
    
    return result;
  }
  
  private isSystemPath(filePath: string): boolean {
    const normalizedPath = path.normalize(filePath);
    return this.readOnlyPaths.some(protectedPath => 
      normalizedPath.startsWith(protectedPath)
    );
  }
  
  private isProtectedPath(filePath: string): boolean {
    const normalizedPath = path.normalize(filePath);
    return this.protectedPaths.some(protectedPath => 
      normalizedPath.startsWith(protectedPath)
    );
  }
  
  private isDocumentationPath(filePath: string): boolean {
    const allowedPaths = [
      path.join(process.env.HOME!, 'github/obsidian_vault/docs'),
      path.join(process.env.HOME!, '.documentor'),
      '/tmp/documentor-',
      path.join(process.env.HOME!, 'Documents')
    ];
    
    const normalizedPath = path.normalize(filePath);
    return allowedPaths.some(allowed => 
      normalizedPath.startsWith(allowed)
    );
  }
  
  private async validateContent(content: string, filePath: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };
    
    const ext = path.extname(filePath).toLowerCase();
    
    // Validate based on file type
    switch (ext) {
      case '.json':
        try {
          JSON.parse(content);
        } catch (e) {
          result.valid = false;
          result.errors.push(`Invalid JSON content: ${e}`);
        }
        break;
        
      case '.md':
      case '.markdown':
        // Check for markdown syntax issues
        if (content.includes('```') && (content.match(/```/g)?.length || 0) % 2 !== 0) {
          result.warnings.push('Unclosed code block detected');
        }
        break;
        
      case '.yaml':
      case '.yml':
        // Basic YAML validation
        if (content.includes('\t')) {
          result.warnings.push('YAML file contains tabs (spaces recommended)');
        }
        break;
    }
    
    // Check for potential injection attacks
    const dangerousPatterns = [
      /<script[^>]*>/gi,
      /eval\s*\(/gi,
      /exec\s*\(/gi,
      /system\s*\(/gi,
      /require\s*\(\s*['"`]child_process/gi
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        result.warnings.push(`Potentially dangerous pattern detected: ${pattern}`);
      }
    }
    
    return result;
  }
  
  private checkForSensitiveData(content: string): string[] {
    const sensitivePatterns = [
      { pattern: /-----BEGIN RSA PRIVATE KEY-----/g, type: 'Private Key' },
      { pattern: /sk-[a-zA-Z0-9]{48}/g, type: 'OpenAI API Key' },
      { pattern: /ghp_[a-zA-Z0-9]{36}/g, type: 'GitHub Token' },
      { pattern: /api[_-]?key[_-]?[:=]\s*['"]?[a-zA-Z0-9]{32,}/gi, type: 'API Key' },
      { pattern: /password[_-]?[:=]\s*['"]?[^\s'"]{8,}/gi, type: 'Password' },
      { pattern: /secret[_-]?[:=]\s*['"]?[a-zA-Z0-9]{16,}/gi, type: 'Secret' },
      { pattern: /AKIA[0-9A-Z]{16}/g, type: 'AWS Access Key' },
      { pattern: /[a-zA-Z0-9/+=]{40}/g, type: 'AWS Secret Key (potential)' }
    ];
    
    const found: string[] = [];
    for (const { pattern, type } of sensitivePatterns) {
      if (pattern.test(content)) {
        found.push(type);
      }
    }
    
    return found;
  }
  
  async createBackup(filePath: string): Promise<string> {
    try {
      // Check if file exists
      await fs.access(filePath);
      
      // Create backup directory if it doesn't exist
      await fs.mkdir(this.backupDir, { recursive: true });
      
      // Generate backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = path.basename(filePath);
      const backupPath = path.join(this.backupDir, `${timestamp}_${filename}`);
      
      // Copy file to backup location
      const content = await fs.readFile(filePath);
      await fs.writeFile(backupPath, content);
      
      // Calculate and store checksum
      const checksum = this.calculateChecksum(content);
      this.fileChecksums.set(filePath, checksum);
      
      console.log(`📦 Backup created: ${backupPath}`);
      return backupPath;
      
    } catch (error) {
      // File doesn't exist, no backup needed
      return '';
    }
  }
  
  private calculateChecksum(content: Buffer | string): string {
    return crypto
      .createHash('sha256')
      .update(typeof content === 'string' ? content : content.toString())
      .digest('hex');
  }
  
  async verifyIntegrity(filePath: string): Promise<boolean> {
    try {
      const content = await fs.readFile(filePath);
      const currentChecksum = this.calculateChecksum(content);
      const storedChecksum = this.fileChecksums.get(filePath);
      
      if (!storedChecksum) {
        // No previous checksum, store current one
        this.fileChecksums.set(filePath, currentChecksum);
        return true;
      }
      
      return currentChecksum === storedChecksum;
    } catch {
      return false;
    }
  }
  
  async restoreFromBackup(originalPath: string, backupPath: string): Promise<void> {
    try {
      const backupContent = await fs.readFile(backupPath);
      await fs.writeFile(originalPath, backupContent);
      console.log(`♻️ Restored ${originalPath} from backup`);
    } catch (error) {
      console.error(`❌ Failed to restore from backup: ${error}`);
      throw error;
    }
  }
  
  async validateDirectory(dirPath: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };
    
    try {
      const stats = await fs.stat(dirPath);
      
      if (!stats.isDirectory()) {
        result.valid = false;
        result.errors.push(`${dirPath} is not a directory`);
        return result;
      }
      
      // Check permissions
      await fs.access(dirPath, fs.constants.R_OK);
      
      // Check if it's a git repository (warn about modifying)
      try {
        await fs.access(path.join(dirPath, '.git'));
        result.warnings.push('Directory is a Git repository');
        result.suggestions.push('Consider documenting in a separate location');
      } catch {
        // Not a git repo, that's fine
      }
      
      // Check for sensitive directories
      const sensitiveMarkers = ['.env', 'secrets', 'credentials', 'private'];
      const files = await fs.readdir(dirPath);
      
      for (const marker of sensitiveMarkers) {
        if (files.some(file => file.toLowerCase().includes(marker))) {
          result.warnings.push(`Directory may contain sensitive data (${marker} found)`);
        }
      }
      
    } catch (error) {
      result.valid = false;
      result.errors.push(`Cannot access directory: ${error}`);
    }
    
    return result;
  }
  
  async cleanupBackups(olderThanDays: number = 7): Promise<number> {
    try {
      const files = await fs.readdir(this.backupDir);
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      let deleted = 0;
      
      for (const file of files) {
        const filePath = path.join(this.backupDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtimeMs < cutoffTime) {
          await fs.unlink(filePath);
          deleted++;
        }
      }
      
      if (deleted > 0) {
        console.log(`🧹 Cleaned up ${deleted} old backup files`);
      }
      
      return deleted;
    } catch {
      return 0;
    }
  }
  
  getSafetyReport(): string {
    const report = `
Safety Validation Report
========================
Protected Paths: ${this.protectedPaths.length}
Read-Only Paths: ${this.readOnlyPaths.length}
Files Monitored: ${this.fileChecksums.size}
Max File Size: ${this.maxFileSize / 1024 / 1024} MB
Backup Directory: ${this.backupDir}

Recommendations:
- Always backup before modifying existing documentation
- Never write to system directories
- Validate all JSON/YAML content before writing
- Check for sensitive data in documentation
- Maintain checksums for integrity verification
    `;
    
    return report;
  }
}