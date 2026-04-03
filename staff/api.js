// ===== Elysium API Helper =====
// Central API client used by all staff dashboards

const API_BASE = '/api';

const api = {
    // ===== Auth =====
    async login(username, password) {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        return res.json();
    },

    // ===== Orders =====
    async getOrders(filters = {}) {
        const params = new URLSearchParams(filters);
        const res = await fetch(`${API_BASE}/orders?${params}`);
        return res.json();
    },

    async getOnlineOrders() {
        const res = await fetch(`${API_BASE}/orders/online`);
        return res.json();
    },

    async createOrder(order) {
        const res = await fetch(`${API_BASE}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(order)
        });
        return res.json();
    },

    async updateOrder(id, updates) {
        const res = await fetch(`${API_BASE}/orders/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        return res.json();
    },

    // ===== Inventory =====
    async getInventory() {
        const res = await fetch(`${API_BASE}/inventory`);
        return res.json();
    },

    async addInventoryItem(item) {
        const res = await fetch(`${API_BASE}/inventory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
        });
        return res.json();
    },

    async updateInventoryItem(id, item) {
        const res = await fetch(`${API_BASE}/inventory/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
        });
        return res.json();
    },

    async deleteInventoryItem(id) {
        const res = await fetch(`${API_BASE}/inventory/${id}`, { method: 'DELETE' });
        return res.json();
    },

    // ===== Transactions ===== 
    async getTransactions(filters = {}) {
        const params = new URLSearchParams(filters);
        const res = await fetch(`${API_BASE}/transactions?${params}`);
        return res.json();
    },

    async createTransaction(txn) {
        const res = await fetch(`${API_BASE}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(txn)
        });
        return res.json();
    },

    // ===== Stats =====
    async getTodayStats() {
        const res = await fetch(`${API_BASE}/stats/today`);
        return res.json();
    },

    // ===== Staff =====
    async getStaff() {
        const res = await fetch(`${API_BASE}/staff`);
        return res.json();
    }
};
