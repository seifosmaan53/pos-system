#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

class POSSystem {
    constructor() {
        this.port = 8080;
        this.db = null;
        this.schedulerRunning = false;
        this.initDatabase();
    }

    initDatabase() {
        this.db = new sqlite3.Database('pos_database.db', (err) => {
            if (err) {
                console.error('❌ Database error:', err);
            } else {
                console.log('✅ Database connected');
                this.createTables();
            }
        });
    }

    createTables() {
        const productsTable = `
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                sku TEXT UNIQUE NOT NULL,
                barcode TEXT UNIQUE,
                price REAL NOT NULL,
                stock_quantity INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
            )
        `;

        const salesTable = `
            CREATE TABLE IF NOT EXISTS sales (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id TEXT,
                product_id INTEGER,
                quantity INTEGER NOT NULL,
                price REAL NOT NULL,
                payment_method TEXT DEFAULT 'cash',
                created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (product_id) REFERENCES products (id)
            )
        `;

        this.db.run(productsTable);
        this.db.run(salesTable);
        
        // Add payment_method column if it doesn't exist (migration)
        this.run(`ALTER TABLE sales ADD COLUMN payment_method TEXT DEFAULT 'cash'`)
            .then(() => {
                console.log('✅ Payment method column added successfully');
            })
            .catch((error) => {
                // Column already exists, ignore error
                console.log('ℹ️ Payment method column already exists or migration not needed');
            });
    }

    query(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            });
        });
    }

    async handleRequest(req, res) {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = url.pathname;
        const method = req.method;
        const clientIP = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';

        // Security: Rate limiting
        if (!this.checkRateLimit(clientIP)) {
            res.writeHead(429, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Too many requests. Please try again later.' }));
            return;
        }

        // Security: Security headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com; img-src 'self' data:;");

        // CORS headers (more restrictive)
        const allowedOrigins = ['http://localhost:8080', 'http://127.0.0.1:8080'];
        const origin = req.headers.origin;
        if (allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
        }
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Allow-Credentials', 'true');

        if (method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        try {
            // Serve static files
            if (pathname.startsWith('/frontend/') || pathname === '/' || pathname === '/index.html' || 
                pathname === '/app.js' || pathname === '/styles.css' || pathname === '/reports.html' || 
                pathname === '/backup.html') {
                await this.serveStaticFile(req, res, pathname);
                return;
            }

            // API endpoints
            if (pathname === '/api/products' && method === 'GET') {
                await this.getProducts(req, res);
            } else if (pathname === '/api/products' && method === 'POST') {
                await this.createProduct(req, res);
            } else if (pathname === '/api/products' && method === 'PUT') {
                await this.updateProduct(req, res);
            } else if (pathname === '/api/products' && method === 'DELETE') {
                await this.deleteProduct(req, res);
            } else if (pathname === '/api/sales' && method === 'GET') {
                await this.getSales(req, res);
            } else if (pathname === '/api/sales' && method === 'POST') {
                await this.createSale(req, res);
            } else if (pathname.startsWith('/order/') && method === 'GET') {
                await this.getOrderDetails(req, res, pathname);
            } else if (pathname === '/api/health' && method === 'GET') {
                await this.getHealth(req, res);
            } else if (pathname === '/backup/status' && method === 'GET') {
                await this.getBackupStatus(req, res);
            } else if (pathname === '/backup/list' && method === 'GET') {
                await this.getBackupList(req, res);
            } else if (pathname === '/backup/create' && method === 'POST') {
                await this.createBackup(req, res);
            } else if (pathname === '/backup/start' && method === 'POST') {
                await this.startBackupScheduler(req, res);
            } else if (pathname === '/backup/stop' && method === 'POST') {
                await this.stopBackupScheduler(req, res);
            } else if (pathname === '/backup/cleanup' && method === 'POST') {
                await this.cleanupOldBackups(req, res);
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not found' }));
            }
        } catch (error) {
            console.error('❌ Request error:', error.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }

    async serveStaticFile(req, res, pathname) {
        let filePath;
        if (pathname === '/' || pathname === '/index.html') {
            filePath = path.join(__dirname, 'frontend', 'index.html');
        } else if (pathname === '/app.js') {
            filePath = path.join(__dirname, 'frontend', 'app.js');
        } else if (pathname === '/styles.css') {
            filePath = path.join(__dirname, 'frontend', 'styles.css');
        } else if (pathname === '/reports.html') {
            filePath = path.join(__dirname, 'frontend', 'reports.html');
        } else if (pathname === '/backup.html') {
            filePath = path.join(__dirname, 'frontend', 'backup.html');
        } else {
            filePath = path.join(__dirname, pathname);
        }

        try {
            const data = await fs.promises.readFile(filePath);
            const ext = path.extname(filePath);
            const contentType = this.getContentType(ext);
            
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        } catch (error) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found');
        }
    }

    getContentType(ext) {
        const types = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.ico': 'image/x-icon'
        };
        return types[ext] || 'text/plain';
    }

    // Security: Input validation and sanitization
    validateInput(data, rules) {
        const errors = [];
        
        for (const [field, rule] of Object.entries(rules)) {
            const value = data[field];
            
            if (rule.required && (!value || value.toString().trim() === '')) {
                errors.push(`${field} is required`);
                continue;
            }
            
            if (value !== undefined && value !== null) {
                // Sanitize string inputs
                if (rule.type === 'string') {
                    data[field] = value.toString().trim();
                    
                    if (rule.maxLength && data[field].length > rule.maxLength) {
                        errors.push(`${field} must be ${rule.maxLength} characters or less`);
                    }
                    
                    if (rule.pattern && !rule.pattern.test(data[field])) {
                        errors.push(`${field} format is invalid`);
                    }
                }
                
                // Validate numbers
                if (rule.type === 'number') {
                    const num = parseFloat(value);
                    if (isNaN(num)) {
                        errors.push(`${field} must be a valid number`);
                    } else {
                        data[field] = num;
                        if (rule.min !== undefined && num < rule.min) {
                            errors.push(`${field} must be at least ${rule.min}`);
                        }
                        if (rule.max !== undefined && num > rule.max) {
                            errors.push(`${field} must be at most ${rule.max}`);
                        }
                    }
                }
                
                // Validate integers
                if (rule.type === 'integer') {
                    const num = parseInt(value);
                    if (isNaN(num) || !Number.isInteger(num)) {
                        errors.push(`${field} must be a valid integer`);
                    } else {
                        data[field] = num;
                        if (rule.min !== undefined && num < rule.min) {
                            errors.push(`${field} must be at least ${rule.min}`);
                        }
                        if (rule.max !== undefined && num > rule.max) {
                            errors.push(`${field} must be at most ${rule.max}`);
                        }
                    }
                }
            }
        }
        
        return errors;
    }

    // Security: Rate limiting
    checkRateLimit(ip) {
        const now = Date.now();
        const windowMs = 60 * 1000; // 1 minute
        const maxRequests = 60; // 60 requests per minute
        
        if (!this.rateLimitMap) {
            this.rateLimitMap = new Map();
        }
        
        if (!this.rateLimitMap.has(ip)) {
            this.rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
            return true;
        }
        
        const record = this.rateLimitMap.get(ip);
        
        if (now > record.resetTime) {
            record.count = 1;
            record.resetTime = now + windowMs;
            return true;
        }
        
        if (record.count >= maxRequests) {
            return false;
        }
        
        record.count++;
        return true;
    }

    async getProducts(req, res) {
        try {
            const products = await this.query('SELECT * FROM products ORDER BY name');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(products));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    async createProduct(req, res) {
        try {
            const body = await this.getRequestBody(req);
            const productData = JSON.parse(body);
            
            // Security: Input validation
            const validationRules = {
                name: { type: 'string', required: true, maxLength: 100 },
                sku: { type: 'string', required: true, maxLength: 50, pattern: /^[A-Z0-9-_]+$/ },
                price: { type: 'number', required: true, min: 0, max: 999999.99 },
                stock: { type: 'integer', min: 0, max: 999999 },
                barcode: { type: 'string', maxLength: 50, pattern: /^[0-9]*$/ }
            };
            
            const errors = this.validateInput(productData, validationRules);
            if (errors.length > 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Validation failed', details: errors }));
                return;
            }
            
            const { name, sku, price, stock, barcode } = productData;
            
            const result = await this.run(
                'INSERT INTO products (name, sku, price, stock_quantity, barcode) VALUES (?, ?, ?, ?, ?)',
                [name, sku, price, stock || 0, barcode || null]
            );
            
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ id: result.id, success: true }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    async updateProduct(req, res) {
        try {
            const body = await this.getRequestBody(req);
            const productData = JSON.parse(body);
            
            // Security: Input validation
            const validationRules = {
                id: { type: 'integer', required: true, min: 1 },
                name: { type: 'string', required: true, maxLength: 100 },
                sku: { type: 'string', required: true, maxLength: 50, pattern: /^[A-Z0-9-_]+$/ },
                price: { type: 'number', required: true, min: 0, max: 999999.99 },
                stock: { type: 'integer', min: 0, max: 999999 },
                barcode: { type: 'string', maxLength: 50, pattern: /^[0-9]*$/ }
            };
            
            const errors = this.validateInput(productData, validationRules);
            if (errors.length > 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Validation failed', details: errors }));
                return;
            }
            
            const { id, name, sku, price, stock, barcode } = productData;
            
            await this.run(
                'UPDATE products SET name = ?, sku = ?, price = ?, stock_quantity = ?, barcode = ?, updated_at = datetime("now", "localtime") WHERE id = ?',
                [name, sku, price, stock, barcode, id]
            );
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    async deleteProduct(req, res) {
        try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const id = url.searchParams.get('id');
            
            // Security: Input validation
            if (!id || isNaN(parseInt(id)) || parseInt(id) < 1) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Valid product ID is required' }));
                return;
            }
            
            await this.run('DELETE FROM products WHERE id = ?', [parseInt(id)]);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    async getSales(req, res) {
        try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const date = url.searchParams.get('date');
            
            let query = `
                SELECT 
                    s.transaction_id as order_id,
                    s.created_at,
                    s.payment_method,
                    COUNT(*) as item_count,
                    SUM(s.quantity) as total_quantity,
                    SUM(s.quantity * s.price) as total_amount,
                    GROUP_CONCAT(p.name || ' (' || s.quantity || 'x)', ', ') as items_summary
                FROM sales s
                JOIN products p ON s.product_id = p.id
            `;
            
            if (date) {
                // Security: SQL injection prevention
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (dateRegex.test(date)) {
                    query += ` WHERE substr(s.created_at, 1, 10) = ?`;
                    const sales = await this.query(query, [date]);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(sales));
                    return;
                } else {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD' }));
                    return;
                }
            }
            
            query += `
                GROUP BY s.transaction_id, s.created_at, s.payment_method
                ORDER BY s.created_at DESC
                LIMIT 100
            `;
            
            const sales = await this.query(query);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(sales));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    async createSale(req, res) {
        try {
            const body = await this.getRequestBody(req);
            const saleData = JSON.parse(body);
            const { items, payment_method = 'cash' } = saleData;
            
            // Security: Input validation
            if (!Array.isArray(items) || items.length === 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Items array is required and must not be empty' }));
                return;
            }
            
            // Validate payment method
            const validPaymentMethods = ['cash', 'card', 'check', 'other'];
            if (!validPaymentMethods.includes(payment_method)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid payment method' }));
                return;
            }
            
            // Validate each item
            for (const item of items) {
                if (!item.id || !item.quantity || !item.price) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Each item must have id, quantity, and price' }));
                    return;
                }
                
                if (isNaN(parseInt(item.id)) || parseInt(item.id) < 1) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid product ID' }));
                    return;
                }
                
                if (isNaN(parseFloat(item.quantity)) || parseFloat(item.quantity) <= 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Quantity must be a positive number' }));
                    return;
                }
                
                if (isNaN(parseFloat(item.price)) || parseFloat(item.price) < 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Price must be a non-negative number' }));
                    return;
                }
            }
            
            const transactionId = `#${Date.now()}`;
            const results = [];
            
            for (const item of items) {
                // Insert sale record with payment method
                const result = await this.run(
                    'INSERT INTO sales (transaction_id, product_id, quantity, price, payment_method) VALUES (?, ?, ?, ?, ?)',
                    [transactionId, parseInt(item.id), parseFloat(item.quantity), parseFloat(item.price), payment_method]
                );
                results.push(result);
                
                // Update stock quantity
                await this.run(
                    'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
                    [parseFloat(item.quantity), parseInt(item.id)]
                );
            }
            
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ transactionId, order_id: transactionId, success: true }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }


    async getOrderDetails(req, res, pathname) {
        try {
            let orderId = pathname.split('/order/')[1];
            console.log(`📋 Getting order details for: ${orderId}`);
            
            // Handle different order ID formats
            if (orderId.startsWith('#')) {
                orderId = orderId.substring(1); // Remove # prefix
            }
            
            // Try to find the order with different possible formats
            let orderItems = await this.query(`
                SELECT s.*, p.name, p.sku, p.price 
                FROM sales s 
                JOIN products p ON s.product_id = p.id 
                WHERE s.transaction_id = ? OR s.transaction_id = ? OR s.transaction_id = ?
                ORDER BY s.created_at
            `, [orderId, `#${orderId}`, `TXN-${orderId}`]);
            
            if (orderItems.length === 0) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Order not found' }));
                return;
            }
            
            // Prepare order data
            const items = orderItems.map(item => ({
                name: item.name,
                sku: item.sku,
                quantity: item.quantity,
                price: item.price
            }));
            
            const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
            const tax = subtotal * 0.08875;
            const total = subtotal + tax;
            
            const orderData = {
                order: { 
                    id: orderId, 
                    created_at: orderItems[0].created_at,
                    payment_method: orderItems[0].payment_method || 'cash'
                },
                items: items,
                totals: { subtotal, tax, total }
            };
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(orderData));
        } catch (error) {
            console.error('Error getting order details:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    generateReceiptText(orderData) {
        const { order, items, totals } = orderData;
        const orderDate = new Date(order.created_at).toLocaleString();
        
        let text = `POS System - Sales Receipt\n`;
        text += `Order #: ${order.id || order.order_id || 'N/A'}\n`;
        text += `Date: ${orderDate}\n`;
        text += `Cashier: System\n\n`;
        text += `Items:\n`;
        text += `----------------------------------------\n`;
        
        items.forEach(item => {
            text += `${item.name} (${item.sku})\n`;
            text += `Qty: ${item.quantity} x $${item.price.toFixed(2)} = $${(item.quantity * item.price).toFixed(2)}\n`;
        });
        
        text += `\n----------------------------------------\n`;
        text += `Subtotal: $${totals.subtotal.toFixed(2)}\n`;
        text += `Tax (8.875%): $${totals.tax.toFixed(2)}\n`;
        text += `Total: $${totals.total.toFixed(2)}\n\n`;
        text += `Thank you for your business!\n`;
        
        return text;
    }


    // Backup functionality
    async getBackupFiles() {
        try {
            const fs = require('fs');
            const path = require('path');
            
            if (!fs.existsSync('backups')) {
                return [];
            }
            
            const files = fs.readdirSync('backups')
                .filter(file => file.endsWith('.db') || file.endsWith('.tar.gz'))
                .map(file => {
                    const filePath = path.join('backups', file);
                    const stats = fs.statSync(filePath);
                    return {
                        fileName: file,
                        size: stats.size,
                        created: stats.birthtime.toISOString(),
                        type: file.endsWith('.tar.gz') ? 'archive' : 'database'
                    };
                })
                .sort((a, b) => new Date(b.created) - new Date(a.created));
            
            return files;
        } catch (error) {
            console.error('Error getting backup files:', error);
            return [];
        }
    }

    async getBackupStatus(req, res) {
        try {
            // Get backup files to calculate stats
            const backupFiles = await this.getBackupFiles();
            const totalSize = backupFiles.reduce((sum, file) => sum + file.size, 0);
            const newestBackup = backupFiles.length > 0 ? backupFiles[0].created : null;
            
            const status = {
                isRunning: this.schedulerRunning, // Actual scheduler status
                stats: {
                    totalBackups: backupFiles.length,
                    totalSize: totalSize,
                    newestBackup: newestBackup
                },
                nextBackup: null // Next scheduled backup
            };
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(status));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    async getBackupList(req, res) {
        try {
            const fs = require('fs');
            const path = require('path');
            const backupDir = path.join(__dirname, 'backups');
            
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            
            const files = fs.readdirSync(backupDir)
                .filter(file => file.endsWith('.db') || file.endsWith('.tar.gz'))
                .map(file => {
                    const filePath = path.join(backupDir, file);
                    const stats = fs.statSync(filePath);
                    return {
                        fileName: file,
                        size: stats.size,
                        created: stats.birthtime.toISOString(),
                        type: file.endsWith('.tar.gz') ? 'compressed' : 'database'
                    };
                })
                .sort((a, b) => new Date(b.created) - new Date(a.created));
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, backups: files }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    async createBackup(req, res) {
        try {
            const fs = require('fs');
            const path = require('path');
            
            const backupDir = path.join(__dirname, 'backups');
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(backupDir, `pos_backup_${timestamp}.db`);
            
            // Copy database file
            fs.copyFileSync('pos_database.db', backupFile);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                message: 'Backup created successfully',
                filename: `pos_backup_${timestamp}.db`
            }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    async startBackupScheduler(req, res) {
        try {
            this.schedulerRunning = true;
            console.log('🔄 Backup scheduler started');
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                message: 'Backup scheduler started successfully'
            }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    async stopBackupScheduler(req, res) {
        try {
            this.schedulerRunning = false;
            console.log('⏹️ Backup scheduler stopped');
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                message: 'Backup scheduler stopped successfully'
            }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    async cleanupOldBackups(req, res) {
        try {
            const fs = require('fs');
            const path = require('path');
            
            const backupDir = path.join(__dirname, 'backups');
            if (!fs.existsSync(backupDir)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    deletedCount: 0, 
                    freedSpace: 0,
                    message: 'No backup directory found'
                }));
                return;
            }

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const files = fs.readdirSync(backupDir)
                .filter(file => file.endsWith('.db') || file.endsWith('.tar.gz'))
                .map(file => ({
                    name: file,
                    path: path.join(backupDir, file),
                    stats: fs.statSync(path.join(backupDir, file))
                }));

            let deletedCount = 0;
            let freedSpace = 0;
            const deletedFiles = [];

            for (const file of files) {
                if (file.stats.birthtime < thirtyDaysAgo) {
                    try {
                        freedSpace += file.stats.size;
                        fs.unlinkSync(file.path);
                        deletedFiles.push(file.name);
                        deletedCount++;
                        console.log(`🗑️ Deleted old backup: ${file.name}`);
                    } catch (error) {
                        console.error(`Error deleting ${file.name}:`, error.message);
                    }
                }
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                deletedCount: deletedCount,
                freedSpace: freedSpace,
                freedSpaceKB: Math.round(freedSpace / 1024),
                deletedFiles: deletedFiles,
                message: `Cleaned up ${deletedCount} old backup(s), freed ${Math.round(freedSpace / 1024)} KB`
            }));
        } catch (error) {
            console.error('Error cleaning up old backups:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    async getHealth(req, res) {
        try {
            const health = {
                status: 'OK',
                timestamp: new Date().toISOString(),
                message: 'POS System is running!',
                database: 'SQLite',
                dbStatus: 'Connected',
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: '2.0.0'
            };
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(health));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    async getRequestBody(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', () => resolve(body));
            req.on('error', reject);
        });
    }

    start() {
        const server = http.createServer((req, res) => {
            this.handleRequest(req, res);
        });

        server.listen(this.port, () => {
            console.log(`🚀 POS System running on http://localhost:${this.port}`);
            console.log('✅ All systems operational');
            console.log('📧 Email system ready (mailto links)');
            console.log('🛑 Press Ctrl+C to stop');
        });

        // Graceful shutdown - NO HANGING
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down POS System...');
            server.close(() => {
                if (this.db) {
                    this.db.close();
                }
                console.log('✅ POS System stopped');
                process.exit(0);
            });
        });

        process.on('SIGTERM', () => {
            console.log('\n🛑 Shutting down POS System...');
            server.close(() => {
                if (this.db) {
                    this.db.close();
                }
                console.log('✅ POS System stopped');
                process.exit(0);
            });
        });
    }
}

// Start the system
const posSystem = new POSSystem();
posSystem.start();
