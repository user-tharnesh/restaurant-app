// ===== Cultured Kitchen — Backend Server (Cloud PostgreSQL Version) =====
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

let ai = null;
try {
    const { GoogleGenAI } = require('@google/genai');
    if (process.env.GEMINI_API_KEY) {
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
} catch (e) {
    console.log('⚠️ @google/genai package not found or configured');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (index.html, style.css, images, etc.)
app.use(express.static(path.join(__dirname), { extensions: ['html'] }));

// ===== Database Setup =====
const poolStr = process.env.DATABASE_URL;
if (!poolStr) {
    console.error("⚠️ WARNING: DATABASE_URL environment variable is missing.");
    console.error("⚠️ The frontend will load, but API calls will fail until the database is configured in Render.");
}

const pool = poolStr ? new Pool({
    connectionString: poolStr,
    ssl: { rejectUnauthorized: false }
}) : null;

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
            o.tableNum = o.tableNum ?? o.tablenum;
            o.waiterName = o.waiterName ?? o.waitername;
            o.chefName = o.chefName ?? o.chefname;
            o.customerPhone = o.customerPhone ?? o.customerphone;
            o.paymentMethod = o.paymentMethod ?? o.paymentmethod;
            o.paymentStatus = o.paymentStatus ?? o.paymentstatus;
            o.createdAt = o.createdAt ?? o.createdat;
            o.updatedAt = o.updatedAt ?? o.updatedat;
        });

        res.json(result.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders/online', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM orders WHERE type = 'online' AND status = 'pending' AND (waiter IS NULL OR waiter = '') ORDER BY createdAt ASC");
        result.rows.forEach(o => { 
            try { o.items = JSON.parse(o.items); } catch(e) {} 
            o.tableNum = o.tableNum ?? o.tablenum;
            o.waiterName = o.waiterName ?? o.waitername;
            o.chefName = o.chefName ?? o.chefname;
            o.customerPhone = o.customerPhone ?? o.customerphone;
            o.paymentMethod = o.paymentMethod ?? o.paymentmethod;
            o.paymentStatus = o.paymentStatus ?? o.paymentstatus;
            o.createdAt = o.createdAt ?? o.createdat;
            o.updatedAt = o.updatedAt ?? o.updatedat;
        });
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
                fields.push(`${field} = $${i++}`);
                values.push(updates[field]);
            }
        });

        if (fields.length > 0) {
            fields.push(`updatedAt = $${i++}`);
            values.push(now);
            values.push(id);
            await pool.query(`UPDATE orders SET ${fields.join(', ')} WHERE id = $${i}`, values);
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
            'INSERT INTO inventory (name, quantity, unit, costPerUnit, lowStockThreshold) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [i.name, i.quantity, i.unit, i.costPerUnit, i.lowStockThreshold]
        );
        res.json({ success: true, id: result.rows[0].id });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/inventory/:id', async (req, res) => {
    try {
        const i = req.body;
        await pool.query(
            'UPDATE inventory SET name = $1, quantity = $2, unit = $3, costPerUnit = $4, lowStockThreshold = $5 WHERE id = $6',
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
        result.rows.forEach(o => {
            o.orderId = o.orderId ?? o.orderid;
            o.finalAmount = o.finalAmount ?? o.finalamount;
            o.cashierName = o.cashierName ?? o.cashiername;
        });
        res.json(result.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/transactions', async (req, res) => {
    try {
        const t = req.body;
        const ts = t.timestamp || Date.now();
        const result = await pool.query(`
            INSERT INTO transactions (orderId, amount, tax, discount, finalAmount, method, cashier, cashierName, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
        `, [t.orderId, t.amount, t.tax, t.discount, t.finalAmount, t.method, t.cashier, t.cashierName, ts]);

        await pool.query(`UPDATE orders SET status = 'paid', paymentStatus = 'paid', paymentMethod = $1, updatedAt = $2 WHERE id = $3`,
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
            pool.query('SELECT COALESCE(SUM(finalAmount), 0) as total FROM transactions WHERE timestamp >= $1', [start]),
            pool.query('SELECT COUNT(*) as c FROM transactions WHERE timestamp >= $1', [start]),
            pool.query(`SELECT COALESCE(SUM(finalAmount), 0) as total FROM transactions WHERE timestamp >= $1 AND method = 'cash'`, [start]),
            pool.query(`SELECT COALESCE(SUM(finalAmount), 0) as total FROM transactions WHERE timestamp >= $1 AND method = 'upi'`, [start]),
            pool.query(`SELECT COALESCE(SUM(finalAmount), 0) as total FROM transactions WHERE timestamp >= $1 AND method = 'card'`, [start])
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

// ===== AI FEATURES =====
app.post('/api/ai/flavor-profiler', async (req, res) => {
    if (!ai) return res.status(500).json({ success: false, message: 'AI not configured on server (Missing API Key or package).' });
    const { tags } = req.body;
    try {
        const prompt = `You are an expert chef at 'Cultured Kitchen'.
The dine-in customer wants a dish fitting these flavor tags: ${(tags || []).join(', ')}.
Here is our menu list: ${Object.keys(INGREDIENT_MAP).join(', ')}.
CRITICAL RULE: If the customer selected "Vegetarian 🥗", you absolutely MUST NEVER recommend any dish containing Chicken, Mutton, Fish, Prawn, or Meat. Suggest a Paneer, Dal, or Veg dish instead.
Recommend ONE best dish from the menu that matches their mood. Describe it vividly in 2 short sentences. Return JSON format: { "recommendedDish": "Name of Dish", "description": "Why they will love it" }`;

        let resultData = null;
        let lastError = null;

        if (process.env.GEMINI_API_KEY) {
            const modelsToTry = ['gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-2.0-flash-exp', 'gemini-1.0-pro'];
            for (let m of modelsToTry) {
                try {
                    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { responseMimeType: "application/json" }
                        })
                    });
                    const data = await aiRes.json();
                    if (aiRes.ok && data.candidates && data.candidates[0].content.parts[0].text) {
                        let textResult = data.candidates[0].content.parts[0].text;
                        if (textResult.startsWith('\`\`\`json')) {
                            textResult = textResult.replace(/^\`\`\`json\n/, '').replace(/\n\`\`\`$/, '');
                        }
                        resultData = JSON.parse(textResult);
                        console.log("REST API Success flavor-profiler model:", m);
                        break;
                    } else {
                        lastError = data.error ? data.error.message : "Unknown API response";
                    }
                } catch (err) {
                    lastError = err.message;
                }
            }
        }

        // GRACEFUL OFFLINE FALLBACK logic
        if (!resultData) {
            const userTagsString = (tags && tags.length > 0) ? tags.join(' ') : "";
            
            // Check for contradictory tags
            const isVeg = userTagsString.includes('Vegetarian');
            const isMeat = userTagsString.includes('Meat') || userTagsString.includes('Seafood');
            const isSweet = userTagsString.includes('Sweet');
            const isSpicy = userTagsString.includes('Spicy');
            const isLight = userTagsString.includes('Light');
            const isRich = userTagsString.includes('Rich & Creamy');
            
            if (isVeg && isMeat) {
                resultData = {
                    recommendedDish: "Wait... Vegetarian Meat? 🧐",
                    description: "Our AI Chef is scratching his head! Unless you want a raw carrot wrapped in a piece of bacon, please pick either Vegetarian OR Meat!"
                };
            } else if (isSweet && isSpicy) {
                 resultData = {
                    recommendedDish: "Fire and Ice? 🌋🧊",
                    description: "Sweet AND Spicy? You are a chaotic eater! Our Chef recommends you eat a Jalapeño dipped in Chocolate. Just kidding, please deselect one!"
                };
            } else if (isLight && isRich) {
                 resultData = {
                    recommendedDish: "A Diet Butter Stick? 🧈",
                    description: "You asked for something 'Light' but also 'Rich & Creamy'. Our Chef's hat just flew off in confusion! Please choose one vibe for today."
                };
            } else {
                let possibleDishes = Object.keys(INGREDIENT_MAP);
                
                // Apply hard dietary filters for offline generic fallback!
                if (isVeg) {
                    const meatWords = ['chicken', 'mutton', 'fish', 'prawn', 'egg'];
                    possibleDishes = possibleDishes.filter(d => !meatWords.some(mw => d.toLowerCase().includes(mw)));
                } else if (isMeat) {
                    const meatWords = ['chicken', 'mutton', 'fish', 'prawn'];
                    possibleDishes = possibleDishes.filter(d => meatWords.some(mw => d.toLowerCase().includes(mw)));
                }
                
                // Also respect Desserts if 'Sweet' is checked but 'Meat' is not
                if (userTagsString.includes('Sweet') && !isMeat) {
                     const sweetWords = ['jamun', 'rasmalai', 'lassi'];
                     const sweetDishes = possibleDishes.filter(d => sweetWords.some(sw => d.toLowerCase().includes(sw)));
                     if (sweetDishes.length > 0) possibleDishes = sweetDishes;
                }

                if (possibleDishes.length === 0) possibleDishes = Object.keys(INGREDIENT_MAP);

                const randomDish = possibleDishes[Math.floor(Math.random() * possibleDishes.length)];
                const userTags = (tags && tags.length > 0) ? tags.join(' and ') : "delicious flavors";
                
                resultData = {
                    recommendedDish: randomDish,
                    description: `Our local profiling algorithm analyzed your request for ${userTags} and matched it with our ${randomDish}. It has the perfect balance of flavors to satisfy your current mood!`
                };
            }
        }
        
        res.json({ success: true, data: resultData });
    } catch (e) {
        res.status(500).json({ success: false, message: 'AI Error', error: e.toString() });
    }
});

app.get('/api/ai/daily-briefing', async (req, res) => {
    if (!ai) return res.status(500).json({ success: false, message: 'AI not configured on server.' });
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0,0,0,0);
        const t = startOfDay.getTime();

        const ordersRes = await pool.query('SELECT id, type, status, total, paymentMethod, paymentStatus FROM orders WHERE createdAt >= $1', [t]);
        const orders = ordersRes.rows.map(o => ({...o, paymentMethod: o.paymentMethod ?? o.paymentmethod, paymentStatus: o.paymentStatus ?? o.paymentstatus }));
        
        const invRes = await pool.query('SELECT name, quantity, lowStockThreshold FROM inventory WHERE quantity <= lowStockThreshold * 2');
        const inv = invRes.rows.map(o => ({...o, lowStockThreshold: o.lowStockThreshold ?? o.lowstockthreshold }));
        
        const txnsRes = await pool.query('SELECT method, discount, finalAmount FROM transactions WHERE timestamp >= $1', [t]);
        const txns = txnsRes.rows.map(o => ({...o, finalAmount: o.finalAmount ?? o.finalamount }));
        
        const prompt = `You are an AI Manager Assistant for 'Cultured Kitchen'.
Analyze today's data:
Orders: ${JSON.stringify(orders)}
Inventory (Running Low): ${JSON.stringify(inv)}
Transactions: ${JSON.stringify(txns)}
Provide a short 3-bullet daily briefing for the manager highlighting any anomalies (e.g. unpaid orders, large discounts), revenue insights, or urgent inventory reorders. Return JSON format: { "briefingHtml": "<ul><li>...</li></ul>" }`;

        let resultData = null;
        let lastError = null;

        if (process.env.GEMINI_API_KEY) {
            const modelsToTry = ['gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-2.0-flash-exp', 'gemini-1.0-pro'];
            for (let m of modelsToTry) {
                try {
                    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { responseMimeType: "application/json" }
                        })
                    });
                    const data = await aiRes.json();
                    if (aiRes.ok && data.candidates && data.candidates[0].content.parts[0].text) {
                        let textResult = data.candidates[0].content.parts[0].text;
                        if (textResult.startsWith('\`\`\`json')) {
                            textResult = textResult.replace(/^\`\`\`json\n/, '').replace(/\n\`\`\`$/, '');
                        }
                        resultData = JSON.parse(textResult);
                        console.log("REST API Success with model:", m);
                        break;
                    } else {
                        lastError = data.error ? data.error.message : "Unknown API response";
                    }
                } catch (err) {
                    lastError = err.message;
                }
            }
        }

        // GRACEFUL OFFLINE FALLBACK: Algorithmic data analysis
        if (!resultData) {
            let totalOrders = orders.length;
            let pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'cooking').length;
            let unpaidOrders = orders.filter(o => o.paymentStatus === 'unpaid').length;
            
            let lowInvText = inv.length > 0 
                ? `Alert: ${inv.length} items are running low on stock (including ${inv.map(i=>i.name).slice(0,2).join(', ')}). Consider restocking soon.` 
                : `Inventory is currently fully stocked and healthy.`;
            
            let paymentText = unpaidOrders > 0 
                ? `Action required: ${unpaidOrders} orders remain unpaid out of ${totalOrders} total.` 
                : `All processed orders so far have been successfully paid.`;

            resultData = {
                briefingHtml: `
                <ul style="margin:0; padding-left: 20px;">
                    <li><strong style="color:var(--accent-gold);">Order Volume:</strong> You have recorded ${totalOrders} orders today. There are currently ${pendingOrders} orders active in the queue.</li>
                    <li><strong style="color:var(--danger);">Inventory Status:</strong> ${lowInvText}</li>
                    <li><strong style="color:var(--success);">Payment Status:</strong> ${paymentText}</li>
                </ul>`
            };
        }

        res.json({ success: true, data: resultData });
    } catch (e) {
        res.status(500).json({ success: false, message: 'AI Error', error: e.toString() });
    }
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
