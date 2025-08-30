#!/bin/bash

# Minimal test - just shows a message and waits for P key
echo "Minimal Password Modal Test"
echo "Press 'P' to trigger the password modal"
echo ""

(
  echo '{"type":"log","level":"info","content":"Press P to show password modal"}'
  
  # Keep alive
  while true; do
    sleep 10
  done
) | ./documentor-tui