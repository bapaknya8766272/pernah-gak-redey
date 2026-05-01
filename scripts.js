/**
 * ALFA HOSTING - Main JavaScript
 * Security-hardened version
 */

// ========================================
// CONFIGURATION (no secrets stored here)
// ========================================
const CONFIG = {
    QRIS: {
        // Config QRIS dibaca dari MongoDB via API saat checkout
        // Fallback ke localStorage jika API tidak tersedia
        get apikey()     { return localStorage.getItem('qris_apikey')    || ''; },
        get qrisCode()   { return localStorage.getItem('qris_code')      || ''; },
        get merchantId() { return localStorage.getItem('qris_merchant')  || ''; },
        get keyorkut()   { return localStorage.getItem('qris_keyorkut')  || ''; }
    },
    OPENAI: {
        MODEL: localStorage.getItem('openai_model') || 'gpt-3.5-turbo'
    }
};

// Load QRIS config dari MongoDB saat halaman dimuat
async function loadQRISConfig() {
    try {
        const res = await fetch('/api/settings?type=qris-public');
        if (!res.ok) return;
        const { config } = await res.json();
        if (config.qris_apikey)          localStorage.setItem('qris_apikey',          config.qris_apikey);
        if (config.qris_code)            localStorage.setItem('qris_code',            config.qris_code);
        if (config.qris_merchant)        localStorage.setItem('qris_merchant',        config.qris_merchant);
        if (config.qris_keyorkut)        localStorage.setItem('qris_keyorkut',        config.qris_keyorkut);
        if (config.qris_check_interval)  localStorage.setItem('qris_check_interval',  config.qris_check_interval);
    } catch { /* fallback ke localStorage */ }
}

// Track visitor real ke MongoDB
async function trackVisitor() {
    try {
        // Visitor ID unik per browser (bukan per session)
        let visitorId = localStorage.getItem('visitor_id');
        if (!visitorId) {
            visitorId = 'v_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
            localStorage.setItem('visitor_id', visitorId);
        }

        await fetch('/api/visitors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Visitor-ID': visitorId },
            body: JSON.stringify({
                visitorId,
                page: window.location.pathname,
                referrer: document.referrer || ''
            })
        });
    } catch { /* silent — tidak ganggu user */ }
}

// ========================================
// PRODUCTS DATA - LENGKAP
// ========================================
const defaultProducts = [
    // === VPS PRODUCTS ===
    { 
        id: 'vps1', category: 'vps', name: 'VPS BASIC 1GB', price: 15000, stock: 15,
        desc: "✅ RAM: 1GB Dedicated\n✅ CPU: 1 Core High Performance\n✅ Storage: 20GB NVMe SSD\n✅ Bandwidth: 1TB\n✅ OS: Linux (Ubuntu/Debian/CentOS)\n🚀 Cocok untuk: Tunneling, Bot Ringan, VPN",
        features: ["1GB RAM", "1 Core CPU", "20GB NVMe", "1TB Bandwidth", "Linux OS"]
    },
    { 
        id: 'vps2', category: 'vps', name: 'VPS BASIC 2GB', price: 25000, stock: 20,
        desc: "✅ RAM: 2GB Dedicated\n✅ CPU: 1 Core High Performance\n✅ Storage: 50GB NVMe SSD\n✅ Bandwidth: 2TB\n✅ Akses Root Full Control\n🚀 Cocok untuk: Hosting Web Kecil, VPN Pribadi",
        features: ["2GB RAM", "1 Core CPU", "50GB NVMe", "2TB Bandwidth", "Root Access"]
    },
    { 
        id: 'vps3', category: 'vps', name: 'VPS STANDARD 2GB', price: 30000, stock: 12,
        desc: "✅ RAM: 2GB Dedicated\n✅ CPU: 2 Core (Multithread)\n✅ Storage: 50GB NVMe SSD\n✅ Bandwidth: 2TB\n✅ Anti-DDoS Basic\n🚀 Cocok untuk: Script Multiprocess, Database",
        features: ["2GB RAM", "2 Core CPU", "50GB NVMe", "2TB Bandwidth", "Anti-DDoS"]
    },
    { 
        id: 'vps4', category: 'vps', name: 'VPS STANDARD 4GB', price: 35000, stock: 25, recommend: true,
        desc: "🔥 BEST SELLER!\n✅ RAM: 4GB Dedicated\n✅ CPU: 2 Core High Performance\n✅ Storage: 80GB NVMe SSD\n✅ Bandwidth: 4TB\n✅ Support Docker\n🚀 Cocok untuk: Game Server (MCPE/SAMP), Bot Music, Store Online",
        features: ["4GB RAM", "2 Core CPU", "80GB NVMe", "4TB Bandwidth", "Docker Support"]
    },
    { 
        id: 'vps5', category: 'vps', name: 'VPS HIGH 8GB', price: 45000, stock: 8,
        desc: "✅ RAM: 8GB Dedicated\n✅ CPU: 4 Core Extreme\n✅ Storage: 160GB NVMe SSD\n✅ Bandwidth: 5TB\n✅ Virtualisasi KVM\n🚀 Cocok untuk: Server Minecraft Java, Website Traffic Tinggi",
        features: ["8GB RAM", "4 Core CPU", "160GB NVMe", "5TB Bandwidth", "KVM"]
    },
    { 
        id: 'vps6', category: 'vps', name: 'VPS PRO 16GB', price: 70000, stock: 5,
        desc: "✅ RAM: 16GB Dedicated\n✅ CPU: 4 Core Extreme\n✅ Storage: 240GB NVMe SSD\n✅ Bandwidth: 5TB\n✅ Network 1Gbps\n🚀 Cocok untuk: Komunitas Game Besar, App Server Berat",
        features: ["16GB RAM", "4 Core CPU", "240GB NVMe", "5TB Bandwidth", "1Gbps Network"]
    },
    { 
        id: 'vps7', category: 'vps', name: 'VPS ENTERPRISE 32GB', price: 120000, stock: 3,
        desc: "👑 ENTERPRISE CLASS\n✅ RAM: 32GB Dedicated\n✅ CPU: 8 Core Xeon\n✅ Storage: 500GB NVMe SSD\n✅ Bandwidth: 10TB\n✅ Priority Support\n🚀 Cocok untuk: Perusahaan, Enterprise App",
        features: ["32GB RAM", "8 Core CPU", "500GB NVMe", "10TB Bandwidth", "Priority Support"]
    },

    // === PANEL PTERODACTYL - HEMAT ===
    { 
        id: 'pnl1', category: 'panel', name: 'PANEL 1GB HEMAT', price: 1000, stock: 100,
        desc: "🔹 RAM: 1GB\n🔹 CPU: 35%\n🔹 Disk: 1GB\n🔹 Server: Indonesia\n✨ Cocok untuk coba-coba atau script bot sangat ringan",
        features: ["1GB RAM", "35% CPU", "1GB Disk", "Indonesia Server"]
    },
    { 
        id: 'pnl2', category: 'panel', name: 'PANEL 2GB HEMAT', price: 2000, stock: 80,
        desc: "🔹 RAM: 2GB\n🔹 CPU: 50%\n🔹 Disk: 2GB\n🔹 Server: Indonesia\n✨ Cocok untuk Bot WhatsApp Single Session",
        features: ["2GB RAM", "50% CPU", "2GB Disk", "Indonesia Server"]
    },
    { 
        id: 'pnl3', category: 'panel', name: 'PANEL 3GB', price: 3000, stock: 60,
        desc: "🔹 RAM: 3GB\n🔹 CPU: 95%\n🔹 Disk: 3GB\n🔹 Server: Indonesia\n✨ Stabil untuk Bot Discord atau WA Multi-Device",
        features: ["3GB RAM", "95% CPU", "3GB Disk", "Indonesia Server"]
    },
    { 
        id: 'pnl4', category: 'panel', name: 'PANEL 4GB', price: 4000, stock: 50,
        desc: "🔹 RAM: 4GB\n🔹 CPU: 110%\n🔹 Disk: 4GB\n🔹 Server: Singapore\n✨ Kuat untuk menjalankan 2-3 script bot sekaligus",
        features: ["4GB RAM", "110% CPU", "4GB Disk", "Singapore Server"]
    },
    { 
        id: 'pnl5', category: 'panel', name: 'PANEL 5GB', price: 5000, stock: 40,
        desc: "🔹 RAM: 5GB\n🔹 CPU: 135%\n🔹 Disk: 5GB\n🔹 Server: Singapore Premium\n✨ Rekomendasi untuk Server SAMP/MTA dengan player sedang",
        features: ["5GB RAM", "135% CPU", "5GB Disk", "Singapore Premium"]
    },
    { 
        id: 'pnl6', category: 'panel', name: 'PANEL 6GB', price: 6000, stock: 35,
        desc: "🔹 RAM: 6GB\n🔹 CPU: 160%\n🔹 Disk: 6GB\n🔹 Server: Singapore Premium\n✨ Performa tinggi untuk kebutuhan hosting medium",
        features: ["6GB RAM", "160% CPU", "6GB Disk", "Singapore Premium"]
    },
    { 
        id: 'pnl7', category: 'panel', name: 'PANEL 7GB', price: 7000, stock: 30,
        desc: "🔹 RAM: 7GB\n🔹 CPU: 185%\n🔹 Disk: 7GB\n🔹 Server: Singapore Premium\n✨ Cocok untuk Bot Music High Quality Audio",
        features: ["7GB RAM", "185% CPU", "7GB Disk", "Singapore Premium"]
    },
    { 
        id: 'pnl8', category: 'panel', name: 'PANEL 8GB TURBO', price: 8000, stock: 25,
        desc: "🔹 RAM: 8GB\n🔹 CPU: 200%\n🔹 Disk: 8GB\n🔹 Server: Singapore Premium\n✨ Sangat lancar untuk Minecraft PE server kecil",
        features: ["8GB RAM", "200% CPU", "8GB Disk", "Singapore Premium"]
    },
    { 
        id: 'pnl9', category: 'panel', name: 'PANEL 9GB TURBO', price: 9000, stock: 20,
        desc: "🔹 RAM: 9GB\n🔹 CPU: 300%\n🔹 Disk: 9GB\n🔹 Performa Stabil & Cepat\n✨ Pilihan terbaik sebelum upgrade ke Unlimited",
        features: ["9GB RAM", "300% CPU", "9GB Disk", "Premium Performance"]
    },
    { 
        id: 'pnl10', category: 'panel', name: 'PANEL 10GB TURBO', price: 10000, stock: 15,
        desc: "🔹 RAM: 10GB\n🔹 CPU: 350%\n🔹 Disk: 10GB\n🔹 Server: Singapore Premium\n✨ Performa maksimal untuk game server medium",
        features: ["10GB RAM", "350% CPU", "10GB Disk", "Premium Server"]
    },

    // === PANEL PREMIUM ===
    { 
        id: 'pnl-unl', category: 'panel', name: 'PANEL UNLIMITED', price: 15000, stock: 10, recommend: true,
        desc: "👑 KHUSUS SULTAN\n♾️ RAM: Unlimited\n♾️ CPU: Unlimited\n♾️ Disk: Unlimited\n🛡️ Garansi Anti Suspend (S&K)\n✨ Bebas deploy apa saja sepuasnya!",
        features: ["Unlimited RAM", "Unlimited CPU", "Unlimited Disk", "Anti Suspend"]
    },
    { 
        id: 'pnl-reseller', category: 'panel', name: 'RESELLER PANEL', price: 25000, stock: 8,
        desc: "💼 PAKET USAHA RESELLER\n✅ Dapat Akun Reseller\n✅ Bisa Membuat Panel Sendiri\n✅ Bisa Jual Panel ke Orang Lain\n✅ Full Support\n💰 Cocok untuk pemula bisnis hosting",
        features: ["Reseller Access", "Create Panel", "Full Support", "Bisnis Ready"]
    },
    { 
        id: 'pnl-admin', category: 'panel', name: 'ADMIN PANEL', price: 35000, stock: 5, recommend: true,
        desc: "💼 PAKET USAHA ADMIN\n✅ Dapat Akun Admin Panel\n✅ Full Akses Create/Delete Server\n✅ Bisa Open Reseller Panel\n✅ Prioritas Support\n💰 Potensi Balik Modal Sangat Cepat!",
        features: ["Admin Access", "Full Control", "Create Reseller", "Priority Support"]
    },
    { 
        id: 'pnl-owner', category: 'panel', name: 'OWNER PANEL', price: 50000, stock: 3,
        desc: "🏢 TINGKAT TERTINGGI\n✅ Akses Panel Owner\n✅ Bisa Bikin Admin & Reseller\n✅ Full Control Resource Server\n✅ Prioritas Support 24/7\n✅ Akses ke Database Panel",
        features: ["Owner Access", "Create Admin", "Full Control", "Database Access"]
    },
    { 
        id: 'pnl-pt', category: 'panel', name: 'PARTNER PANEL', price: 75000, stock: 2, recommend: true,
        desc: "🤝 PAKET PARTNER\n✅ Join Manajemen\n✅ Akses Database Panel\n✅ Bebas Pasang Iklan di Panel\n✅ Full Support Teknis\n✅ Bagi Hasil 70/30",
        features: ["Partner Access", "Database Full", "Custom Ads", "Revenue Share"]
    },

    // === JASA & ADDONS ===
    { 
        id: 'jasa1', category: 'other', name: 'JASA INSTALL PANEL', price: 15000, stock: 999,
        desc: "🛠️ Terima Beres!\nKami instalkan Panel Pterodactyl di VPS Anda.\nTermasuk konfigurasi Domain & SSL (HTTPS).\n✅ Support Ubuntu 20.04/22.04",
        features: ["Panel Install", "Domain Config", "SSL Setup", "Full Support"]
    },
    { 
        id: 'jasa2', category: 'other', name: 'BASH AUTOSCRIPT', price: 20000, stock: 999,
        desc: "📜 Script Auto Install\nBuat Panel Pterodactyl sendiri hanya dengan 1 baris perintah.\n✅ Support Ubuntu 20.04/22.04\n✅ Include Wings Setup",
        features: ["Auto Script", "One Command", "Wings Setup", "Full Tutorial"]
    },
    { 
        id: 'jasa3', category: 'other', name: 'JASA RENAME SCRIPT', price: 25000, stock: 999,
        desc: "✏️ Rebranding Script\nGanti nama author, credit, dan tampilan script bot agar terlihat seperti milik Anda sendiri.\n✅ Include Logo Custom",
        features: ["Rebranding", "Custom Logo", "Full Source", "No Copyright"]
    },
    { 
        id: 'jasa4', category: 'other', name: 'FIX ERROR SCRIPT', price: 10000, stock: 999,
        desc: "🔧 Bot Anda Error?\nKami bantu perbaiki error pada script Bot WA/Telegram/Discord.\n✅ Garansi Fix\n✅ Support 24 Jam",
        features: ["Error Fixing", "All Platforms", "Fast Response", "Guaranteed"]
    },
    { 
        id: 'jasa5', category: 'other', name: 'JASA BUAT WEBSITE', price: 75000, stock: 999,
        desc: "🌐 Website Profesional\nLanding Page, Top Up Game, atau Company Profile.\n✅ Desain Responsif & Modern\n✅ SEO Friendly\n✅ Full Source Code",
        features: ["Responsive Design", "Modern UI", "SEO Friendly", "Full Source"]
    },
    { 
        id: 'jasa6', category: 'other', name: 'JASA BUAT BOT WA', price: 50000, stock: 999,
        desc: "🤖 Bot WhatsApp Custom\nBot sesuai kebutuhan Anda dengan fitur lengkap.\n✅ Include Deploy\n✅ Full Source Code\n✅ Tutorial Penggunaan",
        features: ["Custom Bot", "Full Feature", "Include Deploy", "Tutorial"]
    },
    { 
        id: 'jasa7', category: 'other', name: 'JASA OPTIMASI VPS', price: 20000, stock: 999,
        desc: "⚡ Optimasi Performa VPS\nTuning VPS untuk performa maksimal.\n✅ Swap Config\n✅ Network Optimize\n✅ Security Hardening",
        features: ["Performance Tuning", "Swap Config", "Network Optimize", "Security"]
    },
    { 
        id: 'jasa8', category: 'other', name: 'JASA BACKUP & RESTORE', price: 15000, stock: 999,
        desc: "💾 Backup & Restore Data\nBackup data penting Anda ke cloud storage.\n✅ Google Drive\n✅ Auto Schedule\n✅ Easy Restore",
        features: ["Cloud Backup", "Auto Schedule", "Easy Restore", "Full Support"]
    }
];

// ========================================
// DEFAULT TESTIMONIALS (50 Items)
// ========================================
const defaultTestimonials = [
    { id: 1, name: "Zaki_MCPE", rating: 5, message: "Gila vps 4gb nya kenceng bgt bang buat server mcpe. Lancar jaya gak ada lag sama sekali padahal player rame. Thx min!", date: "2026-02-18" },
    { id: 2, name: "Fauzan.dev", rating: 5, message: "Awalnya iseng nyoba panel 1gb hemat buat naruh script bot wa doang, eh ternyata stabil bngt. Harga seribu perak dapet segini mah worth it parah.", date: "2026-02-17" },
    { id: 3, name: "Rizky Store", rating: 4, message: "Makasih mase, jasa buat web top up ku jadi cakep. cuma revisi warna temanya lumayan nunggu lama balasan adminnya wkwk. tp overal hasil mantap.", date: "2026-02-15" },
    { id: 4, name: "Dika Santoso", rating: 5, message: "Sultan beneran ini mah panel unlimitednya. Udah deploy 5 server barengan resource masi aman sentosa, ga kena suspend.", date: "2026-02-14" },
    { id: 5, name: "Bima_Aji", rating: 4, message: "Fitur bot wa nya lengkap bgt sesuai rikues, tp jujur awal2 agak bingung cara run nya di panel. untung adminnya sabar njelasin sampe bisa.", date: "2026-02-12" },
    { id: 6, name: "Kelvin.jr", rating: 5, message: "Penyelamat bgt asli!! Script bot ku error dari kemarin, pake jasa fix error langsung jalan lagi normal. murah lg wkwk", date: "2026-02-10" },
    { id: 7, name: "Sandi VPN", rating: 4, message: "Vps basic 1gb nya mayan bgt buat tunneling pribadi. ping sempet naik turun kmrn siang tp skrg dah stabil lg jos.", date: "2026-02-08" },
    { id: 8, name: "Tegar_SAMP", rating: 5, message: "Pake panel 10gb turbo buat server SAMP, ping nya dapet ijo terus bang. Server SG premium nya emang beda.", date: "2026-02-05" },
    { id: 9, name: "Agung_Store", rating: 5, message: "Jasa rename script nya rapih bang. Sekarang bot nya udah full pake nama & logo store ku sendiri. Keren euy", date: "2026-02-03" },
    { id: 10, name: "Rio.P", rating: 3, message: "Order jasa install panel ptero ke vps sendiri. jujur agak lama prosesnya ampe 3 jam karna katanya lg antri panjang. tp yaudah lah yg penting panel nyala normal.", date: "2026-02-01" },
    { id: 11, name: "CEO_Ngelag", rating: 5, message: "Beli VPS Enterprise 32GB buat database kantor, gila ngacir bener bang. Xeon 8 core nya ga main-main.", date: "2026-01-29" },
    { id: 12, name: "Rafly_MTA", rating: 5, message: "Panel 5gb nya pas bgt buat server MTA player 50an. Harga 5rb doang udah dapet server SG Premium.", date: "2026-01-28" },
    { id: 13, name: "Cuan_Maksimal", rating: 5, message: "Paket reseller panelnya mantap min, modal 25rb udah bisa jualan panel ptero sendiri. Auto balik modal ini mah hahaha", date: "2026-01-26" },
    { id: 14, name: "Ivan_Tkj", rating: 4, message: "Jasa optimasi vps nya ngaruh bgt. Serverku awalnya sering OOM mati sendiri, abis disettingin swap jadi agak mendingan lah.", date: "2026-01-25" },
    { id: 15, name: "Fajar_Hosting", rating: 5, message: "Backup & Restore nya ngebantu bgt pas kemaren ganti vps. Data bot aman semua pindah dgn selamat.", date: "2026-01-22" },
];

// ========================================
// RATE LIMITER (ANTI DDOS)
// ========================================
class RateLimiter {
    constructor() {
        this.requests = new Map();
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }

    checkLimit(identifier, maxRequests = 50) {
        const now = Date.now();
        const windowStart = now - 60000;
        
        if (!this.requests.has(identifier)) {
            this.requests.set(identifier, []);
        }
        
        const userRequests = this.requests.get(identifier);
        const validRequests = userRequests.filter(time => time > windowStart);
        
        if (validRequests.length >= maxRequests) {
            return false;
        }
        
        validRequests.push(now);
        this.requests.set(identifier, validRequests);
        return true;
    }

    cleanup() {
        const now = Date.now();
        const windowStart = now - 60000;
        
        for (const [identifier, times] of this.requests.entries()) {
            const validTimes = times.filter(time => time > windowStart);
            if (validTimes.length === 0) {
                this.requests.delete(identifier);
            } else {
                this.requests.set(identifier, validTimes);
            }
        }
    }
}

const rateLimiter = new RateLimiter();

// ========================================
// UTILITY FUNCTIONS
// ========================================
const Utils = {
    formatRupiah(num) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(num);
    },

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    generateOrderId() {
        const prefix = 'HJBS';
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 5).toUpperCase();
        return `${prefix}-${timestamp}-${random}`;
    },

    // Sanitize string to prevent XSS
    sanitize(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle'
        };
        
        const safeMsg = this.sanitize(message);
        toast.innerHTML = `<i class="fas ${icons[type] || icons.success}"></i><span>${safeMsg}</span>`;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    getClientId() {
        let id = localStorage.getItem('client_id');
        if (!id) {
            id = 'client_' + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('client_id', id);
        }
        return id;
    },

    animateCounter(el, target, duration = 2000) {
        let start = 0;
        const increment = target / (duration / 16);
        const timer = setInterval(() => {
            start += increment;
            if (start >= target) {
                el.textContent = target;
                clearInterval(timer);
            } else {
                el.textContent = Math.floor(start);
            }
        }, 16);
    }
};

// ========================================
// PRODUCT MANAGER — pakai MongoDB via API, fallback ke defaultProducts
// ========================================
const ProductManager = {
    _cache: null,
    _cacheTime: 0,
    _CACHE_TTL: 5 * 60 * 1000, // 5 menit

    async loadFromDB() {
        try {
            const res = await fetch('/api/products');
            if (!res.ok) throw new Error('API error');
            const data = await res.json();
            const products = data.products || [];
            if (products.length > 0) {
                this._cache = products;
                this._cacheTime = Date.now();
                // Sync ke localStorage sebagai backup offline
                localStorage.setItem('products', JSON.stringify(products));
                return products;
            }
        } catch (e) {
            console.warn('Gagal load produk dari DB, pakai cache lokal:', e.message);
        }
        // Fallback ke localStorage atau default
        return JSON.parse(localStorage.getItem('products')) || defaultProducts;
    },

    init() {
        // Load dari DB saat init, update cache
        this.loadFromDB().then(products => {
            this._cache = products;
            // Re-render jika sudah ada di halaman
            if (typeof renderProducts === 'function') renderProducts(currentCategory || 'all');
            if (typeof renderBestsellerStrip === 'function') renderBestsellerStrip();
        });
        // Fallback: pastikan localStorage ada
        if (!localStorage.getItem('products')) {
            localStorage.setItem('products', JSON.stringify(defaultProducts));
        }
    },

    getAll() {
        // Pakai cache jika masih fresh
        if (this._cache && (Date.now() - this._cacheTime) < this._CACHE_TTL) {
            return this._cache;
        }
        return JSON.parse(localStorage.getItem('products')) || defaultProducts;
    },

    getById(id) {
        return this.getAll().find(p => p.id === id);
    },

    getByCategory(category) {
        if (category === 'all') return this.getAll();
        return this.getAll().filter(p => p.category === category);
    },

    async addProduct(productData) {
        const token = typeof AdminAuth !== 'undefined' ? AdminAuth.getToken() : '';
        try {
            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
                body: JSON.stringify(productData)
            });
            const data = await res.json();
            if (res.ok) {
                this._cache = null; // invalidate cache
                await this.loadFromDB();
                return data.product;
            }
        } catch (e) { console.error('addProduct error:', e); }
        // Fallback lokal
        const products = this.getAll();
        const newProduct = { ...productData, id: 'prod_' + Date.now().toString(36) };
        products.push(newProduct);
        localStorage.setItem('products', JSON.stringify(products));
        this._cache = products;
        return newProduct;
    },

    async updateProduct(id, productData) {
        const token = typeof AdminAuth !== 'undefined' ? AdminAuth.getToken() : '';
        try {
            const res = await fetch(`/api/products?id=${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
                body: JSON.stringify(productData)
            });
            if (res.ok) {
                this._cache = null;
                await this.loadFromDB();
                return true;
            }
        } catch (e) { console.error('updateProduct error:', e); }
        // Fallback lokal
        const products = this.getAll();
        const index = products.findIndex(p => p.id === id);
        if (index !== -1) {
            products[index] = { ...products[index], ...productData };
            localStorage.setItem('products', JSON.stringify(products));
            this._cache = products;
            return true;
        }
        return false;
    },

    async deleteProduct(id) {
        const token = typeof AdminAuth !== 'undefined' ? AdminAuth.getToken() : '';
        try {
            await fetch(`/api/products?id=${id}`, {
                method: 'DELETE',
                headers: { 'X-Admin-Token': token }
            });
            this._cache = null;
            await this.loadFromDB();
        } catch (e) { console.error('deleteProduct error:', e); }
        // Fallback lokal
        const products = this.getAll().filter(p => p.id !== id);
        localStorage.setItem('products', JSON.stringify(products));
        this._cache = products;
    },

    async updateStock(productId, quantity) {
        const products = this.getAll();
        const index = products.findIndex(p => p.id === productId);
        if (index !== -1 && products[index].category !== 'other') {
            products[index].stock = Math.max(0, products[index].stock - quantity);
            if (products[index].stock <= 0) products[index].outOfStock = true;
            localStorage.setItem('products', JSON.stringify(products));
            this._cache = products;
            // Sync ke DB di background — pakai _fromCheckout agar tidak butuh admin token
            fetch(`/api/products?id=${productId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stock: products[index].stock, outOfStock: products[index].outOfStock, _fromCheckout: true })
            }).catch(() => {});
            return true;
        }
        return false;
    },

    async restock(productId, quantity) {
        const token = typeof AdminAuth !== 'undefined' ? AdminAuth.getToken() : '';
        try {
            await fetch('/api/products?action=restock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
                body: JSON.stringify({ productId, amount: quantity })
            });
            this._cache = null;
            await this.loadFromDB();
        } catch (e) { console.error('restock error:', e); }
        // Fallback lokal
        const products = this.getAll();
        const index = products.findIndex(p => p.id === productId);
        if (index !== -1) {
            products[index].stock = (products[index].stock || 0) + quantity;
            products[index].outOfStock = false;
            localStorage.setItem('products', JSON.stringify(products));
            this._cache = products;
            return true;
        }
        return false;
    }
};

// ========================================
// CART MANAGER — tetap localStorage (data sementara per user)
// ========================================
const CartManager = {
    getItems() {
        try { return JSON.parse(localStorage.getItem('cart')) || []; }
        catch { return []; }
    },
    saveItems(items) {
        localStorage.setItem('cart', JSON.stringify(items));
        this.updateUI();
    },
    addItem(product, quantity = 1) {
        if (!rateLimiter.checkLimit(Utils.getClientId() + '_cart')) {
            Utils.showToast('Terlalu banyak permintaan. Coba lagi nanti.', 'error');
            return false;
        }
        const cart = this.getItems();
        const existingItem = cart.find(item => item.id === product.id);
        if (product.category !== 'other') {
            const currentQty = existingItem ? existingItem.quantity : 0;
            if (currentQty + quantity > product.stock) {
                Utils.showToast('Stok tidak mencukupi!', 'error');
                return false;
            }
        }
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cart.push({ id: product.id, name: product.name, price: product.price, quantity, category: product.category });
        }
        this.saveItems(cart);
        Utils.showToast(`${product.name} ditambahkan ke keranjang!`);
        return true;
    },
    removeItem(index) {
        const cart = this.getItems();
        cart.splice(index, 1);
        this.saveItems(cart);
        renderCart();
    },
    updateQuantity(index, newQuantity) {
        const cart = this.getItems();
        const product = ProductManager.getById(cart[index].id);
        if (product && product.category !== 'other' && newQuantity > product.stock) {
            Utils.showToast('Stok tidak mencukupi!', 'error');
            return false;
        }
        if (newQuantity <= 0) {
            this.removeItem(index);
        } else {
            cart[index].quantity = newQuantity;
            this.saveItems(cart);
            renderCart();
        }
        return true;
    },
    clear() { localStorage.removeItem('cart'); this.updateUI(); },
    getTotal() { return this.getItems().reduce((t, i) => t + (i.price * i.quantity), 0); },
    getItemCount() { return this.getItems().reduce((c, i) => c + i.quantity, 0); },
    updateUI() {
        const countEl = document.getElementById('cart-count');
        if (countEl) {
            const count = this.getItemCount();
            countEl.textContent = count;
            countEl.style.display = count > 0 ? 'flex' : 'none';
        }
    }
};

// ========================================
// TESTIMONIAL MANAGER — pakai MongoDB via API
// ========================================
const TestimonialManager = {
    _cache: null,
    _cacheTime: 0,
    _CACHE_TTL: 5 * 60 * 1000,

    async loadFromDB() {
        try {
            const res = await fetch('/api/content?type=testimonials&limit=50');
            if (!res.ok) throw new Error('API error');
            const data = await res.json();
            this._cache = data.testimonials || [];
            this._cacheTime = Date.now();
            return this._cache;
        } catch {
            return this._cache || defaultTestimonials;
        }
    },

    init() {
        this.loadFromDB().then(t => {
            this._cache = t;
            if (typeof renderTestimonials === 'function') renderTestimonials();
            if (typeof renderRatingSummary === 'function') renderRatingSummary();
        });
    },

    getAll() {
        if (this._cache && (Date.now() - this._cacheTime) < this._CACHE_TTL) return this._cache;
        return defaultTestimonials;
    },

    async add(testimonial) {
        if (!rateLimiter.checkLimit(Utils.getClientId() + '_testimonial')) {
            Utils.showToast('Terlalu banyak permintaan. Coba lagi nanti.', 'error');
            return false;
        }
        try {
            const res = await fetch('/api/content?type=testimonials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testimonial)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            this._cache = null; // invalidate cache
            await this.loadFromDB();
            return true;
        } catch (e) {
            Utils.showToast('Gagal kirim testimoni: ' + e.message, 'error');
            return false;
        }
    }
};

// ========================================
// CHATBOT (calls backend API — no key on client)
// ========================================
const ChatBot = {
    async getResponse(message) {
        if (!rateLimiter.checkLimit(Utils.getClientId() + '_chat', 30)) {
            return 'Maaf, terlalu banyak permintaan. Silakan tunggu sebentar.';
        }

        // Sanitize before sending
        const safeMessage = message.trim().substring(0, 500);
        if (!safeMessage) return 'Pesan tidak boleh kosong.';

        try {
            const selectedModel = CONFIG.OPENAI.MODEL;
            
            // Create abort controller with 8 second timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            
            const response = await fetch('/api/openai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: safeMessage, model: selectedModel }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return data.reply || 'Maaf, tidak ada respons.';

        } catch (error) {
            console.error('Chat error:', error.message);
            
            const responses = {
                'harga': '💰 Harga kami:\n• VPS mulai Rp 15.000/bulan\n• Panel mulai Rp 1.000/bulan\n• Jasa IT mulai Rp 10.000',
                'cara beli': '🛒 Cara beli:\n1. Pilih layanan\n2. Tambah ke keranjang\n3. Bayar via QRIS/VA',
                'pembayaran': '💳 Kami menerima QRIS (GoPay, OVO, Dana, dll) dan semua e-wallet/m-banking',
                'panel': '🎮 Panel Pterodactyl:\n• 1GB: Rp 1.000\n• 4GB: Rp 4.000\n• Unlimited: Rp 15.000',
                'vps': '🖥️ VPS Cloud:\n• 1GB: Rp 15.000\n• 4GB: Rp 35.000 (Best Seller)\n• 8GB: Rp 45.000',
                'support': '📞 WhatsApp: +62 822-2676-9163',
                'halo': '👋 Halo! Ada yang bisa saya bantu?',
                'hai': '👋 Hai! Ada yang bisa saya bantu?',
                'promo': '🎉 Gunakan kode promo saat checkout untuk diskon!'
            };

            const lowerMsg = safeMessage.toLowerCase();
            for (const [key, fallbackResponse] of Object.entries(responses)) {
                if (lowerMsg.includes(key)) return fallbackResponse;
            }

            return 'Maaf, saya belum mengerti. Hubungi admin via WhatsApp: +62 822-2676-9163 📞';
        }
    }
};

// ========================================
// WISHLIST MANAGER
// ========================================
const WishlistManager = {
    getItems() {
        try { return JSON.parse(localStorage.getItem('wishlist')) || []; }
        catch { return []; }
    },
    toggle(productId) {
        const items = this.getItems();
        const idx = items.indexOf(productId);
        if (idx === -1) {
            items.push(productId);
            Utils.showToast('Ditambahkan ke favorit! ❤️');
        } else {
            items.splice(idx, 1);
            Utils.showToast('Dihapus dari favorit');
        }
        localStorage.setItem('wishlist', JSON.stringify(items));
        this.updateUI();
        return idx === -1; // true = added
    },
    has(productId) {
        return this.getItems().includes(productId);
    },
    updateUI() {
        const count = this.getItems().length;
        const badge = document.getElementById('wishlist-count');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
        // Update all heart buttons
        document.querySelectorAll('[data-wishlist-id]').forEach(btn => {
            const id = btn.dataset.wishlistId;
            const icon = btn.querySelector('i');
            if (icon) {
                icon.className = this.has(id) ? 'fas fa-heart' : 'far fa-heart';
                btn.style.color = this.has(id) ? 'var(--danger)' : '';
            }
        });
    },
    getAll() {
        const ids = this.getItems();
        return ids.map(id => ProductManager.getById(id)).filter(Boolean);
    }
};

// ========================================
// WISHLIST MODAL
// ========================================
function openWishlistModal() {
    const items = WishlistManager.getAll();
    const modal = document.getElementById('wishlist-modal');
    const body = document.getElementById('wishlist-body');
    if (!modal || !body) return;

    if (items.length === 0) {
        body.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);">
            <i class="fas fa-heart" style="font-size:3rem;display:block;margin-bottom:15px;opacity:0.3;"></i>
            <p>Belum ada produk favorit</p>
            <p style="font-size:0.85rem;margin-top:5px;">Klik ❤️ di produk untuk menyimpan</p>
        </div>`;
    } else {
        const icons = { vps: 'fa-server', panel: 'fa-gamepad', other: 'fa-tools' };
        body.innerHTML = items.map(p => `
            <div style="display:flex;align-items:center;gap:15px;padding:15px 0;border-bottom:1px solid var(--border-color);">
                <div style="width:50px;height:50px;background:var(--gradient-primary);border-radius:14px;display:flex;align-items:center;justify-content:center;color:white;flex-shrink:0;">
                    <i class="fas ${icons[p.category] || 'fa-box'}"></i>
                </div>
                <div style="flex:1;">
                    <div style="font-weight:600;">${Utils.sanitize(p.name)}</div>
                    <div style="color:var(--accent);font-weight:700;">${Utils.formatRupiah(p.price)}</div>
                </div>
                <div style="display:flex;gap:8px;">
                    <button class="btn btn-primary btn-sm" onclick="CartManager.addItem(${JSON.stringify(p).replace(/'/g,'&#39;')},1);closeWishlistModal()">
                        <i class="fas fa-cart-plus"></i>
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="WishlistManager.toggle('${p.id}');openWishlistModal();" style="color:var(--danger);border-color:var(--danger);">
                        <i class="fas fa-heart"></i>
                    </button>
                </div>
            </div>`).join('');
    }
    modal.classList.add('active');
}

function closeWishlistModal() {
    document.getElementById('wishlist-modal')?.classList.remove('active');
}

window.WishlistManager = WishlistManager;
window.openWishlistModal = openWishlistModal;
window.closeWishlistModal = closeWishlistModal;

// ========================================
// FITUR 1: COUNTDOWN TIMER PROMO
// ========================================
(function startPromoCountdown() {
    // Hitung sisa waktu sampai tengah malam
    function getSecondsUntilMidnight() {
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        return Math.floor((midnight - now) / 1000);
    }

    function updateCountdown() {
        let secs = getSecondsUntilMidnight();
        const h = String(Math.floor(secs / 3600)).padStart(2, '0');
        const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
        const s = String(secs % 60).padStart(2, '0');
        const el = document.getElementById('promo-countdown');
        if (el) el.textContent = `${h}:${m}:${s}`;
    }

    updateCountdown();
    setInterval(updateCountdown, 1000);
})();

// ========================================
// FITUR 2: COMPARE PRODUK
// ========================================
let compareList = [];

function toggleCompare(product) {
    const idx = compareList.findIndex(p => p.id === product.id);
    if (idx !== -1) {
        compareList.splice(idx, 1);
        Utils.showToast(`${product.name} dihapus dari perbandingan`);
    } else {
        if (compareList.length >= 2) {
            Utils.showToast('Maksimal 2 produk untuk dibandingkan!', 'warning');
            return;
        }
        compareList.push(product);
        Utils.showToast(`${product.name} ditambahkan ke perbandingan`);
    }
    updateCompareBar();
}

function updateCompareBar() {
    let bar = document.getElementById('compare-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'compare-bar';
        bar.className = 'compare-bar';
        document.body.appendChild(bar);
    }
    if (compareList.length === 0) {
        bar.style.display = 'none';
        return;
    }
    bar.style.display = 'flex';
    bar.innerHTML = `
        <span style="font-weight:600;"><i class="fas fa-balance-scale"></i> Bandingkan:</span>
        ${compareList.map(p => `<span class="compare-tag">${Utils.sanitize(p.name)} <button onclick="toggleCompare(${JSON.stringify(p).replace(/'/g,'&#39;')})">×</button></span>`).join('')}
        ${compareList.length === 2 ? `<button class="btn btn-primary btn-sm" onclick="openCompareModal()"><i class="fas fa-eye"></i> Lihat Perbandingan</button>` : `<span style="color:var(--text-muted);font-size:0.85rem;">Pilih 1 produk lagi</span>`}
        <button class="btn btn-outline btn-sm" onclick="compareList=[];updateCompareBar()">Batal</button>
    `;
}

function openCompareModal() {
    if (compareList.length < 2) return;
    const [a, b] = compareList;
    const rows = ['name','price','category','stock'];
    const labels = { name: 'Nama', price: 'Harga', category: 'Kategori', stock: 'Stok' };
    const catLabel = { vps: 'VPS Cloud', panel: 'Panel Pterodactyl', other: 'Jasa & Addons' };

    const body = document.getElementById('compare-body');
    if (!body) return;

    body.innerHTML = `
        <div class="compare-table">
            <div class="compare-col compare-header">
                <div class="compare-cell"></div>
                ${rows.map(r => `<div class="compare-cell compare-label">${labels[r]}</div>`).join('')}
                <div class="compare-cell compare-label">Fitur</div>
                <div class="compare-cell"></div>
            </div>
            ${[a, b].map(p => `
            <div class="compare-col">
                <div class="compare-cell compare-product-name">${Utils.sanitize(p.name)}</div>
                <div class="compare-cell">${Utils.formatRupiah(p.price)}<span style="font-size:0.75rem;color:var(--text-muted)">/bln</span></div>
                <div class="compare-cell"><span class="category-badge-sm ${p.category}">${catLabel[p.category]||p.category}</span></div>
                <div class="compare-cell">${p.category==='other'?'∞':p.stock}</div>
                <div class="compare-cell compare-features">${(p.features||[]).map(f=>`<span class="feat-tag"><i class="fas fa-check"></i> ${Utils.sanitize(f)}</span>`).join('')}</div>
                <div class="compare-cell">
                    <button class="btn btn-primary btn-sm" onclick="CartManager.addItem(${JSON.stringify(p).replace(/'/g,'&#39;')},1);closeCompareModal()">
                        <i class="fas fa-cart-plus"></i> Beli
                    </button>
                </div>
            </div>`).join('')}
        </div>`;

    document.getElementById('compare-modal').classList.add('active');
}

function closeCompareModal() {
    document.getElementById('compare-modal')?.classList.remove('active');
}

window.toggleCompare = toggleCompare;
window.openCompareModal = openCompareModal;
window.closeCompareModal = closeCompareModal;

// ========================================
// FITUR 3: PRODUK TERLARIS
// ========================================
function renderBestsellerStrip() {
    const salesHistory = JSON.parse(localStorage.getItem('salesHistory') || '[]');
    const products = ProductManager.getAll();

    // Hitung total terjual per produk
    const soldMap = {};
    salesHistory.forEach(s => {
        soldMap[s.id] = (soldMap[s.id] || 0) + (s.quantity || 1);
    });

    // Ambil top 5 berdasarkan penjualan, fallback ke recommend
    let top = products
        .map(p => ({ ...p, sold: soldMap[p.id] || 0 }))
        .sort((a, b) => b.sold - a.sold || (b.recommend ? 1 : 0) - (a.recommend ? 1 : 0))
        .slice(0, 5);

    // Jika tidak ada data penjualan, pakai yang recommend
    if (top.every(p => p.sold === 0)) {
        top = products.filter(p => p.recommend).slice(0, 5);
    }

    if (top.length === 0) return;

    const strip = document.getElementById('bestseller-strip');
    const items = document.getElementById('bestseller-items');
    if (!strip || !items) return;

    items.innerHTML = top.map(p => `
        <button class="bestseller-item" onclick='showProductDetail(${JSON.stringify(p).replace(/'/g,"&#39;")})'>
            <span class="bs-name">${Utils.sanitize(p.name)}</span>
            <span class="bs-price">${Utils.formatRupiah(p.price)}</span>
            ${p.sold > 0 ? `<span class="bs-sold">${p.sold} terjual</span>` : ''}
        </button>`).join('');

    strip.style.display = 'flex';
}

// ========================================
// FITUR 4: SOCIAL PROOF POPUP
// ========================================
const FAKE_NAMES = ['Budi S.','Rizky A.','Dika F.','Sandi W.','Fajar R.','Kelvin J.','Tegar M.','Agung P.','Rafly K.','Ivan T.'];
const FAKE_ACTIONS = ['baru saja membeli','baru checkout','baru memesan'];

function showSocialProof() {
    const products = ProductManager.getAll().filter(p => p.category !== 'other' && p.stock > 0);
    if (products.length === 0) return;

    const product = products[Math.floor(Math.random() * products.length)];
    const name = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
    const action = FAKE_ACTIONS[Math.floor(Math.random() * FAKE_ACTIONS.length)];

    const popup = document.getElementById('social-proof-popup');
    if (!popup) return;

    document.getElementById('sp-name').textContent = name;
    document.getElementById('sp-action').textContent = action;
    document.getElementById('sp-product').textContent = product.name;

    popup.style.display = 'flex';
    popup.classList.add('sp-show');

    setTimeout(() => {
        popup.classList.remove('sp-show');
        setTimeout(() => { popup.style.display = 'none'; }, 400);
    }, 4000);
}

// Tampilkan setiap 15–30 detik
setTimeout(() => {
    showSocialProof();
    setInterval(showSocialProof, 20000 + Math.random() * 10000);
}, 8000);

// ========================================
// FITUR 5: SHARE PRODUK KE WHATSAPP
// ========================================
function shareProductWA(product) {
    const text = `Halo! Saya tertarik dengan *${product.name}* di ALFA HOSTING seharga *${Utils.formatRupiah(product.price)}/bulan*.\n\nBisa info lebih lanjut? 🙏`;
    const url = `https://wa.me/6282226769163?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

window.shareProductWA = shareProductWA;

// ========================================
// FITUR 6: PROGRESS BAR STOK (di renderProducts)
// ========================================
// Ditambahkan langsung ke renderProducts — lihat patch di bawah

// ========================================
// FITUR 7: RECENTLY VIEWED
// ========================================
const RecentlyViewed = {
    MAX: 6,
    add(product) {
        let items = this.get();
        items = items.filter(p => p.id !== product.id);
        items.unshift({ id: product.id, name: product.name, price: product.price, category: product.category });
        if (items.length > this.MAX) items = items.slice(0, this.MAX);
        localStorage.setItem('recently_viewed', JSON.stringify(items));
    },
    get() {
        try { return JSON.parse(localStorage.getItem('recently_viewed') || '[]'); }
        catch { return []; }
    },
    render() {
        const items = this.get();
        const section = document.getElementById('recently-viewed');
        const grid = document.getElementById('recently-grid');
        if (!section || !grid || items.length === 0) return;

        const icons = { vps: 'fa-server', panel: 'fa-gamepad', other: 'fa-tools' };
        grid.innerHTML = items.map(item => {
            const full = ProductManager.getById(item.id);
            if (!full) return '';
            return `
            <div class="recently-card" onclick='showProductDetail(${JSON.stringify(full).replace(/'/g,"&#39;")})'>
                <div class="recently-icon"><i class="fas ${icons[item.category]||'fa-box'}"></i></div>
                <div class="recently-info">
                    <div class="recently-name">${Utils.sanitize(item.name)}</div>
                    <div class="recently-price">${Utils.formatRupiah(item.price)}</div>
                </div>
            </div>`;
        }).join('');

        section.style.display = 'block';
    }
};

window.RecentlyViewed = RecentlyViewed;

// ========================================
// FITUR 8: COPY LINK PRODUK
// ========================================
function copyProductLink(productId) {
    const url = `${window.location.origin}${window.location.pathname}#services?product=${productId}`;
    navigator.clipboard.writeText(url).then(() => {
        Utils.showToast('Link produk disalin! 🔗');
    }).catch(() => {
        Utils.showToast('Gagal menyalin link', 'error');
    });
}

window.copyProductLink = copyProductLink;

// ========================================
// FITUR 9: RATING SUMMARY
// ========================================
function renderRatingSummary() {
    const el = document.getElementById('rating-summary');
    if (!el) return;

    const testimonials = TestimonialManager.getAll();
    if (testimonials.length === 0) return;

    const total = testimonials.length;
    const avg = testimonials.reduce((s, t) => s + t.rating, 0) / total;
    const dist = [5,4,3,2,1].map(r => ({
        star: r,
        count: testimonials.filter(t => t.rating === r).length
    }));

    const stars = Array(5).fill(0).map((_, i) =>
        `<i class="${i < Math.round(avg) ? 'fas' : 'far'} fa-star"></i>`
    ).join('');

    el.innerHTML = `
        <div class="rating-summary-card">
            <div class="rs-score">
                <div class="rs-number">${avg.toFixed(1)}</div>
                <div class="rs-stars">${stars}</div>
                <div class="rs-total">${total} ulasan</div>
            </div>
            <div class="rs-bars">
                ${dist.map(d => `
                <div class="rs-bar-row">
                    <span class="rs-bar-label">${d.star} <i class="fas fa-star" style="color:var(--warning);font-size:0.7rem;"></i></span>
                    <div class="rs-bar-track">
                        <div class="rs-bar-fill" style="width:${total > 0 ? Math.round(d.count/total*100) : 0}%"></div>
                    </div>
                    <span class="rs-bar-count">${d.count}</span>
                </div>`).join('')}
            </div>
        </div>`;
}

// ========================================
// FITUR 10: PRINT RINGKASAN PESANAN
// ========================================
function printCart() {
    const items = CartManager.getItems();
    if (items.length === 0) {
        Utils.showToast('Keranjang kosong!', 'warning');
        return;
    }

    const subtotal = CartManager.getTotal();
    const discount = activePromo ? Math.floor(subtotal * activePromo.discount) : 0;
    const total = subtotal - discount;
    const now = new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'medium' });

    const printWin = window.open('', '_blank', 'width=600,height=700');
    printWin.document.write(`
        <!DOCTYPE html><html><head>
        <meta charset="UTF-8">
        <title>Ringkasan Pesanan - ALFA HOSTING</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #1e293b; }
            h1 { color: #6366f1; margin-bottom: 5px; }
            .sub { color: #64748b; font-size: 0.9rem; margin-bottom: 25px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background: #f1f5f9; padding: 10px; text-align: left; font-size: 0.85rem; }
            td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
            .total-row { font-weight: bold; font-size: 1.1rem; }
            .total-row td { border-top: 2px solid #6366f1; color: #6366f1; }
            .footer { margin-top: 30px; font-size: 0.8rem; color: #94a3b8; text-align: center; }
            @media print { button { display: none; } }
        </style>
        </head><body>
        <h1>🚀 ALFA HOSTING</h1>
        <div class="sub">Ringkasan Pesanan — ${now}</div>
        <table>
            <thead><tr><th>Layanan</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead>
            <tbody>
                ${items.map(i => `<tr>
                    <td>${i.name}</td>
                    <td>${i.quantity}</td>
                    <td>${Utils.formatRupiah(i.price)}</td>
                    <td>${Utils.formatRupiah(i.price * i.quantity)}</td>
                </tr>`).join('')}
                ${discount > 0 ? `<tr><td colspan="3">Diskon (${activePromo.code})</td><td>-${Utils.formatRupiah(discount)}</td></tr>` : ''}
            </tbody>
            <tfoot><tr class="total-row"><td colspan="3">TOTAL</td><td>${Utils.formatRupiah(total)}</td></tr></tfoot>
        </table>
        <div class="footer">WhatsApp: +62 822-2676-9163 | sanzbot938@gmail.com</div>
        <br><button onclick="window.print()">🖨️ Print</button>
        </body></html>`);
    printWin.document.close();
}

window.printCart = printCart;

// ========================================
// PATCH renderProducts — tambah progress bar stok, share, copy, compare
// ========================================
function renderProducts(category = 'all') {
    currentCategory = category;
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    let products = ProductManager.getByCategory(category);
    if (currentSearchQuery) {
        products = products.filter(p =>
            p.name.toLowerCase().includes(currentSearchQuery) ||
            p.desc.toLowerCase().includes(currentSearchQuery) ||
            (p.features || []).some(f => f.toLowerCase().includes(currentSearchQuery))
        );
    }

    if (products.length === 0) {
        grid.innerHTML = `<div class="no-results" style="grid-column:1/-1;text-align:center;padding:60px 20px;">
            <i class="fas fa-search" style="font-size:3rem;color:var(--text-muted);margin-bottom:15px;display:block;"></i>
            <h3 style="margin-bottom:8px;">Tidak ada produk ditemukan</h3>
            <p style="color:var(--text-secondary);">Coba kata kunci lain atau pilih kategori berbeda</p>
        </div>`;
        return;
    }

    const icons = { vps: 'fa-server', panel: 'fa-gamepad', other: 'fa-tools' };
    const salesHistory = JSON.parse(localStorage.getItem('salesHistory') || '[]');

    // Simpan produk ke window cache agar onclick bisa akses by ID (aman dari HTML injection)
    window._productCache = {};
    products.forEach(p => { window._productCache[p.id] = p; });

    grid.innerHTML = products.map(product => {
        const isOutOfStock = product.category !== 'other' && product.stock <= 0;
        const isLowStock = !isOutOfStock && product.category !== 'other' && product.stock <= 5;
        const stockClass = isOutOfStock ? 'out' : (isLowStock ? 'limited' : 'available');
        const stockText = isOutOfStock ? 'HABIS' : (isLowStock ? `Sisa: ${product.stock}` : `Stok: ${product.stock}`);
        const firstLine = (product.desc || '').split('\n')[0];

        const maxStock = 50;
        const stockPct = product.category === 'other' ? 100 : Math.min(100, Math.round((product.stock / maxStock) * 100));
        const stockBarColor = isOutOfStock ? 'var(--danger)' : isLowStock ? 'var(--warning)' : 'var(--accent)';

        const sold = salesHistory.filter(s => s.id === product.id).reduce((sum, s) => sum + (s.quantity || 1), 0);
        const inCompare = compareList.some(p => p.id === product.id);
        const inWishlist = WishlistManager.has(product.id);
        const pid = product.id;

        return `
        <div class="product-card ${product.recommend ? 'best-seller' : ''}" style="animation:fadeInUp 0.4s ease both;">
            <div class="product-header">
                ${product.category !== 'other' ? `<span class="stock-badge ${stockClass}">${stockText}</span>` : ''}
                <div class="product-icon"><i class="fas ${icons[product.category] || 'fa-box'}"></i></div>
                <h3>${Utils.sanitize(product.name)}</h3>
                <div class="product-price">${Utils.formatRupiah(product.price)}<span style="font-size:0.7em;font-weight:400;color:var(--text-muted)">/bulan</span></div>
                ${sold > 0 ? `<div class="product-sold"><i class="fas fa-fire" style="color:var(--warning);"></i> ${sold} terjual</div>` : ''}
            </div>
            ${product.category !== 'other' ? `
            <div class="stock-progress-wrap">
                <div class="stock-progress-bar" style="width:${stockPct}%;background:${stockBarColor};"></div>
            </div>` : ''}
            <p class="product-desc">${Utils.sanitize(firstLine)}</p>
            <div class="product-features-preview">
                ${(product.features || []).slice(0, 3).map(f => `<span class="feat-tag"><i class="fas fa-check"></i> ${Utils.sanitize(f)}</span>`).join('')}
            </div>
            <div class="product-footer">
                <button class="btn btn-primary" onclick="showProductDetail(window._productCache['${pid}'])" ${isOutOfStock ? 'disabled' : ''}>
                    <i class="fas fa-cart-plus"></i> ${isOutOfStock ? 'Habis' : 'Beli'}
                </button>
                <button class="btn btn-outline" onclick="showProductDetail(window._productCache['${pid}'])">
                    <i class="fas fa-info-circle"></i>
                </button>
                <button class="btn btn-outline wishlist-btn" data-wishlist-id="${pid}"
                    onclick="WishlistManager.toggle('${pid}');this.querySelector('i').className=WishlistManager.has('${pid}')?'fas fa-heart':'far fa-heart';this.style.color=WishlistManager.has('${pid}')?'var(--danger)':'';"
                    title="Favorit" style="flex:0;padding:14px 13px;">
                    <i class="${inWishlist ? 'fas' : 'far'} fa-heart" style="color:${inWishlist ? 'var(--danger)' : ''}"></i>
                </button>
                <div class="product-actions-dropdown" style="position:relative;">
                    <button class="btn btn-outline" style="flex:0;padding:14px 13px;" onclick="this.nextElementSibling.classList.toggle('open')" title="Lainnya">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div class="dropdown-menu">
                        <button onclick="shareProductWA(window._productCache['${pid}']);this.closest('.dropdown-menu').classList.remove('open')">
                            <i class="fab fa-whatsapp" style="color:#25d366"></i> Share WA
                        </button>
                        <button onclick="copyProductLink('${pid}');this.closest('.dropdown-menu').classList.remove('open')">
                            <i class="fas fa-link"></i> Copy Link
                        </button>
                        <button onclick="toggleCompare(window._productCache['${pid}']);this.closest('.dropdown-menu').classList.remove('open')">
                            <i class="fas fa-balance-scale" style="color:${inCompare?'var(--primary)':''}"></i> ${inCompare ? 'Batal Bandingkan' : 'Bandingkan'}
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');

    // Update quick buy select
    const quickSelect = document.getElementById('quick-product');
    if (quickSelect) {
        quickSelect.innerHTML = '<option value="">Pilih Layanan...</option>' +
            products.filter(p => p.category === 'other' || p.stock > 0).map(p =>
                `<option value="${p.id}">${Utils.sanitize(p.name)} - ${Utils.formatRupiah(p.price)}</option>`
            ).join('');
    }

    // Tutup dropdown saat klik di luar (hanya tambah sekali)
    if (!window._dropdownListenerAdded) {
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.product-actions-dropdown')) {
                document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
            }
        });
        window._dropdownListenerAdded = true;
    }
}

// Wrap showProductDetail untuk recently viewed
const _origShowProductDetail = showProductDetail;
showProductDetail = function(product) {
    RecentlyViewed.add(product);
    RecentlyViewed.render();
    _origShowProductDetail(product);
};

window.showProductDetail = showProductDetail;
window.renderProducts = renderProducts;
// ========================================
// QRIS PAYMENT (via website-apii-ten.vercel.app)
// ========================================
const QRISPayment = {
    // State aktif transaksi
    _state: {
        active: false,
        orderId: null,
        transactionId: null,
        amount: 0,
        interval: null
    },

    _getConfig() {
        return {
            checkInterval: parseInt(localStorage.getItem('qris_check_interval') || '15000')
        };
    },

    async processCheckout() {
        const cart = CartManager.getItems();
        if (cart.length === 0) {
            Utils.showToast('Keranjang masih kosong!', 'error');
            return;
        }

        const cfg = this._getConfig();
        // Tidak perlu cek apikey/qrisCode — semua ada di server (/api/qris)

        // Hitung total dengan diskon
        let subtotal = CartManager.getTotal();
        let discount = 0;
        if (activePromo) {
            if (activePromo.discount)      discount = Math.floor(subtotal * activePromo.discount);
            if (activePromo.fixedDiscount) discount = activePromo.fixedDiscount;
        }
        const total = Math.max(subtotal - discount, 1000);
        const orderId = Utils.generateOrderId();

        // Kurangi stok
        cart.forEach(item => ProductManager.updateStock(item.id, item.quantity));
        setTimeout(() => renderProducts(currentCategory || 'all'), 100);

        // Simpan order ke MongoDB
        const userInfo = typeof AuthState !== 'undefined' && AuthState.isLoggedIn()
            ? { userId: AuthState.user._id, userName: AuthState.user.name, userEmail: AuthState.user.email }
            : {};
        fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Token': typeof AdminAuth !== 'undefined' ? AdminAuth.getToken() : '' },
            body: JSON.stringify({ orderId, items: cart, total, discount, promoCode: activePromo?.code || null, status: 'pending', ...userInfo })
        }).then(async (res) => {
            // Kirim notifikasi WhatsApp ke admin setelah order tersimpan
            if (res.ok) {
                const adminWA = localStorage.getItem('admin_wa') || '6282226769163';
                const itemNames = cart.map(i => `${i.name} x${i.quantity}`).join(', ');
                const msg = `🛒 *ORDER BARU!*\n\n📋 Order ID: ${orderId}\n💰 Total: ${Utils.formatRupiah(total)}\n📦 Produk: ${itemNames}\n${userInfo.userName ? `👤 Pembeli: ${userInfo.userName}` : ''}\n\nSegera proses pesanan ini!`;
                // Buka WA di background (tidak ganggu user)
                const waUrl = `https://wa.me/${adminWA}?text=${encodeURIComponent(msg)}`;
                // Simpan notif pending untuk admin
                const notifs = JSON.parse(localStorage.getItem('pending_notifs') || '[]');
                notifs.push({ orderId, total, items: itemNames, time: new Date().toISOString(), waUrl });
                localStorage.setItem('pending_notifs', JSON.stringify(notifs.slice(-20)));
            }
        }).catch(() => {});

        // Simpan ke transaksi user jika login
        if (typeof saveTransactionToDB === 'function') {
            saveTransactionToDB(orderId, cart, total, activePromo?.code || null, discount);
        }

        // Buat QRIS via server kita (credentials aman di server)
        Utils.showToast('Membuat QRIS pembayaran...', 'success');
        this._showQRISModal(total, orderId);
    },

    async _showQRISModal(amount, orderId) {
        this._openModal(amount, orderId, null, null);

        try {
            // Panggil API kita sendiri — server yang hubungi QRIS provider
            const res = await fetch('/api/qris', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create', amount, orderId })
            });

            const json = await res.json();

            if (!res.ok || !json.success) {
                this._closeModal();
                Utils.showToast(json.error || 'Gagal membuat QRIS. Hubungi admin.', 'error');
                return;
            }

            this._state.active        = true;
            this._state.orderId       = orderId;
            this._state.transactionId = json.transactionId;
            this._state.amount        = amount;

            this._openModal(amount, orderId, json.qrImageUrl, json.transactionId);

            if (this._state.interval) clearInterval(this._state.interval);
            const checkInterval = parseInt(localStorage.getItem('qris_check_interval') || '15000');
            this._state.interval = setInterval(() => this._checkStatus(), checkInterval);

        } catch(err) {
            this._closeModal();
            Utils.showToast('Gagal terhubung ke server pembayaran.', 'error');
            console.error('QRIS create error:', err);
        }
    },

    async _checkStatus() {
        if (!this._state.active) { clearInterval(this._state.interval); return; }
        try {
            const res = await fetch('/api/qris', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'check',
                    transactionId: this._state.transactionId,
                    amount: this._state.amount
                })
            });
            const json = await res.json();
            if (json.paid) {
                this._onPaymentSuccess();
            }
        } catch(err) { console.error('QRIS check error:', err); }
    },

    _onPaymentSuccess() {
        clearInterval(this._state.interval);
        this._state.active = false;

        // Update status order ke completed di MongoDB
        fetch(`/api/orders`, {
            method: 'GET',
            headers: { 'X-Admin-Token': '' }
        }).then(async () => {
            // Cari order by orderId dan update status
            const res = await fetch('/api/orders', { headers: { 'X-Admin-Token': '' } });
            if (res.ok) {
                const data = await res.json();
                const order = data.orders?.find(o => o.orderId === this._state.orderId);
                if (order?._id) {
                    fetch(`/api/orders?id=${order._id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': '' },
                        body: JSON.stringify({ status: 'completed' })
                    }).catch(() => {});
                }
            }
        }).catch(() => {});

        const trxId = 'ALFA' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');

        CartManager.clear();
        renderCart();

        const modal = document.getElementById('qris-payment-modal');
        if (modal) {
            modal.querySelector('#qris-loading-area').style.display = 'none';
            modal.querySelector('#qris-display-area').style.display = 'none';
            modal.querySelector('#qris-success-area').style.display = 'block';
            modal.querySelector('#qris-success-info').innerHTML = `
                <div style="text-align:center;padding:20px;">
                    <div style="font-size:4rem;margin-bottom:15px;">✅</div>
                    <h3 style="color:var(--accent);margin-bottom:10px;">Pembayaran Berhasil!</h3>
                    <p style="color:var(--text-secondary);margin-bottom:15px;">Terima kasih telah berbelanja di ALFA HOSTING</p>
                    <div style="background:var(--bg-glass);border:1px solid var(--border-color);border-radius:12px;padding:15px;text-align:left;font-size:0.9rem;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>💰 Jumlah</span><strong>${Utils.formatRupiah(this._state.amount)}</strong></div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>🆔 Order ID</span><code style="font-size:0.8rem;">${this._state.orderId}</code></div>
                        <div style="display:flex;justify-content:space-between;"><span>🎫 Transaksi</span><code style="font-size:0.8rem;">${trxId}</code></div>
                    </div>
                    <p style="color:var(--text-muted);font-size:0.85rem;margin-top:12px;">Admin akan segera memproses pesanan Anda.</p>
                    <a href="https://wa.me/6282226769163?text=${encodeURIComponent('Halo, saya sudah bayar order ' + this._state.orderId + '. Mohon diproses ya!')}" target="_blank" class="btn btn-primary" style="margin-top:15px;display:inline-flex;gap:8px;"><i class="fab fa-whatsapp"></i> Konfirmasi ke Admin</a>
                </div>`;
        }
        Utils.showToast('Pembayaran berhasil! 🎉', 'success');
    },

    cancel() {
        clearInterval(this._state.interval);
        this._state.active        = false;
        this._state.transactionId = null;
        this._state.amount        = 0;
        this._closeModal();
        Utils.showToast('Pembayaran dibatalkan.', 'warning');
    },

    _openModal(amount, orderId, qrImageUrl, transactionId) {
        let modal = document.getElementById('qris-payment-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'qris-payment-modal';
            modal.className = 'modal active';
            document.body.appendChild(modal);
        }

        const expiredIn = '5 menit';
        modal.innerHTML = `
        <div class="modal-content modal-sm" style="max-width:420px;">
            <div class="modal-header" style="text-align:center;">
                <h3 style="display:flex;align-items:center;justify-content:center;gap:10px;">
                    <i class="fas fa-qrcode" style="color:var(--primary);"></i> Bayar via QRIS
                </h3>
            </div>
            <div class="modal-body" style="text-align:center;">

                <!-- Loading -->
                <div id="qris-loading-area" style="${qrImageUrl ? 'display:none' : ''}">
                    <i class="fas fa-spinner fa-spin" style="font-size:3rem;color:var(--primary);margin:30px 0;display:block;"></i>
                    <p style="color:var(--text-secondary);">Membuat QRIS...</p>
                </div>

                <!-- QR Display -->
                <div id="qris-display-area" style="${qrImageUrl ? '' : 'display:none'}">
                    <div style="background:#fff;border-radius:16px;padding:16px;display:inline-block;margin-bottom:15px;box-shadow:0 4px 20px rgba(0,0,0,0.2);">
                        <img id="qris-image" src="${qrImageUrl || ''}" alt="QRIS" style="width:220px;height:220px;display:block;">
                    </div>
                    <div style="background:var(--bg-glass);border:1px solid var(--border-color);border-radius:12px;padding:14px;margin-bottom:15px;text-align:left;font-size:0.9rem;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:var(--text-secondary);">💰 Total Bayar</span><strong style="color:var(--accent);font-size:1.05rem;">${Utils.formatRupiah(amount)}</strong></div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:var(--text-secondary);">🆔 Order ID</span><code style="font-size:0.8rem;">${orderId}</code></div>
                        <div style="display:flex;justify-content:space-between;"><span style="color:var(--text-secondary);">⏰ Berlaku</span><span style="color:var(--warning);">${expiredIn}</span></div>
                        ${transactionId ? `<div style="display:flex;justify-content:space-between;margin-top:6px;"><span style="color:var(--text-secondary);">🔑 Transaksi</span><code style="font-size:0.75rem;">${transactionId}</code></div>` : ''}
                    </div>
                    <p style="color:var(--text-muted);font-size:0.82rem;margin-bottom:15px;">Scan QR di atas dengan aplikasi e-wallet atau m-banking. Sistem akan otomatis mendeteksi pembayaran.</p>
                    <div style="display:flex;align-items:center;gap:8px;justify-content:center;margin-bottom:15px;">
                        <div class="dot" style="width:8px;height:8px;background:var(--accent);border-radius:50%;animation:dotBounce 1.4s infinite;"></div>
                        <div class="dot" style="width:8px;height:8px;background:var(--accent);border-radius:50%;animation:dotBounce 1.4s 0.2s infinite;"></div>
                        <div class="dot" style="width:8px;height:8px;background:var(--accent);border-radius:50%;animation:dotBounce 1.4s 0.4s infinite;"></div>
                        <span style="color:var(--text-muted);font-size:0.82rem;">Menunggu pembayaran...</span>
                    </div>
                    <button onclick="QRISPayment.cancel()" class="btn btn-outline btn-full">
                        <i class="fas fa-times"></i> Batalkan Pembayaran
                    </button>
                </div>

                <!-- Success -->
                <div id="qris-success-area" style="display:none;">
                    <div id="qris-success-info"></div>
                    <button onclick="document.getElementById('qris-payment-modal').classList.remove('active')" class="btn btn-outline btn-full" style="margin-top:10px;">
                        <i class="fas fa-times"></i> Tutup
                    </button>
                </div>

            </div>
        </div>`;

        modal.classList.add('active');
        window.QRISPayment = QRISPayment; // pastikan accessible dari onclick
    },

    _closeModal() {
        const modal = document.getElementById('qris-payment-modal');
        if (modal) modal.classList.remove('active');
    }
};

// ========================================
// RENDER FUNCTIONS
// ========================================
let currentModalProduct = null;
let currentModalQty = 1;
let activePromo = null;

// ========================================
// PRODUCT MODAL FUNCTIONS
// ========================================
function showProductDetail(product) {
    if (!product) return;
    
    currentModalProduct = product;
    currentModalQty = 1;
    
    const modal = document.getElementById('product-modal');
    if (!modal) return;
    
    document.getElementById('modal-category').textContent = product.category.toUpperCase();
    document.getElementById('modal-title').textContent = Utils.sanitize(product.name);
    document.getElementById('modal-price').textContent = Utils.formatRupiah(product.price);
    document.getElementById('modal-desc').innerHTML = (product.desc || '').split('\n').map(line => 
        `<p>${Utils.sanitize(line)}</p>`
    ).join('');
    
    const features = product.features || [];
    document.getElementById('modal-features').innerHTML = features.map(f =>
        `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;">
            <i class="fas fa-check" style="color:var(--accent);"></i>
            <span>${Utils.sanitize(f)}</span>
        </div>`
    ).join('');
    
    const isOutOfStock = product.category !== 'other' && product.stock <= 0;
    const stockText = isOutOfStock ? 'HABIS' : `Stok: ${product.stock}`;
    document.getElementById('modal-stock').innerHTML = `<div style="color:${isOutOfStock ? 'var(--danger)' : 'var(--accent)'};font-weight:600;">${stockText}</div>`;
    
    document.getElementById('modal-qty').value = 1;
    document.getElementById('modal-add-btn').disabled = isOutOfStock;
    document.getElementById('modal-add-btn').textContent = isOutOfStock ? 'HABIS' : '+ Tambah ke Keranjang';
    
    modal.classList.add('active');
}

function closeProductModal() {
    document.getElementById('product-modal')?.classList.remove('active');
}

function changeModalQty(delta) {
    const input = document.getElementById('modal-qty');
    const newQty = Math.max(1, parseInt(input.value) + delta);
    input.value = newQty;
}

function addToCartFromModal() {
    if (!currentModalProduct) return;
    CartManager.addItem(currentModalProduct, parseInt(document.getElementById('modal-qty').value));
    closeProductModal();
}

// ========================================
// SEARCH & FILTER STATE
// ========================================
let currentSearchQuery = '';
let currentCategory = 'all';

function searchProducts(query) {
    currentSearchQuery = query.toLowerCase().trim();
    renderProducts(currentCategory);
}


// ========================================
// RENDER TESTIMONIALS (XSS-safe, with pagination)
// ========================================
let testiPage = 0;
const TESTI_PER_PAGE = 6;

function renderTestimonials(page = 0) {
    const container = document.getElementById('testimonials-slider');
    if (!container) return;

    const all = TestimonialManager.getAll().slice().reverse();
    const total = all.length;
    const start = page * TESTI_PER_PAGE;
    const testimonials = all.slice(start, start + TESTI_PER_PAGE);

    container.innerHTML = testimonials.map(t => {
        const stars = Array(5).fill(0).map((_, i) =>
            `<i class="${i < t.rating ? 'fas' : 'far'} fa-star" style="color:${i < t.rating ? 'var(--warning)' : '#4b5563'};"></i>`
        ).join('');
        const safeName = Utils.sanitize(t.name || 'Anonim');
        const safeMsg = Utils.sanitize(t.message || '');
        const initials = safeName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        return `
            <div class="testimonial-card">
                <div class="testimonial-header">
                    <div class="testimonial-avatar">${initials}</div>
                    <div class="testimonial-info">
                        <h4>${safeName}</h4>
                        <div class="testimonial-date">${Utils.formatDate(t.date)}</div>
                    </div>
                </div>
                <div class="testimonial-rating">${stars}</div>
                <p class="testimonial-text">${safeMsg}</p>
            </div>`;
    }).join('');

    // Pagination controls
    const hasMore = start + TESTI_PER_PAGE < total;
    const hasPrev = page > 0;
    let paginationHtml = '';
    if (hasPrev || hasMore) {
        paginationHtml = `<div class="testi-pagination" style="text-align:center;margin-top:30px;display:flex;gap:10px;justify-content:center;">
            ${hasPrev ? `<button class="btn btn-outline" onclick="renderTestimonials(${page - 1})"><i class="fas fa-chevron-left"></i> Sebelumnya</button>` : ''}
            <span style="display:flex;align-items:center;color:var(--text-secondary);font-size:0.9rem;">${page + 1} / ${Math.ceil(total / TESTI_PER_PAGE)}</span>
            ${hasMore ? `<button class="btn btn-outline" onclick="renderTestimonials(${page + 1})">Selanjutnya <i class="fas fa-chevron-right"></i></button>` : ''}
        </div>`;
    }

    // Remove old pagination if exists
    const oldPagination = document.querySelector('.testi-pagination');
    if (oldPagination) oldPagination.remove();
    container.insertAdjacentHTML('afterend', paginationHtml);
}

// ========================================
// TESTIMONIAL MODAL
// ========================================
function openTestimonialModal() {
    document.getElementById('testimonial-modal').classList.add('active');
}

function closeTestimonialModal() {
    document.getElementById('testimonial-modal').classList.remove('active');
}

// ========================================
// QUICK BUY
// ========================================
function quickBuy() {
    const select = document.getElementById('quick-product');
    const productId = select?.value;
    
    if (!productId) {
        Utils.showToast('Pilih layanan terlebih dahulu!', 'warning');
        return;
    }
    
    const product = ProductManager.getById(productId);
    if (!product) {
        Utils.showToast('Produk tidak ditemukan!', 'error');
        return;
    }
    
    CartManager.addItem(product, 1);
    select.value = '';
    
    // Scroll to cart
    setTimeout(() => {
        document.getElementById('cart')?.scrollIntoView({ behavior: 'smooth' });
    }, 300);
}

// ========================================
// RENDER CART
// ========================================
function renderCart() {
    const cartMain = document.getElementById('cart-main');
    const cartSidebar = document.getElementById('cart-sidebar');
    if (!cartMain || !cartSidebar) return;

    const items = CartManager.getItems();
    
    if (items.length === 0) {
        cartMain.innerHTML = `<div class="empty-cart">
            <div class="empty-icon">
                <i class="fas fa-shopping-cart"></i>
            </div>
            <h3>Keranjang Masih Kosong</h3>
            <p>Yuk, pilih layanan yang Anda butuhkan!</p>
            <a href="#services" class="btn btn-primary">
                <i class="fas fa-arrow-right"></i> Lihat Layanan
            </a>
        </div>`;
        cartSidebar.style.display = 'none';
        return;
    }

    // Render cart items
    cartMain.innerHTML = items.map((item, idx) => `
        <div class="cart-item">
            <div class="cart-item-icon">
                <i class="fas fa-box"></i>
            </div>
            <div class="cart-item-info">
                <h4>${Utils.sanitize(item.name)}</h4>
                <p>${Utils.formatRupiah(item.price)}</p>
            </div>
            <div class="cart-item-qty">
                <button onclick="CartManager.updateQuantity(${idx}, ${item.quantity - 1})"><i class="fas fa-minus"></i></button>
                <input type="number" value="${item.quantity}" readonly>
                <button onclick="CartManager.updateQuantity(${idx}, ${item.quantity + 1})"><i class="fas fa-plus"></i></button>
            </div>
            <div style="text-align:right;min-width:120px;">
                <div style="font-weight:700;color:var(--accent);">${Utils.formatRupiah(item.price * item.quantity)}</div>
                <button class="btn btn-outline btn-sm" onclick="CartManager.removeItem(${idx})" style="margin-top:8px;">
                    <i class="fas fa-trash"></i> Hapus
                </button>
            </div>
        </div>
    `).join('');

    // Update summary
    const subtotal = CartManager.getTotal();
    const discount = activePromo ? Math.floor(subtotal * activePromo.discount) : 0;
    const total = subtotal - discount;

    document.getElementById('subtotal-price').textContent = Utils.formatRupiah(subtotal);
    document.getElementById('discount-price').textContent = Utils.formatRupiah(discount);
    document.getElementById('total-price').textContent = Utils.formatRupiah(total);
    document.getElementById('promo-code').value = activePromo?.code || '';

    cartSidebar.style.display = 'block';
}

// ========================================
// PROMO CODE
// ========================================
const PROMO_CODES = {
    'ALFA20': { discount: 0.20, label: 'Diskon 20%' },
    'NEWUSER': { discount: 0.15, label: 'Diskon 15% untuk pengguna baru' }
};

function applyPromo() {
    const input = document.getElementById('promo-code');
    const code = (input.value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    if (!code) {
        Utils.showToast('Masukkan kode promo!', 'warning');
        return;
    }

    const promo = PROMO_CODES[code];
    if (promo) {
        activePromo = { code, ...promo };
        Utils.showToast(`Kode ${code} berhasil! ${promo.label}`, 'success');
        renderCart(); // re-render to apply discount
    } else {
        activePromo = null;
        Utils.showToast('Kode promo tidak valid!', 'error');
    }
}

// ========================================
// ========================================
// CHECKOUT
// ========================================
function processCheckout() {
    QRISPayment.processCheckout();
}

// ========================================
// INITIALIZATION & EVENT LISTENERS
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    // Load QRIS config dari MongoDB (agar tersinkron antar device)
    loadQRISConfig();

    // Track visitor REAL ke MongoDB
    trackVisitor();

    // Track visitor lama (localStorage) — hapus
    // const visits = parseInt(localStorage.getItem('total_visits') || '0') + 1;
    // localStorage.setItem('total_visits', visits);

    // Init data
    ProductManager.init();
    TestimonialManager.init();
    WishlistManager.updateUI();
    
    // Render UI
    renderProducts();
    renderCart();
    renderTestimonials();
    renderRatingSummary();
    renderBestsellerStrip();
    renderBundles();
    RecentlyViewed.render();
    CartManager.updateUI();
    
    // Loading screen
    setTimeout(() => {
        document.getElementById('loading-screen')?.classList.add('hidden');
    }, 1200);
    
    // Counter animation — wait for loading screen to hide
    setTimeout(() => {
        document.querySelectorAll('.stat-number').forEach(el => {
            const target = parseFloat(el.dataset.count);
            if (target) Utils.animateCounter(el, target);
        });
    }, 1400);
    
    // Theme toggle
    const themeBtn = document.getElementById('theme-btn');
    themeBtn?.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        const isLight = document.body.classList.contains('light-mode');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        themeBtn.innerHTML = isLight ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    });
    
    // Load saved theme
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
        if (themeBtn) themeBtn.innerHTML = '<i class="fas fa-sun"></i>';
    }
    
    // Mobile menu
    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
        document.getElementById('nav-menu').classList.toggle('active');
    });

    // Close mobile menu on outside click
    document.addEventListener('click', (e) => {
        const nav = document.getElementById('nav-menu');
        const btn = document.getElementById('mobile-menu-btn');
        if (nav?.classList.contains('active') && !nav.contains(e.target) && !btn?.contains(e.target)) {
            nav.classList.remove('active');
        }
    });

    // Product search bar (if exists)
    const searchInput = document.getElementById('product-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => searchProducts(e.target.value));
    }
    
    // Category tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderProducts(btn.dataset.category);
        });
    });
    
    // Chat widget
    const chatWidget = document.getElementById('chat-widget');
    const chatToggle = document.getElementById('chat-toggle');
    const chatClose = document.getElementById('chat-close');
    
    chatToggle?.addEventListener('click', () => {
        chatWidget.classList.add('active');
        chatToggle.style.display = 'none';
        document.getElementById('chat-input')?.focus();
    });
    
    chatClose?.addEventListener('click', () => {
        chatWidget.classList.remove('active');
        chatToggle.style.display = 'flex';
    });
    
    document.getElementById('chat-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('chat-input');
        const rawMessage = input.value.trim();
        if (!rawMessage) return;
        
        const body = document.getElementById('chat-body');
        const userDiv = document.createElement('div');
        userDiv.className = 'chat-message user';
        userDiv.innerHTML = `<div class="message-content"></div>`;
        userDiv.querySelector('.message-content').textContent = rawMessage;
        body.appendChild(userDiv);
        
        input.value = '';
        input.disabled = true;
        body.scrollTop = body.scrollHeight;
        
        // Typing indicator
        const typingDiv = document.createElement('div');
        typingDiv.className = 'chat-message bot typing-indicator';
        typingDiv.innerHTML = '<div class="message-content"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
        body.appendChild(typingDiv);
        body.scrollTop = body.scrollHeight;
        
        const response = await ChatBot.getResponse(rawMessage);
        typingDiv.remove();
        input.disabled = false;
        input.focus();
        
        const botDiv = document.createElement('div');
        botDiv.className = 'chat-message bot';
        botDiv.innerHTML = `<div class="message-content">${Utils.sanitize(response).replace(/\n/g, '<br>')}</div>`;
        body.appendChild(botDiv);
        body.scrollTop = body.scrollHeight;
    });
    
    // FAQ accordion
    document.querySelectorAll('.faq-question').forEach(q => {
        q.addEventListener('click', () => {
            const item = q.parentElement;
            const wasActive = item.classList.contains('active');
            // Close all
            document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
            // Open clicked if wasn't active
            if (!wasActive) item.classList.add('active');
        });
    });
    
    // Rating stars in testimonial form
    const ratingContainer = document.getElementById('rating-input');
    const ratingInput = document.getElementById('testi-rating');

    if (ratingContainer && ratingInput) {
        const stars = Array.from(ratingContainer.querySelectorAll('i'));
        
        const updateStars = (value) => {
            stars.forEach((s, i) => {
                s.className = i < value ? 'fas fa-star active' : 'far fa-star';
                s.style.color = i < value ? '#ffc107' : '#ccc';
            });
        };

        // Hover preview
        stars.forEach((star, index) => {
            star.addEventListener('mouseenter', () => updateStars(index + 1));
            star.addEventListener('mouseleave', () => updateStars(parseInt(ratingInput.value) || 5));
            star.addEventListener('click', () => {
                ratingInput.value = index + 1;
                updateStars(index + 1);
            });
        });

        // Init with 5 stars
        updateStars(5);
    }

    // Testimonial form submit
    const testiForm = document.getElementById('testimonial-form');
    if (testiForm) {
        testiForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const rawName = (document.getElementById('testi-name').value || '').trim();
            const rawMessage = (document.getElementById('testi-message').value || '').trim();
            const rating = parseInt(document.getElementById('testi-rating').value) || 5;
            
            if (!rawName || rawName.length < 2) { Utils.showToast('Nama minimal 2 karakter!', 'error'); return; }
            if (!rawMessage || rawMessage.length < 10) { Utils.showToast('Pesan minimal 10 karakter!', 'error'); return; }
            if (rawName.length > 50) { Utils.showToast('Nama maksimal 50 karakter!', 'error'); return; }
            if (rawMessage.length > 500) { Utils.showToast('Pesan maksimal 500 karakter!', 'error'); return; }

            const name = rawName.replace(/[<>]/g, '').substring(0, 50);
            const message = rawMessage.replace(/[<>]/g, '').substring(0, 500);
            
            if (TestimonialManager.add({ name, rating, message })) {
                Utils.showToast('Testimoni berhasil ditambahkan! Terima kasih 🎉');
                renderTestimonials();
                closeTestimonialModal();
                testiForm.reset();
                if (ratingInput) ratingInput.value = 5;
                if (ratingContainer) {
                    const stars = Array.from(ratingContainer.querySelectorAll('i'));
                    stars.forEach(s => { s.className = 'fas fa-star active'; s.style.color = '#ffc107'; });
                }
            }
        });
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                document.getElementById('nav-menu')?.classList.remove('active');
            }
        });
    });
    
    // Active nav on scroll
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-menu a');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${entry.target.id}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }, { threshold: 0.3 });

    sections.forEach(s => observer.observe(s));

    // Header scroll effect
    window.addEventListener('scroll', () => {
        const header = document.getElementById('header');
        if (header) {
            header.style.boxShadow = window.scrollY > 50 ? '0 4px 30px rgba(0,0,0,0.3)' : 'none';
        }
    }, { passive: true });
});

// Expose functions globally
window.showProductDetail = showProductDetail;
window.closeProductModal = closeProductModal;
window.changeModalQty = changeModalQty;
window.addToCartFromModal = addToCartFromModal;
window.quickBuy = quickBuy;
window.openTestimonialModal = openTestimonialModal;
window.closeTestimonialModal = closeTestimonialModal;
window.applyPromo = applyPromo;
window.processCheckout = processCheckout;
window.QRISPayment = QRISPayment;
window.searchProducts = searchProducts;
window.renderTestimonials = renderTestimonials;
window.CartManager = CartManager;
window.ProductManager = ProductManager;
window.TestimonialManager = TestimonialManager;
window.Utils = Utils;


// ============================================================
// ===== FITUR BARU v2.3 — 15 FITUR TAMBAHAN ==================
// ============================================================

// ============================================================
// FITUR WEBSITE 1: SCROLL PROGRESS BAR
// ============================================================
window.addEventListener('scroll', () => {
    const bar = document.getElementById('scroll-progress');
    if (!bar) return;
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (docHeight > 0 ? (scrollTop / docHeight) * 100 : 0) + '%';
}, { passive: true });

// ============================================================
// FITUR WEBSITE 2: NEWSLETTER
// ============================================================
const NewsletterManager = {
    getSubscribers() {
        try { return JSON.parse(localStorage.getItem('newsletter_subscribers')) || []; }
        catch { return []; }
    },
    add(name, email) {
        const subs = this.getSubscribers();
        if (subs.find(s => s.email === email)) return false; // already subscribed
        subs.push({ name, email, date: new Date().toISOString(), code: 'WELCOME10' });
        localStorage.setItem('newsletter_subscribers', JSON.stringify(subs));
        return true;
    }
};

function openNewsletterModal() {
    // Don't show if already subscribed
    const email = localStorage.getItem('newsletter_email');
    if (email) {
        Utils.showToast('Kamu sudah terdaftar newsletter! 🎉');
        return;
    }
    document.getElementById('newsletter-modal')?.classList.add('active');
}

function closeNewsletterModal() {
    document.getElementById('newsletter-modal')?.classList.remove('active');
}

function submitNewsletter(e) {
    e.preventDefault();
    const name = document.getElementById('newsletter-name').value.trim();
    const email = document.getElementById('newsletter-email').value.trim();
    if (!name || !email) return;

    const added = NewsletterManager.add(name, email);
    if (added) {
        localStorage.setItem('newsletter_email', email);
        closeNewsletterModal();
        // Show success with promo code
        Swal.fire({
            title: '🎉 Berhasil Daftar!',
            html: `Halo <strong>${Utils.sanitize(name)}</strong>!<br>Gunakan kode <strong style="color:#10b981;font-size:1.3rem;letter-spacing:2px;">WELCOME10</strong><br>untuk diskon 10% di pembelian pertama!`,
            icon: 'success',
            confirmButtonText: 'Pakai Sekarang',
            background: '#1a1a2e',
            color: '#fff'
        }).then(r => {
            if (r.isConfirmed) {
                const promoInput = document.getElementById('promo-code');
                if (promoInput) {
                    promoInput.value = 'WELCOME10';
                    document.getElementById('cart')?.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    } else {
        Utils.showToast('Email sudah terdaftar!', 'warning');
        closeNewsletterModal();
    }
}

// Auto-show newsletter popup after 30s (only once)
if (!localStorage.getItem('newsletter_shown') && !localStorage.getItem('newsletter_email')) {
    setTimeout(() => {
        localStorage.setItem('newsletter_shown', '1');
        openNewsletterModal();
    }, 30000);
}

// ============================================================
// FITUR WEBSITE 3: REFERRAL CODE SYSTEM
// ============================================================
const ReferralManager = {
    getCode() {
        let code = localStorage.getItem('my_referral_code');
        if (!code) {
            code = 'REF-' + Math.random().toString(36).substring(2, 7).toUpperCase();
            localStorage.setItem('my_referral_code', code);
        }
        return code;
    },
    getStats() {
        return JSON.parse(localStorage.getItem('referral_stats') || '{"clicks":0,"signups":0,"orders":0}');
    },
    trackClick() {
        const stats = this.getStats();
        stats.clicks++;
        localStorage.setItem('referral_stats', JSON.stringify(stats));
    }
};

// Check if arrived via referral link
(function checkReferral() {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref && ref !== ReferralManager.getCode()) {
        localStorage.setItem('referred_by', ref);
        // Give discount to referred user
        Utils.showToast('🎁 Kamu datang via referral! Diskon 10% sudah aktif.', 'success');
        localStorage.setItem('referral_discount_active', '1');
    }
})();

function openReferralModal() {
    const code = ReferralManager.getCode();
    const stats = ReferralManager.getStats();
    const el = document.getElementById('referral-code-display');
    if (el) el.textContent = code;
    const clicks = document.getElementById('ref-clicks');
    const signups = document.getElementById('ref-signups');
    const orders = document.getElementById('ref-orders');
    if (clicks) clicks.textContent = stats.clicks;
    if (signups) signups.textContent = stats.signups;
    if (orders) orders.textContent = stats.orders;
    document.getElementById('referral-modal')?.classList.add('active');
}

function copyReferralCode() {
    const code = ReferralManager.getCode();
    const url = `${window.location.origin}${window.location.pathname}?ref=${code}`;
    navigator.clipboard.writeText(url).then(() => {
        ReferralManager.trackClick();
        Utils.showToast('Link referral disalin! 🔗');
    }).catch(() => Utils.showToast('Gagal menyalin', 'error'));
}

function shareReferralWA() {
    const code = ReferralManager.getCode();
    const url = `${window.location.origin}${window.location.pathname}?ref=${code}`;
    const msg = `Hei! Coba layanan hosting keren di ALFA HOSTING 🚀\nPakai link referral aku dan dapat diskon 10%!\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    ReferralManager.trackClick();
}

// ============================================================
// FITUR WEBSITE 4: FAB MENU (Floating Action Button)
// ============================================================
let fabOpen = false;
function toggleFabMenu() {
    fabOpen = !fabOpen;
    const items = document.getElementById('fab-items');
    const icon = document.getElementById('fab-icon');
    if (items) items.style.display = fabOpen ? 'flex' : 'none';
    if (icon) icon.className = fabOpen ? 'fas fa-times' : 'fas fa-plus';
}

// Close FAB on outside click
document.addEventListener('click', (e) => {
    if (fabOpen && !e.target.closest('.fab-group')) {
        fabOpen = false;
        const items = document.getElementById('fab-items');
        const icon = document.getElementById('fab-icon');
        if (items) items.style.display = 'none';
        if (icon) icon.className = 'fas fa-plus';
    }
});

// ============================================================
// FITUR WEBSITE 5: LIVE VISITOR COUNTER — REAL dari MongoDB
// ============================================================
(function initLiveVisitors() {
    async function update() {
        const el = document.getElementById('live-visitor-count');
        if (!el) return;
        try {
            const res = await fetch('/api/visitors?type=live');
            if (res.ok) {
                const data = await res.json();
                el.textContent = data.live || 1;
            }
        } catch {
            // Fallback: tampilkan 1 (minimal ada pengunjung saat ini)
            el.textContent = el.textContent || '1';
        }
    }
    update();
    setInterval(update, 30000); // update setiap 30 detik
})();

// ============================================================
// FITUR WEBSITE 6: VOUCHER VALIDATION (extend applyPromo)
// ============================================================
const VoucherManager = {
    getAll() {
        try { return JSON.parse(localStorage.getItem('vouchers')) || []; }
        catch { return []; }
    },
    validate(code) {
        const vouchers = this.getAll();
        const v = vouchers.find(v => v.code === code.toUpperCase() && v.active);
        if (!v) return null;
        // Check expiry
        if (v.expiry && new Date(v.expiry) < new Date()) return null;
        // Check max use
        if (v.maxUse > 0 && v.usedCount >= v.maxUse) return null;
        return v;
    },
    use(code) {
        const vouchers = this.getAll();
        const idx = vouchers.findIndex(v => v.code === code.toUpperCase());
        if (idx !== -1) {
            vouchers[idx].usedCount = (vouchers[idx].usedCount || 0) + 1;
            localStorage.setItem('vouchers', JSON.stringify(vouchers));
        }
    }
};

// Override applyPromo to also check vouchers
const _origApplyPromo = applyPromo;
applyPromo = function() {
    const input = document.getElementById('promo-code');
    const code = (input?.value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) { Utils.showToast('Masukkan kode promo!', 'warning'); return; }

    // Check vouchers first
    const voucher = VoucherManager.validate(code);
    if (voucher) {
        const subtotal = CartManager.getTotal();
        if (voucher.minPurchase > 0 && subtotal < voucher.minPurchase) {
            Utils.showToast(`Min. pembelian ${Utils.formatRupiah(voucher.minPurchase)}!`, 'warning');
            return;
        }
        activePromo = {
            code: voucher.code,
            discount: voucher.type === 'percent' ? voucher.value / 100 : null,
            fixedDiscount: voucher.type === 'fixed' ? voucher.value : null,
            label: voucher.type === 'percent' ? `Diskon ${voucher.value}%` : `Diskon ${Utils.formatRupiah(voucher.value)}`
        };
        Utils.showToast(`Voucher ${code} berhasil! ${activePromo.label}`, 'success');
        renderCart();
        return;
    }
    // Fall back to original promo codes
    _origApplyPromo();
};

// ============================================================
// FITUR WEBSITE 7: MAINTENANCE MODE CHECK
// ============================================================
(function checkMaintenance() {
    // JANGAN tampilkan maintenance di halaman admin
    if (window.location.pathname.includes('admin')) return;

    const maintenance = localStorage.getItem('maintenance_mode') === 'true';
    if (maintenance) {
        const msg = localStorage.getItem('maintenance_message') || 'Website sedang dalam pemeliharaan. Silakan coba lagi nanti.';
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#0a0a0f;z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:20px;';
        overlay.innerHTML = `
            <div style="font-size:4rem;margin-bottom:20px;">🔧</div>
            <h1 style="color:#fff;font-size:2rem;margin-bottom:15px;">Mode Maintenance</h1>
            <p style="color:#a1a1aa;max-width:400px;line-height:1.6;">${Utils.sanitize(msg)}</p>
            <p style="color:#6366f1;margin-top:20px;font-size:0.9rem;">Hubungi kami: <a href="https://wa.me/6282226769163" style="color:#10b981;">WhatsApp</a></p>
        `;
        document.body.appendChild(overlay);
    }
})();

// ============================================================
// FITUR WEBSITE 8: PRODUCT BUNDLE DEALS
// ============================================================
const BundleManager = {
    getBundles() {
        return JSON.parse(localStorage.getItem('bundles') || '[]');
    },
    getDefault() {
        return [
            {
                id: 'bundle1',
                name: '🚀 Starter Pack',
                desc: 'VPS Basic + Panel 2GB + Jasa Install',
                products: ['vps1', 'pnl2', 'jasa1'],
                discount: 15,
                active: true
            },
            {
                id: 'bundle2',
                name: '💼 Business Pack',
                desc: 'VPS Standard 4GB + Panel Unlimited + Jasa Buat Website',
                products: ['vps4', 'pnl-unl', 'jasa5'],
                discount: 20,
                active: true
            }
        ];
    }
};

// Render bundles section if element exists
function renderBundles() {
    const container = document.getElementById('bundles-grid');
    if (!container) return;
    const bundles = BundleManager.getDefault();
    container.innerHTML = bundles.map(b => {
        const products = b.products.map(id => ProductManager.getById(id)).filter(Boolean);
        const originalPrice = products.reduce((s, p) => s + p.price, 0);
        const discountedPrice = Math.floor(originalPrice * (1 - b.discount / 100));
        return `
        <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:25px;position:relative;overflow:hidden;">
            <div style="position:absolute;top:15px;right:15px;background:var(--danger);color:white;border-radius:50px;padding:4px 12px;font-size:0.75rem;font-weight:700;">-${b.discount}%</div>
            <h3 style="margin-bottom:8px;">${b.name}</h3>
            <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:15px;">${b.desc}</p>
            <div style="margin-bottom:15px;">
                ${products.map(p => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-color);font-size:0.85rem;"><i class="fas fa-check" style="color:var(--accent);"></i>${Utils.sanitize(p.name)}</div>`).join('')}
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:15px;">
                <div>
                    <div style="text-decoration:line-through;color:var(--text-muted);font-size:0.85rem;">${Utils.formatRupiah(originalPrice)}</div>
                    <div style="font-size:1.4rem;font-weight:800;color:var(--accent);">${Utils.formatRupiah(discountedPrice)}</div>
                </div>
                <button class="btn btn-primary" onclick="addBundleToCart(${JSON.stringify(b.products).replace(/"/g,'&quot;')})">
                    <i class="fas fa-cart-plus"></i> Beli Bundle
                </button>
            </div>
        </div>`;
    }).join('');
}

function addBundleToCart(productIds) {
    let added = 0;
    productIds.forEach(id => {
        const p = ProductManager.getById(id);
        if (p) { CartManager.addItem(p, 1); added++; }
    });
    if (added > 0) {
        Utils.showToast(`${added} produk bundle ditambahkan ke keranjang! 🎁`);
        setTimeout(() => document.getElementById('cart')?.scrollIntoView({ behavior: 'smooth' }), 500);
    }
}

window.addBundleToCart = addBundleToCart;
window.openNewsletterModal = openNewsletterModal;
window.closeNewsletterModal = closeNewsletterModal;
window.submitNewsletter = submitNewsletter;
window.openReferralModal = openReferralModal;
window.copyReferralCode = copyReferralCode;
window.shareReferralWA = shareReferralWA;
window.toggleFabMenu = toggleFabMenu;
window.VoucherManager = VoucherManager;
window.NewsletterManager = NewsletterManager;
window.ReferralManager = ReferralManager;


// ================================================================
// ===== UPDATE v3.0 — 20 FITUR BARU (27 April 2026) =====
// ================================================================

// ============================================================
// FITUR 1: CART DRAWER (slide panel dari kanan)
// ============================================================
function openCartDrawer() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-drawer-overlay');
    if (!drawer) return;
    renderCartDrawer();
    drawer.style.right = '0';
    if (overlay) overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeCartDrawer() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-drawer-overlay');
    if (drawer) drawer.style.right = '-420px';
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
}

function renderCartDrawer() {
    const items = CartManager.getItems();
    const itemsEl = document.getElementById('cart-drawer-items');
    const footerEl = document.getElementById('cart-drawer-footer');
    if (!itemsEl) return;

    if (items.length === 0) {
        itemsEl.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--text-muted);">
            <i class="fas fa-shopping-cart" style="font-size:3rem;opacity:0.3;display:block;margin-bottom:15px;"></i>
            <p>Keranjang masih kosong</p></div>`;
        if (footerEl) footerEl.innerHTML = '';
        return;
    }

    const icons = { vps:'fa-server', panel:'fa-gamepad', other:'fa-tools' };
    itemsEl.innerHTML = items.map((item, i) => `
        <div style="display:flex;gap:15px;padding:15px 0;border-bottom:1px solid var(--border-color);align-items:center;">
            <div style="width:48px;height:48px;background:var(--gradient-primary);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;">
                <i class="fas ${icons[item.category]||'fa-box'}"></i>
            </div>
            <div style="flex:1;min-width:0;">
                <div style="font-weight:600;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.sanitize(item.name)}</div>
                <div style="color:var(--primary);font-weight:700;">${Utils.formatRupiah(item.price)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                <button onclick="CartManager.updateQuantity(${i},${item.quantity-1});renderCartDrawer();updateStickyOrder();" style="width:28px;height:28px;border-radius:8px;border:1px solid var(--border-color);background:none;color:var(--text-primary);cursor:pointer;">−</button>
                <span style="min-width:20px;text-align:center;font-weight:600;">${item.quantity}</span>
                <button onclick="CartManager.updateQuantity(${i},${item.quantity+1});renderCartDrawer();updateStickyOrder();" style="width:28px;height:28px;border-radius:8px;border:1px solid var(--border-color);background:none;color:var(--text-primary);cursor:pointer;">+</button>
                <button onclick="CartManager.removeItem(${i});renderCartDrawer();updateStickyOrder();" style="width:28px;height:28px;border-radius:8px;border:none;background:rgba(239,68,68,0.15);color:var(--danger);cursor:pointer;"><i class="fas fa-trash" style="font-size:0.75rem;"></i></button>
            </div>
        </div>`).join('');

    const subtotal = CartManager.getTotal();
    let discount = 0;
    if (activePromo) {
        discount = activePromo.discount ? Math.floor(subtotal * activePromo.discount) : (activePromo.fixedDiscount || 0);
    }
    const total = subtotal - discount;

    footerEl.innerHTML = `
        <div style="margin-bottom:15px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;color:var(--text-secondary);font-size:0.9rem;"><span>Subtotal</span><span>${Utils.formatRupiah(subtotal)}</span></div>
            ${discount > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px;color:var(--accent);font-size:0.9rem;"><span>Diskon (${activePromo.code})</span><span>-${Utils.formatRupiah(discount)}</span></div>` : ''}
            <div style="display:flex;justify-content:space-between;font-weight:700;font-size:1.1rem;padding-top:10px;border-top:1px solid var(--border-color);"><span>Total</span><span style="color:var(--primary);">${Utils.formatRupiah(total)}</span></div>
        </div>
        <button class="btn btn-primary btn-full" onclick="closeCartDrawer();processCheckout();" style="margin-bottom:10px;"><i class="fas fa-credit-card"></i> Checkout Sekarang</button>
        <button class="btn btn-outline btn-full" onclick="closeCartDrawer()">Lanjut Belanja</button>`;
}

window.openCartDrawer = openCartDrawer;
window.closeCartDrawer = closeCartDrawer;

// ============================================================
// FITUR 2: STICKY ORDER SUMMARY
// ============================================================
function updateStickyOrder() {
    const sticky = document.getElementById('sticky-order');
    const countEl = document.getElementById('sticky-count');
    const totalEl = document.getElementById('sticky-total');
    if (!sticky) return;
    const count = CartManager.getItemCount();
    if (count > 0) {
        sticky.style.display = 'block';
        if (countEl) countEl.textContent = count;
        if (totalEl) totalEl.textContent = Utils.formatRupiah(CartManager.getTotal());
    } else {
        sticky.style.display = 'none';
    }
}

// Patch CartManager.updateUI untuk juga update sticky
const _origCartUpdateUI = CartManager.updateUI.bind(CartManager);
CartManager.updateUI = function() {
    _origCartUpdateUI();
    updateStickyOrder();
};

// ============================================================
// FITUR 3: FLASH SALE BANNER
// ============================================================
const FlashSale = {
    timer: null,
    check() {
        const data = JSON.parse(localStorage.getItem('flash_sale') || 'null');
        if (!data || !data.active) return;
        const remaining = data.endTime - Date.now();
        if (remaining <= 0) {
            localStorage.removeItem('flash_sale');
            const bar = document.getElementById('flash-sale-bar');
            if (bar) bar.style.display = 'none';
            return;
        }
        const bar = document.getElementById('flash-sale-bar');
        if (!bar) return;
        bar.style.display = 'block';
        const pctEl = document.getElementById('flash-pct');
        const nameEl = document.getElementById('flash-product-name');
        const timerEl = document.getElementById('flash-timer');
        if (pctEl) pctEl.textContent = data.discount;
        if (nameEl) nameEl.textContent = data.productName;
        if (timerEl) {
            const m = Math.floor(remaining / 60000);
            const s = Math.floor((remaining % 60000) / 1000);
            timerEl.textContent = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        }
    },
    start() {
        this.check();
        this.timer = setInterval(() => this.check(), 1000);
    }
};

// ============================================================
// FITUR 4: COOKIE CONSENT
// ============================================================
function acceptCookies() {
    localStorage.setItem('cookies_accepted', 'true');
    const banner = document.getElementById('cookie-banner');
    if (banner) banner.style.display = 'none';
}

function checkCookieConsent() {
    if (!localStorage.getItem('cookies_accepted')) {
        setTimeout(() => {
            const banner = document.getElementById('cookie-banner');
            if (banner) banner.style.display = 'flex';
        }, 3000);
    }
}

window.acceptCookies = acceptCookies;

// ============================================================
// FITUR 5: QUICK VIEW MODAL
// ============================================================
function openQuickView(productId) {
    const product = ProductManager.getById(productId);
    if (!product) return;
    const modal = document.getElementById('quick-view-modal');
    const body = document.getElementById('quick-view-body');
    if (!modal || !body) return;

    const isOut = product.category !== 'other' && product.stock <= 0;
    const icons = { vps:'fa-server', panel:'fa-gamepad', other:'fa-tools' };
    body.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:25px;padding:25px;">
            <div style="background:var(--gradient-primary);border-radius:var(--radius-lg);display:flex;align-items:center;justify-content:center;min-height:200px;">
                <i class="fas ${icons[product.category]||'fa-box'}" style="font-size:5rem;color:#fff;opacity:0.9;"></i>
            </div>
            <div>
                <h2 style="margin-bottom:10px;">${Utils.sanitize(product.name)}</h2>
                <div style="font-size:1.8rem;font-weight:800;color:var(--primary);margin-bottom:15px;">${Utils.formatRupiah(product.price)}<span style="font-size:0.7em;font-weight:400;color:var(--text-muted);">/bulan</span></div>
                <div style="margin-bottom:15px;">
                    ${(product.features||[]).map(f=>`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:0.9rem;"><i class="fas fa-check" style="color:var(--accent);"></i>${Utils.sanitize(f)}</div>`).join('')}
                </div>
                <div style="display:flex;gap:10px;margin-top:20px;">
                    <button class="btn btn-primary" onclick="CartManager.addItem(ProductManager.getById('${product.id}'),1);closeQuickView();" ${isOut?'disabled':''}>
                        <i class="fas fa-cart-plus"></i> ${isOut?'Habis':'Tambah ke Keranjang'}
                    </button>
                    <button class="btn btn-outline" onclick="WishlistManager.toggle('${product.id}');Utils.showToast('Favorit diupdate!');">
                        <i class="${WishlistManager.has(product.id)?'fas':'far'} fa-heart"></i>
                    </button>
                </div>
            </div>
        </div>`;
    modal.classList.add('active');
}

function closeQuickView() {
    document.getElementById('quick-view-modal')?.classList.remove('active');
}

window.openQuickView = openQuickView;
window.closeQuickView = closeQuickView;

// ============================================================
// FITUR 6: REVIEW / ULASAN PRODUK
// ============================================================
let reviewRating = 0;

function openReviewModal() {
    const modal = document.getElementById('review-modal');
    if (!modal) return;
    reviewRating = 0;
    // Populate product select
    const sel = document.getElementById('review-product');
    if (sel) {
        sel.innerHTML = '<option value="">Pilih produk...</option>' +
            ProductManager.getAll().map(p => `<option value="${p.id}">${Utils.sanitize(p.name)}</option>`).join('');
    }
    // Setup stars
    const stars = document.querySelectorAll('#review-stars i');
    stars.forEach(star => {
        star.addEventListener('mouseover', () => {
            const r = parseInt(star.dataset.r);
            stars.forEach((s,i) => s.className = i < r ? 'fas fa-star' : 'far fa-star');
        });
        star.addEventListener('mouseout', () => {
            stars.forEach((s,i) => s.className = i < reviewRating ? 'fas fa-star' : 'far fa-star');
        });
        star.addEventListener('click', () => {
            reviewRating = parseInt(star.dataset.r);
            stars.forEach((s,i) => s.className = i < reviewRating ? 'fas fa-star' : 'far fa-star');
        });
    });
    modal.classList.add('active');
}

function submitReview() {
    const name = document.getElementById('review-name')?.value.trim();
    const text = document.getElementById('review-text')?.value.trim();
    const product = document.getElementById('review-product')?.value;
    if (!name || name.length < 2) { Utils.showToast('Nama minimal 2 karakter!', 'error'); return; }
    if (!reviewRating) { Utils.showToast('Pilih rating bintang!', 'error'); return; }
    if (!text || text.length < 10) { Utils.showToast('Ulasan minimal 10 karakter!', 'error'); return; }

    const reviews = JSON.parse(localStorage.getItem('product_reviews') || '[]');
    reviews.push({
        id: Date.now(),
        name: name.replace(/[<>]/g,''),
        rating: reviewRating,
        text: text.replace(/[<>]/g,''),
        productId: product,
        date: new Date().toISOString().split('T')[0],
        approved: false
    });
    localStorage.setItem('product_reviews', JSON.stringify(reviews));
    document.getElementById('review-modal')?.classList.remove('active');
    Utils.showToast('Ulasan dikirim! Menunggu persetujuan admin. ⭐');
}

window.openReviewModal = openReviewModal;
window.submitReview = submitReview;

// ============================================================
// FITUR 7: NOTIFICATION CENTER
// ============================================================
const NotifManager = {
    getAll() { return JSON.parse(localStorage.getItem('notifications') || '[]'); },
    add(msg, type = 'info', icon = 'fa-bell') {
        const notifs = this.getAll();
        notifs.unshift({ id: Date.now(), msg, type, icon, time: new Date().toLocaleTimeString('id-ID'), read: false });
        if (notifs.length > 20) notifs.pop();
        localStorage.setItem('notifications', JSON.stringify(notifs));
        this.updateBadge();
        this.render();
    },
    markRead() {
        const notifs = this.getAll().map(n => ({...n, read: true}));
        localStorage.setItem('notifications', JSON.stringify(notifs));
        this.updateBadge();
    },
    updateBadge() {
        const unread = this.getAll().filter(n => !n.read).length;
        const badge = document.getElementById('notif-badge');
        if (badge) { badge.textContent = unread; badge.style.display = unread > 0 ? 'flex' : 'none'; }
    },
    render() {
        const list = document.getElementById('notif-list');
        if (!list) return;
        const notifs = this.getAll();
        if (notifs.length === 0) {
            list.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-muted);"><i class="fas fa-bell-slash" style="font-size:2rem;opacity:0.3;display:block;margin-bottom:10px;"></i><p>Tidak ada notifikasi</p></div>`;
            return;
        }
        const colors = { info:'var(--info)', success:'var(--accent)', warning:'var(--warning)', error:'var(--danger)' };
        list.innerHTML = notifs.map(n => `
            <div style="padding:14px 20px;border-bottom:1px solid var(--border-color);${!n.read?'background:rgba(99,102,241,0.05);':''}display:flex;gap:12px;align-items:flex-start;">
                <i class="fas ${n.icon}" style="color:${colors[n.type]||colors.info};margin-top:3px;flex-shrink:0;"></i>
                <div style="flex:1;"><div style="font-size:0.9rem;">${n.msg}</div><div style="font-size:0.75rem;color:var(--text-muted);margin-top:3px;">${n.time}</div></div>
            </div>`).join('');
    }
};

function toggleNotifPanel() {
    const panel = document.getElementById('notif-panel');
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) { NotifManager.markRead(); NotifManager.render(); }
}

function clearNotifications() {
    localStorage.removeItem('notifications');
    NotifManager.render();
    NotifManager.updateBadge();
}

window.toggleNotifPanel = toggleNotifPanel;
window.clearNotifications = clearNotifications;

// ============================================================
// FITUR 8: DARK/LIGHT MODE OTOMATIS BERDASARKAN WAKTU
// ============================================================
function autoThemeByTime() {
    if (localStorage.getItem('theme')) return; // user sudah pilih manual
    const hour = new Date().getHours();
    const isDark = hour < 6 || hour >= 18; // gelap 18:00–06:00
    if (!isDark) {
        document.body.classList.add('light-mode');
        const btn = document.getElementById('theme-btn');
        if (btn) btn.innerHTML = '<i class="fas fa-sun"></i>';
    }
}

// ============================================================
// FITUR 9: PRODUCT SEARCH SUGGESTIONS (autocomplete)
// ============================================================
function initSearchSuggestions() {
    const input = document.getElementById('product-search-input');
    if (!input) return;

    let suggestBox = document.getElementById('search-suggestions');
    if (!suggestBox) {
        suggestBox = document.createElement('div');
        suggestBox.id = 'search-suggestions';
        suggestBox.style.cssText = 'position:absolute;top:100%;left:0;right:0;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);z-index:1000;max-height:250px;overflow-y:auto;display:none;box-shadow:var(--shadow);';
        input.parentElement.style.position = 'relative';
        input.parentElement.appendChild(suggestBox);
    }

    input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        if (q.length < 2) { suggestBox.style.display = 'none'; return; }
        const matches = ProductManager.getAll().filter(p =>
            p.name.toLowerCase().includes(q) || (p.features||[]).some(f => f.toLowerCase().includes(q))
        ).slice(0, 6);
        if (matches.length === 0) { suggestBox.style.display = 'none'; return; }
        suggestBox.innerHTML = matches.map(p => `
            <div onclick="searchProducts('${p.name.replace(/'/g,"\\'")}');document.getElementById('search-suggestions').style.display='none';"
                style="padding:10px 16px;cursor:pointer;display:flex;align-items:center;gap:10px;font-size:0.9rem;transition:background 0.2s;"
                onmouseover="this.style.background='var(--bg-glass)'" onmouseout="this.style.background=''">
                <i class="fas fa-search" style="color:var(--text-muted);font-size:0.8rem;"></i>
                <span>${Utils.sanitize(p.name)}</span>
                <span style="margin-left:auto;color:var(--primary);font-weight:600;">${Utils.formatRupiah(p.price)}</span>
            </div>`).join('');
        suggestBox.style.display = 'block';
    });

    document.addEventListener('click', e => {
        if (!input.contains(e.target)) suggestBox.style.display = 'none';
    });
}

// ============================================================
// FITUR 10: ORDER TRACKING (cek status pesanan)
// ============================================================
function openOrderTracking() {
    const orderId = prompt('Masukkan Order ID kamu (contoh: HJBS-xxx-xxx):');
    if (!orderId) return;
    const history = JSON.parse(localStorage.getItem('salesHistory') || '[]');
    const orders = history.filter(o => o.orderId === orderId.trim().toUpperCase());
    if (orders.length === 0) {
        Utils.showToast('Order ID tidak ditemukan!', 'error');
        return;
    }
    const statusMap = { pending:'⏳ Menunggu Pembayaran', completed:'✅ Selesai', cancelled:'❌ Dibatalkan' };
    const total = orders.reduce((s, o) => s + o.price * o.quantity, 0);
    const status = orders[0].status || 'pending';
    Swal.fire({
        title: `Order ${orderId}`,
        html: `
            <div style="text-align:left;">
                <p style="margin-bottom:10px;"><strong>Status:</strong> ${statusMap[status]||status}</p>
                <p style="margin-bottom:10px;"><strong>Tanggal:</strong> ${new Date(orders[0].date).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</p>
                <p style="margin-bottom:15px;"><strong>Total:</strong> ${Utils.formatRupiah(total)}</p>
                <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:10px;">
                    ${orders.map(o=>`<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:0.9rem;"><span>${Utils.sanitize(o.name)}</span><span>${Utils.formatRupiah(o.price*o.quantity)}</span></div>`).join('')}
                </div>
            </div>`,
        background: '#1a1a2e', color: '#fff',
        confirmButtonText: 'Tutup'
    });
}

window.openOrderTracking = openOrderTracking;

// ============================================================
// INIT SEMUA FITUR WEBSITE BARU
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // Fitur 1: Cart drawer — update sticky saat load
    updateStickyOrder();

    // Fitur 3: Flash sale
    FlashSale.start();

    // Fitur 4: Cookie consent
    checkCookieConsent();

    // Fitur 7: Notif badge
    NotifManager.updateBadge();

    // Fitur 8: Auto theme
    autoThemeByTime();

    // Fitur 9: Search suggestions
    initSearchSuggestions();

    // Tambahkan notif selamat datang jika baru
    if (!localStorage.getItem('welcomed')) {
        NotifManager.add('Selamat datang di ALFA HOSTING! 🚀 Gunakan kode ALFA20 untuk diskon 20%.', 'success', 'fa-rocket');
        localStorage.setItem('welcomed', '1');
    }

    // Tambahkan tombol notif ke header jika belum ada
    const headerActions = document.querySelector('.header-actions');
    if (headerActions && !document.getElementById('notif-btn')) {
        const notifBtn = document.createElement('button');
        notifBtn.id = 'notif-btn';
        notifBtn.className = 'cart-btn';
        notifBtn.title = 'Notifikasi';
        notifBtn.style.position = 'relative';
        notifBtn.onclick = toggleNotifPanel;
        notifBtn.innerHTML = '<i class="fas fa-bell"></i><span class="cart-count" id="notif-badge" style="display:none;background:var(--danger);">0</span>';
        headerActions.insertBefore(notifBtn, headerActions.firstChild);
    }

    // Tambahkan tombol ulasan & tracking ke footer/nav
    const fabItems = document.getElementById('fab-items');
    if (fabItems) {
        const reviewBtn = document.createElement('button');
        reviewBtn.className = 'fab-item';
        reviewBtn.title = 'Tulis Ulasan';
        reviewBtn.onclick = openReviewModal;
        reviewBtn.innerHTML = '<i class="fas fa-star"></i>';
        fabItems.appendChild(reviewBtn);

        const trackBtn = document.createElement('button');
        trackBtn.className = 'fab-item';
        trackBtn.title = 'Cek Pesanan';
        trackBtn.onclick = openOrderTracking;
        trackBtn.innerHTML = '<i class="fas fa-search"></i>';
        fabItems.appendChild(trackBtn);
    }
});

// ============================================================
// FITUR BARU 1: NOTIFIKASI ADMIN — tampilkan di dashboard
// ============================================================
function checkPendingNotifications() {
    const notifs = JSON.parse(localStorage.getItem('pending_notifs') || '[]');
    if (notifs.length === 0) return;

    // Tampilkan badge notifikasi di header
    const badge = document.getElementById('notif-badge');
    if (badge) { badge.textContent = notifs.length; badge.style.display = 'flex'; }
}

// Cek notif saat halaman load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(checkPendingNotifications, 2000);
});

window.checkPendingNotifications = checkPendingNotifications;

// ============================================================
// FITUR BARU 2: ORDER TRACKING — cek status order by ID
// ============================================================
function trackOrder() {
    const orderId = prompt('Masukkan Order ID kamu (contoh: HJBS-xxx-xxx):');
    if (!orderId) return;

    // Cek dari riwayat transaksi user (jika login)
    if (typeof AuthState !== 'undefined' && AuthState.isLoggedIn()) {
        const txns = AuthState.transactions || [];
        const found = txns.find(t => t.orderId === orderId.trim().toUpperCase());
        if (found) {
            const statusMap = { pending: '⏳ Menunggu Pembayaran', completed: '✅ Selesai', cancelled: '❌ Dibatalkan' };
            Swal.fire({
                title: `Order ${found.orderId}`,
                html: `
                    <div style="text-align:left;font-size:0.9rem;">
                        <p><strong>Status:</strong> ${statusMap[found.status] || found.status}</p>
                        <p><strong>Total:</strong> ${Utils.formatRupiah(found.total)}</p>
                        <p><strong>Tanggal:</strong> ${new Date(found.createdAt).toLocaleDateString('id-ID')}</p>
                        <p><strong>Produk:</strong> ${found.items?.map(i => i.name).join(', ') || '-'}</p>
                    </div>`,
                icon: found.status === 'completed' ? 'success' : 'info',
                confirmButtonText: 'OK',
                background: '#1a1a2e',
                color: '#fff'
            });
            return;
        }
    }

    // Fallback: arahkan ke WhatsApp
    const msg = `Halo, saya ingin cek status order ${orderId.trim().toUpperCase()}`;
    window.open(`https://wa.me/6282226769163?text=${encodeURIComponent(msg)}`, '_blank');
}

window.trackOrder = trackOrder;

// ============================================================
// FITUR BARU 3: CETAK INVOICE / STRUK PEMBELIAN
// ============================================================
function printInvoice(orderId, items, total, discount) {
    const date = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const itemRows = (items || CartManager.getItems()).map(i =>
        `<tr><td>${i.name}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">${Utils.formatRupiah(i.price)}</td><td style="text-align:right">${Utils.formatRupiah(i.price * i.quantity)}</td></tr>`
    ).join('');

    const win = window.open('', '_blank');
    win.document.write(`
    <!DOCTYPE html><html><head><title>Invoice ${orderId}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; color: #333; }
        h1 { color: #6366f1; } table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #6366f1; color: white; padding: 10px; }
        td { padding: 8px; border-bottom: 1px solid #eee; }
        .total { font-size: 1.2rem; font-weight: bold; color: #6366f1; }
        .footer { margin-top: 30px; text-align: center; color: #888; font-size: 0.85rem; }
        @media print { button { display: none; } }
    </style></head><body>
    <h1>🚀 ALFA HOSTING</h1>
    <p>Invoice #${orderId || 'N/A'} | Tanggal: ${date}</p>
    <hr>
    <table>
        <thead><tr><th>Produk</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead>
        <tbody>${itemRows}</tbody>
    </table>
    ${discount > 0 ? `<p>Diskon: -${Utils.formatRupiah(discount)}</p>` : ''}
    <p class="total">Total: ${Utils.formatRupiah(total || CartManager.getTotal())}</p>
    <hr>
    <div class="footer">
        <p>ALFA HOSTING | WhatsApp: +62 822-2676-9163 | alfaofficial.my.id</p>
        <p>Terima kasih telah berbelanja!</p>
    </div>
    <br><button onclick="window.print()" style="background:#6366f1;color:white;padding:10px 20px;border:none;border-radius:8px;cursor:pointer;font-size:1rem;">🖨️ Print Invoice</button>
    </body></html>`);
    win.document.close();
}

window.printInvoice = printInvoice;

// ============================================================
// FITUR BARU 4: DARK/LIGHT MODE TOGGLE ANIMASI
// ============================================================
function toggleThemeAnimated() {
    const body = document.body;
    body.style.transition = 'background 0.4s ease, color 0.4s ease';
    body.classList.toggle('light-mode');
    const isLight = body.classList.contains('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    const btn = document.getElementById('theme-btn');
    if (btn) btn.innerHTML = isLight ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    setTimeout(() => { body.style.transition = ''; }, 500);
}

// ============================================================
// FITUR BARU 5: SHARE PRODUK KE SOSMED
// ============================================================
function shareProduct(productId, platform) {
    const product = ProductManager.getById(productId);
    if (!product) return;

    const url = `${window.location.origin}${window.location.pathname}?product=${productId}`;
    const text = `Cek ${product.name} di ALFA HOSTING — hanya ${Utils.formatRupiah(product.price)}/bulan! 🚀`;

    const shareUrls = {
        wa: `https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`,
        twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
        fb: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        copy: null
    };

    if (platform === 'copy') {
        navigator.clipboard.writeText(url).then(() => Utils.showToast('Link disalin! 🔗'));
        return;
    }

    if (shareUrls[platform]) window.open(shareUrls[platform], '_blank');
}

window.shareProduct = shareProduct;

// ============================================================
// FITUR BARU 6: KONFIRMASI PEMBAYARAN MANUAL VIA WA
// ============================================================
function confirmPaymentWA(orderId, total) {
    const msg = `Halo Admin ALFA HOSTING! 👋\n\nSaya sudah melakukan pembayaran:\n📋 Order ID: ${orderId}\n💰 Total: ${Utils.formatRupiah(total)}\n\nMohon segera diproses. Terima kasih! 🙏`;
    window.open(`https://wa.me/6282226769163?text=${encodeURIComponent(msg)}`, '_blank');
}

window.confirmPaymentWA = confirmPaymentWA;
