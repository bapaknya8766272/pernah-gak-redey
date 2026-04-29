/**
 * API: /api/content
 * Kelola newsletter subscribers, flash sale, dan reviews
 *
 * GET  /api/content?type=newsletter          — list subscribers (admin)
 * POST /api/content?type=newsletter          — subscribe (public)
 * DELETE /api/content?type=newsletter&id=xxx — hapus subscriber (admin)
 *
 * GET  /api/content?type=flash-sale          — get flash sale aktif (public)
 * POST /api/content?type=flash-sale          — buat/update flash sale (admin)
 * DELETE /api/content?type=flash-sale&id=xxx — hapus flash sale (admin)
 *
 * GET  /api/content?type=reviews             — list reviews (public + admin)
 * POST /api/content?type=reviews             — submit review (public)
 * PUT  /api/content?type=reviews&id=xxx      — approve/reject review (admin)
 * DELETE /api/content?type=reviews&id=xxx    — hapus review (admin)
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

export default async function handler(req, res) {
    setCORS(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const type = req.query.type;
    const adminToken = req.headers['x-admin-token'];
    const admin = await isAdmin(adminToken);

    if (!type) return res.status(400).json({ error: 'Parameter type diperlukan' });

    try {
        // ════════════════════════════════════════════════════
        // NEWSLETTER
        // ════════════════════════════════════════════════════
        if (type === 'newsletter') {
            const col = await getCollection('newsletter_subscribers');

            if (req.method === 'GET') {
                if (!admin) return res.status(401).json({ error: 'Admin only' });
                const page = parseInt(req.query.page) || 1;
                const limit = 50;
                const [data, total] = await Promise.all([
                    col.find({}).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).toArray(),
                    col.countDocuments()
                ]);
                return res.status(200).json({ subscribers: data, total, page });
            }

            if (req.method === 'POST') {
                const name  = sanitize(req.body?.name, 100);
                const email = sanitize(req.body?.email, 200).toLowerCase();
                if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    return res.status(400).json({ error: 'Email tidak valid' });
                }
                const existing = await col.findOne({ email });
                if (existing) return res.status(409).json({ error: 'Email sudah terdaftar', alreadySubscribed: true });

                const promoCode = 'WELCOME' + Math.random().toString(36).substring(2,6).toUpperCase();
                await col.insertOne({ name, email, promoCode, createdAt: new Date() });
                return res.status(201).json({ success: true, promoCode });
            }

            if (req.method === 'DELETE') {
                if (!admin) return res.status(401).json({ error: 'Admin only' });
                const { id } = req.query;
                await col.deleteOne({ _id: new ObjectId(id) });
                return res.status(200).json({ success: true });
            }
        }

        // ════════════════════════════════════════════════════
        // FLASH SALE
        // ════════════════════════════════════════════════════
        if (type === 'flash-sale') {
            const col = await getCollection('flash_sales');

            if (req.method === 'GET') {
                const now = new Date();
                const query = admin ? {} : { active: true, endsAt: { $gt: now } };
                const sales = await col.find(query).sort({ createdAt: -1 }).toArray();
                return res.status(200).json({ flashSales: sales });
            }

            if (req.method === 'POST') {
                if (!admin) return res.status(401).json({ error: 'Admin only' });
                const { productId, productName, discount, endsAt, active } = req.body;
                if (!productId || !discount || !endsAt) {
                    return res.status(400).json({ error: 'productId, discount, dan endsAt diperlukan' });
                }
                const doc = {
                    productId: sanitize(productId, 50),
                    productName: sanitize(productName || '', 200),
                    discount: Math.min(Math.max(parseInt(discount) || 0, 1), 90),
                    endsAt: new Date(endsAt),
                    active: active !== false,
                    createdAt: new Date()
                };
                const result = await col.insertOne(doc);
                return res.status(201).json({ success: true, id: result.insertedId });
            }

            if (req.method === 'PUT') {
                if (!admin) return res.status(401).json({ error: 'Admin only' });
                const { id } = req.query;
                const { active, discount, endsAt, productName } = req.body;
                const update = {};
                if (active !== undefined) update.active = !!active;
                if (discount) update.discount = Math.min(Math.max(parseInt(discount), 1), 90);
                if (endsAt) update.endsAt = new Date(endsAt);
                if (productName) update.productName = sanitize(productName, 200);
                await col.updateOne({ _id: new ObjectId(id) }, { $set: update });
                return res.status(200).json({ success: true });
            }

            if (req.method === 'DELETE') {
                if (!admin) return res.status(401).json({ error: 'Admin only' });
                await col.deleteOne({ _id: new ObjectId(req.query.id) });
                return res.status(200).json({ success: true });
            }
        }

        // ════════════════════════════════════════════════════
        // REVIEWS
        // ════════════════════════════════════════════════════
        if (type === 'reviews') {
            const col = await getCollection('reviews');

            if (req.method === 'GET') {
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 20;
                // Public hanya lihat yang approved, admin lihat semua
                const query = admin ? {} : { status: 'approved' };
                const [data, total] = await Promise.all([
                    col.find(query).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).toArray(),
                    col.countDocuments(query)
                ]);
                return res.status(200).json({ reviews: data, total, page });
            }

            if (req.method === 'POST') {
                const name    = sanitize(req.body?.name, 100);
                const message = sanitize(req.body?.message, 500);
                const rating  = Math.min(Math.max(parseInt(req.body?.rating) || 5, 1), 5);
                const product = sanitize(req.body?.product || '', 200);

                if (!name || name.length < 2) return res.status(400).json({ error: 'Nama minimal 2 karakter' });
                if (!message || message.length < 10) return res.status(400).json({ error: 'Ulasan minimal 10 karakter' });

                await col.insertOne({
                    name, message, rating, product,
                    status: 'pending', // perlu diapprove admin
                    createdAt: new Date()
                });
                return res.status(201).json({ success: true, message: 'Ulasan dikirim, menunggu persetujuan admin.' });
            }

            if (req.method === 'PUT') {
                if (!admin) return res.status(401).json({ error: 'Admin only' });
                const { id } = req.query;
                const { status } = req.body; // 'approved' | 'rejected'
                if (!['approved', 'rejected'].includes(status)) {
                    return res.status(400).json({ error: 'Status harus approved atau rejected' });
                }
                await col.updateOne({ _id: new ObjectId(id) }, { $set: { status, reviewedAt: new Date() } });
                return res.status(200).json({ success: true });
            }

            if (req.method === 'DELETE') {
                if (!admin) return res.status(401).json({ error: 'Admin only' });
                await col.deleteOne({ _id: new ObjectId(req.query.id) });
                return res.status(200).json({ success: true });
            }
        }

        return res.status(400).json({ error: 'Type tidak dikenal' });

    } catch (err) {
        console.error('[content] Error:', err.message);
        return res.status(500).json({ error: 'Server error: ' + err.message });
    }
}
