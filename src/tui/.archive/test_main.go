package main

import (
	"fmt"
	"time"
)

// TestTUI runs the TUI in test mode without Node.js
func (t *TUI) RunTestMode() error {
	// Start the TUI without Node.js
	go func() {
		time.Sleep(1 * time.Second)
		
		// Send initial project message
		t.handleMessage(Message{
			Type: "project",
			ProjectPath: "/Users/ivg/github/docuMentor",
		})
		
		// Send phase message
		t.handleMessage(Message{
			Type: "phase",
			Phase: PhaseInfo{
				Current: 3,
				Total: 9,
				Name: "Analysis",
				SubPhase: "Scanning files",
			},
		})
		
		// Send file progress
		t.handleMessage(Message{
			Type: "file",
			Files: FileInfo{
				Processed: 45,
				Total: 127,
				Current: "src/core/DocumentProcessor.ts",
			},
		})
		
		// Simulate worker updates
		go t.simulateWorkers()
	}()
	
	return t.app.Run()
}

func (t *TUI) simulateWorkers() {
	// Initial worker states
	workers := []WorkerData{
		{WorkerID: 1, State: WorkerStateBusy, File: "src/index.ts", Operation: "analyzing", Progress: 0},
		{WorkerID: 2, State: WorkerStateIdle, Stats: WorkerStats{Completed: 5, Failed: 0}},
		{WorkerID: 3, State: WorkerStateBusy, File: "README.md", Operation: "generating", Progress: 0},
		{WorkerID: 4, State: WorkerStateBlocked, File: "package.json", Operation: "waiting for Claude"},
	}
	
	// Update workers initially
	for _, w := range workers {
		t.workerPanel.UpdateWorker(w)
	}
	
	// Animate progress
	ticker := time.NewTicker(500 * time.Millisecond)
	progress := 0
	
	for range ticker.C {
		progress += 5
		if progress > 100 {
			progress = 0
		}
		
		// Update worker 1 progress
		workers[0].Progress = progress
		workers[0].TimeElapsed = progress * 100 // milliseconds
		t.workerPanel.UpdateWorker(workers[0])
		
		// Update worker 3 progress
		workers[2].Progress = (progress + 30) % 100
		workers[2].TimeElapsed = (progress + 30) * 100
		t.workerPanel.UpdateWorker(workers[2])
		
		// Occasionally change worker 2 state
		if progress == 50 {
			workers[1].State = WorkerStateBusy
			workers[1].File = "config.json"
			workers[1].Operation = "processing"
			t.workerPanel.UpdateWorker(workers[1])
		} else if progress == 0 {
			workers[1].State = WorkerStateIdle
			workers[1].File = ""
			workers[1].Stats.Completed++
			t.workerPanel.UpdateWorker(workers[1])
		}
		
		// Add some log messages
		if progress%20 == 0 {
			t.handleMessage(Message{
				Type: "log",
				Level: "info",
				Content: fmt.Sprintf("Processing... %d%%", progress),
			})
		}
	}
}

// Main function for test mode
func RunTestTUI() {
	tui := NewTUI()
	
	// Override the run command to use test mode
	if err := tui.RunTestMode(); err != nil {
		fmt.Printf("Error: %v\n", err)
	}
}