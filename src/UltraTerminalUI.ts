import * as readline from 'readline';
import chalk from 'chalk';
import { EventEmitter } from 'events';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warning' | 'error' | 'success' | 'tool' | 'diagnostic';
  message: string;
  details?: any;
}

export interface DebugEntry {
  timestamp: Date;
  module: string;
  event: string;
  data: any;
}

export interface RawMessage {
  timestamp: Date;
  direction: 'sent' | 'received';
  type: string;
  content: any;
}

export interface PhaseInfo {
  current: number;
  total: number;
  name: string;
  subPhase?: string;
}

export interface DocumentInfo {
  current: string;
  completed: number;
  total: number;
  inProgress: string;
}

type ViewMode = 'normal' | 'debug' | 'raw';

export class UltraTerminalUI extends EventEmitter {
  private logs: LogEntry[] = [];
  private debugLogs: DebugEntry[] = [];
  private rawMessages: RawMessage[] = [];
  private viewportOffset: number = 0;
  private viewMode: ViewMode = 'normal';
  
  // Phase tracking - FIXED
  private phases: PhaseInfo = {
    current: 1,
    total: 7, // Total phases in documentation process
    name: 'Initialization',
    subPhase: ''
  };
  
  // File tracking - FIXED
  private filesProcessed: number = 0;
  private totalFiles: number = 0;
  private currentFile: string = '';
  
  // Document tracking - NEW
  private documents: DocumentInfo = {
    current: '',
    completed: 0,
    total: 0,
    inProgress: ''
  };
  
  // Lock file tracking - FIXED
  private lockFileStatus: 'locked' | 'unlocked' | 'stale' = 'unlocked';
  private lockFilePath: string = '';
  private lockCheckInterval: NodeJS.Timeout | null = null;
  
  // Spinner for work in progress - NEW
  private spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private spinnerIndex = 0;
  private isWorking = false;
  
  private startTime: number = Date.now();
  private memoryUsage: NodeJS.MemoryUsage;
  private isScrolling: boolean = false;
  private lastRenderTime: number = 0;
  private renderInterval: NodeJS.Timeout | null = null;
  private keyPressListener: any;
  private isActive: boolean = false;
  private pid: number = process.pid;
  
  // Use readline for input
  private rl: readline.Interface;
  
  // ANSI escape codes
  private readonly CLEAR = '\x1b[2J';
  private readonly HOME = '\x1b[H';
  private readonly HIDE_CURSOR = '\x1b[?25l';
  private readonly SHOW_CURSOR = '\x1b[?25h';
  private readonly ALT_BUFFER_ON = '\x1b[?1049h';
  private readonly ALT_BUFFER_OFF = '\x1b[?1049l';
  private readonly SAVE_CURSOR = '\x1b[s';
  private readonly RESTORE_CURSOR = '\x1b[u';
  private readonly MOVE_TO = (row: number, col: number) => `\x1b[${row};${col}H`;
  
  // Terminal dimensions
  private rows: number = process.stdout.rows || 24;
  private cols: number = process.stdout.columns || 80;
  
  // Define all phases upfront
  private readonly PHASE_DEFINITIONS = [
    'Initialization',
    'Configuration',
    'Analysis',
    'Verification',
    'Documentation',
    'Formatting',
    'Completion'
  ];
  
  constructor() {
    super();
    
    // Initialize memory usage
    this.memoryUsage = process.memoryUsage();
    
    // Create readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });
    
    // Listen for terminal resize
    process.stdout.on('resize', () => {
      this.rows = process.stdout.rows || 24;
      this.cols = process.stdout.columns || 80;
      this.render();
    });
    
    // Update memory usage periodically
    setInterval(() => {
      this.memoryUsage = process.memoryUsage();
    }, 1000);
    
    // Setup cleanup handlers
    process.on('exit', () => this.cleanup());
    process.on('SIGINT', () => this.handleExit());
    process.on('SIGTERM', () => this.handleExit());
  }
  
  /**
   * Start the UI with proper lock file monitoring
   */
  start(lockFilePath?: string): void {
    if (this.isActive) return;
    
    this.isActive = true;
    this.lockFilePath = lockFilePath || path.join(process.cwd(), '.documentor.lock');
    
    // Start lock file monitoring - every 5 seconds as requested
    this.startLockFileMonitoring();
    
    // Switch to alternate buffer and hide cursor
    process.stdout.write(this.ALT_BUFFER_ON);
    process.stdout.write(this.HIDE_CURSOR);
    process.stdout.write(this.CLEAR);
    
    // Set up keyboard handling
    this.setupKeyboardHandling();
    
    // Start render loop
    this.renderInterval = setInterval(() => this.render(), 100);
    
    // Initial render
    this.render();
    
    // Set total phases
    this.phases.total = this.PHASE_DEFINITIONS.length;
    
    this.addDiagnostic('UI', 'Terminal UI initialized');
  }
  
  /**
   * Monitor lock file status every 5 seconds
   */
  private startLockFileMonitoring(): void {
    this.checkLockFile(); // Initial check
    
    this.lockCheckInterval = setInterval(() => {
      this.checkLockFile();
    }, 5000); // Every 5 seconds as requested
  }
  
  /**
   * Check lock file status
   */
  private checkLockFile(): void {
    try {
      if (fs.existsSync(this.lockFilePath)) {
        const stats = fs.statSync(this.lockFilePath);
        const ageMs = Date.now() - stats.mtimeMs;
        
        if (ageMs > 30000) { // Stale if older than 30 seconds
          this.lockFileStatus = 'stale';
        } else {
          this.lockFileStatus = 'locked';
        }
      } else {
        this.lockFileStatus = 'unlocked';
      }
    } catch (error) {
      this.lockFileStatus = 'unlocked';
    }
  }
  
  /**
   * Stop the UI
   */
  stop(): void {
    if (!this.isActive) return;
    
    this.isActive = false;
    
    // Stop lock file monitoring
    if (this.lockCheckInterval) {
      clearInterval(this.lockCheckInterval);
      this.lockCheckInterval = null;
    }
    
    this.cleanup();
  }
  
  /**
   * Setup keyboard handling
   */
  private setupKeyboardHandling(): void {
    // Enable raw mode for better key handling
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    
    // Handle keypress events
    this.keyPressListener = (chunk: Buffer) => {
      const key = chunk.toString();
      
      // Handle special keys
      if (key === '\x03') { // Ctrl+C
        this.handleExit();
      } else if (key === 'd' || key === 'D') { // D for debug mode
        if (this.viewMode !== 'debug') {
          this.viewMode = 'debug';
          this.addDiagnostic('UI', 'Debug mode enabled');
        } else {
          this.viewMode = 'normal';
          this.addDiagnostic('UI', 'Debug mode disabled');
        }
        this.render();
      } else if (key === 'r' || key === 'R') { // R for raw mode
        if (this.viewMode !== 'raw') {
          this.viewMode = 'raw';
          this.log('info', 'Raw mode enabled - showing Claude API messages');
        } else {
          this.viewMode = 'normal';
          this.log('info', 'Raw mode disabled');
        }
        this.render();
      } else if (key === '\x1b[A') { // Arrow Up
        this.scrollDown(); // Show older
      } else if (key === '\x1b[B') { // Arrow Down
        this.scrollUp(); // Show newer
      } else if (key === '\x1b[5~') { // Page Up
        this.pageDown();
      } else if (key === '\x1b[6~') { // Page Down
        this.pageUp();
      } else if (key === '\x1b[H') { // Home
        this.scrollToBottom();
      } else if (key === '\x1b[F') { // End
        this.scrollToTop();
      } else if (key === 'q' || key === 'Q') { // Q to quit
        this.handleExit();
      } else if (key === 'c' || key === 'C') { // C to clear logs
        this.clearLogs();
        this.render();
      }
    };
    
    process.stdin.on('data', this.keyPressListener);
  }
  
  /**
   * Clean up resources
   */
  private cleanup(): void {
    // Stop render loop
    if (this.renderInterval) {
      clearInterval(this.renderInterval);
      this.renderInterval = null;
    }
    
    // Stop lock file monitoring
    if (this.lockCheckInterval) {
      clearInterval(this.lockCheckInterval);
      this.lockCheckInterval = null;
    }
    
    // Remove keyboard listener
    if (this.keyPressListener) {
      process.stdin.removeListener('data', this.keyPressListener);
    }
    
    // Restore terminal state
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    
    // Return to main buffer and show cursor
    process.stdout.write(this.SHOW_CURSOR);
    process.stdout.write(this.ALT_BUFFER_OFF);
    
    // Close readline interface
    this.rl.close();
  }
  
  /**
   * Handle exit
   */
  private handleExit(): void {
    this.cleanup();
    process.exit(0);
  }
  
  /**
   * Clear logs
   */
  private clearLogs(): void {
    if (this.viewMode === 'normal') {
      this.logs = [];
    } else if (this.viewMode === 'debug') {
      this.debugLogs = [];
    } else if (this.viewMode === 'raw') {
      this.rawMessages = [];
    }
    this.viewportOffset = 0;
    this.isScrolling = false;
  }
  
  /**
   * Render the UI
   */
  private render(): void {
    if (!this.isActive) return;
    
    // Throttle rendering
    const now = Date.now();
    if (now - this.lastRenderTime < 50) return;
    this.lastRenderTime = now;
    
    // Update spinner
    if (this.isWorking) {
      this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerFrames.length;
    }
    
    // Clear screen and move to home
    process.stdout.write(this.CLEAR);
    process.stdout.write(this.HOME);
    
    // Render header
    this.renderHeader();
    
    // Render content based on mode
    switch (this.viewMode) {
      case 'debug':
        this.renderDebugView();
        break;
      case 'raw':
        this.renderRawView();
        break;
      default:
        this.renderLogView();
    }
    
    // Render footer
    this.renderFooter();
  }
  
  /**
   * Render header section with all fixes
   */
  private renderHeader(): void {
    const elapsed = this.formatDuration(Date.now() - this.startTime);
    const mem = this.formatMemory();
    
    // Format phase properly - FIXED
    const phaseStr = `Phase ${this.phases.current} of ${this.phases.total}: ${this.phases.name}`;
    const subPhaseStr = this.phases.subPhase ? ` (${this.phases.subPhase})` : '';
    
    // Format file counter properly - FIXED
    const fileProgress = this.totalFiles > 0 ? 
      `${this.filesProcessed}/${this.totalFiles}` : 
      'Scanning...';
    
    // Format document counter - NEW
    const docProgress = this.documents.total > 0 ?
      `Docs: ${this.documents.completed}/${this.documents.total}` :
      '';
    
    // Spinner for work in progress - NEW
    const spinner = this.isWorking ? this.spinnerFrames[this.spinnerIndex] : ' ';
    
    // Title bar with mode indicator and spinner in upper right
    const modeIndicator = this.viewMode !== 'normal' ? 
      chalk.yellow(` [${this.viewMode.toUpperCase()}]`) : '';
    const title = chalk.bold.cyan(`DocuMentor v2.0.0${modeIndicator}`);
    const titleLine = this.centerText(title);
    
    // Add spinner to the right
    const spinnerPos = this.cols - 2;
    process.stdout.write(titleLine);
    process.stdout.write(this.MOVE_TO(1, spinnerPos));
    process.stdout.write(chalk.cyan(spinner));
    process.stdout.write('\n');
    
    // Separator
    this.writeLine(chalk.gray('─'.repeat(this.cols)));
    
    // Status line with all info
    const statusParts = [
      chalk.yellow(`PID: ${this.pid}`),
      chalk.cyan(phaseStr + subPhaseStr),
      chalk.green(`Files: ${fileProgress}`),
      docProgress ? chalk.magenta(docProgress) : '',
      chalk.blue(elapsed),
      chalk.magenta(mem)
    ].filter(p => p);
    
    this.writeLine(statusParts.join(' │ '));
    
    // Lock file status line - FIXED with clear indication
    const lockStatus = this.getLockFileStatusDisplay();
    this.writeLine(lockStatus);
    
    // Document in progress - NEW
    if (this.documents.inProgress) {
      this.writeLine(chalk.cyan(`Working on: ${this.documents.inProgress}`));
    }
    
    // Control hints
    const controls = chalk.gray('[D: Debug] [R: Raw] [↑↓: Scroll] [C: Clear] [Q: Quit]');
    this.writeLine(controls);
    
    // Separator
    this.writeLine(chalk.gray('─'.repeat(this.cols)));
  }
  
  /**
   * Get lock file status display - FIXED
   */
  private getLockFileStatusDisplay(): string {
    switch (this.lockFileStatus) {
      case 'locked':
        return chalk.red(`[LOCK] Process locked - another instance running`);
      case 'stale':
        return chalk.yellow(`[LOCK] Stale lock detected - may need cleanup`);
      case 'unlocked':
        return chalk.green(`[LOCK] Available - no other instances running`);
      default:
        return chalk.gray(`[LOCK] Unknown status`);
    }
  }
  
  /**
   * Render log view with proper formatting - FIXED
   */
  private renderLogView(): void {
    const availableRows = this.rows - 10; // Adjusted for extra header lines
    
    // Reverse logs for display (newest first)
    const reversedLogs = [...this.logs].reverse();
    const visibleLogs = this.getVisibleItems(reversedLogs, availableRows);
    
    // Render logs with proper formatting
    visibleLogs.forEach(log => {
      const timestamp = this.formatLocalTime(log.timestamp);
      const levelColor = this.getLevelColor(log.level);
      
      // Format message - FIXED to remove JSON and wrap lines
      const formattedMessage = this.formatLogMessage(log);
      
      const line = `${chalk.gray(timestamp)} ${levelColor(`[${log.level.toUpperCase()}]`)} ${formattedMessage}`;
      
      // Handle line wrapping if needed
      if (line.length > this.cols) {
        const wrapped = this.wrapLine(line, this.cols);
        wrapped.forEach(l => this.writeLine(l));
      } else {
        this.writeLine(line);
      }
    });
    
    // Fill empty space
    const emptyLines = availableRows - visibleLogs.length;
    for (let i = 0; i < emptyLines; i++) {
      this.writeLine('');
    }
  }
  
  /**
   * Format log messages - FIXED to remove JSON clutter
   */
  private formatLogMessage(log: LogEntry): string {
    let message = log.message;
    
    // Remove "Received line N:" prefix
    message = message.replace(/^Received line \d+:\s*/, '');
    
    // Extract meaningful content from JSON if present
    if (message.includes('{') && message.includes('}')) {
      try {
        // Try to parse as JSON and extract meaningful parts
        const jsonMatch = message.match(/\{.*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          
          // Extract human-readable parts
          if (parsed.type === 'tool_use' && parsed.tool) {
            message = `Tool: ${parsed.tool}`;
            if (parsed.args?.file_path) message += ` - ${parsed.args.file_path}`;
            if (parsed.args?.pattern) message += ` - searching: "${parsed.args.pattern}"`;
          } else if (parsed.type === 'tool_result') {
            message = `Tool completed`;
            if (parsed.content) {
              const preview = parsed.content.substring(0, 100);
              if (preview) message += `: ${preview}...`;
            }
          } else if (parsed.message) {
            message = parsed.message;
          } else if (parsed.content) {
            message = parsed.content.substring(0, 150);
          }
        }
      } catch (e) {
        // If not valid JSON, clean up the message
        message = message.replace(/\{"type".*?\}/g, '[data]');
      }
    }
    
    // Remove Claude's internal monologue
    const monologuePatterns = [
      /Claude is analyzing.*/gi,
      /I'll help.*/gi,
      /Let me.*/gi,
      /I need to.*/gi,
      /Now I'll.*/gi
    ];
    
    for (const pattern of monologuePatterns) {
      message = message.replace(pattern, '');
    }
    
    return message.trim() || '[Processing...]';
  }
  
  /**
   * Render debug view with diagnostic messages - FIXED
   */
  private renderDebugView(): void {
    const availableRows = this.rows - 10;
    
    // Show debug mode header
    this.writeLine(chalk.yellow.bold(`[DEBUG MODE] - Diagnostic Messages`));
    this.writeLine(chalk.gray('─'.repeat(this.cols)));
    
    // Reverse debug logs (newest first)
    const reversedLogs = [...this.debugLogs].reverse();
    const visibleLogs = this.getVisibleItems(reversedLogs, availableRows - 2);
    
    visibleLogs.forEach(entry => {
      const timestamp = this.formatLocalTime(entry.timestamp);
      const moduleColor = this.getModuleColor(entry.module);
      
      // Format the diagnostic message properly
      const message = `${chalk.gray(timestamp)} ${moduleColor(`[${entry.module}]`)} ${chalk.cyan(entry.event)}`;
      
      // Show data if present
      if (entry.data) {
        const dataStr = typeof entry.data === 'object' ? 
          JSON.stringify(entry.data, null, 2) : String(entry.data);
        const lines = dataStr.split('\n');
        
        this.writeLine(message);
        lines.slice(0, 3).forEach(line => {
          this.writeLine(chalk.gray('  ' + line));
        });
      } else {
        this.writeLine(message);
      }
    });
    
    // Fill empty space
    const emptyLines = Math.max(0, availableRows - (visibleLogs.length * 2) - 2);
    for (let i = 0; i < emptyLines; i++) {
      this.writeLine('');
    }
  }
  
  /**
   * Render raw Claude API messages - FIXED to show actual JSON
   */
  private renderRawView(): void {
    const availableRows = this.rows - 10;
    
    // Show raw mode header
    this.writeLine(chalk.yellow.bold(`[RAW MODE] - Claude API Messages (JSON)`));
    this.writeLine(chalk.gray('─'.repeat(this.cols)));
    
    // Reverse raw messages (newest first)
    const reversedMessages = [...this.rawMessages].reverse();
    const visibleMessages = this.getVisibleItems(reversedMessages, availableRows - 2);
    
    visibleMessages.forEach(msg => {
      const timestamp = this.formatLocalTime(msg.timestamp);
      const dirColor = msg.direction === 'sent' ? chalk.blue : chalk.green;
      const arrow = msg.direction === 'sent' ? '→ SENT' : '← RECV';
      
      // Show the actual JSON content
      const header = `${chalk.gray(timestamp)} ${dirColor(arrow)} ${chalk.yellow(msg.type)}`;
      this.writeLine(header);
      
      // Format JSON content properly
      if (msg.content) {
        const jsonStr = typeof msg.content === 'object' ? 
          JSON.stringify(msg.content, null, 2) : String(msg.content);
        const lines = jsonStr.split('\n');
        
        // Show first 5 lines of JSON
        lines.slice(0, 5).forEach(line => {
          this.writeLine(chalk.gray('  ' + this.truncateLine(line, this.cols - 4)));
        });
        
        if (lines.length > 5) {
          this.writeLine(chalk.dim(`  ... ${lines.length - 5} more lines`));
        }
      }
      
      this.writeLine(''); // Empty line between messages
    });
    
    // Fill empty space
    const emptyLines = Math.max(0, availableRows - (visibleMessages.length * 7) - 2);
    for (let i = 0; i < emptyLines; i++) {
      this.writeLine('');
    }
  }
  
  /**
   * Render footer
   */
  private renderFooter(): void {
    this.writeLine(chalk.gray('─'.repeat(this.cols)));
    
    // Show mode-specific information
    if (this.viewMode === 'debug') {
      this.writeLine(chalk.dim(`Debug logs: ${this.debugLogs.length} diagnostic messages`));
    } else if (this.viewMode === 'raw') {
      this.writeLine(chalk.dim(`Raw messages: ${this.rawMessages.length} API calls`));
    } else {
      // Show current file being processed
      if (this.currentFile) {
        this.writeLine(chalk.dim(`Processing: ${this.currentFile}`));
      } else {
        this.writeLine(chalk.dim('Ready for documentation generation'));
      }
    }
  }
  
  /**
   * Format time in local timezone - FIXED
   */
  private formatLocalTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
  
  /**
   * Get module color for debug messages
   */
  private getModuleColor(module: string): any {
    const colors: { [key: string]: any } = {
      'UI': chalk.cyan,
      'Agent': chalk.green,
      'Claude': chalk.blue,
      'File': chalk.yellow,
      'Lock': chalk.red,
      'Tag': chalk.magenta,
      'Doc': chalk.white
    };
    return colors[module] || chalk.gray;
  }
  
  /**
   * Wrap long lines
   */
  private wrapLine(text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    let currentLine = '';
    const words = text.split(' ');
    
    for (const word of words) {
      if ((currentLine + ' ' + word).length > maxWidth) {
        if (currentLine) lines.push(currentLine);
        currentLine = '  ' + word; // Indent wrapped lines
      } else {
        currentLine = currentLine ? currentLine + ' ' + word : word;
      }
    }
    
    if (currentLine) lines.push(currentLine);
    return lines;
  }
  
  /**
   * Get visible items based on viewport
   */
  private getVisibleItems<T>(items: T[], maxRows: number): T[] {
    if (items.length <= maxRows) {
      return items;
    }
    
    const start = this.viewportOffset;
    const end = Math.min(start + maxRows, items.length);
    
    return items.slice(start, end);
  }
  
  /**
   * Scroll operations
   */
  private scrollUp(): void {
    if (this.viewportOffset > 0) {
      this.viewportOffset--;
      this.isScrolling = this.viewportOffset > 0;
      this.render();
    }
  }
  
  private scrollDown(): void {
    const currentList = this.getCurrentListLength();
    const maxScroll = Math.max(0, currentList - (this.rows - 10));
    if (this.viewportOffset < maxScroll) {
      this.viewportOffset++;
      this.isScrolling = true;
      this.render();
    }
  }
  
  private pageUp(): void {
    this.viewportOffset = Math.max(0, this.viewportOffset - 10);
    this.isScrolling = this.viewportOffset > 0;
    this.render();
  }
  
  private pageDown(): void {
    const currentList = this.getCurrentListLength();
    const maxScroll = Math.max(0, currentList - (this.rows - 10));
    this.viewportOffset = Math.min(maxScroll, this.viewportOffset + 10);
    this.isScrolling = true;
    this.render();
  }
  
  private scrollToTop(): void {
    this.viewportOffset = 0;
    this.isScrolling = false;
    this.render();
  }
  
  private scrollToBottom(): void {
    const currentList = this.getCurrentListLength();
    const maxScroll = Math.max(0, currentList - (this.rows - 10));
    this.viewportOffset = maxScroll;
    this.isScrolling = true;
    this.render();
  }
  
  private getCurrentListLength(): number {
    switch (this.viewMode) {
      case 'debug': return this.debugLogs.length;
      case 'raw': return this.rawMessages.length;
      default: return this.logs.length;
    }
  }
  
  // ============= PUBLIC API =============
  
  /**
   * Log a message
   */
  log(level: LogEntry['level'], message: string, details?: any): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      details
    };
    
    this.logs.push(entry);
    
    // Auto-scroll to top (newest) if not manually scrolling
    if (!this.isScrolling) {
      this.viewportOffset = 0;
    }
    
    // Limit log buffer size
    if (this.logs.length > 500) {
      this.logs.shift();
      if (this.viewportOffset > 0) {
        this.viewportOffset--;
      }
    }
    
    this.emit('log', entry);
  }
  
  /**
   * Add diagnostic message for debug mode - NEW
   */
  addDiagnostic(module: string, event: string, data?: any): void {
    const entry: DebugEntry = {
      timestamp: new Date(),
      module,
      event,
      data
    };
    
    this.debugLogs.push(entry);
    
    // Limit debug buffer size
    if (this.debugLogs.length > 300) {
      this.debugLogs.shift();
    }
    
    this.emit('debug', entry);
  }
  
  /**
   * Log raw Claude API message
   */
  logRawMessage(direction: 'sent' | 'received', type: string, content: any): void {
    const entry: RawMessage = {
      timestamp: new Date(),
      direction,
      type,
      content
    };
    
    this.rawMessages.push(entry);
    
    // Limit raw message buffer
    if (this.rawMessages.length > 200) {
      this.rawMessages.shift();
    }
  }
  
  /**
   * Update phase with proper tracking - FIXED
   */
  updatePhase(phaseName: string, subPhase?: string): void {
    // Find the phase in our definitions
    const phaseIndex = this.PHASE_DEFINITIONS.indexOf(phaseName);
    
    if (phaseIndex !== -1) {
      this.phases.current = phaseIndex + 1;
      this.phases.name = phaseName;
    } else {
      // If not a main phase, treat as sub-phase
      this.phases.subPhase = phaseName;
      return;
    }
    
    this.phases.subPhase = subPhase || '';
    this.addDiagnostic('Agent', `Phase changed to: ${phaseName}`, { phase: this.phases });
  }
  
  /**
   * Set phase explicitly - NEW
   */
  setPhase(current: number, total: number, name: string): void {
    this.phases.current = current;
    this.phases.total = total;
    this.phases.name = name;
    this.addDiagnostic('Agent', `Phase set: ${current}/${total} - ${name}`);
  }
  
  /**
   * Update file progress - FIXED
   */
  updateFileProgress(processed: number, total: number, currentFile?: string): void {
    this.filesProcessed = processed;
    this.totalFiles = total;
    if (currentFile) {
      this.currentFile = currentFile;
      this.addDiagnostic('File', `Processing: ${currentFile}`, { processed, total });
    }
  }
  
  /**
   * Update document progress - NEW
   */
  updateDocumentProgress(completed: number, total: number, current?: string): void {
    this.documents.completed = completed;
    this.documents.total = total;
    if (current) {
      this.documents.current = current;
      this.documents.inProgress = current;
      this.addDiagnostic('Doc', `Generating: ${current}`, { completed, total });
    }
  }
  
  /**
   * Set working status for spinner - NEW
   */
  setWorking(working: boolean): void {
    this.isWorking = working;
  }
  
  /**
   * Update lock status
   */
  updateLockStatus(locked: boolean): void {
    this.lockFileStatus = locked ? 'locked' : 'unlocked';
    this.addDiagnostic('Lock', `Lock status: ${this.lockFileStatus}`);
  }
  
  /**
   * Utility: Format duration
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
  
  /**
   * Utility: Format memory
   */
  private formatMemory(): string {
    const used = this.memoryUsage.heapUsed / 1024 / 1024;
    const total = this.memoryUsage.heapTotal / 1024 / 1024;
    return `${used.toFixed(0)}/${total.toFixed(0)}MB`;
  }
  
  /**
   * Utility: Get level color
   */
  private getLevelColor(level: LogEntry['level']): any {
    switch (level) {
      case 'debug': return chalk.gray;
      case 'info': return chalk.blue;
      case 'warning': return chalk.yellow;
      case 'error': return chalk.red;
      case 'success': return chalk.green;
      case 'tool': return chalk.cyan;
      case 'diagnostic': return chalk.magenta;
      default: return chalk.white;
    }
  }
  
  /**
   * Utility: Center text
   */
  private centerText(text: string): string {
    const visibleLength = text.replace(/\x1b\[[0-9;]*m/g, '').length;
    const padding = Math.max(0, Math.floor((this.cols - visibleLength) / 2));
    return ' '.repeat(padding) + text;
  }
  
  /**
   * Utility: Truncate line
   */
  private truncateLine(text: string, maxWidth?: number): string {
    const width = maxWidth || this.cols - 2;
    const visible = text.replace(/\x1b\[[0-9;]*m/g, '');
    
    if (visible.length <= width) {
      return text;
    }
    
    return text.substring(0, width - 3) + '...';
  }
  
  /**
   * Utility: Write line to stdout
   */
  private writeLine(text: string): void {
    process.stdout.write(text + '\n');
  }
  
  // ============= Compatibility Methods =============
  
  displayTitle(title: string): void {
    this.log('info', `Starting: ${title}`);
  }
  
  createTask(id: string, name: string, total: number): void {
    this.log('info', `Task: ${name}`);
    this.setWorking(true);
  }
  
  updateTask(id: string, progress: number, message?: string, details?: any): void {
    if (message) {
      this.log('info', message);
    }
  }
  
  completeTask(id: string, success: boolean): void {
    this.log(success ? 'success' : 'error', success ? 'Task completed' : 'Task failed');
    this.setWorking(false);
  }
  
  streamFile(operation: string, filePath: string, details?: any): void {
    this.log('tool', `${operation}: ${filePath}`);
    this.currentFile = filePath;
  }
  
  streamAnalysis(component: string, action: string, details?: any): void {
    this.log('info', `[${component}] ${action}`);
    this.addDiagnostic(component, action, details);
  }
  
  logError(message: string, details?: any): void {
    this.log('error', message, details);
  }
  
  stream(message: string): void {
    this.log('info', message);
  }
  
  updateStatus(phase: string, message?: string): void {
    if (message) {
      this.log('info', `${phase}: ${message}`);
    } else {
      this.updatePhase(phase);
    }
  }
  
  pauseForInput(): void {
    if (this.renderInterval) {
      clearInterval(this.renderInterval);
      this.renderInterval = null;
    }
  }
  
  resumeAfterInput(): void {
    if (!this.renderInterval && this.isActive) {
      this.renderInterval = setInterval(() => this.render(), 100);
    }
  }
  
  debugEvent(event: any, data?: any): void {
    if (data !== undefined) {
      this.addDiagnostic('Claude', event, data);
    } else {
      this.addDiagnostic('Claude', 'event', event);
    }
  }
  
  showSummary(summary: any): void {
    this.log('success', 'Summary:');
    if (typeof summary === 'object') {
      Object.entries(summary).forEach(([key, value]) => {
        this.log('info', `  ${key}: ${value}`);
      });
    } else {
      this.log('info', `  ${summary}`);
    }
  }
  
  updateMemoryUsage(): void {
    // Already handled in constructor with periodic updates
  }
}

// Export a singleton instance
export const ultraTerminalUI = new UltraTerminalUI();