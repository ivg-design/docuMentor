package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

// Launcher manages the Node.js child process
type Launcher struct {
	cmd           *exec.Cmd
	stdin         io.WriteCloser
	stdout        io.ReadCloser
	stderr        io.ReadCloser
	messageHandler *MessageHandler
	tui           *TUI
	mu            sync.Mutex
	isRunning     bool
	projectPath   string
	outputPath    string
}

// NewLauncher creates a new launcher for Node.js process
func NewLauncher(tui *TUI, projectPath, outputPath string) *Launcher {
	return &Launcher{
		tui:           tui,
		messageHandler: NewMessageHandler(tui),
		projectPath:   projectPath,
		outputPath:    outputPath,
	}
}

// Start spawns the Node.js process
func (l *Launcher) Start() error {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.isRunning {
		return fmt.Errorf("launcher already running")
	}

	// Find Node.js executable
	nodePath, err := exec.LookPath("node")
	if err != nil {
		return fmt.Errorf("node.js not found: %w", err)
	}

	// Determine the path to the Node.js documentor script
	// This should be relative to the Go binary location
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}
	rootDir := filepath.Dir(filepath.Dir(exePath))
	scriptPath := filepath.Join(rootDir, "dist", "cli", "documentor.js")

	// Check if the script exists
	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		// Try alternative path
		scriptPath = filepath.Join(rootDir, "src", "cli", "documentor.ts")
		if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
			return fmt.Errorf("documentor script not found at %s", scriptPath)
		}
		// Use ts-node if running TypeScript directly
		nodePath = "npx"
	}

	// Build command arguments
	args := []string{}
	if nodePath == "npx" {
		args = append(args, "ts-node", scriptPath)
	} else {
		args = append(args, scriptPath)
	}
	args = append(args, "generate", l.projectPath, "--output", l.outputPath, "--tui")

	// Create command
	l.cmd = exec.Command(nodePath, args...)
	
	// Set environment
	l.cmd.Env = append(os.Environ(),
		"TUI_MODE=true",
		"NODE_ENV=production",
		fmt.Sprintf("CLAUDE_API_KEY=%s", os.Getenv("CLAUDE_API_KEY")),
	)

	// Setup pipes
	l.stdin, err = l.cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdin pipe: %w", err)
	}

	l.stdout, err = l.cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}

	l.stderr, err = l.cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	// Start the process
	if err := l.cmd.Start(); err != nil {
		return fmt.Errorf("failed to start Node.js process: %w", err)
	}

	l.isRunning = true

	// Start reading stdout and stderr
	go l.readStdout()
	go l.readStderr()

	// Send init message
	l.SendInitMessage()

	l.tui.AddLog("info", fmt.Sprintf("Started Node.js process (PID: %d)", l.cmd.Process.Pid), 0)

	return nil
}

// Stop terminates the Node.js process
func (l *Launcher) Stop() error {
	l.mu.Lock()
	defer l.mu.Unlock()

	if !l.isRunning {
		return nil
	}

	// Send shutdown message
	l.SendMessage(Message{
		Type:      "shutdown",
		Timestamp: time.Now().Format("15:04:05"),
	})

	// Give process time to clean up
	time.Sleep(500 * time.Millisecond)

	// Terminate process
	if l.cmd != nil && l.cmd.Process != nil {
		if err := l.cmd.Process.Kill(); err != nil {
			return fmt.Errorf("failed to kill process: %w", err)
		}
	}

	l.isRunning = false
	l.tui.AddLog("info", "Stopped Node.js process", 0)

	return nil
}

// SendMessage sends a message to the Node.js process
func (l *Launcher) SendMessage(msg Message) error {
	if !l.isRunning || l.stdin == nil {
		return fmt.Errorf("launcher not running")
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	_, err = fmt.Fprintf(l.stdin, "%s\n", data)
	if err != nil {
		return fmt.Errorf("failed to write message: %w", err)
	}

	return nil
}

// SendInitMessage sends the initialization message
func (l *Launcher) SendInitMessage() {
	msg := Message{
		Type:      "init",
		Timestamp: time.Now().Format("15:04:05"),
		Data: map[string]interface{}{
			"project": l.projectPath,
			"output":  l.outputPath,
			"pid":     os.Getpid(),
		},
	}
	l.SendMessage(msg)
}

// SendControlMessage sends a control command
func (l *Launcher) SendControlMessage(action string) {
	msg := Message{
		Type:      "control",
		Timestamp: time.Now().Format("15:04:05"),
		Data: map[string]interface{}{
			"action": action,
		},
	}
	l.SendMessage(msg)
}

// readStdout reads messages from Node.js stdout
func (l *Launcher) readStdout() {
	scanner := bufio.NewScanner(l.stdout)
	for scanner.Scan() {
		line := scanner.Text()
		
		// Try to parse as JSON message
		var msg Message
		if err := json.Unmarshal([]byte(line), &msg); err == nil {
			// Handle message through the message handler
			l.messageHandler.HandleMessage(msg)
		} else {
			// If not JSON, treat as plain log
			l.tui.AddLog("info", line, 0)
		}
	}

	if err := scanner.Err(); err != nil {
		l.tui.AddLog("error", fmt.Sprintf("Error reading stdout: %v", err), 0)
	}
}

// readStderr reads error messages from Node.js stderr
func (l *Launcher) readStderr() {
	scanner := bufio.NewScanner(l.stderr)
	for scanner.Scan() {
		line := scanner.Text()
		l.tui.AddLog("error", line, 0)
	}

	if err := scanner.Err(); err != nil {
		l.tui.AddLog("error", fmt.Sprintf("Error reading stderr: %v", err), 0)
	}
}

// IsRunning returns whether the launcher is running
func (l *Launcher) IsRunning() bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.isRunning
}

// WaitForExit waits for the Node.js process to exit
func (l *Launcher) WaitForExit() error {
	if l.cmd == nil {
		return nil
	}
	return l.cmd.Wait()
}