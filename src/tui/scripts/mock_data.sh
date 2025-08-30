#!/bin/bash

# Mock data generator for testing the TUI layout
# This sends various message types to show all UI elements

(
  # Initial project and lock info
  echo '{"type":"project","projectPath":"/Users/ivg/github/docuMentor"}'
  echo '{"type":"lockInfo","lockInfo":{"status":"locked","resuming":false,"timestamp":"2024-08-29T14:30:00Z"}}'
  sleep 0.2
  
  # Initial phase
  echo '{"type":"phase","phase":{"current":1,"total":7,"name":"Initialization","subPhase":"Setting up"}}'
  sleep 0.2
  
  # Some log messages
  echo '{"type":"log","level":"info","content":"Starting documentation generation for docuMentor"}'
  sleep 0.1
  echo '{"type":"log","level":"success","content":"Configuration loaded successfully"}'
  sleep 0.1
  echo '{"type":"log","level":"warning","content":"Lock file detected, checking for stale processes"}'
  sleep 0.1
  
  # File progress
  echo '{"type":"file","files":{"processed":0,"total":145,"current":"src/index.ts"}}'
  sleep 0.2
  
  # Phase 2
  echo '{"type":"phase","phase":{"current":2,"total":7,"name":"Analyzing Project","subPhase":"Scanning files"}}'
  sleep 0.1
  
  # Tool calls
  echo '{"type":"tool","tool":"Read","content":"src/DocumentationAgent.ts"}'
  sleep 0.1
  echo '{"type":"tool","tool":"Glob","content":"**/*.ts"}'
  sleep 0.1
  
  # File updates
  echo '{"type":"file","files":{"processed":12,"total":145,"current":"src/DocumentationAgent.ts"}}'
  sleep 0.1
  
  # Debug messages
  echo '{"type":"debug","content":"Claude process started with PID 12345"}'
  sleep 0.1
  echo '{"type":"debug","content":"Memory usage: 125MB"}'
  echo '{"type":"memory","data":"125MB"}'
  sleep 0.1
  
  # Raw API messages
  echo '{"type":"raw","content":"{\"event\":\"assistant\",\"message\":{\"content\":\"Analyzing project structure...\"}}"}'
  sleep 0.1
  
  # More progress
  echo '{"type":"phase","phase":{"current":3,"total":7,"name":"Claude Analysis","subPhase":"Understanding codebase"}}'
  sleep 0.2
  
  echo '{"type":"log","level":"info","content":"Claude is analyzing the project structure..."}'
  sleep 0.1
  echo '{"type":"tool","tool":"Edit","content":"docs/README.md"}'
  sleep 0.1
  
  # File progress updates with longer paths
  echo '{"type":"file","files":{"processed":45,"total":145,"current":"src/components/ui/ConfigManager.ts"}}'
  sleep 0.1
  echo '{"type":"file","files":{"processed":78,"total":145,"current":"src/components/terminal/UltraTerminalUI.ts"}}'
  sleep 0.1
  
  # Phase 4
  echo '{"type":"phase","phase":{"current":4,"total":7,"name":"Documentation Generation","subPhase":"Creating markdown files"}}'
  sleep 0.2
  
  echo '{"type":"log","level":"success","content":"Generated README.md"}'
  sleep 0.1
  echo '{"type":"log","level":"success","content":"Generated API.md"}'
  sleep 0.1
  echo '{"type":"log","level":"success","content":"Generated TECHNICAL.md"}'
  sleep 0.1
  
  # More file progress with very long path
  echo '{"type":"file","files":{"processed":120,"total":145,"current":"src/components/generators/documentation/FullMontyGeneratorV3.ts"}}'
  sleep 0.2
  
  # Error example
  echo '{"type":"log","level":"error","content":"Failed to write to protected path: /System/Library"}'
  sleep 0.1
  echo '{"type":"log","level":"warning","content":"Retrying with different path..."}'
  sleep 0.1
  echo '{"type":"log","level":"success","content":"Successfully wrote to alternate path"}'
  sleep 0.2
  
  # Update lock status to show resuming
  echo '{"type":"lockInfo","lockInfo":{"status":"locked","resuming":true,"timestamp":"2024-08-29T14:35:00Z"}}'
  sleep 0.1
  
  # Final phases
  echo '{"type":"phase","phase":{"current":5,"total":7,"name":"Verification","subPhase":"Checking documentation"}}'
  sleep 0.1
  echo '{"type":"file","files":{"processed":145,"total":145,"current":""}}'
  sleep 0.1
  
  echo '{"type":"phase","phase":{"current":6,"total":7,"name":"Obsidian Integration","subPhase":"Creating links"}}'
  sleep 0.2
  
  echo '{"type":"log","level":"info","content":"Creating Obsidian backlinks and tags..."}'
  sleep 0.1
  echo '{"type":"log","level":"success","content":"Added 47 backlinks"}'
  sleep 0.1
  echo '{"type":"log","level":"success","content":"Created 23 tags"}'
  sleep 0.2
  
  # Final phase
  echo '{"type":"phase","phase":{"current":7,"total":7,"name":"Complete","subPhase":""}}'
  sleep 0.1
  echo '{"type":"log","level":"success","content":"Documentation generation complete!"}'
  
  # Update lock to unlocked
  echo '{"type":"lockInfo","lockInfo":{"status":"unlocked","resuming":false,"timestamp":"2024-08-29T14:36:00Z"}}'
  
  # Keep sending some messages to show continuous operation
  while true; do
    sleep 2
    echo '{"type":"debug","content":"Heartbeat: System running normally"}'
    sleep 2
    MEM=$(( RANDOM % 50 + 100 ))
    echo "{\"type\":\"memory\",\"data\":\"${MEM}MB\"}"
    sleep 2
    echo "{\"type\":\"raw\",\"content\":\"CPU: $(( RANDOM % 30 + 5 ))% | Threads: $(( RANDOM % 10 + 5 ))\"}"
  done
) | ./documentor-tui