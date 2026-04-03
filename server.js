// ===== Cultured Kitchen — Backend Server (Cloud PostgreSQL Version) =====
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (index.html, style.css, images, etc.)
app.use(express.static(path.join(__dirname)));

// ===== Database Setup =====
if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL environment variable is missing.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS staff (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT NOT NULL,
                icon TEXT DEFAULT '👤'
            );

            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL DEFAULT 'dine-in',
                items TEXT NOT NULL,
                tableNum INTEGER,
                guests INTEGER,
                status TEXT NOT NULL DEFAULT 'pending',
                waiter TEXT,
                waiterName TEXT,
                chef TEXT,
                chefName TEXT,
                total REAL NOT NULL DEFAULT 0,
                notes TEXT,
                customerPhone TEXT,
                paymentMethod TEXT,
                paymentStatus TEXT NOT NULL DEFAULT 'unpaid',
                createdAt BIGINT NOT NULL,
                updatedAt BIGINT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS inventory (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                quantity REAL NOT NULL DEFAULT 0,
                unit TEXT NOT NULL DEFAULT 'kg',
                costPerUnit REAL NOT NULL DEFAULT 0,
                lowStockThreshold REAL NOT NULL DEFAULT 10
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                orderId TEXT NOT NULL REFERENCES orders(id),
                amount REAL NOT NULL,
                tax REAL NOT NULL DEFAULT 0,
                discount REAL NOT NULL DEFAULT 0,
                finalAmount REAL NOT NULL,
                method TEXT NOT NULL DEFAULT 'cash',
                cashier TEXT,
                cashierName TEXT,
                timestamp BIGINT NOT NULL
            );
        `);

        // Seed Staff
        const staffCount = await pool.query('SELECT COUNT(*) as count FROM staff');
        if (parseInt(staffCount.rows[0].count) === 0) {
            const staffList = [
                ['manager1', 'mgr@123', 'Rajesh Kumar', 'manager', '📊'],
                ['cashier1', 'cash@123', 'Priya Sharma', 'cashier', '💰'],
                ['chef1', 'chef@123', 'Chef Arjun', 'chef', '👨‍🍳'],
                ['chef2', 'chef@123', 'Chef Meera', 'chef', '👩‍🍳'],
                ['chef3', 'chef@123', 'Chef Vikram', 'chef', '👨‍🍳'],
                ['chef4', 'chef@123', 'Chef Ananya', 'chef', '👩‍🍳'],
                ['waiter1', 'wait@123', 'Rahul S.', 'waiter', '🍽️'],
                ['waiter2', 'wait@123', 'Sneha P.', 'waiter', '🍽️'],
                ['waiter3', 'wait@123', 'Amit R.', 'waiter', '🍽️'],
                ['waiter4', 'wait@123', 'Divya M.', 'waiter', '🍽️'],
                ['waiter5', 'wait@123', 'Karthik N.', 'waiter', '🍽️']
            ];
            for (let s of staffList) {
                await pool.query('INSERT INTO staff (username, password, name, role, icon) VALUES ($1, $2, $3, $4, $5)', s);
            }
            console.log('✅ Staff accounts seeded');
        }

        // Seed Inventory
        const invCount = await pool.query('SELECT COUNT(*) as count FROM inventory');
        if (parseInt(invCount.rows[0].count) === 0) {
            const invList = [
                ['Basmati Rice', 50, 'kg', 120, 10],
                ['Chicken', 30, 'kg', 220, 8],
                ['Mutton', 15, 'kg', 650, 5],
                ['Cooking Oil', 20, 'litre', 180, 5],
                ['Flour (Maida)', 25, 'kg', 45, 8],
                ['Onions', 40, 'kg', 35, 10],
                ['Tomatoes', 30, 'kg', 40, 10],
                ['Paneer', 10, 'kg', 320, 3],
                ['Prawns', 8, 'kg', 550, 3],
                ['Fish', 12, 'kg', 350, 4],
                ['Yogurt', 15, 'litre', 60, 5],
                ['Butter', 10, 'kg', 480, 3],
                ['Spice Mix', 5, 'kg', 800, 2],
                ['Sugar', 20, 'kg', 42, 5],
                ['Milk', 25, 'litre', 56, 8]
            ];
            for (let i of invList) {
                await pool.query('INSERT INTO inventory (name, quantity, unit, costPerUnit, lowStockThreshold) VALUES ($1, $2, $3, $4, $5)', i);
            }
            console.log('✅ Inventory seeded');
        }

    } catch (err) {
        console.error("Database initialization failed", err);
    }
}
initDB();

// ===== INGREDIENT MAP for auto-deduction =====
const INGREDIENT_MAP = {
    'Chicken Biryani':    [{ name: 'Basmati Rice', amount: 0.3 }, { name: 'Chicken', amount: 0.25 }, { name: 'Cooking Oil', amount: 0.05 }, { name: 'Onions', amount: 0.1 }, { name: 'Tomatoes', amount: 0.05 }, { name: 'Yogurt', amount: 0.05 }, { name: 'Spice Mix', amount: 0.02 }],
    'Mutton Biryani':     [{ name: 'Basmati Rice', amount: 0.3 }, { name: 'Mutton', amount: 0.25 }, { name: 'Cooking Oil', amount: 0.05 }, { name: 'Onions', amount: 0.1 }, { name: 'Tomatoes', amount: 0.05 }, { name: 'Yogurt', amount: 0.05 }, { name: 'Spice Mix', amount: 0.02 }],
    'Fish Biryani':       [{ name: 'Basmati Rice', amount: 0.3 }, { name: 'Fish', amount: 0.25 }, { name: 'Cooking Oil', amount: 0.05 }, { name: 'Onions', amount: 0.1 }, { name: 'Tomatoes', amount: 0.05 }, { name: 'Spice Mix', amount: 0.02 }],
    'Prawn Biryani':      [{ name: 'Basmati Rice', amount: 0.3 }, { name: 'Prawns', amount: 0.2 }, { name: 'Cooking Oil', amount: 0.05 }, { name: 'Onions', amount: 0.1 }, { name: 'Tomatoes', amount: 0.05 }, { name: 'Spice Mix', amount: 0.02 }],
    'Chicken Fried Rice': [{ name: 'Basmati Rice', amount: 0.25 }, { name: 'Chicken', amount: 0.15 }, { name: 'Cooking Oil', amount: 0.04 }, { name: 'Onions', amount: 0.05 }],
    'Veg Fried Rice':     [{ name: 'Basmati Rice', amount: 0.25 }, { name: 'Cooking Oil', amount: 0.04 }, { name: 'Onions', amount: 0.05 }],
    'Egg Fried Rice':     [{ name: 'Basmati Rice', amount: 0.25 }, { name: 'Cooking Oil', amount: 0.04 }, { name: 'Onions', amount: 0.05 }],
    'Tandoori Roti':      [{ name: 'Flour (Maida)', amount: 0.08 }, { name: 'Butter', amount: 0.01 }],
    'Plain Naan':         [{ name: 'Flour (Maida)', amount: 0.1 }, { name: 'Yogurt', amount: 0.02 }, { name: 'Butter', amount: 0.01 }],
    'Butter Naan':        [{ name: 'Flour (Maida)', amount: 0.1 }, { name: 'Yogurt', amount: 0.02 }, { name: 'Butter', amount: 0.03 }],
    'Butter Chicken':     [{ name: 'Chicken', amount: 0.25 }, { name: 'Butter', amount: 0.04 }, { name: 'Tomatoes', amount: 0.15 }, { name: 'Cooking Oil', amount: 0.03 }, { name: 'Yogurt', amount: 0.03 }, { name: 'Spice Mix', amount: 0.02 }],
    'Dal Makhani':        [{ name: 'Butter', amount: 0.04 }, { name: 'Tomatoes', amount: 0.1 }, { name: 'Cooking Oil', amount: 0.03 }, { name: 'Spice Mix', amount: 0.02 }],
    'Paneer Tikka':       [{ name: 'Paneer', amount: 0.2 }, { name: 'Yogurt', amount: 0.05 }, { name: 'Cooking Oil', amount: 0.03 }, { name: 'Onions', amount: 0.05 }, { name: 'Spice Mix', amount: 0.02 }],
    'Chicken 65':         [{ name: 'Chicken', amount: 0.2 }, { name: 'Cooking Oil', amount: 0.1 }, { name: 'Spice Mix', amount: 0.02 }],
    'Mutton Seekh Kebab': [{ name: 'Mutton', amount: 0.25 }, { name: 'Onions', amount: 0.05 }, { name: 'Cooking Oil', amount: 0.03 }, { name: 'Spice Mix', amount: 0.02 }],
    'Chicken Samosa':     [{ name: 'Chicken', amount: 0.1 }, { name: 'Flour (Maida)', amount: 0.08 }, { name: 'Cooking Oil', amount: 0.08 }, { name: 'Onions', amount: 0.03 }, { name: 'Spice Mix', amount: 0.01 }],
    'Gulab Jamun':        [{ name: 'Milk', amount: 0.1 }, { name: 'Sugar', amount: 0.05 }, { name: 'Cooking Oil', amount: 0.03 }],
    'Rasmalai':           [{ name: 'Milk', amount: 0.2 }, { name: 'Sugar', amount: 0.05 }, { name: 'Paneer', amount: 0.05 }],
    'Palak Paneer':       [{ name: 'Paneer', amount: 0.2 }, { name: 'Cooking Oil', amount: 0.03 }, { name: 'Onions', amount: 0.05 }, { name: 'Tomatoes', amount: 0.05 }, { name: 'Spice Mix', amount: 0.02 }],
    'Mango Lassi':        [{ name: 'Yogurt', amount: 0.15 }, { name: 'Sugar', amount: 0.03 }, { name: 'Milk', amount: 0.05 }]
};

// Helper: deduct inventory for an order
async function deductInventoryForOrder(items) {
    const lowStockWarnings = [];
    const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const item of parsedItems) {
            const recipe = INGREDIENT_MAP[item.name];
            if (!recipe) continue;
            for (const ing of recipe) {
                const totalDeduction = ing.amount * item.qty;
                await client.query('UPDATE inventory SET quantity = GREATEST(0, quantity - $1) WHERE name = $2', [totalDeduction, ing.name]);
                
                const res = await client.query('SELECT * FROM inventory WHERE name = $1', [ing.name]);
                if (res.rows.length > 0) {
                    const inv = res.rows[0];
                    if (inv.quantity <= inv.lowstockthreshold && inv.quantity > 0) {
                        lowStockWarnings.push(inv.name);
                    }
                }
            }
        }
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
    } finally {
        client.release();
    }
    return [...new Set(lowStockWarnings)];
}


// ============================================
//              API ROUTES
// ============================================

// ===== AUTH =====
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await pool.query('SELECT * FROM staff WHERE username = $1 AND password = $2', [username, password]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            res.json({ success: true, user: { username: user.username, role: user.role, name: user.name, icon: user.icon } });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ===== STAFF =====
app.get('/api/staff', async (req, res) => {
    try {
        const result = await pool.query('SELECT username, name, role, icon FROM staff');
        res.json(result.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ===== ORDERS =====
app.get('/api/orders', async (req, res) => {
    try {
        const { status, type, waiter, chef, today } = req.query;
        let sql = 'SELECT * FROM orders WHERE 1=1';
        const params = [];
        let i = 1;

        if (status) { sql += ` AND status = $${i++}`; params.push(status); }
        if (type) { sql += ` AND type = $${i++}`; params.push(type); }
        if (waiter) { sql += ` AND waiter = $${i++}`; params.push(waiter); }
        if (chef) { sql += ` AND chef = $${i++}`; params.push(chef); }
        if (today === 'true') {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            sql += ` AND "createdAt" >= $${i++}`;  // Quote mixed case names if PG enforces lowercase
            params.push(startOfDay.getTime());
        }

        sql += ' ORDER BY "createdAt" DESC';
        const result = await pool.query(sql.replace(/"createdAt"/g, 'createdAt'), params);
        
        result.rows.forEach(o => {
            try { o.items = JSON.parse(o.items); } catch(e) {}
        });

        res.json(result.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders/online', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM orders WHERE type = 'online' AND status = 'pending' AND (waiter IS NULL OR waiter = '') ORDER BY createdAt ASC");
        result.rows.forEach(o => { try { o.items = JSON.parse(o.items); } catch(e) {} });
        res.json(result.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/orders', async (req, res) => {
    try {
        const o = req.body;
        const now = Date.now();
        let orderId = o.id;

        if (!orderId) {
            if (o.type === 'online') {
                const result = await pool.query("SELECT COUNT(*) as c FROM orders WHERE type = 'online'");
                const count = parseInt(result.rows[0].c) + 1;
                orderId = `ORD-ONL-${String(count).padStart(4, '0')}`;
            } else {
                const waiterNum = (o.waiter || '').replace('waiter', '') || '0';
                const result = await pool.query("SELECT COUNT(*) as c FROM orders WHERE waiter = $1", [o.waiter || '']);
                const count = parseInt(result.rows[0].c) + 1;
                orderId = `ORD-W${waiterNum}-${String(count).padStart(4, '0')}`;
            }
        }

        await pool.query(`
            INSERT INTO orders (id, type, items, tableNum, guests, status, waiter, waiterName, chef, chefName, total, notes, customerPhone, paymentMethod, paymentStatus, createdAt, updatedAt)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        `, [
            orderId, o.type || 'dine-in', JSON.stringify(o.items || []), o.table || null, o.guests || null,
            o.status || 'pending', o.waiter || null, o.waiterName || null, o.chef || null, o.chefName || null,
            o.total || 0, o.notes || null, o.customerPhone || null, o.paymentMethod || null, o.paymentStatus || 'unpaid',
            o.createdAt || now, o.updatedAt || now
        ]);

        res.json({ success: true, orderId });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const now = Date.now();

        const fields = [];
        const values = [];
        const allowed = ['status', 'waiter', 'waiterName', 'chef', 'chefName', 'paymentMethod', 'paymentStatus', 'notes'];
        let i = 1;

        allowed.forEach(field => {
            if (updates[field] !== undefined) {
                // Wrap in quotes to avoid case folding
                fields.push(`"${field}" = $${i++}`);
                values.push(updates[field]);
            }
        });

        if (fields.length > 0) {
            fields.push(`"updatedAt" = $${i++}`);
            values.push(now);
            values.push(id);
            await pool.query(`UPDATE orders SET ${fields.join(', ')} WHERE id = $${i-1}`, values);
        }

        if (updates.status === 'cooking') {
            const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
            if (orderRes.rows.length > 0) {
                const warnings = await deductInventoryForOrder(orderRes.rows[0].items);
                return res.json({ success: true, lowStockWarnings: warnings });
            }
        }

        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ===== INVENTORY =====
app.get('/api/inventory', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM inventory ORDER BY name');
        res.json(result.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/inventory', async (req, res) => {
    try {
        const i = req.body;
        const result = await pool.query(
            'INSERT INTO inventory (name, quantity, unit, "costPerUnit", "lowStockThreshold") VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [i.name, i.quantity, i.unit, i.costPerUnit, i.lowStockThreshold]
        );
        res.json({ success: true, id: result.rows[0].id });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/inventory/:id', async (req, res) => {
    try {
        const i = req.body;
        await pool.query(
            'UPDATE inventory SET name = $1, quantity = $2, unit = $3, "costPerUnit" = $4, "lowStockThreshold" = $5 WHERE id = $6',
            [i.name, i.quantity, i.unit, i.costPerUnit, i.lowStockThreshold, req.params.id]
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/inventory/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM inventory WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ===== TRANSACTIONS =====
app.get('/api/transactions', async (req, res) => {
    try {
        const { today } = req.query;
        let sql = 'SELECT * FROM transactions';
        const params = [];
        if (today === 'true') {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            sql += ' WHERE timestamp >= $1';
            params.push(startOfDay.getTime());
        }
        sql += ' ORDER BY timestamp DESC';
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/transactions', async (req, res) => {
    try {
        const t = req.body;
        const ts = t.timestamp || Date.now();
        const result = await pool.query(`
            INSERT INTO transactions ("orderId", amount, tax, discount, "finalAmount", method, cashier, "cashierName", timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
        `, [t.orderId, t.amount, t.tax, t.discount, t.finalAmount, t.method, t.cashier, t.cashierName, ts]);

        await pool.query(`UPDATE orders SET status = 'paid', "paymentStatus" = 'paid', "paymentMethod" = $1, "updatedAt" = $2 WHERE id = $3`,
            [t.method, Date.now(), t.orderId]);

        res.json({ success: true, id: result.rows[0].id });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ===== STATS (for manager) =====
app.get('/api/stats/today', async (req, res) => {
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const start = startOfDay.getTime();

        const [tOrders, tRev, tCount, tCash, tUpi, tCard] = await Promise.all([
            pool.query('SELECT COUNT(*) as c FROM orders WHERE createdAt >= $1', [start]),
            pool.query('SELECT COALESCE(SUM("finalAmount"), 0) as total FROM transactions WHERE timestamp >= $1', [start]),
            pool.query('SELECT COUNT(*) as c FROM transactions WHERE timestamp >= $1', [start]),
            pool.query(`SELECT COALESCE(SUM("finalAmount"), 0) as total FROM transactions WHERE timestamp >= $1 AND method = 'cash'`, [start]),
            pool.query(`SELECT COALESCE(SUM("finalAmount"), 0) as total FROM transactions WHERE timestamp >= $1 AND method = 'upi'`, [start]),
            pool.query(`SELECT COALESCE(SUM("finalAmount"), 0) as total FROM transactions WHERE timestamp >= $1 AND method = 'card'`, [start])
        ]);

        const totalOrders = parseInt(tOrders.rows[0].c);
        const revenue = parseFloat(tRev.rows[0].total);
        const txnCount = parseInt(tCount.rows[0].c);
        const avgOrder = txnCount > 0 ? Math.round(revenue / txnCount) : 0;
        const cashTotal = parseFloat(tCash.rows[0].total);
        const upiTotal = parseFloat(tUpi.rows[0].total);
        const cardTotal = parseFloat(tCard.rows[0].total);

        res.json({
            totalOrders, revenue, avgOrder,
            profit: Math.round(revenue * 0.4),
            cashTotal, upiTotal, cardTotal, txnCount
        });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ===== Start Server =====
app.listen(PORT, () => {
    console.log('');
    console.log('  🍽️  ═══════════════════════════════════════');
    console.log('  🍽️  CULTURED KITCHEN Server (CLOUD PG)     ');
    console.log('  🍽️  ═══════════════════════════════════════');
    console.log(`  🌐  Customer Site:  http://localhost:${PORT}`);
    console.log(`  🔐  Staff Login:    http://localhost:${PORT}/staff/login.html`);
    console.log(`  📡  API:            http://localhost:${PORT}/api`);
    console.log('  🍽️  ═══════════════════════════════════════');
    console.log('');
});
