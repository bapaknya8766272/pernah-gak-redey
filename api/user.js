/**
 * API: /api/user
 * Update profil user, ambil statistik, dll
 *
 * GET  /api/user          — profil + statistik user
 * PUT  /api/user          — update nama / foto profil
 * GET  /api/user?action=stats — statistik belanja user
 */

import { getCollection } from './db.js';

function setCORSHeaders(req, res) {
    const origin = req.headers.origin || '';
    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
    if (allowed.includes(origin) || allowed.includes('*') || process.env.NODE_ENV !== 'production') {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
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

export default async function handler(req, res) {
    setCORSHeaders(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: 'Login diperlukan' });

    // ── GET profil + stats ───────────────────────────────────
    if (req.method === 'GET') {
        const transactions = await getCollection('transactions');

        const [allTxns, completedTxns] = await Promise.all([
            transactions.countDocuments({ userId: user._id }),
            transactions.countDocuments({ userId: user._id, status: 'completed' })
        ]);

        const spentAgg = await transactions.aggregate([
            { $match: { userId: user._id, status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$total' } } }
        ]).toArray();

        const totalSpent = spentAgg[0]?.total || 0;

        // Produk paling sering dibeli
        const topProducts = await transactions.aggregate([
            { $match: { userId: user._id } },
            { $unwind: '$items' },
            { $group: { _id: '$items.name', count: { $sum: '$items.quantity' } } },
            { $sort: { count: -1 } },
            { $limit: 3 }
        ]).toArray();

        return res.status(200).json({
            user,
            stats: {
                totalOrders: allTxns,
                completedOrders: completedTxns,
                totalSpent,
                topProducts: topProducts.map(p => ({ name: p._id, count: p.count }))
            }
        });
    }

    // ── PUT update profil ────────────────────────────────────
    if (req.method === 'PUT') {
        const { name } = req.body;
        if (!name || typeof name !== 'string' || name.trim().length < 2) {
            return res.status(400).json({ error: 'Nama minimal 2 karakter' });
        }

        const users = await getCollection('users');
        await users.updateOne(
            { _id: user._id },
            { $set: { name: name.trim().substring(0, 100), updatedAt: new Date() } }
        );

        return res.status(200).json({ success: true, name: name.trim() });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
