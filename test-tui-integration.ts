#!/usr/bin/env ts-node
/**
 * TUI Integration Test Script
 * Tests the complete TUI communication between Go and Node.js
 */

import { TUIInterfaceV4 } from './src/core/TUIInterfaceV4'

async function testTUIIntegration() {
  console.error('=== TUI Integration Test ===')
  console.error('Testing message protocol and panel updates...\n')
  
  // Create TUI interface
  const tui = new TUIInterfaceV4({
    project: '~/github/test-project',
    output: '~/obsidian_vault/docs/test-project',
    enabled: true,
    workers: 4,
    phases: [
      'Initialization', 'Validation', 'Analysis',
      'Preparation', 'Generation', 'Enhancement',
      'Formatting', 'Integration', 'Finalization'
    ]
  })
  
  // Test 1: Initialize and update all panels
  console.error('Test 1: Initializing TUI...')
  tui.setTotalFiles(100)
  await delay(500)
  
  // Test 2: Phase updates (3 macro phases -> 9 visible)
  console.error('Test 2: Testing phase transitions...')
  
  // Macro phase 1 (Discovery)
  tui.updatePhase(1, 1, 'Initialization')
  await delay(500)
  tui.updatePhase(1, 2, 'Validation')
  await delay(500)
  tui.updatePhase(1, 3, 'Analysis')
  await delay(500)
  
  // Macro phase 2 (Processing)
  tui.updatePhase(2, 1, 'Preparation')
  await delay(500)
  tui.updatePhase(2, 2, 'Generation')
  await delay(500)
  tui.updatePhase(2, 3, 'Enhancement')
  await delay(500)
  
  // Test 3: Worker updates
  console.error('Test 3: Testing worker states...')
  
  // Simulate 4 workers processing files
  for (let i = 1; i <= 4; i++) {
    tui.updateWorker(i, {
      state: 'busy' as any,
      file: `test-file-${i}.ts`,
      operation: 'analyzing',
      progress: 0
    })
  }
  await delay(500)
  
  // Update worker progress
  for (let progress = 0; progress <= 100; progress += 20) {
    for (let i = 1; i <= 4; i++) {
      tui.updateWorker(i, {
        progress,
        operation: progress < 50 ? 'analyzing' : 'generating'
      })
    }
    await delay(300)
  }
  
  // Complete workers
  for (let i = 1; i <= 4; i++) {
    tui.updateWorker(i, {
      state: 'idle' as any,
      filesCompleted: Math.floor(Math.random() * 10) + 1,
      filesFailed: Math.floor(Math.random() * 2)
    })
  }
  await delay(500)
  
  // Test 4: File progress
  console.error('Test 4: Testing file progress...')
  for (let i = 0; i <= 100; i += 10) {
    tui.updateFileProgress(i, 100)
    tui.updateQueue(100 - i)
    if (i % 20 === 0) {
      tui.documentGenerated()
    }
    await delay(200)
  }
  
  // Test 5: Logging
  console.error('Test 5: Testing log messages...')
  tui.log('INFO', 'Test information message')
  tui.log('WARN', 'Test warning message')
  tui.log('ERROR', 'Test error message')
  tui.log('DEBUG', 'Test debug message')
  
  // Test worker-specific logs
  for (let i = 1; i <= 4; i++) {
    tui.log('INFO', `Worker ${i} processing file`, i)
  }
  await delay(500)
  
  // Test 6: Status updates
  console.error('Test 6: Testing status panel...')
  tui.updateStatus('processing', 'Processing files...')
  await delay(500)
  tui.setProcessing('input.ts', 'output.md')
  await delay(500)
  tui.updateStatus('paused', 'Processing paused')
  await delay(500)
  tui.updateStatus('error', 'An error occurred')
  await delay(500)
  tui.updateStatus('complete', 'Processing complete!')
  await delay(500)
  
  // Test 7: Performance metrics
  console.error('Test 7: Performance metrics update automatically...')
  await delay(2000) // Let metrics update a few times
  
  // Test 8: Batch messages
  console.error('Test 8: Testing message batching...')
  // Send multiple messages quickly - they should batch
  for (let i = 0; i < 10; i++) {
    tui.log('DEBUG', `Batch message ${i}`)
  }
  await delay(100) // Wait for batch to flush
  
  // Complete
  console.error('\nTest 9: Shutting down...')
  tui.shutdown()
  
  console.error('\n=== Test Complete ===')
  console.error('Check the TUI display for all panel updates!')
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Run test if spawned by TUI
if (process.env.TUI_MODE === 'true') {
  console.error('Running in TUI mode - messages will be sent to stdout')
  testTUIIntegration().catch(error => {
    console.error('Test failed:', error)
    process.exit(1)
  })
} else {
  console.log('This script should be run through the TUI:')
  console.log('./documentor-tui test')
  console.log('\nOr set TUI_MODE=true to see JSON output:')
  console.log('TUI_MODE=true ts-node test-tui-integration.ts')
}