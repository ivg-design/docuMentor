package main

import (
	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// ControlsPanel displays control buttons
type ControlsPanel struct {
	*tview.Flex
	
	buttons []*tview.Button
	app     *tview.Application
}

// NewControlsPanel creates a new controls panel with buttons
func NewControlsPanel(app *tview.Application) *ControlsPanel {
	panel := &ControlsPanel{
		Flex: tview.NewFlex().SetDirection(tview.FlexColumn),
		app:  app,
	}
	
	// Create buttons with styling
	buttonStyle := tcell.StyleDefault.Background(tcell.ColorDarkCyan).Foreground(tcell.ColorWhite)
	
	// Helper function to create styled button
	createButton := func(label string, handler func()) *tview.Button {
		btn := tview.NewButton(label).SetSelectedFunc(handler)
		btn.SetBackgroundColor(tcell.ColorDarkCyan)
		btn.SetLabelColor(tcell.ColorWhite)
		btn.SetStyle(buttonStyle)
		return btn
	}
	
	// Create all buttons - using parentheses instead of brackets to avoid tview parsing issues
	helpBtn := createButton("(H) Help", func() {
		// Help handler
	})
	
	pauseBtn := createButton("(P) Pause", func() {
		// Pause handler
	})
	
	resumeBtn := createButton("(R) Resume", func() {
		// Resume handler
	})
	
	rawBtn := createButton("(V) RAW", func() {
		// Raw view handler
	})
	
	debugBtn := createButton("(D) Debug", func() {
		// Debug handler
	})
	
	exitBtn := createButton("(Esc) Exit", func() {
		if panel.app != nil {
			panel.app.Stop()
		}
	})
	
	scrollBtn := createButton("(↑↓) Scroll", func() {
		// Scroll info
	})
	
	// Add buttons to flex with even spacing using proportion 1 for each
	panel.Flex.
		AddItem(nil, 0, 1, false).      // Left spacer (flexible)
		AddItem(helpBtn, 0, 2, true).   // Button with proportion 2
		AddItem(nil, 0, 1, false).      // Spacer
		AddItem(pauseBtn, 0, 2, true).  // Button
		AddItem(nil, 0, 1, false).      // Spacer
		AddItem(resumeBtn, 0, 2, true). // Button
		AddItem(nil, 0, 1, false).      // Spacer
		AddItem(rawBtn, 0, 2, true).    // Button
		AddItem(nil, 0, 1, false).      // Spacer
		AddItem(debugBtn, 0, 2, true).  // Button
		AddItem(nil, 0, 1, false).      // Spacer
		AddItem(exitBtn, 0, 2, true).   // Button
		AddItem(nil, 0, 1, false).      // Spacer
		AddItem(scrollBtn, 0, 2, true). // Button
		AddItem(nil, 0, 1, false)       // Right spacer (flexible)
	
	panel.buttons = []*tview.Button{
		helpBtn, pauseBtn, resumeBtn, rawBtn, debugBtn, exitBtn, scrollBtn,
	}
	
	panel.SetBorder(false)
	
	return panel
}

// SetButtonHandler sets a handler for a specific button
func (c *ControlsPanel) SetButtonHandler(index int, handler func()) {
	if index >= 0 && index < len(c.buttons) {
		c.buttons[index].SetSelectedFunc(handler)
	}
}

// DisableButton disables a specific button
func (c *ControlsPanel) DisableButton(index int) {
	if index >= 0 && index < len(c.buttons) {
		c.buttons[index].SetDisabled(true)
	}
}

// EnableButton enables a specific button
func (c *ControlsPanel) EnableButton(index int) {
	if index >= 0 && index < len(c.buttons) {
		c.buttons[index].SetDisabled(false)
	}
}