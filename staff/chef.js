// ===== Elysium Chef Dashboard (API Version) =====

let currentUser = null;
let lastQueueCount = 0; // Track queue size for sound alerts

// ===== Auth Guard =====
function checkAuth() {
    const session = localStorage.getItem('elysium_session');
    if (!session) { window.location.href = 'login.html'; return false; }
    const data = JSON.parse(session);
    if (data.role !== 'chef') { window.location.href = 'login.html'; return false; }
    currentUser = data;
    document.getElementById('user-name').textContent = data.name;
    document.getElementById('user-avatar').textContent = data.name.charAt(0).toUpperCase();
    return true;
}

function logout() { localStorage.removeItem('elysium_session'); window.location.href = 'login.html'; }

// ===== View Switching =====
function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + viewName).classList.add('active');
    document.querySelectorAll('.sidebar-nav button').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`[data-view="${viewName}"]`);
    if (btn) btn.classList.add('active');
    document.getElementById('sidebar').classList.remove('open');
    if (viewName === 'queue') refreshQueue();
    if (viewName === 'cooking') refreshCooking();
    if (viewName === 'completed') refreshCompleted();
}

// ===== Time Helpers =====
function getElapsedMinutes(timestamp) { return Math.floor((Date.now() - timestamp) / 60000); }
function getTimeClass(minutes) {
    if (minutes < 10) return 'normal';
    if (minutes < 20) return 'warning';
    return 'critical';
}

// ===== Render Kitchen Card =====
function renderKitchenCard(order, mode) {
    const elapsed = getElapsedMinutes(order.createdAt);
    const timeClass = getTimeClass(elapsed);
    const isUrgent = elapsed >= 20 && order.status === 'pending';
    const isCooking = order.status === 'cooking';
    const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]');

    let actions = '';
    if (mode === 'queue') actions = `<button class="btn btn-primary" onclick="acceptOrder('${order.id}')">🔥 Start Cooking</button>`;
    else if (mode === 'cooking') actions = `<button class="btn btn-success" onclick="markReady('${order.id}')">✅ Ready for Pickup</button>`;
    else actions = `<span class="badge badge-ready">✓ Completed</span>`;

    const typeLabel = order.type === 'online' ? '🌐 Online Order' : `🍽️ Table ${order.tableNum}`;

    return `
        <div class="kitchen-card ${isUrgent ? 'urgent' : ''} ${isCooking ? 'cooking-active' : ''}">
            <div class="kitchen-card-header">
                <span class="kitchen-order-id">${order.id}</span>
                <div class="kitchen-order-meta">
                    <span class="kitchen-order-type">${typeLabel}</span>
                    <span class="time-elapsed ${timeClass}">${elapsed}m ago</span>
                </div>
            </div>
            <div class="kitchen-card-body">
                <ul class="kitchen-items-list">
                    ${items.map(i => `<li><span><span class="item-qty">×${i.qty}</span> ${i.name}</span><span style="color:var(--text-muted)">₹${i.price * i.qty}</span></li>`).join('')}
                </ul>
                ${order.notes ? `<div class="kitchen-notes">📝 ${order.notes}</div>` : ''}
            </div>
            <div class="kitchen-card-footer">
                <span class="kitchen-waiter-info">👤 ${order.waiterName || 'Unassigned'}</span>
                ${actions}
            </div>
        </div>`;
}

// ===== Refresh Views (API) =====
async function refreshQueue() {
    try {
        const orders = await api.getOrders({ status: 'pending' });
        orders.sort((a, b) => a.createdAt - b.createdAt);
        updateStats();

        const grid = document.getElementById('queue-grid');
        if (orders.length === 0) {
            grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">☕</div><div class="empty-state-text">No pending orders</div><div class="empty-state-sub">Relax, the queue is clear!</div></div>`;
        } else {
            grid.innerHTML = orders.map(o => renderKitchenCard(o, 'queue')).join('');
        }

        const badge = document.getElementById('queue-count');
        if (orders.length > 0) {
            badge.textContent = orders.length; badge.classList.add('show');
            // Play sound if new orders appeared
            if (orders.length > lastQueueCount && lastQueueCount >= 0) {
                try { NotificationSound.newOrder(); } catch(e) {}
            }
        } else { badge.classList.remove('show'); }
        lastQueueCount = orders.length;
    } catch (err) { console.error('Queue refresh failed:', err); }
}

async function refreshCooking() {
    try {
        const orders = await api.getOrders({ status: 'cooking', chef: currentUser.username });
        const grid = document.getElementById('cooking-grid');
        if (orders.length === 0) {
            grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👨‍🍳</div><div class="empty-state-text">Not cooking anything</div><div class="empty-state-sub">Accept an order from the queue</div></div>`;
        } else {
            grid.innerHTML = orders.map(o => renderKitchenCard(o, 'cooking')).join('');
        }
    } catch (err) { console.error('Cooking refresh failed:', err); }
}

async function refreshCompleted() {
    try {
        const orders = await api.getOrders({ chef: currentUser.username, today: 'true' });
        const completed = orders.filter(o => ['ready', 'served', 'paid'].includes(o.status));
        completed.sort((a, b) => b.updatedAt - a.updatedAt);

        const grid = document.getElementById('completed-grid');
        if (completed.length === 0) {
            grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">No completed orders yet</div><div class="empty-state-sub">Completed orders will appear here</div></div>`;
        } else {
            grid.innerHTML = completed.map(o => renderKitchenCard(o, 'completed')).join('');
        }
    } catch (err) { console.error('Completed refresh failed:', err); }
}

async function updateStats() {
    try {
        const all = await api.getOrders({ today: 'true' });
        document.getElementById('stat-queue').textContent = all.filter(o => o.status === 'pending').length;
        document.getElementById('stat-cooking').textContent = all.filter(o => o.status === 'cooking').length;
        document.getElementById('stat-ready').textContent = all.filter(o => o.status === 'ready').length;
        document.getElementById('stat-completed').textContent = all.filter(o => ['ready', 'served', 'paid'].includes(o.status)).length;
    } catch (err) {}
}

// ===== Actions (API) — inventory deducted on server side =====
async function acceptOrder(orderId) {
    try {
        const result = await api.updateOrder(orderId, { status: 'cooking', chef: currentUser.username, chefName: currentUser.name });
        let msg = `Order ${orderId} accepted! Ingredients deducted from inventory.`;
        if (result.lowStockWarnings && result.lowStockWarnings.length > 0) {
            try { NotificationSound.warning(); } catch(e) {}
            showToast(`⚠️ Low stock: ${result.lowStockWarnings.join(', ')}`, 'warning');
        }
        showToast(msg, 'success');
        refreshQueue();
    } catch (err) { showToast('Failed to accept order', 'error'); }
}

async function markReady(orderId) {
    await api.updateOrder(orderId, { status: 'ready' });
    showToast(`Order ${orderId} is ready for pickup! 🔔`, 'success');
    refreshCooking();
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

// ===== Mobile =====
document.getElementById('mobile-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
});

// ===== Auto Refresh (3s for kitchen) =====
function startAutoRefresh() {
    setInterval(() => {
        const activeView = document.querySelector('.view.active');
        if (activeView.id === 'view-queue') refreshQueue();
        if (activeView.id === 'view-cooking') refreshCooking();
    }, 3000);
}

// ===== Init =====
if (checkAuth()) {
    refreshQueue();
    startAutoRefresh();
}
