// POS System - Frontend JavaScript
class POSSystem {
    constructor() {
        this.cart = [];
        this.products = [];
        this.sales = [];
        this.currentScreen = 'pos';
        this.editingProduct = null;
        this.settings = this.loadSettings();
        this.taxRate = parseFloat(this.settings.taxRate) || 8.875;
        this.currencySymbol = this.settings.currencySymbol || '$';
        this.lowStockThreshold = parseInt(this.settings.lowStockThreshold) || 5;
        this.dateFormat = this.settings.dateFormat || 'MM/DD/YYYY';
        this.timeFormat = this.settings.timeFormat || '12';
        this.itemsPerPage = parseInt(this.settings.itemsPerPage) || 50;
        this.storeName = this.settings.storeName || '';
        this.storeAddress = this.settings.storeAddress || '';
        this.receiptFooter = this.settings.receiptFooter || '';
        this.autoPrint = this.settings.autoPrint || false;
        this.soundEnabled = this.settings.soundEnabled || false;
        this.desktopNotifications = this.settings.desktopNotifications || false;
        this.lowStockAlerts = this.settings.lowStockAlerts !== undefined ? this.settings.lowStockAlerts : true;
        this.autoRefreshInterval = parseInt(this.settings.autoRefreshInterval) || 0;
        this.cacheEnabled = this.settings.cacheEnabled !== undefined ? this.settings.cacheEnabled : true;
        this.autoBackupFrequency = parseInt(this.settings.autoBackupFrequency) || 24;
        this.backupRetentionDays = parseInt(this.settings.backupRetentionDays) || 30;
        
        this.applySettings(); // Apply settings first before loading data
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateTime();
        this.updateSystemStatus();
        this.loadProducts();
        this.loadSales();
        this.setDateFilter();
        
        // Update time every second
        setInterval(() => this.updateTime(), 1000);
        
        // Update system status every 30 seconds
        setInterval(() => this.updateSystemStatus(), 30000);
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const screen = e.currentTarget.dataset.screen;
                this.switchScreen(screen);
            });
        });

        // Universal search functionality - handles everything in one input
        document.getElementById('search-input').addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query) {
                // Check if it looks like a barcode (numeric, 8-13 digits)
                if (this.isBarcodeInput(query)) {
                    // It's a barcode - search for product and add to cart
                    this.handleBarcodeScan(query);
                    e.target.value = ''; // Clear input after scan
                } else {
                    // It's a regular search - filter products
            this.searchProducts(query);
                }
            } else {
                // Empty search - apply current filters
                this.applyFilters();
            }
        });

        // Handle Enter key for manual search
        document.getElementById('search-input').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                const query = e.target.value.trim();
                if (query) {
                    if (this.isBarcodeInput(query)) {
                        // Barcode scan
                        this.handleBarcodeScan(query);
                        e.target.value = '';
                    } else {
                        // Manual search
                        this.searchProducts(query);
                    }
                }
            }
        });

        // Handle paste events for barcode scanners
        document.getElementById('search-input').addEventListener('paste', (e) => {
            setTimeout(() => {
                const query = e.target.value.trim();
                if (query && this.isBarcodeInput(query)) {
                    this.handleBarcodeScan(query);
                    e.target.value = '';
                }
            }, 10);
        });

        // Cart functionality
        document.getElementById('clear-cart-btn').addEventListener('click', () => {
            this.clearCart();
        });

        document.getElementById('checkout-btn').addEventListener('click', () => {
            this.showPaymentModal();
        });

        // Product management
        document.getElementById('add-product-btn').addEventListener('click', () => {
            this.showProductModal();
        });

        document.getElementById('product-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProduct();
        });

        document.getElementById('cancel-product').addEventListener('click', () => {
            this.hideProductModal();
        });

        document.getElementById('close-modal').addEventListener('click', () => {
            this.hideProductModal();
        });

        // Barcode generator
        document.getElementById('generate-barcode-btn').addEventListener('click', () => {
            this.generateBarcode();
        });

        // Payment modal
        document.getElementById('close-payment-modal').addEventListener('click', () => {
            this.hidePaymentModal();
        });

        document.getElementById('complete-payment-btn').addEventListener('click', () => {
            this.completePayment();
        });

        // Payment methods
        document.querySelectorAll('.payment-method-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.payment-method-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
            });
        });

        // Sales refresh
        document.getElementById('refresh-sales-btn').addEventListener('click', () => {
            this.loadSales();
        });

        // Date filter
        document.getElementById('date-filter').addEventListener('change', (e) => {
            this.filterSalesByDate(e.target.value);
        });

        // Settings actions
        document.getElementById('refresh-data-btn').addEventListener('click', () => {
            this.refreshAllData();
        });

        // Dark mode toggle
        const darkModeToggle = document.getElementById('dark-mode-toggle');
        if (darkModeToggle) {
            darkModeToggle.addEventListener('click', () => {
                this.toggleDarkMode();
            });
        }

        // Settings screen event listeners
        const darkModeSetting = document.getElementById('dark-mode-setting');
        if (darkModeSetting) {
            darkModeSetting.addEventListener('change', (e) => {
                this.toggleDarkMode(e.target.checked);
            });
        }

        const taxRateInput = document.getElementById('tax-rate');
        if (taxRateInput) {
            taxRateInput.addEventListener('change', (e) => {
                this.taxRate = parseFloat(e.target.value) || 8.875;
                this.updateCartSummary();
            });
        }

        const currencyInput = document.getElementById('currency-symbol');
        if (currencyInput) {
            currencyInput.addEventListener('change', (e) => {
                this.currencySymbol = e.target.value || '$';
                this.displayProducts();
                this.updateCartSummary();
            });
        }

        const lowStockInput = document.getElementById('low-stock-threshold');
        if (lowStockInput) {
            lowStockInput.addEventListener('change', (e) => {
                this.lowStockThreshold = parseInt(e.target.value) || 5;
                this.displayProducts();
            });
        }

        const saveSettingsBtn = document.getElementById('save-settings-btn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => {
                this.saveSettings();
            });
        }

        const resetSettingsBtn = document.getElementById('reset-settings-btn');
        if (resetSettingsBtn) {
            resetSettingsBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
                    this.resetSettings();
                }
            });
        }

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.closest('.filter-btn').classList.add('active');
                const filter = e.target.closest('.filter-btn').dataset.filter;
                this.applyFilter(filter);
            });
        });

        // Sort dropdown
        const sortSelect = document.getElementById('sort-products');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.applySorting(e.target.value);
            });
        }

        // Close modals on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }

    async switchScreen(screenName) {
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const navBtn = document.querySelector(`[data-screen="${screenName}"]`);
        if (navBtn) {
            navBtn.classList.add('active');
        }

        // Update screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        const targetScreen = document.getElementById(`${screenName}-screen`);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }

        this.currentScreen = screenName;

        // Load data for specific screens
        if (screenName === 'products') {
            // Always reload products table when switching to products screen
            await this.loadProductsTable();
        } else if (screenName === 'sales') {
            this.loadSalesTable();
            this.updateSalesSummary();
        } else if (screenName === 'settings') {
            this.loadSettingsScreen();
        }
    }

    updateTime() {
        const now = new Date();
        const use12Hour = this.timeFormat !== '24';
        const timeString = now.toLocaleTimeString('en-US', {
            hour12: use12Hour,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        document.getElementById('current-time').textContent = timeString;
    }

    async updateSystemStatus() {
        try {
            const response = await fetch('/api/health');
            
            // Check if response is OK
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const health = await response.json();
            
            // Update system status display in settings screen
            const systemStatusDisplay = document.getElementById('system-status-display');
            if (systemStatusDisplay) {
                if (health.status === 'OK') {
                    systemStatusDisplay.textContent = 'OK';
                    systemStatusDisplay.className = 'status-online';
                } else {
                    systemStatusDisplay.textContent = 'Degraded';
                    systemStatusDisplay.className = 'status-offline';
                }
            }
            
            // Update last updated time
            const lastUpdated = document.getElementById('last-updated');
            if (lastUpdated) {
                const now = new Date();
                lastUpdated.textContent = now.toLocaleString('en-US', {
                    month: '2-digit',
                    day: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                });
            }
            
            // Update system status elements in header
            const statusElement = document.querySelector('.status-online');
            if (statusElement) {
                // Display user-friendly status text
                // Check if status is OK (case-insensitive)
                const isHealthy = health.status === 'OK' || health.status === 'ok';
                
                if (isHealthy) {
                    statusElement.textContent = 'OK';
                    statusElement.className = 'status-online';
                } else {
                    // Show the status (could be "Degraded", "ERROR", etc.)
                    statusElement.textContent = health.status || 'Unknown';
                    statusElement.className = 'status-offline';
                    
                    // If degraded but system is running, show a warning
                    if (health.status === 'Degraded' && health.message) {
                        console.warn('System status:', health.status, '-', health.message);
                    }
                }
            }
            
            // Update last updated timestamp
            const lastUpdatedElement = document.getElementById('last-updated');
            if (lastUpdatedElement) {
                const updateTime = new Date(health.timestamp).toLocaleString();
                lastUpdatedElement.textContent = updateTime;
            }
            
            // Update connection status in header
            const connectionStatus = document.getElementById('connection-status');
            if (connectionStatus) {
                const statusText = connectionStatus.querySelector('span');
                if (statusText) {
                    // Show "Online" for OK status, otherwise show the actual status
                    const isHealthy = health.status === 'OK' || 
                                     health.status === 'ok' || 
                                     (health.message && health.message.toLowerCase().includes('running'));
                    
                    if (isHealthy) {
                        statusText.textContent = 'Online';
                        connectionStatus.classList.remove('offline');
                    } else {
                        statusText.textContent = health.status || 'Offline';
                        connectionStatus.classList.add('offline');
                    }
                }
            }
            
        } catch (error) {
            console.error('Failed to update system status:', error);
            
            // Check if it's a browser security/HTTPS blocking issue
            const isSecurityError = error.message.includes('HTTPS') || 
                                   error.message.includes('mixed content') ||
                                   error.message.includes('secure') ||
                                   error.name === 'TypeError' && error.message.includes('Failed to fetch');
            
            // Update to show appropriate status
            const statusElement = document.querySelector('.status-online');
            if (statusElement) {
                if (isSecurityError) {
                    statusElement.textContent = 'Blocked (HTTPS Only)';
                    statusElement.className = 'status-offline';
                } else {
                    statusElement.textContent = 'Offline';
                    statusElement.className = 'status-offline';
                }
            }
            
            const connectionStatus = document.getElementById('connection-status');
            if (connectionStatus) {
                const statusText = connectionStatus.querySelector('span');
                if (statusText) {
                    if (isSecurityError) {
                        statusText.textContent = 'Blocked';
                    } else {
                        statusText.textContent = 'Offline';
                    }
                }
            }
        }
    }

    getLocalDateString(date = null) {
        // Helper function to get local date in YYYY-MM-DD format
        // Use local date, not UTC, to avoid timezone issues
        const d = date || new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    setDateFilter() {
        const today = this.getLocalDateString();
        document.getElementById('date-filter').value = today;
    }

    async loadProducts() {
        try {
            const response = await fetch('/api/products');
            this.products = await response.json();
            // Display products with current settings (currency, low stock threshold)
            // Apply filters and sorting after loading
            this.applyFilters();
        } catch (error) {
            console.error('Error loading products:', error);
            this.showMessage('Error loading products', 'error');
        }
    }

    displayProducts(filteredProducts = null) {
        const container = document.getElementById('products-grid');
        container.innerHTML = '';

        const productsToDisplay = filteredProducts || this.products;

        if (productsToDisplay.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-boxes"></i>
                    <p>No products found</p>
                    <small>Try adjusting your search or filters</small>
                </div>
            `;
            return;
        }

        productsToDisplay.forEach(product => {
            const productCard = document.createElement('div');
            const isLowStock = product.stock_quantity <= this.lowStockThreshold && product.stock_quantity > 0;
            const isOutOfStock = product.stock_quantity === 0;
            
            let stockStatusClass = 'in-stock';
            let stockStatusIcon = 'fa-check-circle';
            let stockStatusText = 'In Stock';
            let stockStatusColor = '#27ae60';
            
            if (isOutOfStock) {
                stockStatusClass = 'out-of-stock';
                stockStatusIcon = 'fa-times-circle';
                stockStatusText = 'Out of Stock';
                stockStatusColor = '#e74c3c';
            } else if (isLowStock) {
                stockStatusClass = 'low-stock';
                stockStatusIcon = 'fa-exclamation-triangle';
                stockStatusText = 'Low Stock';
                stockStatusColor = '#f39c12';
            }
            
            productCard.className = `product-card ${stockStatusClass}`;
            
            // Escape HTML to prevent XSS
            const productName = this.escapeHtml(product.name);
            
            productCard.innerHTML = `
                <div class="product-card-header">
                    <div class="product-status-badge ${stockStatusClass}">
                        <i class="fas ${stockStatusIcon}"></i>
                        <span>${stockStatusText}</span>
                    </div>
                </div>
                <div class="product-card-body">
                    <div class="product-name" title="${productName}">${productName}</div>
                    <div class="product-price">${this.formatCurrency(parseFloat(product.price))}</div>
                    <div class="product-stock-info">
                        <i class="fas fa-box"></i>
                        <span class="stock-quantity ${stockStatusClass}">${product.stock_quantity} ${product.stock_quantity === 1 ? 'unit' : 'units'}</span>
                    </div>
                </div>
                <div class="product-card-footer">
                    ${isOutOfStock ? 
                        '<button class="product-action-btn disabled" disabled><i class="fas fa-ban"></i> Unavailable</button>' :
                        '<button class="product-action-btn"><i class="fas fa-plus-circle"></i> Add to Cart</button>'
                    }
                </div>
            `;
            
            if (!isOutOfStock) {
                const addButton = productCard.querySelector('.product-action-btn');
                addButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.addToCart(product);
                });
            }
            
            productCard.addEventListener('click', (e) => {
                if (!e.target.closest('.product-action-btn') && !isOutOfStock) {
                    this.addToCart(product);
                }
            });
            
            container.appendChild(productCard);
        });
    }

    // Function to refresh product display with updated stock
    refreshProductDisplay() {
        this.displayProducts();
    }

    // Receipt functionality
    async showReceipt(orderId) {
        try {
            // Remove # from order ID for the API call
            const cleanOrderId = orderId.replace('#', '');
            // Loading receipt for order
            const response = await fetch(`/order/${cleanOrderId}`);
            const data = await response.json();
            
            if (response.ok) {
                this.displayReceipt(data);
                this.showReceiptModal();
            } else {
                throw new Error(data.error || 'Failed to load receipt');
            }
        } catch (error) {
            console.error('Error loading receipt:', error);
            this.showMessage(`Error loading receipt: ${error.message}`, 'error');
        }
    }

    displayReceipt(data) {
        const receiptContent = document.getElementById('receipt-content');
        const { order, items, totals } = data;
        
        const orderDate = new Date(order.created_at).toLocaleString();
        
        receiptContent.innerHTML = `
            <div class="receipt">
                <div class="receipt-header">
                    <div class="receipt-title">POS System</div>
                    <div class="receipt-subtitle">Sales Receipt</div>
                </div>
                
                <div class="receipt-info">
                    <div><strong>Order #:</strong> ${order.id || order.order_id || 'N/A'}</div>
                    <div><strong>Date:</strong> ${orderDate}</div>
                    <div><strong>Payment:</strong> ${order.payment_method === 'card' ? '💳 Card' : '💵 Cash'}</div>
                    <div><strong>Cashier:</strong> System</div>
                </div>
                
                <div class="receipt-items">
                    ${items.map(item => `
                        <div class="receipt-item">
                            <div>
                                <div class="item-name">${item.name}</div>
                                <div class="item-details">SKU: ${item.sku} | Qty: ${item.quantity}</div>
                            </div>
                            <div class="item-price">${this.formatCurrency(item.quantity * item.price)}</div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="receipt-totals">
                    <div class="receipt-total-row">
                        <span>Subtotal:</span>
                        <span>${this.formatCurrency(totals.subtotal)}</span>
                    </div>
                    <div class="receipt-total-row">
                        <span>Tax (${this.taxRate}%):</span>
                        <span>${this.formatCurrency(totals.tax)}</span>
                    </div>
                    <div class="receipt-total-row final">
                        <span>Total:</span>
                        <span>${this.formatCurrency(totals.total)}</span>
                    </div>
                </div>
                
                <div class="receipt-footer">
                    <div>Thank you for your business!</div>
                    <div>Visit us again soon</div>
                </div>
            </div>
        `;
    }

    showReceiptModal() {
        document.getElementById('receipt-modal').classList.add('active');
    }

    hideReceiptModal() {
        document.getElementById('receipt-modal').classList.remove('active');
    }

    printReceipt() {
        try {
            const receiptContent = this.generateReceiptHTML();
            
            // Method 1: Try to open new window (most reliable for printing)
            let receiptWindow = null;
            
            try {
                // Use a more permissive approach
                receiptWindow = window.open('', '_blank', 'width=400,height=600,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no');
                
                if (receiptWindow) {
                    // Write content immediately
                    receiptWindow.document.open();
                    receiptWindow.document.write(receiptContent);
                    receiptWindow.document.close();
                    
                    // Focus the window and print
                    receiptWindow.focus();
                    
                    // Wait a bit for content to load, then print
                    setTimeout(() => {
                        try {
                            receiptWindow.print();
                            this.showMessage('🖨️ Receipt sent to printer!', 'success');
                            
                            // Close window after printing (optional)
                            setTimeout(() => {
                                if (receiptWindow && !receiptWindow.closed) {
                                    receiptWindow.close();
                                }
                            }, 2000);
                            
                        } catch (printError) {
                            console.error('Print command failed:', printError);
                            this.showMessage('Print dialog failed. Receipt is ready in new window.', 'warning');
                        }
                    }, 500);
                    return;
                }
            } catch (e) {
                // Window.open failed, trying alternative method
            }
            
            // Method 2: Create a hidden iframe and print from there
            try {
                const iframe = document.createElement('iframe');
                iframe.style.position = 'absolute';
                iframe.style.left = '-9999px';
                iframe.style.top = '-9999px';
                iframe.style.width = '400px';
                iframe.style.height = '600px';
                
                document.body.appendChild(iframe);
                
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                iframeDoc.open();
                iframeDoc.write(receiptContent);
                iframeDoc.close();
                
                // Wait for content to load
                setTimeout(() => {
                    try {
                        iframe.contentWindow.focus();
                        iframe.contentWindow.print();
                        this.showMessage('🖨️ Receipt sent to printer!', 'success');
                    } catch (printError) {
                        console.error('Iframe print failed:', printError);
                        this.showMessage('Print failed. Trying alternative method...', 'warning');
                        
                        // Fallback: show content in current window
                        this.showReceiptInCurrentWindow(receiptContent);
                    }
                    
                    // Clean up iframe
                    setTimeout(() => {
                        document.body.removeChild(iframe);
                    }, 1000);
                }, 500);
                return;
                
            } catch (e) {
                // Iframe method failed, trying current window method
            }
            
            // Method 3: Show in current window with print button
            this.showReceiptInCurrentWindow(receiptContent);
            
        } catch (error) {
            console.error('Print error:', error);
            this.showMessage('Print error: ' + error.message, 'error');
        }
    }
    
    showReceiptInCurrentWindow(receiptContent) {
        // Create a modal or overlay with the receipt content
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            max-width: 400px;
            max-height: 80vh;
            overflow-y: auto;
            position: relative;
        `;
        
        // Add print button
        const printButton = document.createElement('button');
        printButton.textContent = '🖨️ Print Receipt';
        printButton.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: #007bff;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;
        
        printButton.onclick = () => {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(receiptContent);
                printWindow.document.close();
                printWindow.focus();
                printWindow.print();
                modal.remove();
            } else {
                this.showMessage('Please allow popups to print receipts', 'error');
            }
        };
        
        // Add close button
        const closeButton = document.createElement('button');
        closeButton.textContent = '✕';
        closeButton.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            background: #dc3545;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;
        
        closeButton.onclick = () => {
            modal.remove();
        };
        
        // Add receipt content
        const receiptDiv = document.createElement('div');
        receiptDiv.innerHTML = receiptContent.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || receiptContent;
        
        content.appendChild(printButton);
        content.appendChild(closeButton);
        content.appendChild(receiptDiv);
        modal.appendChild(content);
        
        // Add click outside to close
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        };
        
        document.body.appendChild(modal);
        this.showMessage('Receipt displayed. Click print button or use Ctrl+P', 'info');
    }

    previewReceipt() {
        try {
            const receiptContent = this.generateReceiptHTML();
            
            // Try to open preview window
            let previewWindow = null;
            
            try {
                previewWindow = window.open('', '_blank', 'width=400,height=600,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no');
                
                if (previewWindow) {
                    previewWindow.document.open();
                    previewWindow.document.write(receiptContent);
                    previewWindow.document.close();
                    previewWindow.focus();
                    this.showMessage('👁️ Receipt preview opened!', 'success');
                    return;
                }
            } catch (e) {
                // Preview window.open failed, trying modal method
            }
            
            // Fallback: Show in modal (same as print fallback)
            this.showReceiptInCurrentWindow(receiptContent);
            
        } catch (error) {
            console.error('Preview error:', error);
            this.showMessage('Preview error: ' + error.message, 'error');
        }
    }

    generateReceiptHTML() {
        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * (this.taxRate / 100);
        const total = subtotal + tax;
        const orderId = '#' + Date.now();
        const date = new Date().toLocaleString();
        
        // Get selected payment method
        const selectedPaymentMethod = document.querySelector('.payment-method-btn.active');
        const paymentMethod = selectedPaymentMethod ? selectedPaymentMethod.dataset.method : 'cash';
        const paymentText = paymentMethod === 'card' ? '💳 Card' : '💵 Cash';
        
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Receipt - ${orderId}</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
            margin: 0;
            padding: 10px;
            background: white;
            color: black;
        }
        .receipt {
            max-width: 300px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            border-bottom: 1px dashed #000;
            padding-bottom: 10px;
            margin-bottom: 10px;
        }
        .item {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
        }
        .item-name {
            flex: 1;
        }
        .item-price {
            font-weight: bold;
        }
        .totals {
            border-top: 1px dashed #000;
            margin-top: 10px;
            padding-top: 10px;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
        }
        .final-total {
            font-weight: bold;
            font-size: 14px;
            border-top: 2px solid #000;
            padding-top: 5px;
            margin-top: 10px;
        }
        .footer {
            text-align: center;
            margin-top: 20px;
            font-size: 10px;
        }
        @media print {
            body { margin: 0; padding: 5px; }
            .receipt { max-width: none; }
        }
    </style>
</head>
<body>
    <div class="receipt">
        <div class="header">
            <h2>POS SYSTEM</h2>
            <p>Order: ${orderId}</p>
            <p>Date: ${date}</p>
            <p>Payment: ${paymentText}</p>
            <p>Cashier: System</p>
        </div>
        
        <div class="items">
            ${this.cart.map(item => `
                <div class="item">
                    <span class="item-name">${item.name} (${item.quantity}x)</span>
                    <span class="item-price">${this.formatCurrency(item.price * item.quantity)}</span>
                </div>
            `).join('')}
        </div>
        
        <div class="totals">
            <div class="total-row">
                <span>Subtotal:</span>
                <span>${this.formatCurrency(subtotal)}</span>
            </div>
            <div class="total-row">
                <span>Tax (${this.taxRate}%):</span>
                <span>${this.formatCurrency(tax)}</span>
            </div>
            <div class="total-row final-total">
                <span>TOTAL:</span>
                <span>${this.formatCurrency(total)}</span>
            </div>
        </div>
        
        <div class="footer">
            <p>Thank you for your business!</p>
            <p>Visit us again soon!</p>
        </div>
    </div>
</body>
</html>`;
    }

    searchProducts(query) {
        const searchTerm = query.toLowerCase();
        const filtered = this.products.filter(product => {
            const name = product.name.toLowerCase();
            const sku = (product.sku || '').toLowerCase();
            const barcode = (product.barcode || '').toLowerCase();
            return name.includes(searchTerm) || sku.includes(searchTerm) || barcode.includes(searchTerm);
        });
        this.displayProducts(filtered);
    }

    applyFilter(filterType) {
        let filtered = this.products;
        
        switch(filterType) {
            case 'in-stock':
                filtered = this.products.filter(p => p.stock_quantity > this.lowStockThreshold);
                break;
            case 'low-stock':
                filtered = this.products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= this.lowStockThreshold);
                break;
            case 'out-of-stock':
                filtered = this.products.filter(p => p.stock_quantity === 0);
                break;
            case 'all':
            default:
                filtered = this.products;
                break;
        }
        
        // Apply current search if any
        const searchInput = document.getElementById('search-input');
        if (searchInput && searchInput.value.trim()) {
            const searchTerm = searchInput.value.toLowerCase();
            filtered = filtered.filter(product => {
                const name = product.name.toLowerCase();
                const sku = (product.sku || '').toLowerCase();
                const barcode = (product.barcode || '').toLowerCase();
                return name.includes(searchTerm) || sku.includes(searchTerm) || barcode.includes(searchTerm);
            });
        }
        
        this.applySorting(document.getElementById('sort-products')?.value || 'name', filtered);
    }

    applySorting(sortBy, productsToSort = null) {
        // Get current filter state
        const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
        let products = productsToSort;
        
        // If no products provided, apply current filter first
        if (!products) {
            switch(activeFilter) {
                case 'in-stock':
                    products = this.products.filter(p => p.stock_quantity > this.lowStockThreshold);
                    break;
                case 'low-stock':
                    products = this.products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= this.lowStockThreshold);
                    break;
                case 'out-of-stock':
                    products = this.products.filter(p => p.stock_quantity === 0);
                    break;
                case 'all':
                default:
                    products = this.products;
                    break;
            }
            
            // Apply current search if any
            const searchInput = document.getElementById('search-input');
            if (searchInput && searchInput.value.trim()) {
                const searchTerm = searchInput.value.toLowerCase();
                products = products.filter(product => {
                    const name = product.name.toLowerCase();
                    const sku = (product.sku || '').toLowerCase();
                    const barcode = (product.barcode || '').toLowerCase();
                    return name.includes(searchTerm) || sku.includes(searchTerm) || barcode.includes(searchTerm);
                });
            }
        }
        
        let sorted = [...products];
        
        switch(sortBy) {
            case 'name':
                sorted.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'price-asc':
                sorted.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
                break;
            case 'price-desc':
                sorted.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
                break;
            case 'stock-asc':
                sorted.sort((a, b) => a.stock_quantity - b.stock_quantity);
                break;
            case 'stock-desc':
                sorted.sort((a, b) => b.stock_quantity - a.stock_quantity);
                break;
        }
        
        this.displayProducts(sorted);
    }

    applyFilters() {
        const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
        this.applyFilter(activeFilter);
    }

    addToCart(product) {
        const existingItem = this.cart.find(item => item.id === product.id);
        
        if (existingItem) {
            if (existingItem.quantity < product.stock_quantity) {
                existingItem.quantity++;
            } else {
                this.showMessage('Not enough stock available', 'warning');
                return;
            }
        } else {
            if (product.stock_quantity > 0) {
            this.cart.push({
                    id: product.id,
                name: product.name,
                    price: parseFloat(product.price),
                    quantity: 1,
                    stock_quantity: product.stock_quantity
            });
            } else {
                this.showMessage('Product out of stock', 'warning');
                return;
            }
        }

        this.updateCartDisplay();
        this.showMessage(`${product.name} added to cart`, 'success');
        
        // Update the product in the products array to reflect current stock
        const productIndex = this.products.findIndex(p => p.id === product.id);
        if (productIndex !== -1) {
            this.products[productIndex].stock_quantity = product.stock_quantity;
        }
    }

    updateCartDisplay() {
        const container = document.getElementById('cart-items');
        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * (this.taxRate / 100);
        const total = subtotal + tax;

        // Update totals
        document.getElementById('subtotal').textContent = this.formatCurrency(subtotal);
        document.getElementById('tax').textContent = this.formatCurrency(tax);
        document.getElementById('total').textContent = this.formatCurrency(total);

        // Enable/disable checkout button
        document.getElementById('checkout-btn').disabled = this.cart.length === 0;

        // Update cart items
        if (this.cart.length === 0) {
            container.innerHTML = '<div class="empty-cart"><i class="fas fa-shopping-cart"></i><p>No items in cart</p></div>';
        } else {
            container.innerHTML = this.cart.map(item => `
                <div class="cart-item">
                    <div class="item-info">
                        <div class="item-name">${item.name}</div>
                        <div class="item-details">${this.formatCurrency(item.price)} each</div>
                    </div>
                    <div class="item-controls">
                        <button class="quantity-btn" onclick="pos.updateQuantity(${item.id}, -1)">-</button>
                        <span class="item-quantity">${item.quantity}</span>
                        <button class="quantity-btn" onclick="pos.updateQuantity(${item.id}, 1)">+</button>
                    </div>
                    <div class="item-total">${this.formatCurrency(item.price * item.quantity)}</div>
                    <div class="remove-item" onclick="pos.removeFromCart(${item.id})">
                        <i class="fas fa-trash"></i>
                    </div>
                </div>
            `).join('');
        }
    }

    updateCartSummary() {
        // Alias for updateCartDisplay to maintain compatibility
        this.updateCartDisplay();
    }

    updateQuantity(productId, change) {
        const item = this.cart.find(item => item.id === productId);
        if (item) {
        const newQuantity = item.quantity + change;
        if (newQuantity <= 0) {
                this.removeFromCart(productId);
            } else if (newQuantity <= item.stock_quantity) {
                item.quantity = newQuantity;
                this.updateCartDisplay();
        } else {
                this.showMessage('Not enough stock available', 'warning');
            }
        }
        }

    removeFromCart(productId) {
        this.cart = this.cart.filter(item => item.id !== productId);
        this.updateCartDisplay();
    }

    clearCart() {
            this.cart = [];
            this.updateCartDisplay();
            this.showMessage('Cart cleared', 'success');
        }

    showPaymentModal() {
        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * (this.taxRate / 100); // New York City tax rate (8.875%)
        const total = subtotal + tax;

        document.getElementById('payment-subtotal').textContent = this.formatCurrency(subtotal);
        document.getElementById('payment-tax').textContent = this.formatCurrency(tax);
        document.getElementById('payment-total').textContent = this.formatCurrency(total);

        document.getElementById('payment-modal').classList.add('active');
    }

    hidePaymentModal() {
        document.getElementById('payment-modal').classList.remove('active');
    }

    async completePayment() {
        try {
            const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const tax = subtotal * (this.taxRate / 100); // New York City tax rate (8.875%)
            const total = subtotal + tax;

            // Get selected payment method
            const selectedPaymentMethod = document.querySelector('.payment-method-btn.active');
            const paymentMethod = selectedPaymentMethod ? selectedPaymentMethod.dataset.method : 'cash';

            const orderData = {
                items: this.cart.map(item => ({
                    id: item.id,
                    quantity: item.quantity,
                    price: item.price
                })),
                payment_method: paymentMethod
            };

            const response = await fetch('/api/sales', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderData)
            });
            
            const result = await response.json();

            if (response.ok && result.success) {
                this.showMessage('Payment processed successfully!', 'success');
                this.clearCart();
                this.hidePaymentModal();
                
                // Receipt can be printed manually using the Print Receipt button
                // this.printReceipt(); // Removed automatic receipt popup
                
                this.loadSales(); // Refresh sales data
                this.loadProducts(); // Refresh product list to show updated stock
                this.refreshProductDisplay(); // Update the visual display
                
                // Update sales summary if on sales screen
                if (this.currentScreen === 'sales') {
                    this.updateSalesSummary();
                }
            } else {
                throw new Error(result.error || 'Payment failed');
            }
        } catch (error) {
            console.error('Error processing payment:', error);
            this.showMessage(`Error processing payment: ${error.message}`, 'error');
        }
    }

    showProductModal(product = null) {
        this.editingProduct = product;
        const modal = document.getElementById('product-modal');
        const form = document.getElementById('product-form');
        const title = document.getElementById('modal-title');

        if (product) {
            title.textContent = 'Edit Product';
            document.getElementById('product-name').value = product.name;
            document.getElementById('product-sku').value = product.sku;
            document.getElementById('product-barcode').value = product.barcode || '';
            document.getElementById('product-price').value = product.price;
            document.getElementById('product-stock').value = product.stock_quantity;
        } else {
            title.textContent = 'Add Product';
            form.reset();
        }

        modal.classList.add('active');
    }

    hideProductModal() {
        document.getElementById('product-modal').classList.remove('active');
        this.editingProduct = null;
    }

    generateBarcode() {
        // Generate a 13-digit barcode (EAN-13 format)
        const generateEAN13 = () => {
            // Generate 12 random digits
        let barcode = '';
        for (let i = 0; i < 12; i++) {
            barcode += Math.floor(Math.random() * 10);
        }
        
            // Calculate check digit
        let sum = 0;
        for (let i = 0; i < 12; i++) {
                const digit = parseInt(barcode[i]);
                sum += (i % 2 === 0) ? digit : digit * 3;
        }
        const checkDigit = (10 - (sum % 10)) % 10;
        
        return barcode + checkDigit;
        };

        // Generate a unique barcode
        let newBarcode;
        let attempts = 0;
        const maxAttempts = 10;
        
        do {
            newBarcode = generateEAN13();
            attempts++;
        } while (this.isBarcodeExists(newBarcode) && attempts < maxAttempts);

        // If we couldn't generate a unique barcode, add a timestamp suffix
        if (attempts >= maxAttempts) {
            const timestamp = Date.now().toString().slice(-6);
            newBarcode = generateEAN13().slice(0, -6) + timestamp;
        }

        // Set the generated barcode in the input field
        document.getElementById('product-barcode').value = newBarcode;
        
        // Show success message
        this.showMessage('Barcode generated successfully!', 'success');
        
        // Add a visual effect to the button
        const btn = document.getElementById('generate-barcode-btn');
        btn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            btn.style.transform = 'scale(1)';
        }, 150);
    }

    isBarcodeExists(barcode) {
        // Check if barcode already exists in current products
        return this.products.some(product => product.barcode === barcode);
    }

    isBarcodeInput(input) {
        // Check if input looks like a barcode (numeric, 8-13 digits)
        const numericInput = input.replace(/\D/g, '');
        return numericInput.length >= 8 && numericInput.length <= 13;
    }

    handleBarcodeScan(barcode) {
        // Barcode scanned
        
        // Find product by barcode
        const product = this.products.find(p => p.barcode === barcode);
        
        if (product) {
            // Add product to cart
            this.addToCart(product);
            this.showMessage(`Scanned: ${product.name}`, 'success');
        } else {
            // Try to find by partial barcode match
            const partialMatch = this.products.find(p => 
                p.barcode && p.barcode.includes(barcode)
            );
            
            if (partialMatch) {
                this.addToCart(partialMatch);
                this.showMessage(`Scanned: ${partialMatch.name}`, 'success');
            } else {
                this.showMessage(`Product not found for barcode: ${barcode}`, 'error');
            }
        }
    }

    async saveProduct() {
        try {
        const formData = {
                name: document.getElementById('product-name').value.trim(),
                sku: document.getElementById('product-sku').value.trim(),
                barcode: document.getElementById('product-barcode').value.trim(),
            price: parseFloat(document.getElementById('product-price').value),
                stock_quantity: (() => {
                    const stockValue = document.getElementById('product-stock').value;
                    const parsed = parseInt(stockValue);
                    return isNaN(parsed) ? 0 : parsed;
                })()
        };

            // Validate required fields
            if (!formData.name || !formData.sku || isNaN(formData.price) || formData.price <= 0) {
                this.showMessage('Please fill in all required fields (Name, SKU, and Price must be valid)', 'error');
            return;
        }
        
        // Convert empty barcode to null for optional field
        if (formData.barcode === '') {
            formData.barcode = null;
        }

            let response;
            if (this.editingProduct) {
                response = await fetch(`/api/products?id=${this.editingProduct.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
            } else {
                response = await fetch('/api/products', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
            }

            const result = await response.json();
            
            if (response.ok && result.success) {
                this.showMessage(`Product ${this.editingProduct ? 'updated' : 'added'} successfully!`, 'success');
                this.hideProductModal();
                this.loadProducts();
                if (this.currentScreen === 'products') {
                    this.loadProductsTable();
                }
            } else {
                // Show detailed validation errors if available
                let errorMessage = result.error || 'Failed to save product';
                if (result.details && Array.isArray(result.details) && result.details.length > 0) {
                    errorMessage += ': ' + result.details.join(', ');
                }
                throw new Error(errorMessage);
            }
        } catch (error) {
            console.error('Error saving product:', error);
            this.showMessage(`Error saving product: ${error.message}`, 'error');
        }
    }

    async loadProductsTable() {
        try {
            console.log('loadProductsTable called');
            const tbody = document.getElementById('products-table-body');
            if (!tbody) {
                console.error('Products table body not found - element does not exist');
                return;
            }

            // Show loading state
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Loading products...</td></tr>';

            const response = await fetch('/api/products');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const products = await response.json();
            console.log(`Loaded ${products ? products.length : 0} products from API`);
            this.products = products; // Update products array
            tbody.innerHTML = '';

            if (!products || products.length === 0) {
                console.log('No products found in response');
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #666;"><i class="fas fa-boxes"></i><br><br>No products found. Click "Add Product" to create your first product.</td></tr>';
                return;
            }

            products.forEach(product => {
                try {
                    const row = document.createElement('tr');
                    // Safely escape product data for onclick
                    const productData = JSON.stringify(product)
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#39;');
                    
                    // Ensure formatCurrency and escapeHtml are available
                    const formattedPrice = this.formatCurrency ? this.formatCurrency(parseFloat(product.price)) : `$${parseFloat(product.price).toFixed(2)}`;
                    const escapedName = this.escapeHtml ? this.escapeHtml(product.name) : product.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    const escapedSku = this.escapeHtml ? this.escapeHtml(product.sku || '-') : (product.sku || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    const escapedBarcode = this.escapeHtml ? this.escapeHtml(product.barcode || '-') : (product.barcode || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    
                    row.innerHTML = `
                        <td>${escapedName}</td>
                        <td>${escapedSku}</td>
                        <td>${escapedBarcode}</td>
                        <td>${formattedPrice}</td>
                        <td class="${product.stock_quantity <= (this.lowStockThreshold || 5) ? 'low-stock' : ''}">${product.stock_quantity}</td>
                        <td>
                            <button class="edit-btn" onclick="pos.showProductModal(${productData})" title="Edit Product">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="delete-btn" onclick="pos.deleteProduct(${product.id})" title="Delete Product">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(row);
                } catch (rowError) {
                    console.error('Error creating row for product:', product, rowError);
                }
            });
            console.log(`Successfully displayed ${products.length} products in table`);
        } catch (error) {
            console.error('Error loading products table:', error);
            const tbody = document.getElementById('products-table-body');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #e74c3c;"><i class="fas fa-exclamation-triangle"></i><br><br>Error loading products: ${error.message}<br><button onclick="pos.loadProductsTable()" style="margin-top: 10px; padding: 8px 16px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">Retry</button></td></tr>`;
            }
            this.showMessage(`Error loading products: ${error.message}`, 'error');
        }
    }

    async deleteProduct(productId) {
        if (confirm('Are you sure you want to delete this product?')) {
        try {
                const response = await fetch(`/api/products?id=${productId}`, {
                method: 'DELETE'
            });

                const result = await response.json();

                if (response.ok && result.success) {
                    this.showMessage('Product deleted successfully!', 'success');
            this.loadProducts();
                    if (this.currentScreen === 'products') {
                        this.loadProductsTable();
                    }
                } else {
                    throw new Error(result.error || 'Failed to delete product');
                }
        } catch (error) {
                console.error('Error deleting product:', error);
                this.showMessage(`Error deleting product: ${error.message}`, 'error');
            }
        }
    }

    async loadSales() {
        try {
            const response = await fetch('/api/sales');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            this.sales = await response.json();
            this.updateSalesSummary();
        } catch (error) {
            console.error('Error loading sales:', error);
            this.showMessage(`Error loading sales: ${error.message}`, 'error');
        }
    }

    loadSalesTable() {
        const tbody = document.getElementById('sales-table-body');
        tbody.innerHTML = '';

        if (this.sales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px;">No sales found</td></tr>';
            return;
        }

        this.sales.slice(0, 50).forEach(sale => {
                const row = document.createElement('tr');
            // Display local time (now stored in local timezone)
            const saleDate = new Date(sale.created_at);
            const date = saleDate.toLocaleDateString();
            const time = saleDate.toLocaleTimeString();
            
            row.className = 'clickable-row';
            row.style.cursor = 'pointer';
                const paymentMethodIcon = sale.payment_method === 'card' ? '💳' : '💵';
                const paymentMethodText = sale.payment_method === 'card' ? 'Card' : 'Cash';
                
                const paymentBadgeClass = sale.payment_method === 'card' ? 'card' : 'cash';
                row.innerHTML = `
                <td style="font-weight: 700; color: #667eea; font-size: 1rem;">${sale.order_id || 'N/A'}</td>
                <td style="color: #495057;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <span style="font-weight: 600; color: #2c3e50; font-size: 0.95rem;">${date}</span>
                        <span style="color: #6c757d; font-size: 0.85rem; font-weight: 500;">${time}</span>
                    </div>
                </td>
                <td style="color: #495057; font-weight: 600;">
                    <span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: #f8f9fa; border-radius: 12px; font-size: 0.9rem;">
                        <i class="fas fa-shopping-bag" style="font-size: 0.8rem; color: #667eea;"></i>
                        ${sale.item_count || 0} ${sale.item_count === 1 ? 'item' : 'items'}
                    </span>
                </td>
                <td style="text-align: center;">
                    <span class="payment-badge ${paymentBadgeClass}">
                        <span class="payment-icon">${paymentMethodIcon}</span>
                        ${paymentMethodText}
                    </span>
                </td>
                <td style="font-weight: 700; color: #27ae60; font-size: 1.1rem; letter-spacing: 0.3px;">${this.formatCurrency(parseFloat(sale.total_amount))}</td>
                `;
            row.addEventListener('click', () => this.showReceipt(sale.order_id));
                tbody.appendChild(row);
        });
    }

    updateSalesSummary() {
        // Get today's date in YYYY-MM-DD format (local time)
        const today = this.getLocalDateString();
        
        // Filter sales for today
        const todaySales = this.sales.filter(sale => {
            if (!sale.created_at) return false;
            const saleDate = sale.created_at.split(' ')[0]; // Get date part only
            return saleDate === today;
        });

        // Calculate today's revenue
        const todayRevenue = todaySales.reduce((sum, sale) => {
            const amount = parseFloat(sale.total_amount) || 0;
            return sum + amount;
        }, 0);
        
        const avgSale = todaySales.length > 0 ? todayRevenue / todaySales.length : 0;

        // Update the display
        const revenueElement = document.getElementById('today-revenue');
        const salesElement = document.getElementById('today-sales');
        const avgElement = document.getElementById('avg-sale');

        if (revenueElement) {
            revenueElement.textContent = `$${todayRevenue.toFixed(2)}`;
        }
        if (salesElement) {
            salesElement.textContent = todaySales.length;
        }
        if (avgElement) {
            avgElement.textContent = `$${avgSale.toFixed(2)}`;
        }
    }

    async filterSalesByDate(date) {
        if (!date) {
            this.loadSalesTable();
            this.updateSalesSummary();
            return;
        }

        try {
            // Load sales from API with date filter for better accuracy
            const response = await fetch(`/api/sales?date=${date}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const filteredSales = await response.json();
            const tbody = document.getElementById('sales-table-body');
            tbody.innerHTML = '';

            if (filteredSales.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px;">No sales found for this date</td></tr>';
                // Update summary to show 0 for selected date
                this.updateSalesSummaryForDate(date, filteredSales);
                return;
            }

            filteredSales.forEach(sale => {
                const row = document.createElement('tr');
                const saleDate = new Date(sale.created_at);
                const dateStr = saleDate.toLocaleDateString();
                const time = saleDate.toLocaleTimeString();
                
                row.className = 'clickable-row';
                row.style.cursor = 'pointer';
                const paymentMethodIcon = sale.payment_method === 'card' ? '💳' : '💵';
                const paymentMethodText = sale.payment_method === 'card' ? 'Card' : 'Cash';
                
                const paymentBadgeClass = sale.payment_method === 'card' ? 'card' : 'cash';
                row.innerHTML = `
                    <td style="font-weight: 700; color: #667eea; font-size: 1rem;">${sale.order_id || 'N/A'}</td>
                    <td style="color: #495057;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <span style="font-weight: 600; color: #2c3e50; font-size: 0.95rem;">${dateStr}</span>
                            <span style="color: #6c757d; font-size: 0.85rem; font-weight: 500;">${time}</span>
                        </div>
                    </td>
                    <td style="color: #495057; font-weight: 600;">
                        <span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: #f8f9fa; border-radius: 12px; font-size: 0.9rem;">
                            <i class="fas fa-shopping-bag" style="font-size: 0.8rem; color: #667eea;"></i>
                            ${sale.item_count || 0} ${sale.item_count === 1 ? 'item' : 'items'}
                        </span>
                    </td>
                    <td style="text-align: center;">
                        <span class="payment-badge ${paymentBadgeClass}">
                            <span class="payment-icon">${paymentMethodIcon}</span>
                            ${paymentMethodText}
                        </span>
                    </td>
                    <td style="font-weight: 700; color: #27ae60; font-size: 1.1rem; letter-spacing: 0.3px;">${this.formatCurrency(parseFloat(sale.total_amount))}</td>
                `;
                row.addEventListener('click', () => this.showReceipt(sale.order_id));
                tbody.appendChild(row);
            });
            
            // Update summary for the selected date
            this.updateSalesSummaryForDate(date, filteredSales);
        } catch (error) {
            console.error('Error filtering sales by date:', error);
            this.showMessage(`Error loading sales: ${error.message}`, 'error');
        }
    }
    
    updateSalesSummaryForDate(date, sales) {
        // Calculate revenue for the selected date
        const revenue = sales.reduce((sum, sale) => {
            const amount = parseFloat(sale.total_amount) || 0;
            return sum + amount;
        }, 0);
        
        const avgSale = sales.length > 0 ? revenue / sales.length : 0;
        
        // Check if selected date is today (using local time)
        const today = this.getLocalDateString();
        const isToday = date === today;
        
        // Update the display
        const revenueElement = document.getElementById('today-revenue');
        const salesElement = document.getElementById('today-sales');
        const avgElement = document.getElementById('avg-sale');
        
        // Update labels if not today
        const revenueCard = revenueElement?.closest('.summary-card');
        const salesCard = salesElement?.closest('.summary-card');
        const avgCard = avgElement?.closest('.summary-card');
        
        if (revenueCard) {
            const label = revenueCard.querySelector('.card-content p');
            if (label) {
                label.textContent = isToday ? "Today's Revenue" : "Date Revenue";
            }
        }
        if (salesCard) {
            const label = salesCard.querySelector('.card-content p');
            if (label) {
                label.textContent = isToday ? "Today's Sales" : "Date Sales";
            }
        }
        if (avgCard) {
            const label = avgCard.querySelector('.card-content p');
            if (label) {
                label.textContent = isToday ? "Average Sale" : "Avg Sale";
            }
        }

        if (revenueElement) {
            revenueElement.textContent = `$${revenue.toFixed(2)}`;
        }
        if (salesElement) {
            salesElement.textContent = sales.length;
        }
        if (avgElement) {
            avgElement.textContent = `$${avgSale.toFixed(2)}`;
        }
    }

    // Settings Management
    loadSettings() {
        try {
            const saved = localStorage.getItem('pos_settings');
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.error('Error loading settings:', error);
            return {};
        }
    }

    saveSettings() {
        try {
            // Collect all settings from form
            const darkModeSetting = document.getElementById('dark-mode-setting');
            const taxRateInput = document.getElementById('tax-rate');
            const currencyInput = document.getElementById('currency-symbol');
            const lowStockInput = document.getElementById('low-stock-threshold');
            const dateFormatInput = document.getElementById('date-format');
            const timeFormatInput = document.getElementById('time-format');
            const itemsPerPageInput = document.getElementById('items-per-page');
            const storeNameInput = document.getElementById('store-name');
            const storeAddressInput = document.getElementById('store-address');
            const receiptFooterInput = document.getElementById('receipt-footer');
            const autoPrintInput = document.getElementById('auto-print');
            const soundEnabledInput = document.getElementById('sound-enabled');
            const desktopNotificationsInput = document.getElementById('desktop-notifications');
            const lowStockAlertsInput = document.getElementById('low-stock-alerts');
            const autoRefreshIntervalInput = document.getElementById('auto-refresh-interval');
            const cacheEnabledInput = document.getElementById('cache-enabled');
            const autoBackupFrequencyInput = document.getElementById('auto-backup-frequency');
            const backupRetentionDaysInput = document.getElementById('backup-retention-days');

            const settings = {
                darkMode: darkModeSetting ? darkModeSetting.checked : this.settings.darkMode || false,
                taxRate: taxRateInput ? parseFloat(taxRateInput.value) || 8.875 : this.taxRate,
                currencySymbol: currencyInput ? currencyInput.value || '$' : this.currencySymbol,
                lowStockThreshold: lowStockInput ? parseInt(lowStockInput.value) || 5 : this.lowStockThreshold,
                dateFormat: dateFormatInput ? dateFormatInput.value : this.dateFormat,
                timeFormat: timeFormatInput ? timeFormatInput.value : this.timeFormat,
                itemsPerPage: itemsPerPageInput ? parseInt(itemsPerPageInput.value) || 50 : this.itemsPerPage,
                storeName: storeNameInput ? storeNameInput.value : this.storeName,
                storeAddress: storeAddressInput ? storeAddressInput.value : this.storeAddress,
                receiptFooter: receiptFooterInput ? receiptFooterInput.value : this.receiptFooter,
                autoPrint: autoPrintInput ? autoPrintInput.checked : this.autoPrint,
                soundEnabled: soundEnabledInput ? soundEnabledInput.checked : this.soundEnabled,
                desktopNotifications: desktopNotificationsInput ? desktopNotificationsInput.checked : this.desktopNotifications,
                lowStockAlerts: lowStockAlertsInput ? lowStockAlertsInput.checked : this.lowStockAlerts,
                autoRefreshInterval: autoRefreshIntervalInput ? parseInt(autoRefreshIntervalInput.value) || 0 : this.autoRefreshInterval,
                cacheEnabled: cacheEnabledInput ? cacheEnabledInput.checked : this.cacheEnabled,
                autoBackupFrequency: autoBackupFrequencyInput ? parseInt(autoBackupFrequencyInput.value) || 24 : this.autoBackupFrequency,
                backupRetentionDays: backupRetentionDaysInput ? parseInt(backupRetentionDaysInput.value) || 30 : this.backupRetentionDays
            };

            // Update instance variables
            this.settings = settings;
            this.taxRate = settings.taxRate;
            this.currencySymbol = settings.currencySymbol;
            this.lowStockThreshold = settings.lowStockThreshold;
            this.dateFormat = settings.dateFormat;
            this.timeFormat = settings.timeFormat;
            this.itemsPerPage = settings.itemsPerPage;
            this.storeName = settings.storeName;
            this.storeAddress = settings.storeAddress;
            this.receiptFooter = settings.receiptFooter;
            this.autoPrint = settings.autoPrint;
            this.soundEnabled = settings.soundEnabled;
            this.desktopNotifications = settings.desktopNotifications;
            this.lowStockAlerts = settings.lowStockAlerts;
            this.autoRefreshInterval = settings.autoRefreshInterval;
            this.cacheEnabled = settings.cacheEnabled;
            this.autoBackupFrequency = settings.autoBackupFrequency;
            this.backupRetentionDays = settings.backupRetentionDays;

            // Save to localStorage
            localStorage.setItem('pos_settings', JSON.stringify(settings));
            
            // Apply settings
            this.applySettings();
            
            this.showMessage('Settings saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showMessage('Error saving settings', 'error');
        }
    }

    resetSettings() {
        try {
            // Reset to defaults
            this.settings = {};
            this.taxRate = 8.875;
            this.currencySymbol = '$';
            this.lowStockThreshold = 5;
            this.dateFormat = 'MM/DD/YYYY';
            this.timeFormat = '12';
            this.itemsPerPage = 50;
            this.storeName = '';
            this.storeAddress = '';
            this.receiptFooter = '';
            this.autoPrint = false;
            this.soundEnabled = false;
            this.desktopNotifications = false;
            this.lowStockAlerts = true;
            this.autoRefreshInterval = 0;
            this.cacheEnabled = true;
            this.autoBackupFrequency = 24;
            this.backupRetentionDays = 30;

            // Clear localStorage
            localStorage.removeItem('pos_settings');
            
            // Reload settings screen
            this.loadSettingsScreen();
            this.applySettings();
            
            this.showMessage('Settings reset to defaults!', 'success');
        } catch (error) {
            console.error('Error resetting settings:', error);
            this.showMessage('Error resetting settings', 'error');
        }
    }

    toggleDarkMode(forceState = null) {
        const isDark = forceState !== null ? forceState : !document.body.classList.contains('dark-mode');
        
        if (isDark) {
            document.body.classList.add('dark-mode');
            const icon = document.getElementById('dark-mode-icon');
            if (icon) icon.className = 'fas fa-sun';
        } else {
            document.body.classList.remove('dark-mode');
            const icon = document.getElementById('dark-mode-icon');
            if (icon) icon.className = 'fas fa-moon';
        }

        // Update settings checkbox if on settings screen
        const darkModeSetting = document.getElementById('dark-mode-setting');
        if (darkModeSetting) {
            darkModeSetting.checked = isDark;
        }

        // Save to settings
        this.settings.darkMode = isDark;
        this.saveSettings();
    }

    loadSettingsScreen() {
        // Load current settings into form
        const darkModeSetting = document.getElementById('dark-mode-setting');
        if (darkModeSetting) darkModeSetting.checked = this.settings.darkMode || false;
        
        const taxRateInput = document.getElementById('tax-rate');
        if (taxRateInput) taxRateInput.value = this.taxRate;
        
        const currencyInput = document.getElementById('currency-symbol');
        if (currencyInput) currencyInput.value = this.currencySymbol;
        
        const lowStockInput = document.getElementById('low-stock-threshold');
        if (lowStockInput) lowStockInput.value = this.lowStockThreshold;

        const dateFormatInput = document.getElementById('date-format');
        if (dateFormatInput) dateFormatInput.value = this.dateFormat || 'MM/DD/YYYY';

        const timeFormatInput = document.getElementById('time-format');
        if (timeFormatInput) timeFormatInput.value = this.timeFormat || '12';

        const itemsPerPageInput = document.getElementById('items-per-page');
        if (itemsPerPageInput) itemsPerPageInput.value = this.itemsPerPage || 50;

        const storeNameInput = document.getElementById('store-name');
        if (storeNameInput) storeNameInput.value = this.storeName || '';

        const storeAddressInput = document.getElementById('store-address');
        if (storeAddressInput) storeAddressInput.value = this.storeAddress || '';

        const receiptFooterInput = document.getElementById('receipt-footer');
        if (receiptFooterInput) receiptFooterInput.value = this.receiptFooter || '';

        const autoPrintInput = document.getElementById('auto-print');
        if (autoPrintInput) autoPrintInput.checked = this.autoPrint || false;

        const soundEnabledInput = document.getElementById('sound-enabled');
        if (soundEnabledInput) soundEnabledInput.checked = this.soundEnabled || false;

        const desktopNotificationsInput = document.getElementById('desktop-notifications');
        if (desktopNotificationsInput) desktopNotificationsInput.checked = this.desktopNotifications || false;

        const lowStockAlertsInput = document.getElementById('low-stock-alerts');
        if (lowStockAlertsInput) lowStockAlertsInput.checked = this.lowStockAlerts !== undefined ? this.lowStockAlerts : true;

        const autoRefreshIntervalInput = document.getElementById('auto-refresh-interval');
        if (autoRefreshIntervalInput) autoRefreshIntervalInput.value = this.autoRefreshInterval || 0;

        const cacheEnabledInput = document.getElementById('cache-enabled');
        if (cacheEnabledInput) cacheEnabledInput.checked = this.cacheEnabled !== undefined ? this.cacheEnabled : true;

        const autoBackupFrequencyInput = document.getElementById('auto-backup-frequency');
        if (autoBackupFrequencyInput) autoBackupFrequencyInput.value = this.autoBackupFrequency || 24;

        const backupRetentionDaysInput = document.getElementById('backup-retention-days');
        if (backupRetentionDaysInput) backupRetentionDaysInput.value = this.backupRetentionDays || 30;

        // Update system status display
        this.updateSystemStatus();
    }

    applySettings() {
        // Apply dark mode
        if (this.settings.darkMode) {
            document.body.classList.add('dark-mode');
            const icon = document.getElementById('dark-mode-icon');
            if (icon) icon.className = 'fas fa-sun';
        } else {
            document.body.classList.remove('dark-mode');
            const icon = document.getElementById('dark-mode-icon');
            if (icon) icon.className = 'fas fa-moon';
        }

        // Update tax display in cart summary
        const taxLabel = document.querySelector('#tax')?.parentElement;
        if (taxLabel) {
            const labelSpan = taxLabel.querySelector('span:first-child');
            if (labelSpan) labelSpan.textContent = `Tax (${this.taxRate}%):`;
        }

        // Update tax display in payment modal
        const paymentTaxLabel = document.querySelector('#payment-tax')?.parentElement;
        if (paymentTaxLabel) {
            const paymentLabelSpan = paymentTaxLabel.querySelector('span:first-child');
            if (paymentLabelSpan) paymentLabelSpan.textContent = `Tax (${this.taxRate}%):`;
        }

        // Refresh displays if they exist
        if (this.products && this.products.length > 0) {
            this.displayProducts();
        }
        if (this.cart && this.cart.length > 0) {
            this.updateCartSummary();
        }
    }

    formatCurrency(amount) {
        return `${this.currencySymbol}${amount.toFixed(2)}`;
    }

    async refreshAllData() {
        this.showMessage('Refreshing data...', 'success');
        await Promise.all([
            this.loadProducts(),
            this.loadSales(),
            this.updateSystemStatus()
        ]);
        
        if (this.currentScreen === 'products') {
            this.loadProductsTable();
        } else if (this.currentScreen === 'sales') {
            this.loadSalesTable();
            this.updateSalesSummary();
        }
        
        this.showMessage('Data refreshed successfully!', 'success');
    }

    escapeHtml(text) {
        // Helper function to escape HTML and prevent XSS
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showMessage(text, type = 'success') {
        const container = document.getElementById('message-container');
        const message = document.createElement('div');
        message.className = `message ${type}`;
        
        const icon = type === 'success' ? 'check-circle' : 
                    type === 'error' ? 'exclamation-circle' : 'exclamation-triangle';
        
        message.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${text}</span>
        `;
        
        container.appendChild(message);
        
        setTimeout(() => {
            message.remove();
        }, 3000);
    }
}

// Initialize the POS system when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.pos = new POSSystem();
});