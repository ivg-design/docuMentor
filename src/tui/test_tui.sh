#!/bin/bash

# Test the TUI with sample messages
echo "Testing DocuMentor TUI..."

# Create a test pipe
mkfifo /tmp/tui_test_pipe 2>/dev/null || true

# Run TUI in background reading from pipe
./tui_test < /tmp/tui_test_pipe &
TUI_PID=$!

# Send test messages
(
    sleep 1
    echo '{"type":"log","level":"info","content":"Starting documentation generation...","timestamp":"'$(date +%H:%M:%S)'"}'
    sleep 0.5
    echo '{"type":"phase","phase":{"current":1,"total":5,"name":"Initialization","subPhase":"Loading configuration"}}'
    sleep 0.5
    echo '{"type":"file","files":{"processed":0,"total":100,"current":"src/main.go"}}'
    sleep 0.5
    echo '{"type":"log","level":"success","content":"Configuration loaded successfully","timestamp":"'$(date +%H:%M:%S)'"}'
    sleep 0.5
    echo '{"type":"tool","tool":"FileReader","content":"Reading source files...","timestamp":"'$(date +%H:%M:%S)'"}'
    sleep 0.5
    echo '{"type":"file","files":{"processed":25,"total":100,"current":"src/utils/helper.go"}}'
    sleep 0.5
    echo '{"type":"debug","content":"Memory usage: 45MB","timestamp":"'$(date +%H:%M:%S)'"}'
    sleep 0.5
    echo '{"type":"file","files":{"processed":50,"total":100,"current":"src/api/handler.go"}}'
    sleep 0.5
    echo '{"type":"log","level":"warning","content":"Large file detected, this may take longer","timestamp":"'$(date +%H:%M:%S)'"}'
    sleep 0.5
    echo '{"type":"file","files":{"processed":75,"total":100,"current":"tests/integration_test.go"}}'
    sleep 0.5
    echo '{"type":"raw","content":"API Response: {status: 200, tokens: 1500}","timestamp":"'$(date +%H:%M:%S)'"}'
    sleep 0.5
    echo '{"type":"file","files":{"processed":100,"total":100,"current":""}}'
    sleep 0.5
    echo '{"type":"log","level":"success","content":"Documentation generation completed!","timestamp":"'$(date +%H:%M:%S)'"}'
    sleep 2
) > /tmp/tui_test_pipe

# Clean up
kill $TUI_PID 2>/dev/null
rm -f /tmp/tui_test_pipe
rm -f tui_test

echo "TUI test completed successfully!"