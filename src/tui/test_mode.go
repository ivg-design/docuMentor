package main

import (
	"fmt"
	"math/rand"
	"time"
)

// runTestMode runs the TUI in test mode with simulated data
func (t *TUI) runTestMode() {
	// Start simulation goroutines
	go t.simulateWorkers()
	go t.simulatePhases()
	go t.simulateStats()
	go t.simulatePerformance()
	go t.simulateLogs()
}

// simulateWorkers simulates worker activity
func (t *TUI) simulateWorkers() {
	files := []string{
		"src/index.ts",
		"src/core/DocGenerator.ts",
		"src/cli/commands/generate.ts",
		"src/types/index.ts",
		"src/utils/helpers.ts",
		"src/core/FileWriter.ts",
		"src/core/ObsidianIntegration.ts",
		"src/core/ProjectTypeDetector.ts",
	}
	
	operations := []string{
		"Analyzing code",
		"Extracting functions",
		"Generating documentation",
		"Writing output",
		"Validating results",
	}
	
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	
	for range ticker.C {
		// Randomly update 1-2 workers
		numUpdates := rand.Intn(2) + 1
		for i := 0; i < numUpdates; i++ {
			workerID := rand.Intn(4) + 1
			
			// Random state
			states := []WorkerState{
				WorkerStateIdle,
				WorkerStateBusy,
				WorkerStateBusy,
				WorkerStateBusy,
				WorkerStateComplete,
			}
			
			state := states[rand.Intn(len(states))]
			
			data := WorkerData{
				ID:    workerID,
				State: state,
			}
			
			if state == WorkerStateBusy {
				data.File = files[rand.Intn(len(files))]
				data.Operation = operations[rand.Intn(len(operations))]
				data.Progress = rand.Intn(101)
				data.TimeElapsed = time.Duration(rand.Intn(60)) * time.Second
			}
			
			if state == WorkerStateIdle || state == WorkerStateComplete {
				data.Stats = WorkerStats{
					Completed: rand.Intn(20),
					Failed:    rand.Intn(3),
				}
			}
			
			t.UpdateWorker(workerID, data)
		}
	}
}

// simulatePhases simulates phase progression
func (t *TUI) simulatePhases() {
	phases := []string{
		"Initialization",
		"File Discovery",
		"Analysis",
		"Documentation Generation",
		"Writing Output",
		"Validation",
		"Completion",
	}
	
	for _, phase := range phases {
		// Progress through each phase
		for progress := 0; progress <= 100; progress += 5 {
			t.UpdatePhase(PhaseData{
				Current:  phase,
				Progress: progress,
				Status:   "Running",
			})
			time.Sleep(500 * time.Millisecond)
		}
		
		// Mark phase complete
		t.UpdatePhase(PhaseData{
			Current:  phase,
			Progress: 100,
			Status:   "Complete",
		})
		time.Sleep(1 * time.Second)
	}
}

// simulateStats simulates file statistics
func (t *TUI) simulateStats() {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()
	
	total := 100
	processed := 0
	errors := 0
	startTime := time.Now()
	
	for range ticker.C {
		if processed < total {
			processed += rand.Intn(5) + 1
			if processed > total {
				processed = total
			}
			
			if rand.Float32() < 0.1 { // 10% chance of error
				errors++
			}
			
			elapsed := time.Since(startTime).Minutes()
			rate := float64(processed) / elapsed
			
			t.UpdateStats(FileStats{
				Total:     total,
				Processed: processed,
				Queue:     total - processed,
				Rate:      rate,
				Errors:    errors,
			})
		}
	}
}

// simulatePerformance simulates performance metrics
func (t *TUI) simulatePerformance() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	
	for range ticker.C {
		metrics := PerformanceMetrics{
			CPU:        float64(rand.Intn(60) + 20),
			Memory:     float64(rand.Intn(40) + 30),
			Disk:       float64(rand.Intn(30) + 10),
			Network:    float64(rand.Intn(20) + 5),
			Throughput: float64(rand.Intn(50) + 10),
		}
		
		t.UpdatePerformance(metrics)
	}
}

// simulateLogs simulates log entries
func (t *TUI) simulateLogs() {
	ticker := time.NewTicker(1500 * time.Millisecond)
	defer ticker.Stop()
	
	messages := []struct {
		level   string
		message string
	}{
		{"info", "Processing file: %s"},
		{"debug", "Cache hit for: %s"},
		{"warning", "Large file detected: %s"},
		{"error", "Failed to parse: %s"},
		{"info", "Documentation generated for: %s"},
		{"debug", "Worker %d assigned to: %s"},
		{"info", "Phase completed: %s"},
		{"success", "Successfully documented: %s"},
	}
	
	files := []string{
		"index.ts", "main.go", "config.json", "README.md",
		"package.json", "tsconfig.json", "DocGenerator.ts",
	}
	
	for range ticker.C {
		msg := messages[rand.Intn(len(messages))]
		file := files[rand.Intn(len(files))]
		workerID := 0
		
		if rand.Float32() < 0.5 { // 50% chance of worker-specific log
			workerID = rand.Intn(4) + 1
		}
		
		message := fmt.Sprintf(msg.message, file)
		t.AddLog(msg.level, message, workerID)
	}
}