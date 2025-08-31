package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"
)

// Message represents an incoming message from Node.js
type Message struct {
	Type      string          `json:"type"`
	Panel     string          `json:"panel,omitempty"`
	Method    string          `json:"method,omitempty"`
	Action    string          `json:"action,omitempty"`
	Data      json.RawMessage `json:"data,omitempty"`
	Updates   []Message       `json:"updates,omitempty"`
	Timestamp string          `json:"timestamp,omitempty"`
}

// MessageHandler handles incoming messages from Node.js
type MessageHandler struct {
	tui      *UltraTUI
	running  bool
	scanner  *bufio.Scanner
	messages chan Message
}

// NewMessageHandler creates a new message handler
func NewMessageHandler(tui *UltraTUI) *MessageHandler {
	return &MessageHandler{
		tui:      tui,
		scanner:  bufio.NewScanner(os.Stdin),
		messages: make(chan Message, 100),
	}
}

// Start begins processing messages from stdin
func (h *MessageHandler) Start() {
	h.running = true
	
	// Start message reader goroutine
	go h.readMessages()
	
	// Start message processor goroutine
	go h.processMessages()
}

// Stop stops the message handler
func (h *MessageHandler) Stop() {
	h.running = false
	close(h.messages)
}

// readMessages reads JSON messages from stdin
func (h *MessageHandler) readMessages() {
	for h.running && h.scanner.Scan() {
		line := strings.TrimSpace(h.scanner.Text())
		if line == "" {
			continue
		}
		
		var msg Message
		if err := json.Unmarshal([]byte(line), &msg); err != nil {
			// Log error but continue processing
			h.tui.AddLog("ERROR", fmt.Sprintf("Failed to parse message: %v", err), 0)
			continue
		}
		
		// Send to processing channel
		select {
		case h.messages <- msg:
		default:
			// Channel full, drop message
			h.tui.AddLog("WARN", "Message queue full, dropping message", 0)
		}
	}
	
	if err := h.scanner.Err(); err != nil {
		h.tui.AddLog("ERROR", fmt.Sprintf("Scanner error: %v", err), 0)
	}
}

// processMessages processes incoming messages
func (h *MessageHandler) processMessages() {
	for msg := range h.messages {
		h.handleMessage(msg)
		
		// Trigger UI redraw
		h.tui.app.Draw()
	}
}

// handleMessage processes a single message
func (h *MessageHandler) handleMessage(msg Message) {
	switch msg.Type {
	case "init":
		h.handleInit(msg)
	case "update":
		h.handleUpdate(msg)
	case "batch":
		h.handleBatch(msg)
	case "log":
		h.handleLog(msg)
	case "control":
		h.handleControl(msg)
	case "shutdown":
		h.handleShutdown()
	default:
		// Unknown message type
		h.tui.AddLog("WARN", fmt.Sprintf("Unknown message type: %s", msg.Type), 0)
	}
}

// handleInit handles initialization message
func (h *MessageHandler) handleInit(msg Message) {
	var data struct {
		Project    string   `json:"project"`
		Output     string   `json:"output"`
		PID        int      `json:"pid"`
		TotalFiles int      `json:"totalFiles"`
		Phases     []string `json:"phases"`
		Workers    int      `json:"workers"`
	}
	
	if err := json.Unmarshal(msg.Data, &data); err != nil {
		return
	}
	
	// Update header
	h.tui.headerPanel.UpdateProject(data.Project, data.Output, data.PID)
	
	// Update info bar with total files
	h.tui.infoBar.UpdateFiles(0, data.TotalFiles)
	
	// Set status
	h.tui.statusPanel.SetMessage("Initialized - Ready to process")
}

// handleUpdate handles panel update messages
func (h *MessageHandler) handleUpdate(msg Message) {
	switch msg.Panel {
	case "header":
		h.handleHeaderUpdate(msg.Method, msg.Data)
	case "infobar":
		h.handleInfoBarUpdate(msg.Method, msg.Data)
	case "workers":
		h.handleWorkerUpdate(msg.Method, msg.Data)
	case "performance":
		h.handlePerformanceUpdate(msg.Method, msg.Data)
	case "status":
		h.handleStatusUpdate(msg.Method, msg.Data)
	}
}

// handleBatch handles batch messages
func (h *MessageHandler) handleBatch(msg Message) {
	for _, update := range msg.Updates {
		h.handleMessage(update)
	}
}

// handleLog handles log messages
func (h *MessageHandler) handleLog(msg Message) {
	var data struct {
		Level    string `json:"level"`
		Message  string `json:"message"`
		WorkerID int    `json:"workerID"`
	}
	
	if err := json.Unmarshal(msg.Data, &data); err != nil {
		return
	}
	
	h.tui.AddLog(data.Level, data.Message, data.WorkerID)
}

// handleControl handles control messages
func (h *MessageHandler) handleControl(msg Message) {
	switch msg.Action {
	case "pause":
		h.tui.pause()
	case "resume":
		h.tui.resume()
	case "toggle_debug":
		h.tui.toggleDebug()
	case "toggle_raw":
		h.tui.toggleRaw()
	}
}

// handleShutdown handles shutdown message
func (h *MessageHandler) handleShutdown() {
	h.tui.statusPanel.SetMessage("Shutting down...")
	time.Sleep(100 * time.Millisecond)
	h.tui.quit()
}

// Panel update handlers

func (h *MessageHandler) handleHeaderUpdate(method string, data json.RawMessage) {
	switch method {
	case "UpdateProject":
		var d struct {
			Project string `json:"project"`
			Output  string `json:"output"`
			PID     int    `json:"pid"`
		}
		if json.Unmarshal(data, &d) == nil {
			h.tui.headerPanel.UpdateProject(d.Project, d.Output, d.PID)
		}
	case "SetLock":
		var d struct {
			Locked bool `json:"locked"`
		}
		if json.Unmarshal(data, &d) == nil {
			h.tui.headerPanel.SetLock(d.Locked)
		}
	}
}

func (h *MessageHandler) handleInfoBarUpdate(method string, data json.RawMessage) {
	switch method {
	case "UpdatePhase":
		var d struct {
			Current int    `json:"current"`
			Total   int    `json:"total"`
			Name    string `json:"name"`
		}
		if json.Unmarshal(data, &d) == nil {
			h.tui.UpdatePhase(d.Current, d.Total, d.Name)
		}
	case "UpdateFiles":
		var d struct {
			Processed int `json:"processed"`
			Total     int `json:"total"`
		}
		if json.Unmarshal(data, &d) == nil {
			h.tui.UpdateFiles(d.Processed, d.Total)
		}
	case "UpdateQueue":
		var d struct {
			Current int `json:"current"`
			Total   int `json:"total"`
		}
		if json.Unmarshal(data, &d) == nil {
			h.tui.infoBar.UpdateQueue(d.Current, d.Total)
		}
	case "UpdateErrors":
		var d struct {
			Errors int `json:"errors"`
		}
		if json.Unmarshal(data, &d) == nil {
			h.tui.infoBar.UpdateErrors(d.Errors)
		}
	}
}

func (h *MessageHandler) handleWorkerUpdate(method string, data json.RawMessage) {
	if method != "UpdateWorker" {
		return
	}
	
	var d struct {
		ID        int    `json:"id"`
		State     string `json:"state"`
		File      string `json:"file,omitempty"`
		Operation string `json:"operation,omitempty"`
		Progress  int    `json:"progress,omitempty"`
		TimeElapsed string `json:"timeElapsed,omitempty"`
		Stats     struct {
			Completed  int `json:"completed"`
			Failed     int `json:"failed"`
			Processing int `json:"processing"`
		} `json:"stats,omitempty"`
	}
	
	if err := json.Unmarshal(data, &d); err != nil {
		return
	}
	
	// Convert to WorkerData
	workerData := WorkerData{
		ID:        d.ID,
		State:     WorkerState(d.State),
		File:      d.File,
		Operation: d.Operation,
		Progress:  d.Progress,
		Stats: WorkerStats{
			Completed:  d.Stats.Completed,
			Failed:     d.Stats.Failed,
			Processing: d.Stats.Processing,
		},
	}
	
	// Parse time elapsed if provided
	if d.TimeElapsed != "" {
		if duration, err := time.ParseDuration(d.TimeElapsed); err == nil {
			workerData.TimeElapsed = duration
		}
	}
	
	h.tui.UpdateWorker(d.ID, workerData)
}

func (h *MessageHandler) handlePerformanceUpdate(method string, data json.RawMessage) {
	if method != "UpdateMetrics" {
		return
	}
	
	var metrics PerformanceMetrics
	if err := json.Unmarshal(data, &metrics); err != nil {
		return
	}
	
	h.tui.UpdatePerformance(metrics)
}

func (h *MessageHandler) handleStatusUpdate(method string, data json.RawMessage) {
	switch method {
	case "SetProcessing":
		var d struct {
			InputFile  string `json:"inputFile"`
			OutputFile string `json:"outputFile"`
		}
		if json.Unmarshal(data, &d) == nil {
			h.tui.statusPanel.SetProcessing(d.InputFile, d.OutputFile)
		}
	case "SetMessage":
		var d struct {
			Message string `json:"message"`
		}
		if json.Unmarshal(data, &d) == nil {
			h.tui.statusPanel.SetMessage(d.Message)
		}
	case "SetError":
		var d struct {
			Message string `json:"message"`
		}
		if json.Unmarshal(data, &d) == nil {
			h.tui.statusPanel.SetError(d.Message)
		}
	case "SetComplete":
		h.tui.statusPanel.SetComplete()
	}
}