/**
 * API: /api/account
 * Gabungan: user profile + transactions
 *
 * GET  /api/account?type=profile     — profil + statistik user
 * PUT  /api/account?type=profile     — update nama
 * GET  /api/account?type=transactions — riwayat transaksi user
 * POST /api/account?type=transactions — simpan transaksi baru
 */

import { getCollection } from './db.js';
import { ObjectId } from 'mongodb';

function setCORS(req, res) {
    const origin = req.headers.origin || '';
    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
    if (allowed.includes(origin) || allowed.includes('*') || process.env.NODE_ENV !== 'production') {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
}

async function getUserFromToken(token) {
    if (!token) return null;
    const sessions = await getCollection('sessions');
    const session = await sessions.findOne({ token, expiresAt: { $gt: new Date() } });
    if (!session) return null;
    const users = await getCollection('users');
    return users.findOne({ _id: session.userId }, { projection: { passwordHash: 0, passwordSalt: 0 } });
}

function sanitize(str, max = 200) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>]/g, '').trim().substring(0, max);
}

export default async function handler(req, res) {
    setCORS(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: 'Login diperlukan' });

    const { type } = req.query;

    // ── PROFILE ──────────────────────────────────────────────
    if (type === 'profile') {
        if (req.method === 'GET') {
            const transactions = await getCollection('transactions');
            const [total, completed] = await Promise.all([
                transactions.countDocuments({ userId: user._id }),
                transactions.countDocuments({ userId: user._id, status: 'completed' })
            ]);
            const spentAgg = await transactions.aggregate([
                { $match: { userId: user._id, status: 'completed' } },
                { $group: { _id: null, total: { $sum: '$total' } } }
            ]).toArray();
            return res.status(200).json({
                user,
                stats: { totalOrders: total, completedOrders: completed, totalSpent: spentAgg[0]?.total || 0 }
            });
        }
        if (req.method === 'PUT') {
            const { name } = req.body;
            if (!name || name.trim().length < 2) return res.status(400).json({ error: 'Nama minimal 2 karakter' });
            const users = await getCollection('users');
            await users.updateOne({ _id: user._id }, { $set: { name: name.trim().substring(0, 100), updatedAt: new Date() } });
            return res.status(200).json({ success: true, name: name.trim() });
        }
    }

    // ── TRANSACTIONS ─────────────────────────────────────────
    if (type === 'transactions') {
        const transactions = await getCollection('transactions');

        if (req.method === 'GET') {
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 20, 100);
            const [data, total] = await Promise.all([
                transactions.find({ userId: user._id }).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).toArray(),
                transactions.countDocuments({ userId: user._id })
            ]);
            return res.status(200).json({ transactions: data, pagination: { page, limit, total, pages: Math.ceil(total/limit) } });
        }

        if (req.method === 'POST') {
            const { orderId, items, total, paymentMethod, status, promoCode, discount } = req.body;
            if (!orderId || !items || !total) return res.status(400).json({ error: 'orderId, items, total diperlukan' });

            const existing = await transactions.findOne({ orderId });
            if (existing) return res.status(409).json({ error: 'Order ID sudah ada', transaction: existing });

            const newTxn = {
                userId: user._id, userEmail: user.email, userName: user.name,
                orderId: String(orderId).substring(0, 50),
                items: Array.isArray(items) ? items.slice(0, 50).map(i => ({
                    id: String(i.id||'').substring(0,50), name: String(i.name||'').substring(0,200),
                    price: Number(i.price)||0, quantity: Number(i.quantity)||1, category: String(i.category||'').substring(0,50)
                })) : [],
                total: Number(total)||0, discount: Number(discount)||0,
                promoCode: promoCode ? String(promoCode).substring(0,50) : null,
                paymentMethod: String(paymentMethod||'qris').substring(0,50),
                status: ['pending','completed','cancelled'].includes(status) ? status : 'pending',
                createdAt: new Date(), updatedAt: new Date()
            };
            const result = await transactions.insertOne(newTxn);
            const users = await getCollection('users');
            await users.updateOne({ _id: user._id }, { $inc: { totalOrders: 1, totalSpent: newTxn.total }, $set: { lastOrderAt: new Date() } });
            return res.status(201).json({ success: true, transaction: { ...newTxn, _id: result.insertedId } });
        }
    }

    return res.status(400).json({ error: 'type tidak dikenal. Gunakan: profile atau transactions' });
}
