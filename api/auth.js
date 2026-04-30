/**
 * API: /api/auth
 * Handles: Google OAuth callback, email login/register, logout, session check
 * 
 * POST /api/auth?action=google   — verifikasi Google ID token
 * POST /api/auth?action=register — daftar dengan email
 * POST /api/auth?action=login    — login dengan email
 * GET  /api/auth?action=me       — cek session aktif
 * POST /api/auth?action=logout   — hapus session
 */

import { getCollection } from './db.js';
import crypto from 'crypto';

// ── Helpers ──────────────────────────────────────────────────
function setCORSHeaders(req, res) {
    const origin = req.headers.origin || '';
    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
    if (allowed.includes(origin) || allowed.includes('*') || process.env.NODE_ENV !== 'production') {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function generateToken() {
    return crypto.randomBytes(48).toString('hex');
}

function hashPassword(password, salt) {
    const s = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHmac('sha256', s).update(password).digest('hex');
    return { hash, salt: s };
}

function sanitize(str, maxLen = 200) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>]/g, '').trim().substring(0, maxLen);
}

// ── Verifikasi Google ID Token (tanpa library berat) ──────────
async function verifyGoogleToken(idToken) {
    try {
        // Decode JWT payload (tidak perlu verify signature untuk data dasar,
        // tapi kita tetap verifikasi via Google tokeninfo endpoint)
        const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
        if (!res.ok) throw new Error('Invalid token');
        const data = await res.json();

        // Pastikan audience cocok dengan Google Client ID kita
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (clientId && data.aud !== clientId) {
            throw new Error('Token audience mismatch');
        }

        return {
            googleId: data.sub,
            email: data.email,
            name: data.name,
            picture: data.picture,
            emailVerified: data.email_verified === 'true'
        };
    } catch (e) {
        throw new Error('Google token tidak valid: ' + e.message);
    }
}

// ── Main Handler ──────────────────────────────────────────────
export default async function handler(req, res) {
    setCORSHeaders(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const action = req.query.action || req.body?.action;

    try {
        // ── GET /api/auth?action=me ──────────────────────────
        if (req.method === 'GET' && action === 'me') {
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!token) return res.status(401).json({ error: 'No token' });

            const sessions = await getCollection('sessions');
            const session = await sessions.findOne({ token, expiresAt: { $gt: new Date() } });
            if (!session) return res.status(401).json({ error: 'Session expired' });

            const users = await getCollection('users');
            const user = await users.findOne({ _id: session.userId }, {
                projection: { passwordHash: 0, passwordSalt: 0 }
            });
            if (!user) return res.status(401).json({ error: 'User not found' });

            return res.status(200).json({ user });
        }

        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        // ── POST /api/auth?action=google ─────────────────────
        if (action === 'google') {
            const { idToken } = req.body;
            if (!idToken) return res.status(400).json({ error: 'idToken diperlukan' });

            const googleUser = await verifyGoogleToken(idToken);

            const users = await getCollection('users');
            let user = await users.findOne({ email: googleUser.email });

            if (!user) {
                // Cek device fingerprint
                const deviceFingerprint = sanitize(req.body?.deviceFingerprint || '', 200);
                if (deviceFingerprint) {
                    const deviceUsed = await users.findOne({ deviceFingerprint });
                    if (deviceUsed) {
                        return res.status(409).json({
                            error: 'Perangkat ini sudah digunakan untuk mendaftar akun lain. 1 perangkat hanya bisa mendaftar 1 akun.',
                            code: 'DEVICE_ALREADY_REGISTERED'
                        });
                    }
                }

                // Buat user baru
                const newUser = {
                    email: googleUser.email,
                    name: googleUser.name,
                    picture: googleUser.picture,
                    googleId: googleUser.googleId,
                    provider: 'google',
                    emailVerified: googleUser.emailVerified,
                    role: 'user',
                    deviceFingerprint: deviceFingerprint || null,
                    registeredIP: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                const result = await users.insertOne(newUser);
                user = { ...newUser, _id: result.insertedId };
            } else {
                // Update info Google terbaru
                await users.updateOne(
                    { _id: user._id },
                    { $set: { name: googleUser.name, picture: googleUser.picture, updatedAt: new Date() } }
                );
                user.name = googleUser.name;
                user.picture = googleUser.picture;
            }

            // Buat session
            const token = generateToken();
            const sessions = await getCollection('sessions');
            await sessions.insertOne({
                token,
                userId: user._id,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 hari
            });

            const { passwordHash, passwordSalt, ...safeUser } = user;
            return res.status(200).json({ token, user: safeUser });
        }

        // ── POST /api/auth?action=register ───────────────────
        if (action === 'register') {
            const name = sanitize(req.body?.name, 100);
            const email = sanitize(req.body?.email, 200).toLowerCase();
            const password = req.body?.password;
            const deviceFingerprint = sanitize(req.body?.deviceFingerprint || '', 200);

            if (!name || !email || !password) {
                return res.status(400).json({ error: 'Nama, email, dan password diperlukan' });
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({ error: 'Format email tidak valid' });
            }
            if (password.length < 8) {
                return res.status(400).json({ error: 'Password minimal 8 karakter' });
            }

            const users = await getCollection('users');

            // Cek apakah device ini sudah pernah daftar akun lain
            if (deviceFingerprint) {
                const deviceUsed = await users.findOne({ deviceFingerprint });
                if (deviceUsed) {
                    return res.status(409).json({
                        error: 'Perangkat ini sudah digunakan untuk mendaftar akun lain. 1 perangkat hanya bisa mendaftar 1 akun.',
                        code: 'DEVICE_ALREADY_REGISTERED'
                    });
                }
            }

            const existing = await users.findOne({ email });
            if (existing) return res.status(409).json({ error: 'Email sudah terdaftar' });

            const { hash, salt } = hashPassword(password);
            const newUser = {
                email,
                name,
                provider: 'email',
                emailVerified: false,
                passwordHash: hash,
                passwordSalt: salt,
                role: 'user',
                deviceFingerprint: deviceFingerprint || null,
                registeredIP: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const result = await users.insertOne(newUser);

            const token = generateToken();
            const sessions = await getCollection('sessions');
            await sessions.insertOne({
                token,
                userId: result.insertedId,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            });

            return res.status(201).json({
                token,
                user: { _id: result.insertedId, email, name, role: 'user', provider: 'email' }
            });
        }

        // ── POST /api/auth?action=login ──────────────────────
        if (action === 'login') {
            const email = sanitize(req.body?.email, 200).toLowerCase();
            const password = req.body?.password;

            if (!email || !password) {
                return res.status(400).json({ error: 'Email dan password diperlukan' });
            }

            const users = await getCollection('users');
            const user = await users.findOne({ email });
            if (!user || user.provider !== 'email') {
                return res.status(401).json({ error: 'Email atau password salah' });
            }

            const { hash } = hashPassword(password, user.passwordSalt);
            if (hash !== user.passwordHash) {
                return res.status(401).json({ error: 'Email atau password salah' });
            }

            const token = generateToken();
            const sessions = await getCollection('sessions');
            await sessions.insertOne({
                token,
                userId: user._id,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            });

            const { passwordHash, passwordSalt, ...safeUser } = user;
            return res.status(200).json({ token, user: safeUser });
        }

        // ── POST /api/auth?action=logout ─────────────────────
        if (action === 'logout') {
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (token) {
                const sessions = await getCollection('sessions');
                await sessions.deleteOne({ token });
            }
            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Action tidak dikenal' });

    } catch (err) {
        console.error('[auth] Error:', err.message);
        return res.status(500).json({ error: 'Server error: ' + err.message });
    }
}
