#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

class POSSystem {
    constructor() {
        this.port = process.env.PORT || 8080;  // Use env PORT if available (for Heroku/Render/Railway)
        this.db = null;
        this.schedulerRunning = false;
        this.backupInterval = null;
        this.rateLimitMap = new Map();
        // Purge stale rate-limit entries every 5 minutes to prevent memory growth
        setInterval(() => {
            const now = Date.now();
            for (const [ip, record] of this.rateLimitMap) {
                if (now > record.resetTime) this.rateLimitMap.delete(ip);
            }
        }, 5 * 60 * 1000);
        this.initDatabase();
    }

    initDatabase() {
        const dbPath = path.join(__dirname, 'pos_database.db');
        this.db = new sqlite3.Database(dbPath, (err) => {
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
                transaction_id TEXT NOT NULL,
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
            
        // Ensure transaction_id is NOT NULL (migration for existing databases)
        this.run(`UPDATE sales SET transaction_id = 'TXN_' || id || '_' || substr(created_at, 1, 10) WHERE transaction_id IS NULL`)
            .then(() => {
                console.log('✅ Transaction ID migration completed');
            })
            .catch((error) => {
                console.log('ℹ️ Transaction ID migration not needed or failed:', error.message);
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
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com; img-src 'self' data:; connect-src 'self'");
        
        // CORS (simple, consistent)
        const allowedOrigins = ['http://localhost:8080', 'http://127.0.0.1:8080'];
        const origin = req.headers.origin;
        
        if (allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
        }
        
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400');

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
            } else if (pathname === '/api/sales/count' && method === 'GET') {
                await this.getSalesCount(req, res);
            } else if (pathname.startsWith('/order/') && method === 'GET') {
                await this.getOrderDetails(req, res, pathname);
            } else if (pathname === '/api/health' && method === 'GET') {
                await this.getHealth(req, res);
            } else if (pathname === '/backup/status' && method === 'GET') {
                await this.getBackupStatus(req, res);
            } else if (pathname === '/api/backup/status' && method === 'GET') {
                await this.getBackupStatus(req, res);
            } else if (pathname === '/backup/list' && method === 'GET') {
                await this.getBackupList(req, res);
            } else if (pathname === '/api/backup/list' && method === 'GET') {
                await this.getBackupList(req, res);
            } else if (pathname === '/backup/create' && method === 'POST') {
                await this.createBackup(req, res);
            } else if (pathname === '/api/backup/create' && method === 'POST') {
                await this.createBackup(req, res);
            } else if (pathname === '/backup/start' && method === 'POST') {
                await this.startBackupScheduler(req, res);
            } else if (pathname === '/api/backup/start' && method === 'POST') {
                await this.startBackupScheduler(req, res);
            } else if (pathname === '/backup/stop' && method === 'POST') {
                await this.stopBackupScheduler(req, res);
            } else if (pathname === '/api/backup/stop' && method === 'POST') {
                await this.stopBackupScheduler(req, res);
            } else if (pathname === '/backup/cleanup' && method === 'POST') {
                await this.cleanupOldBackups(req, res);
            } else if (pathname === '/api/backup/cleanup' && method === 'POST') {
                await this.cleanupOldBackups(req, res);
            } else if (pathname.startsWith('/backups/') && method === 'GET') {
                await this.serveBackupFile(req, res, pathname);
            } else {
                // Serve custom error page for non-API requests
                if (!pathname.startsWith('/api/')) {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>Page Not Found - POS System</title>
                            <style>
                                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                                .error-container { max-width: 500px; margin: 0 auto; }
                                h1 { color: #e74c3c; }
                                a { color: #3498db; text-decoration: none; }
                                a:hover { text-decoration: underline; }
                            </style>
                        </head>
                        <body>
                            <div class="error-container">
                                <h1>404 - Page Not Found</h1>
                                <p>The page you're looking for doesn't exist.</p>
                                <a href="/">← Back to POS System</a>
                            </div>
                        </body>
                        </html>
                    `);
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Not found' }));
                }
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
            // Security: Prevent directory traversal attacks
            const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
            const fullPath = path.join(__dirname, 'frontend', safePath);
            
            // Ensure the path is within the frontend directory
            const frontendDir = path.resolve(__dirname, 'frontend');
            if (!fullPath.startsWith(frontendDir)) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Access denied' }));
                return;
            }
            
            filePath = fullPath;
        }

        try {
            const data = await fs.promises.readFile(filePath);
            const ext = path.extname(filePath);
            const contentType = this.getContentType(ext);
            const cacheHeaders = this.getCacheHeaders(ext, filePath);
            
            res.writeHead(200, { 
                'Content-Type': contentType,
                ...cacheHeaders
            });
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

    getCacheHeaders(ext, filePath) {
        // Different caching strategies for different file types
        const headers = {};
        
        try {
            const stats = fs.statSync(filePath);
            const etag = `"${stats.size}-${stats.mtime.getTime()}"`;
            headers['ETag'] = etag;
            
            // Set cache control based on file type
            if (ext === '.html') {
                headers['Cache-Control'] = 'no-cache, must-revalidate';
            } else if (ext === '.js' || ext === '.css') {
                headers['Cache-Control'] = 'no-cache, must-revalidate'; // Disable cache for development
            } else if (ext === '.png' || ext === '.jpg' || ext === '.gif' || ext === '.ico') {
                headers['Cache-Control'] = 'public, max-age=86400'; // 24 hours
            } else {
                headers['Cache-Control'] = 'public, max-age=300'; // 5 minutes default
            }
        } catch (error) {
            headers['Cache-Control'] = 'no-cache';
        }
        
        return headers;
    }

    // Security: Input validation and sanitization
    validateInput(data, rules) {
        const errors = [];
        
        for (const [field, rule] of Object.entries(rules)) {
            const value = data[field];
            
            if (rule.required && (value === undefined || value === null || (typeof value === 'string' && value.trim() === ''))) {
                errors.push(`${field} is required`);
                continue;
            }
            
            // Skip validation for null/undefined values on non-required fields
            if (value === undefined || value === null) {
                continue;
            }
            
            // Validate the value
            // Sanitize string inputs
            if (rule.type === 'string') {
                    // XSS Protection: Remove script tags and dangerous characters
                    data[field] = value.toString().trim()
                        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                        .replace(/<[^>]*>/g, '')
                        .replace(/javascript:/gi, '')
                        .replace(/on\w+\s*=/gi, '');
                    
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
        
        return errors;
    }

    // Security: Rate limiting
    checkRateLimit(ip) {
        const now = Date.now();
        const windowMs = 60 * 1000; // 1 minute
        const maxRequests = 60; // 60 requests per minute
        
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
            const productData = body;
            
            // Normalize empty strings to null for optional fields
            if (productData.barcode !== undefined && productData.barcode !== null && productData.barcode.toString().trim() === '') {
                productData.barcode = null;
            }
            
            // Ensure stock_quantity is a valid integer, default to 0
            if (productData.stock_quantity === undefined || productData.stock_quantity === null || isNaN(productData.stock_quantity)) {
                productData.stock_quantity = 0;
            } else {
                productData.stock_quantity = parseInt(productData.stock_quantity);
                if (isNaN(productData.stock_quantity)) {
                    productData.stock_quantity = 0;
                }
            }
            
            // Security: Input validation
            const validationRules = {
                name: { type: 'string', required: true, maxLength: 100 },
                sku: { type: 'string', required: true, maxLength: 50, pattern: /^[A-Za-z0-9-_.]+$/ },
                price: { type: 'number', required: true, min: 0.01, max: 999999.99 },
                stock_quantity: { type: 'integer', min: 0, max: 999999 },
                barcode: { type: 'string', maxLength: 50, pattern: /^[0-9]*$/ }
            };
            
            const errors = this.validateInput(productData, validationRules);
            if (errors.length > 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Validation failed', details: errors }));
                return;
            }
            
            const { name, sku, price, stock_quantity, barcode } = productData;
            
            const result = await this.run(
                'INSERT INTO products (name, sku, price, stock_quantity, barcode) VALUES (?, ?, ?, ?, ?)',
                [name, sku, price, stock_quantity || 0, barcode || null]
            );
            
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ id: result.id, success: true }));
        } catch (error) {
            if (error.message.includes('UNIQUE constraint failed: products.sku')) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'A product with this SKU already exists. Please use a different SKU.' }));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        }
    }

    async updateProduct(req, res) {
        try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const id = parseInt(url.searchParams.get('id'));
            
            const body = await this.getRequestBody(req);
            const productData = body;
            
            // Normalize empty strings to null for optional fields
            if (productData.barcode !== undefined && productData.barcode !== null && productData.barcode.toString().trim() === '') {
                productData.barcode = null;
            }
            if (productData.sku !== undefined && productData.sku !== null && productData.sku.toString().trim() === '') {
                productData.sku = null;
            }
            
            // Add ID to productData for validation
            productData.id = id;
            
            // Security: Input validation (SKU not required for updates)
            const validationRules = {
                id: { type: 'integer', required: true, min: 1 },
                name: { type: 'string', required: true, maxLength: 100 },
                sku: { type: 'string', maxLength: 50, pattern: /^[A-Za-z0-9-_.]*$/ },
                price: { type: 'number', required: true, min: 0.01, max: 999999.99 },
                stock_quantity: { type: 'integer', min: 0, max: 999999 },
                barcode: { type: 'string', maxLength: 50, pattern: /^[0-9]*$/ }
            };
            
            const errors = this.validateInput(productData, validationRules);
            if (errors.length > 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Validation failed', details: errors }));
                return;
            }
            
            const { name, sku, price, stock_quantity, barcode } = productData;
            
            // Build dynamic update query for optional fields
            const updateFields = ['name = ?', 'price = ?', 'stock_quantity = ?'];
            const updateValues = [name, price, stock_quantity];
            
            if (sku !== undefined && sku !== null && sku !== '') {
                updateFields.push('sku = ?');
                updateValues.push(sku);
            }
            
            if (barcode !== undefined && barcode !== null && barcode !== '') {
                updateFields.push('barcode = ?');
                updateValues.push(barcode);
            }
            
            updateValues.push(id);
            
            await this.run(
                `UPDATE products SET ${updateFields.join(', ')} WHERE id = ?`,
                updateValues
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
                // Security: SQL injection prevention with strict date validation
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (dateRegex.test(date)) {
                    // Additional validation: ensure it's a valid date
                    const dateObj = new Date(date);
                    if (isNaN(dateObj.getTime()) || dateObj.toISOString().split('T')[0] !== date) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD' }));
                        return;
                    }
                    query += `
                        WHERE substr(s.created_at, 1, 10) = ?
                        GROUP BY s.transaction_id, s.created_at, s.payment_method
                        ORDER BY s.created_at DESC
                    `;
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
                LIMIT 1000
            `;
            
            const sales = await this.query(query);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(sales));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    async getSalesCount(req, res) {
        try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const date = url.searchParams.get('date');
            
            let query = `
                SELECT 
                    COUNT(DISTINCT s.transaction_id) as total_orders,
                    COUNT(*) as total_items,
                    SUM(s.quantity * s.price) as total_revenue
                FROM sales s
            `;
            
            if (date) {
                // Security: SQL injection prevention
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (dateRegex.test(date)) {
                    query += ` WHERE substr(s.created_at, 1, 10) = ?`;
                    const counts = await this.query(query, [date]);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(counts[0] || { total_orders: 0, total_items: 0, total_revenue: 0 }));
                    return;
                } else {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD' }));
                    return;
                }
            }
            
            const counts = await this.query(query);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(counts[0] || { total_orders: 0, total_items: 0, total_revenue: 0 }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    async createSale(req, res) {
        try {
            const body = await this.getRequestBody(req);
            const saleData = body;
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
            
            // Check stock availability before processing sale
            for (const item of items) {
                const product = await this.query('SELECT stock_quantity FROM products WHERE id = ?', [parseInt(item.id)]);
                if (product.length === 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: `Product with ID ${item.id} not found` }));
                    return;
                }
                
                const availableStock = product[0].stock_quantity;
                const requestedQuantity = parseFloat(item.quantity);
                
                if (availableStock < requestedQuantity) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        error: `Insufficient stock. Available: ${availableStock}, Requested: ${requestedQuantity}` 
                    }));
                    return;
                }
            }
            
            // Generate simple sequential order number
            const orderCount = await this.query('SELECT COUNT(*) as count FROM sales');
            const nextOrderNumber = (orderCount[0].count || 0) + 1;
            const transactionId = `ORD-${nextOrderNumber.toString().padStart(3, '0')}`;
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
            // Use sale price (s.price) not product price (p.price) to preserve historical pricing
            let orderItems = await this.query(`
                SELECT 
                    s.transaction_id,
                    s.product_id,
                    s.quantity,
                    s.price AS sale_price,
                    s.created_at,
                    s.payment_method,
                    p.name,
                    p.sku
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
            
            // Prepare order data - use recorded sale price
            const items = orderItems.map(item => ({
                name: item.name,
                sku: item.sku,
                quantity: item.quantity,
                price: item.sale_price  // Use recorded sale price, not current product price
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
            const backupDir = path.join(__dirname, 'backups');
            
            if (!fs.existsSync(backupDir)) {
                return [];
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
            const backupDir = path.join(__dirname, 'backups');
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(backupDir, `pos_backup_${timestamp}.db`);
            
            // Copy database file using absolute path
            const dbPath = path.join(__dirname, 'pos_database.db');
            fs.copyFileSync(dbPath, backupFile);
            
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
            // Clear existing interval if any
            if (this.backupInterval) {
                clearInterval(this.backupInterval);
            }
            
            this.schedulerRunning = true;
            
            // Schedule automatic backups every 24 hours
            this.backupInterval = setInterval(() => {
                // Create backup without req/res (internal call)
                this.createBackup(
                    {}, // fake req
                    { 
                        writeHead: () => {},
                        end: () => {}
                    }
                ).catch(err => {
                    console.error('Error in scheduled backup:', err);
                });
            }, 24 * 60 * 60 * 1000); // 24 hours
            
            console.log('🔄 Backup scheduler started (automatic backups every 24 hours)');
            
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
            // Clear the interval if it exists
            if (this.backupInterval) {
                clearInterval(this.backupInterval);
                this.backupInterval = null;
            }
            
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

    async serveBackupFile(req, res, pathname) {
        try {
            const fileName = pathname.replace('/backups/', '');
            const backupDir = path.join(__dirname, 'backups');
            const filePath = path.join(backupDir, fileName);
            
            // Security: Prevent directory traversal
            const normalizedPath = path.normalize(filePath);
            if (!normalizedPath.startsWith(backupDir)) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Access denied' }));
                return;
            }
            
            if (!fs.existsSync(filePath)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Backup file not found' }));
                return;
            }
            
            const data = await fs.promises.readFile(filePath);
            const ext = path.extname(fileName);
            const contentType = ext === '.db' ? 'application/octet-stream' : 'application/gzip';
            
            res.writeHead(200, {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Content-Length': data.length
            });
            res.end(data);
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    async getHealth(req, res) {
        try {
            // Check database connection
            const dbConnected = this.db !== null;
            
            const health = {
                status: dbConnected ? 'OK' : 'Degraded',
                timestamp: new Date().toISOString(),
                message: dbConnected ? 'POS System is running!' : 'Database connection issue',
                database: 'SQLite',
                dbStatus: dbConnected ? 'Connected' : 'Disconnected',
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: '2.1.0'
            };
            
            const statusCode = dbConnected ? 200 : 503;
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(health));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                status: 'ERROR',
                message: 'Health check failed',
                error: error.message 
            }));
        }
    }

    // Auto-cleanup on startup (silent)
    async cleanupOldBackupsOnStartup() {
        try {
            const fs = require('fs');
            const backupDir = path.join(__dirname, 'backups');
            
            if (!fs.existsSync(backupDir)) {
                return;
            }

            const files = fs.readdirSync(backupDir);
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            let deletedCount = 0;

            for (const file of files) {
                if (file.endsWith('.db')) {
                    const filePath = path.join(backupDir, file);
                    const stats = fs.statSync(filePath);
                    
                    if (stats.mtime.getTime() < thirtyDaysAgo) {
                        fs.unlinkSync(filePath);
                        deletedCount++;
                    }
                }
            }

            if (deletedCount > 0) {
                console.log(`🗑️ Cleaned up ${deletedCount} old backup(s)`);
            }
        } catch (error) {
            // Silent cleanup - don't show errors on startup
        }
    }

    async getRequestBody(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            let totalSize = 0;
            const maxSize = 1024 * 1024; // 1MB limit
            
            req.on('data', chunk => {
                totalSize += chunk.length;
                if (totalSize > maxSize) {
                    reject(new Error('Request body too large'));
                    return;
                }
                body += chunk.toString();
            });
            
            req.on('end', () => {
                try {
                    // Try to parse as JSON if content-type is application/json
                    const contentType = req.headers['content-type'] || '';
                    if (contentType.includes('application/json') && body) {
                        try {
                            resolve(JSON.parse(body));
                        } catch (parseError) {
                            // If JSON parsing fails, return the raw body
                            resolve(body);
                        }
                    } else {
                        resolve(body);
                    }
                } catch (error) {
                    reject(error);
                }
            });
            
            req.on('error', reject);
            
            // Set timeout for request body
            const timeout = setTimeout(() => {
                reject(new Error('Request timeout'));
            }, 30000); // 30 seconds
            
            req.on('end', () => clearTimeout(timeout));
            req.on('error', () => clearTimeout(timeout));
        });
    }

    start() {
        const server = http.createServer((req, res) => {
            this.handleRequest(req, res);
        });

        // Set server timeouts
        server.timeout = 120000; // 2 minutes
        server.keepAliveTimeout = 65000; // 65 seconds
        server.headersTimeout = 66000; // 66 seconds

        server.listen(this.port, () => {
            console.log(`🚀 POS System running on http://localhost:${this.port}`);
            console.log('✅ All systems operational');
            console.log('📧 Email system ready (mailto links)');
            console.log('🛑 Press Ctrl+C to stop');
            
            // Auto-cleanup old backups on startup
            this.cleanupOldBackupsOnStartup();
        });

        // Handle server errors
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`❌ Port ${this.port} is already in use!`);
                console.log('🛑 To fix this:');
                console.log('   1. Stop any running POS instances');
                console.log('   2. Or use a different port');
                console.log('   3. Run: pkill -f "node pos-system.js"');
                process.exit(1);
            } else {
                console.log('❌ Server error:', err.message);
                process.exit(1);
            }
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
