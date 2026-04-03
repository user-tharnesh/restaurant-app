const menuData = [
    // Biryanis
    { id: 1, name: "Chicken Biryani", desc: "Aromatic basmati rice cooked with tender spiced chicken", price: 250, category: "mains", img: "chicken_biryani.png" },
    { id: 2, name: "Mutton Biryani", desc: "Premium basmati rice slow-cooked with succulent mutton pieces", price: 350, category: "mains", img: "mutton_biryani.png" },
    { id: 3, name: "Fish Biryani", desc: "Fragrant rice layered with delicately spiced fried fish", price: 300, category: "mains", img: "fish_biryani.png" },
    { id: 4, name: "Prawn Biryani", desc: "Flavourful biryani cooked with fresh coastal prawns", price: 380, category: "mains", img: "prawn_biryani.png" },
    
    // Fried Rice
    { id: 5, name: "Chicken Fried Rice", desc: "Wok-tossed rice with shredded chicken, eggs, and veggies", price: 220, category: "mains", img: "chicken_fried_rice.png" },
    { id: 6, name: "Veg Fried Rice", desc: "Classic Indo-Chinese style fried rice with mixed vegetables", price: 180, category: "mains", img: "veg_fried_rice.png" },
    { id: 7, name: "Egg Fried Rice", desc: "Fluffy rice combined with scrambled eggs and spring onions", price: 190, category: "mains", img: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=500&q=80" },

    // Breads
    { id: 8, name: "Tandoori Roti", desc: "Classic whole wheat flatbread baked in a tandoor", price: 30, category: "mains", img: "troti.webp" },
    { id: 9, name: "Plain Naan", desc: "Soft and fluffy traditional flatbread", price: 40, category: "mains", img: "naan.webp" },
    { id: 10, name: "Butter Naan", desc: "Tandoor baked flatbread generously brushed with butter", price: 50, category: "mains", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Garlic_naan.jpg?width=500" },
    
    // Sides / Gravies
    { id: 11, name: "Butter Chicken", desc: "Tender chicken simmered in a rich tomato and butter gravy", price: 280, category: "mains", img: "butterchicken.jpg" },
    { id: 12, name: "Dal Makhani", desc: "Creamy and rich black lentils slow-cooked overnight", price: 250, category: "mains", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Dal_Makhani.jpg?width=500" },

    // Starters
    { id: 13, name: "Paneer Tikka", desc: "Grilled cottage cheese cubes marinated in yogurt and spices", price: 200, category: "starters", img: "https://commons.wikimedia.org/wiki/Special:FilePath/Paneer_Tikka.jpg?width=500" },
    { id: 14, name: "Chicken 65", desc: "Spicy, deep-fried chicken bites with curry leaves", price: 220, category: "starters", img: "https://images.unsplash.com/photo-1617692855027-33b14f061079?w=500&q=80" },
    { id: 15, name: "Mutton Seekh Kebab", desc: "Minced mutton blended with spices and grilled on skewers", price: 280, category: "starters", img: "mutton-seekh-kebab-169030200216x9.webp" },
    { id: 16, name: "Chicken Samosa", desc: "Crispy pastry filled with spiced minced chicken", price: 100, category: "starters", img: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&q=80" },

    // Desserts
    { id: 17, name: "Gulab Jamun", desc: "Deep-fried milk dumplings soaked in rose-flavored sugar syrup", price: 80, category: "desserts", img: "gulab_jamun.webp" },
    { id: 18, name: "Rasmalai", desc: "Soft paneer balls immersed in chilled creamy milk", price: 120, category: "desserts", img: "rasmalai.webp" },
    
    // Additional Dishes
    { id: 20, name: "Palak Paneer", desc: "Creamy spinach curry with soft cottage cheese cubes", price: 230, category: "mains", img: "palak_paneer.avif" },
    { id: 21, name: "Mango Lassi", desc: "Refreshing yogurt-based sweet drink with mango pulp", price: 90, category: "desserts", img: "mango_lassi.png" }
];

let cart = [];

const menuGrid = document.getElementById('menu-grid');
const categoryBtns = document.querySelectorAll('.category-btn');
const cartToggle = document.getElementById('cart-toggle');
const closeCart = document.getElementById('close-cart');
const cartSidebar = document.getElementById('cart-sidebar');
const overlay = document.getElementById('overlay');
const cartItemsContainer = document.getElementById('cart-items');
const cartCount = document.getElementById('cart-count');
const cartTotal = document.getElementById('cart-total');

// Initialization
function init() {
    if (menuGrid) {
        renderMenu('all');
    }
    setupEventListeners();
}

function renderMenu(filterCategory) {
    menuGrid.innerHTML = '';
    const filteredData = filterCategory === 'all'
        ? menuData
        : menuData.filter(item => item.category === filterCategory);

    filteredData.forEach(item => {
        const card = document.createElement('div');
        card.className = 'menu-card';
        card.innerHTML = `
            <img src="${item.img}" alt="${item.name}" class="menu-image">
            <div class="menu-info">
                <h3 class="menu-title">${item.name}</h3>
                <p class="menu-desc">${item.desc}</p>
                <div class="menu-bottom">
                    <span class="menu-price">₹${item.price}</span>
                    <button class="add-btn" onclick="addToCart(${item.id})">+</button>
                </div>
            </div>
        `;
        menuGrid.appendChild(card);
    });
}

function setupEventListeners() {
    // Categories filtering
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            categoryBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderMenu(e.target.dataset.category);
        });
    });

    // Cart Sidebar Toggles
    if (cartToggle) {
        cartToggle.addEventListener('click', toggleCart);
        closeCart.addEventListener('click', toggleCart);
        overlay.addEventListener('click', toggleCart);
    }

}

function toggleCart() {
    const checkoutModal = document.getElementById('checkout-modal');
    if (checkoutModal && checkoutModal.classList.contains('active')) return;

    cartSidebar.classList.toggle('open');
    if (cartSidebar.classList.contains('open')) {
        overlay.classList.add('active');
    } else {
        overlay.classList.remove('active');
    }
}

window.addToCart = function (id) {
    const item = menuData.find(i => i.id === id);
    if (item) {
        cart.push(item);
        updateCartUI();

        // simple visual feedback
        cartToggle.style.transform = 'scale(1.2)';
        setTimeout(() => cartToggle.style.transform = 'scale(1)', 200);
    }
}

window.removeFromCart = function (index) {
    cart.splice(index, 1);
    updateCartUI();
}

function updateCartUI() {
    cartCount.innerText = cart.length;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart-msg">Your cart is empty.</p>';
        cartTotal.innerText = '₹0';
        return;
    }

    cartItemsContainer.innerHTML = '';
    let total = 0;

    cart.forEach((item, index) => {
        total += item.price;
        const cartItemEl = document.createElement('div');
        cartItemEl.className = 'cart-item';
        cartItemEl.innerHTML = `
            <div class="cart-item-info">
                <h4>${item.name}</h4>
                <div class="cart-item-price">₹${item.price}</div>
            </div>
            <button class="remove-item" onclick="removeFromCart(${index})">Remove</button>
        `;
        cartItemsContainer.appendChild(cartItemEl);
    });

    cartTotal.innerText = '₹' + total;
}

const checkoutModal = document.getElementById('checkout-modal');
const checkoutForm = document.getElementById('checkout-form');
const btnLocation = document.getElementById('btn-location');
const closeCheckoutBtn = document.getElementById('close-checkout');

function openCheckoutModal() {
    if (cart.length === 0) {
        alert('Please add items to your cart first.');
        return;
    }
    // Close sidebar visually, keep overlay active for Modal
    cartSidebar.classList.remove('open');
    checkoutModal.classList.add('active');
    overlay.classList.add('active');
}

function closeCheckout() {
    checkoutModal.classList.remove('active');
    overlay.classList.remove('active');
}

document.getElementById('checkout-btn')?.addEventListener('click', openCheckoutModal);

if (closeCheckoutBtn) {
    closeCheckoutBtn.addEventListener('click', closeCheckout);
}

// Enhance overlay click: if modal is active, close it.
if (overlay) {
    overlay.addEventListener('click', () => {
        if (checkoutModal && checkoutModal.classList.contains('active')) {
            closeCheckout();
        }
    });
}

// Geolocation Logic
if (btnLocation) {
    btnLocation.addEventListener('click', () => {
        if (navigator.geolocation) {
            btnLocation.innerText = '📍 Fetching...';
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    document.getElementById('cx-address').value = `${lat}, ${lng}\n`;
                    btnLocation.innerText = '📍 Location Added';
                },
                (error) => {
                    console.error(error);
                    alert("Unable to fetch location. Please enter manually.");
                    btnLocation.innerText = '📍 Get Coordinates';
                }
            );
        } else {
            alert("Geolocation is not supported by this browser.");
        }
    });
}

// Save online order to server API
async function saveOnlineOrder(phone, paymentMethodNote) {
    const totalAmount = cart.reduce((sum, item) => sum + item.price, 0);

    // Group items with quantities
    const itemMap = {};
    cart.forEach(item => {
        if (itemMap[item.id]) {
            itemMap[item.id].qty += 1;
        } else {
            itemMap[item.id] = { name: item.name, price: item.price, qty: 1 };
        }
    });

    const order = {
        type: 'online',
        items: Object.values(itemMap),
        total: totalAmount,
        notes: 'Online Order — ' + paymentMethodNote,
        customerPhone: phone,
        paymentStatus: 'unpaid'
    };

    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(order)
        });
        const result = await response.json();
        return result.orderId;
    } catch (err) {
        console.error('Failed to save order:', err);
        return 'ORD-LOCAL-' + Date.now();
    }
}

// Handle Order Placement
if (checkoutForm) {
    checkoutForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const phone = document.getElementById('cx-phone').value;
        const payment = document.getElementById('cx-payment').value;
        const totalText = cartTotal.innerText;
        const totalAmount = cart.reduce((sum, item) => sum + item.price, 0);

        let paymentNote = payment.toUpperCase();
        if (payment === 'upi') {
            const upiId = document.getElementById('cx-upi-id').value;
            if (!upiId) {
                alert('Please enter your UPI ID.');
                return;
            }
            paymentNote = `UPI (${upiId})`;
        }

        // Save to server API and get reference number
        const orderId = await saveOnlineOrder(phone, paymentNote);

        if (payment === 'upi') {
            const upiId = document.getElementById('cx-upi-id').value;
            alert(`Order Placed Successfully! 🎉\n\nYour Reference: ${orderId}\n\nTotal: ${totalText}\nPayment: UPI (${upiId})\nA payment request of ₹${totalAmount} will be sent to your UPI ID.\nWe will send order updates to ${phone}.\n\nPlease save your reference number: ${orderId}`);
        } else {
            alert(`Order Placed Successfully! 🎉\n\nYour Reference: ${orderId}\n\nTotal: ${totalText}\nPayment: ${payment.toUpperCase()}\nWe will send updates to ${phone}.\n\nPlease save your reference number: ${orderId}`);
        }

        cart = [];
        updateCartUI();
        closeCheckout();
        checkoutForm.reset();
        const upiField = document.getElementById('upi-field');
        if (upiField) upiField.style.display = 'none';
        btnLocation.innerText = '📍 Get Coordinates';
    });
}

// Show/Hide UPI ID field based on payment method selection
const paymentSelect = document.getElementById('cx-payment');
if (paymentSelect) {
    paymentSelect.addEventListener('change', function() {
        const upiField = document.getElementById('upi-field');
        if (upiField) {
            upiField.style.display = this.value === 'upi' ? 'block' : 'none';
        }
    });
}

// Reservation Form Logic
const reservationForm = document.getElementById('reservation-form');
if (reservationForm) {
    reservationForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const name = document.getElementById('res-name').value;
        const date = document.getElementById('res-date').value;
        const time = document.getElementById('res-time').value;
        
        alert(`Thank you, ${name}! Your table is successfully reserved for ${date} at ${time}. We will connect with you via SMS shortly.`);
        reservationForm.reset();
    });
}

// Run Init
init();
