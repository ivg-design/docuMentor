package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// LaunchDocumentor starts the Node.js process and captures its output
func (t *TUI) LaunchDocumentor(args []string) error {
	// Get the directory of the current executable
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %v", err)
	}
	exeDir := filepath.Dir(exePath)
	
	// Build command to run Node.js
	nodeScript := filepath.Join(exeDir, "dist", "index.js")
	
	// Create command with arguments
	cmdArgs := append([]string{nodeScript}, args...)
	cmd := exec.Command("node", cmdArgs...)
	
	// Store the command so we can kill it later
	t.nodeCmd = cmd
	
	// Set environment to indicate TUI mode
	cmd.Env = append(os.Environ(), "DOCUMENTOR_TUI=true")
	
	// Get stdout pipe
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %v", err)
	}
	
	// Get stderr pipe  
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to create stderr pipe: %v", err)
	}
	
	// Start the command
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start Node.js: %v", err)
	}
	
	// Read stdout in goroutine
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := scanner.Text()
			
			// Try to parse as JSON
			var msg Message
			if err := json.Unmarshal([]byte(line), &msg); err == nil {
				t.handleMessage(msg)
			} else {
				// If not JSON, treat as raw output
				t.handleMessage(Message{
					Type: "raw",
					Content: line,
				})
			}
		}
	}()
	
	// Read stderr in goroutine
	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			// All stderr goes to debug view
			t.handleMessage(Message{
				Type: "debug",
				Content: scanner.Text(),
			})
		}
	}()
	
	// Wait for command to finish
	go func() {
		cmd.Wait()
		// Signal TUI to exit when Node.js finishes
		t.app.Stop()
	}()
	
	return nil
}

// CleanupDocumentor kills the Node.js process if it's still running
func (t *TUI) CleanupDocumentor() {
	if t.nodeCmd != nil && t.nodeCmd.Process != nil {
		// Kill the process group to ensure all children die too
		t.nodeCmd.Process.Kill()
	}
}