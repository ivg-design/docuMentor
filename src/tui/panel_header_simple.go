package main

import (
	"fmt"
	"time"

	"github.com/rivo/tview"
)

// SimpleHeaderPanel displays the header with proper split layout
type SimpleHeaderPanel struct {
	*tview.TextView
	
	// Project info
	projectPath string
	outputPath  string
	connection  string
	pid         int
	lockStatus  string
	
	// Time tracking
	startTime time.Time
	ticker    *time.Ticker
}

// NewSimpleHeaderPanel creates a new simple header panel
func NewSimpleHeaderPanel() *SimpleHeaderPanel {
	panel := &SimpleHeaderPanel{
		TextView:    tview.NewTextView().SetDynamicColors(true),
		startTime:   time.Now(),
		connection:  "Connected",
		lockStatus:  "Free",
		pid:         17026,
		projectPath: "~/github/docuMentor",
		outputPath:  "./docs",
	}
	
	panel.SetBorder(true).
		SetTitle(" DocuMentor TUI v3.0 - Ultra Pipeline ").
		SetTitleAlign(tview.AlignCenter)
	
	// Add connection indicator to title
	panel.updateDisplay()
	
	// Start time updater
	panel.startTicker()
	
	return panel
}

// updateDisplay updates the header display
func (h *SimpleHeaderPanel) updateDisplay() {
	// Build the two-line display with proper alignment
	elapsed := time.Since(h.startTime)
	
	// Connection indicator for title - keep title simple
	h.SetTitle(" DocuMentor TUI v3.0 - Ultra Pipeline ")
	
	// Format with colors and proper spacing for visibility
	// Line 1: Project and PID/Time on right
	line1 := fmt.Sprintf("[cyan]Project:[white] %-40s  [cyan]PID:[white] %d  [cyan]Time:[white] %s",
		h.projectPath,
		h.pid,
		time.Now().Format("15:04:05"))
	
	// Line 2: Output and Lock/Elapsed on right
	lockColor := "green"
	if h.lockStatus != "Free" {
		lockColor = "red"
	}
	
	line2 := fmt.Sprintf("[cyan]Output:[white]  %-40s  [cyan]Lock:[white] [%s]%s[white]  [cyan]Elapsed:[white] %02d:%02d",
		h.outputPath,
		lockColor,
		h.lockStatus,
		int(elapsed.Minutes()),
		int(elapsed.Seconds())%60)
	
	// Set the content with both lines
	h.SetText(fmt.Sprintf("%s\n%s", line1, line2))
}

// UpdateProject updates project information
func (h *SimpleHeaderPanel) UpdateProject(project, output string, pid int) {
	h.projectPath = project
	h.outputPath = output
	h.pid = pid
	h.updateDisplay()
}

// SetConnection updates connection status
func (h *SimpleHeaderPanel) SetConnection(connected bool) {
	if connected {
		h.connection = "Connected"
	} else {
		h.connection = "Disconnected"
	}
	h.updateDisplay()
}

// SetLock updates lock status
func (h *SimpleHeaderPanel) SetLock(locked bool) {
	if locked {
		h.lockStatus = "Locked"
	} else {
		h.lockStatus = "Free"
	}
	h.updateDisplay()
}

// startTicker starts the time update ticker
func (h *SimpleHeaderPanel) startTicker() {
	h.ticker = time.NewTicker(time.Second)
	go func() {
		for range h.ticker.C {
			h.updateDisplay()
			// In real app, would trigger redraw
		}
	}()
}

// Stop stops the ticker
func (h *SimpleHeaderPanel) Stop() {
	if h.ticker != nil {
		h.ticker.Stop()
	}
}