#!/bin/bash
echo ""
echo "========================================"
echo "   POS SYSTEM - COMPLETE SETUP"
echo "========================================"
echo ""
echo "This will install and start your POS system."
echo ""

# Check if this is first time installation
if [ ! -d "node_modules" ]; then
    echo "First time installation detected..."
    echo "Running installation..."
    ./first-time-install.sh
    if [ $? -ne 0 ]; then
        echo "Installation failed!"
        read -p "Press Enter to continue..."
        exit 1
    fi
    echo ""
    echo "Installation complete! Starting POS system..."
    echo ""
else
    echo "POS system already installed."
    echo "Starting system..."
    echo ""
fi

# Start the POS system
./start-pos.sh
