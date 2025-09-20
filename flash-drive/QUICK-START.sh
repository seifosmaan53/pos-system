#!/bin/bash
echo ""
echo "========================================"
echo "   POS SYSTEM - QUICK START"
echo "========================================"
echo ""
echo "This is the ONE file you need to run!"
echo "It will install and start everything."
echo ""
read -p "Press Enter to begin..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo ""
    echo "Node.js is not installed."
    echo "Please install Node.js from: https://nodejs.org/"
    echo ""
    echo "After installing Node.js, run this file again."
    echo ""
    read -p "Press Enter to continue..."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Create directories
mkdir -p backups
mkdir -p logs

# Start the system
echo ""
echo "Starting POS System..."
echo "Opening browser..."
echo ""
open http://localhost:8080 2>/dev/null || xdg-open http://localhost:8080 2>/dev/null || echo "Please open http://localhost:8080 in your browser"
node pos-system.js
