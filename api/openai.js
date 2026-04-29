/**
 * ALFA HOSTING — AI Chatbot API
 * 
 * Menggunakan Groq API (GRATIS, tanpa kartu kredit)
 * Model: llama-3.1-8b-instant (cepat & pintar)
 * 
 * Cara dapat API key Groq (GRATIS):
 * 1. Buka console.groq.com
 * 2. Daftar dengan email (tidak perlu kartu kredit)
 * 3. API Keys → Create API Key
 * 4. Copy key → paste ke Vercel env var: GROQ_API_KEY
 * 
 * Fallback: jika Groq tidak tersedia, pakai sistem jawaban
 * berbasis keyword yang sudah diprogram (tidak butuh API apapun)
 */

// ── Rate Limiter ──────────────────────────────────────────────
const ipRequestMap = new Map();

function checkRateLimit(ip, maxRequests = 20, windowMs = 60000) {
    const now = Date.now();
    const windowStart = now - windowMs;
    if (!ipRequestMap.has(ip)) ipRequestMap.set(ip, []);
    const requests = ipRequestMap.get(ip).filter(t => t > windowStart);
    if (requests.length >= maxRequests) return false;
    requests.push(now);
    ipRequestMap.set(ip, requests);
    return true;
}

// ── Sanitize ──────────────────────────────────────────────────
function sanitize(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>]/g, '').trim().substring(0, 500);
}

// ── CORS ──────────────────────────────────────────────────────
function setCORS(req, res) {
    const origin = req.headers.origin || '';
    const allowed = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
    if (allowed[0] === '*' || allowed.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', allowed[0] === '*' ? '*' : origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('X-Content-Type-Options', 'nosniff');
}

// ── System Prompt untuk ALFA Hosting ─────────────────────────
const SYSTEM_PROMPT = `Kamu adalah Customer Service AI untuk ALFA Hosting, penyedia layanan hosting VPS, Panel Pterodactyl, dan Jasa IT di Indonesia.

INFORMASI PERUSAHAAN:
- Nama: ALFA Hosting
- WhatsApp: +62 822-2676-9163
- Email: sanzbot938@gmail.com
- Pembayaran: QRIS (GoPay, OVO, Dana, ShopeePay, semua m-banking)

DAFTAR LAYANAN & HARGA:
VPS Cloud:
- VPS BASIC 1GB: Rp 15.000/bulan (Tunneling, Bot Ringan, VPN)
- VPS BASIC 2GB: Rp 25.000/bulan (Hosting Web Kecil)
- VPS STANDARD 2GB: Rp 30.000/bulan (Script Multiprocess)
- VPS STANDARD 4GB: Rp 35.000/bulan ⭐ BEST SELLER (Game Server, Bot Music)
- VPS HIGH 8GB: Rp 45.000/bulan (Minecraft Java, Traffic Tinggi)
- VPS PRO 16GB: Rp 70.000/bulan (Komunitas Game Besar)
- VPS ENTERPRISE 32GB: Rp 120.000/bulan (Enterprise, Perusahaan)

Panel Pterodactyl:
- Panel 1GB: Rp 1.000/bulan
- Panel 2GB: Rp 2.000/bulan
- Panel 3GB: Rp 3.000/bulan
- Panel 4GB: Rp 4.000/bulan
- Panel 5GB: Rp 5.000/bulan
- Panel 6GB: Rp 6.000/bulan
- Panel 7GB: Rp 7.000/bulan
- Panel 8GB Turbo: Rp 8.000/bulan
- Panel 9GB Turbo: Rp 9.000/bulan
- Panel 10GB Turbo: Rp 10.000/bulan
- Panel UNLIMITED: Rp 15.000/bulan ⭐ (Anti Suspend)
- Reseller Panel: Rp 25.000/bulan
- Admin Panel: Rp 35.000/bulan
- Owner Panel: Rp 50.000/bulan
- Partner Panel: Rp 75.000/bulan

Jasa IT:
- Jasa Install Panel: Rp 15.000
- Bash Autoscript: Rp 20.000
- Jasa Rename Script: Rp 25.000
- Fix Error Script: Rp 10.000
- Jasa Buat Website: Rp 75.000
- Jasa Buat Bot WA: Rp 50.000
- Jasa Optimasi VPS: Rp 20.000
- Jasa Backup & Restore: Rp 15.000

KODE PROMO AKTIF:
- ALFA20: Diskon 20%
- NEWUSER: Diskon 15%

CARA BELI:
1. Pilih layanan di website
2. Tambah ke keranjang
3. Masukkan kode promo (opsional)
4. Klik Bayar → scan QRIS
5. Layanan aktif dalam 5-30 menit

ATURAN MENJAWAB:
- Jawab dalam Bahasa Indonesia yang ramah dan singkat
- Maksimal 3-4 kalimat per jawaban
- Jika tidak tahu, arahkan ke WhatsApp: +62 822-2676-9163
- Jangan jawab pertanyaan di luar topik hosting/layanan ALFA Hosting
- Selalu sebut harga dengan format "Rp X.000"`;

// ── Groq API (GRATIS) ─────────────────────────────────────────
async function callGroq(message, apiKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 detik timeout

    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant', // Model gratis, sangat cepat
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: message }
                ],
                max_tokens: 300,
                temperature: 0.7,
                stream: false
            }),
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(`Groq error ${res.status}: ${err.error?.message || 'Unknown'}`);
        }

        const data = await res.json();
        return data.choices?.[0]?.message?.content || null;

    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

// ── Fallback berbasis keyword (tidak butuh API apapun) ────────
function getFallbackReply(message) {
    const msg = message.toLowerCase();

    // Harga / layanan
    if (msg.includes('harga') || msg.includes('berapa') || msg.includes('biaya') || msg.includes('tarif')) {
        return '💰 Harga layanan kami:\n• VPS mulai Rp 15.000/bulan\n• Panel mulai Rp 1.000/bulan\n• Jasa IT mulai Rp 10.000\n\nKetik "vps" atau "panel" untuk detail lengkap!';
    }
    if (msg.includes('vps')) {
        return '🖥️ VPS Cloud kami:\n• 1GB: Rp 15.000/bln\n• 4GB: Rp 35.000/bln ⭐ Best Seller\n• 8GB: Rp 45.000/bln\n• 16GB: Rp 70.000/bln\n• 32GB: Rp 120.000/bln\n\nSemua include Anti-DDoS & Support 24/7!';
    }
    if (msg.includes('panel') || msg.includes('pterodactyl') || msg.includes('ptero')) {
        return '🎮 Panel Pterodactyl:\n• 1GB: Rp 1.000/bln\n• 4GB: Rp 4.000/bln\n• 10GB Turbo: Rp 10.000/bln\n• Unlimited: Rp 15.000/bln ⭐\n• Reseller: Rp 25.000/bln\n\nCocok untuk bot WA, game server, dan lainnya!';
    }
    if (msg.includes('jasa') || msg.includes('install') || msg.includes('buat') || msg.includes('fix')) {
        return '🛠️ Jasa IT kami:\n• Install Panel: Rp 15.000\n• Buat Website: Rp 75.000\n• Buat Bot WA: Rp 50.000\n• Fix Error Script: Rp 10.000\n• Optimasi VPS: Rp 20.000\n\nHubungi WA untuk konsultasi gratis!';
    }

    // Cara beli / pembayaran
    if (msg.includes('cara beli') || msg.includes('cara order') || msg.includes('cara pesan') || msg.includes('beli')) {
        return '🛒 Cara beli:\n1. Pilih layanan di website\n2. Klik "Tambah ke Keranjang"\n3. Masukkan kode promo (opsional)\n4. Klik "Bayar Sekarang"\n5. Scan QRIS dengan e-wallet/m-banking\n6. Layanan aktif dalam 5-30 menit!';
    }
    if (msg.includes('bayar') || msg.includes('pembayaran') || msg.includes('qris') || msg.includes('transfer')) {
        return '💳 Metode pembayaran:\n• QRIS (GoPay, OVO, Dana, ShopeePay)\n• Semua m-banking (BCA, Mandiri, BRI, BNI, dll)\n\nPembayaran otomatis terdeteksi, tidak perlu konfirmasi manual!';
    }

    // Promo / diskon
    if (msg.includes('promo') || msg.includes('diskon') || msg.includes('voucher') || msg.includes('kode')) {
        return '🎉 Kode promo aktif:\n• ALFA20 → Diskon 20%\n• NEWUSER → Diskon 15%\n\nMasukkan kode di kolom promo saat checkout!';
    }

    // Aktivasi / setup
    if (msg.includes('aktif') || msg.includes('setup') || msg.includes('berapa lama') || msg.includes('kapan')) {
        return '⚡ Waktu aktivasi:\n• Panel Pterodactyl: 5-15 menit\n• VPS: 15-30 menit\n• Jasa IT: tergantung kompleksitas\n\nSetelah pembayaran terdeteksi, admin langsung proses!';
    }

    // Garansi / refund
    if (msg.includes('garansi') || msg.includes('refund') || msg.includes('uang kembali') || msg.includes('jaminan')) {
        return '🛡️ Garansi kami:\n• VPS: garansi 3 hari\n• Panel: garansi 24 jam\n• Jika ada masalah teknis dari kami → uang kembali 100%\n\nHubungi WA untuk klaim garansi!';
    }

    // Kontak / support
    if (msg.includes('kontak') || msg.includes('hubungi') || msg.includes('wa') || msg.includes('whatsapp') || msg.includes('support') || msg.includes('bantuan')) {
        return '📞 Hubungi kami:\n• WhatsApp: +62 822-2676-9163\n• Email: sanzbot938@gmail.com\n• Support 24/7 siap membantu!\n\nKlik tombol WhatsApp di pojok kanan bawah untuk chat langsung!';
    }

    // Salam
    if (msg.includes('halo') || msg.includes('hai') || msg.includes('hello') || msg.includes('hi') || msg.includes('selamat')) {
        return '👋 Halo! Selamat datang di ALFA Hosting!\n\nAda yang bisa saya bantu? Ketik:\n• "harga" untuk lihat daftar harga\n• "cara beli" untuk panduan pembelian\n• "promo" untuk kode diskon\n• "kontak" untuk hubungi admin';
    }

    // Upgrade / downgrade
    if (msg.includes('upgrade') || msg.includes('naik') || msg.includes('ganti paket')) {
        return '⬆️ Upgrade layanan bisa kapan saja!\nHubungi admin via WhatsApp: +62 822-2676-9163\n\nBayar selisih harga saja, tidak perlu beli ulang dari awal!';
    }

    // Default
    return '🤖 Maaf, saya belum mengerti pertanyaan kamu.\n\nCoba tanya tentang:\n• Harga layanan\n• Cara beli\n• Kode promo\n• Garansi\n\nAtau hubungi admin langsung: wa.me/6282226769163 📞';
}

// ── Main Handler ──────────────────────────────────────────────
export default async function handler(req, res) {
    setCORS(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Rate limiting
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.socket?.remoteAddress || 'unknown';

    if (!checkRateLimit(clientIp)) {
        return res.status(429).json({
            error: 'Too many requests',
            reply: '⏳ Terlalu banyak pertanyaan. Tunggu 1 menit ya!'
        });
    }

    // Validasi input
    const message = sanitize(req.body?.message);
    if (!message) return res.status(400).json({ error: 'Message required' });

    // Coba Groq dulu (gratis, cepat)
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
        try {
            const reply = await callGroq(message, groqKey);
            if (reply) {
                return res.status(200).json({ reply, source: 'groq' });
            }
        } catch (err) {
            console.warn('Groq gagal, pakai fallback:', err.message);
        }
    }

    // Fallback: jawaban berbasis keyword (tidak butuh API)
    const reply = getFallbackReply(message);
    return res.status(200).json({ reply, source: 'fallback' });
}
