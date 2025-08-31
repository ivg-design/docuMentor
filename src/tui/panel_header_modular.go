package main

import (
	"fmt"
	"os"
	"time"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// ModularHeaderPanel is a composite header with title bar and split sections
type ModularHeaderPanel struct {
	*tview.Flex
	
	// Sub-panels
	titleBar    *tview.TextView
	leftPanel   *tview.TextView
	rightPanel  *tview.TextView
	
	// Data
	projectPath string
	outputPath  string
	connection  bool
	pid         int
	lockStatus  string
	startTime   time.Time
	ticker      *time.Ticker
	app         *tview.Application
}

// NewModularHeaderPanel creates a new modular header panel
func NewModularHeaderPanel(app *tview.Application) *ModularHeaderPanel {
	panel := &ModularHeaderPanel{
		Flex:        tview.NewFlex().SetDirection(tview.FlexRow),
		app:         app,
		startTime:   time.Now(),
		connection:  true,
		lockStatus:  "Free",
		pid:         os.Getpid(),
		projectPath: "~/github/docuMentor",
		outputPath:  "./docs",
	}
	
	// Create title bar
	panel.titleBar = tview.NewTextView().
		SetDynamicColors(true).
		SetTextAlign(tview.AlignCenter)
	panel.titleBar.SetBackgroundColor(tcell.ColorDarkBlue)
	
	// Create left panel (70% - project info)
	panel.leftPanel = tview.NewTextView().
		SetDynamicColors(true)
	panel.leftPanel.SetBorder(true).
		SetBorderPadding(0, 0, 1, 1)
	
	// Create right panel (30% - system info)
	panel.rightPanel = tview.NewTextView().
		SetDynamicColors(true)
	panel.rightPanel.SetBorder(true).
		SetBorderPadding(0, 0, 1, 1)
	
	// Create horizontal flex for left/right split
	splitFlex := tview.NewFlex().
		AddItem(panel.leftPanel, 0, 7, false).  // 70%
		AddItem(panel.rightPanel, 0, 3, false)  // 30%
	
	// Add to main vertical flex
	panel.Flex.
		AddItem(panel.titleBar, 1, 0, false).   // Title bar - 1 line
		AddItem(splitFlex, 3, 0, false)         // Split panels - 3 lines (with borders)
	
	// Initial update
	panel.updateDisplay()
	
	// Start ticker for time updates
	panel.startTicker()
	
	return panel
}

// updateDisplay updates all sections of the header
func (h *ModularHeaderPanel) updateDisplay() {
	// Update title bar
	connSymbol := "[green]●[white]"
	connText := "Connected"
	if !h.connection {
		connSymbol = "[red]○[white]"
		connText = "Disconnected"
	}
	
	titleText := fmt.Sprintf("DocuMentor TUI v3.0 - Ultra Pipeline                                                    %s %s",
		connSymbol, connText)
	h.titleBar.SetText(titleText)
	
	// Update left panel (Project info)
	leftContent := fmt.Sprintf("Project: %s\nOutput:  %s", 
		h.projectPath,
		h.outputPath)
	h.leftPanel.SetText(leftContent)
	
	// Update right panel (System info)
	elapsed := time.Since(h.startTime)
	lockSymbol := "[green]●[white]"
	if h.lockStatus != "Free" {
		lockSymbol = "[red]●[white]"
	}
	
	rightContent := fmt.Sprintf("PID: %-8d  Time: %s\nLock: %s %-5s  Elapsed: %02d:%02d",
		h.pid,
		time.Now().Format("15:04:05"),
		lockSymbol,
		h.lockStatus,
		int(elapsed.Minutes()),
		int(elapsed.Seconds())%60)
	h.rightPanel.SetText(rightContent)
}

// UpdateProject updates project information
func (h *ModularHeaderPanel) UpdateProject(project, output string, pid int) {
	h.projectPath = project
	h.outputPath = output
	h.pid = pid
	h.updateDisplay()
	if h.app != nil {
		h.app.Draw()
	}
}

// SetConnection updates connection status
func (h *ModularHeaderPanel) SetConnection(connected bool) {
	h.connection = connected
	h.updateDisplay()
	if h.app != nil {
		h.app.Draw()
	}
}

// SetLock updates lock status
func (h *ModularHeaderPanel) SetLock(locked bool) {
	if locked {
		h.lockStatus = "Locked"
	} else {
		h.lockStatus = "Free"
	}
	h.updateDisplay()
	if h.app != nil {
		h.app.Draw()
	}
}

// startTicker starts the time update ticker
func (h *ModularHeaderPanel) startTicker() {
	h.ticker = time.NewTicker(time.Second)
	go func() {
		for range h.ticker.C {
			h.updateDisplay()
			if h.app != nil {
				h.app.Draw()
			}
		}
	}()
}

// Stop stops the ticker
func (h *ModularHeaderPanel) Stop() {
	if h.ticker != nil {
		h.ticker.Stop()
	}
}

// Focus is needed to implement Primitive interface
func (h *ModularHeaderPanel) Focus(delegate func(p tview.Primitive)) {
	h.Flex.Focus(delegate)
}

// Blur is needed to implement Primitive interface  
func (h *ModularHeaderPanel) Blur() {
	h.Flex.Blur()
}

// GetRect returns the current position and size
func (h *ModularHeaderPanel) GetRect() (int, int, int, int) {
	return h.Flex.GetRect()
}

// SetRect sets a new position and size
func (h *ModularHeaderPanel) SetRect(x, y, width, height int) {
	h.Flex.SetRect(x, y, width, height)
}

// Draw renders the panel
func (h *ModularHeaderPanel) Draw(screen tcell.Screen) {
	h.Flex.Draw(screen)
}

// HasFocus returns whether this primitive has focus
func (h *ModularHeaderPanel) HasFocus() bool {
	return h.Flex.HasFocus()
}

// InputHandler returns the handler for this primitive
func (h *ModularHeaderPanel) InputHandler() func(event *tcell.EventKey, setFocus func(p tview.Primitive)) {
	return h.Flex.InputHandler()
}

// MouseHandler returns the mouse handler for this primitive
func (h *ModularHeaderPanel) MouseHandler() func(action tview.MouseAction, event *tcell.EventMouse, setFocus func(p tview.Primitive)) (consumed bool, capture tview.Primitive) {
	return h.Flex.MouseHandler()
}