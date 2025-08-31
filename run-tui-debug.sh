#!/bin/bash

# Direct TUI launcher without intro text

# Check if binary exists
if [ ! -f "./tui-ultra" ]; then
    echo "Building TUI..."
    cd src/tui
    go build -o ../../tui-ultra main_ultra.go test_ultra.go panel_header_modular.go panel_info_bar.go panel_workers_ultra.go panel_controls.go panel_logs.go panel_performance.go panel_status_ultra.go types.go
    if [ $? -ne 0 ]; then
        echo "Build failed!"
        exit 1
    fi
    cd ../..
    echo "Build complete."
fi

# Run directly without intro
exec ./tui-ultra --test