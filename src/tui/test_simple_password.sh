#!/bin/bash

# Simple test for password modal
echo "Testing Password Modal - Press 'P' to trigger manually"
echo "Press 'Q' to quit"
echo ""

# Create a named pipe
PIPE=$(mktemp -u)
mkfifo "$PIPE"

# Start the TUI with the pipe as input
./documentor-tui < "$PIPE" &
TUI_PID=$!

# Send messages and keep pipe open
(
  # Initial setup
  echo '{"type":"project","projectPath":"/Users/ivg/github/docuMentor"}' > "$PIPE"
  sleep 0.2
  
  echo '{"type":"log","level":"info","content":"TUI Started - Press P to test password modal"}' > "$PIPE"
  sleep 0.2
  
  echo '{"type":"log","level":"info","content":"Press Escape to cancel the modal"}' > "$PIPE"
  sleep 0.2
  
  echo '{"type":"log","level":"info","content":"Press Enter to submit the password"}' > "$PIPE"
  echo '{"type":"log","level":"info","content":"Press Q to quit"}' > "$PIPE"
  
  # Keep pipe open while TUI is running
  while kill -0 $TUI_PID 2>/dev/null; do
    sleep 5
    echo '{"type":"debug","content":"Heartbeat..."}' > "$PIPE"
  done
) &
FEEDER_PID=$!

# Wait for TUI to exit
wait $TUI_PID

# Cleanup
kill $FEEDER_PID 2>/dev/null
rm -f "$PIPE"

echo "TUI exited successfully"