package main

import (
	"fmt"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// PerformancePanel displays system performance metrics
type PerformancePanel struct {
	*tview.Box
	
	metrics PerformanceMetrics
}

// NewPerformancePanel creates a new performance panel
func NewPerformancePanel() *PerformancePanel {
	panel := &PerformancePanel{
		Box:     tview.NewBox(),
		metrics: PerformanceMetrics{},
	}
	
	panel.SetBorder(true).
		SetBorderPadding(0, 0, 1, 1)
	
	return panel
}

// UpdateMetrics updates the performance metrics
func (p *PerformancePanel) UpdateMetrics(metrics PerformanceMetrics) {
	p.metrics = metrics
}

// Draw renders the performance panel
func (p *PerformancePanel) Draw(screen tcell.Screen) {
	p.Box.DrawForSubclass(screen, p)
	x, y, width, height := p.GetInnerRect()
	
	if height < 1 || width < 60 {
		return // Not enough space
	}
	
	// Divide width into 4 sections for CPU, MEM, DISK, NET
	sectionWidth := width / 4
	
	// CPU section
	cpuStart := x
	tview.Print(screen, "CPU: ", cpuStart, y, 5, tview.AlignLeft, tcell.ColorWhite)
	p.drawInlineBar(screen, cpuStart+5, y, 10, p.metrics.CPU, tcell.ColorGreen)
	cpuPercent := fmt.Sprintf(" %3.0f%%", p.metrics.CPU)
	tview.Print(screen, cpuPercent, cpuStart+15, y, 5, tview.AlignLeft, tcell.ColorWhite)
	
	// Memory section
	memStart := x + sectionWidth
	tview.Print(screen, "MEM: ", memStart, y, 5, tview.AlignLeft, tcell.ColorWhite)
	p.drawInlineBar(screen, memStart+5, y, 10, p.metrics.Memory, tcell.ColorBlue)
	memInfo := fmt.Sprintf(" %3.0f%%", p.metrics.Memory)
	tview.Print(screen, memInfo, memStart+15, y, 5, tview.AlignLeft, tcell.ColorWhite)
	
	// Disk section
	diskStart := x + (sectionWidth * 2)
	diskText := fmt.Sprintf("DISK: %.0fMB/s", p.metrics.Disk)
	tview.Print(screen, diskText, diskStart, y, sectionWidth-2, tview.AlignLeft, tcell.ColorYellow)
	
	// Network section
	netStart := x + (sectionWidth * 3)
	netText := fmt.Sprintf("NET: ↓%.0fKB/s ↑%.0fKB/s", p.metrics.Network, p.metrics.Network/2)
	tview.Print(screen, netText, netStart, y, sectionWidth, tview.AlignLeft, tcell.ColorAqua)
}

// drawInlineBar draws a small inline progress bar and returns its width
func (p *PerformancePanel) drawInlineBar(screen tcell.Screen, x, y, width int, value float64, color tcell.Color) int {
	filled := int((value / 100.0) * float64(width))
	
	for i := 0; i < width; i++ {
		if i < filled {
			screen.SetContent(x+i, y, '█', nil, tcell.StyleDefault.Foreground(color))
		} else {
			screen.SetContent(x+i, y, '░', nil, tcell.StyleDefault.Foreground(tcell.ColorDarkGray))
		}
	}
	
	return width
}

// drawMetric draws a single metric with bar
func (p *PerformancePanel) drawMetric(screen tcell.Screen, x, y, width int, label string, value float64, color tcell.Color) {
	if width < 15 {
		return
	}
	
	// Draw label (3 chars)
	tview.Print(screen, label, x, y, 3, tview.AlignLeft, tcell.ColorWhite)
	
	// Draw percentage (5 chars)
	percentText := fmt.Sprintf("%3.0f%%", value)
	tview.Print(screen, percentText, x+4, y, 5, tview.AlignLeft, tcell.ColorWhite)
	
	// Draw bar
	barStart := x + 10
	barWidth := width - 10
	if barWidth > 20 {
		barWidth = 20 // Cap bar width
	}
	
	filled := int((value / 100.0) * float64(barWidth))
	
	for i := 0; i < barWidth; i++ {
		if i < filled {
			screen.SetContent(barStart+i, y, '▓', nil, tcell.StyleDefault.Foreground(color))
		} else {
			screen.SetContent(barStart+i, y, '░', nil, tcell.StyleDefault.Foreground(tcell.ColorDarkGray))
		}
	}
}

// GetMetrics returns current metrics
func (p *PerformancePanel) GetMetrics() PerformanceMetrics {
	return p.metrics
}

// GetHighestUsage returns the highest resource usage
func (p *PerformancePanel) GetHighestUsage() (string, float64) {
	highest := p.metrics.CPU
	name := "CPU"
	
	if p.metrics.Memory > highest {
		highest = p.metrics.Memory
		name = "Memory"
	}
	if p.metrics.Disk > highest {
		highest = p.metrics.Disk
		name = "Disk"
	}
	if p.metrics.Network > highest {
		highest = p.metrics.Network
		name = "Network"
	}
	
	return name, highest
}

// IsResourceCritical checks if any resource is above threshold
func (p *PerformancePanel) IsResourceCritical(threshold float64) bool {
	return p.metrics.CPU > threshold ||
		p.metrics.Memory > threshold ||
		p.metrics.Disk > threshold ||
		p.metrics.Network > threshold
}

// GetHealthStatus returns overall health status
func (p *PerformancePanel) GetHealthStatus() string {
	maxUsage := p.metrics.CPU
	if p.metrics.Memory > maxUsage {
		maxUsage = p.metrics.Memory
	}
	if p.metrics.Disk > maxUsage {
		maxUsage = p.metrics.Disk
	}
	
	switch {
	case maxUsage > 90:
		return "Critical"
	case maxUsage > 75:
		return "Warning"
	case maxUsage > 50:
		return "Normal"
	default:
		return "Excellent"
	}
}

// GetHealthColor returns color based on health
func (p *PerformancePanel) GetHealthColor() tcell.Color {
	status := p.GetHealthStatus()
	switch status {
	case "Critical":
		return tcell.ColorRed
	case "Warning":
		return tcell.ColorYellow
	case "Normal":
		return tcell.ColorGreen
	default:
		return tcell.ColorGreen
	}
}

// Reset resets all metrics to zero
func (p *PerformancePanel) Reset() {
	p.metrics = PerformanceMetrics{}
}