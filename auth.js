/**
 * ALFA HOSTING — Auth & Transaksi Client
 * Handles: Google Sign-In, Email Login/Register, Riwayat Transaksi
 */

// ============================================================
// DEVICE FINGERPRINT — untuk batasi 1 device = 1 akun
// ============================================================
function getDeviceFingerprint() {
    // Cek apakah sudah ada fingerprint tersimpan
    let fp = localStorage.getItem('device_fp');
    if (fp) return fp;

    // Generate fingerprint dari karakteristik device
    const components = [
        navigator.userAgent,
        navigator.language,
        navigator.platform,
        screen.width + 'x' + screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || 0,
        navigator.deviceMemory || 0
    ].join('|');

    // Hash sederhana
    let hash = 0;
    for (let i = 0; i < components.length; i++) {
        const char = components.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    fp = 'fp_' + Math.abs(hash).toString(16) + '_' + Date.now().toString(36);
    localStorage.setItem('device_fp', fp);
    return fp;
}
const AuthState = {
    user: null,
    token: null,
    transactions: [],
    currentPage: 1,
    currentFilter: 'all',

    load() {
        this.token = localStorage.getItem('auth_token');
        const saved = localStorage.getItem('auth_user');
        if (saved) {
            try { this.user = JSON.parse(saved); } catch { this.user = null; }
        }
    },

    save(token, user) {
        this.token = token;
        this.user = user;
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user', JSON.stringify(user));
    },

    clear() {
        this.token = null;
        this.user = null;
        this.transactions = [];
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
    },

    isLoggedIn() {
        return !!(this.token && this.user);
    }
};

// ============================================================
// API HELPERS
// ============================================================
async function authFetch(url, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (AuthState.token) headers['Authorization'] = `Bearer ${AuthState.token}`;
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
}

// ============================================================
// GOOGLE SIGN-IN
// ============================================================
let googleInitialized = false;

function initGoogleSignIn() {
    const clientId = window.GOOGLE_CLIENT_ID || '';
    if (!clientId || !window.google?.accounts?.id) return;
    if (googleInitialized) return;
    googleInitialized = true;

    google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCallback,
        auto_select: false,
        cancel_on_tap_outside: true
    });
}

async function handleGoogleCallback(response) {
    showAuthLoading(true);
    try {
        const { ok, data } = await authFetch('/api/auth?action=google', {
            method: 'POST',
            body: JSON.stringify({ idToken: response.credential, deviceFingerprint: getDeviceFingerprint() })
        });

        if (!ok) throw new Error(data.error || 'Login Google gagal');

        AuthState.save(data.token, data.user);
        onLoginSuccess();
    } catch (err) {
        showAuthError(err.message);
    } finally {
        showAuthLoading(false);
    }
}

function signInWithGoogle() {
    initGoogleSignIn();
    if (!window.google?.accounts?.id) {
        showAuthError('Google Sign-In tidak tersedia. Pastikan GOOGLE_CLIENT_ID sudah diset.');
        return;
    }
    google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // Fallback: render button
            const container = document.getElementById('google-signin-btn');
            if (container) {
                container.innerHTML = '';
                google.accounts.id.renderButton(container, {
                    theme: 'outline', size: 'large', width: '100%', text: 'continue_with'
                });
            }
        }
    });
}

// ============================================================
// EMAIL LOGIN / REGISTER
// ============================================================
async function loginWithEmail() {
    const email = document.getElementById('login-email')?.value?.trim();
    const password = document.getElementById('login-password')?.value;

    if (!email || !password) { showAuthError('Email dan password harus diisi'); return; }

    showAuthLoading(true);
    try {
        const { ok, data } = await authFetch('/api/auth?action=login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        if (!ok) throw new Error(data.error || 'Login gagal');
        AuthState.save(data.token, data.user);
        onLoginSuccess();
    } catch (err) {
        showAuthError(err.message);
    } finally {
        showAuthLoading(false);
    }
}

async function registerWithEmail() {
    const name = document.getElementById('reg-name')?.value?.trim();
    const email = document.getElementById('reg-email')?.value?.trim();
    const password = document.getElementById('reg-password')?.value;

    if (!name || !email || !password) { showAuthError('Semua field harus diisi'); return; }
    if (password.length < 8) { showAuthError('Password minimal 8 karakter'); return; }

    showAuthLoading(true);
    try {
        const { ok, data } = await authFetch('/api/auth?action=register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password, deviceFingerprint: getDeviceFingerprint() })
        });
        if (!ok) {
            if (data.code === 'DEVICE_ALREADY_REGISTERED') {
                showAuthError('⚠️ Perangkat ini sudah digunakan untuk daftar akun lain. 1 perangkat hanya bisa 1 akun.');
            } else {
                showAuthError(data.error || 'Registrasi gagal');
            }
            return;
        }
        AuthState.save(data.token, data.user);
        onLoginSuccess();
    } catch (err) {
        showAuthError(err.message);
    } finally {
        showAuthLoading(false);
    }
}

// ============================================================
// SESSION CHECK
// ============================================================
async function checkSession() {
    AuthState.load();
    if (!AuthState.token) return;

    try {
        const { ok, data } = await authFetch('/api/auth?action=me');
        if (ok && data.user) {
            AuthState.user = data.user;
            localStorage.setItem('auth_user', JSON.stringify(data.user));
            updateHeaderUI();
        } else {
            AuthState.clear();
            updateHeaderUI();
        }
    } catch {
        // Offline atau server error — tetap pakai cached user
        if (AuthState.user) updateHeaderUI();
    }
}

// ============================================================
// LOGOUT
// ============================================================
async function logoutUser() {
    try {
        await authFetch('/api/auth?action=logout', { method: 'POST' });
    } catch { /* ignore */ }

    AuthState.clear();
    updateHeaderUI();
    document.getElementById('history-modal')?.classList.remove('active');

    if (window.google?.accounts?.id) {
        google.accounts.id.disableAutoSelect();
    }

    if (typeof Utils !== 'undefined') {
        Utils.showToast('Berhasil keluar 👋');
    }
}

// ============================================================
// UI HELPERS
// ============================================================
function onLoginSuccess() {
    closeAuthModal();
    updateHeaderUI();
    if (typeof Utils !== 'undefined') {
        Utils.showToast(`Selamat datang, ${AuthState.user.name}! 👋`);
    }
}

function updateHeaderUI() {
    const btnLogin = document.getElementById('btn-login-header');
    const btnHistory = document.getElementById('btn-history-header');
    const headerUsername = document.getElementById('header-username');

    if (AuthState.isLoggedIn()) {
        if (btnLogin) btnLogin.style.display = 'none';
        if (btnHistory) btnHistory.style.display = 'flex';
        if (headerUsername) {
            const firstName = AuthState.user.name?.split(' ')[0] || 'Akun';
            headerUsername.textContent = firstName;
        }
    } else {
        if (btnLogin) btnLogin.style.display = 'flex';
        if (btnHistory) btnHistory.style.display = 'none';
    }
}

function openAuthModal() {
    document.getElementById('auth-modal')?.classList.add('active');
    initGoogleSignIn();
    clearAuthForm();
}

function closeAuthModal() {
    document.getElementById('auth-modal')?.classList.remove('active');
}

function switchAuthTab(tab) {
    const isLogin = tab === 'login';
    document.getElementById('form-login').style.display = isLogin ? 'block' : 'none';
    document.getElementById('form-register').style.display = isLogin ? 'none' : 'block';
    document.getElementById('tab-login').style.background = isLogin ? 'var(--primary)' : 'transparent';
    document.getElementById('tab-login').style.color = isLogin ? '#fff' : 'var(--text-secondary)';
    document.getElementById('tab-register').style.background = isLogin ? 'transparent' : 'var(--primary)';
    document.getElementById('tab-register').style.color = isLogin ? 'var(--text-secondary)' : '#fff';
    clearAuthError();
}

function showAuthError(msg) {
    const el = document.getElementById('auth-error');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function clearAuthError() {
    const el = document.getElementById('auth-error');
    if (el) { el.textContent = ''; el.style.display = 'none'; }
}

function clearAuthForm() {
    ['login-email','login-password','reg-name','reg-email','reg-password'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    clearAuthError();
}

function showAuthLoading(show) {
    const btns = document.querySelectorAll('#auth-modal .btn-primary');
    btns.forEach(btn => {
        btn.disabled = show;
        if (show) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    });
}

// ============================================================
// RIWAYAT TRANSAKSI
// ============================================================
async function openHistoryModal() {
    if (!AuthState.isLoggedIn()) {
        openAuthModal();
        return;
    }

    document.getElementById('history-modal')?.classList.add('active');
    renderUserInfoCard();
    await loadTransactions(1, 'all');
    await loadUserStats();
}

function renderUserInfoCard() {
    const u = AuthState.user;
    if (!u) return;

    document.getElementById('user-display-name').textContent = u.name || 'User';
    document.getElementById('user-display-email').textContent = u.email || '';

    const avatar = document.getElementById('user-avatar');
    const placeholder = document.getElementById('user-avatar-placeholder');
    if (u.picture) {
        avatar.src = u.picture;
        avatar.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        avatar.style.display = 'none';
        placeholder.style.display = 'flex';
    }
}

async function loadUserStats() {
    try {
        const { ok, data } = await authFetch('/api/account?type=profile');
        if (!ok) return;

        const { stats } = data;
        const fmt = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

        document.getElementById('user-total-spent').textContent = fmt(stats.totalSpent || 0);

        const statsRow = document.getElementById('user-stats-row');
        if (statsRow) {
            statsRow.innerHTML = [
                { icon: 'fa-shopping-bag', label: 'Total Order', value: stats.totalOrders || 0, color: 'var(--primary)' },
                { icon: 'fa-check-circle', label: 'Selesai', value: stats.completedOrders || 0, color: 'var(--accent)' },
                { icon: 'fa-star', label: 'Produk Favorit', value: stats.topProducts?.[0]?.name || '-', color: 'var(--warning)', small: true }
            ].map(s => `
                <div style="background:var(--bg-glass);border:1px solid var(--border-color);border-radius:12px;padding:14px;text-align:center;">
                    <i class="fas ${s.icon}" style="color:${s.color};font-size:1.3rem;margin-bottom:8px;display:block;"></i>
                    <div style="font-weight:700;font-size:${s.small ? '0.85rem' : '1.3rem'};">${s.value}</div>
                    <div style="color:var(--text-muted);font-size:0.75rem;">${s.label}</div>
                </div>
            `).join('');
        }
    } catch { /* ignore */ }
}

async function loadTransactions(page = 1, filter = 'all') {
    AuthState.currentPage = page;
    AuthState.currentFilter = filter;

    const listEl = document.getElementById('transaction-list');
    if (!listEl) return;

    listEl.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fas fa-spinner fa-spin" style="font-size:2rem;"></i><p style="margin-top:10px;">Memuat transaksi...</p></div>`;

    try {
        let url = `/api/account?type=transactions&page=${page}&limit=10`;
        if (filter !== 'all') url += `&status=${filter}`;

        const { ok, data } = await authFetch(url);
        if (!ok) throw new Error(data.error || 'Gagal memuat transaksi');

        AuthState.transactions = data.transactions || [];
        renderTransactionList(AuthState.transactions);
        renderPagination(data.pagination);
    } catch (err) {
        listEl.innerHTML = `<div style="text-align:center;padding:40px;color:var(--danger);"><i class="fas fa-exclamation-circle" style="font-size:2rem;margin-bottom:10px;display:block;"></i>${err.message}</div>`;
    }
}

function renderTransactionList(txns) {
    const listEl = document.getElementById('transaction-list');
    if (!listEl) return;

    if (txns.length === 0) {
        listEl.innerHTML = `
            <div style="text-align:center;padding:50px 20px;color:var(--text-muted);">
                <i class="fas fa-receipt" style="font-size:3rem;margin-bottom:15px;display:block;opacity:0.3;"></i>
                <h4 style="margin-bottom:8px;">Belum ada transaksi</h4>
                <p style="font-size:0.9rem;">Transaksi kamu akan muncul di sini setelah checkout</p>
                <button onclick="document.getElementById('history-modal').classList.remove('active')" class="btn btn-primary btn-sm" style="margin-top:15px;">Mulai Belanja</button>
            </div>`;
        return;
    }

    const fmt = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
    const statusConfig = {
        pending:   { label: 'Menunggu Pembayaran', color: 'var(--warning)',  icon: 'fa-clock' },
        completed: { label: 'Selesai',              color: 'var(--accent)',   icon: 'fa-check-circle' },
        cancelled: { label: 'Dibatalkan',           color: 'var(--danger)',   icon: 'fa-times-circle' }
    };

    listEl.innerHTML = txns.map(txn => {
        const s = statusConfig[txn.status] || statusConfig.pending;
        const date = new Date(txn.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const itemNames = txn.items?.slice(0, 2).map(i => i.name).join(', ') + (txn.items?.length > 2 ? ` +${txn.items.length - 2} lainnya` : '');

        return `
        <div style="background:var(--bg-glass);border:1px solid var(--border-color);border-radius:14px;padding:16px;transition:all 0.2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border-color)'">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                        <code style="font-size:0.8rem;background:rgba(99,102,241,0.1);color:var(--primary);padding:3px 8px;border-radius:6px;">${txn.orderId}</code>
                        <span style="color:${s.color};font-size:0.8rem;font-weight:600;"><i class="fas ${s.icon}"></i> ${s.label}</span>
                    </div>
                    <div style="font-weight:600;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${itemNames || 'Produk tidak tersedia'}</div>
                    <div style="color:var(--text-muted);font-size:0.8rem;"><i class="fas fa-calendar" style="margin-right:5px;"></i>${date}</div>
                    ${txn.promoCode ? `<div style="color:var(--accent);font-size:0.8rem;margin-top:4px;"><i class="fas fa-tag"></i> Promo: ${txn.promoCode} (hemat ${fmt(txn.discount || 0)})</div>` : ''}
                </div>
                <div style="text-align:right;flex-shrink:0;">
                    <div style="font-size:1.15rem;font-weight:800;color:var(--accent);">${fmt(txn.total)}</div>
                    <div style="color:var(--text-muted);font-size:0.75rem;">${txn.items?.length || 0} item</div>
                    ${txn.status === 'pending' ? `<a href="https://wa.me/6282226769163?text=${encodeURIComponent('Halo, saya ingin konfirmasi pembayaran order ' + txn.orderId)}" target="_blank" style="display:inline-block;margin-top:6px;font-size:0.75rem;color:var(--primary);text-decoration:none;"><i class="fab fa-whatsapp"></i> Konfirmasi</a>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

function renderPagination(pagination) {
    const el = document.getElementById('txn-pagination');
    if (!el || !pagination || pagination.pages <= 1) { if (el) el.innerHTML = ''; return; }

    const { page, pages } = pagination;
    let html = '';

    if (page > 1) html += `<button onclick="loadTransactions(${page-1}, '${AuthState.currentFilter}')" style="padding:8px 14px;border:1px solid var(--border-color);background:var(--bg-glass);color:var(--text-primary);border-radius:8px;cursor:pointer;"><i class="fas fa-chevron-left"></i></button>`;

    for (let i = Math.max(1, page-2); i <= Math.min(pages, page+2); i++) {
        html += `<button onclick="loadTransactions(${i}, '${AuthState.currentFilter}')" style="padding:8px 14px;border:1px solid ${i===page ? 'var(--primary)' : 'var(--border-color)'};background:${i===page ? 'var(--primary)' : 'var(--bg-glass)'};color:${i===page ? '#fff' : 'var(--text-primary)'};border-radius:8px;cursor:pointer;font-weight:${i===page ? '700' : '400'};">${i}</button>`;
    }

    if (page < pages) html += `<button onclick="loadTransactions(${page+1}, '${AuthState.currentFilter}')" style="padding:8px 14px;border:1px solid var(--border-color);background:var(--bg-glass);color:var(--text-primary);border-radius:8px;cursor:pointer;"><i class="fas fa-chevron-right"></i></button>`;

    el.innerHTML = html;
}

function filterTransactions(filter) {
    loadTransactions(1, filter);
}

// ============================================================
// SIMPAN TRANSAKSI KE DATABASE SAAT CHECKOUT
// ============================================================
async function saveTransactionToDB(orderId, cart, total, promoCode, discount) {
    if (!AuthState.isLoggedIn()) return; // Hanya simpan jika user login

    try {
        await authFetch('/api/account?type=transactions', {
            method: 'POST',
            body: JSON.stringify({
                orderId,
                items: cart,
                total,
                promoCode: promoCode || null,
                discount: discount || 0,
                paymentMethod: 'pakasir',
                status: 'pending'
            })
        });
    } catch (err) {
        console.warn('Gagal simpan transaksi ke DB:', err.message);
        // Tidak throw — jangan ganggu proses checkout
    }
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    // Set Google Client ID dari meta tag atau config
    const metaGoogleId = document.querySelector('meta[name="google-client-id"]');
    if (metaGoogleId) window.GOOGLE_CLIENT_ID = metaGoogleId.content;

    // Cek session yang tersimpan
    await checkSession();

    // Close modal on overlay click
    document.getElementById('auth-modal')?.addEventListener('click', function(e) {
        if (e.target === this) closeAuthModal();
    });
    document.getElementById('history-modal')?.addEventListener('click', function(e) {
        if (e.target === this) this.classList.remove('active');
    });
});

// Expose ke window
window.signInWithGoogle = signInWithGoogle;
window.loginWithEmail = loginWithEmail;
window.registerWithEmail = registerWithEmail;
window.logoutUser = logoutUser;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.switchAuthTab = switchAuthTab;
window.openHistoryModal = openHistoryModal;
window.filterTransactions = filterTransactions;
window.loadTransactions = loadTransactions;
window.saveTransactionToDB = saveTransactionToDB;
window.AuthState = AuthState;

// ============================================================
// LUPA PASSWORD USER
// ============================================================
let _forgotEmail = '';

function openForgotPasswordModal() {
    // Tutup modal login dulu
    closeAuthModal();
    // Reset state
    _forgotEmail = '';
    document.getElementById('forgot-step-1').style.display = 'block';
    document.getElementById('forgot-step-2').style.display = 'none';
    const emailEl = document.getElementById('forgot-email');
    const tokenEl = document.getElementById('forgot-token');
    const newPassEl = document.getElementById('forgot-new-password');
    const confEl = document.getElementById('forgot-confirm-password');
    const errEl = document.getElementById('forgot-error');
    if (emailEl) emailEl.value = '';
    if (tokenEl) tokenEl.value = '';
    if (newPassEl) newPassEl.value = '';
    if (confEl) confEl.value = '';
    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
    document.getElementById('forgot-password-modal')?.classList.add('active');
}

function closeForgotPasswordModal() {
    document.getElementById('forgot-password-modal')?.classList.remove('active');
}

async function requestPasswordReset() {
    const email = document.getElementById('forgot-email')?.value?.trim();
    const errEl = document.getElementById('forgot-error');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (errEl) { errEl.textContent = 'Masukkan email yang valid'; errEl.style.display = 'block'; }
        return;
    }

    const btn = document.querySelector('#forgot-step-1 .btn-primary');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...'; }

    try {
        const res = await fetch('/api/reset-password?action=request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();

        if (data.success) {
            _forgotEmail = email;

            // Tampilkan token langsung (karena tidak ada email server)
            if (data.token) {
                // Tampilkan token di UI untuk user copy
                document.getElementById('forgot-step-1').style.display = 'none';
                document.getElementById('forgot-step-2').style.display = 'block';

                const tokenEl = document.getElementById('forgot-token');
                if (tokenEl) tokenEl.value = data.token;

                const descEl = document.getElementById('forgot-modal-desc');
                if (descEl) descEl.textContent = `Kode reset untuk ${email} sudah dibuat. Masukkan password baru kamu.`;

                if (errEl) {
                    errEl.style.color = 'var(--accent)';
                    errEl.textContent = '✅ Kode reset berhasil dibuat. Masukkan di kolom di atas.';
                    errEl.style.display = 'block';
                }
            } else {
                if (errEl) {
                    errEl.style.color = 'var(--accent)';
                    errEl.textContent = data.message || 'Jika email terdaftar, kode reset sudah dikirim.';
                    errEl.style.display = 'block';
                }
            }
        } else {
            if (errEl) { errEl.style.color = 'var(--danger)'; errEl.textContent = data.error || 'Gagal memproses permintaan'; errEl.style.display = 'block'; }
        }
    } catch (err) {
        if (errEl) { errEl.style.color = 'var(--danger)'; errEl.textContent = 'Gagal terhubung ke server'; errEl.style.display = 'block'; }
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Kirim Kode Reset'; }
    }
}

async function submitPasswordReset() {
    const token = document.getElementById('forgot-token')?.value?.trim();
    const newPassword = document.getElementById('forgot-new-password')?.value;
    const confirmPassword = document.getElementById('forgot-confirm-password')?.value;
    const errEl = document.getElementById('forgot-error');

    if (!token) { if (errEl) { errEl.style.color = 'var(--danger)'; errEl.textContent = 'Masukkan kode reset'; errEl.style.display = 'block'; } return; }
    if (!newPassword || newPassword.length < 8) { if (errEl) { errEl.style.color = 'var(--danger)'; errEl.textContent = 'Password minimal 8 karakter'; errEl.style.display = 'block'; } return; }
    if (newPassword !== confirmPassword) { if (errEl) { errEl.style.color = 'var(--danger)'; errEl.textContent = 'Password tidak cocok'; errEl.style.display = 'block'; } return; }

    const btn = document.querySelector('#forgot-step-2 .btn-primary');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...'; }

    try {
        const res = await fetch('/api/reset-password?action=reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, email: _forgotEmail, newPassword })
        });
        const data = await res.json();

        if (data.success) {
            closeForgotPasswordModal();
            // Tampilkan sukses dan buka modal login
            setTimeout(() => {
                openAuthModal();
                switchAuthTab('login');
                const loginEmail = document.getElementById('login-email');
                if (loginEmail) loginEmail.value = _forgotEmail;
            }, 300);

            if (typeof Utils !== 'undefined') {
                Utils.showToast('✅ Password berhasil direset! Silakan login dengan password baru.', 'success');
            }
        } else {
            if (errEl) { errEl.style.color = 'var(--danger)'; errEl.textContent = data.error || 'Gagal reset password'; errEl.style.display = 'block'; }
        }
    } catch (err) {
        if (errEl) { errEl.style.color = 'var(--danger)'; errEl.textContent = 'Gagal terhubung ke server'; errEl.style.display = 'block'; }
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Reset Password'; }
    }
}

// Expose ke window
window.openForgotPasswordModal = openForgotPasswordModal;
window.closeForgotPasswordModal = closeForgotPasswordModal;
window.requestPasswordReset = requestPasswordReset;
window.submitPasswordReset = submitPasswordReset;
