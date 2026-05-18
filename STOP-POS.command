#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "========================================"
echo "   🛑 STOP POS SYSTEM"
echo "========================================"
echo ""

# Check if PID file exists
if [ -f "pos-system.pid" ]; then
    PID=$(cat pos-system.pid)
    echo "🔍 Found PID file: $PID"
    
    if kill -0 $PID 2>/dev/null; then
        echo "🛑 Stopping POS System (PID: $PID)..."
        kill $PID
        sleep 2
        
        if kill -0 $PID 2>/dev/null; then
            echo "⚠️ Gentle stop failed, forcing stop..."
            kill -9 $PID 2>/dev/null
        fi
        
        rm -f pos-system.pid
        echo "✅ POS System stopped successfully!"
    else
        echo "ℹ️ Process not running, cleaning up PID file"
        rm -f pos-system.pid
    fi
else
    echo "🔍 No PID file found, checking port..."
    
    # Fallback: Check if POS system is running on port
    if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null ; then
        echo "🛑 Stopping POS System..."
        pkill -f "node pos-system.js"
        sleep 2
        
        # Check if it's stopped
        if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null ; then
            echo "❌ Failed to stop POS System"
            echo "   Try restarting your computer"
        else
            echo "✅ POS System stopped successfully!"
        fi
    else
        echo "ℹ️  POS System is not running"
    fi
fi

echo ""
read -p "Press Enter to continue..."
