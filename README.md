# POS System

A production-ready, full-stack Point of Sale system built entirely with **vanilla Node.js and vanilla JavaScript** — no Express, no React, no ORM. Just the fundamentals done right.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)
![Version](https://img.shields.io/badge/version-2.1.0-orange.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

---

## Overview

This POS system was built from the ground up as a learning project to deeply understand how full-stack web applications work without the abstraction of frameworks. It handles real business workflows: checkout, inventory management, sales reporting, receipt printing, and automated database backups.

The stack is intentionally minimal — `sqlite3` is the only runtime dependency.

---

## Features

### Point of Sale
- Product search by name, SKU, or barcode
- Barcode scanner support (auto-detects 8–13 digit numeric input)
- Shopping cart with quantity controls and real-time stock validation
- Cash and card payment methods
- Receipt generation with print, preview, and fallback methods
- Tax rate configurable per store

### Inventory Management
- Full CRUD for products (name, SKU, barcode, price, stock quantity)
- EAN-13 barcode generator with check-digit calculation
- Low stock threshold alerts with visual indicators
- Stock automatically decremented on each completed sale
- In Stock / Low Stock / Out of Stock filters and sorting

### Sales & Reporting
- Sales history with date filtering
- Daily revenue, order count, and average sale summary cards
- Clickable rows to view full order receipts
- Reports page: Daily, Product Performance, and Inventory reports
- Export reports to print or PDF via browser print dialog

### Backup System
- Manual and automatic scheduled database backups (SQLite file copy)
- 30-day retention policy with auto-cleanup on startup
- Backup management UI to list, download, and delete backups
- Start/stop backup scheduler via API

### Settings
- Dark mode (persisted to localStorage)
- Configurable tax rate, currency symbol, low stock threshold
- Store name and address for receipts
- Date/time format (12h / 24h)
- Auto-refresh intervals

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (v16+) |
| Server | Raw `http` module — no Express |
| Database | SQLite via `sqlite3` |
| Frontend | Vanilla HTML5 + CSS3 + JavaScript (ES6+) |
| Icons | Font Awesome 6.4.0 (CDN) |
| Charts | Chart.js (CDN) |
| Persistence | SQLite file + localStorage for settings |

---

## Project Structure

```
pos-system/
├── pos-system.js          # HTTP server — routing, API handlers, security
├── pos_database.db        # SQLite database (auto-created on first run)
├── package.json
├── .gitignore
├── frontend/
│   ├── index.html         # Main POS interface (SPA)
│   ├── app.js             # All frontend logic (~2,000 lines)
│   ├── styles.css         # All styles including dark mode (~3,000 lines)
│   ├── reports.html       # Reports & analytics page
│   └── backup.html        # Backup management page
├── backups/               # Database backups (auto-created)
├── START-POS.command      # macOS one-click launcher
├── START-POS.bat          # Windows one-click launcher
├── STOP-POS.command       # macOS stop script
├── STOP-POS.bat           # Windows stop script
└── SAFARI-FIX.md          # Safari HTTPS-only workaround note
```

---

## Getting Started

### Requirements
- **Node.js** v16.0.0 or higher ([nodejs.org](https://nodejs.org))
- **npm** v8.0.0 or higher

### Install & Run

```bash
# Clone the repository
git clone https://github.com/seifosmaan53/pos-system.git
cd pos-system

# Install the single dependency
npm install

# Start the server
npm start
```

Then open **http://localhost:8080** in your browser.

### One-Click Launch (no terminal needed)

| Platform | Script |
|---|---|
| macOS | Double-click `START-POS.command` |
| Windows | Double-click `START-POS.bat` |

The scripts install dependencies automatically, kill any process already on port 8080, start the server in the background, and open the browser.

### Stop the server

```bash
npm run stop
# or macOS: double-click STOP-POS.command
# or Windows: double-click STOP-POS.bat
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Main POS UI |
| `GET` | `/reports.html` | Reports page |
| `GET` | `/backup.html` | Backup management page |
| `GET` | `/api/products` | List all products |
| `POST` | `/api/products` | Create a product |
| `PUT` | `/api/products?id=N` | Update a product |
| `DELETE` | `/api/products?id=N` | Delete a product |
| `GET` | `/api/sales` | List sales (optional `?date=YYYY-MM-DD`) |
| `POST` | `/api/sales` | Create a sale (decrements stock) |
| `GET` | `/api/sales/count` | Aggregate stats (optional `?date=YYYY-MM-DD`) |
| `GET` | `/order/:id` | Full order details for receipt |
| `GET` | `/api/health` | Health check + uptime + memory |
| `POST` | `/api/backup/create` | Create a database backup |
| `GET` | `/api/backup/list` | List all backup files |
| `GET` | `/api/backup/status` | Backup scheduler status |
| `POST` | `/api/backup/start` | Start automatic backup scheduler |
| `POST` | `/api/backup/stop` | Stop backup scheduler |
| `POST` | `/api/backup/cleanup` | Delete backups older than 30 days |
| `GET` | `/backups/:filename` | Download a backup file |

---

## Database Schema

```sql
CREATE TABLE products (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT    NOT NULL,
    sku            TEXT    UNIQUE NOT NULL,
    barcode        TEXT    UNIQUE,
    price          REAL    NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    created_at     DATETIME DEFAULT (datetime('now', 'localtime')),
    updated_at     DATETIME DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE sales (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id TEXT    NOT NULL,
    product_id     INTEGER,
    quantity       INTEGER NOT NULL,
    price          REAL    NOT NULL,
    payment_method TEXT    DEFAULT 'cash',
    created_at     DATETIME DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (product_id) REFERENCES products(id)
);
```

---

## Security

The server implements security hardening without any third-party middleware:

| Threat | Defense |
|---|---|
| SQL Injection | Parameterized queries (`?` placeholders) on every query |
| XSS | Input sanitization (strip `<script>`, `javascript:`, event handlers) + `escapeHtml()` on all rendered data |
| Directory Traversal | `path.normalize()` + boundary check before serving any file |
| Rate Limiting | 60 requests/minute per IP using an in-memory map with automatic stale-entry eviction |
| Clickjacking | `X-Frame-Options: DENY` |
| MIME Sniffing | `X-Content-Type-Options: nosniff` |
| CSP | `Content-Security-Policy` restricting script/style/font sources |
| Oversized Payloads | 1MB request body limit |
| Slow Requests | 30-second body read timeout, 2-minute server timeout |
| CORS | Restricted to `localhost:8080` only |

---

## Skills & Concepts Demonstrated

### Backend
- **Raw HTTP server** using Node.js `http` module — manual URL parsing, routing, content-type handling, and response codes
- **Async/await with SQLite** — wrapping callback-based `sqlite3` in Promises for clean async flow
- **Database migrations** — `ALTER TABLE` with graceful error handling for existing columns
- **File I/O** — serving static assets, copying database files for backups, streaming binary files for download
- **Graceful shutdown** — `SIGINT`/`SIGTERM` handlers that close DB and server before exiting
- **Security headers** — manually setting CSP, X-Frame-Options, Referrer-Policy, and CORS headers
- **Rate limiting** — sliding-window algorithm implemented from scratch with memory-efficient cleanup

### Frontend
- **Single-page app without a framework** — screen switching, modals, form handling, and state management all in plain JS
- **Class-based architecture** — `POSSystem` class encapsulates all state and methods
- **localStorage** — persisting user settings across sessions
- **Barcode detection** — heuristic to distinguish barcode scanner input (fast numeric paste) from typed search
- **EAN-13 generation** — correct check-digit algorithm using the Luhn-variant formula
- **Multi-method print fallback** — `window.open` → hidden `<iframe>` → inline modal overlay
- **XSS prevention** — `escapeHtml()` via `document.createElement` (browser-native escaping, no regex)

### General
- **Zero-framework constraint** — understanding what frameworks actually do by doing it manually
- **Cross-platform scripting** — `.command` (macOS) and `.bat` (Windows) launch scripts that handle port conflicts
- **SQLite for local-first apps** — appropriate database choice for single-machine retail software

---

## npm Scripts

```bash
npm start           # Start the server
npm run stop        # Kill the server process (macOS/Linux)
npm run health      # Quick health check (server must be running)
npm run backup      # Trigger a manual database backup
npm run cleanup     # Delete backups older than 30 days
npm run security-audit  # Run npm audit
```

---

## Configuration

The server reads `process.env.PORT` for the port (defaults to `8080`). All other configuration is stored in the browser's `localStorage` under the key `pos_settings`.

To run on a different port:

```bash
PORT=3000 npm start
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Port 8080 already in use | Run `npx kill-port 8080` or use the STOP scripts |
| Database locked error | Stop all running instances, then restart |
| Print dialog not appearing | Allow pop-ups for `localhost` in your browser settings |
| Backup creation fails | Check available disk space |
| Safari: fetch fails | Use Chrome, Firefox, or Edge (see SAFARI-FIX.md) |

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

Built by **Seif Osman**
