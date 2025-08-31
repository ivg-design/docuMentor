#!/bin/bash

# Simple TUI test without intro text

echo "Testing TUI startup..."

# Try to run directly
./tui-ultra --test 2>&1

# Check exit code
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
    echo "TUI exited with code: $EXIT_CODE"
    
    # Try without test mode
    echo "Trying without test mode..."
    ./tui-ultra 2>&1
fi
