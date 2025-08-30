#!/bin/bash

# Minimal test - just shows a message and waits for P key
echo "Minimal Password Modal Test"
echo "Press 'P' to trigger the password modal"
echo "Press 'Q' to quit"
echo ""

# Create a named pipe
PIPE=$(mktemp -u)
mkfifo "$PIPE"

# Start the TUI with the pipe as input
./documentor-tui < "$PIPE" &
TUI_PID=$!

# Send initial message and keep pipe open
(
  echo '{"type":"log","level":"info","content":"Press P to show password modal, Q to quit"}' > "$PIPE"
  
  # Keep pipe open while TUI is running
  while kill -0 $TUI_PID 2>/dev/null; do
    sleep 1
  done
) &
FEEDER_PID=$!

# Wait for TUI to exit
wait $TUI_PID

# Cleanup
kill $FEEDER_PID 2>/dev/null
rm -f "$PIPE"

echo "TUI exited successfully"