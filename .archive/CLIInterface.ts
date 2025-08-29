import ora from 'ora';
import chalk from 'chalk';
import * as cliProgress from 'cli-progress';
import Table from 'cli-table3';
import boxen from 'boxen';
import figlet from 'figlet';
import gradientString from 'gradient-string';

export interface ProgressUpdate {
  task: string;
  subtask?: string;
  progress: number;
  total?: number;
  message?: string;
  details?: string[];
}

export class CLIInterface {
  private spinner: any;
  private progressBar: any;
  private multiBar: any;
  private bars: Map<string, any> = new Map();
  private isInteractive: boolean;
  private verboseMode: boolean;
  private logBuffer: string[] = [];
  
  constructor(verbose: boolean = false) {
    this.isInteractive = process.stdout.isTTY || false;
    this.verboseMode = verbose;
    
    // Initialize multi-bar for concurrent progress tracking
    if (this.isInteractive) {
      this.multiBar = new cliProgress.MultiBar({
        clearOnComplete: false,
        hideCursor: true,
        format: ' {bar} | {task} | {percentage}% | {value}/{total} | {message}',
        barCompleteChar: '█',
        barIncompleteChar: '░',
      }, cliProgress.Presets.shades_grey);
    }
  }
  
  // Display banner
  showBanner(title: string, subtitle?: string) {
    console.clear();
    const gradient = gradientString.pastel;
    
    try {
      const banner = figlet.textSync(title, {
        font: 'Standard',
        horizontalLayout: 'default',
        verticalLayout: 'default'
      });
      console.log(gradient.multiline(banner));
    } catch {
      // Fallback if figlet fails
      console.log(gradient.multiline(title));
    }
    
    if (subtitle) {
      console.log(chalk.gray(subtitle));
    }
    console.log();
  }
  
  // Display boxed message
  showBox(content: string, title?: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    const colors = {
      info: 'cyan',
      success: 'green',
      warning: 'yellow',
      error: 'red'
    };
    
    const boxOptions: any = {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: colors[type],
      title: title ? ` ${title} ` : undefined,
      titleAlignment: 'center'
    };
    
    console.log(boxen(content, boxOptions));
  }
  
  // Start spinner
  startSpinner(text: string): void {
    if (!this.isInteractive) {
      console.log(chalk.cyan(`→ ${text}`));
      return;
    }
    
    this.spinner = ora({
      text,
      spinner: 'dots',
      color: 'cyan'
    }).start();
  }
  
  // Update spinner
  updateSpinner(text: string): void {
    if (!this.isInteractive) {
      console.log(chalk.cyan(`→ ${text}`));
      return;
    }
    
    if (this.spinner) {
      this.spinner.text = text;
    }
  }
  
  // Success spinner
  succeedSpinner(text?: string): void {
    if (!this.isInteractive) {
      console.log(chalk.green(`✓ ${text || 'Done'}`));
      return;
    }
    
    if (this.spinner) {
      this.spinner.succeed(text);
      this.spinner = null;
    }
  }
  
  // Fail spinner
  failSpinner(text?: string): void {
    if (!this.isInteractive) {
      console.log(chalk.red(`✗ ${text || 'Failed'}`));
      return;
    }
    
    if (this.spinner) {
      this.spinner.fail(text);
      this.spinner = null;
    }
  }
  
  // Create progress bar for a specific task
  createProgressBar(taskId: string, taskName: string, total: number): void {
    if (!this.isInteractive) {
      console.log(chalk.blue(`[${taskName}] Starting (0/${total})`));
      return;
    }
    
    const bar = this.multiBar.create(total, 0, {
      task: taskName,
      message: 'Initializing...'
    });
    
    this.bars.set(taskId, bar);
  }
  
  // Update specific progress bar
  updateProgressBar(taskId: string, current: number, message?: string): void {
    if (!this.isInteractive) {
      const bar = this.bars.get(taskId);
      if (bar) {
        console.log(chalk.blue(`[${taskId}] Progress: ${current}/${bar.total} - ${message || ''}`));
      }
      return;
    }
    
    const bar = this.bars.get(taskId);
    if (bar) {
      bar.update(current, {
        message: message || ''
      });
    }
  }
  
  // Complete progress bar
  completeProgressBar(taskId: string, message?: string): void {
    if (!this.isInteractive) {
      console.log(chalk.green(`[${taskId}] Complete - ${message || 'Done'}`));
      return;
    }
    
    const bar = this.bars.get(taskId);
    if (bar) {
      bar.stop();
      this.bars.delete(taskId);
    }
  }
  
  // Stop all progress bars
  stopAllProgress(): void {
    if (this.multiBar) {
      this.multiBar.stop();
    }
    this.bars.clear();
  }
  
  // Display table
  showTable(headers: string[], rows: any[][]): void {
    const table = new Table({
      head: headers.map(h => chalk.cyan(h)),
      style: {
        head: [],
        border: []
      }
    });
    
    rows.forEach(row => table.push(row));
    console.log(table.toString());
  }
  
  // Display tree structure
  showTree(data: any, indent: string = ''): void {
    Object.keys(data).forEach((key, index, array) => {
      const isLast = index === array.length - 1;
      const prefix = isLast ? '└── ' : '├── ';
      const extension = isLast ? '    ' : '│   ';
      
      console.log(indent + chalk.gray(prefix) + chalk.white(key));
      
      if (typeof data[key] === 'object' && data[key] !== null) {
        this.showTree(data[key], indent + extension);
      }
    });
  }
  
  // Log message with level
  log(message: string, level: 'info' | 'success' | 'warning' | 'error' | 'debug' = 'info'): void {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    
    const formats = {
      info: chalk.blue('INFO'),
      success: chalk.green('SUCCESS'),
      warning: chalk.yellow('WARN'),
      error: chalk.red('ERROR'),
      debug: chalk.gray('DEBUG')
    };
    
    const colors = {
      info: chalk.white,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red,
      debug: chalk.gray
    };
    
    const formattedMessage = `[${chalk.gray(timestamp)}] ${formats[level]} ${colors[level](message)}`;
    
    if (level === 'debug' && !this.verboseMode) {
      this.logBuffer.push(formattedMessage);
      return;
    }
    
    console.log(formattedMessage);
  }
  
  // Display section header
  showSection(title: string): void {
    console.log();
    console.log(chalk.bold.underline(title));
    console.log();
  }
  
  // Display subsection
  showSubsection(title: string): void {
    console.log(chalk.bold(`  ${title}`));
  }
  
  // Display list
  showList(items: string[], ordered: boolean = false): void {
    items.forEach((item, index) => {
      const bullet = ordered ? `${index + 1}.` : '•';
      console.log(chalk.gray(`  ${bullet} `) + item);
    });
  }
  
  // Display key-value pairs
  showKeyValue(data: Record<string, any>, indent: number = 2): void {
    const space = ' '.repeat(indent);
    Object.entries(data).forEach(([key, value]) => {
      console.log(`${space}${chalk.gray(key + ':')} ${chalk.white(value)}`);
    });
  }
  
  // Display code block
  showCode(code: string, language?: string): void {
    console.log();
    if (language) {
      console.log(chalk.gray(`  ${language}:`));
    }
    code.split('\n').forEach(line => {
      console.log(chalk.green('  │ ') + chalk.white(line));
    });
    console.log();
  }
  
  // Clear screen
  clear(): void {
    if (this.isInteractive) {
      console.clear();
    }
  }
  
  // Display summary report
  showSummary(data: {
    title: string;
    stats?: Record<string, any>;
    items?: Array<{ label: string; value: any; status?: 'success' | 'warning' | 'error' }>;
    footer?: string;
  }): void {
    console.log();
    console.log(chalk.bold.underline(data.title));
    console.log();
    
    if (data.stats) {
      this.showKeyValue(data.stats);
      console.log();
    }
    
    if (data.items) {
      data.items.forEach(item => {
        const statusIcon = {
          success: chalk.green('✓'),
          warning: chalk.yellow('⚠'),
          error: chalk.red('✗')
        };
        
        const icon = item.status ? statusIcon[item.status] : chalk.gray('•');
        console.log(`  ${icon} ${chalk.gray(item.label)}: ${item.value}`);
      });
      console.log();
    }
    
    if (data.footer) {
      console.log(chalk.italic.gray(data.footer));
    }
  }
  
  // Display error with details
  showError(error: Error | string, details?: string[]): void {
    console.log();
    console.log(chalk.red.bold('ERROR'));
    console.log(chalk.red(typeof error === 'string' ? error : error.message));
    
    if (details && details.length > 0) {
      console.log();
      console.log(chalk.gray('Details:'));
      details.forEach(detail => {
        console.log(chalk.gray(`  • ${detail}`));
      });
    }
    
    if (this.verboseMode && error instanceof Error && error.stack) {
      console.log();
      console.log(chalk.gray('Stack trace:'));
      console.log(chalk.gray(error.stack));
    }
    console.log();
  }
  
  // Cleanup
  cleanup(): void {
    this.stopAllProgress();
    if (this.spinner) {
      this.spinner.stop();
    }
    
    // Show buffered debug logs if needed
    if (this.logBuffer.length > 0 && this.verboseMode) {
      console.log();
      console.log(chalk.gray('Debug logs:'));
      this.logBuffer.forEach(log => console.log(log));
    }
  }
}