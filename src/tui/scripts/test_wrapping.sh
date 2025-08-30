#!/bin/bash

# Test text wrapping with long lines
(
  # Initial setup
  echo '{"type":"project","projectPath":"/Users/ivg/github/docuMentor"}'
  echo '{"type":"lockInfo","lockInfo":{"status":"locked","resuming":false,"timestamp":"2024-08-29T14:30:00Z"}}'
  sleep 0.2
  
  # Phase info
  echo '{"type":"phase","phase":{"current":1,"total":5,"name":"Testing Wrapping","subPhase":"Checking long lines"}}'
  sleep 0.1
  
  # Test normal view with very long log lines
  echo '{"type":"log","level":"info","content":"This is an extremely long log line that should definitely wrap when displayed in the TUI because it contains way more text than can fit on a single line in a typical terminal window. The wrapping should happen at word boundaries to maintain readability."}'
  sleep 0.1
  
  echo '{"type":"log","level":"warning","content":"Another super long warning message that tests the wrapping functionality: Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris."}'
  sleep 0.1
  
  # Test debug view with long content
  echo '{"type":"debug","content":"DEBUG: Very long debug output with lots of technical information that would normally be truncated but should now wrap properly. This includes stack traces, memory addresses like 0x7fff8b3c4d20, function calls like DocumentationAgent.processFile(), and other verbose debugging information that developers need to see in full."}'
  sleep 0.1
  
  # Test raw view with long JSON
  echo '{"type":"raw","content":"{\"event\":\"assistant\",\"message\":{\"content\":\"This is a very long raw API response that contains extensive JSON data which should wrap instead of being truncated. The raw view is particularly important for debugging API interactions and seeing the full response payload without any loss of information.\",\"metadata\":{\"tokens\":1500,\"model\":\"claude-3-opus\",\"latency\":250}}}"}'
  sleep 0.1
  
  # Test tool calls with long paths
  echo '{"type":"tool","tool":"Read","content":"/Users/ivg/github/docuMentor/src/components/generators/documentation/FullMontyGeneratorV3WithExtraLongFileNameThatShouldDefinitelyWrap.ts"}'
  sleep 0.1
  
  # File paths that are very long
  echo '{"type":"file","files":{"processed":50,"total":100,"current":"src/components/ui/terminal/ultra/mega/super/long/nested/directory/structure/that/goes/on/forever/ConfigurationManager.ts"}}'
  sleep 0.1
  
  echo '{"type":"log","level":"success","content":"Text wrapping test completed successfully! All long lines should have been wrapped at word boundaries rather than being truncated with ellipsis."}'
  
  # Keep running for observation
  sleep 10
) | ./documentor-tui