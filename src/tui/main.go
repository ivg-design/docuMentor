package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// TUI represents the main terminal user interface
type TUI struct {
	app *tview.Application
	
	// Main layout
	mainGrid *tview.Grid
	
	// All panels
	headerPanel      *HeaderPanel
	phasePanel       *PhasePanel
	workersPanel     *WorkersPanel
	statsPanel       *StatsPanel
	logsPanel        *LogsPanel
	performancePanel *PerformancePanel
	statusPanel      *StatusPanel
	
	// State
	isRunning bool
	isPaused  bool
	
	// Launcher for Node.js process
	launcher *Launcher
	projectPath string
	outputPath string
}

// NewTUI creates a new TUI instance
func NewTUI() *TUI {
	tui := &TUI{
		app: tview.NewApplication(),
	}
	
	// Create all panels
	tui.headerPanel = NewHeaderPanel()
	tui.phasePanel = NewPhasePanel()
	tui.workersPanel = NewWorkersPanel()
	tui.statsPanel = NewStatsPanel()
	tui.logsPanel = NewLogsPanel()
	tui.performancePanel = NewPerformancePanel()
	tui.statusPanel = NewStatusPanel()
	
	// Create main grid layout
	tui.setupLayout()
	
	// Setup keyboard handlers
	tui.setupKeyboardHandlers()
	
	return tui
}

// setupLayout creates the main layout grid
func (t *TUI) setupLayout() {
	// Create main grid matching ULTRA DESIGN exactly
	// Rows: header(2), phase+stats(2), workers(3), controls(1), logs(0=flex), performance(2), status(1)
	t.mainGrid = tview.NewGrid().
		SetRows(2, 2, 3, 1, 0, 2, 1).
		SetColumns(0).  // Single column, panels handle their own layout
		SetBorders(false)
	
	// Row 1: Header (2 lines)
	t.mainGrid.AddItem(t.headerPanel, 0, 0, 1, 1, 0, 0, false)
	
	// Row 2: Phase + Stats combo (2 lines)
	phaseStatsFlex := tview.NewFlex().
		AddItem(t.phasePanel, 0, 3, false).
		AddItem(t.statsPanel, 0, 1, false)
	t.mainGrid.AddItem(phaseStatsFlex, 1, 0, 1, 1, 0, 0, false)
	
	// Row 3: Workers (3 lines)
	t.mainGrid.AddItem(t.workersPanel, 2, 0, 1, 1, 0, 0, false)
	
	// Row 4: Controls (1 line)
	controlsView := tview.NewTextView().
		SetDynamicColors(true).
		SetTextAlign(tview.AlignCenter).
		SetText("[yellow][H][white]elp  [yellow][P][white]ause  [yellow][R][white]esume  [yellow][V][white] RAW  [yellow][D][white] Debug  [yellow][Esc][white] Exit  [yellow][↑↓][white] Scroll")
	controlsView.SetBorder(false)
	t.mainGrid.AddItem(controlsView, 3, 0, 1, 1, 0, 0, false)
	
	// Row 5: Logs (flexible height)
	t.mainGrid.AddItem(t.logsPanel, 4, 0, 1, 1, 0, 0, false)
	
	// Row 6: Performance (2 lines)
	t.mainGrid.AddItem(t.performancePanel, 5, 0, 1, 1, 0, 0, false)
	
	// Row 7: Status (1 line)
	t.mainGrid.AddItem(t.statusPanel, 6, 0, 1, 1, 0, 0, false)
	
	// Set root
	t.app.SetRoot(t.mainGrid, true)
}

// setupKeyboardHandlers sets up global keyboard shortcuts
func (t *TUI) setupKeyboardHandlers() {
	t.app.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		switch event.Key() {
		case tcell.KeyF1:
			t.showHelp()
			return nil
		case tcell.KeyF2:
			t.showConfig()
			return nil
		case tcell.KeyF5:
			t.refresh()
			return nil
		case tcell.KeyF10:
			t.quit()
			return nil
		case tcell.KeyEnter:
			if !t.isRunning {
				t.start()
			}
			return nil
		case tcell.KeyRune:
			switch event.Rune() {
			case ' ':
				t.togglePause()
				return nil
			case 'q', 'Q':
				t.quit()
				return nil
			case 'c', 'C':
				t.logsPanel.Clear()
				return nil
			case 'r', 'R':
				t.refresh()
				return nil
			}
		}
		return event
	})
}

// Run starts the TUI
func (t *TUI) Run() error {
	// Initialize with test data if in test mode
	if testMode {
		t.startTestMode()
	}
	
	return t.app.Run()
}

// start begins processing
func (t *TUI) start() {
	if t.launcher != nil && t.launcher.IsRunning() {
		t.logsPanel.AddLog("warn", "Processing already in progress", 0)
		return
	}
	
	t.isRunning = true
	t.isPaused = false
	t.statusPanel.SetRunning("Starting Node.js process...")
	t.logsPanel.AddLog("info", "Starting document processing", 0)
	
	// Create and start launcher
	t.launcher = NewLauncher(t, t.projectPath, t.outputPath)
	if err := t.launcher.Start(); err != nil {
		t.logsPanel.AddLog("error", fmt.Sprintf("Failed to start launcher: %v", err), 0)
		t.statusPanel.SetError("Failed to start processing")
		t.isRunning = false
		return
	}
	
	t.statusPanel.SetRunning("Processing documents...")
}

// togglePause toggles pause state
func (t *TUI) togglePause() {
	if !t.isRunning {
		return
	}
	
	t.isPaused = !t.isPaused
	if t.isPaused {
		if t.launcher != nil {
			t.launcher.SendControlMessage("pause")
		}
		t.statusPanel.SetPaused()
		t.logsPanel.AddLog("info", "Processing paused", 0)
	} else {
		if t.launcher != nil {
			t.launcher.SendControlMessage("resume")
		}
		t.statusPanel.SetRunning("Processing resumed...")
		t.logsPanel.AddLog("info", "Processing resumed", 0)
	}
}

// refresh refreshes the display
func (t *TUI) refresh() {
	t.app.Draw()
	t.logsPanel.AddLog("debug", "Display refreshed", 0)
}

// quit exits the application
func (t *TUI) quit() {
	if t.launcher != nil && t.launcher.IsRunning() {
		t.launcher.Stop()
	}
	t.headerPanel.Stop()
	t.app.Stop()
}

// showHelp displays help information
func (t *TUI) showHelp() {
	helpText := `DocuMentor TUI Help

Keyboard Shortcuts:
  F1     - Show this help
  F2     - Show configuration
  F5     - Refresh display
  F10    - Quit application
  Space  - Pause/Resume
  Enter  - Start processing
  C      - Clear logs
  Q      - Quit

Navigation:
  Tab    - Switch panels
  PgUp   - Scroll up in logs
  PgDn   - Scroll down in logs`
	
	modal := tview.NewModal().
		SetText(helpText).
		AddButtons([]string{"Close"}).
		SetDoneFunc(func(buttonIndex int, buttonLabel string) {
			t.app.SetRoot(t.mainGrid, true)
		})
	
	t.app.SetRoot(modal, false)
}

// showConfig displays configuration
func (t *TUI) showConfig() {
	t.logsPanel.AddLog("info", "Configuration dialog not yet implemented", 0)
}

// UpdateWorker updates a specific worker's state
func (t *TUI) UpdateWorker(id int, data WorkerData) {
	t.workersPanel.UpdateWorker(id, data)
	t.app.Draw()
}

// UpdatePhase updates the current phase
func (t *TUI) UpdatePhase(data PhaseData) {
	t.phasePanel.UpdatePhase(data)
	t.app.Draw()
}

// UpdateStats updates file statistics
func (t *TUI) UpdateStats(stats FileStats) {
	t.statsPanel.UpdateStats(stats)
	t.app.Draw()
}

// UpdatePerformance updates performance metrics
func (t *TUI) UpdatePerformance(metrics PerformanceMetrics) {
	t.performancePanel.UpdateMetrics(metrics)
	t.app.Draw()
}

// startTestMode starts the TUI in test mode with simulated data
func (t *TUI) startTestMode() {
	t.AddLog("info", "Running in test mode with simulated data", 0)
	// Simulate some test data
	for i := 1; i <= 4; i++ {
		t.UpdateWorker(i, WorkerData{
			ID:    i,
			State: WorkerStateIdle,
			File:  "",
		})
	}
}

// AddLog adds a log entry
func (t *TUI) AddLog(level, message string, workerID int) {
	t.logsPanel.AddLog(level, message, workerID)
	t.app.Draw()
}

// Variables for command line flags
var (
	testMode bool
	verbose  bool
)

func main() {
	// Parse command line flags
	flag.BoolVar(&testMode, "test", false, "Run in test mode with simulated data")
	flag.BoolVar(&verbose, "verbose", false, "Enable verbose output")
	flag.Parse()
	
	// Get command and arguments
	args := flag.Args()
	
	// Default values
	projectPath := "."
	outputPath := "./docs"
	
	// Parse command
	if len(args) > 0 {
		command := args[0]
		if command == "generate" && len(args) > 1 {
			projectPath = args[1]
			// Look for --output flag
			for i, arg := range args {
				if arg == "--output" && i+1 < len(args) {
					outputPath = args[i+1]
				}
			}
		}
	}
	
	// Create and run TUI
	tui := NewTUI()
	tui.projectPath = projectPath
	tui.outputPath = outputPath
	
	// Set initial project info
	tui.headerPanel.UpdateProject(ProjectInfo{
		Name:       filepath.Base(projectPath),
		Type:       "TypeScript",
		Framework:  "Node.js",
		Path:       projectPath,
		Connection: "Node.js",
		PID:        os.Getpid(),
		Output:     outputPath,
		Lock:       "Ready",
	})
	
	// If not in test mode and command is generate, auto-start
	if !testMode && len(args) > 0 && args[0] == "generate" {
		// Delay start to allow TUI to initialize
		go func() {
			time.Sleep(500 * time.Millisecond)
			tui.start()
		}()
	}
	
	// Run the TUI
	if err := tui.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error running TUI: %v\n", err)
		os.Exit(1)
	}
}