#!/bin/bash

# Simple test for password modal
echo "Testing Password Modal - Press 'P' to trigger manually"
echo ""

(
  # Initial setup
  echo '{"type":"project","projectPath":"/Users/ivg/github/docuMentor"}'
  sleep 0.2
  
  echo '{"type":"log","level":"info","content":"TUI Started - Press P to test password modal"}'
  sleep 0.2
  
  echo '{"type":"log","level":"info","content":"Press Escape to cancel the modal"}'
  sleep 0.2
  
  echo '{"type":"log","level":"info","content":"Press Enter to submit the password"}'
  
  # Keep alive with periodic updates
  while true; do
    sleep 5
    echo '{"type":"debug","content":"Heartbeat..."}'
  done
) | ./documentor-tui