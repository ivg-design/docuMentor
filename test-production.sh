#!/bin/bash

echo "DocuMentor Production Test Script"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Claude CLI is installed
echo "1. Checking Claude CLI..."
if command -v claude &> /dev/null; then
    echo -e "${GREEN}✓ Claude CLI is installed${NC}"
    claude --version
else
    echo -e "${RED}✗ Claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code${NC}"
    exit 1
fi
echo ""

# Build the project
echo "2. Building DocuMentor..."
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi
echo ""

# Install globally
echo "3. Installing DocuMentor globally..."
npm install -g .
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Installation successful${NC}"
else
    echo -e "${RED}✗ Installation failed${NC}"
    exit 1
fi
echo ""

# Verify installation
echo "4. Verifying installation..."
if command -v documentor &> /dev/null; then
    echo -e "${GREEN}✓ DocuMentor is installed${NC}"
    documentor --version
else
    echo -e "${RED}✗ DocuMentor not found in PATH${NC}"
    exit 1
fi
echo ""

# Initialize config
echo "5. Initializing configuration..."
documentor config init --output ~/obsidian_vault/test-docs --overwrite
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Configuration initialized${NC}"
else
    echo -e "${RED}✗ Configuration failed${NC}"
fi
echo ""

# Show config
echo "6. Current configuration:"
documentor config show
echo ""

# Create a small test project
echo "7. Creating test project..."
TEST_DIR="/tmp/documentor-test-project"
rm -rf $TEST_DIR
mkdir -p $TEST_DIR/src
echo "# Test Project" > $TEST_DIR/README.md
echo "export function hello() { return 'world'; }" > $TEST_DIR/src/index.ts
echo '{"name":"test-project","version":"1.0.0"}' > $TEST_DIR/package.json
echo -e "${GREEN}✓ Test project created at $TEST_DIR${NC}"
echo ""

# Generate documentation for test project
echo "8. Generating documentation for test project..."
echo "   This will test the Claude CLI integration..."
documentor generate $TEST_DIR --output /tmp/test-docs --verbose
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Documentation generated successfully${NC}"
    echo "   Output at: /tmp/test-docs"
    ls -la /tmp/test-docs 2>/dev/null | head -5
else
    echo -e "${RED}✗ Documentation generation failed${NC}"
    echo "   Check if Claude CLI is properly configured"
fi
echo ""

echo "=================================="
echo "Production test complete!"
echo ""
echo "Next steps:"
echo "1. Try generating docs for your real project:"
echo "   documentor generate /path/to/your/project"
echo ""
echo "2. Use self-document to test on DocuMentor itself:"
echo "   documentor self-document"
echo ""
echo "3. Check the generated docs in your output directory"