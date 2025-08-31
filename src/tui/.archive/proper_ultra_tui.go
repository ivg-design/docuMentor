package main

import (
	"fmt"
	"strings"
	"time"
	"sync"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// ProperUltraTUI implements the ULTRA DESIGN using actual tview components
type ProperUltraTUI struct {
	app *tview.Application
	
	// Main container
	grid *tview.Grid
	
	// Header components
	titleBox        *tview.TextView
	connectionBox   *tview.TextView
	projectBox      *tview.TextView
	outputBox       *tview.TextView
	pidBox          *tview.TextView
	timeBox         *tview.TextView
	lockBox         *tview.TextView
	elapsedBox      *tview.TextView
	
	// Phase and progress
	phaseBox        *tview.TextView
	phaseProgress   *tview.TextView  // Use TextView for progress bar
	fileStatsBox    *tview.TextView
	
	// Worker panels (4 separate boxes)
	workerBoxes     [4]*tview.Frame
	workerContent   [4]*tview.TextView
	
	// Controls
	controlsBox     *tview.TextView
	
	// Main log area
	logsView        *tview.TextView
	
	// Performance metrics
	cpuProgress     *tview.TextView  // Use TextView for CPU gauge
	memProgress     *tview.TextView  // Use TextView for MEM gauge
	perfMetricsBox  *tview.TextView
	
	// Status bar
	statusBox       *tview.TextView
	
	// State
	state           *UltraState
	spinnerIndex    int
	spinnerFrames   []string
	mu              sync.RWMutex
}

// NewProperUltraTUI creates a properly designed TUI with real components
func NewProperUltraTUI() *ProperUltraTUI {
	tui := &ProperUltraTUI{
		app:           tview.NewApplication(),
		state:         NewUltraState(),
		spinnerFrames: []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"},
	}
	
	tui.createComponents()
	tui.buildLayout()
	tui.initializeTestData()
	
	// Start animation loops
	go tui.animationLoop()
	go tui.metricsUpdateLoop()
	
	return tui
}

func (t *ProperUltraTUI) createComponents() {
	// Title and connection status
	t.titleBox = tview.NewTextView().
		SetTextAlign(tview.AlignCenter).
		SetDynamicColors(true).
		SetText("[::b]DocuMentor v3.2.0[::-]")
	
	t.connectionBox = tview.NewTextView().
		SetTextAlign(tview.AlignRight).
		SetDynamicColors(true).
		SetText("[green]● Connected[-]")
	
	// Project info row
	t.projectBox = tview.NewTextView().
		SetDynamicColors(true)
	
	t.pidBox = tview.NewTextView().
		SetTextAlign(tview.AlignRight).
		SetDynamicColors(true)
	
	t.timeBox = tview.NewTextView().
		SetTextAlign(tview.AlignRight).
		SetDynamicColors(true)
	
	// Output info row  
	t.outputBox = tview.NewTextView().
		SetDynamicColors(true)
	
	t.lockBox = tview.NewTextView().
		SetTextAlign(tview.AlignRight).
		SetDynamicColors(true)
	
	t.elapsedBox = tview.NewTextView().
		SetTextAlign(tview.AlignRight).
		SetDynamicColors(true)
	
	// Phase and progress
	t.phaseBox = tview.NewTextView().
		SetDynamicColors(true)
	
	t.phaseProgress = tview.NewTextView().
		SetDynamicColors(true)
	
	t.fileStatsBox = tview.NewTextView().
		SetDynamicColors(true)
	
	// Create 4 worker boxes with proper frames
	for i := 0; i < 4; i++ {
		t.workerContent[i] = tview.NewTextView().
			SetDynamicColors(true).
			SetTextAlign(tview.AlignLeft)
		
		title := fmt.Sprintf(" W%d ", i+1)
		t.workerBoxes[i] = tview.NewFrame(t.workerContent[i]).
			SetBorders(1, 1, 1, 1, 1, 1).
			AddText(title, true, tview.AlignLeft, tcell.ColorWhite)
	}
	
	// Controls
	t.controlsBox = tview.NewTextView().
		SetDynamicColors(true).
		SetText("[::b]CONTROLS[::-] [yellow][H][-]elp  [yellow][P][-]ause  [yellow][R][-]esume  [yellow][V][-] View RAW  [yellow][D][-] Debug  [yellow][Esc][-] Exit  [yellow][↑↓][-] Scroll")
	
	// Main logs
	t.logsView = tview.NewTextView().
		SetDynamicColors(true).
		SetScrollable(true).
		SetChangedFunc(func() {
			t.app.Draw()
		})
	t.logsView.SetBorder(true).
		SetTitle(" LOGS ").
		SetTitleAlign(tview.AlignLeft).
		SetBorderPadding(0, 0, 1, 1)
	
	// Performance metrics
	t.cpuProgress = tview.NewTextView().
		SetDynamicColors(true)
	
	t.memProgress = tview.NewTextView().
		SetDynamicColors(true)
	
	t.perfMetricsBox = tview.NewTextView().
		SetDynamicColors(true)
	
	// Status bar
	t.statusBox = tview.NewTextView().
		SetDynamicColors(true)
}

func (t *ProperUltraTUI) buildLayout() {
	// Create header section with project/output info
	headerGrid := tview.NewGrid().
		SetRows(1, 1, 1).
		SetColumns(0, 20, 20).
		AddItem(t.titleBox, 0, 0, 1, 1, 0, 0, false).
		AddItem(t.connectionBox, 0, 2, 1, 1, 0, 0, false).
		AddItem(t.projectBox, 1, 0, 1, 1, 0, 0, false).
		AddItem(t.pidBox, 1, 1, 1, 1, 0, 0, false).
		AddItem(t.timeBox, 1, 2, 1, 1, 0, 0, false).
		AddItem(t.outputBox, 2, 0, 1, 1, 0, 0, false).
		AddItem(t.lockBox, 2, 1, 1, 1, 0, 0, false).
		AddItem(t.elapsedBox, 2, 2, 1, 1, 0, 0, false)
	
	headerBox := tview.NewFrame(headerGrid).
		SetBorders(1, 1, 1, 1, 0, 0)
	
	// Phase section
	phaseGrid := tview.NewGrid().
		SetRows(1, 1).
		SetColumns(30, 0, 15).
		AddItem(t.phaseBox, 0, 0, 1, 1, 0, 0, false).
		AddItem(t.phaseProgress, 0, 1, 1, 1, 0, 0, false).
		AddItem(tview.NewTextView(), 0, 2, 1, 1, 0, 0, false). // percentage placeholder
		AddItem(t.fileStatsBox, 1, 0, 1, 3, 0, 0, false)
	
	phaseSection := tview.NewFrame(phaseGrid).
		SetBorders(1, 1, 0, 0, 0, 0)
	
	// Worker section - horizontal flex with 4 workers
	workerFlex := tview.NewFlex().SetDirection(tview.FlexColumn)
	for i := 0; i < 4; i++ {
		workerFlex.AddItem(t.workerBoxes[i], 0, 1, false)
	}
	
	workerSection := tview.NewFrame(workerFlex).
		SetBorders(1, 1, 0, 0, 0, 0)
	
	// Controls section
	controlSection := tview.NewFrame(t.controlsBox).
		SetBorders(1, 1, 0, 0, 0, 0)
	
	// Performance section
	perfGrid := tview.NewGrid().
		SetRows(1).
		SetColumns(20, 20, 0).
		AddItem(t.cpuProgress, 0, 0, 1, 1, 0, 0, false).
		AddItem(t.memProgress, 0, 1, 1, 1, 0, 0, false).
		AddItem(t.perfMetricsBox, 0, 2, 1, 1, 0, 0, false)
	
	perfSection := tview.NewFrame(perfGrid).
		SetBorders(1, 0, 0, 0, 0, 0).
		AddText("PERFORMANCE", true, tview.AlignLeft, tcell.ColorWhite)
	
	// Status section
	statusSection := tview.NewFrame(t.statusBox).
		SetBorders(1, 0, 0, 0, 0, 0).
		AddText("STATUS", true, tview.AlignLeft, tcell.ColorWhite)
	
	// Main layout using Grid
	t.grid = tview.NewGrid().
		SetRows(4, 3, 5, 2, 0, 2, 2).  // header, phase, workers, controls, logs, perf, status
		SetColumns(0).
		AddItem(headerBox, 0, 0, 1, 1, 0, 0, false).
		AddItem(phaseSection, 1, 0, 1, 1, 0, 0, false).
		AddItem(workerSection, 2, 0, 1, 1, 0, 0, false).
		AddItem(controlSection, 3, 0, 1, 1, 0, 0, false).
		AddItem(t.logsView, 4, 0, 1, 1, 0, 0, true).  // Focus on logs
		AddItem(perfSection, 5, 0, 1, 1, 0, 0, false).
		AddItem(statusSection, 6, 0, 1, 1, 0, 0, false)
	
	// Set root
	t.app.SetRoot(t.grid, true).EnableMouse(true)
	
	// Input handling
	t.app.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		switch event.Key() {
		case tcell.KeyEsc:
			t.app.Stop()
			return nil
		case tcell.KeyUp:
			// Scroll up manually
			row, _ := t.logsView.GetScrollOffset()
			t.logsView.ScrollTo(row-1, 0)
			return nil
		case tcell.KeyDown:
			// Scroll down manually
			row, _ := t.logsView.GetScrollOffset()
			t.logsView.ScrollTo(row+1, 0)
			return nil
		case tcell.KeyPgUp:
			// Page up
			row, _ := t.logsView.GetScrollOffset()
			t.logsView.ScrollTo(row-10, 0)
			return nil
		case tcell.KeyPgDn:
			// Page down
			row, _ := t.logsView.GetScrollOffset()
			t.logsView.ScrollTo(row+10, 0)
			return nil
		case tcell.KeyRune:
			switch event.Rune() {
			case 'q', 'Q':
				t.app.Stop()
			case 'p', 'P':
				// Pause logic
			case 'r', 'R':
				// Resume logic
			case 'd', 'D':
				// Debug toggle
			case 'v', 'V':
				// View raw toggle
			}
		}
		return event
	})
}

func (t *ProperUltraTUI) updateDisplay() {
	t.mu.RLock()
	defer t.mu.RUnlock()
	
	// Update header info
	t.projectBox.SetText(fmt.Sprintf("Project: %s", t.state.ProjectPath))
	t.pidBox.SetText(fmt.Sprintf("PID: %d", t.state.PID))
	t.timeBox.SetText(time.Now().Format("15:04:05"))
	
	t.outputBox.SetText(fmt.Sprintf("Output: %s", t.state.OutputPath))
	if t.state.LockStatus {
		t.lockBox.SetText("[green]Lock: ✓[-]")
	} else {
		t.lockBox.SetText("[red]Lock: ✗[-]")
	}
	
	elapsed := time.Since(t.state.StartTime)
	t.elapsedBox.SetText(fmt.Sprintf("Elapsed: %02d:%02d", 
		int(elapsed.Minutes()), int(elapsed.Seconds())%60))
	
	// Update phase
	t.phaseBox.SetText(fmt.Sprintf("[::b]PHASE [%d/%d] %s[::-]",
		t.state.Phase.Current, t.state.Phase.Total, t.state.Phase.Name))
	
	percentage := t.state.CalculatePhasePercentage()
	progressBar := t.makeProgressBar(percentage, 40)
	t.phaseProgress.SetText(fmt.Sprintf("%s %d%%", progressBar, percentage))
	
	// Update file stats
	t.fileStatsBox.SetText(fmt.Sprintf(
		"Files: [yellow]%d/%d[-]  Queue: [cyan]%d[-]  Rate: [green]%.1f/s[-]  Errors: [red]%d[-]  Docs: [green]%d[-]",
		t.state.Files.Processed, t.state.Files.Total,
		t.state.Files.Queue, t.state.Files.Rate,
		t.state.Files.Failed, t.state.DocsComplete))
	
	// Update workers
	for i := 0; i < 4; i++ {
		t.updateWorkerDisplay(i)
	}
	
	// Update performance metrics
	cpuBar := t.makeProgressBar(int(t.state.Metrics.CPU), 10)
	t.cpuProgress.SetText(fmt.Sprintf("CPU: %s %d%%", cpuBar, int(t.state.Metrics.CPU)))
	
	memPct := t.state.GetMemoryPercentage()
	memBar := t.makeProgressBar(memPct, 10)
	t.memProgress.SetText(fmt.Sprintf("MEM: %s %d%%", memBar, memPct))
	
	t.perfMetricsBox.SetText(fmt.Sprintf(
		"DISK: %dMB/s  NET: ↓%dKB/s ↑%dKB/s  Claude: %d/%d calls",
		t.state.Metrics.Disk.Read/1024/1024,
		t.state.Metrics.Network.Down/1024,
		t.state.Metrics.Network.Up/1024,
		t.state.Metrics.Claude.Calls,
		t.state.Metrics.Claude.MaxCalls))
	
	// Update status with real spinner
	spinner := t.spinnerFrames[t.spinnerIndex]
	t.statusBox.SetText(fmt.Sprintf(
		"Processing: [cyan]%s[-] → %s.md  %s",
		t.state.CurrentFile,
		strings.TrimSuffix(t.state.CurrentFile, ".tsx"),
		spinner))
}

func (t *ProperUltraTUI) updateWorkerDisplay(idx int) {
	worker := &t.state.Workers[idx]
	content := ""
	borderColor := tcell.ColorDefault
	stateText := ""
	
	switch worker.State {
	case WorkerStateBusy:
		borderColor = tcell.ColorGreen
		stateText = "[green]BUSY[-]"
		content = fmt.Sprintf("%s\n[cyan]%s[-]\n%s [%ds]",
			stateText,
			t.truncateString(worker.File, 20),
			worker.Operation,
			worker.TimeElapsed/1000)
		if worker.Progress > 0 {
			content += fmt.Sprintf("\n%s %d%%",
				t.makeProgressBar(worker.Progress, 15),
				worker.Progress)
		}
		
	case WorkerStateIdle:
		borderColor = tcell.ColorGray
		stateText = "[gray]IDLE[-]"
		content = fmt.Sprintf("%s\n[gray]Waiting...[-]", stateText)
		if worker.Stats.Completed > 0 {
			content += fmt.Sprintf("\n[green]✓ %d[-] [red]✗ %d[-]",
				worker.Stats.Completed, worker.Stats.Failed)
		}
		
	case WorkerStateBlocked:
		borderColor = tcell.ColorYellow
		stateText = "[yellow]BLOCKED[-]"
		content = fmt.Sprintf("%s\n[yellow]%s[-]\nWaiting for Claude...",
			stateText,
			t.truncateString(worker.File, 20))
		
	case WorkerStateError:
		borderColor = tcell.ColorRed
		stateText = "[red]ERROR[-]"
		content = fmt.Sprintf("%s\n[red]%s[-]\n%s",
			stateText,
			t.truncateString(worker.File, 20),
			t.truncateString(worker.Error, 20))
		
	case WorkerStateComplete:
		borderColor = tcell.ColorBlue
		stateText = "[blue]COMPLETE[-]"
		content = fmt.Sprintf("%s\n[green]All tasks done[-]\n[green]✓ %d[-] [red]✗ %d[-]",
			stateText,
			worker.Stats.Completed,
			worker.Stats.Failed)
	}
	
	t.workerContent[idx].SetText(content)
	t.workerBoxes[idx].SetBorderColor(borderColor)
}

func (t *ProperUltraTUI) makeProgressBar(percent int, width int) string {
	filled := (percent * width) / 100
	bar := "[green]"
	bar += strings.Repeat("█", filled)
	bar += "[-][gray]"
	bar += strings.Repeat("░", width-filled)
	bar += "[-]"
	return bar
}

func (t *ProperUltraTUI) truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

func (t *ProperUltraTUI) animationLoop() {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	
	for range ticker.C {
		t.mu.Lock()
		t.spinnerIndex = (t.spinnerIndex + 1) % len(t.spinnerFrames)
		t.mu.Unlock()
		
		t.app.QueueUpdateDraw(func() {
			t.updateDisplay()
		})
	}
}

func (t *ProperUltraTUI) metricsUpdateLoop() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	
	for range ticker.C {
		t.mu.Lock()
		// Simulate metrics changes
		t.state.Metrics.CPU = float64(50 + time.Now().Second()%50)
		t.state.Metrics.Memory.Used = int64(200 + time.Now().Second()*10) * 1024 * 1024
		t.state.Metrics.Network.Down = int64(100 + time.Now().Second()*5) * 1024
		t.state.Metrics.Network.Up = int64(10 + time.Now().Second()) * 1024
		t.mu.Unlock()
	}
}

func (t *ProperUltraTUI) addLog(level, content string) {
	timestamp := time.Now().Format("15:04:05")
	var levelColor string
	switch level {
	case "INFO":
		levelColor = "[green]INFO [-]"
	case "WARN":
		levelColor = "[yellow]WARN [-]"
	case "ERROR":
		levelColor = "[red]ERROR[-]"
	case "DEBUG":
		levelColor = "[blue]DEBUG[-]"
	default:
		levelColor = level
	}
	
	logLine := fmt.Sprintf("%s [%s] %s\n", timestamp, levelColor, content)
	t.logsView.Write([]byte(logLine))
	t.logsView.ScrollToEnd()
}

func (t *ProperUltraTUI) initializeTestData() {
	t.mu.Lock()
	defer t.mu.Unlock()
	
	// Set initial state
	t.state.ProjectPath = "~/github/bm_player_template"
	t.state.OutputPath = "~/obsidian_vault/docs/bm_player_docs"
	t.state.PID = 45789
	t.state.Connected = true
	t.state.LockStatus = true
	
	// Phase data
	t.state.Phase = PhaseData{
		Current: 3,
		Total: 9,
		Name: "Analysis",
		Percentage: 33,
	}
	
	// File stats
	t.state.Files = FileData{
		Processed: 156,
		Total: 487,
		Queue: 331,
		Rate: 6.2,
		Failed: 2,
	}
	t.state.DocsComplete = 3
	
	// Initialize workers
	t.state.Workers[0] = WorkerMessageData{
		WorkerID: 1,
		State: WorkerStateBusy,
		File: "src/index.js",
		Operation: "analyzing",
		TimeElapsed: 12000,
		Progress: 65,
	}
	
	t.state.Workers[1] = WorkerMessageData{
		WorkerID: 2,
		State: WorkerStateIdle,
		Stats: WorkerStats{Completed: 42, Failed: 1},
	}
	
	t.state.Workers[2] = WorkerMessageData{
		WorkerID: 3,
		State: WorkerStateBusy,
		File: "main.tsx",
		Operation: "generating",
		TimeElapsed: 3000,
		Progress: 30,
	}
	
	t.state.Workers[3] = WorkerMessageData{
		WorkerID: 4,
		State: WorkerStateBlocked,
		File: "README.md",
		Operation: "waiting",
	}
	
	// Set metrics
	t.state.Metrics = MetricsData{
		CPU: 78,
		Memory: MemoryMetrics{
			Used: 234 * 1024 * 1024,
			Total: 2 * 1024 * 1024 * 1024,
		},
		Disk: DiskMetrics{
			Read: 45 * 1024 * 1024,
			Write: 30 * 1024 * 1024,
		},
		Network: NetworkMetrics{
			Down: 128 * 1024,
			Up: 12 * 1024,
		},
		Claude: ClaudeMetrics{
			Calls: 45,
			MaxCalls: 100,
		},
	}
	
	t.state.CurrentFile = "src/components/Button.tsx"
	
	// Add initial logs
	t.addLog("INFO", "Starting efficient document processing")
	t.addLog("INFO", "Found 487 documentable files")
	t.addLog("INFO", "Starting 4 parallel workers")
	t.addLog("WORK1", "Processing: src/index.js (JavaScript, 12KB)")
	t.addLog("WORK3", "Processing: main.tsx (TypeScript React, 8KB)")
	t.addLog("WORK4", "Processing: README.md (Markdown, 15KB)")
	t.addLog("WORK2", "[green]✓[-] Completed: package.json (4KB) in 1.2s")
	t.addLog("ERROR", "Failed: src/broken.js - Syntax error at line 42")
	t.addLog("WARN", "Retrying: src/broken.js (attempt 2/3)")
}

func (t *ProperUltraTUI) Run() error {
	// Start test animations
	go func() {
		ticker := time.NewTicker(2 * time.Second)
		progress := 0
		for range ticker.C {
			t.mu.Lock()
			progress = (progress + 10) % 100
			t.state.Workers[0].Progress = progress
			t.state.Workers[2].Progress = (progress + 30) % 100
			t.state.Files.Processed += 2
			t.state.Phase.Percentage = (t.state.Phase.Current * 100 / t.state.Phase.Total) + progress/10
			t.mu.Unlock()
			
			t.addLog("INFO", fmt.Sprintf("Processing file %d of %d", 
				t.state.Files.Processed, t.state.Files.Total))
		}
	}()
	
	return t.app.Run()
}

// RunProperUltraTest runs the properly designed TUI
func RunProperUltraTest() {
	tui := NewProperUltraTUI()
	if err := tui.Run(); err != nil {
		fmt.Printf("Error: %v\n", err)
	}
}