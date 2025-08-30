#!/bin/bash

echo "Installing Hack Nerd Font for DocuMentor TUI..."

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    FONT_DIR="$HOME/Library/Fonts"
    echo "Detected macOS"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    FONT_DIR="$HOME/.local/share/fonts"
    mkdir -p "$FONT_DIR"
    echo "Detected Linux"
else
    echo "Unsupported OS: $OSTYPE"
    echo "Please manually install fonts from ./fonts directory"
    exit 1
fi

# Copy fonts
echo "Installing fonts to $FONT_DIR..."
cp fonts/HackNerdFont*.ttf "$FONT_DIR/"

# Refresh font cache on Linux
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    fc-cache -f -v
fi

echo "✅ Font installation complete!"
echo ""
echo "⚠️  IMPORTANT: You must configure your terminal to use 'Hack Nerd Font' or 'Hack Nerd Font Mono'"
echo ""
echo "Terminal configuration:"
echo "  - iTerm2: Preferences → Profiles → Text → Font"
echo "  - Terminal.app: Preferences → Profiles → Text → Font"
echo "  - VS Code Terminal: Settings → Terminal › Integrated: Font Family → 'Hack Nerd Font Mono'"
echo "  - Alacritty: Edit config file, set font.family to 'Hack Nerd Font'"
echo ""
echo "After configuring your terminal, run: ./mock_data.sh"