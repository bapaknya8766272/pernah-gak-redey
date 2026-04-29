/**
 * API: /api/transactions
 * Riwayat transaksi per user yang sudah login
 *
 * GET  /api/transactions          — ambil semua transaksi user yang login
 * POST /api/transactions          — simpan transaksi baru (dipanggil saat checkout)
 * GET  /api/transactions?id=xxx   — detail satu transaksi
 */

import { getCollection } from './db.js';
import { ObjectId } from 'mongodb';

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

async function getUserFromToken(token) {
    if (!token) return null;
    const sessions = await getCollection('sessions');
    const session = await sessions.findOne({ token, expiresAt: { $gt: new Date() } });
    if (!session) return null;
    const users = await getCollection('users');
    return users.findOne({ _id: session.userId });
}

export default async function handler(req, res) {
    setCORSHeaders(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await getUserFromToken(token);

    if (!user) {
        return res.status(401).json({ error: 'Login diperlukan untuk melihat riwayat transaksi' });
    }

    const transactions = await getCollection('transactions');

    // ── GET — ambil riwayat transaksi user ───────────────────
    if (req.method === 'GET') {
        const { id } = req.query;

        if (id) {
            // Detail satu transaksi
            let txn;
            try {
                txn = await transactions.findOne({
                    _id: new ObjectId(id),
                    userId: user._id
                });
            } catch {
                return res.status(400).json({ error: 'ID tidak valid' });
            }
            if (!txn) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
            return res.status(200).json({ transaction: txn });
        }

        // Semua transaksi user, terbaru dulu
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            transactions
                .find({ userId: user._id })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            transactions.countDocuments({ userId: user._id })
        ]);

        return res.status(200).json({
            transactions: data,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    }

    // ── POST — simpan transaksi baru ─────────────────────────
    if (req.method === 'POST') {
        const { orderId, items, total, paymentMethod, status, promoCode, discount } = req.body;

        if (!orderId || !items || !total) {
            return res.status(400).json({ error: 'orderId, items, dan total diperlukan' });
        }

        // Cek duplikat orderId
        const existing = await transactions.findOne({ orderId });
        if (existing) {
            return res.status(409).json({ error: 'Order ID sudah ada', transaction: existing });
        }

        const newTxn = {
            userId: user._id,
            userEmail: user.email,
            userName: user.name,
            orderId: String(orderId).substring(0, 50),
            items: Array.isArray(items) ? items.slice(0, 50).map(item => ({
                id: String(item.id || '').substring(0, 50),
                name: String(item.name || '').substring(0, 200),
                price: Number(item.price) || 0,
                quantity: Number(item.quantity) || 1,
                category: String(item.category || '').substring(0, 50)
            })) : [],
            total: Number(total) || 0,
            discount: Number(discount) || 0,
            promoCode: promoCode ? String(promoCode).substring(0, 50) : null,
            paymentMethod: String(paymentMethod || 'pakasir').substring(0, 50),
            status: ['pending', 'completed', 'cancelled'].includes(status) ? status : 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await transactions.insertOne(newTxn);

        // Update stats user
        const users = await getCollection('users');
        await users.updateOne(
            { _id: user._id },
            {
                $inc: { totalOrders: 1, totalSpent: newTxn.total },
                $set: { lastOrderAt: new Date() }
            }
        );

        return res.status(201).json({
            success: true,
            transaction: { ...newTxn, _id: result.insertedId }
        });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
