package main

import (
	"fmt"
	"strings"
	"time"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// UltraHeaderPanel displays the header with exact ULTRA DESIGN alignment
type UltraHeaderPanel struct {
	*tview.Box
	
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

// NewUltraHeaderPanel creates a new ultra-design header panel
func NewUltraHeaderPanel() *UltraHeaderPanel {
	panel := &UltraHeaderPanel{
		Box:        tview.NewBox(),
		startTime:  time.Now(),
		connection: "Connected",
		lockStatus: "Free",
		pid:        17026,
		projectPath: "~/github/docuMentor",
		outputPath:  "./docs",
	}
	
	panel.SetBorder(false)  // We'll draw our own custom border
	
	// Start time updater
	panel.startTicker()
	
	return panel
}

// Draw renders the header panel with exact alignment
func (h *UltraHeaderPanel) Draw(screen tcell.Screen) {
	h.Box.DrawForSubclass(screen, h)
	x, y, width, height := h.GetRect()  // Use GetRect to include border area
	
	if height < 3 || width < 80 {
		return
	}
	
	// Draw custom border and title
	// Top border with title
	title := " DocuMentor TUI v3.0 - Ultra Pipeline "
	connIndicator := fmt.Sprintf("[●] %s", h.connection)
	
	// Draw top border
	screen.SetContent(x, y, '┌', nil, tcell.StyleDefault)
	
	// Title section
	titleStart := x + (width-len(title)-len(connIndicator))/2
	for i := 1; i < titleStart-x; i++ {
		screen.SetContent(x+i, y, '─', nil, tcell.StyleDefault)
	}
	
	// Draw title
	for i, r := range title {
		screen.SetContent(titleStart+i, y, r, nil, tcell.StyleDefault.Bold(true))
	}
	
	// Draw connection indicator and rest of border
	titleEnd := titleStart + len(title)
	for i := titleEnd; i < x+width-len(connIndicator)-3; i++ {
		screen.SetContent(i, y, '─', nil, tcell.StyleDefault)
	}
	
	// Connection indicator
	connColor := tcell.ColorGreen
	if h.connection != "Connected" {
		connColor = tcell.ColorRed
	}
	connX := x + width - len(connIndicator) - 2
	screen.SetContent(connX, y, ' ', nil, tcell.StyleDefault)
	screen.SetContent(connX+1, y, '[', nil, tcell.StyleDefault)
	screen.SetContent(connX+2, y, '●', nil, tcell.StyleDefault.Foreground(connColor))
	screen.SetContent(connX+3, y, ']', nil, tcell.StyleDefault)
	for i, r := range " " + h.connection + " " {
		if connX+3+i < x+width-1 {
			screen.SetContent(connX+3+i, y, r, nil, tcell.StyleDefault)
		}
	}
	
	// Top right corner
	screen.SetContent(x+width-1, y, '┐', nil, tcell.StyleDefault)
	
	// Side borders
	for i := 1; i < height-1; i++ {
		screen.SetContent(x, y+i, '│', nil, tcell.StyleDefault)
		screen.SetContent(x+width-1, y+i, '│', nil, tcell.StyleDefault)
	}
	
	// Bottom border
	screen.SetContent(x, y+height-1, '└', nil, tcell.StyleDefault)
	for i := 1; i < width-1; i++ {
		screen.SetContent(x+i, y+height-1, '─', nil, tcell.StyleDefault)
	}
	screen.SetContent(x+width-1, y+height-1, '┘', nil, tcell.StyleDefault)
	
	// Now draw the content inside
	contentX := x + 1
	contentY := y + 1
	contentWidth := width - 2
	contentHeight := height - 2
	
	if contentHeight < 2 || contentWidth < 80 {
		return
	}
	
	// Line 1: Project info (left) | PID and Time (right)
	// Calculate splits for alignment
	leftWidth := contentWidth * 2 / 3
	rightWidth := contentWidth - leftWidth
	
	// Left side - Project
	projectText := fmt.Sprintf("Project: %s", h.projectPath)
	if len(projectText) > leftWidth-2 {
		projectText = projectText[:leftWidth-5] + "..."
	}
	tview.Print(screen, projectText, contentX, contentY, leftWidth, tview.AlignLeft, tcell.ColorWhite)
	
	// Right side - PID and Time in two columns
	pidText := fmt.Sprintf("PID: %d", h.pid)
	timeText := fmt.Sprintf("Time: %s", time.Now().Format("15:04:05"))
	
	// Draw vertical separator
	screen.SetContent(contentX+leftWidth, contentY, '│', nil, tcell.StyleDefault.Foreground(tcell.ColorDarkGray))
	
	// PID column
	tview.Print(screen, pidText, contentX+leftWidth+2, contentY, rightWidth/2-2, tview.AlignLeft, tcell.ColorWhite)
	
	// Time column
	tview.Print(screen, timeText, contentX+leftWidth+rightWidth/2, contentY, rightWidth/2, tview.AlignLeft, tcell.ColorWhite)
	
	// Line 2: Output info (left) | Lock and Elapsed (right)
	if contentY+1 < y+height-1 {
		// Left side - Output
		outputText := fmt.Sprintf("Output:  %s", h.outputPath)
		if len(outputText) > leftWidth-2 {
			outputText = outputText[:leftWidth-5] + "..."
		}
		tview.Print(screen, outputText, contentX, contentY+1, leftWidth, tview.AlignLeft, tcell.ColorWhite)
		
		// Right side separator
		screen.SetContent(contentX+leftWidth, contentY+1, '│', nil, tcell.StyleDefault.Foreground(tcell.ColorDarkGray))
		
		// Lock status
		lockColor := tcell.ColorGreen
		lockSymbol := "●"
		if h.lockStatus != "Free" {
			lockColor = tcell.ColorRed
			lockSymbol = "●"
		}
		tview.Print(screen, "Lock: ", contentX+leftWidth+2, contentY+1, 6, tview.AlignLeft, tcell.ColorWhite)
		tview.Print(screen, lockSymbol, contentX+leftWidth+8, contentY+1, 1, tview.AlignLeft, lockColor)
		tview.Print(screen, " "+h.lockStatus, contentX+leftWidth+9, contentY+1, 10, tview.AlignLeft, tcell.ColorWhite)
		
		// Elapsed time
		elapsed := time.Since(h.startTime)
		elapsedText := fmt.Sprintf("Elapsed: %02d:%02d", 
			int(elapsed.Minutes()), 
			int(elapsed.Seconds())%60)
		tview.Print(screen, elapsedText, contentX+leftWidth+rightWidth/2, contentY+1, rightWidth/2, tview.AlignLeft, tcell.ColorWhite)
	}
}

// UpdateProject updates project information
func (h *UltraHeaderPanel) UpdateProject(project, output string, pid int) {
	h.projectPath = project
	h.outputPath = output
	h.pid = pid
}

// SetConnection updates connection status
func (h *UltraHeaderPanel) SetConnection(connected bool) {
	if connected {
		h.connection = "Connected"
	} else {
		h.connection = "Disconnected"
	}
}

// SetLock updates lock status
func (h *UltraHeaderPanel) SetLock(locked bool) {
	if locked {
		h.lockStatus = "Locked"
	} else {
		h.lockStatus = "Free"
	}
}

// startTicker starts the time update ticker
func (h *UltraHeaderPanel) startTicker() {
	h.ticker = time.NewTicker(time.Second)
	go func() {
		for range h.ticker.C {
			// In real app, would trigger redraw
		}
	}()
}

// Stop stops the ticker
func (h *UltraHeaderPanel) Stop() {
	if h.ticker != nil {
		h.ticker.Stop()
	}
}

// GetFormattedTitle returns the formatted title with proper padding
func (h *UltraHeaderPanel) GetFormattedTitle(width int) string {
	title := "DocuMentor TUI v3.0 - Ultra Pipeline"
	padding := width - len(title) - 20 // Leave space for connection indicator
	if padding > 0 {
		return title + strings.Repeat("─", padding)
	}
	return title
}