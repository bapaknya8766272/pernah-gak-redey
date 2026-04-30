/**
 * API: /api/orders
 * Kelola semua order/penjualan (admin view)
 *
 * GET  /api/orders              — list semua order (admin)
 * GET  /api/orders?id=xxx       — detail satu order (admin)
 * GET  /api/orders?status=xxx   — filter by status (admin)
 * POST /api/orders              — buat order baru (dari checkout)
 * PUT  /api/orders?id=xxx       — update status order (admin)
 * DELETE /api/orders?id=xxx     — hapus order (admin)
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token, Authorization');
}

async function isAdmin(token) {
    if (!token) return false;
    const sessions = await getCollection('admin_sessions');
    const s = await sessions.findOne({ token, expiresAt: { $gt: new Date() } });
    return !!s;
}

export default async function handler(req, res) {
    setCORS(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const adminToken = req.headers['x-admin-token'];
    const admin = await isAdmin(adminToken);
    if (!admin) return res.status(401).json({ error: 'Admin only' });

    const orders = await getCollection('orders');
    const { id, status } = req.query;

    try {
        // ── GET ──────────────────────────────────────────────
        if (req.method === 'GET') {
            let query = {};
            if (id) query._id = new ObjectId(id);
            if (status && status !== 'all') query.status = status;

            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;

            const [data, total] = await Promise.all([
                orders.find(query).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).toArray(),
                orders.countDocuments(query)
            ]);

            if (id) {
                const order = data[0];
                if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });
                return res.status(200).json({ order });
            }

            return res.status(200).json({ orders: data, total, page });
        }

        // ── POST — buat order baru ───────────────────────────
        if (req.method === 'POST') {
            const { orderId, items, total, status, userId, userName, userEmail, promoCode, discount } = req.body;
            if (!orderId || !items || !total) {
                return res.status(400).json({ error: 'orderId, items, total diperlukan' });
            }

            const newOrder = {
                orderId: String(orderId).substring(0, 50),
                items: Array.isArray(items) ? items.slice(0, 50) : [],
                total: Number(total) || 0,
                discount: Number(discount) || 0,
                promoCode: promoCode ? String(promoCode).substring(0, 50) : null,
                status: ['pending', 'completed', 'cancelled'].includes(status) ? status : 'pending',
                userId: userId || null,
                userName: userName ? String(userName).substring(0, 100) : null,
                userEmail: userEmail ? String(userEmail).substring(0, 200) : null,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await orders.insertOne(newOrder);
            return res.status(201).json({ success: true, order: { ...newOrder, _id: result.insertedId } });
        }

        // ── PUT — update status order ────────────────────────
        if (req.method === 'PUT') {
            if (!id) return res.status(400).json({ error: 'id diperlukan' });
            const { status: newStatus } = req.body;
            if (!['pending', 'completed', 'cancelled'].includes(newStatus)) {
                return res.status(400).json({ error: 'Status tidak valid' });
            }
            await orders.updateOne(
                { _id: new ObjectId(id) },
                { $set: { status: newStatus, updatedAt: new Date() } }
            );
            return res.status(200).json({ success: true });
        }

        // ── DELETE — hapus order ─────────────────────────────
        if (req.method === 'DELETE') {
            if (!id) return res.status(400).json({ error: 'id diperlukan' });
            await orders.deleteOne({ _id: new ObjectId(id) });
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (err) {
        console.error('[orders] Error:', err.message);
        return res.status(500).json({ error: 'Server error: ' + err.message });
    }
}
