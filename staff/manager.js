// ===== Elysium Manager Dashboard (API Version) =====

let currentUser = null;
let orderFilterStatus = 'all';

// ===== Auth =====
function checkAuth() {
    const session = localStorage.getItem('elysium_session');
    if (!session) { window.location.href = 'login.html'; return false; }
    const data = JSON.parse(session);
    if (data.role !== 'manager') { window.location.href = 'login.html'; return false; }
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
    document.querySelector(`[data-view="${viewName}"]`)?.classList.add('active');
    document.getElementById('sidebar').classList.remove('open');
    if (viewName === 'overview') refreshOverview();
    if (viewName === 'inventory') refreshInventory();
    if (viewName === 'orders') refreshAllOrders();
    if (viewName === 'staff') refreshStaff();
}

// ===== Overview (API) =====
async function refreshOverview() {
    document.getElementById('overview-date').textContent =
        new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const stats = await api.getTodayStats();
    const todayOrders = await api.getOrders({ today: 'true' });

    document.getElementById('ov-total-orders').textContent = stats.totalOrders;
    document.getElementById('ov-revenue').textContent = '₹' + stats.revenue.toLocaleString('en-IN');
    document.getElementById('ov-avg').textContent = '₹' + stats.avgOrder.toLocaleString('en-IN');
    document.getElementById('ov-profit').textContent = '₹' + stats.profit.toLocaleString('en-IN');

    // Status bars
    const statuses = ['pending', 'cooking', 'ready', 'served', 'paid'];
    const maxCount = Math.max(...statuses.map(s => todayOrders.filter(o => o.status === s).length), 1);
    document.getElementById('status-bars').innerHTML = statuses.map(s => {
        const count = todayOrders.filter(o => o.status === s).length;
        return `<div class="status-bar-row"><span class="status-bar-label">${s.charAt(0).toUpperCase()+s.slice(1)}</span><div class="status-bar-track"><div class="status-bar-fill ${s}" style="width:${(count/maxCount)*100}%">${count}</div></div><span class="status-bar-count">${count}</span></div>`;
    }).join('');

    // Payment split
    document.getElementById('payment-split').innerHTML = `
        <div class="payment-split-item"><span class="payment-split-icon">💵</span><div class="payment-split-info"><div class="payment-split-label">Cash</div><div class="payment-split-value">₹${stats.cashTotal.toLocaleString('en-IN')}</div></div></div>
        <div class="payment-split-item"><span class="payment-split-icon">📱</span><div class="payment-split-info"><div class="payment-split-label">UPI</div><div class="payment-split-value">₹${stats.upiTotal.toLocaleString('en-IN')}</div></div></div>
        <div class="payment-split-item"><span class="payment-split-icon">💳</span><div class="payment-split-info"><div class="payment-split-label">Card</div><div class="payment-split-value">₹${stats.cardTotal.toLocaleString('en-IN')}</div></div></div>`;

    // Top items
    const itemCounts = {};
    todayOrders.forEach(o => {
        const items = Array.isArray(o.items) ? o.items : JSON.parse(o.items || '[]');
        items.forEach(i => {
            if (!itemCounts[i.name]) itemCounts[i.name] = { qty: 0, revenue: 0 };
            itemCounts[i.name].qty += i.qty;
            itemCounts[i.name].revenue += i.price * i.qty;
        });
    });
    const sorted = Object.entries(itemCounts).sort((a, b) => b[1].qty - a[1].qty).slice(0, 10);
    const tbody = document.getElementById('top-items-tbody');
    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:30px;">No orders today yet</td></tr>';
    } else {
        tbody.innerHTML = sorted.map(([name, data], i) => `<tr><td style="color:var(--text-muted)">${i+1}</td><td style="font-weight:600">${name}</td><td>${data.qty}</td><td style="color:var(--accent-gold);font-weight:600">₹${data.revenue}</td></tr>`).join('');
    }
}

// ===== Inventory (API) =====
async function refreshInventory() {
    const inventory = await api.getInventory();
    const low = inventory.filter(i => i.quantity <= i.lowStockThreshold);
    const totalValue = inventory.reduce((s, i) => s + (i.quantity * i.costPerUnit), 0);

    document.getElementById('inv-total').textContent = inventory.length;
    document.getElementById('inv-low').textContent = low.length;
    document.getElementById('inv-value').textContent = '₹' + Math.round(totalValue).toLocaleString('en-IN');

    const tbody = document.getElementById('inventory-tbody');
    if (inventory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:30px;">No inventory items</td></tr>';
        return;
    }
    tbody.innerHTML = inventory.map(item => {
        const isLow = item.quantity <= item.lowStockThreshold;
        return `<tr>
            <td style="font-weight:600">${item.name}</td>
            <td class="${isLow?'stock-low':''}">${parseFloat(item.quantity.toFixed(2))}</td>
            <td>${item.unit}</td><td>₹${item.costPerUnit}</td>
            <td>₹${Math.round(item.quantity*item.costPerUnit).toLocaleString('en-IN')}</td>
            <td>${isLow?'<span class="badge badge-pending">⚠️ LOW STOCK</span>':'<span class="stock-ok">✓ OK</span>'}</td>
            <td><div class="inv-actions"><button class="btn btn-secondary btn-sm" onclick="editInventoryItem(${item.id})">✏️</button><button class="btn btn-danger btn-sm" onclick="deleteInventoryItem(${item.id})">🗑️</button></div></td></tr>`;
    }).join('');
}

function openInventoryModal(editItem = null) {
    document.getElementById('inv-modal-title').textContent = editItem ? 'Edit Item' : 'Add Inventory Item';
    document.getElementById('inv-edit-id').value = editItem ? editItem.id : '';
    document.getElementById('inv-name').value = editItem ? editItem.name : '';
    document.getElementById('inv-qty').value = editItem ? editItem.quantity : '';
    document.getElementById('inv-unit').value = editItem ? editItem.unit : 'kg';
    document.getElementById('inv-cost').value = editItem ? editItem.costPerUnit : '';
    document.getElementById('inv-threshold').value = editItem ? editItem.lowStockThreshold : '10';
    document.getElementById('inventory-modal').classList.add('active');
}

function closeInventoryModal() { document.getElementById('inventory-modal').classList.remove('active'); }

async function editInventoryItem(id) {
    const inventory = await api.getInventory();
    const item = inventory.find(i => i.id === id);
    if (item) openInventoryModal(item);
}

async function deleteInventoryItem(id) {
    if (!confirm('Delete this inventory item?')) return;
    await api.deleteInventoryItem(id);
    showToast('Item deleted', 'info');
    refreshInventory();
}

async function saveInventoryItem(e) {
    e.preventDefault();
    const editId = document.getElementById('inv-edit-id').value;
    const item = {
        name: document.getElementById('inv-name').value,
        quantity: parseFloat(document.getElementById('inv-qty').value),
        unit: document.getElementById('inv-unit').value,
        costPerUnit: parseFloat(document.getElementById('inv-cost').value),
        lowStockThreshold: parseFloat(document.getElementById('inv-threshold').value)
    };

    if (editId) {
        await api.updateInventoryItem(editId, item);
    } else {
        await api.addInventoryItem(item);
    }

    closeInventoryModal();
    showToast(editId ? 'Item updated' : 'Item added', 'success');
    refreshInventory();
}

// ===== AI Features =====
async function generateAIBriefing() {
    const btn = document.getElementById('btn-generate-ai');
    const content = document.getElementById('ai-briefing-content');
    
    btn.disabled = true;
    btn.textContent = "Analyzing...";
    content.innerHTML = `<p style="color:var(--accent-gold); margin:0;">Scanning orders, inventory, and transactions... please wait.</p>`;

    try {
        // We use relative path or domain depending on deployment. It's under the same domain.
        const response = await fetch('/api/ai/daily-briefing');
        const data = await response.json();
        
        // Web Speech API for voice readout
        function speakBriefing(htmlString) {
            // Strip HTML tags for clean voice
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = htmlString;
            const cleanText = tempDiv.textContent || tempDiv.innerText || "";
            
            // Stop any ongoing speech first
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance("Here is your daily AI briefing: " + cleanText);
            // Feel free to tweak voice pitch and speed optionally:
            // utterance.rate = 1.0; 
            // utterance.pitch = 1.0;
            window.speechSynthesis.speak(utterance);
        }

        if (data.success && data.data && data.data.briefingHtml) {
            content.innerHTML = `<div style="background:rgba(255,193,7,0.1); padding: 15px; border-radius: 8px;">${data.data.briefingHtml}</div>`;
            speakBriefing(data.data.briefingHtml);
        } else if (data.success && data.data) {
             const key = Object.keys(data.data)[0];
             content.innerHTML = `<div style="background:rgba(255,193,7,0.1); padding: 15px; border-radius: 8px;">${data.data[key]}</div>`;
             speakBriefing(data.data[key]);
        } else {
            content.innerHTML = `<p style="color:var(--danger); margin:0;">Error: ${data.message} ${data.error || ''}</p>`;
        }
    } catch (e) {
        content.innerHTML = `<p style="color:var(--danger); margin:0;">Error connecting to server to generate briefing.</p>`;
    } finally {
        btn.disabled = false;
        btn.textContent = "Generate Briefing";
    }
}

// ===== All Orders (API) =====
function filterAllOrders(status) {
    orderFilterStatus = status;
    document.querySelectorAll('.filter-tabs-inline .filter-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.filter-tabs-inline .filter-tab[data-filter="${status}"]`)?.classList.add('active');
    refreshAllOrders();
}

async function refreshAllOrders() {
    const filters = {};
    if (orderFilterStatus !== 'all') filters.status = orderFilterStatus;
    const orders = await api.getOrders(filters);

    const tbody = document.getElementById('all-orders-tbody');
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:30px;">No orders found</td></tr>';
        return;
    }
    tbody.innerHTML = orders.map(o => {
        const time = new Date(o.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        const items = Array.isArray(o.items) ? o.items : JSON.parse(o.items || '[]');
        const itemsText = items.map(i => `${i.name}×${i.qty}`).join(', ');
        const type = o.type === 'online' ? '🌐 Online' : '🍽️ T' + o.tableNum;
        return `<tr>
            <td style="font-weight:600;color:var(--accent-gold)">${o.id}</td><td>${type}</td>
            <td style="font-size:0.8rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${itemsText}">${itemsText}</td>
            <td style="font-weight:600">₹${o.total}</td><td>${o.waiterName||'—'}</td><td>${o.chefName||'—'}</td>
            <td><span class="badge badge-${o.status}">${o.status.toUpperCase()}</span></td>
            <td style="color:var(--text-muted);font-size:0.85rem">${time}</td></tr>`;
    }).join('');
}

// ===== Staff (API) =====
async function refreshStaff() {
    const staffData = await api.getStaff();
    const todayOrders = await api.getOrders({ today: 'true' });
    const todayTxns = await api.getTransactions({ today: 'true' });

    const grid = document.getElementById('staff-grid');
    grid.innerHTML = staffData.map(staff => {
        let s1Label, s1Value, s2Label, s2Value;
        if (staff.role === 'waiter') {
            const wo = todayOrders.filter(o => o.waiter === staff.username);
            s1Label = 'Orders Today'; s1Value = wo.length;
            s2Label = 'Revenue'; s2Value = '₹' + wo.reduce((s, o) => s + o.total, 0).toLocaleString('en-IN');
        } else if (staff.role === 'chef') {
            const co = todayOrders.filter(o => o.chef === staff.username);
            s1Label = 'Cooked Today'; s1Value = co.filter(o => ['ready','served','paid'].includes(o.status)).length;
            s2Label = 'Cooking Now'; s2Value = co.filter(o => o.status === 'cooking').length;
        } else if (staff.role === 'cashier') {
            const ct = todayTxns.filter(t => t.cashier === staff.username);
            s1Label = 'Bills Today'; s1Value = ct.length;
            s2Label = 'Collection'; s2Value = '₹' + ct.reduce((s, t) => s + t.finalAmount, 0).toLocaleString('en-IN');
        } else {
            s1Label = 'Total Orders'; s1Value = todayOrders.length;
            s2Label = 'Revenue'; s2Value = '₹' + todayTxns.reduce((s, t) => s + t.finalAmount, 0).toLocaleString('en-IN');
        }
        return `<div class="staff-card animate-in"><div class="staff-card-header"><div class="staff-avatar">${staff.icon}</div><div><div class="staff-name">${staff.name}</div><div class="staff-role">${staff.role}</div></div></div><div class="staff-stats"><div class="staff-stat"><div class="staff-stat-value">${s1Value}</div><div class="staff-stat-label">${s1Label}</div></div><div class="staff-stat"><div class="staff-stat-value">${s2Value}</div><div class="staff-stat-label">${s2Label}</div></div></div></div>`;
    }).join('');
}

// ===== Toast =====
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-message">${message}</span><button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
}

document.getElementById('mobile-toggle').addEventListener('click', () => { document.getElementById('sidebar').classList.toggle('open'); });
document.getElementById('inventory-modal').addEventListener('click', (e) => { if (e.target === document.getElementById('inventory-modal')) closeInventoryModal(); });
setInterval(() => { const v = document.querySelector('.view.active'); if (v.id === 'view-overview') refreshOverview(); }, 10000);

if (checkAuth()) { refreshOverview(); }
