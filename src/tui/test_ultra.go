package main

import (
	"fmt"
	"math/rand"
	"time"
)

// runUltraTestMode runs the ULTRA TUI in test mode with simulated data
func (t *UltraTUI) runUltraTestMode() {
	// Start simulation goroutines
	go t.simulateUltraWorkers()
	go t.simulateUltraPhases()
	go t.simulateUltraPerformance()
	go t.simulateUltraLogs()
	go t.simulateUltraStatus()
}

// simulateUltraWorkers simulates worker activity
func (t *UltraTUI) simulateUltraWorkers() {
	files := []string{
		"src/index.ts",
		"src/cli/commands/generate.ts",
		"src/utils/helpers.ts",
		"main.tsx",
		"README.md",
		"package.json",
		"tsconfig.json",
		"src/components/Button.tsx",
	}
	
	operations := []string{
		"analyzing",
		"generating",
		"reading",
		"processing",
		"validating",
	}
	
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	
	for range ticker.C {
		// Update 1-2 workers randomly
		numUpdates := rand.Intn(2) + 1
		for i := 0; i < numUpdates; i++ {
			workerID := rand.Intn(4) + 1
			
			states := []WorkerState{
				WorkerStateIdle,
				WorkerStateBusy,
				WorkerStateBusy,
				WorkerStateBusy,
				WorkerStateBlocked,
			}
			
			state := states[rand.Intn(len(states))]
			
			data := WorkerData{
				ID:    workerID,
				State: state,
			}
			
			if state == WorkerStateBusy {
				data.File = files[rand.Intn(len(files))]
				data.Operation = operations[rand.Intn(len(operations))]
				data.TimeElapsed = time.Duration(rand.Intn(20)) * time.Second
			} else if state == WorkerStateBlocked {
				data.File = files[rand.Intn(len(files))]
				data.Operation = "waiting for Claude"
				data.TimeElapsed = time.Duration(rand.Intn(10)) * time.Second
			} else if state == WorkerStateIdle {
				data.Stats = WorkerStats{
					Completed: rand.Intn(50),
					Failed:    rand.Intn(3),
				}
			}
			
			t.UpdateWorker(workerID, data)
		}
	}
}

// simulateUltraPhases simulates phase progression
func (t *UltraTUI) simulateUltraPhases() {
	phases := []string{
		"Initialization",
		"Discovery",
		"Analysis",
		"Generation",
		"Writing",
		"Validation",
	}
	
	phaseIndex := 0
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	
	for range ticker.C {
		phaseIndex = (phaseIndex + 1) % len(phases)
		t.UpdatePhase(phaseIndex+1, 9, phases[phaseIndex])
		
		// Update file counts
		processed := rand.Intn(300) + 100
		total := 487
		t.UpdateFiles(processed, total)
		
		// Update queue
		t.infoBar.UpdateQueue(rand.Intn(50)+1, 323)
		
		// Update errors
		t.infoBar.UpdateErrors(rand.Intn(5))
		
		// Update docs
		t.infoBar.UpdateDocs(rand.Intn(6)+1, 6)
	}
}

// simulateUltraPerformance simulates performance metrics
func (t *UltraTUI) simulateUltraPerformance() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	
	for range ticker.C {
		metrics := PerformanceMetrics{
			CPU:        float64(rand.Intn(40) + 40),  // 40-80%
			Memory:     float64(rand.Intn(30) + 20),  // 20-50%
			Disk:       float64(rand.Intn(100) + 20), // MB/s
			Network:    float64(rand.Intn(200) + 50), // KB/s
			Throughput: float64(rand.Intn(10) + 5),   // docs/min
		}
		
		t.UpdatePerformance(metrics)
	}
}

// simulateUltraLogs simulates log entries
func (t *UltraTUI) simulateUltraLogs() {
	ticker := time.NewTicker(1500 * time.Millisecond)
	defer ticker.Stop()
	
	logTemplates := []struct {
		level   string
		message string
	}{
		{"INFO", "Starting efficient document processing"},
		{"INFO", "Found %d documentable files"},
		{"INFO", "Starting 4 parallel workers"},
		{"WORK1", "Processing: %s (TypeScript, 12KB)"},
		{"WORK2", "✓ Completed: %s (4KB) in 1.2s"},
		{"WORK3", "Processing: %s (React Component, 8KB)"},
		{"WORK4", "Processing: %s (Markdown, 15KB)"},
		{"ERROR", "Failed: %s - Syntax error at line 42"},
		{"WARN", "Retrying: %s (attempt 2/3)"},
		{"INFO", "Claude processing... (waiting for response)"},
		{"INFO", "Output saved: ~/docs/%s.md"},
		{"DEBUG", "Cache hit for: %s"},
	}
	
	files := []string{
		"src/index.js", "main.tsx", "README.md", "package.json",
		"tsconfig.json", "src/broken.js", "Button.tsx",
	}
	
	for range ticker.C {
		template := logTemplates[rand.Intn(len(logTemplates))]
		file := files[rand.Intn(len(files))]
		
		message := fmt.Sprintf(template.message, file)
		workerID := 0
		
		// Some logs are worker-specific
		if template.level[:4] == "WORK" {
			workerID = int(template.level[4] - '0')
			template.level = "INFO"
		}
		
		t.AddLog(template.level, message, workerID)
	}
}

// simulateUltraStatus simulates status messages
func (t *UltraTUI) simulateUltraStatus() {
	files := [][]string{
		{"src/components/Button.tsx", "Button.tsx.md"},
		{"src/index.ts", "index.md"},
		{"README.md", "README.md"},
		{"src/utils/helpers.ts", "helpers.md"},
	}
	
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()
	
	fileIndex := 0
	for range ticker.C {
		file := files[fileIndex%len(files)]
		t.statusPanel.SetProcessing(file[0], file[1])
		fileIndex++
	}
}