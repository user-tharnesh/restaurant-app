// ===== Cultured Kitchen — Backend Server (Local version) =====
const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

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
app.use(express.static(path.join(__dirname)));

// ===== Database Setup =====
const db = new Database(path.join(__dirname, 'cultured_kitchen.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
    CREATE TABLE IF NOT EXISTS staff (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 0,
        unit TEXT NOT NULL DEFAULT 'kg',
        costPerUnit REAL NOT NULL DEFAULT 0,
        lowStockThreshold REAL NOT NULL DEFAULT 10
    );

    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orderId TEXT NOT NULL,
        amount REAL NOT NULL,
        tax REAL NOT NULL DEFAULT 0,
        discount REAL NOT NULL DEFAULT 0,
        finalAmount REAL NOT NULL,
        method TEXT NOT NULL DEFAULT 'cash',
        cashier TEXT,
        cashierName TEXT,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (orderId) REFERENCES orders(id)
    );
`);

// ===== Seed default data if empty =====
const staffCount = db.prepare('SELECT COUNT(*) as count FROM staff').get().count;
if (staffCount === 0) {
    const insertStaff = db.prepare('INSERT INTO staff (username, password, name, role, icon) VALUES (?, ?, ?, ?, ?)');
    const seedStaff = db.transaction(() => {
        insertStaff.run('manager1', 'mgr@123', 'Rajesh Kumar', 'manager', '📊');
        insertStaff.run('cashier1', 'cash@123', 'Priya Sharma', 'cashier', '💰');
        insertStaff.run('chef1', 'chef@123', 'Chef Arjun', 'chef', '👨‍🍳');
        insertStaff.run('chef2', 'chef@123', 'Chef Meera', 'chef', '👩‍🍳');
        insertStaff.run('chef3', 'chef@123', 'Chef Vikram', 'chef', '👨‍🍳');
        insertStaff.run('chef4', 'chef@123', 'Chef Ananya', 'chef', '👩‍🍳');
        insertStaff.run('waiter1', 'wait@123', 'Rahul S.', 'waiter', '🍽️');
        insertStaff.run('waiter2', 'wait@123', 'Sneha P.', 'waiter', '🍽️');
        insertStaff.run('waiter3', 'wait@123', 'Amit R.', 'waiter', '🍽️');
        insertStaff.run('waiter4', 'wait@123', 'Divya M.', 'waiter', '🍽️');
        insertStaff.run('waiter5', 'wait@123', 'Karthik N.', 'waiter', '🍽️');
    });
    seedStaff();
    console.log('✅ Staff accounts seeded');
}

const invCount = db.prepare('SELECT COUNT(*) as count FROM inventory').get().count;
if (invCount === 0) {
    const insertInv = db.prepare('INSERT INTO inventory (name, quantity, unit, costPerUnit, lowStockThreshold) VALUES (?, ?, ?, ?, ?)');
    const seedInv = db.transaction(() => {
        insertInv.run('Basmati Rice', 50, 'kg', 120, 10);
        insertInv.run('Chicken', 30, 'kg', 220, 8);
        insertInv.run('Mutton', 15, 'kg', 650, 5);
        insertInv.run('Cooking Oil', 20, 'litre', 180, 5);
        insertInv.run('Flour (Maida)', 25, 'kg', 45, 8);
        insertInv.run('Onions', 40, 'kg', 35, 10);
        insertInv.run('Tomatoes', 30, 'kg', 40, 10);
        insertInv.run('Paneer', 10, 'kg', 320, 3);
        insertInv.run('Prawns', 8, 'kg', 550, 3);
        insertInv.run('Fish', 12, 'kg', 350, 4);
        insertInv.run('Yogurt', 15, 'litre', 60, 5);
        insertInv.run('Butter', 10, 'kg', 480, 3);
        insertInv.run('Spice Mix', 5, 'kg', 800, 2);
        insertInv.run('Sugar', 20, 'kg', 42, 5);
        insertInv.run('Milk', 25, 'litre', 56, 8);
    });
    seedInv();
    console.log('✅ Inventory seeded');
}

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
function deductInventoryForOrder(items) {
    const updateInv = db.prepare('UPDATE inventory SET quantity = MAX(0, quantity - ?) WHERE name = ?');
    const lowStockWarnings = [];

    const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

    const deduct = db.transaction(() => {
        parsedItems.forEach(item => {
            const recipe = INGREDIENT_MAP[item.name];
            if (!recipe) return;
            recipe.forEach(ing => {
                const totalDeduction = ing.amount * item.qty;
                updateInv.run(totalDeduction, ing.name);

                const inv = db.prepare('SELECT * FROM inventory WHERE name = ?').get(ing.name);
                if (inv && inv.quantity <= inv.lowStockThreshold && inv.quantity > 0) {
                    lowStockWarnings.push(inv.name);
                }
            });
        });
    });
    deduct();
    return [...new Set(lowStockWarnings)];
}


// ============================================
//              API ROUTES
// ============================================

// ===== AUTH =====
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM staff WHERE username = ? AND password = ?').get(username, password);
    if (user) {
        res.json({ success: true, user: { username: user.username, role: user.role, name: user.name, icon: user.icon } });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// ===== STAFF =====
app.get('/api/staff', (req, res) => {
    const staff = db.prepare('SELECT username, name, role, icon FROM staff').all();
    res.json(staff);
});

// ===== ORDERS =====
// Get all orders (with optional filters)
app.get('/api/orders', (req, res) => {
    const { status, type, waiter, chef, today } = req.query;
    let sql = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (type) { sql += ' AND type = ?'; params.push(type); }
    if (waiter) { sql += ' AND waiter = ?'; params.push(waiter); }
    if (chef) { sql += ' AND chef = ?'; params.push(chef); }
    if (today === 'true') {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        sql += ' AND createdAt >= ?';
        params.push(startOfDay.getTime());
    }

    sql += ' ORDER BY createdAt DESC';
    const orders = db.prepare(sql).all(...params);

    // Parse items JSON string back to array
    orders.forEach(o => {
        try { o.items = JSON.parse(o.items); } catch(e) {}
    });

    res.json(orders);
});

// Get online pending orders (unclaimed)
app.get('/api/orders/online', (req, res) => {
    const orders = db.prepare("SELECT * FROM orders WHERE type = 'online' AND status = 'pending' AND (waiter IS NULL OR waiter = '') ORDER BY createdAt ASC").all();
    orders.forEach(o => { try { o.items = JSON.parse(o.items); } catch(e) {} });
    res.json(orders);
});

// Create order
app.post('/api/orders', (req, res) => {
    const o = req.body;
    const now = Date.now();

    // Generate unique ID
    let orderId = o.id;
    if (!orderId) {
        if (o.type === 'online') {
            const count = db.prepare("SELECT COUNT(*) as c FROM orders WHERE type = 'online'").get().c + 1;
            orderId = `ORD-ONL-${String(count).padStart(4, '0')}`;
        } else {
            const waiterNum = (o.waiter || '').replace('waiter', '') || '0';
            const count = db.prepare("SELECT COUNT(*) as c FROM orders WHERE waiter = ?").get(o.waiter || '').c + 1;
            orderId = `ORD-W${waiterNum}-${String(count).padStart(4, '0')}`;
        }
    }

    const stmt = db.prepare(`
        INSERT INTO orders (id, type, items, tableNum, guests, status, waiter, waiterName, chef, chefName, total, notes, customerPhone, paymentMethod, paymentStatus, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        orderId,
        o.type || 'dine-in',
        JSON.stringify(o.items || []),
        o.table || null,
        o.guests || null,
        o.status || 'pending',
        o.waiter || null,
        o.waiterName || null,
        o.chef || null,
        o.chefName || null,
        o.total || 0,
        o.notes || null,
        o.customerPhone || null,
        o.paymentMethod || null,
        o.paymentStatus || 'unpaid',
        o.createdAt || now,
        o.updatedAt || now
    );

    res.json({ success: true, orderId });
});

// Update order
app.put('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const now = Date.now();

    // Build dynamic update
    const fields = [];
    const values = [];
    const allowed = ['status', 'waiter', 'waiterName', 'chef', 'chefName', 'paymentMethod', 'paymentStatus', 'notes'];

    allowed.forEach(field => {
        if (updates[field] !== undefined) {
            fields.push(`${field} = ?`);
            values.push(updates[field]);
        }
    });

    fields.push('updatedAt = ?');
    values.push(now);
    values.push(id);

    db.prepare(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    // If status changed to 'cooking', deduct inventory
    if (updates.status === 'cooking') {
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
        if (order) {
            const warnings = deductInventoryForOrder(order.items);
            return res.json({ success: true, lowStockWarnings: warnings });
        }
    }

    res.json({ success: true });
});

// ===== INVENTORY =====
app.get('/api/inventory', (req, res) => {
    const inventory = db.prepare('SELECT * FROM inventory ORDER BY name').all();
    res.json(inventory);
});

app.post('/api/inventory', (req, res) => {
    const i = req.body;
    const result = db.prepare('INSERT INTO inventory (name, quantity, unit, costPerUnit, lowStockThreshold) VALUES (?, ?, ?, ?, ?)')
        .run(i.name, i.quantity, i.unit, i.costPerUnit, i.lowStockThreshold);
    res.json({ success: true, id: result.lastInsertRowid });
});

app.put('/api/inventory/:id', (req, res) => {
    const { id } = req.params;
    const i = req.body;
    db.prepare('UPDATE inventory SET name = ?, quantity = ?, unit = ?, costPerUnit = ?, lowStockThreshold = ? WHERE id = ?')
        .run(i.name, i.quantity, i.unit, i.costPerUnit, i.lowStockThreshold, id);
    res.json({ success: true });
});

app.delete('/api/inventory/:id', (req, res) => {
    db.prepare('DELETE FROM inventory WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// ===== TRANSACTIONS =====
app.get('/api/transactions', (req, res) => {
    const { today } = req.query;
    let sql = 'SELECT * FROM transactions';
    const params = [];

    if (today === 'true') {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        sql += ' WHERE timestamp >= ?';
        params.push(startOfDay.getTime());
    }

    sql += ' ORDER BY timestamp DESC';
    res.json(db.prepare(sql).all(...params));
});

app.post('/api/transactions', (req, res) => {
    const t = req.body;
    const result = db.prepare(`
        INSERT INTO transactions (orderId, amount, tax, discount, finalAmount, method, cashier, cashierName, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(t.orderId, t.amount, t.tax, t.discount, t.finalAmount, t.method, t.cashier, t.cashierName, t.timestamp || Date.now());

    // Also update the order status to 'paid'
    db.prepare("UPDATE orders SET status = 'paid', paymentStatus = 'paid', paymentMethod = ?, updatedAt = ? WHERE id = ?")
        .run(t.method, Date.now(), t.orderId);

    res.json({ success: true, id: result.lastInsertRowid });
});

// ===== STATS (for manager) =====
app.get('/api/stats/today', (req, res) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const start = startOfDay.getTime();

    const totalOrders = db.prepare('SELECT COUNT(*) as c FROM orders WHERE createdAt >= ?').get(start).c;
    const revenue = db.prepare('SELECT COALESCE(SUM(finalAmount), 0) as total FROM transactions WHERE timestamp >= ?').get(start).total;
    const txnCount = db.prepare('SELECT COUNT(*) as c FROM transactions WHERE timestamp >= ?').get(start).c;
    const avgOrder = txnCount > 0 ? Math.round(revenue / txnCount) : 0;

    const cashTotal = db.prepare("SELECT COALESCE(SUM(finalAmount), 0) as total FROM transactions WHERE timestamp >= ? AND method = 'cash'").get(start).total;
    const upiTotal = db.prepare("SELECT COALESCE(SUM(finalAmount), 0) as total FROM transactions WHERE timestamp >= ? AND method = 'upi'").get(start).total;
    const cardTotal = db.prepare("SELECT COALESCE(SUM(finalAmount), 0) as total FROM transactions WHERE timestamp >= ? AND method = 'card'").get(start).total;

    res.json({
        totalOrders, revenue, avgOrder,
        profit: Math.round(revenue * 0.4),
        cashTotal, upiTotal, cardTotal, txnCount
    });
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

        const orders = db.prepare('SELECT id, type, status, total, paymentMethod, paymentStatus FROM orders WHERE createdAt >= ?').all(t);
        const inv = db.prepare('SELECT name, quantity, lowStockThreshold FROM inventory WHERE quantity <= lowStockThreshold * 2').all();
        const txns = db.prepare('SELECT method, discount, finalAmount FROM transactions WHERE timestamp >= ?').all(t);
        
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
    console.log('  🍽️  CULTURED KITCHEN Server (LOCAL SQLITE) ');
    console.log('  🍽️  ═══════════════════════════════════════');
    console.log(`  🌐  Customer Site:  http://localhost:${PORT}`);
    console.log(`  🔐  Staff Login:    http://localhost:${PORT}/staff/login.html`);
    console.log(`  📡  API:            http://localhost:${PORT}/api`);
    console.log('  🍽️  ═══════════════════════════════════════');
    console.log('');
});
