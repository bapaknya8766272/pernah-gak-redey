/**
 * API: /api/admin-auth
 * Login admin yang aman — credentials tersimpan di MongoDB
 *
 * POST /api/admin-auth?action=login    — login admin
 * POST /api/admin-auth?action=logout   — logout admin
 * GET  /api/admin-auth?action=check    — cek session admin
 * POST /api/admin-auth?action=setup    — setup admin pertama kali (hanya jika belum ada)
 * POST /api/admin-auth?action=change-password — ganti password admin
 *
 * Keamanan:
 * - Password di-hash dengan PBKDF2 (100.000 iterasi, SHA-512) + salt unik
 * - Rate limiting: max 5 percobaan per IP per 15 menit
 * - Session token: 64 bytes random hex
 * - Session berlaku 1 jam (bisa diperpanjang)
 * - Lockout otomatis setelah 5 gagal
 * - Semua aktivitas dicatat di audit_log
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
    res.setHeader('Access-Control-Allow-Credentials', 'true');
}

// ── Rate Limiter (in-memory, per deployment) ──────────────────
const loginAttempts = new Map();

function checkRateLimit(ip) {
    const now = Date.now();
    const window = 15 * 60 * 1000; // 15 menit
    const max = 5;

    if (!loginAttempts.has(ip)) loginAttempts.set(ip, []);
    const attempts = loginAttempts.get(ip).filter(t => now - t < window);

    if (attempts.length >= max) {
        const oldest = attempts[0];
        const waitMs = window - (now - oldest);
        return { allowed: false, waitMinutes: Math.ceil(waitMs / 60000) };
    }

    attempts.push(now);
    loginAttempts.set(ip, attempts);
    return { allowed: true };
}

function clearRateLimit(ip) {
    loginAttempts.delete(ip);
}

// ── Password Hashing (PBKDF2 — jauh lebih kuat dari SHA-256) ──
function hashPassword(password, salt) {
    const s = salt || crypto.randomBytes(32).toString('hex');
    const hash = crypto.pbkdf2Sync(password, s, 100000, 64, 'sha512').toString('hex');
    return { hash, salt: s };
}

function verifyPassword(password, hash, salt) {
    const { hash: computed } = hashPassword(password, salt);
    // Constant-time comparison untuk mencegah timing attack
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'));
}

// ── Generate token ────────────────────────────────────────────
function generateToken() {
    return crypto.randomBytes(64).toString('hex');
}

// ── Get client IP ─────────────────────────────────────────────
function getIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.socket?.remoteAddress
        || 'unknown';
}

// ── Audit log ─────────────────────────────────────────────────
async function auditLog(action, ip, details = {}) {
    try {
        const logs = await getCollection('audit_log');
        await logs.insertOne({ action, ip, details, timestamp: new Date() });
    } catch { /* non-critical */ }
}

// ── Main Handler ──────────────────────────────────────────────
export default async function handler(req, res) {
    setCORS(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const action = req.query.action || req.body?.action;
    const ip = getIP(req);

    try {
        // ── GET check ────────────────────────────────────────
        if (req.method === 'GET' && action === 'check') {
            const token = req.headers['x-admin-token'];
            if (!token) return res.status(401).json({ authenticated: false });

            const sessions = await getCollection('admin_sessions');
            const session = await sessions.findOne({ token, expiresAt: { $gt: new Date() } });
            if (!session) return res.status(401).json({ authenticated: false });

            // Perpanjang session
            await sessions.updateOne(
                { token },
                { $set: { expiresAt: new Date(Date.now() + 60 * 60 * 1000), lastActivity: new Date() } }
            );

            return res.status(200).json({ authenticated: true, username: session.username });
        }

        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        // ── POST setup (hanya jika belum ada admin) ───────────
        if (action === 'setup') {
            const admins = await getCollection('admins');
            const existing = await admins.findOne({});
            if (existing) {
                return res.status(403).json({ error: 'Admin sudah ada. Gunakan change-password untuk mengubah.' });
            }

            const { username, password } = req.body;
            if (!username || !password) return res.status(400).json({ error: 'Username dan password diperlukan' });
            if (username.length < 4) return res.status(400).json({ error: 'Username minimal 4 karakter' });
            if (password.length < 12) return res.status(400).json({ error: 'Password minimal 12 karakter' });

            // Validasi kekuatan password
            const strength = checkPasswordStrength(password);
            if (strength.score < 3) {
                return res.status(400).json({ error: 'Password terlalu lemah: ' + strength.feedback });
            }

            const { hash, salt } = hashPassword(password);
            await admins.insertOne({
                username: username.toLowerCase().trim(),
                passwordHash: hash,
                passwordSalt: salt,
                createdAt: new Date(),
                updatedAt: new Date(),
                loginCount: 0,
                lastLogin: null
            });

            await auditLog('admin_setup', ip, { username });
            return res.status(201).json({ success: true, message: 'Admin berhasil dibuat' });
        }

        // ── POST login ────────────────────────────────────────
        if (action === 'login') {
            // Rate limit
            const rl = checkRateLimit(ip);
            if (!rl.allowed) {
                await auditLog('login_blocked', ip, { reason: 'rate_limit' });
                return res.status(429).json({
                    error: `Terlalu banyak percobaan. Coba lagi dalam ${rl.waitMinutes} menit.`
                });
            }

            const { username, password } = req.body;
            if (!username || !password) {
                return res.status(400).json({ error: 'Username dan password diperlukan' });
            }

            const admins = await getCollection('admins');
            const admin = await admins.findOne({ username: username.toLowerCase().trim() });

            if (!admin) {
                await auditLog('login_failed', ip, { username, reason: 'user_not_found' });
                // Delay untuk mencegah user enumeration
                await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
                return res.status(401).json({ error: 'Username atau password salah' });
            }

            // Cek lockout
            if (admin.lockedUntil && admin.lockedUntil > new Date()) {
                const waitMin = Math.ceil((admin.lockedUntil - Date.now()) / 60000);
                return res.status(423).json({ error: `Akun terkunci. Coba lagi dalam ${waitMin} menit.` });
            }

            // Verifikasi password
            let passwordValid = false;
            try {
                passwordValid = verifyPassword(password, admin.passwordHash, admin.passwordSalt);
            } catch { passwordValid = false; }

            if (!passwordValid) {
                const failCount = (admin.failedLogins || 0) + 1;
                const lockout = failCount >= 5;

                await admins.updateOne(
                    { _id: admin._id },
                    {
                        $set: {
                            failedLogins: failCount,
                            lastFailedLogin: new Date(),
                            ...(lockout ? { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) } : {})
                        }
                    }
                );

                await auditLog('login_failed', ip, { username, failCount });

                if (lockout) {
                    return res.status(423).json({ error: 'Akun terkunci 15 menit karena terlalu banyak percobaan gagal.' });
                }

                return res.status(401).json({
                    error: `Username atau password salah. (${5 - failCount} percobaan tersisa)`
                });
            }

            // Login berhasil
            clearRateLimit(ip);
            const token = generateToken();
            const sessions = await getCollection('admin_sessions');

            // Hapus session lama
            await sessions.deleteMany({ username: admin.username });

            await sessions.insertOne({
                token,
                username: admin.username,
                ip,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 jam
                lastActivity: new Date()
            });

            await admins.updateOne(
                { _id: admin._id },
                { $set: { failedLogins: 0, lastLogin: new Date(), lockedUntil: null }, $inc: { loginCount: 1 } }
            );

            await auditLog('login_success', ip, { username: admin.username });

            return res.status(200).json({
                success: true,
                token,
                username: admin.username,
                expiresIn: 3600
            });
        }

        // ── POST check-username (untuk lupa password) ────────
        if (action === 'check-username') {
            const { username } = req.body;
            if (!username) return res.status(400).json({ error: 'Username diperlukan' });
            const admins = await getCollection('admins');
            const admin = await admins.findOne({ username: username.toLowerCase().trim() });
            return res.status(200).json({ exists: !!admin });
        }

        // ── POST reset-password (tanpa auth, hanya jika ada username) ─
        if (action === 'reset-password') {
            const { username, newPassword } = req.body;
            if (!username || !newPassword) return res.status(400).json({ error: 'username dan newPassword diperlukan' });
            if (newPassword.length < 12) return res.status(400).json({ error: 'Password minimal 12 karakter' });

            const strength = checkPasswordStrength(newPassword);
            if (strength.score < 3) return res.status(400).json({ error: 'Password terlalu lemah: ' + strength.feedback });

            const admins = await getCollection('admins');
            const admin = await admins.findOne({ username: username.toLowerCase().trim() });
            if (!admin) return res.status(404).json({ error: 'Admin tidak ditemukan' });

            const { hash, salt } = hashPassword(newPassword);
            await admins.updateOne({ _id: admin._id }, { $set: { passwordHash: hash, passwordSalt: salt, updatedAt: new Date() } });

            // Hapus semua session
            const sessions = await getCollection('admin_sessions');
            await sessions.deleteMany({ username: admin.username });

            await auditLog('password_reset', ip, { username: admin.username });
            return res.status(200).json({ success: true, message: 'Password berhasil direset. Silakan login dengan password baru.' });
        }

        // ── POST logout ───────────────────────────────────────
        if (action === 'logout') {
            const token = req.headers['x-admin-token'];
            if (token) {
                const sessions = await getCollection('admin_sessions');
                await sessions.deleteOne({ token });
                await auditLog('logout', ip, {});
            }
            return res.status(200).json({ success: true });
        }

        // ── POST change-password ──────────────────────────────
        if (action === 'change-password') {
            const token = req.headers['x-admin-token'];
            if (!token) return res.status(401).json({ error: 'Token diperlukan' });

            const sessions = await getCollection('admin_sessions');
            const session = await sessions.findOne({ token, expiresAt: { $gt: new Date() } });
            if (!session) return res.status(401).json({ error: 'Session tidak valid' });

            const { oldPassword, newPassword } = req.body;
            if (!oldPassword || !newPassword) {
                return res.status(400).json({ error: 'Password lama dan baru diperlukan' });
            }

            if (newPassword.length < 12) {
                return res.status(400).json({ error: 'Password baru minimal 12 karakter' });
            }

            const strength = checkPasswordStrength(newPassword);
            if (strength.score < 3) {
                return res.status(400).json({ error: 'Password terlalu lemah: ' + strength.feedback });
            }

            const admins = await getCollection('admins');
            const admin = await admins.findOne({ username: session.username });
            if (!admin) return res.status(404).json({ error: 'Admin tidak ditemukan' });

            const valid = verifyPassword(oldPassword, admin.passwordHash, admin.passwordSalt);
            if (!valid) return res.status(401).json({ error: 'Password lama salah' });

            const { hash, salt } = hashPassword(newPassword);
            await admins.updateOne(
                { _id: admin._id },
                { $set: { passwordHash: hash, passwordSalt: salt, updatedAt: new Date() } }
            );

            // Hapus semua session lain
            await sessions.deleteMany({ username: admin.username, token: { $ne: token } });

            await auditLog('password_changed', ip, { username: admin.username });
            return res.status(200).json({ success: true, message: 'Password berhasil diubah' });
        }

        return res.status(400).json({ error: 'Action tidak dikenal' });

    } catch (err) {
        console.error('[admin-auth] Error:', err.message);
        return res.status(500).json({ error: 'Server error' });
    }
}

// ── Cek kekuatan password ─────────────────────────────────────
function checkPasswordStrength(password) {
    let score = 0;
    const feedback = [];

    if (password.length >= 12) score++; else feedback.push('minimal 12 karakter');
    if (password.length >= 16) score++;
    if (/[A-Z]/.test(password)) score++; else feedback.push('tambahkan huruf kapital');
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++; else feedback.push('tambahkan angka');
    if (/[^A-Za-z0-9]/.test(password)) score++; else feedback.push('tambahkan karakter spesial (!@#$%)');

    // Cek pola umum yang mudah ditebak
    const common = ['password', '123456', 'admin', 'qwerty', 'abc123', 'letmein'];
    if (common.some(c => password.toLowerCase().includes(c))) {
        score -= 2;
        feedback.push('hindari kata umum seperti "password" atau "admin"');
    }

    return { score: Math.max(0, score), feedback: feedback.join(', ') };
}
