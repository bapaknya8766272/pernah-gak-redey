/**
 * API: /api/reset-password
 * Reset password untuk user biasa (bukan admin)
 *
 * POST /api/reset-password?action=request  — minta reset (kirim token)
 * POST /api/reset-password?action=verify   — verifikasi token
 * POST /api/reset-password?action=reset    — set password baru
 */

import { getCollection } from './db.js';
import crypto from 'crypto';

function setCORS(req, res) {
    const origin = req.headers.origin || '';
    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
    if (allowed.includes(origin) || allowed.includes('*') || process.env.NODE_ENV !== 'production') {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function hashPassword(password, salt) {
    const s = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHmac('sha256', s).update(password).digest('hex');
    return { hash, salt: s };
}

function sanitize(str, max = 200) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>]/g, '').trim().substring(0, max);
}

export default async function handler(req, res) {
    setCORS(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const action = req.query.action;

    try {
        // ── REQUEST RESET ─────────────────────────────────────
        if (action === 'request') {
            const email = sanitize(req.body?.email, 200).toLowerCase();
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({ error: 'Email tidak valid' });
            }

            const users = await getCollection('users');
            const user = await users.findOne({ email });

            if (!user) {
                // Jangan reveal apakah email terdaftar (security)
                return res.status(200).json({
                    success: true,
                    message: 'Jika email terdaftar, token reset akan tersedia.'
                });
            }

            // Buat token reset (berlaku 1 jam)
            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

            const resets = await getCollection('password_resets');
            // Hapus token lama untuk email ini
            await resets.deleteMany({ email });
            // Simpan token baru
            await resets.insertOne({ email, token, expiresAt, createdAt: new Date() });

            // Karena tidak ada email server, return token langsung
            // Di production, kirim via email
            return res.status(200).json({
                success: true,
                message: 'Token reset berhasil dibuat.',
                token, // Di production, jangan return token — kirim via email
                expiresAt,
                // Link reset untuk user
                resetLink: `${req.headers.origin || ''}/index.html?reset_token=${token}&email=${encodeURIComponent(email)}`
            });
        }

        // ── VERIFY TOKEN ──────────────────────────────────────
        if (action === 'verify') {
            const { token, email } = req.body;
            if (!token || !email) return res.status(400).json({ error: 'token dan email diperlukan' });

            const resets = await getCollection('password_resets');
            const reset = await resets.findOne({
                token,
                email: email.toLowerCase(),
                expiresAt: { $gt: new Date() }
            });

            if (!reset) {
                return res.status(400).json({ error: 'Token tidak valid atau sudah kadaluarsa' });
            }

            return res.status(200).json({ valid: true, email: reset.email });
        }

        // ── RESET PASSWORD ────────────────────────────────────
        if (action === 'reset') {
            const { token, email, newPassword } = req.body;
            if (!token || !email || !newPassword) {
                return res.status(400).json({ error: 'token, email, dan newPassword diperlukan' });
            }
            if (newPassword.length < 8) {
                return res.status(400).json({ error: 'Password minimal 8 karakter' });
            }

            const resets = await getCollection('password_resets');
            const reset = await resets.findOne({
                token,
                email: email.toLowerCase(),
                expiresAt: { $gt: new Date() }
            });

            if (!reset) {
                return res.status(400).json({ error: 'Token tidak valid atau sudah kadaluarsa' });
            }

            // Update password user
            const { hash, salt } = hashPassword(newPassword);
            const users = await getCollection('users');
            const result = await users.updateOne(
                { email: email.toLowerCase() },
                { $set: { passwordHash: hash, passwordSalt: salt, updatedAt: new Date() } }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ error: 'User tidak ditemukan' });
            }

            // Hapus token reset
            await resets.deleteOne({ token });

            // Hapus semua session user
            const sessions = await getCollection('sessions');
            const userDoc = await users.findOne({ email: email.toLowerCase() });
            if (userDoc) await sessions.deleteMany({ userId: userDoc._id });

            return res.status(200).json({
                success: true,
                message: 'Password berhasil direset. Silakan login dengan password baru.'
            });
        }

        return res.status(400).json({ error: 'Action tidak dikenal. Gunakan: request, verify, reset' });

    } catch (err) {
        console.error('[reset-password] Error:', err.message);
        return res.status(500).json({ error: 'Server error: ' + err.message });
    }
}
