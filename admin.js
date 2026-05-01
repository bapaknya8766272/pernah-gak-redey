/**
 * HOSTING JADI BESAR - Admin Panel JavaScript
 * Enhanced Security Version
 */

// ========================================
// SECURITY CONFIGURATION
// ========================================
const SECURITY = {
    // SHA256 of 'admin123' - CHANGE THIS!
    USERNAME_HASH: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
    PASSWORD_HASH: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
    
    SESSION_DURATION: 60 * 60 * 1000, // 1 hour
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
    
    // Store login attempts
    attempts: parseInt(localStorage.getItem('login_attempts') || '0'),
    lockoutEnd: parseInt(localStorage.getItem('lockout_end') || '0')
};

// ========================================
// CRYPTO UTILS
// ========================================
async function sha256(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateSessionToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

function getClientIP() {
    // In real implementation, this would come from server
    // For client-side, we use a fingerprint
    return localStorage.getItem('client_fingerprint') || generateFingerprint();
}

function generateFingerprint() {
    const fp = navigator.userAgent + navigator.language + screen.width + screen.height;
    let hash = 0;
    for (let i = 0; i < fp.length; i++) {
        const char = fp.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    const fingerprint = Math.abs(hash).toString(16);
    localStorage.setItem('client_fingerprint', fingerprint);
    return fingerprint;
}

// ========================================
// SESSION MANAGEMENT
// ========================================
const SessionManager = {
    timer: null,
    remaining: 60 * 60, // seconds

    start() {
        this.remaining = parseInt(localStorage.getItem('session_timeout') || '3600');
        this.updateDisplay();
        
        this.timer = setInterval(() => {
            this.remaining--;
            this.updateDisplay();
            
            if (this.remaining <= 0) {
                this.expire();
            }
            
            // Warning at 5 minutes
            if (this.remaining === 300) {
                Swal.fire({
                    title: 'Sesi Hampir Habis',
                    text: 'Sesi Anda akan berakhir dalam 5 menit. Lanjutkan?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Ya, Lanjutkan',
                    cancelButtonText: 'Logout',
                    background: '#1a1a2e',
                    color: '#fff'
                }).then((result) => {
                    if (result.isConfirmed) {
                        this.extend();
                    } else {
                        logout();
                    }
                });
            }
        }, 1000);
    },

    updateDisplay() {
        const mins = Math.floor(this.remaining / 60);
        const secs = this.remaining % 60;
        const display = document.getElementById('session-timer');
        if (display) {
            display.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    },

    extend() {
        this.remaining = parseInt(localStorage.getItem('session_timeout') || '3600');
        sessionStorage.setItem('session_start', Date.now().toString());
    },

    expire() {
        clearInterval(this.timer);
        Swal.fire({
            title: 'Sesi Berakhir',
            text: 'Sesi Anda telah berakhir. Silakan login kembali.',
            icon: 'info',
            confirmButtonText: 'OK',
            background: '#1a1a2e',
            color: '#fff'
        }).then(() => {
            logout();
        });
    },

    stop() {
        clearInterval(this.timer);
    }
};

// ========================================
// LOGIN SYSTEM — pakai MongoDB via /api/admin-auth
// ========================================

// Token admin disimpan di sessionStorage
const AdminAuth = {
    getToken() { return sessionStorage.getItem('admin_token') || ''; },
    setToken(t) { sessionStorage.setItem('admin_token', t); },
    clear()     { sessionStorage.removeItem('admin_token'); sessionStorage.removeItem('admin_username'); }
};

async function login() {
    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value;

    if (!username || !password) { showLoginError('Username dan password harus diisi!'); return; }

    const btn = document.querySelector('.login-form .btn-primary');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memverifikasi...'; }

    try {
        const res = await fetch('/api/admin-auth?action=login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (!res.ok) {
            showLoginError(data.error || 'Login gagal');
            return;
        }

        // Simpan token
        AdminAuth.setToken(data.token);
        sessionStorage.setItem('admin_username', data.username);
        sessionStorage.setItem('session_start', Date.now().toString());

        showDashboard();

    } catch (err) {
        // Fallback ke mode offline (hash lokal) jika API tidak tersedia
        console.warn('API tidak tersedia, fallback ke mode lokal:', err.message);
        await loginFallback(username, password);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Masuk'; }
    }
}

// Fallback login dengan hash lokal (jika MongoDB belum disetup)
async function loginFallback(username, password) {
    const usernameHash = await sha256(username);
    const passwordHash = await sha256(password);

    // Cek custom hash dari localStorage (setelah ganti password)
    const storedUsernameHash = localStorage.getItem('custom_username_hash') || SECURITY.USERNAME_HASH;
    const storedPasswordHash = localStorage.getItem('custom_password_hash') || SECURITY.PASSWORD_HASH;

    if (usernameHash === storedUsernameHash && passwordHash === storedPasswordHash) {
        AdminAuth.setToken('local_' + generateSessionToken());
        sessionStorage.setItem('admin_username', username);
        sessionStorage.setItem('session_start', Date.now().toString());
        sessionStorage.setItem('admin_auth', 'true'); // backward compat
        showDashboard();
    } else {
        SECURITY.attempts++;
        localStorage.setItem('login_attempts', SECURITY.attempts);
        const remaining = SECURITY.MAX_LOGIN_ATTEMPTS - SECURITY.attempts;
        if (SECURITY.attempts >= SECURITY.MAX_LOGIN_ATTEMPTS) {
            SECURITY.lockoutEnd = Date.now() + SECURITY.LOCKOUT_DURATION;
            localStorage.setItem('lockout_end', SECURITY.lockoutEnd);
            showLoginError('Akun terkunci 15 menit!');
        } else {
            showLoginError(`Username atau password salah! (${remaining} percobaan tersisa)`);
        }
    }
}

function showLoginError(message) {
    const errorEl = document.getElementById('login-error');
    if (errorEl) { errorEl.querySelector('span').textContent = message; errorEl.classList.add('show'); }
    const loginBox = document.querySelector('.login-box');
    if (loginBox) { loginBox.style.animation = 'shake 0.5s'; setTimeout(() => loginBox.style.animation = '', 500); }
}

function togglePassword() {
    const input = document.getElementById('admin-password');
    const btn = document.querySelector('.toggle-password i');
    if (input.type === 'password') { input.type = 'text'; btn.classList.replace('fa-eye', 'fa-eye-slash'); }
    else { input.type = 'password'; btn.classList.replace('fa-eye-slash', 'fa-eye'); }
}

async function logout() {
    SessionManager.stop();
    const token = AdminAuth.getToken();
    if (token && !token.startsWith('local_')) {
        try { await fetch('/api/admin-auth?action=logout', { method: 'POST', headers: { 'X-Admin-Token': token } }); } catch {}
    }
    AdminAuth.clear();
    sessionStorage.clear();
    location.reload();
}

async function checkAuth() {
    const token = AdminAuth.getToken();

    // Coba verifikasi via API
    if (token && !token.startsWith('local_')) {
        try {
            const res = await fetch('/api/admin-auth?action=check', { headers: { 'X-Admin-Token': token } });
            if (res.ok) { showDashboard(); return; }
            AdminAuth.clear();
        } catch {
            // API tidak tersedia, fallback ke lokal
        }
    }

    // Fallback: cek session lokal
    const auth = sessionStorage.getItem('admin_auth');
    const sessionStart = parseInt(sessionStorage.getItem('session_start') || '0');
    const sessionDuration = parseInt(localStorage.getItem('session_timeout') || '3600') * 1000;
    if ((auth === 'true' || token?.startsWith('local_')) && (Date.now() - sessionStart) < sessionDuration) {
        showDashboard();
    }
}

function showDashboard() {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'flex';
    SessionManager.start();
    initDashboard();
}

// ── Setup admin pertama kali ──────────────────────────────────
async function submitAdminSetup() {
    const username = document.getElementById('setup-username').value.trim();
    const password = document.getElementById('setup-password').value;
    const confirm  = document.getElementById('setup-confirm').value;
    const errEl    = document.getElementById('setup-error');

    if (!username || !password) { errEl.textContent = 'Semua field harus diisi'; errEl.style.display = 'block'; return; }
    if (password !== confirm)   { errEl.textContent = 'Password tidak cocok'; errEl.style.display = 'block'; return; }
    if (password.length < 12)  { errEl.textContent = 'Password minimal 12 karakter'; errEl.style.display = 'block'; return; }

    try {
        const res = await fetch('/api/admin-auth?action=setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) { errEl.textContent = data.error; errEl.style.display = 'block'; return; }

        document.getElementById('admin-setup-modal').style.display = 'none';
        Swal.fire({ icon: 'success', title: 'Admin dibuat!', text: 'Silakan login dengan kredensial baru.', background: '#1a1a2e', color: '#fff' });
    } catch (err) {
        errEl.textContent = 'Gagal terhubung ke server: ' + err.message;
        errEl.style.display = 'block';
    }
}

// ── Ganti password via API ────────────────────────────────────
async function changePassword() {
    const oldPass  = document.getElementById('old-password').value;
    const newPass  = document.getElementById('new-password').value;
    const confPass = document.getElementById('confirm-password').value;

    if (!oldPass || !newPass || !confPass) { Swal.fire({ icon: 'error', title: 'Error', text: 'Semua field harus diisi!', background: '#1a1a2e', color: '#fff' }); return; }
    if (newPass !== confPass) { Swal.fire({ icon: 'error', title: 'Error', text: 'Password baru tidak cocok!', background: '#1a1a2e', color: '#fff' }); return; }
    if (newPass.length < 12) { Swal.fire({ icon: 'error', title: 'Error', text: 'Password minimal 12 karakter!', background: '#1a1a2e', color: '#fff' }); return; }

    const token = AdminAuth.getToken();

    // Coba via API dulu
    if (token && !token.startsWith('local_')) {
        try {
            const res = await fetch('/api/admin-auth?action=change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
                body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass })
            });
            const data = await res.json();
            if (!res.ok) { Swal.fire({ icon: 'error', title: 'Error', text: data.error, background: '#1a1a2e', color: '#fff' }); return; }
            document.getElementById('change-password-modal').classList.remove('active');
            addActivityLog('Keamanan', 'Password admin berhasil diubah via DB');
            Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Password berhasil diubah.', background: '#1a1a2e', color: '#fff' });
            return;
        } catch { /* fallback ke lokal */ }
    }

    // Fallback: simpan hash lokal
    const oldHash = await sha256(oldPass);
    const storedHash = localStorage.getItem('custom_password_hash') || SECURITY.PASSWORD_HASH;
    if (oldHash !== storedHash) { Swal.fire({ icon: 'error', title: 'Error', text: 'Password lama salah!', background: '#1a1a2e', color: '#fff' }); return; }
    const newHash = await sha256(newPass);
    localStorage.setItem('custom_password_hash', newHash);
    document.getElementById('change-password-modal').classList.remove('active');
    addActivityLog('Keamanan', 'Password admin berhasil diubah (lokal)');
    Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Password berhasil diubah.', background: '#1a1a2e', color: '#fff' });
}

// ========================================
// DASHBOARD INITIALIZATION
// ========================================
let salesChart, categoryChart, trafficChart, deviceChart;
let sparklineCharts = {};

// CHART_DEFAULTS harus dideklarasikan sebelum initCharts dipanggil
const CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#71717a', font: { size: 11 } } },
        x: { grid: { display: false }, ticks: { color: '#71717a', font: { size: 11 } } }
    }
};

function initCharts() {
    initSalesChart();
    initCategoryChart();
    initTrafficChart();
    initDeviceChart();
    initSparklines();
    loadRealtimeData();
    // Update realtime setiap 30 detik
    setInterval(loadRealtimeData, 30000);
}

function initDashboard() {
    updateStats();
    initCharts();
    renderRecentOrders();
    renderProductsTable();
    renderOrdersTable();
    renderTestimonials();
    renderCustomers();
    loadSettings();
    setupEventListeners();
    checkAndUpdateStock();
    setInterval(checkAndUpdateStock, 30000);
    addActivityLog('Login', 'Admin berhasil login');
    loadSettingsFromDB();
    updateNewsletterBadge();
    updateReviewsBadge();
    // Inisialisasi produk ke MongoDB jika belum ada
    initProductsDB();
    // Mulai polling order baru (notif real-time)
    startOrderPolling();
}

async function initProductsDB() {
    const token = AdminAuth.getToken();
    if (!token) return;
    try {
        const res = await fetch('/api/products', { headers: { 'X-Admin-Token': token } });
        if (!res.ok) return;
        const data = await res.json();
        if (data.source === 'default' || !data.products?.length) {
            // Belum ada produk di DB, init dari default
            await fetch('/api/products?action=init', {
                method: 'POST',
                headers: { 'X-Admin-Token': token }
            });
            ProductManager._cache = null;
            await ProductManager.loadFromDB();
            renderProductsTable();
        }
    } catch { /* silent */ }
}

function setupEventListeners() {
    // Menu toggle for mobile
    document.getElementById('menu-toggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
        document.getElementById('sidebar').classList.toggle('mobile-open');
    });
    
    // Nav items - FIXED: Use click handler with proper preventDefault
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const section = this.dataset.section;
            if (section) {
                showSection(section);
            }
            // Close mobile sidebar after click
            if (window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.remove('mobile-open');
            }
        });
    });
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filterProductsByCategory(this.dataset.filter);
        });
    });
}

function showSection(sectionName) {
    if (!sectionName) return;
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.section === sectionName) item.classList.add('active');
    });
    
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
        section.style.display = 'none';
    });
    
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) { targetSection.classList.add('active'); targetSection.style.display = 'block'; }
    
    const titles = {
        dashboard: 'Dashboard', products: 'Produk & Stok', orders: 'Pesanan',
        testimonials: 'Testimoni', customers: 'Pelanggan', settings: 'Pengaturan',
        changelog: 'Log Aktivitas', vouchers: 'Voucher', analytics: 'Analitik',
        broadcast: 'Broadcast', newsletter: 'Newsletter Subscribers',
        'flash-sale': 'Flash Sale Manager', reviews: 'Manajemen Ulasan'
    };
    
    const pageTitle = document.getElementById('page-title');
    if (pageTitle && titles[sectionName]) pageTitle.textContent = titles[sectionName];
    
    switch(sectionName) {
        case 'products':    renderProductsTable(); break;
        case 'orders':      renderOrdersTable(); break;
        case 'testimonials': renderTestimonials(); break;
        case 'customers':   renderCustomers(); break;
        case 'vouchers':    renderVouchers(); break;
        case 'analytics':   renderAnalytics(); break;
        case 'broadcast':   renderBroadcast(); break;
        case 'changelog':   renderActivityLog(); break;
        case 'newsletter':  renderNewsletter(); break;
        case 'flash-sale':  renderFlashSale(); break;
        case 'reviews':     renderReviews(); break;
        case 'settings':    loadSettings(); loadPromoSettings(); break;
    }
}

// ========================================
// STATS & CHARTS
// ========================================
function updateStats() {
    const products = ProductManager.getAll();
    const token = AdminAuth.getToken();

    // Load semua stats dari MongoDB secara paralel
    Promise.all([
        fetch('/api/orders', { headers: { 'X-Admin-Token': token } }).then(r => r.json()).catch(() => ({ orders: [] })),
        fetch('/api/visitors', { headers: { 'X-Admin-Token': token } }).then(r => r.json()).catch(() => ({ stats: { total: 0 } }))
    ]).then(([orderData, visitorData]) => {
        const orders = orderData.orders || [];
        const revenue = orders.reduce((t, o) => t + (o.total || 0), 0);
        const lowStock = products.filter(p => p.category !== 'other' && p.stock <= 5).length;
        const totalVisitors = visitorData.stats?.total || 0;

        document.getElementById('total-revenue').textContent = Utils.formatRupiah(revenue);
        document.getElementById('total-orders').textContent = orders.length;
        document.getElementById('total-visitors').textContent = totalVisitors.toLocaleString('id-ID');
        document.getElementById('total-products').textContent = products.length;

        const lowStockEl = document.getElementById('low-stock-count');
        const stockAlert = document.getElementById('stock-alert');
        const lowStockBadge = document.getElementById('low-stock-badge');
        if (lowStockEl) lowStockEl.textContent = lowStock;
        if (stockAlert) stockAlert.style.display = lowStock > 0 ? 'flex' : 'none';
        if (lowStockBadge) { lowStockBadge.textContent = lowStock; lowStockBadge.style.display = lowStock > 0 ? 'flex' : 'none'; }
    }).catch(() => {
        document.getElementById('total-revenue').textContent = Utils.formatRupiah(0);
        document.getElementById('total-orders').textContent = '0';
        document.getElementById('total-visitors').textContent = '0';
        document.getElementById('total-products').textContent = products.length;
    });
}

// initCharts lama digantikan oleh fungsi-fungsi baru di bawah

function getSalesData(days) {
    // Data dari MongoDB orders (async, dipanggil terpisah)
    const labels = [];
    const values = [];
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }));
        values.push(0);
    }
    return { labels, datasets: [{ data: values, borderColor: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.1)', fill: true, tension: 0.4 }] };
}

function getCategoryData() {
    return { vps: 0, panel: 0, other: 0 };
}

function updateSalesChart() {
    const days = parseInt(document.getElementById('sales-period')?.value || '7');
    loadSalesChartData(days);
}

function refreshDashboard() {
    updateStats();
    loadSalesChartData(parseInt(document.getElementById('sales-period')?.value || '7'));
    loadTrafficData(parseInt(document.getElementById('traffic-period')?.value || '7'));
    loadDeviceData();
    loadRealtimeData();
    renderRecentOrders();
    Swal.fire({ icon: 'success', title: 'Refreshed!', text: 'Data dashboard diperbarui.', background: '#1a1a2e', color: '#fff', timer: 1000, showConfirmButton: false });
}

function copyOrderId(orderId) {
    navigator.clipboard.writeText(orderId).then(() => {
        Swal.fire({ icon: 'success', title: 'Disalin!', text: `Order ID ${orderId} disalin.`, background: '#1a1a2e', color: '#fff', timer: 1000, showConfirmButton: false });
    }).catch(() => {
        prompt('Copy Order ID:', orderId);
    });
}

async function renderRecentOrders() {
    const tbody = document.getElementById('recent-orders-body');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;"><i class="fas fa-spinner fa-spin"></i></td></tr>`;

    const token = AdminAuth.getToken();
    try {
        const res = await fetch('/api/orders?limit=5', { headers: { 'X-Admin-Token': token } });
        if (!res.ok) throw new Error();
        const { orders } = await res.json();

        if (!orders || orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted)">Belum ada pesanan</td></tr>`;
            return;
        }

        tbody.innerHTML = orders.slice(0, 5).map(order => {
            const itemNames = order.items?.slice(0,2).map(i => i.name).join(', ') || '-';
            const oid = order.orderId || order._id;
            return `
            <tr>
                <td><code class="order-id" style="cursor:pointer;" onclick="copyOrderId('${oid}')" title="Klik untuk copy">${oid} <i class="fas fa-copy" style="font-size:0.7rem;opacity:0.5;"></i></code></td>
                <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${itemNames}</td>
                <td>${Utils.formatRupiah(order.total || 0)}</td>
                <td><span class="status-badge ${order.status || 'pending'}">${order.status === 'completed' ? 'Selesai' : order.status === 'pending' ? 'Pending' : 'Dibatalkan'}</span></td>
                <td>${new Date(order.createdAt).toLocaleDateString('id-ID')}</td>
            </tr>`;
        }).join('');
    } catch {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted)">Belum ada pesanan</td></tr>`;
    }
}

// ========================================
// PRODUCTS MANAGEMENT
// ========================================
let currentProductFilter = 'all';

async function renderProductsTable(filter = '') {
    const tbody = document.getElementById('products-table-body');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;"><i class="fas fa-spinner fa-spin"></i> Memuat produk...</td></tr>`;

    const token = AdminAuth.getToken();
    let products = [];

    try {
        // Load dari MongoDB
        const res = await fetch('/api/products', { headers: { 'X-Admin-Token': token } });
        if (res.ok) {
            const data = await res.json();
            products = data.products || [];
            // Update cache lokal
            if (products.length > 0) {
                localStorage.setItem('products', JSON.stringify(products));
                if (typeof ProductManager !== 'undefined') {
                    ProductManager._cache = products;
                    ProductManager._cacheTime = Date.now();
                }
            }
        }
    } catch {}

    // Fallback ke cache lokal
    if (products.length === 0) {
        products = JSON.parse(localStorage.getItem('products') || '[]');
    }

    // Filter kategori
    if (currentProductFilter !== 'all') {
        products = products.filter(p => p.category === currentProductFilter);
    }

    // Filter search
    if (filter) {
        const q = filter.toLowerCase();
        products = products.filter(p => p.name.toLowerCase().includes(q));
    }

    if (products.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);">
            <i class="fas fa-box-open" style="font-size:2rem;display:block;margin-bottom:10px;opacity:0.3;"></i>
            Belum ada produk. <button class="btn btn-primary btn-sm" onclick="initProductsDB()" style="margin-left:10px;">Init Produk Default</button>
        </td></tr>`;
        return;
    }

    const categoryLabels = { vps: 'VPS', panel: 'Panel', other: 'Jasa' };

    // Cache produk untuk akses cepat dari onclick
    window._adminProductCache = {};
    products.forEach(p => { window._adminProductCache[p.id || p._id] = p; });

    tbody.innerHTML = products.map(product => {
        const pid = product.id || String(product._id);
        const stockClass = product.category === 'other' ? 'unlimited' :
            product.stock > 10 ? 'high' : product.stock > 5 ? 'medium' : 'low';

        return `
            <tr>
                <td><strong>${product.name}</strong> ${product.recommend ? '<span class="badge badge-warning">★</span>' : ''}</td>
                <td><span class="category-badge ${product.category}">${categoryLabels[product.category] || product.category}</span></td>
                <td>${Utils.formatRupiah(product.price)}</td>
                <td><span class="stock-badge ${stockClass}">${product.category === 'other' ? '∞' : product.stock}</span></td>
                <td><span class="status-badge ${product.category === 'other' || product.stock > 0 ? 'active' : 'inactive'}">${product.category === 'other' || product.stock > 0 ? 'Aktif' : 'Habis'}</span></td>
                <td>-</td>
                <td>
                    <div class="action-btns">
                        ${product.category !== 'other' ? `<button class="action-btn restock" onclick="openRestockModal('${pid}')" title="Restock"><i class="fas fa-plus"></i></button>` : ''}
                        <button class="action-btn edit" onclick="editProduct('${pid}')" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="action-btn delete" onclick="deleteProduct('${pid}')" title="Hapus"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>`;
    }).join('');
}
    
function filterProducts() {
    const query = document.getElementById('product-search').value;
    renderProductsTable(query);
}

function filterProductsByCategory(category) {
    currentProductFilter = category;
    renderProductsTable();
}

async function openProductModal(productId = null) {
    const modal = document.getElementById('product-modal');
    const title = document.getElementById('product-modal-title');

    if (productId) {
        // Cari dari cache admin dulu
        let product = window._adminProductCache?.[productId] || ProductManager.getById(productId);
        if (!product) {
            try {
                const res = await fetch(`/api/products?id=${productId}`);
                if (res.ok) product = (await res.json()).product;
            } catch {}
        }
        if (!product) return;

        title.textContent = 'Edit Produk';
        document.getElementById('product-id').value = product.id;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-category').value = product.category;
        document.getElementById('product-price').value = product.price;
        document.getElementById('product-stock').value = product.stock || 0;
        document.getElementById('product-desc').value = product.desc || '';
        document.getElementById('product-features').value = product.features?.join('\n') || '';
        document.getElementById('product-recommend').checked = product.recommend || false;
    } else {
        title.textContent = 'Tambah Produk';
        document.getElementById('product-id').value = '';
        document.getElementById('product-name').value = '';
        document.getElementById('product-category').value = 'vps';
        document.getElementById('product-price').value = '';
        document.getElementById('product-stock').value = '10';
        document.getElementById('product-desc').value = '';
        document.getElementById('product-features').value = '';
        document.getElementById('product-recommend').checked = false;
    }

    toggleStockField();
    modal.classList.add('active');
}

function closeProductModal() {
    document.getElementById('product-modal').classList.remove('active');
}

function toggleStockField() {
    const category = document.getElementById('product-category').value;
    document.getElementById('stock-field').style.display = category === 'other' ? 'none' : 'block';
}

async function saveProduct() {
    const id = document.getElementById('product-id').value;
    const name = document.getElementById('product-name').value.trim();
    const category = document.getElementById('product-category').value;
    const price = parseInt(document.getElementById('product-price').value);
    const stock = category === 'other' ? 999 : parseInt(document.getElementById('product-stock').value);
    const desc = document.getElementById('product-desc').value.trim();
    const features = document.getElementById('product-features').value.split('\n').filter(f => f.trim());
    const recommend = document.getElementById('product-recommend').checked;

    if (!name || !price) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Nama dan harga harus diisi!', background: '#1a1a2e', color: '#fff' });
        return;
    }

    const productData = { name, category, price, stock, desc, features, recommend };

    if (id) {
        await ProductManager.updateProduct(id, productData);
        addActivityLog('Produk', `Update produk: ${name}`);
        Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Produk diperbarui!', background: '#1a1a2e', color: '#fff', timer: 1500, showConfirmButton: false });
    } else {
        await ProductManager.addProduct(productData);
        addActivityLog('Produk', `Tambah produk baru: ${name}`);
        Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Produk ditambahkan!', background: '#1a1a2e', color: '#fff', timer: 1500, showConfirmButton: false });
    }

    closeProductModal();
    renderProductsTable();
    updateStats();
}

function editProduct(productId) {
    openProductModal(productId);
}

function deleteProduct(productId) {
    Swal.fire({
        title: 'Hapus Produk?',
        text: 'Produk akan dihapus permanen!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal',
        background: '#1a1a2e',
        color: '#fff',
        confirmButtonColor: '#ef4444'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await ProductManager.deleteProduct(productId);
            renderProductsTable();
            updateStats();
            addActivityLog('Produk', `Hapus produk ${productId}`);
            Swal.fire({ icon: 'success', title: 'Terhapus', text: 'Produk berhasil dihapus!', background: '#1a1a2e', color: '#fff', timer: 1500, showConfirmButton: false });
        }
    });
}

function resetProducts() {
    Swal.fire({
        title: 'Reset Produk?',
        text: 'Semua produk akan direset ke default (dari MongoDB)!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Reset',
        cancelButtonText: 'Batal',
        background: '#1a1a2e',
        color: '#fff',
        confirmButtonColor: '#ef4444'
    }).then(async (result) => {
        if (result.isConfirmed) {
            // Hapus semua produk dari DB lalu init ulang
            const token = AdminAuth.getToken();
            try {
                // Init ulang dari default
                await fetch('/api/products?action=init', {
                    method: 'POST',
                    headers: { 'X-Admin-Token': token }
                });
            } catch {}
            localStorage.removeItem('products');
            ProductManager._cache = null;
            await ProductManager.loadFromDB();
            renderProductsTable();
            updateStats();
            addActivityLog('Produk', 'Reset semua produk ke default');
            Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Produk direset!', background: '#1a1a2e', color: '#fff', timer: 1500, showConfirmButton: false });
        }
    });
}

// ========================================
// RESTOCK
// ========================================
async function openRestockModal(productId) {
    // Cari dari cache admin dulu (paling cepat)
    let product = window._adminProductCache?.[productId] || ProductManager.getById(productId);
    if (!product) {
        try {
            const res = await fetch(`/api/products?id=${productId}`);
            if (res.ok) product = (await res.json()).product;
        } catch {}
    }
    if (!product) { Swal.fire({ icon: 'warning', title: 'Produk tidak ditemukan', background: '#1a1a2e', color: '#fff' }); return; }

    const modal = document.getElementById('restock-modal');
    const nameEl = document.getElementById('restock-product-name');
    const stockEl = document.getElementById('restock-current-stock');
    const idEl = document.getElementById('restock-product-id');
    const amountEl = document.getElementById('restock-amount');

    if (!modal) { Swal.fire({ icon: 'error', title: 'Modal tidak ditemukan', text: 'Elemen restock-modal tidak ada di halaman.', background: '#1a1a2e', color: '#fff' }); return; }

    if (idEl) idEl.value = productId;
    if (nameEl) nameEl.textContent = product.name;
    if (stockEl) stockEl.textContent = product.stock;
    if (amountEl) amountEl.value = '';
    modal.classList.add('active');
}

function closeRestockModal() {
    document.getElementById('restock-modal').classList.remove('active');
}

async function confirmRestock() {
    const productId = document.getElementById('restock-product-id').value;
    const amount = parseInt(document.getElementById('restock-amount').value);

    if (!amount || amount <= 0) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Jumlah tidak valid!', background: '#1a1a2e', color: '#fff' });
        return;
    }

    await ProductManager.restock(productId, amount);
    addActivityLog('Stok', `Restock ${productId} +${amount}`);
    Swal.fire({ icon: 'success', title: 'Berhasil', text: `Stok ditambahkan!`, background: '#1a1a2e', color: '#fff', timer: 1500, showConfirmButton: false });

    closeRestockModal();
    renderProductsTable();
    updateStats();
}

// ========================================
// ORDERS
// ========================================
async function renderOrdersTable(filter = 'all') {
    const tbody = document.getElementById('orders-table-body');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:30px;"><i class="fas fa-spinner fa-spin"></i> Memuat...</td></tr>`;

    const token = AdminAuth.getToken();
    try {
        const url = filter === 'all' ? '/api/orders' : `/api/orders?status=${filter}`;
        const res = await fetch(url, { headers: { 'X-Admin-Token': token } });
        if (!res.ok) throw new Error('API error ' + res.status);
        const { orders } = await res.json();

        if (!orders || orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted)"><i class="fas fa-inbox" style="font-size:2rem;margin-bottom:10px;display:block;"></i>Belum ada pesanan</td></tr>`;
            return;
        }

        tbody.innerHTML = orders.map((order) => {
            const itemNames = order.items?.slice(0,2).map(i => i.name).join(', ') || (order.name || order.service || '-');
            const oid = order.orderId || order._id;
            return `
            <tr>
                <td><code class="order-id" style="cursor:pointer;" onclick="copyOrderId('${oid}')">${oid}</code></td>
                <td>${order.userName || '-'}</td>
                <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${itemNames}</td>
                <td>${order.items?.length || 1}</td>
                <td>${Utils.formatRupiah(order.total || 0)}</td>
                <td>
                    <select class="status-select" onchange="updateOrderStatus('${order._id}', this.value)">
                        <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Selesai</option>
                        <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Dibatalkan</option>
                    </select>
                </td>
                <td>${new Date(order.createdAt || order.date).toLocaleDateString('id-ID')}</td>
                <td><button class="action-btn delete" onclick="deleteOrder('${order._id}')" title="Hapus"><i class="fas fa-trash"></i></button></td>
            </tr>`;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted)">Gagal memuat: ${err.message}</td></tr>`;
    }
}

function filterOrders() {
    const filter = document.getElementById('order-filter')?.value || 'all';
    renderOrdersTable(filter);
}

async function updateOrderStatus(orderId, newStatus) {
    const token = AdminAuth.getToken();
    try {
        await fetch(`/api/orders?id=${orderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
            body: JSON.stringify({ status: newStatus })
        });
        addActivityLog('Pesanan', `Update status order ${orderId} → ${newStatus}`);
        updateStats();
    } catch (e) { console.error('updateOrderStatus error:', e); }
}

async function deleteOrder(orderId) {
    const confirmed = await Swal.fire({ title: 'Hapus Pesanan?', text: 'Pesanan akan dihapus!', icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Hapus', cancelButtonText: 'Batal', background: '#1a1a2e', color: '#fff', confirmButtonColor: '#ef4444' });
    if (!confirmed.isConfirmed) return;
    const token = AdminAuth.getToken();
    try {
        await fetch(`/api/orders?id=${orderId}`, { method: 'DELETE', headers: { 'X-Admin-Token': token } });
        addActivityLog('Pesanan', `Hapus order ${orderId}`);
        renderOrdersTable();
        updateStats();
        Swal.fire({ icon: 'success', title: 'Terhapus', text: 'Pesanan berhasil dihapus!', background: '#1a1a2e', color: '#fff', timer: 1500, showConfirmButton: false });
    } catch (e) { Swal.fire({ icon: 'error', title: 'Gagal', text: e.message, background: '#1a1a2e', color: '#fff' }); }
}

async function clearAllOrders() {
    const confirmed = await Swal.fire({ title: 'Hapus Semua Pesanan?', text: 'Semua riwayat pesanan akan dihapus!', icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Hapus Semua', cancelButtonText: 'Batal', background: '#1a1a2e', color: '#fff', confirmButtonColor: '#ef4444' });
    if (!confirmed.isConfirmed) return;
    const token = AdminAuth.getToken();
    try {
        // Hapus semua order satu per satu (tidak ada bulk delete endpoint)
        const res = await fetch('/api/orders', { headers: { 'X-Admin-Token': token } });
        const { orders } = await res.json();
        await Promise.all((orders || []).map(o => fetch(`/api/orders?id=${o._id}`, { method: 'DELETE', headers: { 'X-Admin-Token': token } })));
        addActivityLog('Pesanan', 'Hapus semua pesanan');
        renderOrdersTable();
        updateStats();
        Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Semua pesanan dihapus!', background: '#1a1a2e', color: '#fff', timer: 1500, showConfirmButton: false });
    } catch (e) { Swal.fire({ icon: 'error', title: 'Gagal', text: e.message, background: '#1a1a2e', color: '#fff' }); }
}

// ========================================
// TESTIMONIALS (XSS-safe)
// ========================================
async function renderTestimonials(filterQuery = '') {
    const grid = document.getElementById('testimonials-grid');
    if (!grid) return;

    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;"><i class="fas fa-spinner fa-spin"></i> Memuat...</div>`;

    const token = AdminAuth.getToken();
    let testimonials = [];
    try {
        const res = await fetch('/api/content?type=testimonials&limit=100', { headers: { 'X-Admin-Token': token } });
        if (res.ok) {
            const data = await res.json();
            testimonials = data.testimonials || [];
        }
    } catch {}

    // Fallback ke cache lokal
    if (testimonials.length === 0) {
        testimonials = TestimonialManager.getAll();
    }

    // Filter berdasarkan query
    if (filterQuery) {
        testimonials = testimonials.filter(t =>
            (t.name||'').toLowerCase().includes(filterQuery) ||
            (t.message||'').toLowerCase().includes(filterQuery)
        );
    }

    if (testimonials.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)"><i class="fas fa-comments" style="font-size:2rem;margin-bottom:10px;display:block;"></i>Belum ada testimoni</div>';
        return;
    }

    grid.innerHTML = testimonials.map((t) => {
        const stars = Array(5).fill(0).map((_, i) =>
            `<i class="${i < t.rating ? 'fas' : 'far'} fa-star" style="color: ${i < t.rating ? 'var(--warning)' : '#4b5563'};"></i>`
        ).join('');
        const safeName = (t.name || 'Anonim').replace(/[<>]/g, '');
        const safeMsg = (t.message || '').replace(/[<>]/g, '');
        const initials = safeName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const statusColor = t.status === 'approved' ? 'var(--accent)' : t.status === 'rejected' ? 'var(--danger)' : 'var(--warning)';
        const statusLabel = t.status === 'approved' ? 'Disetujui' : t.status === 'rejected' ? 'Ditolak' : 'Pending';
        const id = t._id || t.id;

        return `
            <div class="testimonial-admin-card">
                <div class="testimonial-admin-header">
                    <div class="testimonial-avatar">${initials}</div>
                    <div>
                        <h4>${safeName}</h4>
                        <div class="testimonial-rating">${stars}</div>
                    </div>
                    <span style="margin-left:auto;font-size:0.75rem;color:${statusColor};background:${statusColor}20;padding:3px 8px;border-radius:20px;">${statusLabel}</span>
                </div>
                <p class="testimonial-text">${safeMsg}</p>
                <div class="testimonial-footer">
                    <span>${t.date || Utils.formatDate(t.createdAt)}</span>
                    <div style="display:flex;gap:6px;">
                        ${t.status !== 'approved' ? `<button class="action-btn active" onclick="approveTestimonial('${id}')" title="Setujui"><i class="fas fa-check"></i></button>` : ''}
                        <button class="action-btn delete" onclick="deleteTestimonialDB('${id}')" title="Hapus"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>`;
    }).join('');
}

async function approveTestimonial(id) {
    const token = AdminAuth.getToken();
    try {
        await fetch(`/api/testimonials?id=${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
            body: JSON.stringify({ status: 'approved' })
        });
        addActivityLog('Testimoni', `Setujui testimoni ${id}`);
        renderTestimonials();
    } catch (e) { Swal.fire({ icon: 'error', title: 'Gagal', text: e.message, background: '#1a1a2e', color: '#fff' }); }
}

async function deleteTestimonialDB(id) {
    const confirmed = await Swal.fire({ title: 'Hapus Testimoni?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya', cancelButtonText: 'Batal', background: '#1a1a2e', color: '#fff', confirmButtonColor: '#ef4444' });
    if (!confirmed.isConfirmed) return;
    const token = AdminAuth.getToken();
    try {
        await fetch(`/api/testimonials?id=${id}`, { method: 'DELETE', headers: { 'X-Admin-Token': token } });
        addActivityLog('Testimoni', `Hapus testimoni ${id}`);
        renderTestimonials();
    } catch (e) { Swal.fire({ icon: 'error', title: 'Gagal', text: e.message, background: '#1a1a2e', color: '#fff' }); }
}

// Backward compat
function deleteTestimonial(index) { renderTestimonials(); }

function filterTestimonials() {
    const query = document.getElementById('testi-search')?.value?.toLowerCase() || '';
    renderTestimonials(query);
}

async function renderCustomers() {
    const tbody = document.getElementById('customers-table-body');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;"><i class="fas fa-spinner fa-spin"></i> Memuat...</td></tr>`;

    const token = AdminAuth.getToken();
    try {
        const [orderRes, testimonialRes] = await Promise.all([
            fetch('/api/orders', { headers: { 'X-Admin-Token': token } }).then(r => r.json()).catch(() => ({ orders: [] })),
            fetch('/api/content?type=testimonials&limit=200', { headers: { 'X-Admin-Token': token } }).then(r => r.json()).catch(() => ({ testimonials: [] }))
        ]);

        const orders = orderRes.orders || [];
        const testimonials = testimonialRes.testimonials || [];

        // Aggregate customer data dari orders
        const customers = {};
        orders.forEach(order => {
            const key = order.userEmail || order.userName || 'Tamu';
            if (!customers[key]) {
                customers[key] = { name: order.userName || 'Tamu', email: order.userEmail || '-', orders: 0, spent: 0, lastOrder: order.createdAt };
            }
            customers[key].orders++;
            customers[key].spent += order.total || 0;
            if (new Date(order.createdAt) > new Date(customers[key].lastOrder)) {
                customers[key].lastOrder = order.createdAt;
            }
        });

        const customerList = Object.values(customers);

        const totalEl = document.getElementById('total-customers');
        const activeEl = document.getElementById('active-customers');
        const avgEl = document.getElementById('avg-rating');
        if (totalEl) totalEl.textContent = customerList.length;
        if (activeEl) activeEl.textContent = customerList.filter(c => c.orders > 1).length;
        if (avgEl) avgEl.textContent = testimonials.length
            ? (testimonials.reduce((s, t) => s + (t.rating || 0), 0) / testimonials.length).toFixed(1)
            : '0';

        if (customerList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fas fa-users" style="font-size:2rem;display:block;margin-bottom:10px;opacity:0.3;"></i>Belum ada pelanggan</td></tr>`;
            return;
        }

        tbody.innerHTML = customerList.map(c => `
            <tr>
                <td><strong>${c.name}</strong><br><small style="color:var(--text-muted);">${c.email}</small></td>
                <td>${c.orders}</td>
                <td>${Utils.formatRupiah(c.spent)}</td>
                <td>-</td>
                <td>${c.lastOrder ? new Date(c.lastOrder).toLocaleDateString('id-ID') : '-'}</td>
            </tr>`).join('');

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted);">Gagal memuat data: ${err.message}</td></tr>`;
    }
}

// ========================================
// SETTINGS
// ========================================
async function loadSettings() {
    const token = AdminAuth.getToken();

    // Load dari MongoDB dulu
    let dbSettings = {};
    try {
        const res = await fetch('/api/settings', { headers: { 'X-Admin-Token': token } });
        if (res.ok) {
            const data = await res.json();
            dbSettings = data.settings || {};
            // Sync ke localStorage sebagai cache
            Object.entries(dbSettings).forEach(([k, v]) => {
                if (v && v !== '••••••••') localStorage.setItem(k, v);
            });
        }
    } catch {}

    // QRIS Settings
    const qrisApikey   = document.getElementById('qris-apikey');
    const qrisCode     = document.getElementById('qris-code');
    const qrisMerchant = document.getElementById('qris-merchant');
    const qrisKeyorkut = document.getElementById('qris-keyorkut');
    const qrisInterval = document.getElementById('qris-check-interval');

    if (qrisApikey)   { qrisApikey.value = ''; qrisApikey.placeholder = (dbSettings.qris_apikey === '••••••••' || localStorage.getItem('qris_apikey_set')) ? '••••••••••••••••' : 'Belum diatur'; }
    if (qrisCode)     qrisCode.value     = dbSettings.qris_code     || localStorage.getItem('qris_code')     || '';
    if (qrisMerchant) qrisMerchant.value = dbSettings.qris_merchant || localStorage.getItem('qris_merchant') || '';
    if (qrisKeyorkut) { qrisKeyorkut.value = ''; qrisKeyorkut.placeholder = (dbSettings.qris_keyorkut === '••••••••' || localStorage.getItem('qris_keyorkut_set')) ? '••••••••••••••••' : 'Belum diatur'; }
    if (qrisInterval) qrisInterval.value = dbSettings.qris_check_interval || localStorage.getItem('qris_check_interval') || '15000';

    // Groq Settings
    const groqApikey = document.getElementById('groq-apikey');
    if (groqApikey) {
        groqApikey.value = '';
        const groqSet = dbSettings.groq_apikey === '••••••••' || localStorage.getItem('groq_apikey_set') === '1';
        groqApikey.placeholder = groqSet ? '••••••••••••••••' : 'Belum diatur (opsional)';
    }
    const groqStatus = document.getElementById('groq-status');
    if (groqStatus) {
        const isSet = dbSettings.groq_apikey === '••••••••' || localStorage.getItem('groq_apikey_set') === '1';
        groqStatus.innerHTML = isSet
            ? `<span style="color:var(--accent);font-size:0.85rem;"><i class="fas fa-check-circle"></i> Groq API Key sudah diatur — AI aktif</span>`
            : `<span style="color:var(--text-muted);font-size:0.85rem;"><i class="fas fa-info-circle"></i> Belum diatur — chatbot pakai mode fallback (keyword)</span>`;
    }

    // Pterodactyl Settings
    const pteroUrl = document.getElementById('ptero-url');
    if (pteroUrl) pteroUrl.value = dbSettings.ptero_url || localStorage.getItem('ptero_url') || '';
    const ptroPtla = document.getElementById('ptero-ptla');
    if (ptroPtla) { ptroPtla.value = ''; ptroPtla.placeholder = (dbSettings.ptero_ptla === '••••••••' || localStorage.getItem('ptero_ptla_set') === '1') ? '••••••••••••••••' : 'Belum diatur'; }
    const ptroPtlc = document.getElementById('ptero-ptlc');
    if (ptroPtlc) { ptroPtlc.value = ''; ptroPtlc.placeholder = (dbSettings.ptero_ptlc === '••••••••' || localStorage.getItem('ptero_ptlc_set') === '1') ? '••••••••••••••••' : 'Belum diatur'; }

    // Security Settings
    const sessionTimeout = document.getElementById('session-timeout');
    const maxAttempts = document.getElementById('max-attempts');
    const ipRestriction = document.getElementById('ip-restriction');
    if (sessionTimeout) sessionTimeout.value = dbSettings.session_timeout || localStorage.getItem('session_timeout') || '3600';
    if (maxAttempts) maxAttempts.value = dbSettings.max_attempts || localStorage.getItem('max_attempts') || '5';
    if (ipRestriction) ipRestriction.checked = (dbSettings.ip_restriction || localStorage.getItem('ip_restriction')) !== 'false';
}

async function saveQRISSettings() {
    const apikey   = document.getElementById('qris-apikey').value.trim();
    const code     = document.getElementById('qris-code').value.trim();
    const merchant = document.getElementById('qris-merchant').value.trim();
    const keyorkut = document.getElementById('qris-keyorkut').value.trim();
    const interval = parseInt(document.getElementById('qris-check-interval').value) || 15000;

    // Simpan ke MongoDB (sumber kebenaran utama)
    await syncSettingsToDB({
        ...(apikey   ? { qris_apikey:   apikey }   : {}),
        ...(code     ? { qris_code:     code }     : {}),
        ...(merchant ? { qris_merchant: merchant } : {}),
        ...(keyorkut ? { qris_keyorkut: keyorkut } : {}),
        qris_check_interval: Math.max(5000, interval).toString()
    });

    // Simpan juga ke localStorage sebagai cache lokal
    if (code)     localStorage.setItem('qris_code',     code);
    if (merchant) localStorage.setItem('qris_merchant', merchant);
    localStorage.setItem('qris_check_interval', Math.max(5000, interval).toString());
    // API key sensitif — TIDAK disimpan ke localStorage
    if (apikey)   localStorage.setItem('qris_apikey_set', '1');
    if (keyorkut) localStorage.setItem('qris_keyorkut_set', '1');

    addActivityLog('Pengaturan', 'Simpan konfigurasi QRIS ke database');
    Swal.fire({ icon: 'success', title: 'Tersimpan ke Database!', text: 'Credentials QRIS tersimpan terenkripsi di MongoDB. Aman dari browser pengunjung.', background: '#1a1a2e', color: '#fff', timer: 2500, showConfirmButton: false });
}

async function testQRISConnection() {
    const resultEl = document.getElementById('qris-test-result');
    if (resultEl) resultEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing koneksi QRIS...';
    try {
        const res = await fetch('/api/qris', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create', amount: 1000, orderId: 'TEST-' + Date.now() })
        });
        const data = await res.json();
        if (data.success && data.qrImageUrl) {
            if (resultEl) resultEl.innerHTML = `<span style="color:var(--accent);"><i class="fas fa-check-circle"></i> Koneksi berhasil! QRIS siap digunakan.</span>`;
            Swal.fire({ icon: 'success', title: 'QRIS Terhubung!', text: 'Pembayaran QRIS siap digunakan.', background: '#1a1a2e', color: '#fff' });
        } else {
            if (resultEl) resultEl.innerHTML = `<span style="color:var(--danger);"><i class="fas fa-times-circle"></i> ${data.error || 'Gagal'}</span>`;
            Swal.fire({ icon: 'error', title: 'Gagal', text: data.error || 'Periksa API Key dan QRIS Code.', background: '#1a1a2e', color: '#fff' });
        }
    } catch (err) {
        if (resultEl) resultEl.innerHTML = `<span style="color:var(--danger);"><i class="fas fa-times-circle"></i> Error: ${err.message}</span>`;
    }
}

// Backward compat
function savePakasirSettings() { saveQRISSettings(); }

// ── Sync settings ke MongoDB ──────────────────────────────────
async function syncSettingsToDB(updates) {
    const token = AdminAuth.getToken();
    if (!token) return; // hanya skip jika tidak ada token
    try {
        await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
            body: JSON.stringify({ updates })
        });
    } catch { /* non-critical */ }
}

// ── Load settings dari DB (saat pertama masuk dashboard) ──────
async function loadSettingsFromDB() {
    const token = AdminAuth.getToken();
    if (!token) return;
    try {
        const res = await fetch('/api/settings', { headers: { 'X-Admin-Token': token } });
        if (!res.ok) return;
        const { settings } = await res.json();

        // Sync semua settings dari DB ke localStorage
        // Keys non-sensitif: langsung sync
        const nonSensitive = ['qris_code', 'qris_merchant', 'qris_check_interval', 'openai_model', 'ptero_url', 'session_timeout', 'max_attempts', 'ip_restriction'];
        nonSensitive.forEach(k => {
            if (settings[k] && settings[k] !== '••••••••') {
                localStorage.setItem(k, settings[k]);
            }
        });

        // Keys sensitif: tandai sebagai "sudah diatur" tapi tidak simpan nilai ke localStorage
        const sensitive = ['qris_apikey', 'qris_keyorkut', 'groq_apikey', 'ptero_ptla', 'ptero_ptlc'];
        sensitive.forEach(k => {
            if (settings[k] === '••••••••') {
                // Sudah diatur di DB — tandai tapi tidak expose nilai
                localStorage.setItem(k + '_set', '1');
            }
        });

        // Reload form settings dengan data terbaru
        loadSettings();

    } catch { /* non-critical */ }
}

function saveGroqSettings() {
    const apikey = document.getElementById('groq-apikey')?.value.trim();
    if (apikey && apikey !== '••••••••••••••••') {
        localStorage.setItem('groq_apikey_set', '1');
        // Sync ke DB (key sensitif, dienkripsi di server)
        syncSettingsToDB({ groq_apikey: apikey });
    }
    const groqStatus = document.getElementById('groq-status');
    if (groqStatus) {
        groqStatus.innerHTML = `<span style="color:var(--accent);font-size:0.85rem;"><i class="fas fa-check-circle"></i> Groq API Key disimpan — AI aktif</span>`;
    }
    addActivityLog('Pengaturan', 'Simpan Groq API Key');
    Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Groq API Key disimpan. Chatbot sekarang menggunakan AI Llama 3.', background: '#1a1a2e', color: '#fff', timer: 2000, showConfirmButton: false });
}

// Backward compat
function saveOpenAISettings() { saveGroqSettings(); }

async function testGroqConnection() {
    const btn = document.querySelector('[onclick="testGroqConnection()"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...'; }

    try {
        const res = await fetch('/api/openai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'halo, test koneksi' })
        });
        const data = await res.json();
        const source = data.source === 'groq' ? '✅ Groq AI aktif' : '⚠️ Mode fallback (keyword)';
        const groqStatus = document.getElementById('groq-status');
        if (groqStatus) groqStatus.innerHTML = `<span style="color:var(--accent);font-size:0.85rem;"><i class="fas fa-check-circle"></i> ${source} — Respons: "${data.reply?.substring(0, 60)}..."</span>`;
        Swal.fire({ icon: 'success', title: source, text: data.reply?.substring(0, 100), background: '#1a1a2e', color: '#fff' });
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Gagal', text: err.message, background: '#1a1a2e', color: '#fff' });
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-plug"></i> Test Koneksi'; }
    }
}

async function savePteroSettings() {
    const url = document.getElementById('ptero-url').value.trim();
    const ptla = document.getElementById('ptero-ptla').value.trim();
    const ptlc = document.getElementById('ptero-ptlc').value.trim();

    const updates = {};
    if (url)  { updates.ptero_url = url;  localStorage.setItem('ptero_url', url); }
    if (ptla) { updates.ptero_ptla = ptla; localStorage.setItem('ptero_ptla_set', '1'); }
    if (ptlc) { updates.ptero_ptlc = ptlc; localStorage.setItem('ptero_ptlc_set', '1'); }

    if (Object.keys(updates).length > 0) {
        await syncSettingsToDB(updates);
    }

    addActivityLog('Pengaturan', 'Simpan pengaturan Pterodactyl ke database');
    Swal.fire({ icon: 'success', title: 'Tersimpan!', text: 'Pengaturan Pterodactyl disimpan ke database.', background: '#1a1a2e', color: '#fff', timer: 1500, showConfirmButton: false });
}

async function testPteroConnection() {
    const url = document.getElementById('ptero-url').value.trim();
    const ptla = document.getElementById('ptero-ptla').value.trim();
    
    if (!url || !ptla) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'URL dan PTLA harus diisi!', background: '#1a1a2e', color: '#fff' });
        return;
    }
    
    Swal.fire({
        title: 'Testing...',
        text: 'Menghubungkan ke Pterodactyl...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });
    
    try {
        const response = await fetch(`${url}/api/application/users`, {
            headers: { 'Authorization': `Bearer ${ptla}`, 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Koneksi ke Pterodactyl berhasil!', background: '#1a1a2e', color: '#fff' });
        } else {
            throw new Error('Connection failed');
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Gagal', text: 'Tidak dapat terhubung ke Pterodactyl. Periksa URL dan API key.', background: '#1a1a2e', color: '#fff' });
    }
}

async function saveSecuritySettings() {
    const timeout = document.getElementById('session-timeout').value;
    const maxAttempts = document.getElementById('max-attempts').value;
    const ipRestriction = document.getElementById('ip-restriction').checked.toString();

    // Simpan ke localStorage
    localStorage.setItem('session_timeout', timeout);
    localStorage.setItem('max_attempts', maxAttempts);
    localStorage.setItem('ip_restriction', ipRestriction);

    // Sync ke MongoDB
    await syncSettingsToDB({ session_timeout: timeout, max_attempts: maxAttempts, ip_restriction: ipRestriction });

    addActivityLog('Pengaturan', 'Simpan pengaturan keamanan ke database');
    Swal.fire({ icon: 'success', title: 'Tersimpan!', text: 'Pengaturan keamanan disimpan ke database.', background: '#1a1a2e', color: '#fff', timer: 1500, showConfirmButton: false });
}

function toggleInputPassword(id) {
    const input = document.getElementById(id);
    input.type = input.type === 'password' ? 'text' : 'password';
}

function resetAllData() {
    Swal.fire({
        title: 'Reset Semua Data?',
        text: 'Semua data akan direset ke default!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Reset Semua',
        cancelButtonText: 'Batal',
        background: '#1a1a2e',
        color: '#fff',
        confirmButtonColor: '#ef4444'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.removeItem('products');
            localStorage.removeItem('salesHistory');
            localStorage.removeItem('testimonials');
            localStorage.removeItem('cart');
            ProductManager.init();
            TestimonialManager.init();
            initDashboard();
            Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Semua data direset!', background: '#1a1a2e', color: '#fff', timer: 1500, showConfirmButton: false });
        }
    });
}

function clearCache() {
    const essential = ['products', 'salesHistory', 'testimonials', 'pakasir_slug', 'pakasir_apikey'];
    const keys = Object.keys(localStorage).filter(k => !essential.includes(k));
    keys.forEach(k => localStorage.removeItem(k));
    Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Cache dibersihkan!', background: '#1a1a2e', color: '#fff', timer: 1500, showConfirmButton: false });
}

function exportProducts() {
    const products = ProductManager.getAll();
    const dataStr = JSON.stringify(products, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products-backup.json';
    a.click();
}

function exportOrders() {
    const orders = JSON.parse(localStorage.getItem('salesHistory')) || [];
    const dataStr = JSON.stringify(orders, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orders-backup.json';
    a.click();
}

function exportCustomers() {
    Swal.fire({ icon: 'info', title: 'Info', text: 'Fitur export customers akan segera hadir!', background: '#1a1a2e', color: '#fff' });
}

// ========================================
// INITIALIZATION
// ========================================

// Add shake animation
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);

// Expose functions globally
window.showSection = showSection;
window.login = login;
window.logout = logout;
window.togglePassword = togglePassword;
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.saveProduct = saveProduct;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.resetProducts = resetProducts;
window.filterProducts = filterProducts;
window.openRestockModal = openRestockModal;
window.closeRestockModal = closeRestockModal;
window.confirmRestock = confirmRestock;
window.filterOrders = filterOrders;
window.deleteOrder = deleteOrder;
window.clearAllOrders = clearAllOrders;
window.filterTestimonials = filterTestimonials;
window.deleteTestimonial = deleteTestimonial;
window.deleteTestimonialDB = deleteTestimonialDB;
window.approveTestimonial = approveTestimonial;
window.saveQRISSettings = saveQRISSettings;
window.savePakasirSettings = savePakasirSettings; // backward compat
window.saveOpenAISettings = saveOpenAISettings; // backward compat
window.saveGroqSettings = saveGroqSettings;
window.testGroqConnection = testGroqConnection;
window.testQRISConnection = testQRISConnection;
window.savePteroSettings = savePteroSettings;
window.testPteroConnection = testPteroConnection;
window.saveSecuritySettings = saveSecuritySettings;
window.toggleInputPassword = toggleInputPassword;
window.resetAllData = resetAllData;
window.clearCache = clearCache;
window.exportProducts = exportProducts;
window.exportOrders = exportOrders;
window.exportCustomers = exportCustomers;
window.updateSalesChart = updateSalesChart;
window.updateOrderStatus = updateOrderStatus;
window.refreshDashboard = refreshDashboard;
window.copyOrderId = copyOrderId;

// ========================================
// FITUR 1: EXPORT CSV PESANAN
// ========================================
function exportOrdersCSV() {
    const orders = JSON.parse(localStorage.getItem('salesHistory')) || [];
    if (orders.length === 0) {
        Swal.fire({ icon: 'info', title: 'Kosong', text: 'Tidak ada pesanan untuk diekspor.', background: '#1a1a2e', color: '#fff' });
        return;
    }

    const headers = ['Order ID', 'Produk', 'Kategori', 'Jumlah', 'Harga Satuan', 'Total', 'Status', 'Tanggal'];
    const rows = orders.map(o => [
        o.orderId || '-',
        (o.name || o.service || '-').replace(/,/g, ';'),
        o.category || '-',
        o.quantity,
        o.price,
        o.price * o.quantity,
        o.status || 'pending',
        new Date(o.date).toLocaleDateString('id-ID')
    ]);

    const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pesanan-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    addActivityLog('Export', `Export ${orders.length} pesanan ke CSV`);
}

// Password strength indicator — dipindah ke DOMContentLoaded utama di bawah

// Override login to check custom password hash — patch saat login diklik
const _origLogin = window.login || login;
function _patchLoginBtn() {
    const loginBtn = document.querySelector('.login-form .btn-primary');
    if (loginBtn) {
        loginBtn.onclick = async () => {
            const customHash = localStorage.getItem('custom_password_hash');
            if (customHash) SECURITY.PASSWORD_HASH = customHash;
            await login();
        };
    }
}

// ========================================
// FITUR 3: NOTIFIKASI STOK MENIPIS
// ========================================
async function showLowStockAlert() {
    // Load produk terbaru dari MongoDB
    const token = AdminAuth.getToken();
    let products = ProductManager.getAll();
    try {
        const res = await fetch('/api/products', { headers: { 'X-Admin-Token': token } });
        if (res.ok) { const data = await res.json(); if (data.products?.length) products = data.products; }
    } catch {}

    const lowStock = products.filter(p => p.category !== 'other' && p.stock <= 5 && p.stock > 0);
    const outOfStock = products.filter(p => p.category !== 'other' && p.stock === 0);

    const listEl = document.getElementById('low-stock-list');
    if (!listEl) return;

    let html = '';
    if (outOfStock.length > 0) {
        html += `<div style="margin-bottom:15px;"><h4 style="color:var(--danger);margin-bottom:10px;font-size:0.9rem;text-transform:uppercase;letter-spacing:1px;">🔴 Stok Habis (${outOfStock.length})</h4>`;
        html += outOfStock.map(p => `
            <div class="low-stock-item" style="display:flex;justify-content:space-between;align-items:center;padding:10px 15px;background:rgba(239,68,68,0.1);border-radius:10px;margin-bottom:8px;">
                <span style="font-weight:600;">${p.name}</span>
                <div style="display:flex;align-items:center;gap:10px;">
                    <span style="color:var(--danger);font-weight:700;">HABIS</span>
                    <button class="action-btn restock" onclick="document.getElementById('low-stock-modal').classList.remove('active');openRestockModal('${p.id || p._id}')" title="Restock"><i class="fas fa-plus"></i></button>
                </div>
            </div>`).join('');
        html += '</div>';
    }

    if (lowStock.length > 0) {
        html += `<div><h4 style="color:var(--warning);margin-bottom:10px;font-size:0.9rem;text-transform:uppercase;letter-spacing:1px;">🟡 Stok Menipis (${lowStock.length})</h4>`;
        html += lowStock.map(p => `
            <div class="low-stock-item" style="display:flex;justify-content:space-between;align-items:center;padding:10px 15px;background:rgba(245,158,11,0.1);border-radius:10px;margin-bottom:8px;">
                <span style="font-weight:600;">${p.name}</span>
                <div style="display:flex;align-items:center;gap:10px;">
                    <span style="color:var(--warning);font-weight:700;">Sisa: ${p.stock}</span>
                    <button class="action-btn restock" onclick="document.getElementById('low-stock-modal').classList.remove('active');openRestockModal('${p.id || p._id}')" title="Restock"><i class="fas fa-plus"></i></button>
                </div>
            </div>`).join('');
        html += '</div>';
    }

    if (!html) html = '<p style="color:var(--text-muted);text-align:center;padding:20px;">Semua stok aman! ✅</p>';
    listEl.innerHTML = html;
    document.getElementById('low-stock-modal').classList.add('active');
}

async function updateLowStockHeaderBadge() {
    const token = AdminAuth.getToken();
    let products = ProductManager.getAll();
    try {
        const res = await fetch('/api/products', { headers: { 'X-Admin-Token': token } });
        if (res.ok) { const data = await res.json(); if (data.products?.length) products = data.products; }
    } catch {}

    const count = products.filter(p => p.category !== 'other' && p.stock <= 5).length;
    const btn = document.getElementById('low-stock-alert-btn');
    const countEl = document.getElementById('low-stock-header-count');
    if (btn) btn.style.display = count > 0 ? 'inline-flex' : 'none';
    if (countEl) countEl.textContent = count;
}

// ========================================
// FITUR 4: CART PREVIEW DI ADMIN
// ========================================
function showCartPreview() {
    const cart = CartManager.getItems();
    const body = document.getElementById('cart-preview-body');
    if (!body) return;

    if (cart.length === 0) {
        body.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:30px;"><i class="fas fa-shopping-cart" style="font-size:2rem;display:block;margin-bottom:10px;"></i>Keranjang kosong</p>';
    } else {
        const icons = { vps: 'fa-server', panel: 'fa-gamepad', other: 'fa-tools' };
        const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        body.innerHTML = cart.map(item => `
            <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border-color);">
                <div style="width:40px;height:40px;background:var(--gradient-purple);border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;flex-shrink:0;">
                    <i class="fas ${icons[item.category] || 'fa-box'}"></i>
                </div>
                <div style="flex:1;">
                    <div style="font-weight:600;font-size:0.9rem;">${(item.name || '').replace(/[<>]/g, '')}</div>
                    <div style="color:var(--text-muted);font-size:0.8rem;">x${item.quantity} × ${Utils.formatRupiah(item.price)}</div>
                </div>
                <div style="font-weight:700;color:var(--accent);font-size:0.9rem;">${Utils.formatRupiah(item.price * item.quantity)}</div>
            </div>`).join('') +
            `<div style="display:flex;justify-content:space-between;padding:15px 0 0;font-weight:700;font-size:1.1rem;">
                <span>Total</span><span style="color:var(--accent)">${Utils.formatRupiah(total)}</span>
            </div>`;
    }
    document.getElementById('cart-preview-modal').classList.add('active');
}

function clearCartFromAdmin() {
    Swal.fire({
        title: 'Kosongkan Keranjang?',
        text: 'Semua item di keranjang akan dihapus.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Kosongkan',
        cancelButtonText: 'Batal',
        background: '#1a1a2e',
        color: '#fff',
        confirmButtonColor: '#ef4444'
    }).then(result => {
        if (result.isConfirmed) {
            CartManager.clear();
            document.getElementById('cart-preview-modal').classList.remove('active');
            addActivityLog('Keranjang', 'Keranjang dikosongkan oleh admin');
            Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Keranjang dikosongkan!', background: '#1a1a2e', color: '#fff', timer: 1500, showConfirmButton: false });
        }
    });
}

// ========================================
// FITUR 5: LOG AKTIVITAS ADMIN
// ========================================
function addActivityLog(category, message) {
    const log = { id: Date.now(), category, message, time: new Date().toISOString() };

    // Simpan ke localStorage (untuk akses cepat)
    const logs = JSON.parse(localStorage.getItem('activity_log') || '[]');
    logs.unshift(log);
    if (logs.length > 100) logs.splice(100);
    localStorage.setItem('activity_log', JSON.stringify(logs));

    // Sync ke MongoDB di background (non-blocking)
    const token = AdminAuth.getToken();
    fetch('/api/content?type=activity-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify(log)
    }).catch(() => {}); // silent fail
}

async function renderActivityLog(filter = '') {
    const listEl = document.getElementById('activity-log-list');
    if (!listEl) return;

    // Coba load dari MongoDB dulu
    const token = AdminAuth.getToken();
    let logs = [];
    try {
        const res = await fetch('/api/content?type=activity-log', { headers: { 'X-Admin-Token': token } });
        if (res.ok) {
            const data = await res.json();
            logs = data.logs || [];
        }
    } catch {}

    // Fallback ke localStorage
    if (logs.length === 0) {
        logs = JSON.parse(localStorage.getItem('activity_log') || '[]');
    }

    if (filter) {
        const q = filter.toLowerCase();
        logs = logs.filter(l => l.message.toLowerCase().includes(q) || l.category.toLowerCase().includes(q));
    }

    if (logs.length === 0) {
        listEl.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted);"><i class="fas fa-history" style="font-size:2.5rem;display:block;margin-bottom:15px;"></i>Belum ada aktivitas tercatat</div>';
        return;
    }

    const categoryColors = {
        'Login': '#6366f1', 'Logout': '#a1a1aa', 'Produk': '#10b981',
        'Pesanan': '#f59e0b', 'Testimoni': '#ec4899', 'Pengaturan': '#3b82f6',
        'Keamanan': '#ef4444', 'Export': '#8b5cf6', 'Keranjang': '#f59e0b',
        'Stok': '#10b981', 'Broadcast': '#ec4899', 'Newsletter': '#10b981',
        'Flash Sale': '#f59e0b', 'Ulasan': '#6366f1'
    };

    listEl.innerHTML = `<div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius);overflow:hidden;">` +
        logs.map(log => {
            const color = categoryColors[log.category] || '#a1a1aa';
            const time = new Date(log.time);
            const timeStr = time.toLocaleDateString('id-ID') + ' ' + time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            return `
            <div style="display:flex;align-items:center;gap:15px;padding:14px 20px;border-bottom:1px solid var(--border-color);">
                <div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></div>
                <span style="background:${color}22;color:${color};padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:600;min-width:80px;text-align:center;flex-shrink:0;">${log.category}</span>
                <span style="flex:1;color:var(--text-primary);font-size:0.9rem;">${(log.message||'').replace(/[<>]/g, '')}</span>
                <span style="color:var(--text-muted);font-size:0.8rem;flex-shrink:0;">${timeStr}</span>
            </div>`;
        }).join('') + '</div>';
}

function filterActivityLog() {
    const q = document.getElementById('log-search')?.value || '';
    renderActivityLog(q);
}

function exportActivityLog() {
    const logs = JSON.parse(localStorage.getItem('activity_log') || '[]');
    if (logs.length === 0) {
        Swal.fire({ icon: 'info', title: 'Kosong', text: 'Tidak ada log untuk diekspor.', background: '#1a1a2e', color: '#fff' });
        return;
    }
    const headers = ['Waktu', 'Kategori', 'Aktivitas'];
    const rows = logs.map(l => [new Date(l.time).toLocaleString('id-ID'), l.category, l.message.replace(/,/g, ';')]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

async function clearActivityLog() {
    const confirmed = await Swal.fire({ title: 'Hapus Semua Log?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Hapus', cancelButtonText: 'Batal', background: '#1a1a2e', color: '#fff', confirmButtonColor: '#ef4444' });
    if (!confirmed.isConfirmed) return;

    // Hapus dari localStorage
    localStorage.removeItem('activity_log');

    // Hapus dari MongoDB
    const token = AdminAuth.getToken();
    try {
        await fetch('/api/content?type=activity-log', { method: 'DELETE', headers: { 'X-Admin-Token': token } });
    } catch {}

    renderActivityLog();
    Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Log dihapus dari database!', background: '#1a1a2e', color: '#fff', timer: 1200, showConfirmButton: false });
}

// Patch initDashboard to update badge and log login
const _origInitDashboard = initDashboard;
window._origInitDashboard = _origInitDashboard;
window.initDashboard = function() {
    _origInitDashboard();
    updateLowStockHeaderBadge();
    addActivityLog('Login', 'Admin berhasil login ke dashboard');
};

// Patch updateStats to also update badge
const _origUpdateStats = updateStats;
window._origUpdateStats = _origUpdateStats;
window.updateStats = function() {
    _origUpdateStats();
    updateLowStockHeaderBadge();
};

// Patch saveProduct to log
const _origSaveProduct = saveProduct;
window._origSaveProduct = _origSaveProduct;
window.saveProduct = function() {
    const id = document.getElementById('product-id').value;
    const name = document.getElementById('product-name').value.trim();
    _origSaveProduct();
    addActivityLog('Produk', id ? `Edit produk: ${name}` : `Tambah produk baru: ${name}`);
};

// Patch deleteProduct to log
const _origDeleteProduct = deleteProduct;
window._origDeleteProduct = _origDeleteProduct;
window.deleteProduct = function(productId) {
    const product = ProductManager.getById(productId);
    _origDeleteProduct(productId);
    if (product) addActivityLog('Produk', `Hapus produk: ${product.name}`);
};

// Patch updateOrderStatus to log
const _origUpdateOrderStatus = updateOrderStatus;
window._origUpdateOrderStatus = _origUpdateOrderStatus;
window.updateOrderStatus = function(index, newStatus) {
    _origUpdateOrderStatus(index, newStatus);
    const statusLabel = newStatus === 'completed' ? 'Selesai' : newStatus === 'pending' ? 'Pending' : 'Dibatalkan';
    addActivityLog('Pesanan', `Update status pesanan #${index + 1} → ${statusLabel}`);
};

// Expose new functions
window.exportOrdersCSV = exportOrdersCSV;
window.changePassword = changePassword;
window.showLowStockAlert = showLowStockAlert;
window.showCartPreview = showCartPreview;
window.clearCartFromAdmin = clearCartFromAdmin;
window.filterActivityLog = filterActivityLog;
window.exportActivityLog = exportActivityLog;
window.clearActivityLog = clearActivityLog;


// ============================================================
// ===== FITUR BARU ADMIN v2.3 — 7 FITUR TAMBAHAN =============
// ============================================================

// ============================================================
// FITUR ADMIN 1: VOUCHER MANAGEMENT
// ============================================================
// showSection sudah lengkap di atas — tidak perlu override lagi

async function renderVouchers() {
    const token = AdminAuth.getToken();
    let vouchers = [];

    try {
        const res = await fetch('/api/content?type=vouchers', { headers: { 'X-Admin-Token': token } });
        if (res.ok) {
            const data = await res.json();
            vouchers = data.vouchers || [];
            // Sync ke localStorage sebagai cache
            localStorage.setItem('vouchers', JSON.stringify(vouchers));
        }
    } catch {
        // Fallback ke localStorage
        vouchers = JSON.parse(localStorage.getItem('vouchers') || '[]');
    }

    const total = vouchers.length;
    const active = vouchers.filter(v => v.active).length;
    const used = vouchers.reduce((sum, v) => sum + (v.usedCount || 0), 0);

    const totalEl = document.getElementById('voucher-total');
    const activeEl = document.getElementById('voucher-active');
    const usedEl = document.getElementById('voucher-used');
    if (totalEl) totalEl.textContent = total;
    if (activeEl) activeEl.textContent = active;
    if (usedEl) usedEl.textContent = used;

    const badge = document.getElementById('voucher-badge');
    if (badge) { badge.textContent = total; badge.style.display = total > 0 ? 'flex' : 'none'; }

    const tbody = document.getElementById('vouchers-table-body');
    if (!tbody) return;

    if (vouchers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fas fa-ticket-alt" style="font-size:2rem;display:block;margin-bottom:10px;opacity:0.3;"></i>Belum ada voucher</td></tr>`;
        return;
    }

    tbody.innerHTML = vouchers.map(v => `
        <tr>
            <td><strong style="letter-spacing:1px;">${v.code}</strong></td>
            <td>${v.type === 'percent' ? `${v.value}%` : Utils.formatRupiah(v.value)}</td>
            <td>${v.type === 'percent' ? 'Persentase' : 'Nominal'}</td>
            <td>${v.maxUse || '∞'}</td>
            <td>${v.usedCount || 0}</td>
            <td>${v.expiry ? new Date(v.expiry).toLocaleDateString('id-ID') : 'Tidak ada'}</td>
            <td><span class="status-badge ${v.active ? 'active' : 'inactive'}">${v.active ? 'Aktif' : 'Nonaktif'}</span></td>
            <td class="action-btns">
                <button class="action-btn edit" onclick="editVoucher('${v.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="action-btn ${v.active ? 'inactive' : 'active'}" onclick="toggleVoucher('${v.id}')" title="${v.active ? 'Nonaktifkan' : 'Aktifkan'}"><i class="fas fa-power-off"></i></button>
                <button class="action-btn delete" onclick="deleteVoucher('${v.id}')" title="Hapus"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`).join('');
}

function openVoucherModal(editId = null) {
    const modal = document.getElementById('voucher-modal');
    if (!modal) {
        Swal.fire({ icon: 'error', title: 'Modal tidak ditemukan', text: 'Elemen voucher-modal tidak ada. Pastikan admin.html sudah di-push terbaru.', background: '#1a1a2e', color: '#fff' });
        return;
    }

    const title = document.getElementById('voucher-modal-title');
    const editInput = document.getElementById('voucher-edit-id');
    const codeInput = document.getElementById('voucher-code');
    const typeInput = document.getElementById('voucher-type');
    const valueInput = document.getElementById('voucher-value');
    const maxUseInput = document.getElementById('voucher-max-use');
    const expiryInput = document.getElementById('voucher-expiry');
    const minPurchaseInput = document.getElementById('voucher-min-purchase');

    if (editId) {
        const vouchers = JSON.parse(localStorage.getItem('vouchers') || '[]');
        const voucher = vouchers.find(v => v.id === editId);
        if (voucher) {
            if (title) title.innerHTML = '<i class="fas fa-ticket-alt"></i> Edit Voucher';
            if (editInput) editInput.value = voucher.id;
            if (codeInput) codeInput.value = voucher.code;
            if (typeInput) typeInput.value = voucher.type;
            if (valueInput) valueInput.value = voucher.value;
            if (maxUseInput) maxUseInput.value = voucher.maxUse || '';
            if (expiryInput) expiryInput.value = voucher.expiry || '';
            if (minPurchaseInput) minPurchaseInput.value = voucher.minPurchase || 0;
        }
    } else {
        if (title) title.innerHTML = '<i class="fas fa-ticket-alt"></i> Buat Voucher';
        if (editInput) editInput.value = '';
        if (codeInput) codeInput.value = '';
        if (typeInput) typeInput.value = 'percent';
        if (valueInput) valueInput.value = '';
        if (maxUseInput) maxUseInput.value = '';
        if (expiryInput) expiryInput.value = '';
        if (minPurchaseInput) minPurchaseInput.value = 0;
    }
    modal.classList.add('active');
}

function closeVoucherModal() {
    document.getElementById('voucher-modal').classList.remove('active');
}

function generateVoucherCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    document.getElementById('voucher-code').value = code;
}

async function saveVoucher() {
    const id = document.getElementById('voucher-edit-id').value;
    const code = document.getElementById('voucher-code').value.trim().toUpperCase();
    const type = document.getElementById('voucher-type').value;
    const value = parseInt(document.getElementById('voucher-value').value);
    const maxUse = parseInt(document.getElementById('voucher-max-use').value) || 0;
    const expiry = document.getElementById('voucher-expiry').value;
    const minPurchase = parseInt(document.getElementById('voucher-min-purchase').value) || 0;

    if (!code || !value) {
        Swal.fire({ icon: 'warning', title: 'Data tidak lengkap!', text: 'Isi kode dan nilai diskon.', background: '#1a1a2e', color: '#fff' });
        return;
    }

    const token = AdminAuth.getToken();
    try {
        if (id) {
            await fetch(`/api/content?type=vouchers&id=${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
                body: JSON.stringify({ code, type, value, maxUse, expiry, minPurchase })
            });
        } else {
            await fetch('/api/content?type=vouchers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
                body: JSON.stringify({ code, type, value, maxUse, expiry, minPurchase, active: true })
            });
        }
        closeVoucherModal();
        renderVouchers();
        addActivityLog('Voucher', id ? `Edit voucher ${code}` : `Buat voucher ${code}`);
        Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Voucher disimpan ke database.', background: '#1a1a2e', color: '#fff', timer: 1000, showConfirmButton: false });
    } catch (e) {
        // Fallback ke localStorage
        const vouchers = JSON.parse(localStorage.getItem('vouchers') || '[]');
        if (id) {
            const idx = vouchers.findIndex(v => v.id === id);
            if (idx !== -1) vouchers[idx] = { ...vouchers[idx], code, type, value, maxUse, expiry, minPurchase };
        } else {
            vouchers.push({ id: 'vch_' + Date.now().toString(36), code, type, value, maxUse, expiry, minPurchase, usedCount: 0, active: true });
        }
        localStorage.setItem('vouchers', JSON.stringify(vouchers));
        closeVoucherModal();
        renderVouchers();
        Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Voucher disimpan (lokal).', background: '#1a1a2e', color: '#fff', timer: 1000, showConfirmButton: false });
    }
}

function editVoucher(id) {
    openVoucherModal(id);
}

async function toggleVoucher(id) {
    const token = AdminAuth.getToken();
    const vouchers = JSON.parse(localStorage.getItem('vouchers') || '[]');
    const v = vouchers.find(v => v.id === id);
    const newActive = v ? !v.active : true;

    try {
        await fetch(`/api/content?type=vouchers&id=${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
            body: JSON.stringify({ active: newActive })
        });
    } catch {}

    // Update localStorage juga
    if (v) { v.active = newActive; localStorage.setItem('vouchers', JSON.stringify(vouchers)); }
    renderVouchers();
    addActivityLog('Voucher', `${newActive ? 'Aktifkan' : 'Nonaktifkan'} voucher ${v?.code || id}`);
}

async function deleteVoucher(id) {
    const confirmed = await Swal.fire({
        title: 'Hapus Voucher?',
        text: 'Voucher yang dihapus tidak dapat dikembalikan.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal',
        background: '#1a1a2e',
        color: '#fff',
        confirmButtonColor: '#ef4444'
    });
    if (!confirmed.isConfirmed) return;

    const token = AdminAuth.getToken();
    const vouchers = JSON.parse(localStorage.getItem('vouchers') || '[]');
    const v = vouchers.find(v => v.id === id);

    try {
        await fetch(`/api/content?type=vouchers&id=${id}`, { method: 'DELETE', headers: { 'X-Admin-Token': token } });
    } catch {}

    // Update localStorage
    localStorage.setItem('vouchers', JSON.stringify(vouchers.filter(v => v.id !== id)));
    renderVouchers();
    addActivityLog('Voucher', `Hapus voucher ${v?.code || id}`);
    Swal.fire({ icon: 'success', title: 'Terhapus!', text: 'Voucher dihapus.', background: '#1a1a2e', color: '#fff', timer: 1000, showConfirmButton: false });
}

function filterVouchers() {
    const query = document.getElementById('voucher-search').value.toLowerCase();
    const rows = document.querySelectorAll('#vouchers-table-body tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
}

// ============================================================
// FITUR ADMIN 2: ADVANCED ANALYTICS
// ============================================================
async function renderAnalytics() {
    const token = AdminAuth.getToken();
    const products = ProductManager.getAll();

    // Load orders dari MongoDB
    let orders = [];
    try {
        const res = await fetch('/api/orders', { headers: { 'X-Admin-Token': token } });
        if (res.ok) { const data = await res.json(); orders = data.orders || []; }
    } catch {}

    // Load visitors dari MongoDB
    let visitors = 0, visitorStats = {};
    try {
        const res = await fetch('/api/visitors', { headers: { 'X-Admin-Token': token } });
        if (res.ok) { const data = await res.json(); visitors = data.stats?.total || 0; visitorStats = data.stats || {}; }
    } catch {}

    // Average Order Value
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const avgOrderValue = orders.length > 0 ? Math.floor(totalRevenue / orders.length) : 0;
    const avgEl = document.getElementById('avg-order-value');
    if (avgEl) avgEl.textContent = Utils.formatRupiah(avgOrderValue);

    // Best Selling Product
    const productSales = {};
    orders.forEach(o => {
        (o.items || []).forEach(item => {
            productSales[item.id] = (productSales[item.id] || 0) + (item.quantity || 1);
        });
    });
    let bestProduct = '-', maxSales = 0;
    for (const [id, qty] of Object.entries(productSales)) {
        if (qty > maxSales) {
            maxSales = qty;
            const p = products.find(p => p.id === id);
            bestProduct = p ? p.name : id;
        }
    }
    const bestEl = document.getElementById('best-product-name');
    if (bestEl) bestEl.textContent = bestProduct;

    // Conversion Rate
    const conversionRate = visitors > 0 ? Math.min(100, Math.round((orders.length / visitors) * 100)) : 0;
    const convEl = document.getElementById('conversion-rate');
    if (convEl) convEl.textContent = conversionRate + '%';

    // Orders Today
    const today = new Date().toISOString().split('T')[0];
    const ordersToday = orders.filter(o => o.createdAt?.startsWith(today)).length;
    const todayEl = document.getElementById('orders-today');
    if (todayEl) todayEl.textContent = ordersToday;

    // Revenue Target
    const target = parseInt(localStorage.getItem('revenue_target') || '10000000');
    const progress = Math.min(100, Math.floor((totalRevenue / target) * 100));
    const pctEl = document.getElementById('revenue-target-pct');
    const txtEl = document.getElementById('revenue-target-text');
    const barEl = document.getElementById('revenue-target-bar');
    if (pctEl) pctEl.textContent = progress + '%';
    if (txtEl) txtEl.textContent = `${Utils.formatRupiah(totalRevenue)} / ${Utils.formatRupiah(target)}`;
    if (barEl) barEl.style.width = progress + '%';

    // Top 5 Products
    const topProducts = Object.entries(productSales)
        .sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([id, qty]) => {
            const p = products.find(p => p.id === id);
            return { name: p?.name || id, sales: qty };
        });
    const topList = document.getElementById('top-products-list');
    if (topList) {
        topList.innerHTML = topProducts.length > 0 ? topProducts.map(p => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-color);">
                <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:8px;height:8px;background:var(--primary);border-radius:50%;"></div>
                    <span style="font-size:0.9rem;">${Utils.sanitize(p.name)}</span>
                </div>
                <span style="font-weight:700;color:var(--accent);">${p.sales} terjual</span>
            </div>`).join('')
            : '<p style="color:var(--text-muted);text-align:center;padding:20px;">Belum ada data penjualan</p>';
    }
    
    // Hourly Chart — destroy dulu jika sudah ada
    const hourlyCtx = document.getElementById('hourlyChart');
    if (hourlyCtx) {
        // Destroy chart lama jika ada
        const existingChart = Chart.getChart(hourlyCtx);
        if (existingChart) existingChart.destroy();

        const now = new Date();
        const labels = [];
        const data = [];
        for (let i = 0; i < 24; i++) {
            labels.push(`${i}:00`);
            const peak = i >= 14 && i <= 16 ? 1.5 : i >= 9 && i <= 20 ? 1 : 0.3;
            data.push(Math.floor(Math.random() * 5 * peak) + 1);
        }
        new Chart(hourlyCtx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: '#6366f1',
                    borderColor: '#4f46e5',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a1a1aa' } },
                    x: { grid: { display: false }, ticks: { color: '#a1a1aa' } }
                }
            }
        });
    }
}

function setRevenueTarget() {
    const input = document.getElementById('revenue-target-input');
    const value = parseInt(input.value);
    if (value > 0) {
        localStorage.setItem('revenue_target', value);
        renderAnalytics();
        addActivityLog('Analitik', `Set revenue target ${Utils.formatRupiah(value)}`);
        Swal.fire({ icon: 'success', title: 'Target Diset!', text: `Target revenue: ${Utils.formatRupiah(value)}`, background: '#1a1a2e', color: '#fff', timer: 1000, showConfirmButton: false });
        input.value = '';
    }
}

// ============================================================
// FITUR ADMIN 3: BROADCAST WHATSAPP
// ============================================================
function renderBroadcast() {
    const history = JSON.parse(localStorage.getItem('broadcast_history') || '[]');
    const container = document.getElementById('broadcast-history');
    if (!container) return;
    
    container.innerHTML = history.slice(-10).reverse().map(b => `
        <div style="background:var(--bg-glass);border-radius:8px;padding:12px;margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="font-weight:600;color:var(--text-primary);">${Utils.sanitize(b.template)}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);">${new Date(b.timestamp).toLocaleString('id-ID')}</div>
            </div>
            <div style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:5px;">${Utils.sanitize(b.message.substring(0, 100))}${b.message.length > 100 ? '...' : ''}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);">Ke: ${b.number || 'Admin'}</div>
        </div>
    `).join('');
    
    // Maintenance status
    const maintenance = localStorage.getItem('maintenance_mode') === 'true';
    const statusText = document.getElementById('maintenance-status-text');
    const toggleBtn = document.getElementById('maintenance-toggle-btn');
    if (statusText) statusText.textContent = maintenance ? '🟡 Mode maintenance AKTIF' : '🟢 Website normal';
    if (toggleBtn) toggleBtn.textContent = maintenance ? ' Matikan Maintenance' : ' Aktifkan Maintenance';
    
    const message = document.getElementById('maintenance-message');
    if (message) message.value = localStorage.getItem('maintenance_message') || 'Website sedang dalam pemeliharaan. Silakan coba lagi nanti.';
}

function loadBroadcastTemplate() {
    const select = document.getElementById('broadcast-template');
    const textarea = document.getElementById('broadcast-message');
    const templates = {
        promo: `🎉 PROMO SPESIAL ALFA HOSTING 🎉

Halo! Ada promo spesial untuk Anda:
• VPS 4GB hanya Rp 35.000/bulan
• Panel Unlimited Rp 15.000
• Kode: ALFA20 (diskon 20%)

Segera checkout sebelum promo berakhir!
${window.location.origin}`,
        maintenance: `🔧 MAINTENANCE NOTICE

Halo! Website ALFA HOSTING akan menjalani maintenance pada pukul 02:00-04:00 WIB.

Selama maintenance, website mungkin tidak dapat diakses.

Terima kasih atas pengertiannya.`,
        newproduct: `🆕 PRODUK BARU!

Kami baru saja meluncurkan:
• VPS ENTERPRISE 32GB - Rp 120.000/bulan
• Jasa Buat Bot WA Custom - Rp 50.000

Cek sekarang di website kami!`,
        custom: ''
    };
    if (select.value && templates[select.value]) {
        textarea.value = templates[select.value];
    }
}

function sendBroadcast() {
    const message = document.getElementById('broadcast-message').value.trim();
    const number = document.getElementById('broadcast-number').value.trim();
    const template = document.getElementById('broadcast-template').value;
    
    if (!message) {
        Swal.fire({ icon: 'warning', title: 'Pesan kosong!', text: 'Tulis pesan broadcast.', background: '#1a1a2e', color: '#fff' });
        return;
    }
    
    const target = number || '6282226769163';
    const url = `https://wa.me/${target}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    
    // Save to history
    const history = JSON.parse(localStorage.getItem('broadcast_history') || '[]');
    history.push({
        template: template || 'custom',
        message,
        number: number || null,
        timestamp: new Date().toISOString()
    });
    localStorage.setItem('broadcast_history', JSON.stringify(history));
    
    renderBroadcast();
    addActivityLog('Broadcast', `Kirim broadcast ke ${number || 'admin'}`);
    Swal.fire({ icon: 'success', title: 'Broadcast dikirim!', text: 'Pesan dibuka di WhatsApp.', background: '#1a1a2e', color: '#fff', timer: 1000, showConfirmButton: false });
}

function clearBroadcastHistory() {
    Swal.fire({
        title: 'Hapus Riwayat?',
        text: 'Semua riwayat broadcast akan dihapus.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal',
        background: '#1a1a2e',
        color: '#fff'
    }).then(result => {
        if (result.isConfirmed) {
            localStorage.removeItem('broadcast_history');
            renderBroadcast();
            addActivityLog('Broadcast', 'Hapus semua riwayat broadcast');
            Swal.fire({ icon: 'success', title: 'Terhapus!', text: 'Riwayat broadcast dihapus.', background: '#1a1a2e', color: '#fff', timer: 1000, showConfirmButton: false });
        }
    });
}

// ============================================================
// FITUR ADMIN 4: MAINTENANCE MODE
// ============================================================
function toggleMaintenanceMode() {
    const current = localStorage.getItem('maintenance_mode') === 'true';
    const newMode = !current;
    localStorage.setItem('maintenance_mode', newMode.toString());
    
    const btn = document.getElementById('maintenance-btn');
    if (btn) btn.style.color = newMode ? 'var(--warning)' : '';
    
    addActivityLog('Maintenance', `${newMode ? 'Aktifkan' : 'Matikan'} mode maintenance`);
    Swal.fire({
        icon: newMode ? 'warning' : 'success',
        title: newMode ? 'Mode Maintenance AKTIF' : 'Mode Maintenance NONAKTIF',
        text: newMode ? 'Website sekarang dalam mode maintenance.' : 'Website kembali normal.',
        background: '#1a1a2e',
        color: '#fff',
        timer: 1500,
        showConfirmButton: false
    });
    
    renderBroadcast();
}

function saveMaintenance() {
    const message = document.getElementById('maintenance-message').value.trim();
    localStorage.setItem('maintenance_message', message);
    addActivityLog('Maintenance', `Update pesan maintenance`);
    Swal.fire({ icon: 'success', title: 'Pesan disimpan!', background: '#1a1a2e', color: '#fff', timer: 1000, showConfirmButton: false });
}

// ============================================================
// FITUR ADMIN 5: BULK PRODUCT ACTIONS
// ============================================================
function openBulkActionModal() {
    const selected = document.querySelectorAll('.product-checkbox:checked');
    if (selected.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Pilih produk dulu!', text: 'Centang produk yang ingin di-edit massal.', background: '#1a1a2e', color: '#fff' });
        return;
    }
    document.getElementById('bulk-selected-count').textContent = selected.length;
    document.getElementById('bulk-action-modal').classList.add('active');
}

function bulkUpdatePrice() {
    Swal.fire({
        title: 'Update Harga Massal',
        html: '<input type="number" id="bulk-price-change" placeholder="Persentase perubahan (misal: 10 untuk naik 10%)" style="width:100%;padding:10px;background:#1a1a2e;border:1px solid #4f46e5;color:#fff;border-radius:8px;margin-top:10px;">',
        showCancelButton: true,
        confirmButtonText: 'Update',
        cancelButtonText: 'Batal',
        background: '#1a1a2e',
        color: '#fff',
        preConfirm: () => {
            const change = parseFloat(document.getElementById('bulk-price-change').value);
            if (!change || isNaN(change)) {
                Swal.showValidationMessage('Masukkan angka persentase!');
                return false;
            }
            return change;
        }
    }).then(result => {
        if (result.isConfirmed) {
            const change = result.value;
            const products = ProductManager.getAll();
            const selected = Array.from(document.querySelectorAll('.product-checkbox:checked')).map(cb => cb.dataset.id);
            let updated = 0;
            selected.forEach(id => {
                const idx = products.findIndex(p => p.id === id);
                if (idx !== -1) {
                    const newPrice = Math.floor(products[idx].price * (1 + change/100));
                    products[idx].price = newPrice;
                    updated++;
                }
            });
            localStorage.setItem('products', JSON.stringify(products));
            renderProductsTable();
            addActivityLog('Produk', `Update harga massal ${change > 0 ? '+' : ''}${change}% untuk ${updated} produk`);
            Swal.fire({ icon: 'success', title: 'Berhasil!', text: `${updated} produk diupdate.`, background: '#1a1a2e', color: '#fff', timer: 1000, showConfirmButton: false });
        }
    });
}

// ============================================================
// FITUR ADMIN 6: PDF REPORT GENERATION (simulasi)
// ============================================================
function generatePDFReport(type) {
    const salesHistory = JSON.parse(localStorage.getItem('salesHistory')) || [];
    const products = ProductManager.getAll();
    const date = new Date().toLocaleDateString('id-ID');
    
    let content = '';
    if (type === 'sales') {
        content = `
            <h1>Laporan Penjualan - ${date}</h1>
            <p>Total Revenue: ${Utils.formatRupiah(salesHistory.reduce((sum, sale) => sum + (sale.price * sale.quantity), 0))}</p>
            <p>Total Order: ${salesHistory.length}</p>
            <table border="1">
                <tr><th>Order ID</th><th>Produk</th><th>Qty</th><th>Total</th><th>Tanggal</th></tr>
                ${salesHistory.map(s => `<tr><td>${s.orderId || s.id}</td><td>${s.name}</td><td>${s.quantity}</td><td>${Utils.formatRupiah(s.price * s.quantity)}</td><td>${s.date}</td></tr>`).join('')}
            </table>
        `;
    } else if (type === 'inventory') {
        content = `
            <h1>Laporan Stok - ${date}</h1>
            <p>Total Produk: ${products.length}</p>
            <table border="1">
                <tr><th>Produk</th><th>Kategori</th><th>Stok</th><th>Harga</th></tr>
                ${products.map(p => `<tr><td>${p.name}</td><td>${p.category}</td><td>${p.category === 'other' ? 'N/A' : p.stock}</td><td>${Utils.formatRupiah(p.price)}</td></tr>`).join('')}
            </table>
        `;
    }
    
    // Simulate PDF download
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-${type}-${date.replace(/\//g, '-')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    addActivityLog('Report', `Generate PDF report ${type}`);
    Swal.fire({ icon: 'success', title: 'Report Generated!', text: 'File akan diunduh.', background: '#1a1a2e', color: '#fff', timer: 1000, showConfirmButton: false });
}

// ============================================================
// FITUR ADMIN 7: REAL-TIME REVENUE CHART
// ============================================================
function initRealTimeChart() {
    const ctx = document.getElementById('realtimeChart');
    if (!ctx) return;

    // Destroy chart lama jika ada
    const existing = Chart.getChart(ctx);
    if (existing) existing.destroy();

    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Revenue (Rp)',
                data: [],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a1a1aa', callback: v => 'Rp ' + v.toLocaleString('id-ID') } },
                x: { grid: { display: false }, ticks: { color: '#a1a1aa' } }
            }
        }
    });
    
    // Simulate real-time updates
    setInterval(() => {
        const salesHistory = JSON.parse(localStorage.getItem('salesHistory')) || [];
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const label = `${hour}:${minute.toString().padStart(2, '0')}`;
        
        // Calculate revenue for last 5 minutes (simulated)
        const revenue = Math.floor(Math.random() * 50000) + 10000;
        
        chart.data.labels.push(label);
        chart.data.datasets[0].data.push(revenue);
        
        // Keep only last 20 data points
        if (chart.data.labels.length > 20) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }
        
        chart.update();
    }, 30000); // Update every 30 seconds
}

// ============================================================
// EXPOSE NEW FUNCTIONS GLOBALLY
// ============================================================
window.VoucherManager = VoucherManager;
window.openVoucherModal = openVoucherModal;
window.closeVoucherModal = closeVoucherModal;
window.generateVoucherCode = generateVoucherCode;
window.saveVoucher = saveVoucher;
window.editVoucher = editVoucher;
window.toggleVoucher = toggleVoucher;
window.deleteVoucher = deleteVoucher;
window.filterVouchers = filterVouchers;
window.renderVouchers = renderVouchers;
window.renderAnalytics = renderAnalytics;
window.setRevenueTarget = setRevenueTarget;
window.loadBroadcastTemplate = loadBroadcastTemplate;
window.sendBroadcast = sendBroadcast;
window.clearBroadcastHistory = clearBroadcastHistory;
window.toggleMaintenanceMode = toggleMaintenanceMode;
window.saveMaintenance = saveMaintenance;
window.openBulkActionModal = openBulkActionModal;
window.bulkUpdatePrice = bulkUpdatePrice;
window.generatePDFReport = generatePDFReport;
window.initRealTimeChart = initRealTimeChart;
window.renderBroadcast = renderBroadcast;


// ============================================================
// SISTEM STOK OTOMATIS - UPDATE STOK SAAT PRODUK HABIS
// ============================================================
function checkAndUpdateStock() {
    try {
        const products = ProductManager.getAll();
        let updated = false;
        const outNow = [];
        const backNow = [];

        products.forEach(product => {
            if (product.category === 'other') return;
            if (product.stock <= 0 && !product.outOfStock) {
                product.outOfStock = true;
                updated = true;
                outNow.push(product.name);
            } else if (product.stock > 0 && product.outOfStock) {
                product.outOfStock = false;
                updated = true;
                backNow.push(product.name);
            }
        });

        if (updated) {
            localStorage.setItem('products', JSON.stringify(products));
            outNow.forEach(name => addActivityLog('Stok', `Produk "${name}" stok habis`));
            backNow.forEach(name => addActivityLog('Stok', `Produk "${name}" kembali tersedia`));
            // Refresh tabel jika sedang tampil
            const prodSection = document.getElementById('products-section');
            if (prodSection && prodSection.style.display !== 'none') renderProductsTable();
            updateStats();
        }
    } catch(e) { /* silent fail jika dipanggil sebelum login */ }
}

// ============================================================
// EVENT LISTENER UTAMA — satu DOMContentLoaded untuk semua
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    // 1. Cek sesi login
    checkAuth();

    // 2. Patch login button untuk custom password hash
    _patchLoginBtn();

    // 3. Enter key di password field
    const passwordInput = document.getElementById('admin-password');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') login();
        });
    }

    // 4. Password strength indicator (ganti password)
    const newPassInput = document.getElementById('new-password');
    const strengthEl = document.getElementById('password-strength');
    if (newPassInput && strengthEl) {
        newPassInput.addEventListener('input', () => {
            const val = newPassInput.value;
            let strength = 0;
            if (val.length >= 12) strength++;
            if (/[A-Z]/.test(val)) strength++;
            if (/[0-9]/.test(val)) strength++;
            if (/[^A-Za-z0-9]/.test(val)) strength++;
            if (val.length === 0) { strengthEl.textContent = ''; return; }
            const levels = ['', '⚠️ Lemah', '🔶 Sedang', '✅ Kuat', '🔒 Sangat Kuat'];
            const colors = ['', 'var(--danger)', 'var(--warning)', 'var(--accent)', '#34d399'];
            strengthEl.innerHTML = `<span style="color:${colors[strength]}">${levels[strength]}</span>`;
        });
    }

    // 5. Password strength indicator (setup admin)
    const setupPassInput = document.getElementById('setup-password');
    const setupStrengthEl = document.getElementById('setup-strength');
    if (setupPassInput && setupStrengthEl) {
        setupPassInput.addEventListener('input', () => {
            const val = setupPassInput.value;
            let strength = 0;
            if (val.length >= 12) strength++;
            if (val.length >= 16) strength++;
            if (/[A-Z]/.test(val)) strength++;
            if (/[0-9]/.test(val)) strength++;
            if (/[^A-Za-z0-9]/.test(val)) strength++;
            if (val.length === 0) { setupStrengthEl.textContent = ''; return; }
            const levels = ['', '⚠️ Lemah', '🔶 Sedang', '✅ Kuat', '🔒 Sangat Kuat', '🛡️ Maksimal'];
            const colors = ['', 'var(--danger)', 'var(--warning)', 'var(--accent)', '#34d399', '#6366f1'];
            setupStrengthEl.innerHTML = `<span style="color:${colors[Math.min(strength,5)]}">${levels[Math.min(strength,5)]}</span>`;
        });
    }
});

// ============================================================
// EXPOSE FUNGSI BARU KE WINDOW
// ============================================================
window.checkAndUpdateStock = checkAndUpdateStock;
window.AdminAuth = AdminAuth;
window.submitAdminSetup = submitAdminSetup;
window.syncSettingsToDB = syncSettingsToDB;
window.updateTrafficChart = updateTrafficChart;
window.loadRealtimeData = loadRealtimeData;

// ============================================================
// CHART FUNCTIONS — MODERN DASHBOARD
// ============================================================

function initSalesChart() {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;
    if (salesChart) salesChart.destroy();
    salesChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Revenue', data: [], backgroundColor: 'rgba(99,102,241,0.7)', borderRadius: 6, borderSkipped: false }] },
        options: {
            ...CHART_DEFAULTS,
            scales: {
                y: { ...CHART_DEFAULTS.scales.y, ticks: { color: '#71717a', callback: v => 'Rp ' + (v/1000).toFixed(0) + 'k' } },
                x: CHART_DEFAULTS.scales.x
            }
        }
    });
    loadSalesChartData(7);
}

async function loadSalesChartData(days) {
    const token = AdminAuth.getToken();
    try {
        const res = await fetch('/api/orders', { headers: { 'X-Admin-Token': token } });
        if (!res.ok) return;
        const { orders } = await res.json();

        const labels = [], values = [];
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            labels.push(date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
            const dayRevenue = orders
                .filter(o => o.createdAt && new Date(o.createdAt).toISOString().split('T')[0] === dateStr)
                .reduce((s, o) => s + (o.total || 0), 0);
            values.push(dayRevenue);
        }

        if (salesChart) {
            salesChart.data.labels = labels;
            salesChart.data.datasets[0].data = values;
            salesChart.update();
        }
    } catch {}
}

function initCategoryChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    if (categoryChart) categoryChart.destroy();
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['VPS', 'Panel', 'Jasa'],
            datasets: [{ data: [1, 1, 1], backgroundColor: ['#6366f1', '#10b981', '#f59e0b'], borderWidth: 0, hoverOffset: 8 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: '#a1a1aa', padding: 15, font: { size: 11 } } } },
            cutout: '65%'
        }
    });
    loadCategoryData();
}

async function loadCategoryData() {
    const token = AdminAuth.getToken();
    try {
        const res = await fetch('/api/orders', { headers: { 'X-Admin-Token': token } });
        if (!res.ok) return;
        const { orders } = await res.json();
        const products = ProductManager.getAll();
        let vps = 0, panel = 0, other = 0;
        orders.forEach(o => {
            (o.items || []).forEach(item => {
                const p = products.find(p => p.id === item.id);
                if (p?.category === 'vps') vps += item.quantity || 1;
                else if (p?.category === 'panel') panel += item.quantity || 1;
                else other += item.quantity || 1;
            });
        });
        if (categoryChart) {
            categoryChart.data.datasets[0].data = [vps || 1, panel || 1, other || 1];
            categoryChart.update();
        }
    } catch {}
}

function initTrafficChart() {
    const ctx = document.getElementById('trafficChart');
    if (!ctx) return;
    if (trafficChart) trafficChart.destroy();
    trafficChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Pengunjung Baru', data: [], borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.08)', fill: true, tension: 0.4, pointRadius: 3 },
                { label: 'Kembali', data: [], borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)', fill: true, tension: 0.4, pointRadius: 3 }
            ]
        },
        options: {
            ...CHART_DEFAULTS,
            plugins: { legend: { display: false } }
        }
    });
    loadTrafficData(7);
}

async function loadTrafficData(days) {
    const token = AdminAuth.getToken();
    try {
        const res = await fetch('/api/visitors', { headers: { 'X-Admin-Token': token } });
        if (!res.ok) return;
        const { dailyStats } = await res.json();

        const labels = [], newV = [], returning = [];
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            labels.push(date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
            const day = dailyStats?.find(d => d.date === dateStr);
            const count = day?.count || 0;
            newV.push(count);
            returning.push(Math.floor(count * 0.3)); // estimasi returning
        }

        if (trafficChart) {
            trafficChart.data.labels = labels;
            trafficChart.data.datasets[0].data = newV;
            trafficChart.data.datasets[1].data = returning;
            trafficChart.update();
        }
    } catch {}
}

function updateTrafficChart() {
    const days = parseInt(document.getElementById('traffic-period')?.value || '7');
    loadTrafficData(days);
}

function initDeviceChart() {
    const ctx = document.getElementById('deviceChart');
    if (!ctx) return;
    if (deviceChart) deviceChart.destroy();
    deviceChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Desktop', 'Mobile', 'Tablet'],
            datasets: [{ data: [1, 1, 1], backgroundColor: ['#6366f1', '#ec4899', '#f59e0b'], borderWidth: 0, hoverOffset: 6 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            cutout: '70%'
        }
    });
    loadDeviceData();
}

async function loadDeviceData() {
    const token = AdminAuth.getToken();
    try {
        const res = await fetch('/api/visitors', { headers: { 'X-Admin-Token': token } });
        if (!res.ok) return;
        const { devices, stats } = await res.json();

        const desktop = devices?.desktop || 0;
        const mobile = devices?.mobile || 0;
        const tablet = devices?.tablet || 0;
        const total = desktop + mobile + tablet || 1;

        if (deviceChart) {
            deviceChart.data.datasets[0].data = [desktop || 1, mobile || 1, tablet || 1];
            deviceChart.update();
        }

        const totalEl = document.getElementById('total-device-count');
        if (totalEl) totalEl.textContent = total;

        const legendEl = document.getElementById('device-legend');
        if (legendEl) {
            const items = [
                { label: 'Desktop', count: desktop, color: '#6366f1' },
                { label: 'Mobile', count: mobile, color: '#ec4899' },
                { label: 'Tablet', count: tablet, color: '#f59e0b' }
            ];
            legendEl.innerHTML = items.map(item => `
                <div class="device-legend-item">
                    <div class="device-legend-left">
                        <div class="legend-dot" style="background:${item.color};"></div>
                        ${item.label}
                    </div>
                    <div class="device-legend-right">
                        <span class="device-legend-count">${item.count}</span>
                        <span class="device-legend-pct">${Math.round(item.count/total*100)}%</span>
                    </div>
                </div>`).join('');
        }
    } catch {}
}

function initSparklines() {
    const sparkConfigs = [
        { id: 'revenueSparkline', color: '#6366f1' },
        { id: 'ordersSparkline', color: '#10b981' },
        { id: 'visitorsSparkline', color: '#3b82f6' },
        { id: 'productsSparkline', color: '#f59e0b' }
    ];
    sparkConfigs.forEach(({ id, color }) => {
        const ctx = document.getElementById(id);
        if (!ctx) return;
        // Destroy chart lama jika ada
        const existing = Chart.getChart(ctx);
        if (existing) existing.destroy();
        sparklineCharts[id] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array(7).fill(''),
                datasets: [{ data: Array(7).fill(0).map(() => Math.random() * 100), borderColor: color, backgroundColor: color + '20', fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: { x: { display: false }, y: { display: false } },
                animation: { duration: 1000 }
            }
        });
    });
}

async function loadRealtimeData() {
    const token = AdminAuth.getToken();
    try {
        const [visitorRes, orderRes] = await Promise.all([
            fetch('/api/visitors', { headers: { 'X-Admin-Token': token } }).then(r => r.json()).catch(() => ({})),
            fetch('/api/orders', { headers: { 'X-Admin-Token': token } }).then(r => r.json()).catch(() => ({ orders: [] }))
        ]);

        const stats = visitorRes.stats || {};
        const orders = orderRes.orders || [];
        const today = new Date().toISOString().split('T')[0];
        const ordersToday = orders.filter(o => o.createdAt && new Date(o.createdAt).toISOString().split('T')[0] === today).length;

        // Update realtime items
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('rt-online', stats.liveNow || 0);
        set('rt-new', stats.today || 0);
        set('rt-orders', ordersToday);
        set('rt-pageviews', stats.total || 0);
        set('live-visitors-count', stats.liveNow || 0);

        // Top pages
        const topPagesEl = document.getElementById('top-pages-list');
        if (topPagesEl && visitorRes.topPages?.length > 0) {
            const maxCount = visitorRes.topPages[0].count;
            topPagesEl.innerHTML = visitorRes.topPages.map(p => `
                <div class="top-page-item">
                    <div class="top-page-info">
                        <span class="top-page-name">${p.page || '/'}</span>
                        <span class="top-page-count">${p.count.toLocaleString('id-ID')}</span>
                    </div>
                    <div class="top-page-bar">
                        <div class="top-page-fill" style="width:${Math.round(p.count/maxCount*100)}%"></div>
                    </div>
                </div>`).join('');
        } else if (topPagesEl) {
            topPagesEl.innerHTML = `<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:20px;">Belum ada data halaman</p>`;
        }

    } catch {}
}

// ============================================================
// NEWSLETTER MANAGEMENT
// ============================================================
async function renderNewsletter(filter = '') {
    const tbody = document.getElementById('newsletter-table-body');
    const statsEl = document.getElementById('newsletter-stats');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;"><i class="fas fa-spinner fa-spin"></i> Memuat...</td></tr>`;

    try {
        const token = AdminAuth.getToken();
        const res = await fetch('/api/content?type=newsletter', { headers: { 'X-Admin-Token': token } });

        if (!res.ok) {
            // Fallback ke localStorage
            const local = JSON.parse(localStorage.getItem('newsletter_subscribers') || '[]');
            renderNewsletterLocal(local, filter, tbody, statsEl);
            return;
        }

        const { subscribers, total } = await res.json();
        renderNewsletterLocal(subscribers, filter, tbody, statsEl, total);

    } catch {
        const local = JSON.parse(localStorage.getItem('newsletter_subscribers') || '[]');
        renderNewsletterLocal(local, filter, tbody, statsEl);
    }
}

function renderNewsletterLocal(subscribers, filter, tbody, statsEl, total) {
    let data = subscribers;
    if (filter) data = data.filter(s => (s.name||'').toLowerCase().includes(filter) || s.email.toLowerCase().includes(filter));

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fas fa-envelope" style="font-size:2rem;display:block;margin-bottom:10px;opacity:0.3;"></i>Belum ada subscriber</td></tr>`;
    } else {
        tbody.innerHTML = data.map((s, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${Utils.sanitize(s.name || '-')}</td>
                <td>${Utils.sanitize(s.email)}</td>
                <td><code style="background:rgba(99,102,241,0.1);color:var(--primary);padding:3px 8px;border-radius:6px;">${s.promoCode || '-'}</code></td>
                <td>${new Date(s.createdAt || s.date || Date.now()).toLocaleDateString('id-ID')}</td>
                <td>
                    <button class="action-btn delete" onclick="deleteNewsletterSubscriber('${s._id || s.email}')" title="Hapus"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`).join('');
    }

    if (statsEl) {
        const count = total || subscribers.length;
        statsEl.innerHTML = [
            { icon: 'fa-users', label: 'Total Subscriber', value: count, color: 'var(--primary)' },
            { icon: 'fa-calendar', label: 'Bulan Ini', value: subscribers.filter(s => new Date(s.createdAt||s.date||0) > new Date(Date.now()-30*86400000)).length, color: 'var(--accent)' },
            { icon: 'fa-tag', label: 'Kode Aktif', value: subscribers.filter(s => s.promoCode).length, color: 'var(--warning)' }
        ].map(s => `
            <div style="background:var(--bg-glass);border:1px solid var(--border-color);border-radius:12px;padding:16px;text-align:center;">
                <i class="fas ${s.icon}" style="color:${s.color};font-size:1.5rem;margin-bottom:8px;display:block;"></i>
                <div style="font-size:1.5rem;font-weight:700;">${s.value}</div>
                <div style="color:var(--text-muted);font-size:0.8rem;">${s.label}</div>
            </div>`).join('');
    }

    // Update badge
    const badge = document.getElementById('newsletter-badge');
    if (badge) { badge.textContent = total || subscribers.length; badge.style.display = 'flex'; }
}

async function deleteNewsletterSubscriber(id) {
    const confirmed = await Swal.fire({ title: 'Hapus subscriber?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya', cancelButtonText: 'Batal', background: '#1a1a2e', color: '#fff', confirmButtonColor: '#ef4444' });
    if (!confirmed.isConfirmed) return;

    const token = AdminAuth.getToken();
    try {
        await fetch(`/api/content?type=newsletter&id=${id}`, { method: 'DELETE', headers: { 'X-Admin-Token': token } });
    } catch {}

    // Hapus dari localStorage juga
    const local = JSON.parse(localStorage.getItem('newsletter_subscribers') || '[]');
    const filtered = local.filter(s => s.email !== id && s._id !== id);
    localStorage.setItem('newsletter_subscribers', JSON.stringify(filtered));

    renderNewsletter();
    addActivityLog('Newsletter', `Hapus subscriber ${id}`);
}

function filterNewsletter(val) { renderNewsletter(val.toLowerCase()); }

function exportNewsletter() {
    const local = JSON.parse(localStorage.getItem('newsletter_subscribers') || '[]');
    if (local.length === 0) { Swal.fire({ icon: 'info', title: 'Kosong', text: 'Tidak ada subscriber.', background: '#1a1a2e', color: '#fff' }); return; }
    const csv = '\uFEFF' + 'Nama,Email,Kode Promo,Tanggal\n' + local.map(s => `"${s.name||''}","${s.email}","${s.promoCode||''}","${s.date||''}"`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `newsletter-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    addActivityLog('Newsletter', 'Export subscriber ke CSV');
}

function clearNewsletter() {
    Swal.fire({ title: 'Hapus semua subscriber?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Hapus', cancelButtonText: 'Batal', background: '#1a1a2e', color: '#fff', confirmButtonColor: '#ef4444' })
    .then(r => { if (r.isConfirmed) { localStorage.removeItem('newsletter_subscribers'); renderNewsletter(); addActivityLog('Newsletter', 'Hapus semua subscriber'); } });
}

function updateNewsletterBadge() {
    const local = JSON.parse(localStorage.getItem('newsletter_subscribers') || '[]');
    const badge = document.getElementById('newsletter-badge');
    if (badge) { badge.textContent = local.length; badge.style.display = local.length > 0 ? 'flex' : 'none'; }
}

// ============================================================
// FLASH SALE MANAGEMENT
// ============================================================
async function renderFlashSale() {
    // Isi dropdown produk
    const select = document.getElementById('flash-product-select');
    if (select) {
        const products = ProductManager.getAll().filter(p => p.category !== 'other');
        select.innerHTML = '<option value="">Pilih produk...</option>' +
            products.map(p => `<option value="${p.id}" data-name="${Utils.sanitize(p.name)}">${Utils.sanitize(p.name)} — ${Utils.formatRupiah(p.price)}</option>`).join('');
    }

    const statusEl = document.getElementById('flash-sale-status');
    const historyEl = document.getElementById('flash-sale-history');

    // Cek localStorage dulu (selalu tersedia)
    const localFlash = JSON.parse(localStorage.getItem('flash_sale') || 'null');
    const localHistory = JSON.parse(localStorage.getItem('flash_sale_history') || '[]');

    // Tampilkan dari localStorage dulu (instant, tidak perlu API)
    if (statusEl) {
        if (localFlash && localFlash.active && new Date(localFlash.endsAt) > new Date()) {
            const remaining = Math.max(0, new Date(localFlash.endsAt) - Date.now());
            const mins = Math.floor(remaining / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            statusEl.innerHTML = `
            <div style="background:rgba(245,158,11,0.1);border:1px solid var(--warning);border-radius:12px;padding:16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <strong>${Utils.sanitize(localFlash.productName || 'Produk')}</strong>
                    <span style="background:var(--danger);color:#fff;padding:4px 12px;border-radius:50px;font-weight:700;">-${localFlash.discount}%</span>
                </div>
                <div style="color:var(--warning);font-size:0.9rem;"><i class="fas fa-clock"></i> Berakhir dalam: <strong>${mins}m ${secs}s</strong></div>
                <button class="btn btn-danger btn-sm" style="margin-top:10px;" onclick="stopFlashSale()"><i class="fas fa-stop"></i> Stop Flash Sale</button>
            </div>`;
        } else {
            statusEl.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fas fa-bolt" style="font-size:3rem;opacity:0.3;display:block;margin-bottom:15px;"></i><p>Tidak ada flash sale aktif</p><p style="font-size:0.8rem;margin-top:8px;">Buat flash sale baru di form sebelah kiri</p></div>`;
        }
    }

    if (historyEl) {
        if (localHistory.length === 0) {
            historyEl.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:20px;">Belum ada riwayat flash sale</p>`;
        } else {
            historyEl.innerHTML = localHistory.slice(-10).reverse().map(f => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--bg-glass);border-radius:10px;margin-bottom:8px;">
                    <div><strong>${Utils.sanitize(f.productName || 'Produk')}</strong> <span style="color:var(--danger);">-${f.discount}%</span></div>
                    <div style="color:var(--text-muted);font-size:0.8rem;">${new Date(f.endsAt).toLocaleDateString('id-ID')}</div>
                </div>`).join('');
        }
    }

    // Coba sync dari API (background, tidak blocking)
    try {
        const token = AdminAuth.getToken();
        if (!token) return;
        const res = await fetch('/api/content?type=flash-sale', { headers: { 'X-Admin-Token': token } });
        if (!res.ok) return;
        const { flashSales } = await res.json();
        // Update history dari DB
        const past = flashSales.filter(f => !f.active || new Date(f.endsAt) <= new Date());
        if (historyEl && past.length > 0) {
            historyEl.innerHTML = past.map(f => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--bg-glass);border-radius:10px;margin-bottom:8px;">
                    <div><strong>${Utils.sanitize(f.productName)}</strong> <span style="color:var(--danger);">-${f.discount}%</span></div>
                    <div style="color:var(--text-muted);font-size:0.8rem;">${new Date(f.endsAt).toLocaleDateString('id-ID')}</div>
                    <button class="action-btn delete" onclick="deleteFlashSaleById('${f._id}')"><i class="fas fa-trash"></i></button>
                </div>`).join('');
        }
    } catch { /* silent */ }
}

async function startFlashSale() {
    const select   = document.getElementById('flash-product-select');
    const discount = parseInt(document.getElementById('flash-discount').value);
    const duration = parseInt(document.getElementById('flash-duration').value);

    if (!select.value || !discount || !duration) {
        Swal.fire({ icon: 'warning', title: 'Lengkapi data!', text: 'Pilih produk, diskon, dan durasi.', background: '#1a1a2e', color: '#fff' }); return;
    }

    const productName = select.options[select.selectedIndex].dataset.name || select.options[select.selectedIndex].text;
    const endsAt = new Date(Date.now() + duration * 60 * 1000).toISOString();
    const flashData = { productId: select.value, productName, discount, endsAt, active: true };

    // Simpan ke localStorage (selalu berhasil)
    localStorage.setItem('flash_sale', JSON.stringify(flashData));
    const history = JSON.parse(localStorage.getItem('flash_sale_history') || '[]');
    history.push({ ...flashData, createdAt: new Date().toISOString() });
    localStorage.setItem('flash_sale_history', JSON.stringify(history.slice(-20)));

    // Coba simpan ke DB (background)
    const token = AdminAuth.getToken();
    if (token) {
        fetch('/api/content?type=flash-sale', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
            body: JSON.stringify(flashData)
        }).catch(() => {});
    }

    addActivityLog('Flash Sale', `Mulai flash sale ${productName} -${discount}% selama ${duration} menit`);
    Swal.fire({ icon: 'success', title: 'Flash Sale Dimulai!', text: `${productName} diskon ${discount}% selama ${duration} menit.`, background: '#1a1a2e', color: '#fff', timer: 2000, showConfirmButton: false });
    renderFlashSale();
}

async function stopFlashSale() {
    localStorage.removeItem('flash_sale');
    addActivityLog('Flash Sale', 'Stop semua flash sale');
    Swal.fire({ icon: 'success', title: 'Flash Sale Dihentikan', background: '#1a1a2e', color: '#fff', timer: 1000, showConfirmButton: false });
    renderFlashSale();
}

async function stopFlashSaleById(id) {
    const token = AdminAuth.getToken();
    try { await fetch(`/api/content?type=flash-sale&id=${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token }, body: JSON.stringify({ active: false }) }); } catch {}
    renderFlashSale();
}

async function deleteFlashSaleById(id) {
    const token = AdminAuth.getToken();
    try { await fetch(`/api/content?type=flash-sale&id=${id}`, { method: 'DELETE', headers: { 'X-Admin-Token': token } }); } catch {}
    renderFlashSale();
}

// ============================================================
// REVIEWS MANAGEMENT
// ============================================================
async function renderReviews(filter = '') {
    const tbody = document.getElementById('reviews-table-body');
    const statsEl = document.getElementById('reviews-stats');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;"><i class="fas fa-spinner fa-spin"></i> Memuat...</td></tr>`;

    try {
        const token = AdminAuth.getToken();
        const res = await fetch('/api/content?type=reviews&limit=50', { headers: { 'X-Admin-Token': token } });

        if (!res.ok) throw new Error();
        const { reviews, total } = await res.json();

        let data = reviews;
        if (filter) data = data.filter(r => r.name.toLowerCase().includes(filter) || r.message.toLowerCase().includes(filter));

        if (statsEl) {
            const pending  = reviews.filter(r => r.status === 'pending').length;
            const approved = reviews.filter(r => r.status === 'approved').length;
            const rejected = reviews.filter(r => r.status === 'rejected').length;
            const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0';
            statsEl.innerHTML = [
                { label: 'Total', value: total || reviews.length, color: 'var(--primary)', icon: 'fa-star' },
                { label: 'Pending', value: pending, color: 'var(--warning)', icon: 'fa-clock' },
                { label: 'Disetujui', value: approved, color: 'var(--accent)', icon: 'fa-check' },
                { label: 'Ditolak', value: rejected, color: 'var(--danger)', icon: 'fa-times' },
                { label: 'Rata-rata', value: avgRating + '⭐', color: 'var(--warning)', icon: 'fa-chart-bar' }
            ].map(s => `
                <div style="background:var(--bg-glass);border:1px solid var(--border-color);border-radius:12px;padding:14px;text-align:center;">
                    <i class="fas ${s.icon}" style="color:${s.color};font-size:1.3rem;margin-bottom:6px;display:block;"></i>
                    <div style="font-size:1.3rem;font-weight:700;">${s.value}</div>
                    <div style="color:var(--text-muted);font-size:0.75rem;">${s.label}</div>
                </div>`).join('');

            // Update badge
            const badge = document.getElementById('reviews-badge');
            if (badge) { badge.textContent = pending; badge.style.display = pending > 0 ? 'flex' : 'none'; }
        }

        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fas fa-star" style="font-size:2rem;display:block;margin-bottom:10px;opacity:0.3;"></i>Belum ada ulasan</td></tr>`;
            return;
        }

        const stars = n => '⭐'.repeat(n);
        const statusBadge = { pending: 'warning', approved: 'active', rejected: 'inactive' };

        tbody.innerHTML = data.map(r => `
            <tr>
                <td><strong>${Utils.sanitize(r.name)}</strong></td>
                <td style="font-size:0.85rem;color:var(--text-secondary);">${Utils.sanitize(r.product || '-')}</td>
                <td>${stars(r.rating)}</td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${Utils.sanitize(r.message)}">${Utils.sanitize(r.message)}</td>
                <td>${new Date(r.createdAt).toLocaleDateString('id-ID')}</td>
                <td><span class="status-badge ${statusBadge[r.status] || 'pending'}">${r.status === 'approved' ? 'Disetujui' : r.status === 'rejected' ? 'Ditolak' : 'Pending'}</span></td>
                <td>
                    <div class="action-btns">
                        ${r.status !== 'approved' ? `<button class="action-btn active" onclick="approveReview('${r._id}')" title="Setujui"><i class="fas fa-check"></i></button>` : ''}
                        ${r.status !== 'rejected' ? `<button class="action-btn inactive" onclick="rejectReview('${r._id}')" title="Tolak"><i class="fas fa-times"></i></button>` : ''}
                        <button class="action-btn delete" onclick="deleteReview('${r._id}')" title="Hapus"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>`).join('');

    } catch {
        // Fallback: tampilkan testimonials dari localStorage sebagai reviews
        const testimonials = JSON.parse(localStorage.getItem('testimonials') || '[]');
        if (testimonials.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fas fa-star" style="font-size:2rem;display:block;margin-bottom:10px;opacity:0.3;"></i>Belum ada ulasan<br><small style="font-size:0.8rem;margin-top:8px;display:block;">Hubungkan ke MongoDB untuk fitur approve/reject</small></td></tr>`;
        } else {
            const stars = n => '⭐'.repeat(n);
            let data = testimonials;
            if (filter) data = data.filter(r => r.name.toLowerCase().includes(filter) || r.message.toLowerCase().includes(filter));
            tbody.innerHTML = data.map(r => `
                <tr>
                    <td><strong>${Utils.sanitize(r.name)}</strong></td>
                    <td style="font-size:0.85rem;color:var(--text-secondary);">-</td>
                    <td>${stars(r.rating || 5)}</td>
                    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${Utils.sanitize(r.message)}">${Utils.sanitize(r.message)}</td>
                    <td>${r.date || '-'}</td>
                    <td><span class="status-badge active">Disetujui</span></td>
                    <td><button class="action-btn delete" onclick="deleteTestimonialLocal(${r.id})" title="Hapus"><i class="fas fa-trash"></i></button></td>
                </tr>`).join('');
            if (statsEl) {
                statsEl.innerHTML = [
                    { label: 'Total', value: testimonials.length, color: 'var(--primary)', icon: 'fa-star' },
                    { label: 'Pending', value: 0, color: 'var(--warning)', icon: 'fa-clock' },
                    { label: 'Disetujui', value: testimonials.length, color: 'var(--accent)', icon: 'fa-check' },
                    { label: 'Ditolak', value: 0, color: 'var(--danger)', icon: 'fa-times' },
                    { label: 'Rata-rata', value: (testimonials.reduce((s,r) => s+(r.rating||5), 0)/testimonials.length).toFixed(1) + '⭐', color: 'var(--warning)', icon: 'fa-chart-bar' }
                ].map(s => `<div style="background:var(--bg-glass);border:1px solid var(--border-color);border-radius:12px;padding:14px;text-align:center;"><i class="fas ${s.icon}" style="color:${s.color};font-size:1.3rem;margin-bottom:6px;display:block;"></i><div style="font-size:1.3rem;font-weight:700;">${s.value}</div><div style="color:var(--text-muted);font-size:0.75rem;">${s.label}</div></div>`).join('');
            }
        }
    }
}

function deleteTestimonialLocal(id) {
    const testimonials = JSON.parse(localStorage.getItem('testimonials') || '[]').filter(t => t.id !== id);
    localStorage.setItem('testimonials', JSON.stringify(testimonials));
    renderReviews();
}

async function approveReview(id) {
    const token = AdminAuth.getToken();
    await fetch(`/api/content?type=reviews&id=${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token }, body: JSON.stringify({ status: 'approved' }) });
    addActivityLog('Ulasan', `Setujui ulasan ${id}`);
    renderReviews();
}

async function rejectReview(id) {
    const token = AdminAuth.getToken();
    await fetch(`/api/content?type=reviews&id=${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token }, body: JSON.stringify({ status: 'rejected' }) });
    addActivityLog('Ulasan', `Tolak ulasan ${id}`);
    renderReviews();
}

async function deleteReview(id) {
    const confirmed = await Swal.fire({ title: 'Hapus ulasan?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya', cancelButtonText: 'Batal', background: '#1a1a2e', color: '#fff', confirmButtonColor: '#ef4444' });
    if (!confirmed.isConfirmed) return;
    const token = AdminAuth.getToken();
    await fetch(`/api/content?type=reviews&id=${id}`, { method: 'DELETE', headers: { 'X-Admin-Token': token } });
    addActivityLog('Ulasan', `Hapus ulasan ${id}`);
    renderReviews();
}

function filterReviews(val) { renderReviews(val.toLowerCase()); }

function exportReviews() {
    Swal.fire({ icon: 'info', title: 'Export Reviews', text: 'Fitur export reviews membutuhkan koneksi MongoDB.', background: '#1a1a2e', color: '#fff' });
}

function updateReviewsBadge() {
    // Akan diupdate saat renderReviews dipanggil
}

// ============================================================
// EXPOSE SEMUA FUNGSI BARU KE WINDOW
// ============================================================
window.renderNewsletter = renderNewsletter;
window.filterNewsletter = filterNewsletter;
window.exportNewsletter = exportNewsletter;
window.clearNewsletter = clearNewsletter;
window.deleteNewsletterSubscriber = deleteNewsletterSubscriber;
window.renderFlashSale = renderFlashSale;
window.startFlashSale = startFlashSale;
window.stopFlashSale = stopFlashSale;
window.stopFlashSaleById = stopFlashSaleById;
window.deleteFlashSaleById = deleteFlashSaleById;
window.renderReviews = renderReviews;
window.approveReview = approveReview;
window.rejectReview = rejectReview;
window.deleteReview = deleteReview;
window.deleteTestimonialLocal = deleteTestimonialLocal;
window.filterReviews = filterReviews;
window.exportReviews = exportReviews;
window.changePassword = changePassword;

// ============================================================
// FITUR ADMIN: FUNGSI YANG HILANG — DITAMBAHKAN KEMBALI
// ============================================================

async function showDailySummary() {
    const token = AdminAuth.getToken();
    try {
        const res = await fetch('/api/orders', { headers: { 'X-Admin-Token': token } });
        const { orders } = await res.json();
        const today = new Date().toISOString().split('T')[0];
        const todayOrders = (orders || []).filter(o => o.createdAt?.startsWith(today));
        const todayRevenue = todayOrders.reduce((s, o) => s + (o.total || 0), 0);
        const completed = todayOrders.filter(o => o.status === 'completed').length;
        const pending = todayOrders.filter(o => o.status === 'pending').length;

        Swal.fire({
            title: `📊 Ringkasan Hari Ini`,
            html: `<div style="text-align:left;font-size:0.95rem;line-height:2;">
                <p>💰 <strong>Revenue:</strong> ${Utils.formatRupiah(todayRevenue)}</p>
                <p>🛒 <strong>Total Order:</strong> ${todayOrders.length}</p>
                <p>✅ <strong>Selesai:</strong> ${completed}</p>
                <p>⏳ <strong>Pending:</strong> ${pending}</p>
                <p>📅 <strong>Tanggal:</strong> ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>`,
            icon: 'info', confirmButtonText: 'OK', background: '#1a1a2e', color: '#fff'
        });
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Gagal', text: e.message, background: '#1a1a2e', color: '#fff' });
    }
}

async function markAllPendingCompleted() {
    const confirmed = await Swal.fire({
        title: 'Tandai Semua Pending → Selesai?',
        icon: 'question', showCancelButton: true,
        confirmButtonText: 'Ya', cancelButtonText: 'Batal',
        background: '#1a1a2e', color: '#fff'
    });
    if (!confirmed.isConfirmed) return;

    const token = AdminAuth.getToken();
    try {
        const res = await fetch('/api/orders?status=pending', { headers: { 'X-Admin-Token': token } });
        const { orders } = await res.json();
        if (!orders?.length) { Swal.fire({ icon: 'info', title: 'Tidak ada order pending', background: '#1a1a2e', color: '#fff' }); return; }

        await Promise.all(orders.map(o =>
            fetch(`/api/orders?id=${o._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
                body: JSON.stringify({ status: 'completed' })
            })
        ));
        addActivityLog('Pesanan', `Tandai ${orders.length} order pending → selesai`);
        renderOrdersTable(); updateStats();
        Swal.fire({ icon: 'success', title: `${orders.length} order ditandai selesai!`, background: '#1a1a2e', color: '#fff', timer: 2000, showConfirmButton: false });
    } catch (e) { Swal.fire({ icon: 'error', title: 'Gagal', text: e.message, background: '#1a1a2e', color: '#fff' }); }
}

async function globalSearch(query) {
    if (!query || query.length < 2) return;
    const token = AdminAuth.getToken();
    const q = query.toLowerCase();
    try {
        const [orderRes, productRes] = await Promise.all([
            fetch('/api/orders', { headers: { 'X-Admin-Token': token } }).then(r => r.json()).catch(() => ({ orders: [] })),
            fetch('/api/products', { headers: { 'X-Admin-Token': token } }).then(r => r.json()).catch(() => ({ products: [] }))
        ]);
        const orders = (orderRes.orders || []).filter(o => o.orderId?.toLowerCase().includes(q) || o.userName?.toLowerCase().includes(q)).slice(0, 5);
        const products = (productRes.products || []).filter(p => p.name?.toLowerCase().includes(q)).slice(0, 5);

        if (!orders.length && !products.length) {
            Swal.fire({ icon: 'info', title: 'Tidak ditemukan', text: `Tidak ada hasil untuk "${query}"`, background: '#1a1a2e', color: '#fff' }); return;
        }
        let html = '';
        if (orders.length) {
            html += `<h4 style="color:var(--primary);margin-bottom:8px;">📦 Pesanan</h4>`;
            html += orders.map(o => `<div style="padding:8px;background:var(--bg-glass);border-radius:8px;margin-bottom:6px;cursor:pointer;font-size:0.85rem;" onclick="showSection('orders')">${o.orderId} — ${o.userName||'-'} — ${Utils.formatRupiah(o.total)}</div>`).join('');
        }
        if (products.length) {
            html += `<h4 style="color:var(--accent);margin:12px 0 8px;">🛍️ Produk</h4>`;
            html += products.map(p => `<div style="padding:8px;background:var(--bg-glass);border-radius:8px;margin-bottom:6px;cursor:pointer;font-size:0.85rem;" onclick="showSection('products')">${p.name} — ${Utils.formatRupiah(p.price)}</div>`).join('');
        }
        Swal.fire({ title: `Hasil: "${query}"`, html, background: '#1a1a2e', color: '#fff', confirmButtonText: 'Tutup' });
    } catch {}
}

async function exportOrdersJSON() {
    const token = AdminAuth.getToken();
    try {
        const res = await fetch('/api/orders', { headers: { 'X-Admin-Token': token } });
        const { orders } = await res.json();
        if (!orders?.length) { Swal.fire({ icon: 'info', title: 'Kosong', background: '#1a1a2e', color: '#fff' }); return; }
        const blob = new Blob([JSON.stringify(orders, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `pesanan-${new Date().toISOString().split('T')[0]}.json`;
        a.click(); URL.revokeObjectURL(a.href);
        addActivityLog('Export', `Export ${orders.length} pesanan ke JSON`);
    } catch (e) { Swal.fire({ icon: 'error', title: 'Gagal', text: e.message, background: '#1a1a2e', color: '#fff' }); }
}

let _orderPollingInterval = null;
async function startOrderPolling() {
    if (_orderPollingInterval) return;
    let _lastOrderCount = 0;
    const token = AdminAuth.getToken();

    async function checkNewOrders() {
        try {
            const res = await fetch('/api/orders', { headers: { 'X-Admin-Token': token } });
            if (!res.ok) return;
            const { orders } = await res.json();
            const count = orders?.length || 0;
            if (_lastOrderCount > 0 && count > _lastOrderCount) {
                const newCount = count - _lastOrderCount;
                if (typeof Utils !== 'undefined') Utils.showToast(`🛒 ${newCount} pesanan baru!`, 'success');
                const ordersSection = document.getElementById('orders-section');
                if (ordersSection?.style.display !== 'none') renderOrdersTable();
                updateStats();
            }
            _lastOrderCount = count;
        } catch {}
    }
    await checkNewOrders();
    _orderPollingInterval = setInterval(checkNewOrders, 30000);
}

async function sendOrderNotifWA(orderId) {
    const token = AdminAuth.getToken();
    try {
        const res = await fetch('/api/orders', { headers: { 'X-Admin-Token': token } });
        const { orders } = await res.json();
        const order = orders?.find(o => o._id === orderId || o.orderId === orderId);
        if (!order) { Swal.fire({ icon: 'error', title: 'Order tidak ditemukan', background: '#1a1a2e', color: '#fff' }); return; }
        const msg = `Halo ${order.userName || 'Pelanggan'}! 👋\n\nPesanan kamu di ALFA HOSTING:\n📋 Order ID: ${order.orderId}\n💰 Total: ${Utils.formatRupiah(order.total)}\n✅ Status: ${order.status === 'completed' ? 'SELESAI' : 'DIPROSES'}\n\nTerima kasih! 🚀`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    } catch (e) { Swal.fire({ icon: 'error', title: 'Gagal', text: e.message, background: '#1a1a2e', color: '#fff' }); }
}

// Expose semua fungsi yang hilang
window.showDailySummary = showDailySummary;
window.markAllPendingCompleted = markAllPendingCompleted;
window.globalSearch = globalSearch;
window.exportOrdersJSON = exportOrdersJSON;
window.startOrderPolling = startOrderPolling;
window.sendOrderNotifWA = sendOrderNotifWA;
// ============================================================
async function loadPromoSettings() {
    const token = AdminAuth.getToken();
    try {
        const res = await fetch('/api/settings', { headers: { 'X-Admin-Token': token } });
        if (res.ok) {
            const { settings } = await res.json();
            const code = settings.promo_code || '';
            const discount = settings.promo_discount || '';
            const message = settings.promo_message || '';
            const active = settings.promo_active === 'true';

            const codeEl = document.getElementById('promo-code-input');
            const discEl = document.getElementById('promo-discount-input');
            const msgEl = document.getElementById('promo-message-input');
            const badge = document.getElementById('promo-active-badge');

            if (codeEl) codeEl.value = code !== '••••••••' ? code : '';
            if (discEl) discEl.value = discount !== '••••••••' ? discount : '';
            if (msgEl) msgEl.value = message !== '••••••••' ? message : '';
            if (badge) {
                badge.textContent = active ? '🟢 AKTIF' : '🔴 NONAKTIF';
                badge.style.background = active ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)';
                badge.style.color = active ? 'var(--accent)' : 'var(--danger)';
            }
        }
    } catch {}
}

async function savePromoSettings() {
    const code = document.getElementById('promo-code-input')?.value.trim().toUpperCase();
    const discount = document.getElementById('promo-discount-input')?.value.trim();
    const message = document.getElementById('promo-message-input')?.value.trim();

    if (!code) { Swal.fire({ icon: 'warning', title: 'Isi kode promo!', background: '#1a1a2e', color: '#fff' }); return; }

    await syncSettingsToDB({
        ...(code ? { promo_code: code } : {}),
        ...(discount ? { promo_discount: discount } : {}),
        ...(message ? { promo_message: message } : {})
    });

    // Update PROMO_CODES di localStorage untuk website
    const promos = JSON.parse(localStorage.getItem('promo_codes') || '{}');
    if (code && discount) promos[code] = parseInt(discount) / 100;
    localStorage.setItem('promo_codes', JSON.stringify(promos));

    addActivityLog('Pengaturan', `Simpan promo spesial: ${code} (${discount}%)`);
    Swal.fire({ icon: 'success', title: 'Promo disimpan!', text: `Kode: ${code} — Diskon: ${discount}%`, background: '#1a1a2e', color: '#fff', timer: 2000, showConfirmButton: false });
    loadPromoSettings();
}

async function togglePromoActive(active) {
    await syncSettingsToDB({ promo_active: active.toString() });

    // Sync ke localStorage untuk website
    localStorage.setItem('promo_active', active.toString());

    const badge = document.getElementById('promo-active-badge');
    if (badge) {
        badge.textContent = active ? '🟢 AKTIF' : '🔴 NONAKTIF';
        badge.style.background = active ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)';
        badge.style.color = active ? 'var(--accent)' : 'var(--danger)';
    }

    addActivityLog('Pengaturan', `${active ? 'Aktifkan' : 'Nonaktifkan'} promo spesial`);
    Swal.fire({
        icon: active ? 'success' : 'info',
        title: active ? '🟢 Promo Diaktifkan!' : '🔴 Promo Dinonaktifkan',
        text: active ? 'Promo spesial sekarang aktif di website.' : 'Promo spesial dinonaktifkan.',
        background: '#1a1a2e', color: '#fff', timer: 1500, showConfirmButton: false
    });
}

// ============================================================
// FITUR: LUPA PASSWORD ADMIN
// ============================================================
async function forgotPassword() {
    const { value: username } = await Swal.fire({
        title: '🔑 Lupa Password',
        html: `
            <p style="color:var(--text-secondary);margin-bottom:15px;font-size:0.9rem;">
                Masukkan username admin kamu. Jika cocok dengan yang tersimpan di database, 
                kamu akan mendapat instruksi reset password.
            </p>
            <input id="forgot-username" class="swal2-input" placeholder="Username admin" autocomplete="off">
        `,
        confirmButtonText: 'Kirim',
        cancelButtonText: 'Batal',
        showCancelButton: true,
        background: '#1a1a2e',
        color: '#fff',
        preConfirm: () => {
            const val = document.getElementById('forgot-username').value.trim();
            if (!val) { Swal.showValidationMessage('Username harus diisi!'); return false; }
            return val;
        }
    });

    if (!username) return;

    try {
        const res = await fetch('/api/admin-auth?action=check-username', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await res.json();

        if (res.ok && data.exists) {
            Swal.fire({
                title: '✅ Username Ditemukan',
                html: `
                    <p style="color:var(--text-secondary);margin-bottom:15px;">
                        Username <strong>${username}</strong> ditemukan. 
                        Untuk reset password, gunakan salah satu cara berikut:
                    </p>
                    <div style="text-align:left;background:var(--bg-glass);border-radius:10px;padding:15px;font-size:0.85rem;">
                        <p style="margin-bottom:10px;"><strong>Cara 1 — Via Postman/API:</strong></p>
                        <code style="background:#1a1a2e;padding:8px;border-radius:6px;display:block;font-size:0.75rem;word-break:break-all;">
                            POST /api/admin-auth?action=reset-password<br>
                            Body: {"username":"${username}","newPassword":"PasswordBaru123!"}
                        </code>
                        <p style="margin-top:10px;margin-bottom:10px;"><strong>Cara 2 — Hubungi developer:</strong></p>
                        <p>Reset langsung di MongoDB Atlas → collection admins → hapus dokumen → setup ulang.</p>
                    </div>`,
                background: '#1a1a2e',
                color: '#fff',
                confirmButtonText: 'Mengerti'
            });
        } else {
            Swal.fire({ icon: 'error', title: 'Username tidak ditemukan', text: 'Pastikan username yang dimasukkan benar.', background: '#1a1a2e', color: '#fff' });
        }
    } catch {
        // Fallback: tampilkan instruksi manual
        Swal.fire({
            title: '🔑 Reset Password Manual',
            html: `
                <p style="color:var(--text-secondary);margin-bottom:15px;font-size:0.9rem;">
                    Untuk reset password admin, gunakan cara berikut:
                </p>
                <div style="text-align:left;background:var(--bg-glass);border-radius:10px;padding:15px;font-size:0.82rem;">
                    <p><strong>Via Browser Console (F12):</strong></p>
                    <code style="background:#0a0a0f;padding:8px;border-radius:6px;display:block;margin-top:8px;word-break:break-all;font-size:0.72rem;">
fetch('/api/admin-auth?action=setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'PasswordBaru123!'})}).then(r=>r.json()).then(console.log)
                    </code>
                    <p style="margin-top:10px;color:var(--warning);font-size:0.8rem;">⚠️ Hanya berhasil jika belum ada admin di database.</p>
                </div>`,
            background: '#1a1a2e',
            color: '#fff',
            confirmButtonText: 'Mengerti'
        });
    }
}

// Tambahkan endpoint check-username ke admin-auth (dipanggil dari forgotPassword)
// Endpoint ini sudah ada di api/admin-auth.js sebagai action=check

// ============================================================
// EXPOSE FUNGSI BARU KE WINDOW
// ============================================================
window.savePromoSettings = savePromoSettings;
window.togglePromoActive = togglePromoActive;
window.loadPromoSettings = loadPromoSettings;
window.forgotPassword = forgotPassword;
window.showDailySummary = showDailySummary;
window.markAllPendingCompleted = markAllPendingCompleted;
window.globalSearch = globalSearch;
window.exportOrdersCSV = exportOrdersCSV;
window.exportOrdersJSON = exportOrdersJSON;
window.deleteNewsletterSubscriber = deleteNewsletterSubscriber;
window.updateNewsletterBadge = updateNewsletterBadge;
window.deleteTestimonialLocal = deleteTestimonialLocal;
