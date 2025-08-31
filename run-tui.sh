#!/bin/bash

# DocuMentor TUI Launcher Script

echo "DocuMentor TUI Launcher"
echo "======================"
echo ""

# Check if tui-test binary exists
if [ ! -f "./tui-test" ]; then
    echo "Building TUI binary..."
    cd src/tui
    go build -o ../../tui-test .
    cd ../..
    echo "Build complete!"
fi

# Run the TUI
echo "Starting TUI..."
echo ""
echo "Commands:"
echo "  --test    : Run with simulated test data"
echo "  --verbose : Enable verbose logging"
echo ""

# Run with arguments passed to script
./tui-test "$@"