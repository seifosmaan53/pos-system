// POS System - Frontend JavaScript
class POSSystem {
    constructor() {
        this.cart = [];
        this.products = [];
        this.sales = [];
        this.currentScreen = 'pos';
        this.editingProduct = null;
        
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
                // Empty search - show all products
                this.displayProducts();
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

        // Close modals on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }

    switchScreen(screenName) {
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-screen="${screenName}"]`).classList.add('active');

        // Update screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(`${screenName}-screen`).classList.add('active');

        this.currentScreen = screenName;

        // Load data for specific screens
        if (screenName === 'products') {
            this.loadProductsTable();
        } else if (screenName === 'sales') {
            this.loadSalesTable();
            this.updateSalesSummary();
        }
    }

    updateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', {
            hour12: true,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        document.getElementById('current-time').textContent = timeString;
    }

    async updateSystemStatus() {
        try {
            const response = await fetch('/api/health');
            const health = await response.json();
            
            // Update system status elements
            const statusElement = document.querySelector('.status-online');
            if (statusElement) {
                statusElement.textContent = health.status;
                statusElement.className = health.status === 'OK' ? 'status-online' : 'status-offline';
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
                    statusText.textContent = health.status === 'OK' ? 'Online' : 'Offline';
                }
            }
            
        } catch (error) {
            console.error('Failed to update system status:', error);
            // Update to show offline status
            const statusElement = document.querySelector('.status-online');
            if (statusElement) {
                statusElement.textContent = 'Offline';
                statusElement.className = 'status-offline';
            }
            
            const connectionStatus = document.getElementById('connection-status');
            if (connectionStatus) {
                const statusText = connectionStatus.querySelector('span');
                if (statusText) {
                    statusText.textContent = 'Offline';
                }
            }
        }
    }

    setDateFilter() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('date-filter').value = today;
    }

    async loadProducts() {
        try {
            const response = await fetch('/api/products');
            this.products = await response.json();
            this.displayProducts();
        } catch (error) {
            console.error('Error loading products:', error);
            this.showMessage('Error loading products', 'error');
        }
    }

    displayProducts() {
        const container = document.getElementById('products-grid');
        container.innerHTML = '';

        if (this.products.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-boxes"></i><p>No products found</p></div>';
            return;
        }

        this.products.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = `product-card ${product.stock_quantity <= 5 ? 'low-stock' : ''}`;
            productCard.innerHTML = `
                <div class="product-name">${product.name}</div>
                <div class="product-price">$${parseFloat(product.price).toFixed(2)}</div>
                <div class="product-stock ${product.stock_quantity <= 5 ? 'low' : ''}">
                    Stock: ${product.stock_quantity}
                </div>
            `;
            productCard.addEventListener('click', () => this.addToCart(product));
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
            console.log(`📋 Loading receipt for order: ${cleanOrderId}`);
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
                            <div class="item-price">$${(item.quantity * item.price).toFixed(2)}</div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="receipt-totals">
                    <div class="receipt-total-row">
                        <span>Subtotal:</span>
                        <span>$${totals.subtotal.toFixed(2)}</span>
                    </div>
                    <div class="receipt-total-row">
                        <span>Tax (8.875%):</span>
                        <span>$${totals.tax.toFixed(2)}</span>
                    </div>
                    <div class="receipt-total-row final">
                        <span>Total:</span>
                        <span>$${totals.total.toFixed(2)}</span>
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
                console.log('Window.open failed, trying alternative method');
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
                console.log('Iframe method failed, trying current window method');
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
                console.log('Preview window.open failed, trying modal method');
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
        const tax = subtotal * 0.08875;
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
                    <span class="item-price">$${(item.price * item.quantity).toFixed(2)}</span>
                </div>
            `).join('')}
        </div>
        
        <div class="totals">
            <div class="total-row">
                <span>Subtotal:</span>
                <span>$${subtotal.toFixed(2)}</span>
            </div>
            <div class="total-row">
                <span>Tax (8.875%):</span>
                <span>$${tax.toFixed(2)}</span>
            </div>
            <div class="total-row final-total">
                <span>TOTAL:</span>
                <span>$${total.toFixed(2)}</span>
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
        const container = document.getElementById('products-grid');
        const cards = container.querySelectorAll('.product-card');
        
        cards.forEach(card => {
            const name = card.querySelector('.product-name').textContent.toLowerCase();
            const matches = name.includes(query.toLowerCase());
            card.style.display = matches ? 'block' : 'none';
        });
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
        const tax = subtotal * 0.08875; // New York City tax rate (8.875%)
        const total = subtotal + tax;

        // Update totals
        document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('tax').textContent = `$${tax.toFixed(2)}`;
        document.getElementById('total').textContent = `$${total.toFixed(2)}`;

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
                        <div class="item-details">$${item.price.toFixed(2)} each</div>
                </div>
                    <div class="item-controls">
                        <button class="quantity-btn" onclick="pos.updateQuantity(${item.id}, -1)">-</button>
                        <span class="item-quantity">${item.quantity}</span>
                        <button class="quantity-btn" onclick="pos.updateQuantity(${item.id}, 1)">+</button>
                </div>
                    <div class="item-total">$${(item.price * item.quantity).toFixed(2)}</div>
                    <div class="remove-item" onclick="pos.removeFromCart(${item.id})">
                        <i class="fas fa-trash"></i>
                    </div>
                </div>
            `).join('');
        }
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
        const tax = subtotal * 0.08875; // New York City tax rate (8.875%)
        const total = subtotal + tax;

        document.getElementById('payment-subtotal').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('payment-tax').textContent = `$${tax.toFixed(2)}`;
        document.getElementById('payment-total').textContent = `$${total.toFixed(2)}`;

        document.getElementById('payment-modal').classList.add('active');
    }

    hidePaymentModal() {
        document.getElementById('payment-modal').classList.remove('active');
    }

    async completePayment() {
        try {
            const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const tax = subtotal * 0.08875; // New York City tax rate (8.875%)
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
                
                // Print receipt automatically
                this.printReceipt();
                
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
        console.log('Barcode scanned:', barcode);
        
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
                name: document.getElementById('product-name').value,
                sku: document.getElementById('product-sku').value,
                barcode: document.getElementById('product-barcode').value,
            price: parseFloat(document.getElementById('product-price').value),
                stock_quantity: parseInt(document.getElementById('product-stock').value) || 0
        };

            // Validate required fields
            if (!formData.name || !formData.sku || !formData.price) {
                this.showMessage('Please fill in all required fields', 'error');
            return;
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
                throw new Error(result.error || 'Failed to save product');
            }
        } catch (error) {
            console.error('Error saving product:', error);
            this.showMessage(`Error saving product: ${error.message}`, 'error');
        }
    }

    async loadProductsTable() {
        try {
            const response = await fetch('/api/products');
            this.products = await response.json();
            
            const tbody = document.getElementById('products-table-body');
            tbody.innerHTML = '';

            this.products.forEach(product => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${product.name}</td>
                    <td>${product.sku}</td>
                    <td>${product.barcode || '-'}</td>
                    <td>$${parseFloat(product.price).toFixed(2)}</td>
                    <td class="${product.stock_quantity <= 5 ? 'low-stock' : ''}">${product.stock_quantity}</td>
                    <td>
                        <button class="edit-btn" onclick="pos.showProductModal(${JSON.stringify(product).replace(/"/g, '&quot;')})" title="Edit Product">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-btn" onclick="pos.deleteProduct(${product.id})" title="Delete Product">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading products table:', error);
            this.showMessage('Error loading products', 'error');
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
                
                row.innerHTML = `
                <td>${sale.order_id || 'N/A'}</td>
                <td>${date} ${time}</td>
                <td>${sale.item_count || 0} items</td>
                <td><span class="payment-icon">${paymentMethodIcon}</span> ${paymentMethodText}</td>
                <td>$${parseFloat(sale.total_amount).toFixed(2)}</td>
                `;
            row.addEventListener('click', () => this.showReceipt(sale.order_id));
                tbody.appendChild(row);
        });
    }

    updateSalesSummary() {
        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        
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

    filterSalesByDate(date) {
        if (!date) {
            this.loadSalesTable();
            return;
        }

        const filteredSales = this.sales.filter(sale => 
            sale.created_at.startsWith(date)
        );

        const tbody = document.getElementById('sales-table-body');
        tbody.innerHTML = '';

        if (filteredSales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px;">No sales found for this date</td></tr>';
                return;
            }

        filteredSales.forEach(sale => {
            const row = document.createElement('tr');
            const date = new Date(sale.created_at).toLocaleDateString();
            const time = new Date(sale.created_at).toLocaleTimeString();
            
            row.innerHTML = `
                <td>#${sale.id}</td>
                <td>${date} ${time}</td>
                <td>${sale.items ? sale.items.length : 0} items</td>
                <td>$${parseFloat(sale.total_amount).toFixed(2)}</td>
            `;
            tbody.appendChild(row);
        });
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