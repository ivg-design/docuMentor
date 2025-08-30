#!/bin/bash

# Test the integrated DocuMentor with Go TUI

echo "Testing DocuMentor + Go TUI Integration"
echo "========================================="
echo ""

# Create a named pipe
PIPE=$(mktemp -u)
mkfifo "$PIPE"

# Start the TUI with the pipe as input
echo "Starting Go TUI..."
./src/tui/documentor-tui < "$PIPE" &
TUI_PID=$!

# Send test messages to simulate documentor output
(
  echo '{"type":"project","projectPath":"/Users/ivg/github/docuMentor"}' > "$PIPE"
  sleep 0.5
  
  echo '{"type":"log","level":"info","content":"Starting documentation generation..."}' > "$PIPE"
  sleep 0.5
  
  echo '{"type":"phase","phase":{"current":1,"total":7,"name":"Initialization","subPhase":"Loading configuration"}}' > "$PIPE"
  sleep 0.5
  
  echo '{"type":"file","files":{"processed":0,"total":100,"current":"package.json"}}' > "$PIPE"
  sleep 0.5
  
  echo '{"type":"tool","tool":"Read","content":"package.json"}' > "$PIPE"
  sleep 0.5
  
  echo '{"type":"phase","phase":{"current":2,"total":7,"name":"Analysis","subPhase":"Scanning files"}}' > "$PIPE"
  sleep 0.5
  
  echo '{"type":"file","files":{"processed":10,"total":100,"current":"src/index.ts"}}' > "$PIPE"
  sleep 0.5
  
  echo '{"type":"log","level":"success","content":"Analysis complete!"}' > "$PIPE"
  sleep 0.5
  
  echo '{"type":"phase","phase":{"current":3,"total":7,"name":"Documentation","subPhase":"Generating markdown"}}' > "$PIPE"
  sleep 0.5
  
  echo '{"type":"file","files":{"processed":50,"total":100,"current":"docs/README.md"}}' > "$PIPE"
  sleep 0.5
  
  echo '{"type":"tool","tool":"Write","content":"docs/README.md"}' > "$PIPE"
  sleep 0.5
  
  echo '{"type":"log","level":"success","content":"Documentation generation completed successfully!"}' > "$PIPE"
  sleep 2
  
  # Keep pipe open for a bit to see the final state
  sleep 3
) &
FEEDER_PID=$!

# Wait for feeder to complete
wait $FEEDER_PID

# Send quit signal
echo "Sending quit signal..."
kill $TUI_PID 2>/dev/null

# Cleanup
rm -f "$PIPE"

echo ""
echo "Integration test completed!"