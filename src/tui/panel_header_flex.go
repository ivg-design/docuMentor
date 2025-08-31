package main

import (
	"fmt"
	"time"

	"github.com/rivo/tview"
)

// FlexHeaderPanel displays the header with proper 75/25 flex split
type FlexHeaderPanel struct {
	*tview.Flex
	
	// Subpanels
	leftPanel   *tview.TextView  // 75% - Project and Output
	separator   *tview.TextView  // Visual separator
	rightPanel  *tview.TextView  // 25% - PID, Time, Lock, Elapsed
	
	// Data
	projectPath string
	outputPath  string
	pid         int
	lockStatus  string
	startTime   time.Time
	ticker      *time.Ticker
}

// NewFlexHeaderPanel creates a new flex header panel with 75/25 split
func NewFlexHeaderPanel() *FlexHeaderPanel {
	panel := &FlexHeaderPanel{
		Flex:        tview.NewFlex().SetDirection(tview.FlexColumn),
		leftPanel:   tview.NewTextView().SetDynamicColors(true),
		separator:   tview.NewTextView().SetDynamicColors(true),
		rightPanel:  tview.NewTextView().SetDynamicColors(true),  // No alignment, handle manually
		startTime:   time.Now(),
		lockStatus:  "Free",
		pid:         17026,
		projectPath: "~/github/docuMentor",
		outputPath:  "./docs",
	}
	
	// Set title for the overall flex container
	panel.SetBorder(true).
		SetTitle(" DocuMentor TUI v3.0 - Ultra Pipeline ").
		SetTitleAlign(tview.AlignCenter)
	
	// Configure left panel (75%)
	panel.leftPanel.SetBorder(false)
	
	// Configure separator
	panel.separator.SetBorder(false)
	panel.separator.SetText("[gray]│\n│[white]")
	
	// Configure right panel (25%)
	panel.rightPanel.SetBorder(false)
	
	// Add panels with 75/25 split and separator
	panel.AddItem(panel.leftPanel, 0, 75, false).
		AddItem(panel.separator, 2, 0, false).  // Fixed width separator
		AddItem(panel.rightPanel, 0, 25, false)
	
	// Initial display update
	panel.updateDisplay()
	
	// Start time updater
	panel.startTicker()
	
	return panel
}

// updateDisplay updates both panels
func (h *FlexHeaderPanel) updateDisplay() {
	elapsed := time.Since(h.startTime)
	
	// Update left panel (75%) - Project and Output info with better spacing
	leftContent := fmt.Sprintf(" [cyan]Project:[white] %s\n [cyan]Output:[white]  %s",
		h.projectPath,
		h.outputPath)
	h.leftPanel.SetText(leftContent)
	
	// Update right panel (25%) - PID/Lock left-aligned, Time/Elapsed right-aligned
	lockColor := "green"
	lockSymbol := "●"
	if h.lockStatus != "Free" {
		lockColor = "red"
	}
	
	// Format elapsed time as HH:MM:SS
	hours := int(elapsed.Hours())
	minutes := int(elapsed.Minutes()) % 60
	seconds := int(elapsed.Seconds()) % 60
	elapsedDisplay := fmt.Sprintf("%02d:%02d:%02d", hours, minutes, seconds)
	
	// Format time
	timeDisplay := time.Now().Format("15:04:05")
	
	// Build right panel content with proper alignment
	// PID and Lock flush left, Time and Elapsed flush right
	lockDisplay := fmt.Sprintf("[%s]%s[white] %s", lockColor, lockSymbol, h.lockStatus)
	
	// Get the actual width of the right panel
	_, _, width, _ := h.rightPanel.GetInnerRect()
	if width <= 0 {
		width = 45  // Fallback width for 25% panel
	}
	// Don't subtract - use full width to reach the edge
	
	// Line 1: PID left, Time right
	pidText := fmt.Sprintf("[cyan]PID:[white] %d", h.pid)
	timeText := fmt.Sprintf("[cyan]Time:[white] %s", timeDisplay)
	pidLen := len(fmt.Sprintf("PID: %d", h.pid))
	timeLen := len(fmt.Sprintf("Time: %s", timeDisplay))
	padding1 := width - pidLen - timeLen
	if padding1 < 1 {
		padding1 = 1
	}
	line1 := fmt.Sprintf("%s%*s%s", pidText, padding1, "", timeText)
	
	// Line 2: Lock left, Elapsed right
	lockText := fmt.Sprintf("[cyan]Lock:[white] %s", lockDisplay)
	elapsedText := fmt.Sprintf("[cyan]Elapsed:[white] %s", elapsedDisplay)
	lockLen := len(fmt.Sprintf("Lock: %s %s", lockSymbol, h.lockStatus))
	elapsedLen := len(fmt.Sprintf("Elapsed: %s", elapsedDisplay))
	padding2 := width - lockLen - elapsedLen
	if padding2 < 1 {
		padding2 = 1
	}
	line2 := fmt.Sprintf("%s%*s%s", lockText, padding2, "", elapsedText)
	
	rightContent := fmt.Sprintf("%s\n%s", line1, line2)
	h.rightPanel.SetText(rightContent)
}

// UpdateProject updates project information
func (h *FlexHeaderPanel) UpdateProject(project, output string, pid int) {
	h.projectPath = project
	h.outputPath = output
	h.pid = pid
	h.updateDisplay()
}

// SetConnection updates connection status (for title if needed)
func (h *FlexHeaderPanel) SetConnection(connected bool) {
	// Could update title with connection indicator if desired
	h.updateDisplay()
}

// SetLock updates lock status
func (h *FlexHeaderPanel) SetLock(locked bool) {
	if locked {
		h.lockStatus = "Locked"
	} else {
		h.lockStatus = "Free"
	}
	h.updateDisplay()
}

// startTicker starts the time update ticker
func (h *FlexHeaderPanel) startTicker() {
	h.ticker = time.NewTicker(time.Second)
	go func() {
		for range h.ticker.C {
			h.updateDisplay()
			// In real app, would trigger redraw
		}
	}()
}

// Stop stops the ticker
func (h *FlexHeaderPanel) Stop() {
	if h.ticker != nil {
		h.ticker.Stop()
	}
}