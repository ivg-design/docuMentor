package main

import (
	"fmt"
	"strings"
	"time"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// UltraTUI implements the exact ULTRA DESIGN specification
type UltraTUI struct {
	app *tview.Application
	
	// Layout components (exact order from spec)
	headerBar       *tview.TextView  // Line 1: DocuMentor title + connection status
	projectInfoBar  *tview.TextView  // Line 2: Project path | PID, Time
	outputInfoBar   *tview.TextView  // Line 3: Output path | Lock, Elapsed
	phaseBar        *tview.TextView  // Line 5: PHASE [3/9] with progress bar
	fileStatsBar    *tview.TextView  // Line 6: Files, Queue, Rate, Errors
	workerPanel     *tview.TextView  // Lines 8-11: 4 worker boxes
	controlsBar     *tview.TextView  // Line 12: Keyboard shortcuts
	logsPanel       *tview.TextView  // Lines 13-40: Main logs with header
	performanceBar  *tview.TextView  // Line 42: CPU, MEM, DISK, NET
	statusBar       *tview.TextView  // Line 44: Current file + spinner
	
	// State data
	projectPath   string
	outputPath    string
	pid           int
	startTime     time.Time
	connected     bool
	lockStatus    bool
	
	// Phase data
	phaseNum      int
	phaseTotal    int
	phaseName     string
	phasePercent  int
	
	// File stats
	filesProcessed int
	filesTotal     int
	filesQueue     int
	filesRate      float64
	filesErrors    int
	docsComplete   int
	
	// Worker states
	workers       [4]WorkerMessageData
	
	// Performance metrics
	cpuPercent    int
	memUsed       int
	memTotal      int
	diskSpeed     int
	netDown       int
	netUp         int
	
	// Current status
	currentFile   string
	spinnerIndex  int
	spinnerChars  []string
}

// NewUltraTUI creates the EXACT layout from ULTRA DESIGN
func NewUltraTUI() *UltraTUI {
	tui := &UltraTUI{
		app:          tview.NewApplication(),
		startTime:    time.Now(),
		spinnerChars: []string{"●", "●●", "●●●"},
		phaseTotal:   9,
		connected:    true,
		lockStatus:   true,
		memTotal:     2048, // 2GB
	}
	
	// Create all components
	tui.headerBar = tview.NewTextView().SetDynamicColors(true)
	tui.projectInfoBar = tview.NewTextView().SetDynamicColors(true)
	tui.outputInfoBar = tview.NewTextView().SetDynamicColors(true)
	tui.phaseBar = tview.NewTextView().SetDynamicColors(true)
	tui.fileStatsBar = tview.NewTextView().SetDynamicColors(true)
	tui.workerPanel = tview.NewTextView().SetDynamicColors(true)
	tui.controlsBar = tview.NewTextView().SetDynamicColors(true)
	tui.logsPanel = tview.NewTextView().SetDynamicColors(true).SetScrollable(true)
	tui.performanceBar = tview.NewTextView().SetDynamicColors(true)
	tui.statusBar = tview.NewTextView().SetDynamicColors(true)
	
	// Build exact layout from spec
	layout := tview.NewFlex().SetDirection(tview.FlexRow).
		AddItem(tui.headerBar, 1, 0, false).       // Line 1
		AddItem(tui.projectInfoBar, 1, 0, false).  // Line 2
		AddItem(tui.outputInfoBar, 1, 0, false).   // Line 3
		AddItem(tui.createSeparator(), 1, 0, false). // Line 4
		AddItem(tui.phaseBar, 1, 0, false).        // Line 5
		AddItem(tui.fileStatsBar, 1, 0, false).    // Line 6
		AddItem(tui.createSeparator(), 1, 0, false). // Line 7
		AddItem(tui.workerPanel, 4, 0, false).     // Lines 8-11 (4 lines for workers)
		AddItem(tui.controlsBar, 1, 0, false).     // Line 12
		AddItem(tui.logsPanel, 0, 1, true).        // Lines 13-41 (flexible height)
		AddItem(tui.performanceBar, 1, 0, false).  // Line 42
		AddItem(tui.createSeparator(), 1, 0, false). // Line 43
		AddItem(tui.statusBar, 1, 0, false)        // Line 44
	
	// Wrap in border
	bordered := tview.NewFrame(layout).
		SetBorders(1, 1, 1, 1, 1, 1)
	
	tui.app.SetRoot(bordered, true)
	
	// Set up input handling
	tui.app.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		switch event.Key() {
		case tcell.KeyEsc:
			tui.app.Stop()
			return nil
		case tcell.KeyRune:
			switch event.Rune() {
			case 'q', 'Q':
				tui.app.Stop()
				return nil
			case 'p', 'P':
				// Pause/Resume
				return nil
			case 'd', 'D':
				// Debug mode
				return nil
			case 'v', 'V':
				// Verbose/Raw mode
				return nil
			}
		}
		return event
	})
	
	// Start update loops
	go tui.updateLoop()
	
	return tui
}

func (t *UltraTUI) createSeparator() *tview.TextView {
	sep := tview.NewTextView()
	sep.SetText(strings.Repeat("─", 93))
	return sep
}

func (t *UltraTUI) updateLoop() {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	
	for range ticker.C {
		t.app.QueueUpdateDraw(func() {
			t.updateHeader()
			t.updateProjectInfo()
			t.updateOutputInfo()
			t.updatePhaseBar()
			t.updateFileStats()
			t.updateWorkerPanel()
			t.updateControlsBar()
			t.updatePerformanceBar()
			t.updateStatusBar()
			
			// Update spinner
			t.spinnerIndex = (t.spinnerIndex + 1) % len(t.spinnerChars)
		})
	}
}

func (t *UltraTUI) updateHeader() {
	// Exact format from spec: ┌─ DocuMentor v3.2.0 ─────...───── [●] Connected ───┐
	status := "[green]●[white] Connected"
	if !t.connected {
		status = "[red]○[white] Disconnected"
	}
	
	header := fmt.Sprintf("[white::b]─ DocuMentor v3.2.0 ─%s [%s] ─",
		strings.Repeat("─", 50), status)
	t.headerBar.SetText(header)
}

func (t *UltraTUI) updateProjectInfo() {
	// Line 2: Project: ~/github/bm_player_template | PID: 45789   Time: 21:20:15
	currentTime := time.Now().Format("15:04:05")
	text := fmt.Sprintf("│ Project: %-45s │ PID: %-8d Time: %s │",
		t.projectPath, t.pid, currentTime)
	t.projectInfoBar.SetText(text)
}

func (t *UltraTUI) updateOutputInfo() {
	// Line 3: Output: ~/obsidian_vault/docs/bm_player_docs | Lock: ✓  Elapsed: 00:25
	elapsed := time.Since(t.startTime)
	elapsedStr := fmt.Sprintf("%02d:%02d", int(elapsed.Minutes()), int(elapsed.Seconds())%60)
	lockStr := "✓"
	if !t.lockStatus {
		lockStr = "✗"
	}
	
	text := fmt.Sprintf("│ Output:  %-45s │ Lock: %s      Elapsed: %s │",
		t.outputPath, lockStr, elapsedStr)
	t.outputInfoBar.SetText(text)
}

func (t *UltraTUI) updatePhaseBar() {
	// Line 5: PHASE [3/9] Analysis with progress bar
	progressWidth := 60
	filled := (t.phasePercent * progressWidth) / 100
	
	progressBar := strings.Repeat("█", filled) + strings.Repeat("░", progressWidth-filled)
	
	text := fmt.Sprintf("│ PHASE [%d/%d] %-20s %s %3d%% │",
		t.phaseNum, t.phaseTotal, t.phaseName, progressBar, t.phasePercent)
	t.phaseBar.SetText(text)
}

func (t *UltraTUI) updateFileStats() {
	// Line 6: Files: 156/487  Queue: 331  Rate: 6.2/s  Errors: 2  docs complete: 3
	text := fmt.Sprintf("│ Files: %d/%d         Queue: %d           Rate: %.1f/s    Errors: %d  docs complete: %d  │",
		t.filesProcessed, t.filesTotal, t.filesQueue, t.filesRate, t.filesErrors, t.docsComplete)
	t.fileStatsBar.SetText(text)
}

func (t *UltraTUI) updateWorkerPanel() {
	// Lines 8-11: Worker boxes EXACTLY as specified
	var lines []string
	
	// Top border of workers
	lines = append(lines, "│ ┌─[W1]─"+t.getWorkerState(0)+"──────────┐ ┌─[W2]─"+t.getWorkerState(1)+"──────────┐ ┌─[W3]─"+t.getWorkerState(2)+"──────────┐ ┌─[W4]─"+t.getWorkerState(3)+"───────┐│")
	
	// Worker content line 1 (file)
	line2 := "│ │"
	for i := 0; i < 4; i++ {
		file := t.truncate(t.workers[i].File, 18)
		line2 += fmt.Sprintf(" %-18s │", file)
		if i < 3 {
			line2 += " │"
		}
	}
	line2 += "│"
	lines = append(lines, line2)
	
	// Worker content line 2 (operation)
	line3 := "│ │"
	for i := 0; i < 4; i++ {
		op := t.getWorkerOperation(i)
		line3 += fmt.Sprintf(" %-18s │", op)
		if i < 3 {
			line3 += " │"
		}
	}
	line3 += "│"
	lines = append(lines, line3)
	
	// Bottom border of workers
	lines = append(lines, "│ └────────────────────┘ └────────────────────┘ └────────────────────┘ └─────────────────┘│")
	
	t.workerPanel.SetText(strings.Join(lines, "\n"))
}

func (t *UltraTUI) getWorkerState(idx int) string {
	switch t.workers[idx].State {
	case WorkerStateBusy:
		return "[green]BUSY[white]"
	case WorkerStateIdle:
		return "[gray]IDLE[white]"
	case WorkerStateBlocked:
		return "[yellow]BLOCKED[white]"
	case WorkerStateError:
		return "[red]ERROR[white]"
	case WorkerStateComplete:
		return "[blue]COMPLETE[white]"
	default:
		return "IDLE"
	}
}

func (t *UltraTUI) getWorkerOperation(idx int) string {
	w := &t.workers[idx]
	switch w.State {
	case WorkerStateBusy:
		if w.TimeElapsed > 0 {
			return fmt.Sprintf("%s [%ds]", w.Operation, w.TimeElapsed/1000)
		}
		return w.Operation
	case WorkerStateIdle:
		if w.Stats.Completed > 0 {
			return fmt.Sprintf("completed: %d", w.Stats.Completed)
		}
		return "⚡ waiting..."
	case WorkerStateBlocked:
		return "waiting for Claude"
	default:
		return ""
	}
}

func (t *UltraTUI) updateControlsBar() {
	// Line 12: CONTROLS with keyboard shortcuts
	text := "│ CONTROLS ───────────────────────────────────────────────────────────────────────────────│\n"
	text += "│ [H]elp  [P]ause  [R]esume  [V] RAW   [D] Debug  [Esc] Exit  [↑↓] Scroll                 │"
	t.controlsBar.SetText(text)
}

func (t *UltraTUI) updatePerformanceBar() {
	// Line 42: Performance metrics
	cpuBar := t.makeProgressBar(t.cpuPercent, 10)
	memBar := t.makeProgressBar((t.memUsed*100)/t.memTotal, 10)
	
	text := fmt.Sprintf("│ PERFORMANCE ────────────────────────────────────────────────────────────────────────────│\n")
	text += fmt.Sprintf("│ CPU: %s %d%%  MEM: %s %dMB/%dGB  DISK: %dMB/s  NET: ↓%dKB/s ↑%dKB/s     │",
		cpuBar, t.cpuPercent,
		memBar, t.memUsed, t.memTotal/1024,
		t.diskSpeed,
		t.netDown, t.netUp)
	t.performanceBar.SetText(text)
}

func (t *UltraTUI) updateStatusBar() {
	// Line 44: Status with current file and spinner
	spinner := t.spinnerChars[t.spinnerIndex]
	text := fmt.Sprintf("│ STATUS: Processing \"%s\" → %s.md          [%s] spinning  │",
		t.currentFile, strings.TrimSuffix(t.currentFile, ".tsx"), spinner)
	t.statusBar.SetText(text)
}

func (t *UltraTUI) makeProgressBar(percent int, width int) string {
	filled := (percent * width) / 100
	return strings.Repeat("█", filled) + strings.Repeat("░", width-filled)
}

func (t *UltraTUI) truncate(text string, maxLen int) string {
	if len(text) <= maxLen {
		return text
	}
	if maxLen <= 3 {
		return "..."
	}
	return text[:maxLen-3] + "..."
}

// Test data initialization
func (t *UltraTUI) InitTestData() {
	t.projectPath = "~/github/bm_player_template"
	t.outputPath = "~/obsidian_vault/docs/bm_player_docs"
	t.pid = 45789
	
	t.phaseNum = 3
	t.phaseName = "Analysis"
	t.phasePercent = 33
	
	t.filesProcessed = 156
	t.filesTotal = 487
	t.filesQueue = 331
	t.filesRate = 6.2
	t.filesErrors = 2
	t.docsComplete = 3
	
	// Initialize workers as per spec
	t.workers[0] = WorkerMessageData{
		WorkerID: 1,
		State: WorkerStateBusy,
		File: "src/index.js",
		Operation: "analyzing",
		TimeElapsed: 12000,
	}
	t.workers[1] = WorkerMessageData{
		WorkerID: 2,
		State: WorkerStateIdle,
		Stats: WorkerStats{Completed: 42},
	}
	t.workers[2] = WorkerMessageData{
		WorkerID: 3,
		State: WorkerStateBusy,
		File: "main.tsx",
		Operation: "generating",
		TimeElapsed: 3000,
	}
	t.workers[3] = WorkerMessageData{
		WorkerID: 4,
		State: WorkerStateBusy,
		File: "README.md",
		Operation: "reading",
		TimeElapsed: 1000,
	}
	
	// Performance metrics
	t.cpuPercent = 78
	t.memUsed = 234
	t.diskSpeed = 45
	t.netDown = 128
	t.netUp = 12
	
	t.currentFile = "src/components/Button.tsx"
	
	// Add sample logs
	logs := []string{
		"[white]│ LOGS ─────────────────────────────────────────────────────────────────── [Auto-scroll]  │",
		"│ 21:20:14 [[green]INFO [white]] Starting efficient document processing                                 │",
		"│ 21:20:14 [[green]INFO [white]] Found 487 documentable files                                           │",
		"│ 21:20:14 [[green]INFO [white]] Starting 4 parallel workers                                            │",
		"│ 21:20:15 [[cyan]WORK1[white]] Processing: src/index.js (JavaScript, 12KB)                            │",
		"│ 21:20:15 [[cyan]WORK3[white]] Processing: main.tsx (TypeScript React, 8KB)                           │",
		"│ 21:20:15 [[cyan]WORK4[white]] Processing: README.md (Markdown, 15KB)                                 │",
		"│ 21:20:16 [[cyan]WORK2[white]] [green]✓[white] Completed: package.json (4KB) in 1.2s                                │",
		"│ 21:20:16 [[cyan]WORK2[white]] [green]✓[white] Completed: tsconfig.json (2KB) in 0.8s                               │",
		"│ 21:20:17 [[red]ERROR[white]] Failed: src/broken.js - Syntax error at line 42                        │",
		"│ 21:20:17 [[yellow]WARN [white]] Retrying: src/broken.js (attempt 2/3)                                  │",
		"│ 21:20:18 [[cyan]WORK1[white]] Claude processing... (waiting for response)                            │",
		"│ 21:20:19 [[green]INFO [white]] Output saved: ~/obsidian_vault/docs/bm_player_docs/package_json.md     │",
		"│                                                                         ▼ 156 more lines│",
	}
	t.logsPanel.SetText(strings.Join(logs, "\n"))
}

// Run starts the Ultra TUI
func (t *UltraTUI) Run() error {
	return t.app.Run()
}

// RunUltraTest runs the Ultra TUI in test mode
func RunUltraTest() {
	tui := NewUltraTUI()
	tui.InitTestData()
	
	// Animate some values
	go func() {
		ticker := time.NewTicker(500 * time.Millisecond)
		progress := 0
		for range ticker.C {
			progress = (progress + 2) % 100
			tui.phasePercent = progress
			tui.filesProcessed = 156 + progress
			tui.workers[0].TimeElapsed += 500
			tui.workers[2].TimeElapsed += 500
			
			// Occasionally change worker states
			if progress == 50 {
				tui.workers[1].State = WorkerStateBusy
				tui.workers[1].File = "config.json"
				tui.workers[1].Operation = "processing"
			} else if progress == 0 {
				tui.workers[1].State = WorkerStateIdle
				tui.workers[1].File = ""
				tui.workers[1].Stats.Completed++
			}
		}
	}()
	
	if err := tui.Run(); err != nil {
		fmt.Printf("Error: %v\n", err)
	}
}