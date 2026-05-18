# Testing Windows Startup Script

## How to Test START-POS.bat on Windows

### Prerequisites
1. **Windows 10/11** (or Windows 7+)
2. **Node.js installed** - Download from https://nodejs.org
3. **Command Prompt or PowerShell** access

### Testing Steps

#### Option 1: Double-Click Method (Easiest)
1. Navigate to the POS system folder
2. Double-click `START-POS.bat`
3. A command window will open showing the startup process
4. Browser should open automatically to http://localhost:8080

#### Option 2: Command Line Method (For Testing)
1. Open **Command Prompt** or **PowerShell**
2. Navigate to the POS system directory:
   ```cmd
   cd C:\path\to\pos-system
   ```
3. Run the script:
   ```cmd
   START-POS.bat
   ```

### What You Should See

The script should display:
```
========================================
   POS SYSTEM - ONE-CLICK LAUNCHER
========================================

Working directory: C:\path\to\pos-system

Node.js found

Dependencies already installed

Starting POS Server...

POS System will open automatically in your browser
URL: http://localhost:8080

Press Ctrl+C to stop the server

Starting server in persistent mode...
Opening POS System in browser...

SUCCESS! POS System is now running persistently!
Browser should open automatically to: http://localhost:8080

PERSISTENT MODE: Server will stay running even if you close this window
Server logs: pos-system.log
Process ID: [PID] (saved in pos-system.pid)

Access your POS at: http://localhost:8080
Reports at: http://localhost:8080/reports.html
Backups at: http://localhost:8080/backup.html

To stop the server: Double-click STOP-POS.bat
To restart: Double-click START-POS.bat again

You can safely close this window - server will keep running!
```

### Testing STOP-POS.bat

1. Double-click `STOP-POS.bat` or run from command line
2. Should display:
   ```
   ========================================
      STOP POS SYSTEM
   ========================================
   
   Found PID file: [PID]
   Stopping POS System (PID: [PID])...
   POS System stopped successfully!
   ```

### Verifying It Works the Same as Mac

Both Windows and Mac versions should:
- ✅ Check for Node.js
- ✅ Install dependencies if needed
- ✅ Check if port 8080 is in use
- ✅ Stop existing processes if port is busy
- ✅ Start server in background (persistent mode)
- ✅ Save PID to `pos-system.pid` file
- ✅ Open browser automatically
- ✅ Create `pos-system.log` for server logs
- ✅ Allow closing the window while server keeps running

### Differences (Platform-Specific)

| Feature | Mac (.command) | Windows (.bat) |
|---------|---------------|----------------|
| Background Process | `nohup` | `start /b` |
| Process Detection | `lsof` | `netstat` / `tasklist` |
| Kill Process | `kill` / `pkill` | `taskkill` |
| Browser Opening | `open -a` | `start` |
| File Paths | Unix-style | Windows-style |

### Troubleshooting

**Issue: "Node.js not found"**
- Install Node.js from https://nodejs.org
- Restart Command Prompt after installation

**Issue: Port already in use**
- Run `STOP-POS.bat` first
- Or manually: `taskkill /F /IM node.exe`

**Issue: Browser doesn't open**
- Manually open: http://localhost:8080
- Check firewall settings

**Issue: Script closes immediately**
- Check `pos-system.log` for errors
- Make sure Node.js is in your PATH

### Testing Checklist

- [ ] Script runs without errors
- [ ] Node.js is detected
- [ ] Dependencies install correctly (if needed)
- [ ] Server starts successfully
- [ ] Browser opens automatically
- [ ] POS system loads at http://localhost:8080
- [ ] PID file is created (`pos-system.pid`)
- [ ] Log file is created (`pos-system.log`)
- [ ] Server continues running after closing window
- [ ] STOP-POS.bat successfully stops the server

