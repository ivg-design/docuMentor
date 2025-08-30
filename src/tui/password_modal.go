package main

import (
	"fmt"
	"time"
	"github.com/rivo/tview"
)

// PasswordRequest represents a password request from the documentor
type PasswordRequest struct {
	Type      string `json:"type"`       // "password_request"
	RequestID string `json:"requestId"`  // Unique ID for this request
	Prompt    string `json:"prompt"`     // What the password is for (e.g., "sudo password required")
	Context   string `json:"context"`    // Additional context (e.g., command being run)
}

// PasswordResponse to send back to documentor
type PasswordResponse struct {
	Type      string `json:"type"`       // "password_response"
	RequestID string `json:"requestId"`  // Matching request ID
	Password  string `json:"password"`   // The entered password
	Cancelled bool   `json:"cancelled"`  // If user cancelled instead
}

// showPasswordModal displays the password modal using a simple approach
func (t *TUI) showPasswordModal(prompt, context string, onSubmit func(string, bool)) {
	// Use the built-in modal from tview
	modal := tview.NewModal().
		SetText(fmt.Sprintf("%s\n\n%s\n\nPress Enter to submit, Escape to cancel", prompt, context)).
		AddButtons([]string{"OK", "Cancel"}).
		SetDoneFunc(func(buttonIndex int, buttonLabel string) {
			// Remove the modal
			t.rootPages.RemovePage("password-modal")
			
			// Call the callback
			if onSubmit != nil {
				onSubmit("test-password", buttonLabel == "Cancel")
			}
		})
	
	// Add and show the modal
	t.rootPages.AddPage("password-modal", modal, true, true)
}

// handlePasswordRequest processes incoming password requests from documentor
func (t *TUI) handlePasswordRequest(req PasswordRequest) {
	t.app.QueueUpdateDraw(func() {
		t.showPasswordModal(req.Prompt, req.Context, func(password string, cancelled bool) {
			// Log the result
			if cancelled {
				t.addLog("info", "Password request cancelled", time.Now().Format("15:04:05"))
			} else {
				t.addLog("success", "Password submitted", time.Now().Format("15:04:05"))
			}
		})
	})
}

// Test function to demonstrate password modal - use QueueUpdateDraw for proper threading
func (t *TUI) testPasswordModal() {
	// Must use QueueUpdateDraw when triggered from key handler
	t.app.QueueUpdateDraw(func() {
		// Use the simple built-in modal first to test
		modal := tview.NewModal().
			SetText("Password Test\n\nThis is a test of the password modal.\nPress Escape to close.").
			AddButtons([]string{"OK", "Cancel"}).
			SetDoneFunc(func(buttonIndex int, buttonLabel string) {
				t.rootPages.RemovePage("test-modal")
				t.addLog("info", fmt.Sprintf("Modal closed: %s", buttonLabel), time.Now().Format("15:04:05"))
			})
		
		t.rootPages.AddPage("test-modal", modal, true, true)
	})
}