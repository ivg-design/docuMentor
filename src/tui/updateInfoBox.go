package main

import (
	"fmt"
	"path/filepath"
	"strings"
)

func (t *TUI) updateInfoBox() {
	// Project name from path - show parent/name
	projectName := "No project"
	if t.projectPath != "" && t.projectPath != "." && t.projectPath != "No project loaded" {
		parent := filepath.Base(filepath.Dir(t.projectPath))
		name := filepath.Base(t.projectPath)
		if parent != "." && parent != "/" {
			projectName = fmt.Sprintf("%s/%s", parent, name)
		} else {
			projectName = name
		}
	}
	// Truncate if too long
	if len(projectName) > 24 {
		projectName = projectName[:21] + "..."
	}
	
	// Lock status
	lockStatus := "unlocked"
	lockColor := "green"
	if t.lockInfo.Status == "locked" {
		if t.lockInfo.Resuming {
			lockStatus = "resuming"
			lockColor = "yellow"
		} else {
			lockStatus = "locked"
			lockColor = "yellow"
		}
	} else if t.lockInfo.Status == "stale" {
		lockStatus = "stale"
		lockColor = "red"
	}
	
	// Phase info
	phaseInfo := fmt.Sprintf("%d/%d %s", t.phase.Current, t.phase.Total, t.phase.Name)
	if t.phase.Current == 0 && t.phase.Total == 0 && t.phase.Name == "" {
		phaseInfo = "idle"
	}
	// Truncate if too long
	if len(phaseInfo) > 24 {
		phaseInfo = phaseInfo[:21] + "..."
	}
	
	// Task info (using SubPhase)
	taskInfo := "idle"
	if t.phase.SubPhase != "" {
		taskInfo = t.phase.SubPhase
	}
	// Truncate if too long
	if len(taskInfo) > 27 {
		taskInfo = taskInfo[:24] + "..."
	}
	
	// Files counter
	filesInfo := fmt.Sprintf("%d/%d", t.files.Processed, t.files.Total)
	
	// Lockfile update time
	lockfileTime := "never"
	if !t.lockInfo.UpdatedAt.IsZero() {
		lockfileTime = t.lockInfo.UpdatedAt.Format("15:04:05")
	}
	
	// Build layout using a table-like structure with FIXED columns
	// We'll use padding to ensure consistent positioning
	
	var builder strings.Builder
	
	// Line 1: project | pid | files
	// Fixed layout: label(8) + value(24) + spacing(3) = 35 chars per column
	builder.WriteString("[yellow]project:[white] ")
	builder.WriteString(fmt.Sprintf("%-24s", projectName))
	builder.WriteString(" [yellow]pid:[white] ")
	builder.WriteString(fmt.Sprintf("%-8d", t.pid))
	builder.WriteString(" [yellow]files:[white] ")
	builder.WriteString(filesInfo)
	builder.WriteString("\n")
	
	// Line 2: phase | task
	builder.WriteString("[cyan]phase:[white]   ")
	builder.WriteString(fmt.Sprintf("%-24s", phaseInfo))
	builder.WriteString(" [cyan]task:[white] ")
	builder.WriteString(fmt.Sprintf("%-27s", taskInfo))
	builder.WriteString("\n")
	
	// Line 3: lockfile | status
	builder.WriteString("[magenta]lockfile:[white] ")
	builder.WriteString(fmt.Sprintf("%-23s", lockfileTime))
	builder.WriteString(" [")
	builder.WriteString(lockColor)
	builder.WriteString("]")
	builder.WriteString(fmt.Sprintf("%-12s", lockStatus))
	builder.WriteString("[white]")
	
	info := builder.String()
	
	// Add process stats in debug mode
	if t.viewMode == "debug" {
		info += fmt.Sprintf("\n\n[gray]═══ Process Stats ═══[white]\n"+
			"[cyan]Memory:[white] %-10s [cyan]Threads:[white] %-8d\n"+
			"[cyan]CPU:[white]    %-10s",
			fmt.Sprintf("%dMB", t.processStats.MemoryMB),
			t.processStats.Goroutines,
			fmt.Sprintf("%.1f%%", t.processStats.CPUPercent),
		)
	}
	
	t.infoBox.SetText(info)
}