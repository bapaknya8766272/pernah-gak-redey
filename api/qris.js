/**
 * API: /api/qris
 * Proxy pembayaran QRIS — credentials disimpan di MongoDB (settings collection)
 * Client TIDAK pernah lihat API key, merchant ID, atau keyorkut
 *
 * POST /api/qris { action: 'create', amount, orderId }  — buat QRIS baru
 * POST /api/qris { action: 'check', transactionId, amount } — cek status pembayaran
 */

import { getCollection } from './db.js';

function setCORS(req, res) {
    const origin = req.headers.origin || '';
    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
    if (allowed.includes(origin) || allowed.includes('*') || process.env.NODE_ENV !== 'production') {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');
}

// Enkripsi key (sama dengan api/settings.js)
import crypto from 'crypto';
const ENCRYPT_KEY = process.env.SETTINGS_ENCRYPT_KEY || 'alfahosting-default-key-32chars!!';
const KEY = Buffer.from(ENCRYPT_KEY.substring(0, 32).padEnd(32, '0'));

function decrypt(data) {
    try {
        const [ivHex, tagHex, encHex] = data.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');
        const enc = Buffer.from(encHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
        decipher.setAuthTag(tag);
        return decipher.update(enc) + decipher.final('utf8');
    } catch { return ''; }
}

// Ambil setting dari MongoDB (decrypt jika sensitif)
async function getSetting(key) {
    const settings = await getCollection('settings');
    const doc = await settings.findOne({ key });
    if (!doc?.value) return '';

    const val = doc.value;

    // Cek apakah nilai terenkripsi (format: hex:hex:hex)
    const isEncrypted = /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i.test(val);
    if (!isEncrypted) return val; // plain text, return langsung

    // Coba decrypt
    try {
        const decrypted = decrypt(val);
        return decrypted || val;
    } catch {
        return val; // fallback ke nilai asli
    }
}

// Rate limiter — lebih longgar untuk cek status yang berulang
const ipMap = new Map();
function checkRate(ip, max = 60, windowMs = 60000) {
    const now = Date.now();
    if (!ipMap.has(ip)) ipMap.set(ip, []);
    const times = ipMap.get(ip).filter(t => now - t < windowMs);
    if (times.length >= max) return false;
    times.push(now);
    ipMap.set(ip, times);
    return true;
}

export default async function handler(req, res) {
    setCORS(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    if (!checkRate(ip)) return res.status(429).json({ error: 'Terlalu banyak permintaan' });

    const { action, amount, orderId, transactionId } = req.body || {};

    // DEBUG endpoint — cek apakah settings terbaca (hapus setelah confirmed working)
    if (action === 'debug') {
        const [apikey, qrisCode, merchantId, keyorkut] = await Promise.all([
            getSetting('qris_apikey'),
            getSetting('qris_code'),
            getSetting('qris_merchant'),
            getSetting('qris_keyorkut')
        ]);
        return res.status(200).json({
            hasApikey: !!apikey,
            apikeyPreview: apikey ? apikey.substring(0, 4) + '...' : 'KOSONG',
            hasQrisCode: !!qrisCode,
            qrisCodePreview: qrisCode ? qrisCode.substring(0, 20) + '...' : 'KOSONG',
            hasMerchantId: !!merchantId,
            merchantIdPreview: merchantId || 'KOSONG',
            hasKeyorkut: !!keyorkut,
            keyorkutPreview: keyorkut ? keyorkut.substring(0, 10) + '...' : 'KOSONG'
        });
    }

    try {
        // Ambil semua credentials dari MongoDB
        const [apikey, qrisCode, merchantId, keyorkut] = await Promise.all([
            getSetting('qris_apikey'),
            getSetting('qris_code'),
            getSetting('qris_merchant'),
            getSetting('qris_keyorkut')
        ]);

        if (!apikey || !qrisCode) {
            return res.status(503).json({
                error: 'QRIS belum dikonfigurasi. Login admin → Pengaturan → QRIS untuk mengisi API Key dan QRIS Code.',
                success: false
            });
        }

        // ── CREATE: buat QRIS baru ────────────────────────────
        if (action === 'create') {
            if (!amount || amount <= 0) return res.status(400).json({ error: 'Amount tidak valid' });

            const url = `https://website-apii-ten.vercel.app/orderkuota/createpayment?apikey=${encodeURIComponent(apikey)}&amount=${amount}&codeqr=${encodeURIComponent(qrisCode)}`;

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);

            const upstream = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);

            const contentType = upstream.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                const text = await upstream.text();
                console.error('[qris] Non-JSON response:', text.substring(0, 200));
                return res.status(502).json({ error: 'QRIS provider error. Cek API Key di admin settings.', success: false });
            }

            const data = await upstream.json();

            if (!data?.result) {
                return res.status(502).json({ error: 'Gagal membuat QRIS: ' + JSON.stringify(data), success: false });
            }

            const result = data.result;
            return res.status(200).json({
                success: true,
                transactionId: result.idtransaksi || result.transactionId,
                qrImageUrl: result.imageqris?.url || result.qrImageUrl,
                expired: result.expired
            });
        }

        // ── CHECK: cek status pembayaran ──────────────────────
        if (action === 'check') {
            if (!transactionId) return res.status(400).json({ error: 'transactionId diperlukan' });

            const url = `https://website-apii-ten.vercel.app/api/orkut/cekstatus?apikey=${encodeURIComponent(apikey)}&merchant=${encodeURIComponent(merchantId)}&keyorkut=${encodeURIComponent(keyorkut)}`;

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            const upstream = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);

            const data = await upstream.json().catch(() => ({}));

            if (!data?.data || !Array.isArray(data.data)) {
                return res.status(200).json({ paid: false, status: 'pending' });
            }

            const txn = data.data.find(item =>
                item.idtransaksi === transactionId ||
                item.transactionId === transactionId
            );

            if (!txn) return res.status(200).json({ paid: false, status: 'pending' });

            const isPaid = txn.status === 'PAID' || txn.status === 'paid' ||
                Number(txn.jumlah) === Number(amount) ||
                Number(txn.amount) === Number(amount);

            return res.status(200).json({ paid: isPaid, status: txn.status || 'pending' });
        }

        return res.status(400).json({ error: 'Action tidak dikenal. Gunakan: create atau check' });

    } catch (err) {
        console.error('[qris] Error:', err.message);
        return res.status(500).json({ error: 'Server error: ' + err.message, success: false });
    }
}
