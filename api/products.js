/**
 * API: /api/products
 * CRUD produk — semua data produk tersimpan di MongoDB
 *
 * GET  /api/products              — ambil semua produk (public)
 * GET  /api/products?id=xxx       — ambil satu produk (public)
 * GET  /api/products?category=vps — filter by kategori (public)
 * POST /api/products              — tambah produk (admin)
 * PUT  /api/products?id=xxx       — update produk (admin)
 * DELETE /api/products?id=xxx     — hapus produk (admin)
 * POST /api/products?action=init  — inisialisasi produk default (admin)
 * POST /api/products?action=restock — tambah stok (admin)
 */

import { getCollection } from './db.js';
import { ObjectId } from 'mongodb';

function setCORS(req, res) {
    const origin = req.headers.origin || '';
    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
    if (allowed.includes(origin) || allowed.includes('*') || process.env.NODE_ENV !== 'production') {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
}

async function isAdmin(token) {
    if (!token) return false;
    const sessions = await getCollection('admin_sessions');
    const s = await sessions.findOne({ token, expiresAt: { $gt: new Date() } });
    return !!s;
}

function sanitize(str, max = 500) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>]/g, '').trim().substring(0, max);
}

// Produk default
const DEFAULT_PRODUCTS = [
    { id: 'vps1', category: 'vps', name: 'VPS BASIC 1GB', price: 15000, stock: 15, desc: "✅ RAM: 1GB Dedicated\n✅ CPU: 1 Core High Performance\n✅ Storage: 20GB NVMe SSD\n✅ Bandwidth: 1TB\n✅ OS: Linux (Ubuntu/Debian/CentOS)\n🚀 Cocok untuk: Tunneling, Bot Ringan, VPN", features: ["1GB RAM", "1 Core CPU", "20GB NVMe", "1TB Bandwidth", "Linux OS"] },
    { id: 'vps2', category: 'vps', name: 'VPS BASIC 2GB', price: 25000, stock: 20, desc: "✅ RAM: 2GB Dedicated\n✅ CPU: 1 Core High Performance\n✅ Storage: 50GB NVMe SSD\n✅ Bandwidth: 2TB\n✅ Akses Root Full Control\n🚀 Cocok untuk: Hosting Web Kecil, VPN Pribadi", features: ["2GB RAM", "1 Core CPU", "50GB NVMe", "2TB Bandwidth", "Root Access"] },
    { id: 'vps3', category: 'vps', name: 'VPS STANDARD 2GB', price: 30000, stock: 12, desc: "✅ RAM: 2GB Dedicated\n✅ CPU: 2 Core (Multithread)\n✅ Storage: 50GB NVMe SSD\n✅ Bandwidth: 2TB\n✅ Anti-DDoS Basic\n🚀 Cocok untuk: Script Multiprocess, Database", features: ["2GB RAM", "2 Core CPU", "50GB NVMe", "2TB Bandwidth", "Anti-DDoS"] },
    { id: 'vps4', category: 'vps', name: 'VPS STANDARD 4GB', price: 35000, stock: 25, recommend: true, desc: "🔥 BEST SELLER!\n✅ RAM: 4GB Dedicated\n✅ CPU: 2 Core High Performance\n✅ Storage: 80GB NVMe SSD\n✅ Bandwidth: 4TB\n✅ Support Docker\n🚀 Cocok untuk: Game Server (MCPE/SAMP), Bot Music, Store Online", features: ["4GB RAM", "2 Core CPU", "80GB NVMe", "4TB Bandwidth", "Docker Support"] },
    { id: 'vps5', category: 'vps', name: 'VPS HIGH 8GB', price: 45000, stock: 8, desc: "✅ RAM: 8GB Dedicated\n✅ CPU: 4 Core Extreme\n✅ Storage: 160GB NVMe SSD\n✅ Bandwidth: 5TB\n✅ Virtualisasi KVM\n🚀 Cocok untuk: Server Minecraft Java, Website Traffic Tinggi", features: ["8GB RAM", "4 Core CPU", "160GB NVMe", "5TB Bandwidth", "KVM"] },
    { id: 'vps6', category: 'vps', name: 'VPS PRO 16GB', price: 70000, stock: 5, desc: "✅ RAM: 16GB Dedicated\n✅ CPU: 4 Core Extreme\n✅ Storage: 240GB NVMe SSD\n✅ Bandwidth: 5TB\n✅ Network 1Gbps\n🚀 Cocok untuk: Komunitas Game Besar, App Server Berat", features: ["16GB RAM", "4 Core CPU", "240GB NVMe", "5TB Bandwidth", "1Gbps Network"] },
    { id: 'vps7', category: 'vps', name: 'VPS ENTERPRISE 32GB', price: 120000, stock: 3, desc: "👑 ENTERPRISE CLASS\n✅ RAM: 32GB Dedicated\n✅ CPU: 8 Core Xeon\n✅ Storage: 500GB NVMe SSD\n✅ Bandwidth: 10TB\n✅ Priority Support\n🚀 Cocok untuk: Perusahaan, Enterprise App", features: ["32GB RAM", "8 Core CPU", "500GB NVMe", "10TB Bandwidth", "Priority Support"] },
    { id: 'pnl1', category: 'panel', name: 'PANEL 1GB HEMAT', price: 1000, stock: 100, desc: "🔹 RAM: 1GB\n🔹 CPU: 35%\n🔹 Disk: 1GB\n🔹 Server: Indonesia\n✨ Cocok untuk coba-coba atau script bot sangat ringan", features: ["1GB RAM", "35% CPU", "1GB Disk", "Indonesia Server"] },
    { id: 'pnl2', category: 'panel', name: 'PANEL 2GB HEMAT', price: 2000, stock: 80, desc: "🔹 RAM: 2GB\n🔹 CPU: 50%\n🔹 Disk: 2GB\n🔹 Server: Indonesia\n✨ Cocok untuk Bot WhatsApp Single Session", features: ["2GB RAM", "50% CPU", "2GB Disk", "Indonesia Server"] },
    { id: 'pnl3', category: 'panel', name: 'PANEL 3GB', price: 3000, stock: 60, desc: "🔹 RAM: 3GB\n🔹 CPU: 95%\n🔹 Disk: 3GB\n🔹 Server: Indonesia\n✨ Stabil untuk Bot Discord atau WA Multi-Device", features: ["3GB RAM", "95% CPU", "3GB Disk", "Indonesia Server"] },
    { id: 'pnl4', category: 'panel', name: 'PANEL 4GB', price: 4000, stock: 50, desc: "🔹 RAM: 4GB\n🔹 CPU: 110%\n🔹 Disk: 4GB\n🔹 Server: Singapore\n✨ Kuat untuk menjalankan 2-3 script bot sekaligus", features: ["4GB RAM", "110% CPU", "4GB Disk", "Singapore Server"] },
    { id: 'pnl5', category: 'panel', name: 'PANEL 5GB', price: 5000, stock: 40, desc: "🔹 RAM: 5GB\n🔹 CPU: 135%\n🔹 Disk: 5GB\n🔹 Server: Singapore Premium\n✨ Rekomendasi untuk Server SAMP/MTA dengan player sedang", features: ["5GB RAM", "135% CPU", "5GB Disk", "Singapore Premium"] },
    { id: 'pnl6', category: 'panel', name: 'PANEL 6GB', price: 6000, stock: 35, desc: "🔹 RAM: 6GB\n🔹 CPU: 160%\n🔹 Disk: 6GB\n🔹 Server: Singapore Premium\n✨ Performa tinggi untuk kebutuhan hosting medium", features: ["6GB RAM", "160% CPU", "6GB Disk", "Singapore Premium"] },
    { id: 'pnl7', category: 'panel', name: 'PANEL 7GB', price: 7000, stock: 30, desc: "🔹 RAM: 7GB\n🔹 CPU: 185%\n🔹 Disk: 7GB\n🔹 Server: Singapore Premium\n✨ Cocok untuk Bot Music High Quality Audio", features: ["7GB RAM", "185% CPU", "7GB Disk", "Singapore Premium"] },
    { id: 'pnl8', category: 'panel', name: 'PANEL 8GB TURBO', price: 8000, stock: 25, desc: "🔹 RAM: 8GB\n🔹 CPU: 200%\n🔹 Disk: 8GB\n🔹 Server: Singapore Premium\n✨ Sangat lancar untuk Minecraft PE server kecil", features: ["8GB RAM", "200% CPU", "8GB Disk", "Singapore Premium"] },
    { id: 'pnl9', category: 'panel', name: 'PANEL 9GB TURBO', price: 9000, stock: 20, desc: "🔹 RAM: 9GB\n🔹 CPU: 300%\n🔹 Disk: 9GB\n🔹 Performa Stabil & Cepat\n✨ Pilihan terbaik sebelum upgrade ke Unlimited", features: ["9GB RAM", "300% CPU", "9GB Disk", "Premium Performance"] },
    { id: 'pnl10', category: 'panel', name: 'PANEL 10GB TURBO', price: 10000, stock: 15, desc: "🔹 RAM: 10GB\n🔹 CPU: 350%\n🔹 Disk: 10GB\n🔹 Server: Singapore Premium\n✨ Performa maksimal untuk game server medium", features: ["10GB RAM", "350% CPU", "10GB Disk", "Premium Server"] },
    { id: 'pnl-unl', category: 'panel', name: 'PANEL UNLIMITED', price: 15000, stock: 10, recommend: true, desc: "👑 KHUSUS SULTAN\n♾️ RAM: Unlimited\n♾️ CPU: Unlimited\n♾️ Disk: Unlimited\n🛡️ Garansi Anti Suspend (S&K)\n✨ Bebas deploy apa saja sepuasnya!", features: ["Unlimited RAM", "Unlimited CPU", "Unlimited Disk", "Anti Suspend"] },
    { id: 'pnl-reseller', category: 'panel', name: 'RESELLER PANEL', price: 25000, stock: 8, desc: "💼 PAKET USAHA RESELLER\n✅ Dapat Akun Reseller\n✅ Bisa Membuat Panel Sendiri\n✅ Bisa Jual Panel ke Orang Lain\n✅ Full Support\n💰 Cocok untuk pemula bisnis hosting", features: ["Reseller Access", "Create Panel", "Full Support", "Bisnis Ready"] },
    { id: 'pnl-admin', category: 'panel', name: 'ADMIN PANEL', price: 35000, stock: 5, recommend: true, desc: "💼 PAKET USAHA ADMIN\n✅ Dapat Akun Admin Panel\n✅ Full Akses Create/Delete Server\n✅ Bisa Open Reseller Panel\n✅ Prioritas Support\n💰 Potensi Balik Modal Sangat Cepat!", features: ["Admin Access", "Full Control", "Create Reseller", "Priority Support"] },
    { id: 'pnl-owner', category: 'panel', name: 'OWNER PANEL', price: 50000, stock: 3, desc: "🏢 TINGKAT TERTINGGI\n✅ Akses Panel Owner\n✅ Bisa Bikin Admin & Reseller\n✅ Full Control Resource Server\n✅ Prioritas Support 24/7\n✅ Akses ke Database Panel", features: ["Owner Access", "Create Admin", "Full Control", "Database Access"] },
    { id: 'pnl-pt', category: 'panel', name: 'PARTNER PANEL', price: 75000, stock: 2, recommend: true, desc: "🤝 PAKET PARTNER\n✅ Join Manajemen\n✅ Akses Database Panel\n✅ Bebas Pasang Iklan di Panel\n✅ Full Support Teknis\n✅ Bagi Hasil 70/30", features: ["Partner Access", "Database Full", "Custom Ads", "Revenue Share"] },
    { id: 'jasa1', category: 'other', name: 'JASA INSTALL PANEL', price: 15000, stock: 999, desc: "🛠️ Terima Beres!\nKami instalkan Panel Pterodactyl di VPS Anda.\nTermasuk konfigurasi Domain & SSL (HTTPS).\n✅ Support Ubuntu 20.04/22.04", features: ["Panel Install", "Domain Config", "SSL Setup", "Full Support"] },
    { id: 'jasa2', category: 'other', name: 'BASH AUTOSCRIPT', price: 20000, stock: 999, desc: "📜 Script Auto Install\nBuat Panel Pterodactyl sendiri hanya dengan 1 baris perintah.\n✅ Support Ubuntu 20.04/22.04\n✅ Include Wings Setup", features: ["Auto Script", "One Command", "Wings Setup", "Full Tutorial"] },
    { id: 'jasa3', category: 'other', name: 'JASA RENAME SCRIPT', price: 25000, stock: 999, desc: "✏️ Rebranding Script\nGanti nama author, credit, dan tampilan script bot agar terlihat seperti milik Anda sendiri.\n✅ Include Logo Custom", features: ["Rebranding", "Custom Logo", "Full Source", "No Copyright"] },
    { id: 'jasa4', category: 'other', name: 'FIX ERROR SCRIPT', price: 10000, stock: 999, desc: "🔧 Bot Anda Error?\nKami bantu perbaiki error pada script Bot WA/Telegram/Discord.\n✅ Garansi Fix\n✅ Support 24 Jam", features: ["Error Fixing", "All Platforms", "Fast Response", "Guaranteed"] },
    { id: 'jasa5', category: 'other', name: 'JASA BUAT WEBSITE', price: 75000, stock: 999, desc: "🌐 Website Profesional\nLanding Page, Top Up Game, atau Company Profile.\n✅ Desain Responsif & Modern\n✅ SEO Friendly\n✅ Full Source Code", features: ["Responsive Design", "Modern UI", "SEO Friendly", "Full Source"] },
    { id: 'jasa6', category: 'other', name: 'JASA BUAT BOT WA', price: 50000, stock: 999, desc: "🤖 Bot WhatsApp Custom\nBot sesuai kebutuhan Anda dengan fitur lengkap.\n✅ Include Deploy\n✅ Full Source Code\n✅ Tutorial Penggunaan", features: ["Custom Bot", "Full Feature", "Include Deploy", "Tutorial"] },
    { id: 'jasa7', category: 'other', name: 'JASA OPTIMASI VPS', price: 20000, stock: 999, desc: "⚡ Optimasi Performa VPS\nTuning VPS untuk performa maksimal.\n✅ Swap Config\n✅ Network Optimize\n✅ Security Hardening", features: ["Performance Tuning", "Swap Config", "Network Optimize", "Security"] },
    { id: 'jasa8', category: 'other', name: 'JASA BACKUP & RESTORE', price: 15000, stock: 999, desc: "💾 Backup & Restore Data\nBackup data penting Anda ke cloud storage.\n✅ Google Drive\n✅ Auto Schedule\n✅ Easy Restore", features: ["Cloud Backup", "Auto Schedule", "Easy Restore", "Full Support"] }
];

export default async function handler(req, res) {
    setCORS(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const adminToken = req.headers['x-admin-token'];
    const admin = await isAdmin(adminToken);
    const products = await getCollection('products');
    const { id, category, action } = req.query;

    try {
        // ── GET ──────────────────────────────────────────────
        if (req.method === 'GET') {
            let query = {};
            if (id) query = { id };
            if (category && category !== 'all') query.category = category;

            const data = await products.find(query).sort({ category: 1, price: 1 }).toArray();

            // Jika kosong, kembalikan default (belum diinit)
            if (data.length === 0 && !id && !category) {
                return res.status(200).json({ products: DEFAULT_PRODUCTS, source: 'default' });
            }

            if (id) {
                const product = data[0];
                if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan' });
                return res.status(200).json({ product });
            }

            return res.status(200).json({ products: data, total: data.length });
        }

        // ── POST action=init ─────────────────────────────────
        if (req.method === 'POST' && action === 'init') {
            if (!admin) return res.status(401).json({ error: 'Admin only' });
            const count = await products.countDocuments();
            if (count > 0) return res.status(409).json({ error: 'Produk sudah ada', count });

            const now = new Date();
            const docs = DEFAULT_PRODUCTS.map(p => ({ ...p, createdAt: now, updatedAt: now }));
            await products.insertMany(docs);
            return res.status(201).json({ success: true, inserted: docs.length });
        }

        // ── POST action=restock ──────────────────────────────
        if (req.method === 'POST' && action === 'restock') {
            if (!admin) return res.status(401).json({ error: 'Admin only' });
            const { productId, amount } = req.body;
            if (!productId || !amount || amount <= 0) {
                return res.status(400).json({ error: 'productId dan amount diperlukan' });
            }
            await products.updateOne(
                { id: productId },
                { $inc: { stock: parseInt(amount) }, $set: { updatedAt: new Date(), outOfStock: false } }
            );
            return res.status(200).json({ success: true });
        }

        // ── POST — tambah produk ─────────────────────────────
        if (req.method === 'POST') {
            if (!admin) return res.status(401).json({ error: 'Admin only' });
            const { name, category: cat, price, stock, desc, features, recommend } = req.body;
            if (!name || !cat || !price) return res.status(400).json({ error: 'name, category, price diperlukan' });

            const newProduct = {
                id: 'prod_' + Date.now().toString(36),
                name: sanitize(name, 200),
                category: ['vps', 'panel', 'other'].includes(cat) ? cat : 'other',
                price: parseInt(price) || 0,
                stock: cat === 'other' ? 999 : (parseInt(stock) || 10),
                desc: sanitize(desc || '', 1000),
                features: Array.isArray(features) ? features.map(f => sanitize(f, 100)) : [],
                recommend: !!recommend,
                outOfStock: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            await products.insertOne(newProduct);
            return res.status(201).json({ success: true, product: newProduct });
        }

        // ── PUT — update produk ──────────────────────────────
        if (req.method === 'PUT') {
            if (!admin) return res.status(401).json({ error: 'Admin only' });
            if (!id) return res.status(400).json({ error: 'id diperlukan' });

            const update = { updatedAt: new Date() };
            const { name, category: cat, price, stock, desc, features, recommend } = req.body;
            if (name) update.name = sanitize(name, 200);
            if (cat) update.category = cat;
            if (price !== undefined) update.price = parseInt(price);
            if (stock !== undefined) {
                update.stock = parseInt(stock);
                update.outOfStock = parseInt(stock) <= 0;
            }
            if (desc !== undefined) update.desc = sanitize(desc, 1000);
            if (features) update.features = Array.isArray(features) ? features.map(f => sanitize(f, 100)) : [];
            if (recommend !== undefined) update.recommend = !!recommend;

            await products.updateOne({ id }, { $set: update });
            return res.status(200).json({ success: true });
        }

        // ── DELETE — hapus produk ────────────────────────────
        if (req.method === 'DELETE') {
            if (!admin) return res.status(401).json({ error: 'Admin only' });
            if (!id) return res.status(400).json({ error: 'id diperlukan' });
            await products.deleteOne({ id });
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (err) {
        console.error('[products] Error:', err.message);
        return res.status(500).json({ error: 'Server error: ' + err.message });
    }
}
