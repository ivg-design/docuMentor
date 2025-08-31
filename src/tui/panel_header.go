package main

import (
	"fmt"
	"time"

	"github.com/rivo/tview"
)

// HeaderPanel displays project info and system status
type HeaderPanel struct {
	*tview.Grid
	
	titleView      *tview.TextView
	projectView    *tview.TextView
	connectionView *tview.TextView
	pidView        *tview.TextView
	outputView     *tview.TextView
	lockView       *tview.TextView
	timeView       *tview.TextView
	elapsedView    *tview.TextView
	
	startTime time.Time
	ticker    *time.Ticker
}

// NewHeaderPanel creates a new header panel
func NewHeaderPanel() *HeaderPanel {
	panel := &HeaderPanel{
		Grid:      tview.NewGrid(),
		startTime: time.Now(),
	}
	
	// Create all text views
	panel.titleView = tview.NewTextView().
		SetTextAlign(tview.AlignCenter).
		SetDynamicColors(true).
		SetText("[cyan::b]DocuMentor TUI v3.0 - Ultra Pipeline[white]")
	
	panel.projectView = createInfoView("Project", "N/A")
	panel.connectionView = createInfoView("Connection", "[red]●[white] Disconnected")
	panel.pidView = createInfoView("PID", "N/A")
	panel.outputView = createInfoView("Output", "N/A")
	panel.lockView = createInfoView("Lock", "[green]●[white] Free")
	panel.timeView = createInfoView("Time", time.Now().Format("15:04:05"))
	panel.elapsedView = createInfoView("Elapsed", "00:00:00")
	
	// Set up grid layout (2 rows, 4 columns)
	panel.Grid.SetRows(1, 1).
		SetColumns(0, 0, 0, 0).
		SetBorders(false)
	
	// Row 1: Title spanning all columns
	panel.Grid.AddItem(panel.titleView, 0, 0, 1, 4, 0, 0, false)
	
	// Row 2: Info items
	infoFlex := tview.NewFlex().
		AddItem(panel.projectView, 0, 1, false).
		AddItem(panel.connectionView, 0, 1, false).
		AddItem(panel.pidView, 15, 0, false).
		AddItem(panel.outputView, 0, 1, false).
		AddItem(panel.lockView, 15, 0, false).
		AddItem(panel.timeView, 12, 0, false).
		AddItem(panel.elapsedView, 12, 0, false)
	
	panel.Grid.AddItem(infoFlex, 1, 0, 1, 4, 0, 0, false)
	
	// Start time updater
	panel.startTicker()
	
	return panel
}

// createInfoView creates a small info display
func createInfoView(label, value string) *tview.TextView {
	return tview.NewTextView().
		SetDynamicColors(true).
		SetTextAlign(tview.AlignLeft).
		SetText(fmt.Sprintf("[dim]%s:[white] %s", label, value))
}

// UpdateProject updates project information
func (h *HeaderPanel) UpdateProject(info ProjectInfo) {
	h.projectView.SetText(fmt.Sprintf("[dim]Project:[white] %s", info.Name))
	
	if info.Connection != "" {
		h.connectionView.SetText(fmt.Sprintf("[dim]Connection:[white] [green]●[white] %s", info.Connection))
	}
	
	if info.PID > 0 {
		h.pidView.SetText(fmt.Sprintf("[dim]PID:[white] %d", info.PID))
	}
	
	if info.Output != "" {
		h.outputView.SetText(fmt.Sprintf("[dim]Output:[white] %s", info.Output))
	}
	
	if info.Lock != "" {
		color := "green"
		if info.Lock == "locked" {
			color = "red"
		}
		h.lockView.SetText(fmt.Sprintf("[dim]Lock:[white] [%s]●[white] %s", color, info.Lock))
	}
}

// startTicker starts the time update ticker
func (h *HeaderPanel) startTicker() {
	h.ticker = time.NewTicker(time.Second)
	go func() {
		for range h.ticker.C {
			h.updateTime()
		}
	}()
}

// updateTime updates the time displays
func (h *HeaderPanel) updateTime() {
	h.timeView.SetText(fmt.Sprintf("[dim]Time:[white] %s", time.Now().Format("15:04:05")))
	
	elapsed := time.Since(h.startTime)
	hours := int(elapsed.Hours())
	minutes := int(elapsed.Minutes()) % 60
	seconds := int(elapsed.Seconds()) % 60
	h.elapsedView.SetText(fmt.Sprintf("[dim]Elapsed:[white] %02d:%02d:%02d", hours, minutes, seconds))
}

// Stop stops the ticker
func (h *HeaderPanel) Stop() {
	if h.ticker != nil {
		h.ticker.Stop()
	}
}