package main

import (
	"fmt"
	"time"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// WorkersPanel displays all 4 workers
type WorkersPanel struct {
	*tview.Grid
	
	workers      [4]*SingleWorkerPanel
	lastUpdate   time.Time
}

// SingleWorkerPanel represents one worker display
type SingleWorkerPanel struct {
	*tview.Box
	
	data WorkerData
}

// NewWorkersPanel creates a new workers panel with 4 workers
func NewWorkersPanel() *WorkersPanel {
	panel := &WorkersPanel{
		Grid:       tview.NewGrid(),
		lastUpdate: time.Now(),
	}
	
	// Create 4 worker panels
	for i := 0; i < 4; i++ {
		worker := &SingleWorkerPanel{
			Box: tview.NewBox(),
			data: WorkerData{
				ID:    i + 1,
				State: WorkerStateIdle,
				Stats: WorkerStats{},
			},
		}
		worker.SetBorder(true).
			SetTitle(fmt.Sprintf(" [W%d] ", i+1)).
			SetTitleAlign(tview.AlignLeft)
		
		panel.workers[i] = worker
	}
	
	// Set up single row with 4 columns for workers (horizontal layout)
	panel.Grid.SetRows(0).
		SetColumns(0, 0, 0, 0).  // 4 equal columns
		SetBorders(false)
	
	panel.Grid.AddItem(panel.workers[0], 0, 0, 1, 1, 0, 0, false)
	panel.Grid.AddItem(panel.workers[1], 0, 1, 1, 1, 0, 0, false)
	panel.Grid.AddItem(panel.workers[2], 0, 2, 1, 1, 0, 0, false)
	panel.Grid.AddItem(panel.workers[3], 0, 3, 1, 1, 0, 0, false)
	
	return panel
}

// UpdateWorker updates a specific worker's data
func (w *WorkersPanel) UpdateWorker(id int, data WorkerData) {
	if id >= 1 && id <= 4 {
		w.workers[id-1].data = data
		w.workers[id-1].updateBorderColor()
		w.lastUpdate = time.Now()
	}
}

// GetWorker returns a specific worker's data
func (w *WorkersPanel) GetWorker(id int) *WorkerData {
	if id >= 1 && id <= 4 {
		return &w.workers[id-1].data
	}
	return nil
}

// GetAllWorkers returns all worker data
func (w *WorkersPanel) GetAllWorkers() []WorkerData {
	result := make([]WorkerData, 4)
	for i := 0; i < 4; i++ {
		result[i] = w.workers[i].data
	}
	return result
}

// updateBorderColor updates the border color based on worker state
func (s *SingleWorkerPanel) updateBorderColor() {
	color := tcell.ColorWhite
	title := fmt.Sprintf("[W%d]-", s.data.ID)
	
	switch s.data.State {
	case WorkerStateBusy:
		color = tcell.ColorGreen
		title = fmt.Sprintf("[W%d]-BUSY", s.data.ID)
	case WorkerStateBlocked:
		color = tcell.ColorYellow
		title = fmt.Sprintf("[W%d]-BLOCKED", s.data.ID)
	case WorkerStateError:
		color = tcell.ColorRed
		title = fmt.Sprintf("[W%d]-ERROR", s.data.ID)
	case WorkerStateComplete:
		color = tcell.ColorBlue
		title = fmt.Sprintf("[W%d]-DONE", s.data.ID)
	default:
		color = tcell.ColorDarkGray
		title = fmt.Sprintf("[W%d]-IDLE", s.data.ID)
	}
	
	s.SetBorderColor(color)
	s.SetTitle(fmt.Sprintf(" %s ", title))
}

// Draw renders a single worker panel
func (s *SingleWorkerPanel) Draw(screen tcell.Screen) {
	s.Box.DrawForSubclass(screen, s)
	x, y, width, height := s.GetInnerRect()
	
	if height < 3 || width < 20 {
		return // Not enough space
	}
	
	row := 0
	
	// Draw file being processed
	if s.data.File != "" {
		file := truncate(s.data.File, width-2)
		drawText(screen, x, y+row, file, width, tcell.StyleDefault.Bold(true))
		row++
	}
	
	// Draw operation
	if s.data.Operation != "" && row < height {
		op := truncate(s.data.Operation, width-2)
		drawText(screen, x, y+row, op, width, tcell.StyleDefault)
		row++
	}
	
	// Draw progress bar if applicable
	if s.data.Progress > 0 && row < height {
		drawProgressBar(screen, x, y+row, width, s.data.Progress)
		row++
	}
	
	// Draw time elapsed
	if s.data.TimeElapsed > 0 && row < height {
		timeStr := formatDuration(s.data.TimeElapsed)
		drawText(screen, x, y+row, timeStr, width, tcell.StyleDefault.Dim(true))
		row++
	}
	
	// Draw stats when idle
	if s.data.State == WorkerStateIdle && s.data.Stats.Completed > 0 && row < height {
		stats := fmt.Sprintf("✓ %d  ✗ %d", s.data.Stats.Completed, s.data.Stats.Failed)
		drawText(screen, x, y+row, stats, width, tcell.StyleDefault.Foreground(tcell.ColorGray))
		row++
	}
}

// Helper function to draw text
func drawText(screen tcell.Screen, x, y int, text string, maxWidth int, style tcell.Style) {
	for i, r := range text {
		if i >= maxWidth {
			break
		}
		screen.SetContent(x+i, y, r, nil, style)
	}
}

// Helper function to draw progress bar
func drawProgressBar(screen tcell.Screen, x, y, width, progress int) {
	if width < 10 {
		return
	}
	
	barWidth := width - 8
	filled := (progress * barWidth) / 100
	
	screen.SetContent(x, y, '[', nil, tcell.StyleDefault)
	
	for i := 0; i < barWidth; i++ {
		if i < filled {
			screen.SetContent(x+1+i, y, '█', nil, tcell.StyleDefault.Foreground(tcell.ColorGreen))
		} else {
			screen.SetContent(x+1+i, y, '░', nil, tcell.StyleDefault.Foreground(tcell.ColorDarkGray))
		}
	}
	
	screen.SetContent(x+barWidth+1, y, ']', nil, tcell.StyleDefault)
	
	// Draw percentage
	percentText := fmt.Sprintf(" %3d%%", progress)
	for i, r := range percentText {
		if x+barWidth+2+i < x+width {
			screen.SetContent(x+barWidth+2+i, y, r, nil, tcell.StyleDefault)
		}
	}
}

// Helper function to truncate text
func truncate(text string, maxWidth int) string {
	if len(text) <= maxWidth {
		return text
	}
	if maxWidth <= 3 {
		return "..."
	}
	return text[:maxWidth-3] + "..."
}

// Helper function to format duration
func formatDuration(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%.1fs", d.Seconds())
	}
	if d < time.Hour {
		mins := int(d.Minutes())
		secs := int(d.Seconds()) % 60
		return fmt.Sprintf("%dm %ds", mins, secs)
	}
	hours := int(d.Hours())
	mins := int(d.Minutes()) % 60
	return fmt.Sprintf("%dh %dm", hours, mins)
}

// ResetWorker resets a worker to idle state
func (w *WorkersPanel) ResetWorker(id int) {
	if id >= 1 && id <= 4 {
		w.workers[id-1].data = WorkerData{
			ID:    id,
			State: WorkerStateIdle,
			Stats: w.workers[id-1].data.Stats, // Keep stats
		}
		w.workers[id-1].updateBorderColor()
	}
}

// ResetAllWorkers resets all workers to idle
func (w *WorkersPanel) ResetAllWorkers() {
	for i := 1; i <= 4; i++ {
		w.ResetWorker(i)
	}
}

// GetBusyWorkerCount returns the number of busy workers
func (w *WorkersPanel) GetBusyWorkerCount() int {
	count := 0
	for _, worker := range w.workers {
		if worker.data.State == WorkerStateBusy {
			count++
		}
	}
	return count
}

// GetIdleWorkerCount returns the number of idle workers
func (w *WorkersPanel) GetIdleWorkerCount() int {
	count := 0
	for _, worker := range w.workers {
		if worker.data.State == WorkerStateIdle {
			count++
		}
	}
	return count
}