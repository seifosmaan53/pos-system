#!/bin/bash
echo ""
echo "========================================"
echo "   POS SYSTEM - SYSTEM TEST"
echo "========================================"
echo ""
echo "Testing system components..."
echo ""

# Test Node.js
echo "Testing Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found - Please install Node.js first"
    echo "Download from: https://nodejs.org/"
    read -p "Press Enter to continue..."
    exit 1
else
    echo "✓ Node.js is installed"
fi

# Test dependencies
echo "Testing dependencies..."
if [ ! -d "node_modules" ]; then
    echo "❌ Dependencies not installed - Run installation first"
    read -p "Press Enter to continue..."
    exit 1
else
    echo "✓ Dependencies installed"
fi

# Test main files
echo "Testing main files..."
if [ ! -f "pos-system.js" ]; then
    echo "❌ Main server file missing"
    read -p "Press Enter to continue..."
    exit 1
else
    echo "✓ Main server file found"
fi

if [ ! -f "frontend/index.html" ]; then
    echo "❌ Frontend files missing"
    read -p "Press Enter to continue..."
    exit 1
else
    echo "✓ Frontend files found"
fi

# Test server startup
echo "Testing server startup..."
echo "Starting server for 5 seconds..."
node pos-system.js &
SERVER_PID=$!
sleep 3

# Test if server is running
if curl -s http://localhost:8080/api/health > /dev/null 2>&1; then
    echo "✓ Server is running and responding"
else
    echo "❌ Server not responding"
fi

# Stop server
kill $SERVER_PID 2>/dev/null

echo ""
echo "========================================"
echo "   TEST COMPLETE"
echo "========================================"
echo ""
echo "If all tests passed, your system is ready!"
echo "Run ./install-and-start.sh to begin."
echo ""
read -p "Press Enter to continue..."
