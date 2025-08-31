#!/bin/bash

# DocuMentor ULTRA TUI Launcher

echo "DocuMentor ULTRA TUI"
echo "===================="
echo ""
echo "This is the ULTRA DESIGN implementation with:"
echo "  • Properly aligned header with 2-line grid"
echo "  • Single-line info bar with phase and stats"
echo "  • 4 horizontal workers with title + 2 lines each"
echo "  • Button controls row"
echo "  • Performance metrics bar"
echo "  • Status bar with animated spinner"
echo ""
echo "Starting ULTRA TUI..."
echo ""

# Check if binary exists
if [ ! -f "./tui-ultra" ]; then
    echo "Error: tui-ultra binary not found!"
    echo "Building TUI..."
    cd src/tui
    go build -o ../../tui-ultra main_ultra.go test_ultra.go panel_header_modular.go panel_info_bar.go panel_workers_ultra.go panel_controls.go panel_logs.go panel_performance.go panel_status_ultra.go types.go
    cd ../..
fi

# Check if we have a TTY
if [ ! -t 0 ] || [ ! -t 1 ]; then
    echo "Error: No TTY available. Please run in a terminal."
    exit 1
fi

# Run with error checking
./tui-ultra --test
if [ $? -ne 0 ]; then
    echo ""
    echo "Error: TUI failed to start. Check error messages above."
    exit 1
fi