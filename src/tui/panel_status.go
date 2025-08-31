package main

import (
	"fmt"
	"strings"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// StatusPanel displays overall system status
type StatusPanel struct {
	*tview.TextView
	
	status     StatusInfo
	shortcuts  []string
}

// NewStatusPanel creates a new status panel
func NewStatusPanel() *StatusPanel {
	panel := &StatusPanel{
		TextView: tview.NewTextView().
			SetDynamicColors(true).
			SetTextAlign(tview.AlignCenter),
		status: StatusInfo{
			State:   "Ready",
			Message: "System initialized",
		},
		shortcuts: []string{
			"[yellow]F1[white] Help",
			"[yellow]F2[white] Config",
			"[yellow]F5[white] Refresh",
			"[yellow]F10[white] Quit",
			"[yellow]Space[white] Pause",
			"[yellow]Enter[white] Start",
		},
	}
	
	panel.SetBorder(true).
		SetTitle(" Status ").
		SetTitleAlign(tview.AlignLeft)
	
	panel.updateDisplay()
	
	return panel
}

// UpdateStatus updates the status information
func (s *StatusPanel) UpdateStatus(status StatusInfo) {
	s.status = status
	s.updateDisplay()
}

// updateDisplay refreshes the display
func (s *StatusPanel) updateDisplay() {
	// Single line status matching ULTRA DESIGN
	// STATUS: Processing "src/components/Button.tsx" → Button.tsx.md          [●●●] spinning
	
	statusColor := s.getStatusColor()
	statusSymbol := s.getStatusSymbol()
	
	statusText := fmt.Sprintf("STATUS: [%s]%s[white] %s", statusColor, statusSymbol, s.status.Message)
	
	// Add spinner if running
	if strings.ToLower(s.status.State) == "running" {
		statusText += "  [●●●]"
	}
	
	s.SetText(statusText)
}

// getStatusColor returns appropriate color for status
func (s *StatusPanel) getStatusColor() string {
	switch strings.ToLower(s.status.State) {
	case "ready", "running":
		return "green"
	case "paused", "waiting":
		return "yellow"
	case "error", "failed":
		return "red"
	case "complete", "done":
		return "blue"
	default:
		return "white"
	}
}

// getStatusSymbol returns symbol for current status
func (s *StatusPanel) getStatusSymbol() string {
	switch strings.ToLower(s.status.State) {
	case "ready":
		return "●"
	case "running":
		return "▶"
	case "paused":
		return "‖"
	case "error", "failed":
		return "✗"
	case "complete", "done":
		return "✓"
	default:
		return "○"
	}
}

// createProgressBar creates a text progress bar
func (s *StatusPanel) createProgressBar(progress int) string {
	width := 20
	filled := (progress * width) / 100
	
	bar := "["
	for i := 0; i < width; i++ {
		if i < filled {
			bar += "█"
		} else {
			bar += "░"
		}
	}
	bar += fmt.Sprintf("] %d%%", progress)
	
	return bar
}

// SetState sets the status state
func (s *StatusPanel) SetState(state string) {
	s.status.State = state
	s.updateDisplay()
}

// SetMessage sets the status message
func (s *StatusPanel) SetMessage(message string) {
	s.status.Message = message
	s.updateDisplay()
}

// SetDetails sets the status details
func (s *StatusPanel) SetDetails(details string) {
	s.status.Details = details
	s.updateDisplay()
}

// SetProgress sets the progress
func (s *StatusPanel) SetProgress(progress int) {
	s.status.Progress = progress
	s.updateDisplay()
}

// SetError sets an error state
func (s *StatusPanel) SetError(message string) {
	s.status.State = "Error"
	s.status.Message = message
	s.status.Details = ""
	s.updateDisplay()
}

// SetSuccess sets a success state
func (s *StatusPanel) SetSuccess(message string) {
	s.status.State = "Complete"
	s.status.Message = message
	s.status.Progress = 100
	s.updateDisplay()
}

// SetRunning sets a running state
func (s *StatusPanel) SetRunning(message string) {
	s.status.State = "Running"
	s.status.Message = message
	s.updateDisplay()
}

// SetPaused sets a paused state
func (s *StatusPanel) SetPaused() {
	s.status.State = "Paused"
	s.status.Message = "Processing paused"
	s.updateDisplay()
}

// Reset resets to initial state
func (s *StatusPanel) Reset() {
	s.status = StatusInfo{
		State:    "Ready",
		Message:  "System ready",
		Details:  "",
		Progress: 0,
	}
	s.updateDisplay()
}

// GetStatus returns current status
func (s *StatusPanel) GetStatus() StatusInfo {
	return s.status
}

// UpdateShortcuts updates the shortcut display
func (s *StatusPanel) UpdateShortcuts(shortcuts []string) {
	s.shortcuts = shortcuts
	s.updateDisplay()
}

// FlashMessage temporarily shows a message
func (s *StatusPanel) FlashMessage(message string, duration int) {
	// Store old status for restoration (would be used in full implementation)
	// oldStatus := s.status
	s.status.Message = message
	s.updateDisplay()
	
	// In real implementation, would use goroutine with timer
	// to restore old status after duration
}

// GetColorStyle returns tcell color for current status
func (s *StatusPanel) GetColorStyle() tcell.Color {
	switch strings.ToLower(s.status.State) {
	case "ready", "running":
		return tcell.ColorGreen
	case "paused", "waiting":
		return tcell.ColorYellow
	case "error", "failed":
		return tcell.ColorRed
	case "complete", "done":
		return tcell.ColorBlue
	default:
		return tcell.ColorWhite
	}
}