package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

const VERSION = "2.0.0"

// Message types from documentor
type Message struct {
	Type        string      `json:"type"`
	Level       string      `json:"level"`
	Content     string      `json:"content"`
	Timestamp   string      `json:"timestamp"`
	Phase       PhaseInfo   `json:"phase,omitempty"`
	Files       FileInfo    `json:"files,omitempty"`
	Tool        string      `json:"tool,omitempty"`
	Data        interface{} `json:"data,omitempty"`
	ProjectPath string      `json:"projectPath,omitempty"`
	LockInfo    LockInfo    `json:"lockInfo,omitempty"`
}

type PhaseInfo struct {
	Current  int    `json:"current"`
	Total    int    `json:"total"`
	Name     string `json:"name"`
	SubPhase string `json:"subPhase"`
}

type FileInfo struct {
	Processed int    `json:"processed"`
	Total     int    `json:"total"`
	Current   string `json:"current"`
}

type LockInfo struct {
	Status    string    `json:"status"`    // locked, unlocked, stale
	Resuming  bool      `json:"resuming"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
	PID       int       `json:"pid"`
}

type ProcessStats struct {
	CPUPercent float64
	MemoryMB   int
	Goroutines int
	IORead     int64
	IOWrite    int64
}

type TUI struct {
	app           *tview.Application
	headerBar     *tview.TextView
	infoBox       *tview.TextView
	shortcutsBox  *tview.Flex
	statsBox      *tview.TextView
	mainView      *tview.TextView
	debugView     *tview.TextView
	rawView       *tview.TextView
	footerBox     *tview.TextView
	pages         *tview.Pages
	rootPages     *tview.Pages  // Root pages for modal overlay
	mainLayout    *tview.Flex   // Main layout flex
	
	// State
	startTime     time.Time
	lastUpdate    time.Time
	phase         PhaseInfo
	files         FileInfo
	lockInfo      LockInfo
	projectPath   string
	viewMode      string
	pid           int
	processStats  ProcessStats
	spinnerIndex  int
	spinnerChars  []string
	focusedWidget string // "main", "shortcuts"
	selectedBtn   int
	modalOpen     bool   // Track if modal is open
}

func NewTUI() *TUI {
	tui := &TUI{
		app:           tview.NewApplication(),
		startTime:     time.Now(),
		lastUpdate:    time.Now(),
		viewMode:      "normal",
		pid:           os.Getpid(),
		spinnerChars:  []string{"◐", "◓", "◑", "◒"},
		spinnerIndex:  0,
		focusedWidget: "main",
		selectedBtn:   0,
		projectPath:   "No project loaded",
	}
	
	// Create header bar - CENTERED
	tui.headerBar = tview.NewTextView().
		SetDynamicColors(true).
		SetTextAlign(tview.AlignCenter)
	tui.headerBar.SetBorder(false)
	
	// Create info box (left side of header)
	tui.infoBox = tview.NewTextView().
		SetDynamicColors(true).
		SetTextAlign(tview.AlignLeft)
	tui.infoBox.SetBorder(true).
		SetBorderPadding(0, 0, 1, 1).
		SetTitle(" info ").
		SetTitleAlign(tview.AlignLeft)
	
	// Create shortcuts as button-like items
	tui.shortcutsBox = tview.NewFlex().SetDirection(tview.FlexColumn)
	tui.updateShortcuts()
	
	// Create stats box (right side of header) - smaller height
	tui.statsBox = tview.NewTextView().
		SetDynamicColors(true).
		SetTextAlign(tview.AlignLeft)
	tui.statsBox.SetBorder(true).
		SetBorderPadding(0, 0, 1, 1).
		SetTitle(" status ").
		SetTitleAlign(tview.AlignLeft)
	
	// Create main content views with text wrapping
	tui.mainView = tview.NewTextView().
		SetDynamicColors(true).
		SetScrollable(true).
		SetWrap(true).          // Enable text wrapping
		SetWordWrap(true).      // Wrap at word boundaries
		SetChangedFunc(func() {
			tui.app.Draw()
		})
	tui.mainView.SetBorder(true).
		SetTitleAlign(tview.AlignLeft)
	
	tui.debugView = tview.NewTextView().
		SetDynamicColors(true).
		SetScrollable(true).
		SetWrap(true).          // Enable text wrapping
		SetWordWrap(true)       // Wrap at word boundaries
	tui.debugView.SetBorder(true).
		SetTitleAlign(tview.AlignLeft)
	
	tui.rawView = tview.NewTextView().
		SetDynamicColors(true).
		SetScrollable(true).
		SetWrap(true).          // Enable text wrapping
		SetWordWrap(true)       // Wrap at word boundaries
	tui.rawView.SetBorder(true).
		SetTitleAlign(tview.AlignLeft)
	
	// Create footer status bar - NO TITLE
	tui.footerBox = tview.NewTextView().
		SetDynamicColors(true).
		SetTextAlign(tview.AlignLeft)
	tui.footerBox.SetBorder(true).
		SetBorderPadding(0, 0, 1, 1)
	
	// Create pages for different views
	tui.pages = tview.NewPages().
		AddPage("normal", tui.mainView, true, true).
		AddPage("debug", tui.debugView, true, false).
		AddPage("raw", tui.rawView, true, false)
	
	// Create header flex (horizontal) - equal heights for info and stats
	headerFlex := tview.NewFlex().SetDirection(tview.FlexColumn).
		AddItem(tui.infoBox, 0, 3, true).     // 75% width
		AddItem(tui.statsBox, 0, 1, false)    // 25% width
	
	// Create main layout (vertical) with title
	tui.mainLayout = tview.NewFlex().SetDirection(tview.FlexRow).
		AddItem(tui.headerBar, 1, 0, false).     // 1. docuMentor title at top
		AddItem(headerFlex, 6, 0, false).        // 2. Info + Stats panels
		AddItem(tui.shortcutsBox, 3, 0, false).  // 3. Button row (styled TextViews with borders)
		AddItem(tui.pages, 0, 1, true).          // 4. Main logs area
		AddItem(tui.footerBox, 3, 0, false)      // 5. Footer status bar
	
	// Create root pages for modal overlay support
	tui.rootPages = tview.NewPages().
		AddPage("main", tui.mainLayout, true, true)
	
	// Set up key handlers
	tui.app.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		switch event.Key() {
		case tcell.KeyTab:
			tui.switchFocus()
			return nil
		case tcell.KeyLeft:
			if tui.focusedWidget == "shortcuts" && tui.selectedBtn > 0 {
				tui.selectedBtn--
				tui.updateShortcuts()
			}
			return nil
		case tcell.KeyRight:
			if tui.focusedWidget == "shortcuts" && tui.selectedBtn < 5 {
				tui.selectedBtn++
				tui.updateShortcuts()
			}
			return nil
		case tcell.KeyEnter:
			// If modal is open, let the modal handle it
			if tui.modalOpen {
				return event
			}
			if tui.focusedWidget == "shortcuts" {
				tui.executeShortcut(tui.selectedBtn)
			}
			return nil
		case tcell.KeyEsc:
			// If modal is open, let the modal handle it
			if tui.modalOpen {
				return event
			}
			tui.app.Stop()
			return nil
		case tcell.KeyCtrlC:
			tui.app.Stop()
			return nil
		case tcell.KeyRune:
			// Block all shortcuts when modal is open
			if tui.modalOpen {
				return event
			}
			
			switch event.Rune() {
			case 'q', 'Q':
				tui.app.Stop()
				return nil
			case 'd', 'D':
				tui.switchView("debug")
				return nil
			case 'r', 'R':
				tui.switchView("raw")
				return nil
			case 'n', 'N':
				tui.switchView("normal")
				return nil
			case 'c', 'C':
				tui.clearCurrentView()
				return nil
			case 'e', 'E':
				tui.exportLogs()
				return nil
			case 'p', 'P':
				// Test password modal
				tui.testSimplePasswordModal()
				return nil
			}
		case tcell.KeyPgUp:
			tui.scrollCurrentView(-10)
			return nil
		case tcell.KeyPgDn:
			tui.scrollCurrentView(10)
			return nil
		}
		return event
	})
	
	tui.app.SetRoot(tui.rootPages, true)
	tui.updateHeader()
	tui.updateInfoBox()
	tui.updateStatsBox()
	tui.updateFooter()
	
	// Start periodic updates
	go tui.periodicUpdate()
	go tui.updateProcessStats()
	
	return tui
}

func (t *TUI) updateHeader() {
	header := fmt.Sprintf(
		"[white::b]                            docuMentor v%s                            [::-]",
		VERSION,
	)
	t.headerBar.SetText(header)
}

func (t *TUI) switchFocus() {
	if t.focusedWidget == "main" {
		t.focusedWidget = "shortcuts"
	} else {
		t.focusedWidget = "main"
	}
	t.updateShortcuts()
}

func (t *TUI) updateShortcuts() {
	t.shortcutsBox.Clear()
	
	buttons := []struct {
		key   string
		label string
		mode  string
	}{
		{"N", "Normal", "normal"},
		{"D", "Debug", "debug"},
		{"R", "Raw", "raw"},
		{"C", "Clear", ""},
		{"E", "Export", ""},
		{"Q", "Quit", ""},
	}
	
	for i, btn := range buttons {
		// Create a TextView that looks like a button
		btnView := tview.NewTextView().
			SetDynamicColors(true).
			SetTextAlign(tview.AlignCenter).
			SetWrap(false)
		
		// Style based on button state
		var btnText string
		if t.focusedWidget == "shortcuts" && i == t.selectedBtn {
			// Selected/focused button
			btnView.SetBackgroundColor(tcell.ColorLightBlue)
			btnText = fmt.Sprintf("[black::b] [[%s]] %s [-:-:-]", btn.key, btn.label)
		} else if btn.mode != "" && btn.mode == t.viewMode {
			// Active mode button
			btnView.SetBackgroundColor(tcell.ColorDarkCyan)
			btnText = fmt.Sprintf("[white::b] [[%s]] %s [-:-:-]", btn.key, btn.label)
		} else {
			// Normal button
			btnView.SetBackgroundColor(tcell.ColorDarkGray)
			btnText = fmt.Sprintf("[yellow::b] [[%s]] %s [-:-:-]", btn.key, btn.label)
		}
		
		// Add border to make it look like a button
		btnView.SetBorder(true).
			SetBorderPadding(0, 0, 1, 1).
			SetBorderColor(tcell.ColorLightGray)
		
		btnView.SetText(btnText)
		
		// Add button to the row
		t.shortcutsBox.AddItem(btnView, 0, 1, false)
	}
}

func (t *TUI) executeShortcut(index int) {
	switch index {
	case 0:
		t.switchView("normal")
	case 1:
		t.switchView("debug")
	case 2:
		t.switchView("raw")
	case 3:
		t.clearCurrentView()
	case 4:
		t.exportLogs()
	case 5:
		t.app.Stop()
	}
}

func (t *TUI) exportLogs() {
	timestamp := time.Now().Format("20060102_150405")
	filename := fmt.Sprintf("documentor_logs_%s.txt", timestamp)
	
	var content string
	switch t.viewMode {
	case "debug":
		content = t.debugView.GetText(false)
	case "raw":
		content = t.rawView.GetText(false)
	default:
		content = t.mainView.GetText(false)
	}
	
	if err := os.WriteFile(filename, []byte(content), 0644); err == nil {
		t.addLog("success", fmt.Sprintf("Logs exported to %s", filename), time.Now().Format("15:04:05"))
	} else {
		t.addLog("error", fmt.Sprintf("Failed to export logs: %v", err), time.Now().Format("15:04:05"))
	}
}

func (t *TUI) scrollCurrentView(delta int) {
	var view *tview.TextView
	switch t.viewMode {
	case "debug":
		view = t.debugView
	case "raw":
		view = t.rawView
	default:
		view = t.mainView
	}
	
	row, col := view.GetScrollOffset()
	view.ScrollTo(row+delta, col)
}

func (t *TUI) switchView(mode string) {
	t.viewMode = mode
	t.pages.SwitchToPage(mode)
	t.updateShortcuts()
	t.updateViewTitle()
}


func (t *TUI) updateViewTitle() {
	// Update main view title with scroll indicator
	var view *tview.TextView
	var title string
	var icon string
	
	switch t.viewMode {
	case "debug":
		view = t.debugView
		title = "Debug"
		icon = ""
	case "raw":
		view = t.rawView
		title = "Raw API"
		icon = ""
	default:
		view = t.mainView
		title = "Logs"
		icon = ""
	}
	
	// Add scroll position indicator with visual bar
	row, _ := view.GetScrollOffset()
	_, _, _, height := view.GetInnerRect()
	content := view.GetText(false)
	lines := strings.Count(content, "\n")
	
	scrollBar := ""
	if lines > height {
		scrollPercent := 0
		if lines > 0 {
			scrollPercent = (row * 100) / (lines - height)
			if scrollPercent > 100 {
				scrollPercent = 100
			}
		}
		// Create visual scroll indicator
		barPos := scrollPercent / 10
		bar := ""
		for i := 0; i < 10; i++ {
			if i == barPos {
				bar += "█"
			} else {
				bar += "░"
			}
		}
		scrollBar = fmt.Sprintf(" [%s] %d%%", bar, scrollPercent)
	}
	
	finalTitle := fmt.Sprintf(" %s %s%s ", icon, title, scrollBar)
	view.SetTitle(finalTitle)
}

func (t *TUI) clearCurrentView() {
	switch t.viewMode {
	case "debug":
		t.debugView.Clear()
	case "raw":
		t.rawView.Clear()
	default:
		t.mainView.Clear()
	}
}

func (t *TUI) periodicUpdate() {
	ticker := time.NewTicker(100 * time.Millisecond)
	for range ticker.C {
		t.app.QueueUpdateDraw(func() {
			t.spinnerIndex = (t.spinnerIndex + 1) % len(t.spinnerChars)
			t.updateStatsBox()
			t.updateViewTitle()
		})
	}
}

func (t *TUI) updateProcessStats() {
	ticker := time.NewTicker(1 * time.Second)
	for range ticker.C {
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		
		t.processStats.MemoryMB = int(m.Alloc / 1024 / 1024)
		t.processStats.Goroutines = runtime.NumGoroutine()
		// Note: Real CPU and IO stats would require platform-specific code
		
		if t.viewMode == "debug" {
			t.app.QueueUpdateDraw(func() {
				t.updateStatsBox()
			})
		}
	}
}

func (t *TUI) updateInfoBox_old() {
	// Format lock status with detailed info
	lockIcon := ""
	lockColor := "green"
	lockText := "Ready"
	lockDetail := ""
	
	if t.lockInfo.Status == "locked" {
		lockIcon = ""
		lockColor = "yellow"
		lockText = "Locked"
		if t.lockInfo.Resuming {
			lockText = "Resuming"
			lockDetail = fmt.Sprintf("\n    PID: %d, Since: %s", 
				t.lockInfo.PID, t.lockInfo.CreatedAt.Format("15:04:05"))
		}
	} else if t.lockInfo.Status == "stale" {
		lockIcon = ""
		lockColor = "red"
		lockText = "Stale Lock"
		lockDetail = fmt.Sprintf("\n    Old PID: %d", t.lockInfo.PID)
	}
	
	// Format detailed phase info
	phaseText := fmt.Sprintf("[cyan]%d[white]/[cyan]%d[white]: [yellow]%s[white]", 
		t.phase.Current, t.phase.Total, t.phase.Name)
	if t.phase.SubPhase != "" {
		phaseText += fmt.Sprintf("\n    → [gray]%s[white]", t.phase.SubPhase)
	}
	
	// Format file progress with colorful bar
	fileBar := ""
	if t.files.Total > 0 {
		percent := (t.files.Processed * 100) / t.files.Total
		barWidth := 20
		filled := (barWidth * t.files.Processed) / t.files.Total
		
		// Create gradient bar
		fileBar = "["
		for i := 0; i < barWidth; i++ {
			if i < filled {
				if percent < 33 {
					fileBar += "[red]█[white]"
				} else if percent < 66 {
					fileBar += "[yellow]█[white]"
				} else {
					fileBar += "[green]█[white]"
				}
			} else {
				fileBar += "[gray]─[white]"
			}
		}
		fileBar += fmt.Sprintf("] [cyan]%d%%[white] ([green]%d[white]/[cyan]%d[white])", 
			percent, t.files.Processed, t.files.Total)
	} else {
		fileBar = "[gray]Scanning files...[white]"
	}
	
	// Format time since last update
	timeSince := time.Since(t.lastUpdate).Round(time.Second)
	updateText := fmt.Sprintf("[yellow]%s ago[white]", timeSince)
	if timeSince < 2*time.Second {
		updateText = "[green]Just now[white]"
	}
	
	// Project name from path
	projectName := filepath.Base(t.projectPath)
	if projectName == "" || projectName == "." {
		projectName = "No project"
	}
	
	// Base info - fixed layout with padding for stability
	projectDisplay := fmt.Sprintf("%-30s", projectName)
	lockDisplay := fmt.Sprintf("%s [%s]%-12s[white]", lockIcon, lockColor, lockText)
	phaseDisplay := fmt.Sprintf("%-50s", phaseText)
	filesDisplay := fmt.Sprintf("%-50s", fileBar)
	updateDisplay := fmt.Sprintf("%-20s", updateText)
	
	info := fmt.Sprintf(
		"[cyan] Project:[white] %s [gray]PID:[white] %d\n"+
		"[cyan]   Lock:   [white] %s%s\n"+
		"[cyan] Phase:  [white] %s\n"+
		"[cyan] Files:  [white] %s\n"+
		"[cyan] Updated:[white] %s",
		projectDisplay, t.pid,
		lockDisplay, lockDetail,
		phaseDisplay,
		filesDisplay,
		updateDisplay,
	)
	
	// Add process stats in debug mode - fixed width for stability
	if t.viewMode == "debug" {
		memDisplay := fmt.Sprintf("%-10s", fmt.Sprintf("%dMB", t.processStats.MemoryMB))
		cpuDisplay := fmt.Sprintf("%-10s", fmt.Sprintf("%.1f%%", t.processStats.CPUPercent))
		threadDisplay := fmt.Sprintf("%-8d", t.processStats.Goroutines)
		
		info += fmt.Sprintf("\n\n[gray]═══ Process Stats ═══[white]\n"+
			"[cyan] Memory: [white] %s [cyan] Threads:[white] %s\n"+
			"[cyan] CPU:    [white] %s",
			memDisplay,
			threadDisplay,
			cpuDisplay,
		)
		
		if t.processStats.IORead > 0 || t.processStats.IOWrite > 0 {
			ioReadDisplay := fmt.Sprintf("%-10s", fmt.Sprintf("%dKB", t.processStats.IORead/1024))
			ioWriteDisplay := fmt.Sprintf("%-10s", fmt.Sprintf("%dKB", t.processStats.IOWrite/1024))
			info += fmt.Sprintf("\n[cyan] IO Read:[white] %s [cyan] Write:[white] %s",
				ioReadDisplay,
				ioWriteDisplay,
			)
		}
	}
	
	t.infoBox.SetText(info)
}

func (t *TUI) updateStatsBox() {
	elapsed := time.Since(t.startTime)
	hours := int(elapsed.Hours())
	minutes := int(elapsed.Minutes()) % 60
	seconds := int(elapsed.Seconds()) % 60
	
	// Get current time
	currentTime := time.Now().Format("15:04:05")
	
	// Stats box - fixed layout with padding
	timeDisplay := fmt.Sprintf("%-10s", currentTime)
	elapsedDisplay := fmt.Sprintf("%02d:%02d:%02d", hours, minutes, seconds)
	memDisplay := fmt.Sprintf("%-8s", fmt.Sprintf("%dMB", t.processStats.MemoryMB))
	threadDisplay := fmt.Sprintf("%-8d", t.processStats.Goroutines)
	
	stats := fmt.Sprintf(
		"[cyan] Time:   [white] %s\n"+
		"[cyan]⏱  Elapsed:[white] %s\n"+
		"[cyan]%s Status: [white] Working\n"+
		"[cyan] Memory: [white] %s\n"+
		"[cyan] Threads:[white] %s",
		timeDisplay,
		elapsedDisplay,
		t.spinnerChars[t.spinnerIndex],
		memDisplay,
		threadDisplay,
	)
	
	t.statsBox.SetText(stats)
}

func (t *TUI) updateFooter() {
	status := "[gray] Ready - Waiting for input[white]"
	if t.files.Current != "" {
		// Truncate long file paths
		file := t.files.Current
		if len(file) > 70 {
			file = "..." + file[len(file)-67:]
		}
		status = fmt.Sprintf("[green] Processing:[white] [yellow]%s[white]", file)
	}
	t.footerBox.SetText(status)
}

func (t *TUI) handleMessage(msg Message) {
	t.app.QueueUpdateDraw(func() {
		t.lastUpdate = time.Now()
		
		// Update state
		if msg.Phase.Name != "" {
			t.phase = msg.Phase
			t.updateInfoBox()
		}
		if msg.Files.Total > 0 || msg.Files.Current != "" {
			t.files = msg.Files
			t.updateInfoBox()
			t.updateFooter()
		}
		if msg.ProjectPath != "" {
			t.projectPath = msg.ProjectPath
			t.updateInfoBox()
		}
		if msg.LockInfo.Status != "" {
			t.lockInfo = msg.LockInfo
			t.updateInfoBox()
		}
		
		// Format timestamp
		timestamp := time.Now().Format("15:04:05")
		if msg.Timestamp != "" {
			timestamp = msg.Timestamp
		}
		
		// Add to appropriate view
		switch msg.Type {
		case "log":
			t.addLog(msg.Level, msg.Content, timestamp)
		case "tool":
			t.addToolCall(msg.Tool, msg.Content, timestamp)
		case "debug":
			t.addDebug(msg.Content, timestamp)
		case "raw":
			t.addRaw(msg.Content, timestamp)
		case "phase":
			t.phase = msg.Phase
			t.updateInfoBox()
		case "file":
			t.files = msg.Files
			t.updateInfoBox()
			t.updateFooter()
		case "memory":
			if memMB, ok := msg.Data.(float64); ok {
				t.processStats.MemoryMB = int(memMB)
			}
		case "password_request":
			// Handle password request
			var req PasswordRequest
			if jsonData, err := json.Marshal(msg); err == nil {
				if err := json.Unmarshal(jsonData, &req); err == nil {
					t.showSimplePasswordModal(req.Prompt, req.Context, func(password string, cancelled bool) {
						if cancelled {
							t.addLog("info", "Password cancelled", time.Now().Format("15:04:05"))
						} else {
							t.addLog("success", "Password submitted", time.Now().Format("15:04:05"))
						}
					})
				}
			}
		default:
			t.addLog("info", msg.Content, timestamp)
		}
	})
}

func (t *TUI) addLog(level, content, timestamp string) {
	color := "white"
	icon := ""
	
	switch level {
	case "error":
		color = "red"
		icon = ""
	case "warning":
		color = "yellow"
		icon = ""
	case "success":
		color = "green"
		icon = ""
	case "info":
		color = "cyan"
		icon = ""
	}
	
	line := fmt.Sprintf("[gray]%s[white] [%s]%s %s[white]\n", 
		timestamp, color, icon, content)
	
	fmt.Fprint(t.mainView, line)
	t.mainView.ScrollToEnd()
}

func (t *TUI) addToolCall(tool, content, timestamp string) {
	line := fmt.Sprintf("[gray]%s[white] [yellow] %s:[white] %s\n",
		timestamp, tool, content)
	
	fmt.Fprint(t.mainView, line)
	fmt.Fprint(t.debugView, line)
	t.mainView.ScrollToEnd()
	t.debugView.ScrollToEnd()
}

func (t *TUI) addDebug(content, timestamp string) {
	line := fmt.Sprintf("[gray]%s[white] [dim] %s[white]\n",
		timestamp, content)
	fmt.Fprint(t.debugView, line)
	t.debugView.ScrollToEnd()
}

func (t *TUI) addRaw(content, timestamp string) {
	line := fmt.Sprintf("[gray]%s[white] [dim][white] %s\n",
		timestamp, content)
	fmt.Fprint(t.rawView, line)
	t.rawView.ScrollToEnd()
}

func (t *TUI) Run() error {
	// Start stdin reader in background
	go t.readStdin()
	
	// Run the app
	return t.app.Run()
}

func (t *TUI) readStdin() {
	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		line := scanner.Text()
		
		// Try to parse as JSON
		var msg Message
		if err := json.Unmarshal([]byte(line), &msg); err == nil {
			t.handleMessage(msg)
		} else {
			// Plain text message
			t.handleMessage(Message{
				Type:    "log",
				Level:   "info",
				Content: line,
			})
		}
	}
}

func main() {
	tui := NewTUI()
	if err := tui.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}