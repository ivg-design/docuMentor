#!/bin/bash

# DocuMentor V3.1 Binary Build Script
# Creates standalone executables for all platforms

set -e

echo "================================================"
echo "DocuMentor V3.1 - Binary Build System"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${YELLOW}Project root: $PROJECT_ROOT${NC}"

# Change to project root
cd "$PROJECT_ROOT"

# Clean previous builds
echo -e "\n${YELLOW}Cleaning previous builds...${NC}"
rm -rf dist/ bin/ 2>/dev/null || true
mkdir -p bin

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "\n${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Build TypeScript
echo -e "\n${YELLOW}Compiling TypeScript...${NC}"
npm run build

# Check if TypeScript build succeeded
if [ ! -d "dist" ]; then
    echo -e "${RED}TypeScript build failed!${NC}"
    exit 1
fi

# Build Go TUI binary
echo -e "\n${YELLOW}Building Go TUI...${NC}"
if [ -d "src/tui" ]; then
    cd src/tui
    
    # Build for current platform first
    echo "Building TUI for current platform..."
    go build -o ../../dist/tui/documentor-tui
    
    # Build for other platforms (optional)
    if [ "$1" == "--all-platforms" ]; then
        echo "Building TUI for all platforms..."
        GOOS=linux GOARCH=amd64 go build -o ../../dist/tui/documentor-tui-linux
        GOOS=darwin GOARCH=amd64 go build -o ../../dist/tui/documentor-tui-macos
        GOOS=windows GOARCH=amd64 go build -o ../../dist/tui/documentor-tui.exe
    fi
    
    cd ../..
else
    echo -e "${YELLOW}No Go TUI found, skipping...${NC}"
fi

# Create default config template
echo -e "\n${YELLOW}Creating default configuration...${NC}"
mkdir -p .documentor
cat > .documentor/config.default.json << 'EOF'
{
  "version": "3.1.0",
  "project": {
    "name": "auto-detect",
    "type": "auto"
  },
  "output": {
    "path": "~/obsidian_vault/docs",
    "format": "obsidian",
    "features": {
      "frontmatter": true,
      "backlinks": true,
      "tags": {
        "optimize": true,
        "hierarchy": true,
        "minPerDoc": 3
      },
      "moc": true,
      "dataview": true
    }
  },
  "permissions": {
    "requestPassword": true,
    "skipOnDenial": true,
    "importantPaths": ["src", "lib", "config"]
  },
  "claude": {
    "model": "claude-3-opus",
    "maxTokens": 100000,
    "temperature": 0.3
  },
  "phases": [
    "analysis", "generation", "enhancement", "formatting",
    "obsidian-integration", "tag-optimization", 
    "backlink-generation", "verification", "save"
  ]
}
EOF

# Package binaries with pkg
echo -e "\n${YELLOW}Creating standalone executables...${NC}"

# Check if pkg is installed
if ! command -v pkg &> /dev/null; then
    echo -e "${YELLOW}Installing pkg...${NC}"
    npm install -g pkg
fi

# Package for different platforms
echo -e "\n${GREEN}Building for Linux x64...${NC}"
pkg dist/index.js \
    --targets node18-linux-x64 \
    --output bin/documentor-linux \
    --compress GZip

echo -e "${GREEN}Building for macOS x64...${NC}"
pkg dist/index.js \
    --targets node18-macos-x64 \
    --output bin/documentor-macos \
    --compress GZip

echo -e "${GREEN}Building for Windows x64...${NC}"
pkg dist/index.js \
    --targets node18-win-x64 \
    --output bin/documentor-win.exe \
    --compress GZip

# Make executables executable (for Unix systems)
chmod +x bin/documentor-linux 2>/dev/null || true
chmod +x bin/documentor-macos 2>/dev/null || true

# Create distribution archives
echo -e "\n${YELLOW}Creating distribution archives...${NC}"

# Linux distribution
echo "Creating Linux distribution..."
mkdir -p dist-linux
cp bin/documentor-linux dist-linux/documentor
cp -r dist/tui dist-linux/ 2>/dev/null || true
cp -r .documentor dist-linux/
cp README.md dist-linux/ 2>/dev/null || true
tar -czf bin/documentor-linux-x64.tar.gz -C dist-linux .
rm -rf dist-linux

# macOS distribution
echo "Creating macOS distribution..."
mkdir -p dist-macos
cp bin/documentor-macos dist-macos/documentor
cp -r dist/tui dist-macos/ 2>/dev/null || true
cp -r .documentor dist-macos/
cp README.md dist-macos/ 2>/dev/null || true
tar -czf bin/documentor-macos-x64.tar.gz -C dist-macos .
rm -rf dist-macos

# Windows distribution
echo "Creating Windows distribution..."
mkdir -p dist-win
cp bin/documentor-win.exe dist-win/
cp -r dist/tui dist-win/ 2>/dev/null || true
cp -r .documentor dist-win/
cp README.md dist-win/ 2>/dev/null || true
cd dist-win && zip -r ../bin/documentor-windows-x64.zip . && cd ..
rm -rf dist-win

# Display results
echo -e "\n${GREEN}================================================${NC}"
echo -e "${GREEN}Build Complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo -e "\nBinaries created in ${YELLOW}bin/${NC} directory:"
ls -lh bin/

echo -e "\n${YELLOW}Installation Instructions:${NC}"
echo "1. Extract the appropriate archive for your platform"
echo "2. Add the binary to your PATH"
echo "3. Run: documentor --help"

echo -e "\n${GREEN}Done! Binaries ready for distribution.${NC}"