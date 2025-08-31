package main

import (
	"github.com/rivo/tview"
)

// ControlsBarPanel displays control buttons as a continuous bar
type ControlsBarPanel struct {
	*tview.TextView
	
	app *tview.Application
}

// NewControlsBarPanel creates a new controls bar panel
func NewControlsBarPanel(app *tview.Application) *ControlsBarPanel {
	panel := &ControlsBarPanel{
		TextView: tview.NewTextView().SetDynamicColors(true),
		app:      app,
	}
	
	// Set as a continuous bar with all controls
	panel.SetTextAlign(tview.AlignCenter)
	panel.SetBorder(false)
	
	// Display controls as a continuous line
	controlsText := "[yellow](H)[white] Help   [yellow](P)[white] Pause   [yellow](R)[white] Resume   [yellow](V)[white] RAW   [yellow](D)[white] Debug   [yellow](Esc)[white] Exit   [yellow](↑↓)[white] Scroll"
	panel.SetText(controlsText)
	
	return panel
}