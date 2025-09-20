#!/bin/bash

# POS System - First Time Installation (macOS/Linux)
echo ""
echo "========================================"
echo "   POS SYSTEM - FIRST TIME INSTALL"
echo "========================================"
echo ""
echo "This will install and configure your POS system."
echo "Please wait while we set everything up..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed!"
    echo ""
    echo "Please download and install Node.js from:"
    echo "https://nodejs.org/"
    echo ""
    echo "After installing Node.js, run this script again."
    echo ""
    read -p "Press Enter to continue..."
    exit 1
fi

echo "✓ Node.js is installed"
echo ""

# Install dependencies
echo "Installing POS system dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install dependencies!"
    echo "Please check your internet connection and try again."
    read -p "Press Enter to continue..."
    exit 1
fi

echo "✓ Dependencies installed successfully"
echo ""

# Create necessary directories
mkdir -p backups
mkdir -p logs

echo "✓ System directories created"
echo ""

# Create startup script
echo "Creating startup script..."
cat > start-pos.sh << 'EOF'
#!/bin/bash
echo ""
echo "========================================"
echo "   POS SYSTEM - STARTING UP"
echo "========================================"
echo ""
echo "Starting POS system..."
echo "Open your browser to: http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop the system"
echo ""
node pos-system.js
EOF

chmod +x start-pos.sh

echo "✓ Startup script created"
echo ""

# Create desktop shortcut (if possible)
if [ -d "$HOME/Desktop" ]; then
    echo "[Desktop Entry]" > "$HOME/Desktop/POS System.desktop"
    echo "Name=POS System" >> "$HOME/Desktop/POS System.desktop"
    echo "Comment=Point of Sale System" >> "$HOME/Desktop/POS System.desktop"
    echo "Exec=firefox http://localhost:8080" >> "$HOME/Desktop/POS System.desktop"
    echo "Icon=applications-office" >> "$HOME/Desktop/POS System.desktop"
    echo "Terminal=false" >> "$HOME/Desktop/POS System.desktop"
    echo "Type=Application" >> "$HOME/Desktop/POS System.desktop"
    chmod +x "$HOME/Desktop/POS System.desktop"
    echo "✓ Desktop shortcut created"
    echo ""
fi

echo "========================================"
echo "   INSTALLATION COMPLETE!"
echo "========================================"
echo ""
echo "Your POS system is ready to use!"
echo ""
echo "To start the system:"
echo "1. Run: ./start-pos.sh"
echo "2. Or double-click the desktop shortcut"
echo ""
echo "The system will open in your browser at:"
echo "http://localhost:8080"
echo ""
echo "Default login: No password required"
echo ""
echo "========================================"
echo ""
read -p "Press Enter to continue..."
