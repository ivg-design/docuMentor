package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// UltraTUI represents the ULTRA DESIGN terminal user interface
type UltraTUI struct {
	app *tview.Application
	
	// Main layout
	mainGrid *tview.Grid
	
	// All panels
	headerPanel      *SimpleHeaderPanel
	infoBar          *InfoBarPanel
	workersPanel     *UltraWorkersPanel
	controlsPanel    *ControlsPanel
	logsPanel        *LogsPanel
	performancePanel *PerformancePanel
	statusPanel      *UltraStatusPanel
}

// NewUltraTUI creates a new ULTRA TUI instance
func NewUltraTUI() *UltraTUI {
	tui := &UltraTUI{
		app: tview.NewApplication(),
	}
	
	// Create all panels
	tui.headerPanel = NewSimpleHeaderPanel()
	tui.infoBar = NewInfoBarPanel()
	tui.workersPanel = NewUltraWorkersPanel()
	tui.controlsPanel = NewControlsPanel(tui.app)
	tui.logsPanel = NewLogsPanel()
	tui.performancePanel = NewPerformancePanel()
	tui.statusPanel = NewUltraStatusPanel()
	
	// Create main grid layout matching ULTRA DESIGN exactly
	tui.setupUltraLayout()
	
	// Setup keyboard handlers
	tui.setupKeyboardHandlers()
	
	return tui
}

// setupUltraLayout creates the ULTRA DESIGN layout
func (t *UltraTUI) setupUltraLayout() {
	// Create main grid with exact ULTRA DESIGN specifications
	// Rows: header(3), infobar(3-with border), workers(4), controls(1), logs(flex), performance(3-with border), status(3-with border)
	t.mainGrid = tview.NewGrid().
		SetRows(3, 3, 4, 1, 0, 3, 3).
		SetColumns(0).
		SetBorders(false)
	
	// Row 0: Header (4 lines - modular with title + split panels)
	t.mainGrid.AddItem(t.headerPanel, 0, 0, 1, 1, 0, 0, false)
	
	// Row 1: Info bar (1 line - phase and stats)
	t.mainGrid.AddItem(t.infoBar, 1, 0, 1, 1, 0, 0, false)
	
	// Row 2: Workers (4 lines - border + 2 content lines + border)
	t.mainGrid.AddItem(t.workersPanel, 2, 0, 1, 1, 0, 0, false)
	
	// Row 3: Controls (1 line - buttons)
	t.mainGrid.AddItem(t.controlsPanel, 3, 0, 1, 1, 0, 0, true)
	
	// Row 4: Logs (flexible height)
	t.mainGrid.AddItem(t.logsPanel, 4, 0, 1, 1, 0, 0, false)
	
	// Row 5: Performance (1 line)
	t.mainGrid.AddItem(t.performancePanel, 5, 0, 1, 1, 0, 0, false)
	
	// Row 6: Status (1 line)
	t.mainGrid.AddItem(t.statusPanel, 6, 0, 1, 1, 0, 0, false)
	
	// Set root
	t.app.SetRoot(t.mainGrid, true).SetFocus(t.controlsPanel)
}

// setupKeyboardHandlers sets up global keyboard shortcuts
func (t *UltraTUI) setupKeyboardHandlers() {
	t.app.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		switch event.Key() {
		case tcell.KeyEscape:
			t.quit()
			return nil
		case tcell.KeyRune:
			switch event.Rune() {
			case 'h', 'H':
				t.showHelp()
				return nil
			case 'p', 'P':
				t.pause()
				return nil
			case 'r', 'R':
				t.resume()
				return nil
			case 'v', 'V':
				t.toggleRaw()
				return nil
			case 'd', 'D':
				t.toggleDebug()
				return nil
			case 'q', 'Q':
				t.quit()
				return nil
			}
		}
		return event
	})
}

// Run starts the ULTRA TUI
func (t *UltraTUI) Run() error {
	// Initialize with test data if in test mode
	if ultraTestMode {
		t.runUltraTestMode()
	}
	
	// Set initial data
	t.headerPanel.UpdateProject("~/github/docuMentor", "./docs", os.Getpid())
	t.statusPanel.SetMessage("System ready - Press [P] to start processing")
	
	return t.app.Run()
}

// Control methods
func (t *UltraTUI) showHelp() {
	helpText := `DocuMentor ULTRA TUI Help

Keyboard Shortcuts:
  [H] - Show this help
  [P] - Pause processing
  [R] - Resume processing
  [V] - Toggle RAW view
  [D] - Toggle Debug mode
  [Esc] or [Q] - Quit

Navigation:
  ↑/↓ - Scroll logs
  Tab - Switch between controls`
	
	modal := tview.NewModal().
		SetText(helpText).
		AddButtons([]string{"Close"}).
		SetDoneFunc(func(buttonIndex int, buttonLabel string) {
			t.app.SetRoot(t.mainGrid, true).SetFocus(t.controlsPanel)
		})
	
	t.app.SetRoot(modal, false)
}

func (t *UltraTUI) pause() {
	t.statusPanel.SetMessage("Processing paused")
	t.logsPanel.AddLog("info", "Processing paused by user", 0)
}

func (t *UltraTUI) resume() {
	t.statusPanel.SetProcessing("src/index.ts", "index.md")
	t.logsPanel.AddLog("info", "Processing resumed", 0)
}

func (t *UltraTUI) toggleRaw() {
	t.logsPanel.AddLog("debug", "RAW mode toggled", 0)
}

func (t *UltraTUI) toggleDebug() {
	t.logsPanel.AddLog("debug", "Debug mode toggled", 0)
}

func (t *UltraTUI) quit() {
	t.headerPanel.Stop()
	t.statusPanel.Stop()
	t.app.Stop()
}

// Update methods for external control
func (t *UltraTUI) UpdateWorker(id int, data WorkerData) {
	t.workersPanel.UpdateWorker(id, data)
	t.app.Draw()
}

func (t *UltraTUI) UpdatePhase(current, total int, name string) {
	t.infoBar.UpdatePhase(current, total, name)
	t.app.Draw()
}

func (t *UltraTUI) UpdateFiles(processed, total int) {
	t.infoBar.UpdateFiles(processed, total)
	t.app.Draw()
}

func (t *UltraTUI) UpdatePerformance(metrics PerformanceMetrics) {
	t.performancePanel.UpdateMetrics(metrics)
	t.app.Draw()
}

func (t *UltraTUI) AddLog(level, message string, workerID int) {
	t.logsPanel.AddLog(level, message, workerID)
	t.app.Draw()
}

var ultraTestMode bool

func main() {
	flag.BoolVar(&ultraTestMode, "test", false, "Run in test mode with simulated data")
	flag.Parse()
	
	// Create and run ULTRA TUI
	tui := NewUltraTUI()
	
	if err := tui.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error running ULTRA TUI: %v\n", err)
		os.Exit(1)
	}
}