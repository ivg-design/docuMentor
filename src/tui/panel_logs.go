package main

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// LogsPanel displays rolling logs
type LogsPanel struct {
	*tview.TextView
	
	entries    []LogEntry
	maxEntries int
	mutex      sync.Mutex
	autoScroll bool
}

// NewLogsPanel creates a new logs panel
func NewLogsPanel() *LogsPanel {
	panel := &LogsPanel{
		TextView: tview.NewTextView().
			SetDynamicColors(true).
			SetScrollable(true).
			SetChangedFunc(func() {}),
		entries:    make([]LogEntry, 0),
		maxEntries: 100,
		autoScroll: true,
	}
	
	panel.SetBorder(true).
		SetTitle(" Logs ").
		SetTitleAlign(tview.AlignLeft)
	
	return panel
}

// AddLog adds a new log entry
func (l *LogsPanel) AddLog(level, message string, workerID int) {
	l.mutex.Lock()
	defer l.mutex.Unlock()
	
	entry := LogEntry{
		Timestamp: time.Now(),
		Level:     level,
		Message:   message,
		Worker:    workerID,
	}
	
	l.entries = append(l.entries, entry)
	
	// Trim old entries
	if len(l.entries) > l.maxEntries {
		l.entries = l.entries[len(l.entries)-l.maxEntries:]
	}
	
	l.updateDisplay()
}

// updateDisplay refreshes the log display
func (l *LogsPanel) updateDisplay() {
	var builder strings.Builder
	
	for _, entry := range l.entries {
		color := l.getColorForLevel(entry.Level)
		timestamp := entry.Timestamp.Format("15:04:05")
		
		workerStr := ""
		if entry.Worker > 0 {
			workerStr = fmt.Sprintf("[W%d] ", entry.Worker)
		}
		
		line := fmt.Sprintf("[gray]%s[white] [%s]%s[white] %s%s\n",
			timestamp, color, strings.ToUpper(entry.Level), workerStr, entry.Message)
		
		builder.WriteString(line)
	}
	
	l.SetText(builder.String())
	
	if l.autoScroll {
		l.ScrollToEnd()
	}
}

// getColorForLevel returns the appropriate color for a log level
func (l *LogsPanel) getColorForLevel(level string) string {
	switch strings.ToLower(level) {
	case "error":
		return "red"
	case "warning", "warn":
		return "yellow"
	case "info":
		return "cyan"
	case "debug":
		return "gray"
	case "success":
		return "green"
	default:
		return "white"
	}
}

// Clear clears all logs
func (l *LogsPanel) Clear() {
	l.mutex.Lock()
	defer l.mutex.Unlock()
	
	l.entries = make([]LogEntry, 0)
	l.SetText("")
}

// SetAutoScroll enables/disables auto-scrolling
func (l *LogsPanel) SetAutoScroll(enabled bool) {
	l.autoScroll = enabled
}

// GetLogCount returns the number of log entries
func (l *LogsPanel) GetLogCount() int {
	l.mutex.Lock()
	defer l.mutex.Unlock()
	return len(l.entries)
}

// GetErrorCount returns the number of error entries
func (l *LogsPanel) GetErrorCount() int {
	l.mutex.Lock()
	defer l.mutex.Unlock()
	
	count := 0
	for _, entry := range l.entries {
		if strings.ToLower(entry.Level) == "error" {
			count++
		}
	}
	return count
}

// FilterByWorker returns logs for a specific worker
func (l *LogsPanel) FilterByWorker(workerID int) []LogEntry {
	l.mutex.Lock()
	defer l.mutex.Unlock()
	
	filtered := make([]LogEntry, 0)
	for _, entry := range l.entries {
		if entry.Worker == workerID {
			filtered = append(filtered, entry)
		}
	}
	return filtered
}

// FilterByLevel returns logs of a specific level
func (l *LogsPanel) FilterByLevel(level string) []LogEntry {
	l.mutex.Lock()
	defer l.mutex.Unlock()
	
	filtered := make([]LogEntry, 0)
	for _, entry := range l.entries {
		if strings.EqualFold(entry.Level, level) {
			filtered = append(filtered, entry)
		}
	}
	return filtered
}

// GetRecentLogs returns the most recent n logs
func (l *LogsPanel) GetRecentLogs(n int) []LogEntry {
	l.mutex.Lock()
	defer l.mutex.Unlock()
	
	if n > len(l.entries) {
		n = len(l.entries)
	}
	
	return l.entries[len(l.entries)-n:]
}

// InputCapture handles keyboard input for the logs panel
func (l *LogsPanel) InputCapture(event *tcell.EventKey) *tcell.EventKey {
	switch event.Key() {
	case tcell.KeyPgUp:
		l.autoScroll = false
		// Scroll functionality is handled by TextView internally
		return nil
	case tcell.KeyPgDn:
		// Scroll functionality is handled by TextView internally
		return nil
	case tcell.KeyEnd:
		l.autoScroll = true
		l.ScrollToEnd()
		return nil
	case tcell.KeyHome:
		l.autoScroll = false
		l.ScrollToBeginning()
		return nil
	}
	return event
}

// SetMaxEntries sets the maximum number of log entries to keep
func (l *LogsPanel) SetMaxEntries(max int) {
	l.mutex.Lock()
	defer l.mutex.Unlock()
	
	l.maxEntries = max
	if len(l.entries) > max {
		l.entries = l.entries[len(l.entries)-max:]
		l.updateDisplay()
	}
}