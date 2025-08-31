package main

import (
	"fmt"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// UltraWorkersPanel displays all 4 workers in ULTRA DESIGN format
type UltraWorkersPanel struct {
	*tview.Box
	
	workers [4]WorkerData
}

// NewUltraWorkersPanel creates a new ultra workers panel
func NewUltraWorkersPanel() *UltraWorkersPanel {
	panel := &UltraWorkersPanel{
		Box: tview.NewBox(),
	}
	
	// Initialize workers
	for i := 0; i < 4; i++ {
		panel.workers[i] = WorkerData{
			ID:    i + 1,
			State: WorkerStateIdle,
		}
	}
	
	panel.SetBorder(false)
	
	return panel
}

// Draw renders all 4 workers horizontally
func (w *UltraWorkersPanel) Draw(screen tcell.Screen) {
	w.Box.DrawForSubclass(screen, w)
	x, y, width, height := w.GetInnerRect()
	
	if height < 3 || width < 80 {
		return
	}
	
	// Each worker gets 1/4 of width
	workerWidth := width / 4
	
	for i := 0; i < 4; i++ {
		startX := x + (i * workerWidth)
		w.drawSingleWorker(screen, &w.workers[i], startX, y, workerWidth-1, height)
	}
}

// drawSingleWorker draws one worker with title + 2 lines
func (w *UltraWorkersPanel) drawSingleWorker(screen tcell.Screen, worker *WorkerData, x, y, width, height int) {
	// Determine border color based on state
	borderColor := tcell.ColorDarkGray
	stateText := "IDLE"
	
	switch worker.State {
	case WorkerStateBusy:
		borderColor = tcell.ColorGreen
		stateText = "BUSY"
	case WorkerStateBlocked:
		borderColor = tcell.ColorYellow
		stateText = "BLOCKED"
	case WorkerStateError:
		borderColor = tcell.ColorRed
		stateText = "ERROR"
	case WorkerStateComplete:
		borderColor = tcell.ColorBlue
		stateText = "DONE"
	}
	
	// Draw border box
	// Top border with title: ┌─[W1]-BUSY──────────┐
	screen.SetContent(x, y, '┌', nil, tcell.StyleDefault.Foreground(borderColor))
	screen.SetContent(x+1, y, '─', nil, tcell.StyleDefault.Foreground(borderColor))
	
	// Title in border
	title := fmt.Sprintf("[W%d]-%s", worker.ID, stateText)
	for i, r := range title {
		if x+2+i < x+width-1 {
			screen.SetContent(x+2+i, y, r, nil, tcell.StyleDefault.Foreground(borderColor))
		}
	}
	
	// Fill rest of top border
	for i := 2 + len(title); i < width-1; i++ {
		screen.SetContent(x+i, y, '─', nil, tcell.StyleDefault.Foreground(borderColor))
	}
	screen.SetContent(x+width-1, y, '┐', nil, tcell.StyleDefault.Foreground(borderColor))
	
	// Side borders and content
	for row := 1; row < 3 && y+row < y+height; row++ {
		screen.SetContent(x, y+row, '│', nil, tcell.StyleDefault.Foreground(borderColor))
		screen.SetContent(x+width-1, y+row, '│', nil, tcell.StyleDefault.Foreground(borderColor))
	}
	
	// Line 1: File name or status
	if y+1 < y+height {
		line1 := ""
		if worker.State == WorkerStateBusy && worker.File != "" {
			line1 = truncateText(worker.File, width-4)
		} else if worker.State == WorkerStateIdle {
			if worker.Stats.Completed > 0 {
				line1 = fmt.Sprintf("⚡ waiting...")
			} else {
				line1 = "Ready"
			}
		} else if worker.State == WorkerStateBlocked {
			line1 = "█ Waiting for API..."
		}
		
		if line1 != "" {
			for i, r := range line1 {
				if i < width-4 {
					screen.SetContent(x+2, y+1, ' ', nil, tcell.StyleDefault)
					screen.SetContent(x+2+i, y+1, r, nil, tcell.StyleDefault.Bold(worker.State == WorkerStateBusy))
				}
			}
		}
	}
	
	// Line 2: Operation/stats with time
	if y+2 < y+height {
		line2 := ""
		if worker.State == WorkerStateBusy && worker.Operation != "" {
			timeStr := ""
			if worker.TimeElapsed > 0 {
				timeStr = fmt.Sprintf(" [%ds]", int(worker.TimeElapsed.Seconds()))
			}
			line2 = truncateText(worker.Operation, width-4-len(timeStr)) + timeStr
		} else if worker.State == WorkerStateIdle && worker.Stats.Completed > 0 {
			line2 = fmt.Sprintf("completed: %d", worker.Stats.Completed)
		} else if worker.State == WorkerStateBlocked {
			if worker.TimeElapsed > 0 {
				line2 = fmt.Sprintf("waiting [%ds]", int(worker.TimeElapsed.Seconds()))
			}
		}
		
		if line2 != "" {
			for i, r := range line2 {
				if i < width-4 {
					screen.SetContent(x+2+i, y+2, r, nil, tcell.StyleDefault.Dim(true))
				}
			}
		}
	}
	
	// Bottom border
	if y+3 <= y+height {
		screen.SetContent(x, y+3, '└', nil, tcell.StyleDefault.Foreground(borderColor))
		for i := 1; i < width-1; i++ {
			screen.SetContent(x+i, y+3, '─', nil, tcell.StyleDefault.Foreground(borderColor))
		}
		screen.SetContent(x+width-1, y+3, '┘', nil, tcell.StyleDefault.Foreground(borderColor))
	}
}

// UpdateWorker updates a specific worker's data
func (w *UltraWorkersPanel) UpdateWorker(id int, data WorkerData) {
	if id >= 1 && id <= 4 {
		w.workers[id-1] = data
	}
}

// truncateText truncates text to fit within maxWidth
func truncateText(text string, maxWidth int) string {
	if len(text) <= maxWidth {
		return text
	}
	if maxWidth <= 3 {
		return "..."
	}
	return text[:maxWidth-3] + "..."
}