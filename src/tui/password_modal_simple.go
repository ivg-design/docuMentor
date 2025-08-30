package main

import (
	"fmt"
	"time"
	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// PasswordRequest represents a password request from the documentor
type PasswordRequest struct {
	Type      string `json:"type"`       // "password_request"
	RequestID string `json:"requestId"`  // Unique ID for this request
	Prompt    string `json:"prompt"`     // What the password is for
	Context   string `json:"context"`    // Additional context
}

// Simple password modal that replaces the entire screen temporarily
func (t *TUI) showSimplePasswordModal(prompt, context string, onSubmit func(string, bool)) {
	// Set modal open flag
	t.modalOpen = true
	
	// Store the password
	var password string
	
	// Create password input field
	inputField := tview.NewInputField().
		SetLabel("Password: ").
		SetFieldWidth(40).
		SetMaskCharacter('*')
	
	// Update password on every change
	inputField.SetChangedFunc(func(text string) {
		password = text
	})
	
	// Use SetInputCapture to handle Enter and Escape directly
	inputField.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		switch event.Key() {
		case tcell.KeyEnter:
			// Submit password and return to main view
			t.modalOpen = false
			t.app.SetRoot(t.rootPages, true)
			t.app.SetFocus(t.getCurrentView())
			if onSubmit != nil {
				onSubmit(password, false)
			}
			return nil // Consume the event
		case tcell.KeyEscape:
			// Cancel and return to main view
			t.modalOpen = false
			t.app.SetRoot(t.rootPages, true)
			t.app.SetFocus(t.getCurrentView())
			if onSubmit != nil {
				onSubmit("", true)
			}
			return nil // Consume the event
		}
		// Let other keys through for normal typing
		return event
	})
	
	// Create prompt text
	textView := tview.NewTextView().
		SetDynamicColors(true).
		SetTextAlign(tview.AlignCenter).
		SetText(fmt.Sprintf("[yellow]%s[white]\n\n[gray]%s[white]\n\n[dim]Press Enter to submit, Escape to cancel[white]", prompt, context))
	
	// Create container without border
	container := tview.NewFlex().
		SetDirection(tview.FlexRow).
		AddItem(nil, 0, 1, false).        // Top spacer
		AddItem(textView, 6, 0, false).   // Prompt text
		AddItem(inputField, 1, 0, true).  // Password input (focused)
		AddItem(nil, 0, 1, false)         // Bottom spacer
	
	// Center horizontally
	centered := tview.NewFlex().
		AddItem(nil, 0, 1, false).
		AddItem(container, 60, 0, true).
		AddItem(nil, 0, 1, false)
	
	// Replace the entire root with the modal
	t.app.SetRoot(centered, true)
	t.app.SetFocus(inputField)
}

// getCurrentView returns the currently active view
func (t *TUI) getCurrentView() tview.Primitive {
	switch t.viewMode {
	case "debug":
		return t.debugView
	case "raw":
		return t.rawView
	default:
		return t.mainView
	}
}

// Test password modal with simple replacement
func (t *TUI) testSimplePasswordModal() {
	t.addLog("info", "Opening password modal...", time.Now().Format("15:04:05"))
	
	t.showSimplePasswordModal(
		"sudo password required",
		"Command: sudo apt-get install build-essential",
		func(password string, cancelled bool) {
			if cancelled {
				t.addLog("info", "Password cancelled", time.Now().Format("15:04:05"))
			} else {
				t.addLog("success", fmt.Sprintf("Password received: %d chars", len(password)), time.Now().Format("15:04:05"))
			}
		})
}