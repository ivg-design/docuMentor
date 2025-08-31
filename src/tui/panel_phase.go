package main

import (
	"fmt"
	"strings"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// PhasePanel displays current phase progress
type PhasePanel struct {
	*tview.Box
	
	currentPhase string
	progress     int
	status       string
}

// NewPhasePanel creates a new phase panel
func NewPhasePanel() *PhasePanel {
	panel := &PhasePanel{
		Box:          tview.NewBox(),
		currentPhase: "Initializing",
		progress:     0,
		status:       "Starting",
	}
	
	panel.SetBorder(true).
		SetTitle(" Phase Progress ").
		SetTitleAlign(tview.AlignLeft)
	
	return panel
}

// UpdatePhase updates the phase information
func (p *PhasePanel) UpdatePhase(data PhaseData) {
	p.currentPhase = data.Current
	p.progress = data.Progress
	p.status = data.Status
}

// Draw renders the phase panel
func (p *PhasePanel) Draw(screen tcell.Screen) {
	p.Box.DrawForSubclass(screen, p)
	x, y, width, height := p.GetInnerRect()
	
	if height < 1 || width < 20 {
		return // Not enough space
	}
	
	// Single line with phase and progress bar inline
	// Format: PHASE [3/9] Analysis [████████░░░░░░░░░░░░] 80%
	phaseText := fmt.Sprintf("PHASE [3/9] %s", p.currentPhase)
	tview.Print(screen, phaseText, x, y, len(phaseText), tview.AlignLeft, tcell.ColorWhite)
	
	// Draw inline progress bar
	barStart := x + len(phaseText) + 2
	barWidth := width - len(phaseText) - 10 // Leave space for percentage
	if barWidth > 40 {
		barWidth = 40 // Cap bar width
	}
	
	if barWidth > 10 {
		p.drawInlineProgressBar(screen, barStart, y, barWidth, p.progress)
		
		// Draw percentage at the end
		percentText := fmt.Sprintf(" %3d%%", p.progress)
		tview.Print(screen, percentText, barStart+barWidth+1, y, 5, tview.AlignLeft, tcell.ColorWhite)
	}
}

// drawInlineProgressBar draws an inline progress bar
func (p *PhasePanel) drawInlineProgressBar(screen tcell.Screen, x, y, width, progress int) {
	filled := (progress * width) / 100
	
	screen.SetContent(x, y, '[', nil, tcell.StyleDefault)
	for i := 0; i < width; i++ {
		if i < filled {
			screen.SetContent(x+1+i, y, '█', nil, tcell.StyleDefault.Foreground(tcell.ColorGreen))
		} else {
			screen.SetContent(x+1+i, y, '░', nil, tcell.StyleDefault.Foreground(tcell.ColorDarkGray))
		}
	}
	screen.SetContent(x+width+1, y, ']', nil, tcell.StyleDefault)
}

// drawProgressBar draws a progress bar
func (p *PhasePanel) drawProgressBar(screen tcell.Screen, x, y, width, progress int) {
	if width < 10 {
		return
	}
	
	// Calculate bar dimensions
	barWidth := width - 8 // Leave space for percentage
	filled := (progress * barWidth) / 100
	
	// Draw bar frame
	screen.SetContent(x, y, '[', nil, tcell.StyleDefault)
	
	// Draw filled and empty portions
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

// GetCurrentPhase returns the current phase name
func (p *PhasePanel) GetCurrentPhase() string {
	return p.currentPhase
}

// GetProgress returns the current progress
func (p *PhasePanel) GetProgress() int {
	return p.progress
}

// SetPhases sets predefined phases for display
func (p *PhasePanel) SetPhases(phases []string) {
	// Store phases for potential cycling through them
	p.currentPhase = phases[0]
}

// CompleteCurrentPhase marks the current phase as complete
func (p *PhasePanel) CompleteCurrentPhase() {
	p.progress = 100
	p.status = "Complete"
}

// CreatePhaseIndicator creates a compact phase indicator string
func (p *PhasePanel) CreatePhaseIndicator() string {
	// Create a visual indicator like: [■■■□□]
	blocks := 5
	filled := (p.progress * blocks) / 100
	
	indicator := "["
	for i := 0; i < blocks; i++ {
		if i < filled {
			indicator += "■"
		} else {
			indicator += "□"
		}
	}
	indicator += "]"
	
	return fmt.Sprintf("%s %s %d%%", p.currentPhase, indicator, p.progress)
}

// GetColorForProgress returns appropriate color for current progress
func (p *PhasePanel) GetColorForProgress() tcell.Color {
	switch {
	case p.progress < 25:
		return tcell.ColorRed
	case p.progress < 50:
		return tcell.ColorYellow
	case p.progress < 75:
		return tcell.ColorBlue
	case p.progress < 100:
		return tcell.ColorGreen
	default:
		return tcell.ColorGreen
	}
}

// AnimateProgress provides smooth progress animation
func (p *PhasePanel) AnimateProgress(target int, steps int) {
	if target < p.progress {
		return // Don't animate backwards
	}
	
	increment := (target - p.progress) / steps
	if increment < 1 {
		increment = 1
	}
	
	// This would be called in a goroutine with proper timing
	for p.progress < target {
		p.progress += increment
		if p.progress > target {
			p.progress = target
		}
	}
}

// GetStatusSymbol returns a symbol representing the current status
func (p *PhasePanel) GetStatusSymbol() string {
	switch strings.ToLower(p.status) {
	case "complete":
		return "✓"
	case "error":
		return "✗"
	case "running", "processing":
		return "⟳"
	case "waiting":
		return "⋯"
	default:
		return "•"
	}
}