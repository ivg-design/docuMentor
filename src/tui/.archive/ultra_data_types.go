package main

import (
	"encoding/json"
	"time"
)

// ============================================================================
// COMPLETE DATA TYPE DEFINITIONS FOR ULTRA TUI
// Must match TUI_MESSAGE_PROTOCOL.md exactly
// ============================================================================

// MessageType enum matching protocol
type MessageType string

const (
	// System Messages
	MessageTypeInit     MessageType = "init"
	MessageTypeReady    MessageType = "ready"
	MessageTypeShutdown MessageType = "shutdown"
	MessageTypeError    MessageType = "error"
	
	// Progress Messages
	MessageTypePhase MessageType = "phase"
	MessageTypeFile  MessageType = "file"
	
	// Worker Messages
	MessageTypeWorker      MessageType = "worker"
	MessageTypeWorkerBatch MessageType = "worker_batch"
	
	// Performance Messages
	MessageTypeMetrics MessageType = "metrics"
	
	// Logging
	MessageTypeLog   MessageType = "log"
	MessageTypeDebug MessageType = "debug"
	
	// Control Messages
	MessageTypeCommand  MessageType = "command"
	MessageTypeResponse MessageType = "response"
	
	// Batch Message
	MessageTypeBatch MessageType = "batch"
)

// ============================================================================
// BASE MESSAGE STRUCTURE (Protocol Section 1)
// ============================================================================

type TUIMessage struct {
	Type      MessageType `json:"type"`
	Timestamp string      `json:"timestamp"`      // ISO 8601
	Sequence  int         `json:"sequence,omitempty"` // For ordering
	Data      interface{} `json:"data"`
}

// ============================================================================
// WORKER MESSAGES (Protocol Section 2)
// ============================================================================

type WorkerState string

const (
	WorkerStateIdle     WorkerState = "idle"
	WorkerStateBusy     WorkerState = "busy"
	WorkerStateBlocked  WorkerState = "blocked"  // Waiting for Claude
	WorkerStateError    WorkerState = "error"
	WorkerStateComplete WorkerState = "complete"
)

type WorkerStats struct {
	Completed int `json:"completed"`
	Failed    int `json:"failed"`
	AvgTime   int `json:"avgTime"`   // ms
	TotalTime int `json:"totalTime"` // ms
}

type WorkerMessageData struct {
	WorkerID    int         `json:"workerId"`              // 1-4
	State       WorkerState `json:"state"`
	File        string      `json:"file,omitempty"`
	Operation   string      `json:"operation,omitempty"`
	Progress    int         `json:"progress,omitempty"`    // 0-100
	TimeElapsed int         `json:"timeElapsed,omitempty"` // ms
	Error       string      `json:"error,omitempty"`
	Stats       WorkerStats `json:"stats,omitempty"`
}

type WorkerMessage struct {
	Type      MessageType       `json:"type"`
	Timestamp string            `json:"timestamp"`
	Sequence  int               `json:"sequence,omitempty"`
	Data      WorkerMessageData `json:"data"`
}

type WorkerBatchData struct {
	Workers []WorkerMessageData `json:"workers"`
}

type WorkerBatchMessage struct {
	Type      MessageType     `json:"type"`
	Timestamp string          `json:"timestamp"`
	Sequence  int             `json:"sequence,omitempty"`
	Data      WorkerBatchData `json:"data"`
}

// ============================================================================
// PERFORMANCE METRICS (Protocol Section 3)
// ============================================================================

type MemoryMetrics struct {
	Used       int64   `json:"used"`       // bytes
	Total      int64   `json:"total"`      // bytes
	Percentage float64 `json:"percentage"`
}

type DiskMetrics struct {
	Read  int64 `json:"read"`  // bytes/sec
	Write int64 `json:"write"` // bytes/sec
}

type NetworkMetrics struct {
	Up   int64 `json:"up"`   // bytes/sec
	Down int64 `json:"down"` // bytes/sec
}

type ClaudeMetrics struct {
	Calls     int     `json:"calls"`
	MaxCalls  int     `json:"maxCalls"`
	Tokens    int     `json:"tokens"`
	MaxTokens int     `json:"maxTokens"`
	Cost      float64 `json:"cost"`      // USD
	Remaining int     `json:"remaining"` // calls remaining
}

type QueueMetrics struct {
	Pending    int `json:"pending"`
	Processing int `json:"processing"`
	Completed  int `json:"completed"`
	Failed     int `json:"failed"`
}

type MetricsData struct {
	CPU     float64        `json:"cpu"` // 0-100
	Memory  MemoryMetrics  `json:"memory"`
	Disk    DiskMetrics    `json:"disk"`
	Network NetworkMetrics `json:"network"`
	Claude  ClaudeMetrics  `json:"claude"`
	Queue   QueueMetrics   `json:"queue"`
}

type MetricsMessage struct {
	Type      MessageType `json:"type"`
	Timestamp string      `json:"timestamp"`
	Sequence  int         `json:"sequence,omitempty"`
	Data      MetricsData `json:"data"`
}

// ============================================================================
// PHASE MESSAGES (Protocol Section 4)
// ============================================================================

type PhaseData struct {
	Current    int    `json:"current"`             // 1-9 for display
	Total      int    `json:"total"`               // Always 9 for user expectation
	Name       string `json:"name"`
	SubPhase   string `json:"subPhase,omitempty"`
	Percentage int    `json:"percentage,omitempty"` // 0-100
	ETA        int    `json:"eta,omitempty"`        // seconds
}

type PhaseMessage struct {
	Type      MessageType `json:"type"`
	Timestamp string      `json:"timestamp"`
	Sequence  int         `json:"sequence,omitempty"`
	Data      PhaseData   `json:"data"`
}

// ============================================================================
// FILE MESSAGES (Protocol Section 5)
// ============================================================================

type FileData struct {
	Processed int     `json:"processed"`
	Total     int     `json:"total"`
	Current   string  `json:"current,omitempty"`
	Queue     int     `json:"queue,omitempty"`   // Files in queue
	Rate      float64 `json:"rate,omitempty"`    // Files per second
	Success   int     `json:"success,omitempty"`
	Failed    int     `json:"failed,omitempty"`
	Skipped   int     `json:"skipped,omitempty"`
}

type FileMessage struct {
	Type      MessageType `json:"type"`
	Timestamp string      `json:"timestamp"`
	Sequence  int         `json:"sequence,omitempty"`
	Data      FileData    `json:"data"`
}

// ============================================================================
// BATCH MESSAGES (Protocol Section 6)
// ============================================================================

type BatchData struct {
	Messages []json.RawMessage `json:"messages"`
}

type BatchMessage struct {
	Type      MessageType `json:"type"`
	Timestamp string      `json:"timestamp"`
	Sequence  int         `json:"sequence,omitempty"`
	Data      BatchData   `json:"data"`
}

// ============================================================================
// CONTROL MESSAGES (Protocol Section 7)
// ============================================================================

type CommandType string

const (
	CommandPause  CommandType = "pause"
	CommandResume CommandType = "resume"
	CommandAbort  CommandType = "abort"
	CommandSkip   CommandType = "skip"
	CommandRetry  CommandType = "retry"
)

type CommandData struct {
	Command CommandType `json:"command"`
	Target  int         `json:"target,omitempty"` // Worker ID if applicable
	Args    interface{} `json:"args,omitempty"`
}

type CommandMessage struct {
	Type      MessageType `json:"type"`
	Timestamp string      `json:"timestamp"`
	Sequence  int         `json:"sequence,omitempty"`
	Data      CommandData `json:"data"`
}

type ResponseData struct {
	Command string      `json:"command"`
	Success bool        `json:"success"`
	Result  interface{} `json:"result,omitempty"`
	Error   string      `json:"error,omitempty"`
}

type ResponseMessage struct {
	Type      MessageType  `json:"type"`
	Timestamp string       `json:"timestamp"`
	Sequence  int          `json:"sequence,omitempty"`
	Data      ResponseData `json:"data"`
}

// ============================================================================
// LOG MESSAGES
// ============================================================================

type LogLevel string

const (
	LogLevelInfo    LogLevel = "info"
	LogLevelWarning LogLevel = "warning"
	LogLevelError   LogLevel = "error"
	LogLevelSuccess LogLevel = "success"
	LogLevelDebug   LogLevel = "debug"
)

type LogData struct {
	Level   LogLevel `json:"level"`
	Content string   `json:"content"`
	Source  string   `json:"source,omitempty"` // e.g., "WORK1", "WORK2"
}

type LogMessage struct {
	Type      MessageType `json:"type"`
	Timestamp string      `json:"timestamp"`
	Sequence  int         `json:"sequence,omitempty"`
	Data      LogData     `json:"data"`
}

// ============================================================================
// SYSTEM MESSAGES
// ============================================================================

type InitData struct {
	ProjectPath string `json:"projectPath"`
	OutputPath  string `json:"outputPath"`
	Config      map[string]interface{} `json:"config,omitempty"`
}

type InitMessage struct {
	Type      MessageType `json:"type"`
	Timestamp string      `json:"timestamp"`
	Sequence  int         `json:"sequence,omitempty"`
	Data      InitData    `json:"data"`
}

type ErrorData struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
	Fatal   bool   `json:"fatal,omitempty"`
}

type ErrorMessage struct {
	Type      MessageType `json:"type"`
	Timestamp string      `json:"timestamp"`
	Sequence  int         `json:"sequence,omitempty"`
	Data      ErrorData   `json:"data"`
}

// ============================================================================
// ULTRA TUI STATE MANAGER
// ============================================================================

type UltraState struct {
	// Connection & System
	Connected    bool
	ProjectPath  string
	OutputPath   string
	PID          int
	StartTime    time.Time
	LockStatus   bool
	
	// Phase Information
	Phase        PhaseData
	
	// File Statistics
	Files        FileData
	DocsComplete int
	
	// Worker States (exactly 4)
	Workers      [4]WorkerMessageData
	
	// Performance Metrics
	Metrics      MetricsData
	
	// Current Status
	CurrentFile  string
	StatusText   string
	
	// Logs (circular buffer)
	Logs         []LogData
	MaxLogs      int
}

// NewUltraState creates a properly initialized state
func NewUltraState() *UltraState {
	state := &UltraState{
		Connected:  false,
		StartTime:  time.Now(),
		MaxLogs:    1000,
		Logs:       make([]LogData, 0, 1000),
	}
	
	// Initialize workers
	for i := 0; i < 4; i++ {
		state.Workers[i] = WorkerMessageData{
			WorkerID: i + 1,
			State:    WorkerStateIdle,
			Stats:    WorkerStats{},
		}
	}
	
	// Initialize phase
	state.Phase = PhaseData{
		Current: 1,
		Total:   9,
		Name:    "Initialization",
	}
	
	// Initialize metrics
	state.Metrics = MetricsData{
		Memory: MemoryMetrics{},
		Disk:   DiskMetrics{},
		Network: NetworkMetrics{},
		Claude: ClaudeMetrics{},
		Queue:  QueueMetrics{},
	}
	
	return state
}

// UpdateFromMessage updates state from any message type
func (s *UltraState) UpdateFromMessage(msg json.RawMessage) error {
	var base TUIMessage
	if err := json.Unmarshal(msg, &base); err != nil {
		return err
	}
	
	switch base.Type {
	case MessageTypeInit:
		var m InitMessage
		if err := json.Unmarshal(msg, &m); err != nil {
			return err
		}
		s.ProjectPath = m.Data.ProjectPath
		s.OutputPath = m.Data.OutputPath
		s.Connected = true
		
	case MessageTypePhase:
		var m PhaseMessage
		if err := json.Unmarshal(msg, &m); err != nil {
			return err
		}
		s.Phase = m.Data
		
	case MessageTypeFile:
		var m FileMessage
		if err := json.Unmarshal(msg, &m); err != nil {
			return err
		}
		s.Files = m.Data
		
	case MessageTypeWorker:
		var m WorkerMessage
		if err := json.Unmarshal(msg, &m); err != nil {
			return err
		}
		if m.Data.WorkerID >= 1 && m.Data.WorkerID <= 4 {
			s.Workers[m.Data.WorkerID-1] = m.Data
		}
		
	case MessageTypeWorkerBatch:
		var m WorkerBatchMessage
		if err := json.Unmarshal(msg, &m); err != nil {
			return err
		}
		for _, w := range m.Data.Workers {
			if w.WorkerID >= 1 && w.WorkerID <= 4 {
				s.Workers[w.WorkerID-1] = w
			}
		}
		
	case MessageTypeMetrics:
		var m MetricsMessage
		if err := json.Unmarshal(msg, &m); err != nil {
			return err
		}
		s.Metrics = m.Data
		
	case MessageTypeLog:
		var m LogMessage
		if err := json.Unmarshal(msg, &m); err != nil {
			return err
		}
		s.AddLog(m.Data)
		
	case MessageTypeBatch:
		var m BatchMessage
		if err := json.Unmarshal(msg, &m); err != nil {
			return err
		}
		// Process each message in batch
		for _, msg := range m.Data.Messages {
			s.UpdateFromMessage(msg)
		}
		
	case MessageTypeError:
		var m ErrorMessage
		if err := json.Unmarshal(msg, &m); err != nil {
			return err
		}
		// Add error to logs
		s.AddLog(LogData{
			Level:   LogLevelError,
			Content: m.Data.Message,
		})
		if m.Data.Fatal {
			s.Connected = false
		}
	}
	
	return nil
}

// AddLog adds a log entry with circular buffer management
func (s *UltraState) AddLog(log LogData) {
	s.Logs = append(s.Logs, log)
	if len(s.Logs) > s.MaxLogs {
		// Remove oldest logs
		s.Logs = s.Logs[len(s.Logs)-s.MaxLogs:]
	}
}

// GetWorkerByID returns worker data by ID (1-4)
func (s *UltraState) GetWorkerByID(id int) *WorkerMessageData {
	if id >= 1 && id <= 4 {
		return &s.Workers[id-1]
	}
	return nil
}

// CalculatePhasePercentage calculates overall phase percentage
func (s *UltraState) CalculatePhasePercentage() int {
	if s.Phase.Percentage > 0 {
		return s.Phase.Percentage
	}
	// Calculate based on phase number
	return (s.Phase.Current * 100) / s.Phase.Total
}

// CalculateETA estimates time to completion
func (s *UltraState) CalculateETA() time.Duration {
	if s.Phase.ETA > 0 {
		return time.Duration(s.Phase.ETA) * time.Second
	}
	
	// Estimate based on current rate
	if s.Files.Rate > 0 && s.Files.Queue > 0 {
		seconds := float64(s.Files.Queue) / s.Files.Rate
		return time.Duration(seconds) * time.Second
	}
	
	return 0
}

// GetMemoryPercentage returns memory usage as percentage
func (s *UltraState) GetMemoryPercentage() int {
	if s.Metrics.Memory.Total > 0 {
		return int((s.Metrics.Memory.Used * 100) / s.Metrics.Memory.Total)
	}
	return 0
}

// GetActiveWorkerCount returns number of busy workers
func (s *UltraState) GetActiveWorkerCount() int {
	count := 0
	for _, w := range s.Workers {
		if w.State == WorkerStateBusy || w.State == WorkerStateBlocked {
			count++
		}
	}
	return count
}

// GetTotalCompleted returns total files completed across all workers
func (s *UltraState) GetTotalCompleted() int {
	total := 0
	for _, w := range s.Workers {
		total += w.Stats.Completed
	}
	return total
}

// GetTotalFailed returns total files failed across all workers
func (s *UltraState) GetTotalFailed() int {
	total := 0
	for _, w := range s.Workers {
		total += w.Stats.Failed
	}
	return total
}