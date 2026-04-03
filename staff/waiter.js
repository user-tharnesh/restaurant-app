// ===== Elysium Waiter Dashboard (API Version) =====

const MENU_DATA = [
    { id: 1, name: "Chicken Biryani", price: 250, category: "mains" },
    { id: 2, name: "Mutton Biryani", price: 350, category: "mains" },
    { id: 3, name: "Fish Biryani", price: 300, category: "mains" },
    { id: 4, name: "Prawn Biryani", price: 380, category: "mains" },
    { id: 5, name: "Chicken Fried Rice", price: 220, category: "mains" },
    { id: 6, name: "Veg Fried Rice", price: 180, category: "mains" },
    { id: 7, name: "Egg Fried Rice", price: 190, category: "mains" },
    { id: 8, name: "Tandoori Roti", price: 30, category: "mains" },
    { id: 9, name: "Plain Naan", price: 40, category: "mains" },
    { id: 10, name: "Butter Naan", price: 50, category: "mains" },
    { id: 11, name: "Butter Chicken", price: 280, category: "mains" },
    { id: 12, name: "Dal Makhani", price: 250, category: "mains" },
    { id: 13, name: "Paneer Tikka", price: 200, category: "starters" },
    { id: 14, name: "Chicken 65", price: 220, category: "starters" },
    { id: 15, name: "Mutton Seekh Kebab", price: 280, category: "starters" },
    { id: 16, name: "Chicken Samosa", price: 100, category: "starters" },
    { id: 17, name: "Gulab Jamun", price: 80, category: "desserts" },
    { id: 18, name: "Rasmalai", price: 120, category: "desserts" },
    { id: 20, name: "Palak Paneer", price: 230, category: "mains" },
    { id: 21, name: "Mango Lassi", price: 90, category: "desserts" }
];

const TABLE_COUNT = 15;
let currentUser = null;
let currentOrder = [];
let currentFilter = 'all';
let lastReadyCount = 0;
let lastOnlineCount = 0;

// ===== Auth Guard =====
function checkAuth() {
    const session = localStorage.getItem('elysium_session');
    if (!session) { window.location.href = 'login.html'; return false; }
    const data = JSON.parse(session);
    if (data.role !== 'waiter') { window.location.href = 'login.html'; return false; }
    currentUser = data;
    document.getElementById('user-name').textContent = data.name;
    document.getElementById('user-avatar').textContent = data.name.charAt(0).toUpperCase();
    return true;
}

function logout() {
    localStorage.removeItem('elysium_session');
    window.location.href = 'login.html';
}

// ===== View Switching =====
function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + viewName).classList.add('active');
    document.querySelectorAll('.sidebar-nav button').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`[data-view="${viewName}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    document.getElementById('sidebar').classList.remove('open');
    if (viewName === 'orders') refreshMyOrders();
    if (viewName === 'online-orders') refreshOnlineOrders();
}

// ===== Populate Table Select =====
function populateTableSelect() {
    const select = document.getElementById('order-table');
    for (let i = 1; i <= TABLE_COUNT; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Table ${i}`;
        select.appendChild(option);
    }
}

// ===== Menu Items =====
function renderMenuItems(filter = '') {
    const grid = document.getElementById('menu-items-grid');
    const searchTerm = filter.toLowerCase();
    const filtered = MENU_DATA.filter(item =>
        item.name.toLowerCase().includes(searchTerm) || item.category.toLowerCase().includes(searchTerm)
    );
    grid.innerHTML = filtered.map(item => {
        const inOrder = currentOrder.find(o => o.menuItem.id === item.id);
        const qty = inOrder ? inOrder.qty : 0;
        return `
            <div class="menu-item-card ${qty > 0 ? 'selected' : ''}" data-id="${item.id}">
                <div class="menu-item-category">${item.category}</div>
                <div class="menu-item-name">${item.name}</div>
                <div class="menu-item-price">₹${item.price}</div>
                <div class="qty-controls">
                    <button class="qty-btn" onclick="event.stopPropagation(); changeQty(${item.id}, -1)">−</button>
                    <span class="qty-value">${qty}</span>
                    <button class="qty-btn" onclick="event.stopPropagation(); changeQty(${item.id}, 1)">+</button>
                </div>
            </div>`;
    }).join('');
}

function changeQty(itemId, delta) {
    const item = MENU_DATA.find(m => m.id === itemId);
    if (!item) return;
    const existing = currentOrder.find(o => o.menuItem.id === itemId);
    if (existing) {
        existing.qty += delta;
        if (existing.qty <= 0) currentOrder = currentOrder.filter(o => o.menuItem.id !== itemId);
    } else if (delta > 0) {
        currentOrder.push({ menuItem: item, qty: 1 });
    }
    renderMenuItems(document.getElementById('menu-search').value);
    renderOrderSummary();
}

function renderOrderSummary() {
    const container = document.getElementById('order-summary-items');
    const totalEl = document.getElementById('order-total');
    if (currentOrder.length === 0) {
        container.innerHTML = `<div class="empty-state" style="padding:30px 0;"><div class="empty-state-icon">🛒</div><div class="empty-state-sub">Add items from the menu</div></div>`;
        totalEl.textContent = '₹0';
        return;
    }
    let total = 0;
    container.innerHTML = currentOrder.map((item, index) => {
        const subtotal = item.menuItem.price * item.qty;
        total += subtotal;
        return `<div class="summary-item"><div class="summary-item-info"><div class="summary-item-name">${item.menuItem.name}</div><div class="summary-item-qty">× ${item.qty}</div></div><span class="summary-item-price">₹${subtotal}</span><button class="summary-remove" onclick="removeFromOrder(${index})">✕</button></div>`;
    }).join('');
    totalEl.textContent = '₹' + total;
}

function removeFromOrder(index) {
    currentOrder.splice(index, 1);
    renderMenuItems(document.getElementById('menu-search').value);
    renderOrderSummary();
}

// ===== Place Order (API) =====
async function placeOrder() {
    const table = document.getElementById('order-table').value;
    const guests = document.getElementById('order-guests').value;
    const notes = document.getElementById('order-notes').value;
    if (!table) { showToast('Please select a table number', 'warning'); return; }
    if (currentOrder.length === 0) { showToast('Please add at least one item', 'warning'); return; }

    const total = currentOrder.reduce((sum, o) => sum + (o.menuItem.price * o.qty), 0);
    const order = {
        type: 'dine-in',
        items: currentOrder.map(o => ({ name: o.menuItem.name, price: o.menuItem.price, qty: o.qty })),
        table: parseInt(table),
        guests: parseInt(guests),
        status: 'pending',
        waiter: currentUser.username,
        waiterName: currentUser.name,
        total: total,
        notes: notes,
        paymentStatus: 'unpaid'
    };

    try {
        const result = await api.createOrder(order);
        showToast(`Order ${result.orderId} placed! Table ${table}`, 'success');
        currentOrder = [];
        document.getElementById('order-table').value = '';
        document.getElementById('order-guests').value = '2';
        document.getElementById('order-notes').value = '';
        document.getElementById('menu-search').value = '';
        renderMenuItems();
        renderOrderSummary();
        setTimeout(() => switchView('orders'), 500);
    } catch (err) {
        showToast('Failed to place order. Check server.', 'error');
    }
}

// ===== Refresh My Orders (API) =====
async function refreshMyOrders() {
    try {
        const allOrders = await api.getOrders({ waiter: currentUser.username, today: 'true' });
        const active = allOrders.filter(o => !['paid', 'served'].includes(o.status));
        const pending = allOrders.filter(o => o.status === 'pending');
        const ready = allOrders.filter(o => o.status === 'ready');
        const served = allOrders.filter(o => o.status === 'served' || o.status === 'paid');

        // Sound alert if new ready orders
        if (ready.length > lastReadyCount && lastReadyCount >= 0) {
            try { NotificationSound.orderReady(); } catch(e) {}
        }
        lastReadyCount = ready.length;

        document.getElementById('stat-active').textContent = active.length;
        document.getElementById('stat-pending').textContent = pending.length;
        document.getElementById('stat-ready').textContent = ready.length;
        document.getElementById('stat-served').textContent = served.length;

        let filtered = allOrders;
        if (currentFilter !== 'all') filtered = allOrders.filter(o => o.status === currentFilter);
        filtered.sort((a, b) => {
            if (a.status === 'ready' && b.status !== 'ready') return -1;
            if (b.status === 'ready' && a.status !== 'ready') return 1;
            return b.createdAt - a.createdAt;
        });

        const grid = document.getElementById('my-orders-grid');
        if (filtered.length === 0) {
            grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">No ${currentFilter === 'all' ? '' : currentFilter} orders</div><div class="empty-state-sub">Take a new order to get started</div></div>`;
        } else {
            grid.innerHTML = filtered.map(o => renderOrderCard(o)).join('');
        }
    } catch (err) {
        console.error('Failed to fetch orders:', err);
    }
}

function renderOrderCard(order) {
    const time = new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const isReady = order.status === 'ready';
    const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]');
    let actions = '';
    if (order.status === 'ready') actions = `<button class="btn btn-success btn-sm" onclick="markServed('${order.id}')">✓ Mark Served</button>`;
    else if (order.status === 'pending') actions = `<span class="badge badge-pending">⏳ Waiting for Kitchen</span>`;
    else if (order.status === 'cooking') actions = `<span class="badge badge-cooking">🔥 Being Prepared</span>`;
    else if (order.status === 'served') actions = `<span class="badge badge-served">✓ Served</span>`;
    else if (order.status === 'paid') actions = `<span class="badge badge-paid">💰 Paid</span>`;

    return `
        <div class="order-card ${isReady ? 'ready-highlight' : ''} animate-in">
            <div class="order-card-header">
                <div><div class="order-id">${order.id}</div><div class="order-time">${time} · ${order.type === 'online' ? '🌐 Online' : '🍽️ Table ' + order.tableNum}</div></div>
                <span class="badge badge-${order.status}">${order.status.toUpperCase()}</span>
            </div>
            <ul class="order-items-list">${items.map(i => `<li><span>${i.name} × ${i.qty}</span><span>₹${i.price * i.qty}</span></li>`).join('')}</ul>
            ${order.notes ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:12px;">📝 ${order.notes}</div>` : ''}
            <div class="order-card-footer"><span class="order-total">₹${order.total}</span><div class="order-actions">${actions}</div></div>
        </div>`;
}

async function markServed(orderId) {
    await api.updateOrder(orderId, { status: 'served' });
    showToast(`Order ${orderId} marked as served`, 'success');
    refreshMyOrders();
}

function filterOrders(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.filter-tab[data-filter="${filter}"]`).classList.add('active');
    refreshMyOrders();
}

// ===== Online Orders (API) =====
async function refreshOnlineOrders() {
    try {
        const onlineOrders = await api.getOnlineOrders();
        const countBadge = document.getElementById('online-count');
        if (onlineOrders.length > 0) {
            countBadge.textContent = onlineOrders.length; countBadge.classList.add('show');
            // Sound alert for new online orders
            if (onlineOrders.length > lastOnlineCount && lastOnlineCount >= 0) {
                try { NotificationSound.onlineOrder(); } catch(e) {}
            }
        }
        else { countBadge.classList.remove('show'); }
        lastOnlineCount = onlineOrders.length;

        const grid = document.getElementById('online-orders-grid');
        if (onlineOrders.length === 0) {
            grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🌐</div><div class="empty-state-text">No pending online orders</div><div class="empty-state-sub">Online orders will appear here when customers place them</div></div>`;
            return;
        }
        grid.innerHTML = onlineOrders.map(order => {
            const time = new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]');
            return `
                <div class="order-card animate-in">
                    <div class="order-card-header"><div><div class="order-id">${order.id}</div><div class="order-time">${time} · 🌐 Online Order</div></div><span class="badge badge-online">ONLINE</span></div>
                    <ul class="order-items-list">${items.map(i => `<li><span>${i.name} × ${i.qty}</span><span>₹${i.price * i.qty}</span></li>`).join('')}</ul>
                    ${order.customerPhone ? `<div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:12px;">📞 ${order.customerPhone}</div>` : ''}
                    <div class="order-card-footer"><span class="order-total">₹${order.total}</span><button class="btn btn-primary btn-sm" onclick="claimOnlineOrder('${order.id}')">🙋 Claim Order</button></div>
                </div>`;
        }).join('');
    } catch (err) {
        console.error('Failed to fetch online orders:', err);
    }
}

async function claimOnlineOrder(orderId) {
    await api.updateOrder(orderId, { waiter: currentUser.username, waiterName: currentUser.name });
    showToast(`Online order ${orderId} claimed!`, 'success');
    refreshOnlineOrders();
    refreshMyOrders();
}

// ===== Toast =====
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-message">${message}</span><button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; setTimeout(() => toast.remove(), 300); }, 4000);
}

// ===== Mobile Toggle =====
document.getElementById('mobile-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
});

// ===== Auto Refresh =====
function startAutoRefresh() {
    setInterval(() => {
        const activeView = document.querySelector('.view.active');
        if (activeView.id === 'view-orders') refreshMyOrders();
        if (activeView.id === 'view-online-orders') refreshOnlineOrders();
        // Update online count badge
        api.getOnlineOrders().then(orders => {
            const countBadge = document.getElementById('online-count');
            if (orders.length > 0) { countBadge.textContent = orders.length; countBadge.classList.add('show'); }
            else { countBadge.classList.remove('show'); }
        }).catch(() => {});
    }, 5000);
}

// ===== Init =====
if (checkAuth()) {
    populateTableSelect();
    renderMenuItems();
    renderOrderSummary();
    refreshMyOrders();
    refreshOnlineOrders();
    startAutoRefresh();
    document.getElementById('menu-search').addEventListener('input', (e) => { renderMenuItems(e.target.value); });
}
