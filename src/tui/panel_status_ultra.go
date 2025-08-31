package main

import (
	"fmt"
	"sync"
	"time"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// UltraStatusPanel displays status with animated spinner
type UltraStatusPanel struct {
	*tview.Box
	
	message      string
	isProcessing bool
	spinnerIndex int
	spinnerMutex sync.Mutex
	ticker       *time.Ticker
}

// Spinner characters for animation
var spinnerChars = []rune{'⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'}

// NewUltraStatusPanel creates a new ultra status panel
func NewUltraStatusPanel() *UltraStatusPanel {
	panel := &UltraStatusPanel{
		Box:          tview.NewBox(),
		message:      "Ready",
		isProcessing: false,
		spinnerIndex: 0,
	}
	
	panel.SetBorder(true).
		SetBorderPadding(0, 0, 1, 1)
	
	// Start spinner animation
	panel.startSpinner()
	
	return panel
}

// Draw renders the status panel with spinner
func (s *UltraStatusPanel) Draw(screen tcell.Screen) {
	s.Box.DrawForSubclass(screen, s)
	x, y, width, _ := s.GetInnerRect()
	
	if width < 40 {
		return
	}
	
	// Format: STATUS: Processing "src/components/Button.tsx" → Button.tsx.md     [●●●]
	
	// Draw "STATUS: "
	statusLabel := "STATUS: "
	tview.Print(screen, statusLabel, x, y, len(statusLabel), tview.AlignLeft, tcell.ColorWhite)
	col := len(statusLabel)
	
	// Draw message
	messageColor := tcell.ColorWhite
	if s.isProcessing {
		messageColor = tcell.ColorGreen
	}
	
	maxMessageWidth := width - col - 10 // Leave space for spinner
	displayMessage := s.message
	if len(displayMessage) > maxMessageWidth {
		displayMessage = displayMessage[:maxMessageWidth-3] + "..."
	}
	
	tview.Print(screen, displayMessage, x+col, y, len(displayMessage), tview.AlignLeft, messageColor)
	
	// Draw spinner on the right if processing
	if s.isProcessing {
		s.spinnerMutex.Lock()
		spinnerChar := spinnerChars[s.spinnerIndex]
		s.spinnerMutex.Unlock()
		
		spinnerPos := x + width - 6
		screen.SetContent(spinnerPos, y, '[', nil, tcell.StyleDefault.Foreground(tcell.ColorDarkGray))
		screen.SetContent(spinnerPos+1, y, spinnerChar, nil, tcell.StyleDefault.Foreground(tcell.ColorGreen))
		screen.SetContent(spinnerPos+2, y, spinnerChar, nil, tcell.StyleDefault.Foreground(tcell.ColorGreen))
		screen.SetContent(spinnerPos+3, y, spinnerChar, nil, tcell.StyleDefault.Foreground(tcell.ColorGreen))
		screen.SetContent(spinnerPos+4, y, ']', nil, tcell.StyleDefault.Foreground(tcell.ColorDarkGray))
	}
}

// SetProcessing sets the processing state with file information
func (s *UltraStatusPanel) SetProcessing(inputFile, outputFile string) {
	s.message = fmt.Sprintf("Processing \"%s\" → %s", inputFile, outputFile)
	s.isProcessing = true
}

// SetMessage sets a simple status message
func (s *UltraStatusPanel) SetMessage(message string) {
	s.message = message
	s.isProcessing = false
}

// SetError sets an error message
func (s *UltraStatusPanel) SetError(message string) {
	s.message = fmt.Sprintf("⚠ Error: %s", message)
	s.isProcessing = false
}

// SetComplete sets completion message
func (s *UltraStatusPanel) SetComplete() {
	s.message = "✓ All files processed successfully!"
	s.isProcessing = false
}

// startSpinner starts the spinner animation
func (s *UltraStatusPanel) startSpinner() {
	s.ticker = time.NewTicker(100 * time.Millisecond)
	go func() {
		for range s.ticker.C {
			s.spinnerMutex.Lock()
			s.spinnerIndex = (s.spinnerIndex + 1) % len(spinnerChars)
			s.spinnerMutex.Unlock()
		}
	}()
}

// Stop stops the spinner animation
func (s *UltraStatusPanel) Stop() {
	if s.ticker != nil {
		s.ticker.Stop()
	}
}