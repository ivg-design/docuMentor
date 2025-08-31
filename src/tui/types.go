package main

import "time"

// WorkerState represents the current state of a worker
type WorkerState string

const (
	WorkerStateIdle     WorkerState = "idle"
	WorkerStateBusy     WorkerState = "busy"
	WorkerStateBlocked  WorkerState = "blocked"
	WorkerStateError    WorkerState = "error"
	WorkerStateComplete WorkerState = "complete"
)

// WorkerData represents the data for a single worker
type WorkerData struct {
	ID          int
	State       WorkerState
	File        string
	Operation   string
	Progress    int
	TimeElapsed time.Duration
	Stats       WorkerStats
}

// WorkerStats tracks worker statistics
type WorkerStats struct {
	Completed int
	Failed    int
	Processing int
}

// PhaseData represents current phase information
type PhaseData struct {
	Current  string
	Progress int
	Status   string
}

// FileStats represents file processing statistics
type FileStats struct {
	Total     int
	Processed int
	Queue     int
	Rate      float64
	Errors    int
}

// PerformanceMetrics represents system performance data
type PerformanceMetrics struct {
	CPU       float64
	Memory    float64
	Disk      float64
	Network   float64
	Throughput float64
}

// ProjectInfo represents project information
type ProjectInfo struct {
	Name       string
	Type       string
	Framework  string
	Path       string
	Connection string
	PID        int
	Output     string
	Lock       string
}

// LogEntry represents a single log entry
type LogEntry struct {
	Timestamp time.Time
	Level     string
	Message   string
	Worker    int
}

// StatusInfo represents overall status information
type StatusInfo struct {
	State    string
	Message  string
	Details  string
	Progress int
}