// ===== Elysium Staff Login (API Version) =====

const ROLE_ICONS = { manager: '📊', cashier: '💰', chef: '👨‍🍳', waiter: '🍽️' };

// DOM Elements
const loginForm = document.getElementById('login-form');
const loginContainer = document.getElementById('login-container');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('toggle-password');
const errorMessage = document.getElementById('error-message');
const errorText = document.getElementById('error-text');
const loginBtn = document.getElementById('login-btn');
const roleBadge = document.getElementById('role-badge');
const roleIcon = document.getElementById('role-icon');
const roleName = document.getElementById('role-name');
const rememberMe = document.getElementById('remember-me');

// Create floating particles
function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.width = (Math.random() * 3 + 1) + 'px';
        particle.style.height = particle.style.width;
        particle.style.animationDuration = (Math.random() * 10 + 8) + 's';
        particle.style.animationDelay = (Math.random() * 10) + 's';
        particle.style.opacity = Math.random() * 0.5 + 0.1;
        container.appendChild(particle);
    }
}

// Toggle password visibility
togglePasswordBtn.addEventListener('click', () => {
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
    togglePasswordBtn.textContent = type === 'password' ? '👁️' : '🙈';
});

// Check remembered user
function checkRememberedUser() {
    const remembered = localStorage.getItem('elysium_remembered');
    if (remembered) {
        try {
            const data = JSON.parse(remembered);
            usernameInput.value = data.username;
            rememberMe.checked = true;
        } catch (e) {
            localStorage.removeItem('elysium_remembered');
        }
    }
}

// Handle Login via API
loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const username = usernameInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    loginBtn.classList.add('loading');
    errorMessage.classList.remove('show');

    try {
        const result = await api.login(username, password);

        if (result.success) {
            const user = result.user;
            // Save session locally
            const session = {
                username: user.username,
                role: user.role,
                name: user.name,
                icon: user.icon,
                loginTime: Date.now()
            };
            localStorage.setItem('elysium_session', JSON.stringify(session));

            if (rememberMe.checked) {
                localStorage.setItem('elysium_remembered', JSON.stringify({ username: user.username }));
            } else {
                localStorage.removeItem('elysium_remembered');
            }

            // Show role badge
            roleIcon.textContent = user.icon;
            roleName.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
            roleBadge.classList.add('show');

            // Success visual
            loginContainer.style.borderColor = 'rgba(16, 185, 129, 0.5)';
            loginBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            loginBtn.querySelector('.btn-text').textContent = '✓ Welcome, ' + user.name.split(' ')[0];

            setTimeout(() => { window.location.href = user.role + '.html'; }, 1200);
        } else {
            handleLoginFailure();
        }
    } catch (err) {
        errorText.textContent = 'Server not reachable. Make sure the server is running.';
        errorMessage.classList.add('show');
    }

    loginBtn.classList.remove('loading');
});

function handleLoginFailure() {
    loginContainer.classList.add('shake');
    setTimeout(() => loginContainer.classList.remove('shake'), 500);
    errorText.textContent = 'Invalid username or password. Please try again.';
    errorMessage.classList.add('show');
    loginContainer.style.borderColor = 'rgba(239, 68, 68, 0.5)';
    setTimeout(() => { loginContainer.style.borderColor = 'rgba(255, 255, 255, 0.08)'; }, 2000);
    usernameInput.focus();
    usernameInput.select();
}

// Auto-redirect if already logged in
function checkExistingSession() {
    const session = localStorage.getItem('elysium_session');
    if (session) {
        try {
            const data = JSON.parse(session);
            if (Date.now() - data.loginTime < 12 * 60 * 60 * 1000) {
                window.location.href = data.role + '.html';
                return;
            } else {
                localStorage.removeItem('elysium_session');
            }
        } catch (e) {
            localStorage.removeItem('elysium_session');
        }
    }
}

createParticles();
checkRememberedUser();
checkExistingSession();
