package main

import (
	"fmt"
	"time"
)

// Message represents a message from the Node.js process
type Message struct {
	Type      string                 `json:"type"`
	Timestamp string                 `json:"timestamp,omitempty"`
	Sequence  int                    `json:"sequence,omitempty"`
	Panel     string                 `json:"panel,omitempty"`
	Method    string                 `json:"method,omitempty"`
	Data      map[string]interface{} `json:"data"`
	Updates   []Message              `json:"updates,omitempty"` // For batch messages
}

// MessageHandler handles messages from the Node.js process
type MessageHandler struct {
	tui              *TUI
	lastMetricsTime  time.Time
	messageCount     int
	errorCount       int
}

// NewMessageHandler creates a new message handler
func NewMessageHandler(tui *TUI) *MessageHandler {
	return &MessageHandler{
		tui:             tui,
		lastMetricsTime: time.Now(),
	}
}

// HandleMessage processes a message from Node.js
func (h *MessageHandler) HandleMessage(msg Message) {
	h.messageCount++

	switch msg.Type {
	case "init":
		h.handleInit(msg)
	case "ready":
		h.handleReady(msg)
	case "shutdown":
		h.handleShutdown(msg)
	case "update":
		h.handleUpdate(msg)
	case "batch":
		h.handleBatch(msg)
	case "phase":
		h.handlePhase(msg)
	case "file":
		h.handleFile(msg)
	case "worker":
		h.handleWorker(msg)
	case "worker_batch":
		h.handleWorkerBatch(msg)
	case "metrics":
		h.handleMetrics(msg)
	case "log":
		h.handleLog(msg)
	case "error":
		h.handleError(msg)
	case "response":
		h.handleResponse(msg)
	default:
		h.tui.AddLog("warn", fmt.Sprintf("Unknown message type: %s", msg.Type), 0)
	}
}

// handleInit processes initialization messages
func (h *MessageHandler) handleInit(msg Message) {
	project := getStringValue(msg.Data, "project")
	output := getStringValue(msg.Data, "output")
	pid := getIntValue(msg.Data, "pid")
	totalFiles := getIntValue(msg.Data, "totalFiles")
	
	h.tui.headerPanel.UpdateProject(ProjectInfo{
		Name:       project,
		Output:     output,
		PID:        pid,
		Connection: "Node.js",
		Lock:       "Active",
	})
	
	h.tui.statsPanel.UpdateStats(FileStats{
		Total: totalFiles,
	})
	
	h.tui.AddLog("info", fmt.Sprintf("Initialized: %s → %s", project, output), 0)
}

// handleReady processes ready messages
func (h *MessageHandler) handleReady(msg Message) {
	h.tui.statusPanel.SetRunning("Ready to process")
	h.tui.AddLog("info", "Node.js process ready", 0)
}

// handleShutdown processes shutdown messages
func (h *MessageHandler) handleShutdown(msg Message) {
	h.tui.statusPanel.SetMessage("Node.js process shutting down")
	h.tui.AddLog("info", "Node.js process shutting down", 0)
}

// handleUpdate processes panel update messages
func (h *MessageHandler) handleUpdate(msg Message) {
	switch msg.Panel {
	case "header":
		h.updateHeader(msg)
	case "infobar":
		h.updateInfoBar(msg)
	case "workers":
		h.updateWorkers(msg)
	case "performance":
		h.updatePerformance(msg)
	case "status":
		h.updateStatus(msg)
	case "logs":
		h.updateLogs(msg)
	default:
		h.tui.AddLog("warn", fmt.Sprintf("Unknown panel: %s", msg.Panel), 0)
	}
}

// handleBatch processes batch messages
func (h *MessageHandler) handleBatch(msg Message) {
	for _, update := range msg.Updates {
		h.HandleMessage(update)
	}
}

// handlePhase processes phase messages
func (h *MessageHandler) handlePhase(msg Message) {
	current := getIntValue(msg.Data, "current")
	total := getIntValue(msg.Data, "total")
	name := getStringValue(msg.Data, "name")
	progress := getFloatValue(msg.Data, "progress")
	
	h.tui.UpdatePhase(PhaseData{
		Current:  fmt.Sprintf("%d/%d - %s", current, total, name),
		Progress: int(progress),
		Status:   "active",
	})
}

// handleFile processes file messages
func (h *MessageHandler) handleFile(msg Message) {
	processed := getIntValue(msg.Data, "processed")
	total := getIntValue(msg.Data, "total")
	current := getStringValue(msg.Data, "current")
	queue := getIntValue(msg.Data, "queue")
	errors := getIntValue(msg.Data, "errors")
	
	h.tui.UpdateStats(FileStats{
		Processed: processed,
		Total:     total,
		Queue:     queue,
		Errors:    errors,
	})
	
	if current != "" {
		h.tui.statusPanel.SetMessage(fmt.Sprintf("Processing: %s (%d/%d)", current, processed, total))
	}
}

// handleWorker processes single worker messages
func (h *MessageHandler) handleWorker(msg Message) {
	id := getIntValue(msg.Data, "workerId")
	state := getStringValue(msg.Data, "state")
	file := getStringValue(msg.Data, "file")
	operation := getStringValue(msg.Data, "operation")
	progress := getIntValue(msg.Data, "progress")
	
	h.tui.UpdateWorker(id, WorkerData{
		ID:        id,
		State:     WorkerState(state),
		File:      file,
		Operation: operation,
		Progress:  progress,
	})
}

// handleWorkerBatch processes batch worker messages
func (h *MessageHandler) handleWorkerBatch(msg Message) {
	workers, ok := msg.Data["workers"].([]interface{})
	if !ok {
		return
	}
	
	for _, workerData := range workers {
		if worker, ok := workerData.(map[string]interface{}); ok {
			id := getIntValue(worker, "workerId")
			state := getStringValue(worker, "state")
			file := getStringValue(worker, "file")
			operation := getStringValue(worker, "operation")
			progress := getIntValue(worker, "progress")
			
			h.tui.UpdateWorker(id, WorkerData{
				ID:        id,
				State:     WorkerState(state),
				File:      file,
				Operation: operation,
				Progress:  progress,
			})
		}
	}
}

// handleMetrics processes performance metrics messages
func (h *MessageHandler) handleMetrics(msg Message) {
	cpu := getFloatValue(msg.Data, "cpu")
	memory := getFloatValue(msg.Data, "memory")
	memoryUsed := getIntValue(msg.Data, "memoryUsed")
	memoryTotal := getIntValue(msg.Data, "memoryTotal")
	disk := getFloatValue(msg.Data, "disk")
	
	h.tui.UpdatePerformance(PerformanceMetrics{
		CPU:         int(cpu),
		Memory:      int(memory),
		MemoryUsed:  memoryUsed,
		MemoryTotal: memoryTotal,
		DiskIO:      int(disk),
	})
	
	h.lastMetricsTime = time.Now()
}

// handleLog processes log messages
func (h *MessageHandler) handleLog(msg Message) {
	level := getStringValue(msg.Data, "level")
	message := getStringValue(msg.Data, "message")
	workerID := getIntValue(msg.Data, "workerID")
	
	// Convert level to lowercase
	switch level {
	case "INFO":
		level = "info"
	case "WARN":
		level = "warn"
	case "ERROR":
		level = "error"
	case "DEBUG":
		level = "debug"
	default:
		level = "info"
	}
	
	h.tui.AddLog(level, message, workerID)
}

// handleError processes error messages
func (h *MessageHandler) handleError(msg Message) {
	h.errorCount++
	message := getStringValue(msg.Data, "message")
	details := getStringValue(msg.Data, "details")
	
	fullMessage := message
	if details != "" {
		fullMessage = fmt.Sprintf("%s: %s", message, details)
	}
	
	h.tui.AddLog("error", fullMessage, 0)
	h.tui.statusPanel.SetError(message)
}

// handleResponse processes response messages
func (h *MessageHandler) handleResponse(msg Message) {
	command := getStringValue(msg.Data, "command")
	success := getBoolValue(msg.Data, "success")
	result := getStringValue(msg.Data, "result")
	
	if success {
		h.tui.AddLog("info", fmt.Sprintf("Command '%s' succeeded: %s", command, result), 0)
	} else {
		error := getStringValue(msg.Data, "error")
		h.tui.AddLog("error", fmt.Sprintf("Command '%s' failed: %s", command, error), 0)
	}
}

// Panel update helpers

func (h *MessageHandler) updateHeader(msg Message) {
	// Header updates are handled in handleInit
}

func (h *MessageHandler) updateInfoBar(msg Message) {
	switch msg.Method {
	case "UpdatePhase":
		current := getIntValue(msg.Data, "current")
		total := getIntValue(msg.Data, "total")
		name := getStringValue(msg.Data, "name")
		h.tui.phasePanel.UpdatePhase(PhaseData{
			Current:  fmt.Sprintf("%d/%d - %s", current, total, name),
			Progress: 0,
			Status:   "active",
		})
	case "UpdateFiles":
		processed := getIntValue(msg.Data, "processed")
		total := getIntValue(msg.Data, "total")
		h.tui.statsPanel.UpdateStats(FileStats{
			Processed: processed,
			Total:     total,
		})
	}
}

func (h *MessageHandler) updateWorkers(msg Message) {
	if msg.Method == "UpdateWorker" {
		id := getIntValue(msg.Data, "id")
		state := getStringValue(msg.Data, "state")
		file := getStringValue(msg.Data, "file")
		operation := getStringValue(msg.Data, "operation")
		progress := getIntValue(msg.Data, "progress")
		
		h.tui.UpdateWorker(id, WorkerData{
			ID:        id,
			State:     WorkerState(state),
			File:      file,
			Operation: operation,
			Progress:  progress,
		})
	}
}

func (h *MessageHandler) updatePerformance(msg Message) {
	if msg.Method == "UpdateMetrics" {
		cpu := getFloatValue(msg.Data, "cpu")
		memory := getFloatValue(msg.Data, "memory")
		h.tui.UpdatePerformance(PerformanceMetrics{
			CPU:    int(cpu),
			Memory: int(memory),
		})
	}
}

func (h *MessageHandler) updateStatus(msg Message) {
	message := getStringValue(msg.Data, "message")
	switch msg.Method {
	case "SetMessage":
		h.tui.statusPanel.SetMessage(message)
	case "SetError":
		h.tui.statusPanel.SetError(message)
	case "SetRunning":
		h.tui.statusPanel.SetRunning(message)
	case "SetPaused":
		h.tui.statusPanel.SetPaused()
	case "SetComplete":
		h.tui.statusPanel.SetMessage(fmt.Sprintf("✓ %s", message))
	}
}

func (h *MessageHandler) updateLogs(msg Message) {
	level := getStringValue(msg.Data, "level")
	message := getStringValue(msg.Data, "message")
	h.tui.AddLog(level, message, 0)
}

// Helper functions to safely extract values from map

func getStringValue(data map[string]interface{}, key string) string {
	if val, ok := data[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return ""
}

func getIntValue(data map[string]interface{}, key string) int {
	if val, ok := data[key]; ok {
		switch v := val.(type) {
		case float64:
			return int(v)
		case int:
			return v
		case int64:
			return int(v)
		}
	}
	return 0
}

func getFloatValue(data map[string]interface{}, key string) float64 {
	if val, ok := data[key]; ok {
		switch v := val.(type) {
		case float64:
			return v
		case int:
			return float64(v)
		case int64:
			return float64(v)
		}
	}
	return 0.0
}

func getBoolValue(data map[string]interface{}, key string) bool {
	if val, ok := data[key]; ok {
		if b, ok := val.(bool); ok {
			return b
		}
	}
	return false
}