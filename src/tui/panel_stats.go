package main

import (
	"fmt"

	"github.com/rivo/tview"
)

// StatsPanel displays file processing statistics
type StatsPanel struct {
	*tview.TextView
	
	stats FileStats
}

// NewStatsPanel creates a new stats panel
func NewStatsPanel() *StatsPanel {
	panel := &StatsPanel{
		TextView: tview.NewTextView().
			SetDynamicColors(true).
			SetTextAlign(tview.AlignLeft),
		stats: FileStats{},
	}
	
	panel.SetBorder(true).
		SetTitle(" File Stats ").
		SetTitleAlign(tview.AlignLeft)
	
	panel.updateDisplay()
	
	return panel
}

// UpdateStats updates the statistics
func (s *StatsPanel) UpdateStats(stats FileStats) {
	s.stats = stats
	s.updateDisplay()
}

// updateDisplay refreshes the display
func (s *StatsPanel) updateDisplay() {
	// Inline format matching ULTRA DESIGN
	// Files: 156/487  Queue: 331  Rate: 6.2/s  Errors: 2  Docs: 3
	text := fmt.Sprintf(`Files: [yellow]%d[white]/[cyan]%d[white]  Queue: [yellow]%d[white]  Rate: [green]%.1f/s[white]  Errors: [red]%d[white]`,
		s.stats.Processed,
		s.stats.Total,
		s.stats.Queue,
		s.stats.Rate/60.0, // Convert to per second
		s.stats.Errors)
	
	s.SetText(text)
}

// GetStats returns the current stats
func (s *StatsPanel) GetStats() FileStats {
	return s.stats
}

// IncrementProcessed increments the processed count
func (s *StatsPanel) IncrementProcessed() {
	s.stats.Processed++
	s.stats.Queue = s.stats.Total - s.stats.Processed
	s.updateDisplay()
}

// IncrementErrors increments the error count
func (s *StatsPanel) IncrementErrors() {
	s.stats.Errors++
	s.updateDisplay()
}

// SetTotal sets the total file count
func (s *StatsPanel) SetTotal(total int) {
	s.stats.Total = total
	s.stats.Queue = total - s.stats.Processed
	s.updateDisplay()
}

// CalculateRate calculates processing rate
func (s *StatsPanel) CalculateRate(duration float64) {
	if duration > 0 {
		s.stats.Rate = float64(s.stats.Processed) / duration * 60
		s.updateDisplay()
	}
}

// GetCompletionPercentage returns completion percentage
func (s *StatsPanel) GetCompletionPercentage() int {
	if s.stats.Total == 0 {
		return 0
	}
	return (s.stats.Processed * 100) / s.stats.Total
}

// GetSuccessRate returns the success rate
func (s *StatsPanel) GetSuccessRate() float64 {
	if s.stats.Processed == 0 {
		return 0
	}
	successful := s.stats.Processed - s.stats.Errors
	return (float64(successful) / float64(s.stats.Processed)) * 100
}

// Reset resets all statistics
func (s *StatsPanel) Reset() {
	s.stats = FileStats{}
	s.updateDisplay()
}

// GetSummary returns a one-line summary
func (s *StatsPanel) GetSummary() string {
	return fmt.Sprintf("Files: %d/%d | Queue: %d | Errors: %d | Rate: %.1f/min",
		s.stats.Processed, s.stats.Total, s.stats.Queue, s.stats.Errors, s.stats.Rate)
}