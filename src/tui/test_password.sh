#!/bin/bash

# Test password modal functionality
echo "Testing DocuMentor TUI Password Modal..."
echo "Press 'P' to trigger the password modal test"
echo "Or this script will send a password request after 5 seconds"
echo ""

(
  # Initial setup
  echo '{"type":"project","projectPath":"/Users/ivg/github/docuMentor"}'
  echo '{"type":"lockInfo","lockInfo":{"status":"locked","resuming":false,"timestamp":"2024-08-29T14:30:00Z"}}'
  sleep 0.5
  
  # Initial phase
  echo '{"type":"phase","phase":{"current":1,"total":5,"name":"Initialization","subPhase":"Starting up"}}'
  sleep 0.5
  
  echo '{"type":"log","level":"info","content":"Starting documentation generation..."}'
  sleep 0.5
  echo '{"type":"log","level":"info","content":"Press P to test the password modal manually"}'
  sleep 1
  
  echo '{"type":"log","level":"warning","content":"Waiting 3 seconds before automatic password request..."}'
  sleep 3
  
  # Send password request
  echo '{"type":"password_request","requestId":"test-001","prompt":"sudo password required for installation","context":"Running: sudo npm install -g documentor"}'
  sleep 1
  
  echo '{"type":"log","level":"info","content":"Password modal should be displayed now"}'
  sleep 2
  
  # Continue with normal operation
  echo '{"type":"phase","phase":{"current":2,"total":5,"name":"Processing","subPhase":"Analyzing files"}}'
  sleep 0.5
  
  echo '{"type":"file","files":{"processed":10,"total":100,"current":"src/main.go"}}'
  sleep 0.5
  
  # Another password request after some time
  sleep 5
  echo '{"type":"log","level":"warning","content":"Another password request coming..."}'
  sleep 1
  
  echo '{"type":"password_request","requestId":"test-002","prompt":"SSH key passphrase required","context":"Accessing remote repository: git@github.com:user/repo.git"}'
  sleep 1
  
  echo '{"type":"log","level":"info","content":"Second password modal should be displayed"}'
  
  # Keep running
  while true; do
    sleep 2
    echo '{"type":"debug","content":"System running normally..."}'
    sleep 3
    PROCESSED=$(( RANDOM % 100 ))
    echo "{\"type\":\"file\",\"files\":{\"processed\":${PROCESSED},\"total\":100,\"current\":\"src/file_${PROCESSED}.go\"}}"
  done
) | ./documentor-tui