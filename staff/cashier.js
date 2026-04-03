// ===== Elysium Cashier Dashboard (API Version) =====

const GST_RATE = 0.05;
let currentUser = null;
let currentBillOrder = null;
let selectedPaymentMethod = 'cash';
let lastBillableCount = 0;

// ===== Auth =====
function checkAuth() {
    const session = localStorage.getItem('elysium_session');
    if (!session) { window.location.href = 'login.html'; return false; }
    const data = JSON.parse(session);
    if (data.role !== 'cashier') { window.location.href = 'login.html'; return false; }
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
    if (viewName === 'billing') refreshBilling();
    if (viewName === 'collection') refreshCollection();
    if (viewName === 'history') refreshHistory();
}

// ===== Billing Queue (API) =====
async function refreshBilling() {
    try {
        const allOrders = await api.getOrders({ today: 'true' });
        const billable = allOrders.filter(o => (o.status === 'ready' || o.status === 'served') && o.paymentStatus === 'unpaid');

        const todayTxns = await api.getTransactions({ today: 'true' });
        const todayRevenue = todayTxns.reduce((s, t) => s + t.finalAmount, 0);
        const pendingAmount = billable.reduce((s, o) => s + o.total, 0);

        document.getElementById('stat-awaiting').textContent = billable.length;
        document.getElementById('stat-paid-today').textContent = todayTxns.length;
        document.getElementById('stat-revenue').textContent = '₹' + todayRevenue.toLocaleString('en-IN');
        document.getElementById('stat-pending-amount').textContent = '₹' + pendingAmount.toLocaleString('en-IN');

        // Sound alert for new billable orders
        if (billable.length > lastBillableCount && lastBillableCount >= 0) {
            try { NotificationSound.newOrder(); } catch(e) {}
        }
        lastBillableCount = billable.length;

        const grid = document.getElementById('billing-grid');
        if (billable.length === 0) {
            grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🧾</div><div class="empty-state-text">No orders to bill</div><div class="empty-state-sub">Ready or served orders will appear here</div></div>`;
            return;
        }
        grid.innerHTML = billable.map(order => {
            const time = new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]');
            const typeLabel = order.type === 'online' ? '🌐 Online' : `🍽️ Table ${order.tableNum}`;
            return `
                <div class="order-card animate-in">
                    <div class="order-card-header"><div><div class="order-id">${order.id}</div><div class="order-time">${time} · ${typeLabel}</div></div><span class="badge badge-${order.status}">${order.status.toUpperCase()}</span></div>
                    <ul class="order-items-list">${items.map(i => `<li><span>${i.name} × ${i.qty}</span><span>₹${i.price * i.qty}</span></li>`).join('')}</ul>
                    <div class="order-card-footer"><span class="order-total">₹${order.total}</span><button class="btn btn-primary btn-sm" onclick="openBillModal('${order.id}')">💳 Generate Bill</button></div>
                </div>`;
        }).join('');
    } catch (err) { console.error('Billing refresh failed:', err); }
}

// ===== Bill Modal =====
async function openBillModal(orderId) {
    const allOrders = await api.getOrders();
    currentBillOrder = allOrders.find(o => o.id === orderId);
    if (!currentBillOrder) return;
    selectedPaymentMethod = 'cash';

    const items = Array.isArray(currentBillOrder.items) ? currentBillOrder.items : JSON.parse(currentBillOrder.items || '[]');
    const tax = Math.round(currentBillOrder.total * GST_RATE);
    const finalAmount = currentBillOrder.total + tax;

    document.getElementById('bill-content').innerHTML = `
        <div class="bill-order-id">${currentBillOrder.id}</div>
        <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:16px;">${currentBillOrder.type === 'online' ? '🌐 Online' : '🍽️ Table ' + currentBillOrder.tableNum} · Waiter: ${currentBillOrder.waiterName || 'N/A'}</div>
        <ul class="bill-items">${items.map(i => `<li><span>${i.name} × ${i.qty}</span><span>₹${i.price * i.qty}</span></li>`).join('')}</ul>
        <hr class="bill-divider">
        <div class="bill-row"><span>Subtotal</span><span>₹${currentBillOrder.total}</span></div>
        <div class="bill-row"><span>GST (5%)</span><span>₹${tax}</span></div>
        <div class="bill-row"><span>Discount</span><div style="display:flex;align-items:center;gap:8px;"><span>₹</span><input type="number" id="discount-input" value="0" min="0" max="${finalAmount}" class="form-input" style="width:80px;padding:6px 10px;margin:0;" onchange="updateBillTotal()"></div></div>
        <div class="bill-row total"><span>Total</span><span id="bill-final-amount">₹${finalAmount}</span></div>
        <div class="bill-payment-section">
            <label class="form-label">Payment Method</label>
            <div class="payment-methods">
                <button class="payment-method-btn selected" onclick="selectPayment('cash',this)"><span class="payment-method-icon">💵</span>Cash</button>
                <button class="payment-method-btn" onclick="selectPayment('upi',this)"><span class="payment-method-icon">📱</span>UPI</button>
                <button class="payment-method-btn" onclick="selectPayment('card',this)"><span class="payment-method-icon">💳</span>Card</button>
            </div>
            <button class="btn btn-success btn-lg" style="width:100%" onclick="processPayment()">✓ Confirm Payment</button>
        </div>`;
    document.getElementById('bill-modal').classList.add('active');
}

function closeBillModal() { document.getElementById('bill-modal').classList.remove('active'); currentBillOrder = null; }
function selectPayment(method, btn) { selectedPaymentMethod = method; document.querySelectorAll('.payment-method-btn').forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); }
function updateBillTotal() {
    if (!currentBillOrder) return;
    const discount = parseInt(document.getElementById('discount-input').value) || 0;
    const tax = Math.round(currentBillOrder.total * GST_RATE);
    document.getElementById('bill-final-amount').textContent = '₹' + Math.max(0, currentBillOrder.total + tax - discount);
}

async function processPayment() {
    if (!currentBillOrder) return;
    const discount = parseInt(document.getElementById('discount-input')?.value) || 0;
    const tax = Math.round(currentBillOrder.total * GST_RATE);
    const finalAmount = Math.max(0, currentBillOrder.total + tax - discount);

    await api.createTransaction({
        orderId: currentBillOrder.id, amount: currentBillOrder.total, tax, discount, finalAmount,
        method: selectedPaymentMethod, cashier: currentUser.username, cashierName: currentUser.name
    });

    closeBillModal();
    try { NotificationSound.paymentSuccess(); } catch(e) {}
    showToast(`Payment of ₹${finalAmount} received for ${currentBillOrder.id} via ${selectedPaymentMethod.toUpperCase()}`, 'success');
    refreshBilling();
}

// ===== Daily Collection (API) =====
async function refreshCollection() {
    const txns = await api.getTransactions({ today: 'true' });
    const cashTxns = txns.filter(t => t.method === 'cash');
    const upiTxns = txns.filter(t => t.method === 'upi');
    const cardTxns = txns.filter(t => t.method === 'card');
    const cashTotal = cashTxns.reduce((s, t) => s + t.finalAmount, 0);
    const upiTotal = upiTxns.reduce((s, t) => s + t.finalAmount, 0);
    const cardTotal = cardTxns.reduce((s, t) => s + t.finalAmount, 0);
    const grandTotal = cashTotal + upiTotal + cardTotal;

    document.getElementById('collection-cash').textContent = '₹' + cashTotal.toLocaleString('en-IN');
    document.getElementById('collection-upi').textContent = '₹' + upiTotal.toLocaleString('en-IN');
    document.getElementById('collection-card').textContent = '₹' + cardTotal.toLocaleString('en-IN');
    document.getElementById('collection-total').textContent = '₹' + grandTotal.toLocaleString('en-IN');
    document.getElementById('collection-cash-count').textContent = cashTxns.length + ' transactions';
    document.getElementById('collection-upi-count').textContent = upiTxns.length + ' transactions';
    document.getElementById('collection-card-count').textContent = cardTxns.length + ' transactions';
    document.getElementById('collection-total-count').textContent = txns.length + ' total transactions';

    const maxVal = Math.max(cashTotal, upiTotal, cardTotal, 1);
    document.getElementById('collection-bars').innerHTML = `
        <div class="collection-bar-row"><span class="collection-bar-label">💵 Cash</span><div class="collection-bar-track"><div class="collection-bar-fill cash" style="width:${(cashTotal/maxVal)*100}%">₹${cashTotal}</div></div><span class="collection-bar-value">${cashTxns.length} txn</span></div>
        <div class="collection-bar-row"><span class="collection-bar-label">📱 UPI</span><div class="collection-bar-track"><div class="collection-bar-fill upi" style="width:${(upiTotal/maxVal)*100}%">₹${upiTotal}</div></div><span class="collection-bar-value">${upiTxns.length} txn</span></div>
        <div class="collection-bar-row"><span class="collection-bar-label">💳 Card</span><div class="collection-bar-track"><div class="collection-bar-fill card" style="width:${(cardTotal/maxVal)*100}%">₹${cardTotal}</div></div><span class="collection-bar-value">${cardTxns.length} txn</span></div>`;
}

// ===== Transaction History (API) =====
async function refreshHistory() {
    const txns = await api.getTransactions();
    const tbody = document.getElementById('history-tbody');
    if (txns.length === 0) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:40px;">No transactions yet</td></tr>'; return; }
    tbody.innerHTML = txns.map(txn => {
        const time = new Date(txn.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        return `<tr>
            <td style="font-weight:600;color:var(--accent-gold)">${txn.orderId}</td><td>—</td><td>₹${txn.amount}</td><td>₹${txn.tax}</td>
            <td>${txn.discount > 0 ? '-₹' + txn.discount : '—'}</td><td style="font-weight:700">₹${txn.finalAmount}</td>
            <td class="method-${txn.method}" style="font-weight:600;text-transform:uppercase">${txn.method}</td><td style="color:var(--text-muted)">${time}</td></tr>`;
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
document.getElementById('bill-modal').addEventListener('click', (e) => { if (e.target === document.getElementById('bill-modal')) closeBillModal(); });
setInterval(() => { const v = document.querySelector('.view.active'); if (v.id === 'view-billing') refreshBilling(); }, 5000);

if (checkAuth()) { refreshBilling(); }
