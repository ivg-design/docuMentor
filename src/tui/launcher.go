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

// ProcessLauncher manages the Node.js child process
type ProcessLauncher struct {
	nodeProcess *exec.Cmd
	stdin       io.WriteCloser
	stdout      io.ReadCloser
	stderr      io.ReadCloser
	tui         *UltraTUI
	reader      *bufio.Scanner
	running     bool
	mu          sync.Mutex
}

// NewProcessLauncher creates a new process launcher
func NewProcessLauncher(tui *UltraTUI) *ProcessLauncher {
	return &ProcessLauncher{
		tui: tui,
	}
}

// Start launches the Node.js process
func (l *ProcessLauncher) Start(command string, projectPath string, outputPath string) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.running {
		return fmt.Errorf("process already running")
	}

	// Find Node.js executable
	nodePath, err := exec.LookPath("node")
	if err != nil {
		return fmt.Errorf("node.js not found: %v", err)
	}

	// Determine the CLI script path
	// Try dist/cli/documentor.js first (production build)
	cliPath := filepath.Join(filepath.Dir(os.Args[0]), "..", "..", "dist", "cli", "documentor.js")
	if _, err := os.Stat(cliPath); os.IsNotExist(err) {
		// Try src/cli/documentor.ts with ts-node (development)
		cliPath = filepath.Join(filepath.Dir(os.Args[0]), "..", "..", "src", "cli", "documentor.ts")
		if _, err := os.Stat(cliPath); os.IsNotExist(err) {
			return fmt.Errorf("documentor CLI not found")
		}
		// Use ts-node for TypeScript files
		nodePath = "npx"
	}

	// Build command arguments
	args := []string{}
	if nodePath == "npx" {
		args = append(args, "ts-node", cliPath)
	} else {
		args = append(args, cliPath)
	}

	// Create the command
	l.nodeProcess = exec.Command(nodePath, args...)
	
	// Set environment variables
	l.nodeProcess.Env = append(os.Environ(),
		"TUI_MODE=true",
		"DOCUMENTOR_TUI=false", // Prevent Node from spawning another TUI
		fmt.Sprintf("CLAUDE_API_KEY=%s", os.Getenv("CLAUDE_API_KEY")),
	)

	// Set working directory
	l.nodeProcess.Dir = filepath.Dir(cliPath)

	// Create pipes
	l.stdin, err = l.nodeProcess.StdinPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdin pipe: %v", err)
	}

	l.stdout, err = l.nodeProcess.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %v", err)
	}

	l.stderr, err = l.nodeProcess.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to create stderr pipe: %v", err)
	}

	// Start the process
	if err := l.nodeProcess.Start(); err != nil {
		return fmt.Errorf("failed to start Node.js process: %v", err)
	}

	l.running = true
	l.reader = bufio.NewScanner(l.stdout)

	// Start reading messages from Node.js
	go l.readMessages()
	
	// Start reading stderr for debugging
	go l.readErrors()

	// Send initialization command
	initCmd := map[string]interface{}{
		"type": "init",
		"data": map[string]interface{}{
			"projectPath": projectPath,
			"outputPath":  outputPath,
			"workers":     4,
			"apiKey":      os.Getenv("CLAUDE_API_KEY"),
		},
	}

	if err := l.SendCommand(initCmd); err != nil {
		return fmt.Errorf("failed to send init command: %v", err)
	}

	// Send start command
	startCmd := map[string]interface{}{
		"type": "start",
		"data": map[string]interface{}{},
	}

	if err := l.SendCommand(startCmd); err != nil {
		return fmt.Errorf("failed to send start command: %v", err)
	}

	return nil
}

// SendCommand sends a command to the Node.js process
func (l *ProcessLauncher) SendCommand(cmd interface{}) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	if !l.running || l.stdin == nil {
		return fmt.Errorf("process not running")
	}

	data, err := json.Marshal(cmd)
	if err != nil {
		return fmt.Errorf("failed to marshal command: %v", err)
	}

	_, err = fmt.Fprintf(l.stdin, "%s\n", data)
	if err != nil {
		return fmt.Errorf("failed to write command: %v", err)
	}

	return nil
}

// readMessages reads JSON messages from Node.js stdout
func (l *ProcessLauncher) readMessages() {
	for l.reader.Scan() {
		line := l.reader.Text()
		if line == "" {
			continue
		}

		// Parse JSON message
		var msg Message
		if err := json.Unmarshal([]byte(line), &msg); err != nil {
			// Not JSON, might be plain text output
			l.tui.AddLog("DEBUG", line, 0)
			continue
		}

		// Process the message through the TUI's message handler
		l.tui.messageHandler.handleMessage(msg)
	}

	if err := l.reader.Err(); err != nil {
		l.tui.AddLog("ERROR", fmt.Sprintf("Error reading from Node.js: %v", err), 0)
	}

	l.mu.Lock()
	l.running = false
	l.mu.Unlock()
}

// readErrors reads from stderr for debugging
func (l *ProcessLauncher) readErrors() {
	scanner := bufio.NewScanner(l.stderr)
	for scanner.Scan() {
		line := scanner.Text()
		if line != "" {
			l.tui.AddLog("STDERR", line, 0)
		}
	}
}

// Pause sends pause command to Node.js
func (l *ProcessLauncher) Pause() error {
	return l.SendCommand(map[string]interface{}{
		"type": "pause",
		"data": map[string]interface{}{},
	})
}

// Resume sends resume command to Node.js
func (l *ProcessLauncher) Resume() error {
	return l.SendCommand(map[string]interface{}{
		"type": "resume",
		"data": map[string]interface{}{},
	})
}

// Stop stops the Node.js process
func (l *ProcessLauncher) Stop() error {
	l.mu.Lock()
	defer l.mu.Unlock()

	if !l.running {
		return nil
	}

	// Send stop command
	stopCmd := map[string]interface{}{
		"type": "stop",
		"data": map[string]interface{}{},
	}
	
	if err := l.SendCommand(stopCmd); err != nil {
		// Log but continue with termination
		l.tui.AddLog("WARN", fmt.Sprintf("Failed to send stop command: %v", err), 0)
	}

	// Close stdin
	if l.stdin != nil {
		l.stdin.Close()
	}

	// Wait for process to exit gracefully
	done := make(chan error, 1)
	go func() {
		done <- l.nodeProcess.Wait()
	}()

	// Give it 5 seconds to exit gracefully
	select {
	case <-done:
		// Process exited
	case <-time.After(5 * time.Second):
		// Force kill after timeout
		if err := l.nodeProcess.Process.Kill(); err != nil {
			return fmt.Errorf("failed to kill process: %v", err)
		}
	}

	l.running = false
	return nil
}

// IsRunning returns whether the process is running
func (l *ProcessLauncher) IsRunning() bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.running
}