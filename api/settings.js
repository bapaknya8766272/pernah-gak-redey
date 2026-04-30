/**
 * API: /api/settings
 * Simpan dan ambil settings admin ke/dari MongoDB
 *
 * GET  /api/settings          — ambil semua settings
 * POST /api/settings          — simpan/update settings
 * GET  /api/settings?key=xxx  — ambil satu setting
 *
 * Semua endpoint butuh admin token (header X-Admin-Token)
 */

import { getCollection } from './db.js';
import crypto from 'crypto';

// ── CORS ─────────────────────────────────────────────────────
function setCORS(req, res) {
    const origin = req.headers.origin || '';
    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
    if (allowed.includes(origin) || allowed.includes('*') || process.env.NODE_ENV !== 'production') {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
}

// ── Verifikasi admin token ────────────────────────────────────
async function verifyAdminToken(token) {
    if (!token) return false;
    const sessions = await getCollection('admin_sessions');
    const session = await sessions.findOne({ token, expiresAt: { $gt: new Date() } });
    return !!session;
}

// ── Enkripsi nilai sensitif (AES-256-GCM) ────────────────────
const ENCRYPT_KEY = process.env.SETTINGS_ENCRYPT_KEY || 'alfahosting-default-key-32chars!!';
const KEY = Buffer.from(ENCRYPT_KEY.substring(0, 32).padEnd(32, '0'));

function encrypt(text) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted.toString('hex');
}

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

// Keys yang nilainya sensitif dan perlu dienkripsi
const SENSITIVE_KEYS = ['qris_apikey', 'qris_keyorkut', 'openai_apikey', 'ptero_ptla', 'ptero_ptlc', 'groq_apikey'];

// ── Main Handler ──────────────────────────────────────────────
export default async function handler(req, res) {
    setCORS(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const adminToken = req.headers['x-admin-token'];
    const isAdmin = await verifyAdminToken(adminToken);

    // Endpoint publik khusus untuk QRIS config (dipakai saat checkout)
    // Hanya return nilai yang dibutuhkan frontend untuk payment, tidak expose semua
    if (req.method === 'GET' && req.query.type === 'qris-public') {
        const settings = await getCollection('settings');
        const keys = ['qris_code', 'qris_merchant', 'qris_check_interval'];
        const result = {};
        for (const k of keys) {
            const doc = await settings.findOne({ key: k });
            if (doc) result[k] = doc.value;
        }
        // qris_apikey dan qris_keyorkut: decrypt dan return (dibutuhkan untuk API call)
        const sensitiveKeys = ['qris_apikey', 'qris_keyorkut'];
        for (const k of sensitiveKeys) {
            const doc = await settings.findOne({ key: k });
            if (doc?.value) {
                try { result[k] = decrypt(doc.value); } catch { result[k] = ''; }
            }
        }
        return res.status(200).json({ config: result });
    }

    if (!isAdmin) return res.status(401).json({ error: 'Admin token tidak valid atau expired' });

    const settings = await getCollection('settings');

    // ── GET — ambil settings ──────────────────────────────────
    if (req.method === 'GET') {
        const { key } = req.query;

        if (key) {
            const doc = await settings.findOne({ key });
            if (!doc) return res.status(200).json({ key, value: null });
            const value = SENSITIVE_KEYS.includes(key) ? (doc.value ? '••••••••' : '') : doc.value;
            return res.status(200).json({ key, value });
        }

        // Ambil semua settings
        const all = await settings.find({}).toArray();
        const result = {};
        all.forEach(doc => {
            // Sembunyikan nilai sensitif
            result[doc.key] = SENSITIVE_KEYS.includes(doc.key)
                ? (doc.value ? '••••••••' : '')
                : doc.value;
        });
        return res.status(200).json({ settings: result });
    }

    // ── POST — simpan settings ────────────────────────────────
    if (req.method === 'POST') {
        const { updates } = req.body; // { key: value, key2: value2, ... }
        if (!updates || typeof updates !== 'object') {
            return res.status(400).json({ error: 'Body harus berisi { updates: { key: value } }' });
        }

        const ops = [];
        for (const [key, value] of Object.entries(updates)) {
            if (typeof key !== 'string' || key.length > 100) continue;
            if (value === null || value === undefined || value === '') continue;

            // Jangan simpan jika value adalah placeholder
            if (value === '••••••••') continue;

            const storedValue = SENSITIVE_KEYS.includes(key) ? encrypt(String(value)) : String(value);

            ops.push({
                updateOne: {
                    filter: { key },
                    update: {
                        $set: { key, value: storedValue, updatedAt: new Date() },
                        $setOnInsert: { createdAt: new Date() }
                    },
                    upsert: true
                }
            });
        }

        if (ops.length > 0) await settings.bulkWrite(ops);

        return res.status(200).json({ success: true, saved: ops.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
