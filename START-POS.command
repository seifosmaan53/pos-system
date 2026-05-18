#!/bin/bash

# Function to open browser (avoids Safari HTTPS-Only issue)
open_browser() {
    local url=$1
    
    # Try Chrome first (most common, no HTTPS-Only restriction)
    if [ -d "/Applications/Google Chrome.app" ]; then
        open -a "Google Chrome" "$url"
        return 0
    fi
    
    # Try Edge (no HTTPS-Only restriction)
    if [ -d "/Applications/Microsoft Edge.app" ]; then
        open -a "Microsoft Edge" "$url"
        return 0
    fi
    
    # Try Firefox
    if [ -d "/Applications/Firefox.app" ]; then
        open -a "Firefox" "$url"
        return 0
    fi
    
    # Fallback to default browser
    open "$url"
}

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "========================================"
echo "   🚀 POS SYSTEM - ONE-CLICK LAUNCHER"
echo "========================================"
echo ""
echo "📁 Working directory: $SCRIPT_DIR"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found! Please install Node.js first."
    echo "   Download from: https://nodejs.org"
    echo ""
    read -p "Press Enter to continue..."
    exit 1
fi

echo "✅ Node.js found"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
else
    echo "✅ Dependencies already installed"
    echo ""
fi

echo "🚀 Starting POS Server..."
echo ""
echo "🌐 POS System will open automatically in your browser"
echo "📍 URL: http://localhost:8080"
echo ""
echo "🛑 Press Ctrl+C to stop the server"
echo ""

# Check if port 8080 is already in use
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port 8080 is already in use!"
    echo "🛑 Stopping existing processes..."
    pkill -f "node pos-system.js" 2>/dev/null || true
    sleep 2
    
    # Check again after stopping
    if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo "❌ Could not free port 8080"
        echo "🌐 Opening existing POS System in browser..."
        open_browser "http://localhost:8080"
        echo ""
        echo "✅ POS System is already running!"
        echo "📱 Go to http://localhost:8080 to use it"
        echo ""
        read -p "Press Enter to continue..."
        exit 0
    else
        echo "✅ Port 8080 is now available"
    fi
fi

# Start the server in background (persistent mode)
echo "🌐 Starting server in persistent mode..."
nohup node pos-system.js > pos-system.log 2>&1 &
SERVER_PID=$!

# Save PID for later reference
echo $SERVER_PID > pos-system.pid

# Wait for server to start
sleep 3

# Check if server started successfully
if kill -0 $SERVER_PID 2>/dev/null; then
    # Open browser automatically
    echo "🌐 Opening POS System in browser..."
    open_browser "http://localhost:8080"
    
    echo ""
    echo "🎉 SUCCESS! POS System is now running persistently!"
    echo "📱 Browser should open automatically to: http://localhost:8080"
    echo ""
    echo "✅ PERSISTENT MODE: Server will stay running even if you close this window"
    echo "📝 Server logs: pos-system.log"
    echo "🆔 Process ID: $SERVER_PID (saved in pos-system.pid)"
    echo ""
    echo "🌐 Access your POS at: http://localhost:8080"
    echo "📊 Reports at: http://localhost:8080/reports.html"
    echo "💾 Backups at: http://localhost:8080/backup.html"
    echo ""
    echo "🛑 To stop the server: Double-click STOP-POS.command"
    echo "🔄 To restart: Double-click START-POS.command again"
    echo ""
    echo "💡 You can safely close this window - server will keep running!"
    echo ""
    
    read -p "Press Enter to close this window (server continues running)..."
else
    echo "❌ Failed to start POS System!"
    echo "📱 Please check for errors above."
    echo ""
    read -p "Press Enter to continue..."
    exit 1
fi
