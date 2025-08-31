package main

import (
	"fmt"
	"time"
	"sync"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// RedesignedTUI - Complete TUI following ULTRA DESIGN principles
type RedesignedTUI struct {
	app *tview.Application
	pages *tview.Pages
	
	// Layout containers
	mainGrid *tview.Grid
	
	// Header section
	headerFlex     *tview.Flex
	titleView      *tview.TextView
	connectionView *tview.TextView
	projectView    *tview.TextView
	pidView        *tview.TextView
	outputView     *tview.TextView
	lockView       *tview.TextView
	timeView       *tview.TextView
	elapsedView    *tview.TextView
	
	// Phase section
	phaseFlex      *tview.Flex
	phaseLabel     *tview.TextView
	phaseBar       *tview.Box // Custom progress bar
	phasePercent   *tview.TextView
	
	// File stats section
	statsGrid      *tview.Grid
	filesView      *tview.TextView
	queueView      *tview.TextView
	rateView       *tview.TextView
	errorsView     *tview.TextView
	docsView       *tview.TextView
	
	// Worker section
	workersGrid    *tview.Grid
	workerPanels   [4]*WorkerPanel
	
	// Controls section
	controlsFlex   *tview.Flex
	helpBtn        *tview.Button
	pauseBtn       *tview.Button
	resumeBtn      *tview.Button
	debugBtn       *tview.Button
	exitBtn        *tview.Button
	
	// Logs section
	logsList       *tview.List
	logsText       *tview.TextView
	
	// Performance section
	perfGrid       *tview.Grid
	cpuBox         *ProgressBox
	memBox         *ProgressBox
	diskView       *tview.TextView
	netView        *tview.TextView
	claudeView     *tview.TextView
	
	// Status section
	statusFlex     *tview.Flex
	statusText     *tview.TextView
	spinner        *tview.TextView
	
	// State
	state          *UltraState
	mu             sync.RWMutex
	spinnerIdx     int
	spinnerChars   []string
	startTime      time.Time
}

// WorkerPanel represents a single worker display
type WorkerPanel struct {
	frame     *tview.Frame
	content   *tview.Flex
	idView    *tview.TextView
	stateView *tview.TextView
	fileView  *tview.TextView
	opView    *tview.TextView
	progBar   *ProgressBox
	statsView *tview.TextView
}

// ProgressBox is a custom progress bar component
type ProgressBox struct {
	*tview.Box
	percent   int
	label     string
	showLabel bool
	barColor  tcell.Color
	mu        sync.RWMutex
}

func NewProgressBox() *ProgressBox {
	return &ProgressBox{
		Box:      tview.NewBox(),
		barColor: tcell.ColorGreen,
	}
}

func (p *ProgressBox) SetPercent(percent int) *ProgressBox {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.percent = percent
	return p
}

func (p *ProgressBox) SetLabel(label string) *ProgressBox {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.label = label
	p.showLabel = true
	return p
}

func (p *ProgressBox) Draw(screen tcell.Screen) {
	p.Box.DrawForSubclass(screen, p)
	x, y, width, height := p.GetInnerRect()
	
	if height < 1 || width < 3 {
		return
	}
	
	p.mu.RLock()
	defer p.mu.RUnlock()
	
	// Draw label if needed
	labelOffset := 0
	if p.showLabel && p.label != "" {
		tview.Print(screen, p.label, x, y, width, tview.AlignLeft, tcell.ColorWhite)
		labelOffset = len(p.label) + 1
	}
	
	// Calculate bar dimensions
	barWidth := width - labelOffset - 5 // Leave space for percentage
	if barWidth < 1 {
		return
	}
	
	filled := (p.percent * barWidth) / 100
	
	// Draw the progress bar
	barY := y
	barX := x + labelOffset
	
	// Draw filled part
	for i := 0; i < filled && i < barWidth; i++ {
		screen.SetContent(barX+i, barY, '█', nil, tcell.StyleDefault.Foreground(p.barColor))
	}
	
	// Draw unfilled part
	for i := filled; i < barWidth; i++ {
		screen.SetContent(barX+i, barY, '░', nil, tcell.StyleDefault.Foreground(tcell.ColorGray))
	}
	
	// Draw percentage
	percentStr := fmt.Sprintf("%3d%%", p.percent)
	tview.Print(screen, percentStr, barX+barWidth+1, barY, 4, tview.AlignLeft, tcell.ColorWhite)
}

func NewRedesignedTUI() *RedesignedTUI {
	tui := &RedesignedTUI{
		app:          tview.NewApplication(),
		pages:        tview.NewPages(),
		state:        NewUltraState(),
		spinnerChars: []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"},
		startTime:    time.Now(),
	}
	
	tui.createComponents()
	tui.buildLayout()
	tui.setupKeyBindings()
	tui.initTestData()
	
	// Start update loops
	go tui.updateLoop()
	go tui.spinnerLoop()
	
	return tui
}

func (t *RedesignedTUI) createComponents() {
	// Header components
	t.titleView = tview.NewTextView().
		SetTextAlign(tview.AlignCenter).
		SetDynamicColors(true).
		SetText("[::b]DocuMentor v3.2.0[::-]")
	
	t.connectionView = tview.NewTextView().
		SetDynamicColors(true).
		SetTextAlign(tview.AlignCenter)
	
	t.projectView = tview.NewTextView().SetDynamicColors(true)
	t.pidView = tview.NewTextView().SetDynamicColors(true)
	t.outputView = tview.NewTextView().SetDynamicColors(true)
	t.lockView = tview.NewTextView().SetDynamicColors(true)
	t.timeView = tview.NewTextView().SetDynamicColors(true)
	t.elapsedView = tview.NewTextView().SetDynamicColors(true)
	
	// Phase components
	t.phaseLabel = tview.NewTextView().SetDynamicColors(true)
	t.phaseBar = tview.NewBox().SetBackgroundColor(tcell.ColorDefault)
	t.phasePercent = tview.NewTextView().SetDynamicColors(true).SetTextAlign(tview.AlignRight)
	
	// File stats
	t.filesView = tview.NewTextView().SetDynamicColors(true)
	t.queueView = tview.NewTextView().SetDynamicColors(true)
	t.rateView = tview.NewTextView().SetDynamicColors(true)
	t.errorsView = tview.NewTextView().SetDynamicColors(true)
	t.docsView = tview.NewTextView().SetDynamicColors(true)
	
	// Create 4 worker panels
	for i := 0; i < 4; i++ {
		t.workerPanels[i] = t.createWorkerPanel(i + 1)
	}
	
	// Control buttons
	t.helpBtn = tview.NewButton("[H] Help").SetSelectedFunc(func() {})
	t.pauseBtn = tview.NewButton("[P] Pause").SetSelectedFunc(func() {})
	t.resumeBtn = tview.NewButton("[R] Resume").SetSelectedFunc(func() {})
	t.debugBtn = tview.NewButton("[D] Debug").SetSelectedFunc(func() {})
	t.exitBtn = tview.NewButton("[ESC] Exit").SetSelectedFunc(func() { t.app.Stop() })
	
	// Logs
	t.logsText = tview.NewTextView().
		SetDynamicColors(true).
		SetScrollable(true).
		SetChangedFunc(func() { t.app.Draw() })
	
	// Performance meters
	t.cpuBox = NewProgressBox().SetLabel("CPU")
	t.memBox = NewProgressBox().SetLabel("MEM")
	t.diskView = tview.NewTextView().SetDynamicColors(true)
	t.netView = tview.NewTextView().SetDynamicColors(true)
	t.claudeView = tview.NewTextView().SetDynamicColors(true)
	
	// Status
	t.statusText = tview.NewTextView().SetDynamicColors(true)
	t.spinner = tview.NewTextView().SetDynamicColors(true)
}

func (t *RedesignedTUI) createWorkerPanel(id int) *WorkerPanel {
	wp := &WorkerPanel{
		content: tview.NewFlex().SetDirection(tview.FlexRow),
	}
	
	wp.idView = tview.NewTextView().SetDynamicColors(true).SetTextAlign(tview.AlignCenter)
	wp.stateView = tview.NewTextView().SetDynamicColors(true).SetTextAlign(tview.AlignCenter)
	wp.fileView = tview.NewTextView().SetDynamicColors(true)
	wp.opView = tview.NewTextView().SetDynamicColors(true)
	wp.progBar = NewProgressBox()
	wp.statsView = tview.NewTextView().SetDynamicColors(true)
	
	wp.content.
		AddItem(wp.idView, 1, 0, false).
		AddItem(wp.stateView, 1, 0, false).
		AddItem(wp.fileView, 1, 0, false).
		AddItem(wp.opView, 1, 0, false).
		AddItem(wp.progBar, 1, 0, false).
		AddItem(wp.statsView, 1, 0, false)
	
	title := fmt.Sprintf(" Worker %d ", id)
	wp.frame = tview.NewFrame(wp.content).
		SetBorders(1, 1, 1, 1, 1, 1).
		AddText(title, true, tview.AlignCenter, tcell.ColorWhite)
	
	return wp
}

func (t *RedesignedTUI) buildLayout() {
	// Header section
	t.headerFlex = tview.NewFlex().SetDirection(tview.FlexRow).
		AddItem(tview.NewFlex().
			AddItem(t.titleView, 0, 3, false).
			AddItem(t.connectionView, 0, 1, false), 1, 0, false).
		AddItem(tview.NewFlex().
			AddItem(t.projectView, 0, 3, false).
			AddItem(t.pidView, 0, 1, false).
			AddItem(t.timeView, 0, 1, false), 1, 0, false).
		AddItem(tview.NewFlex().
			AddItem(t.outputView, 0, 3, false).
			AddItem(t.lockView, 0, 1, false).
			AddItem(t.elapsedView, 0, 1, false), 1, 0, false)
	
	// Phase section with custom progress bar
	t.phaseFlex = tview.NewFlex().
		AddItem(t.phaseLabel, 25, 0, false).
		AddItem(t.phaseBar, 0, 1, false).
		AddItem(t.phasePercent, 6, 0, false)
	
	// File stats section
	t.statsGrid = tview.NewGrid().
		SetColumns(0, 0, 0, 0, 0).
		AddItem(t.filesView, 0, 0, 1, 1, 0, 0, false).
		AddItem(t.queueView, 0, 1, 1, 1, 0, 0, false).
		AddItem(t.rateView, 0, 2, 1, 1, 0, 0, false).
		AddItem(t.errorsView, 0, 3, 1, 1, 0, 0, false).
		AddItem(t.docsView, 0, 4, 1, 1, 0, 0, false)
	
	// Workers grid
	t.workersGrid = tview.NewGrid().
		SetColumns(0, 0, 0, 0).
		AddItem(t.workerPanels[0].frame, 0, 0, 1, 1, 0, 0, false).
		AddItem(t.workerPanels[1].frame, 0, 1, 1, 1, 0, 0, false).
		AddItem(t.workerPanels[2].frame, 0, 2, 1, 1, 0, 0, false).
		AddItem(t.workerPanels[3].frame, 0, 3, 1, 1, 0, 0, false)
	
	// Controls
	t.controlsFlex = tview.NewFlex().
		AddItem(t.helpBtn, 10, 0, false).
		AddItem(t.pauseBtn, 12, 0, false).
		AddItem(t.resumeBtn, 13, 0, false).
		AddItem(t.debugBtn, 12, 0, false).
		AddItem(tview.NewBox(), 0, 1, false). // Spacer
		AddItem(t.exitBtn, 12, 0, false)
	
	// Performance section
	t.perfGrid = tview.NewGrid().
		SetColumns(25, 25, 0).
		SetRows(1, 1).
		AddItem(t.cpuBox, 0, 0, 1, 1, 0, 0, false).
		AddItem(t.memBox, 0, 1, 1, 1, 0, 0, false).
		AddItem(t.diskView, 0, 2, 1, 1, 0, 0, false).
		AddItem(t.netView, 1, 0, 1, 2, 0, 0, false).
		AddItem(t.claudeView, 1, 2, 1, 1, 0, 0, false)
	
	// Status bar
	t.statusFlex = tview.NewFlex().
		AddItem(t.statusText, 0, 1, false).
		AddItem(t.spinner, 3, 0, false)
	
	// Main grid layout
	t.mainGrid = tview.NewGrid().
		SetRows(3, 1, 1, 1, 7, 1, 0, 2, 1). // header, phase, stats, divider, workers, controls, logs, perf, status
		SetColumns(0).
		AddItem(t.headerFlex, 0, 0, 1, 1, 0, 0, false).
		AddItem(t.phaseFlex, 1, 0, 1, 1, 0, 0, false).
		AddItem(t.statsGrid, 2, 0, 1, 1, 0, 0, false).
		AddItem(tview.NewBox().SetBorder(true), 3, 0, 1, 1, 0, 0, false). // Divider
		AddItem(t.workersGrid, 4, 0, 1, 1, 0, 0, false).
		AddItem(t.controlsFlex, 5, 0, 1, 1, 0, 0, false).
		AddItem(t.logsText.SetBorder(true).SetTitle(" Logs "), 6, 0, 1, 1, 0, 0, true).
		AddItem(t.perfGrid, 7, 0, 1, 1, 0, 0, false).
		AddItem(t.statusFlex, 8, 0, 1, 1, 0, 0, false)
	
	// Add main grid to pages
	t.pages.AddPage("main", t.mainGrid, true, true)
	
	// Set root
	t.app.SetRoot(t.pages, true).EnableMouse(true)
}

func (t *RedesignedTUI) setupKeyBindings() {
	t.app.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		switch event.Key() {
		case tcell.KeyEsc:
			t.app.Stop()
			return nil
		case tcell.KeyRune:
			switch event.Rune() {
			case 'q', 'Q':
				t.app.Stop()
			case 'p', 'P':
				// Pause
			case 'r', 'R':
				// Resume
			case 'd', 'D':
				// Debug toggle
			case 'h', 'H':
				// Help
			}
		}
		return event
	})
}

func (t *RedesignedTUI) updateLoop() {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	
	for range ticker.C {
		t.app.QueueUpdateDraw(func() {
			t.updateDisplay()
		})
	}
}

func (t *RedesignedTUI) spinnerLoop() {
	ticker := time.NewTicker(80 * time.Millisecond)
	defer ticker.Stop()
	
	for range ticker.C {
		t.mu.Lock()
		t.spinnerIdx = (t.spinnerIdx + 1) % len(t.spinnerChars)
		t.mu.Unlock()
	}
}

func (t *RedesignedTUI) updateDisplay() {
	t.mu.RLock()
	defer t.mu.RUnlock()
	
	// Update connection status
	if t.state.Connected {
		t.connectionView.SetText("[green]● Connected[-]")
	} else {
		t.connectionView.SetText("[red]○ Disconnected[-]")
	}
	
	// Update project info
	t.projectView.SetText(fmt.Sprintf("Project: %s", t.state.ProjectPath))
	t.pidView.SetText(fmt.Sprintf("PID: %d", t.state.PID))
	t.timeView.SetText(time.Now().Format("15:04:05"))
	
	t.outputView.SetText(fmt.Sprintf("Output: %s", t.state.OutputPath))
	if t.state.LockStatus {
		t.lockView.SetText("Lock: [green]✓[-]")
	} else {
		t.lockView.SetText("Lock: [red]✗[-]")
	}
	
	elapsed := time.Since(t.startTime)
	t.elapsedView.SetText(fmt.Sprintf("Elapsed: %02d:%02d", int(elapsed.Minutes()), int(elapsed.Seconds())%60))
	
	// Update phase
	t.phaseLabel.SetText(fmt.Sprintf("PHASE [%d/%d] %s", 
		t.state.Phase.Current, t.state.Phase.Total, t.state.Phase.Name))
	t.phasePercent.SetText(fmt.Sprintf("%d%%", t.state.CalculatePhasePercentage()))
	
	// Update file stats
	t.filesView.SetText(fmt.Sprintf("Files: %d/%d", t.state.Files.Processed, t.state.Files.Total))
	t.queueView.SetText(fmt.Sprintf("Queue: %d", t.state.Files.Queue))
	t.rateView.SetText(fmt.Sprintf("Rate: %.1f/s", t.state.Files.Rate))
	t.errorsView.SetText(fmt.Sprintf("Errors: [red]%d[-]", t.state.Files.Failed))
	t.docsView.SetText(fmt.Sprintf("Docs: [green]%d[-]", t.state.DocsComplete))
	
	// Update workers
	for i := 0; i < 4; i++ {
		t.updateWorkerPanel(i)
	}
	
	// Update performance
	t.cpuBox.SetPercent(int(t.state.Metrics.CPU))
	t.memBox.SetPercent(t.state.GetMemoryPercentage())
	
	t.diskView.SetText(fmt.Sprintf("DISK: R:%dMB/s W:%dMB/s",
		t.state.Metrics.Disk.Read/1024/1024,
		t.state.Metrics.Disk.Write/1024/1024))
	
	t.netView.SetText(fmt.Sprintf("NET: ↓%dKB/s ↑%dKB/s",
		t.state.Metrics.Network.Down/1024,
		t.state.Metrics.Network.Up/1024))
	
	t.claudeView.SetText(fmt.Sprintf("Claude: %d/%d calls",
		t.state.Metrics.Claude.Calls,
		t.state.Metrics.Claude.MaxCalls))
	
	// Update status
	t.statusText.SetText(fmt.Sprintf("Processing: %s", t.state.CurrentFile))
	t.spinner.SetText(t.spinnerChars[t.spinnerIdx])
}

func (t *RedesignedTUI) updateWorkerPanel(idx int) {
	worker := &t.state.Workers[idx]
	panel := t.workerPanels[idx]
	
	// Update worker ID
	panel.idView.SetText(fmt.Sprintf("W%d", worker.WorkerID))
	
	// Update state with color
	var stateColor string
	switch worker.State {
	case WorkerStateBusy:
		stateColor = "[green]BUSY[-]"
		panel.frame.SetBorderColor(tcell.ColorGreen)
	case WorkerStateIdle:
		stateColor = "[gray]IDLE[-]"
		panel.frame.SetBorderColor(tcell.ColorGray)
	case WorkerStateBlocked:
		stateColor = "[yellow]BLOCKED[-]"
		panel.frame.SetBorderColor(tcell.ColorYellow)
	case WorkerStateError:
		stateColor = "[red]ERROR[-]"
		panel.frame.SetBorderColor(tcell.ColorRed)
	case WorkerStateComplete:
		stateColor = "[blue]COMPLETE[-]"
		panel.frame.SetBorderColor(tcell.ColorBlue)
	default:
		stateColor = "IDLE"
		panel.frame.SetBorderColor(tcell.ColorDefault)
	}
	panel.stateView.SetText(stateColor)
	
	// Update file
	if worker.File != "" {
		panel.fileView.SetText(t.truncate(worker.File, 25))
	} else {
		panel.fileView.SetText("")
	}
	
	// Update operation
	if worker.Operation != "" {
		opText := worker.Operation
		if worker.TimeElapsed > 0 {
			opText = fmt.Sprintf("%s [%ds]", worker.Operation, worker.TimeElapsed/1000)
		}
		panel.opView.SetText(opText)
	} else {
		panel.opView.SetText("")
	}
	
	// Update progress
	panel.progBar.SetPercent(worker.Progress)
	
	// Update stats
	if worker.State == WorkerStateIdle && worker.Stats.Completed > 0 {
		panel.statsView.SetText(fmt.Sprintf("✓ %d  ✗ %d", worker.Stats.Completed, worker.Stats.Failed))
	} else {
		panel.statsView.SetText("")
	}
}

func (t *RedesignedTUI) truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max-3] + "..."
}

func (t *RedesignedTUI) initTestData() {
	t.mu.Lock()
	defer t.mu.Unlock()
	
	t.state.Connected = true
	t.state.ProjectPath = "~/github/bm_player_template"
	t.state.OutputPath = "~/obsidian_vault/docs"
	t.state.PID = 45789
	t.state.LockStatus = true
	
	t.state.Phase = PhaseData{
		Current: 3,
		Total: 9,
		Name: "Analysis",
		Percentage: 33,
	}
	
	t.state.Files = FileData{
		Processed: 156,
		Total: 487,
		Queue: 331,
		Rate: 6.2,
		Failed: 2,
	}
	t.state.DocsComplete = 3
	
	// Test worker states
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
		File: "components/Button.tsx",
		Operation: "generating",
		TimeElapsed: 3000,
		Progress: 30,
	}
	
	t.state.Workers[3] = WorkerMessageData{
		WorkerID: 4,
		State: WorkerStateBlocked,
		File: "README.md",
		Operation: "waiting for Claude",
	}
	
	// Test metrics
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
	
	// Add test logs
	logs := []string{
		"07:51:59 [INFO ] Starting efficient document processing",
		"07:51:59 [INFO ] Found 487 documentable files",
		"07:51:59 [INFO ] Starting 4 parallel workers",
		"07:51:59  Processing: src/index.js (JavaScript, 12KB)",
		"07:51:59  Processing: main.tsx (TypeScript React, 8KB)",
		"07:51:59  Processing: README.md (Markdown, 15KB)",
		"07:51:59  ✓ Completed: package.json (4KB) in 1.2s",
		"07:51:59 [ERROR] Failed: src/broken.js - Syntax error at line 42",
		"07:51:59 [WARN ] Retrying: src/broken.js (attempt 2/3)",
	}
	
	for _, log := range logs {
		t.logsText.Write([]byte(log + "\n"))
	}
}

func (t *RedesignedTUI) Run() error {
	// Animate test data
	go func() {
		ticker := time.NewTicker(500 * time.Millisecond)
		progress := 0
		for range ticker.C {
			t.mu.Lock()
			progress = (progress + 5) % 100
			t.state.Workers[0].Progress = progress
			t.state.Workers[2].Progress = (progress + 30) % 100
			t.state.Files.Processed += 1
			if t.state.Files.Processed > t.state.Files.Total {
				t.state.Files.Processed = 0
			}
			t.mu.Unlock()
		}
	}()
	
	return t.app.Run()
}

// RunTUITest runs the test version
func RunTUITest() {
	tui := NewRedesignedTUI()
	if err := tui.Run(); err != nil {
		fmt.Printf("Error: %v\n", err)
	}
}