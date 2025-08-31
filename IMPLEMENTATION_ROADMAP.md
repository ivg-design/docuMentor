# Implementation Roadmap: TUI-First Efficient Pipeline with Critical Systems

## Current Status
✅ **Completed:**
- Efficient parallel pipeline architecture designed and partially implemented
- TUI layout ultra-designed
- Critical systems integration plan created
- Claude content bug fixed (changed 'content' to 'sourceContent')

## Implementation Phases

### Phase 0: Immediate Fixes (NOW)
✅ **Fix Claude Bug** - DONE
- Changed 'content' to 'sourceContent' in DocumentPipeline.ts:183

### Phase 1: Core Foundation (4 hours)
**Goal**: Get basic efficient pipeline working with TUI and critical systems

#### 1.1 Lockfile System (1 hour)
```bash
# Create files
src/core/efficient/LockfileIntegration.ts
src/core/efficient/types/lockfile.ts

# Integrate with DocumentProcessor
# Add recovery capability
# Test crash recovery
```

#### 1.2 Config System (1 hour)
```bash
# Create files
src/core/efficient/ConfigSystem.ts
src/core/efficient/types/config.ts

# Integrate EnhancedPhaseManager
# Add feature flags
# Test config loading
```

#### 1.3 TUI Interface Layer (1 hour)
```bash
# Create files
src/core/efficient/TUIInterface.ts
src/core/efficient/types/messages.ts

# Wire up all message types
# Add batching
# Test with Go TUI
```

#### 1.4 Integration & Testing (1 hour)
```bash
# Update DocumentProcessor with all systems
# Update command handlers
# Test basic generation
```

### Phase 2: Template & Enrichment (4 hours)
**Goal**: Add customizable output and intelligent enrichment

#### 2.1 Template System (1.5 hours)
```bash
# Create files
src/core/efficient/TemplateSystem.ts
src/templates/default.hbs
src/templates/obsidian.hbs
src/templates/technical.hbs

# Integrate with pipeline
# Test template selection
```

#### 2.2 Obsidian Enrichment (1.5 hours)
```bash
# Create files
src/core/efficient/ObsidianEnrichment.ts
src/core/efficient/agents/EnrichmentAgent.ts

# Implement backlink discovery
# Add frontmatter generation
# Test with real projects
```

#### 2.3 Tag Manager (1 hour)
```bash
# Create files
src/core/efficient/IntelligentTagManager.ts
src/core/efficient/agents/TagAgent.ts

# Build taxonomy system
# Add tag suggestions
# Test organization
```

### Phase 3: Advanced Capabilities (2 hours)
**Goal**: Add review, update, and monitor features

#### 3.1 Review System (45 min)
```bash
# Create files
src/core/efficient/DocumentReviewer.ts
src/cli/commands/review.ts

# Quality analysis
# Regeneration capability
```

#### 3.2 Update System (45 min)
```bash
# Create files
src/core/efficient/DocumentUpdater.ts
src/cli/commands/update.ts

# Change detection
# Incremental updates
```

#### 3.3 Monitor System (30 min)
```bash
# Create files
src/core/efficient/DocumentMonitor.ts
src/cli/commands/monitor.ts

# File watching
# Auto-regeneration
```

### Phase 4: Polish & Optimization (2 hours)
**Goal**: Production-ready system

#### 4.1 Performance (1 hour)
- Memory optimization
- Caching layer
- Parallel processing tuning

#### 4.2 Error Handling (30 min)
- Graceful degradation
- Recovery mechanisms
- Clear error messages

#### 4.3 Documentation (30 min)
- User guide
- API documentation
- Migration guide

## File Structure After Implementation

```
src/
├── core/
│   ├── efficient/
│   │   ├── DocumentProcessor.ts      ✅ Exists
│   │   ├── DocumentPipeline.ts       ✅ Exists (bug fixed)
│   │   ├── OutputManager.ts          ✅ Exists
│   │   ├── LockfileIntegration.ts    🔨 Phase 1
│   │   ├── ConfigSystem.ts           🔨 Phase 1
│   │   ├── TUIInterface.ts           🔨 Phase 1
│   │   ├── TemplateSystem.ts         🔨 Phase 2
│   │   ├── ObsidianEnrichment.ts     🔨 Phase 2
│   │   ├── IntelligentTagManager.ts  🔨 Phase 2
│   │   ├── DocumentReviewer.ts       🔨 Phase 3
│   │   ├── DocumentUpdater.ts        🔨 Phase 3
│   │   ├── DocumentMonitor.ts        🔨 Phase 3
│   │   ├── agents/
│   │   │   ├── EnrichmentAgent.ts    🔨 Phase 2
│   │   │   └── TagAgent.ts           🔨 Phase 2
│   │   └── types/
│   │       ├── lockfile.ts           🔨 Phase 1
│   │       ├── config.ts             🔨 Phase 1
│   │       └── messages.ts           🔨 Phase 1
│   └── [existing files]
├── templates/
│   ├── default.hbs                   🔨 Phase 2
│   ├── obsidian.hbs                  🔨 Phase 2
│   ├── technical.hbs                 🔨 Phase 2
│   └── api.hbs                       🔨 Phase 2
└── cli/
    └── commands/
        ├── generate.ts                ✅ Exists (needs update)
        ├── review.ts                  🔨 Phase 3
        ├── update.ts                  🔨 Phase 3
        └── monitor.ts                 🔨 Phase 3
```

## Testing Strategy

### Unit Tests
- Each new component gets unit tests
- Mock Claude responses for testing
- Test error recovery paths

### Integration Tests
```bash
# Test 1: Basic generation
npm run test:generate -- /small/project

# Test 2: Crash recovery
npm run test:recovery -- /test/project

# Test 3: Template system
npm run test:templates -- /test/project

# Test 4: Enrichment
npm run test:enrichment -- /test/project

# Test 5: Full pipeline
npm run test:full -- /real/project
```

### Performance Benchmarks
```bash
# Measure before (old system)
time documentor generate /project

# Measure after (new system)
time documentor generate --efficient /project

# Target: 3x faster
```

## Success Metrics

### Functional
- [ ] Claude generates correct documentation (not "I need more info")
- [ ] All 9 phases display in TUI
- [ ] Parallel processing with 4 workers
- [ ] Sequential output maintains order
- [ ] Lockfile enables crash recovery
- [ ] Templates work correctly
- [ ] Obsidian enrichment adds value
- [ ] Tag manager organizes effectively

### Performance
- [ ] 3x faster than sequential
- [ ] Memory < 500MB for large projects
- [ ] CPU ~80% utilization
- [ ] No UI freezing

### Quality
- [ ] Documentation quality improved
- [ ] No missing files
- [ ] Proper error recovery
- [ ] Clear progress indication

## Next Immediate Steps

1. **Start Phase 1.1**: Implement Lockfile System
   ```bash
   # Create LockfileIntegration.ts
   # Add recovery logic
   # Test with interrupted runs
   ```

2. **Then Phase 1.2**: Config System
   ```bash
   # Create ConfigSystem.ts
   # Integrate phase manager
   # Test configuration loading
   ```

3. **Then Phase 1.3**: TUI Interface
   ```bash
   # Create TUIInterface.ts
   # Wire up messages
   # Test with Go TUI
   ```

## Commands to Run

```bash
# Test current (broken) system
./documentor generate /Users/ivg/github/bm_player_template

# After Phase 1 complete
DOCUMENTOR_EFFICIENT=true ./documentor generate /Users/ivg/github/bm_player_template

# After Phase 3 complete
./documentor review /Users/ivg/github/obsidian_vault/docs/bm_player_template-documentation
./documentor update /Users/ivg/github/bm_player_template
./documentor monitor /Users/ivg/github/bm_player_template
```

## Risk Mitigation

### Risk: Integration breaks existing system
**Mitigation**: Use feature flag, keep old system intact

### Risk: TUI protocol incompatibility
**Mitigation**: Test each message type individually

### Risk: Performance regression
**Mitigation**: Benchmark at each phase

### Risk: Claude API changes
**Mitigation**: Abstract Claude interface

## Timeline

- **Today**: Complete Phase 1 (Core Foundation)
- **Tomorrow**: Complete Phase 2 (Templates & Enrichment)
- **Day 3**: Complete Phase 3 (Advanced Capabilities)
- **Day 4**: Complete Phase 4 (Polish & Ship)

Total: ~12 hours of implementation work