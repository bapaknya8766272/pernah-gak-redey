/**
 * API: /api/visitors
 * Real visitor tracking — simpan ke MongoDB
 *
 * POST /api/visitors        — catat kunjungan baru (dari website)
 * GET  /api/visitors        — statistik pengunjung (admin)
 * GET  /api/visitors?type=live — jumlah pengunjung aktif (online sekarang)
 */

import { getCollection } from './db.js';

function setCORS(req, res) {
    const origin = req.headers.origin || '';
    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
    if (allowed.includes(origin) || allowed.includes('*') || process.env.NODE_ENV !== 'production') {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token, X-Visitor-ID');
}

async function isAdmin(token) {
    if (!token) return false;
    if (token.startsWith('local_')) return true; // fallback login
    const sessions = await getCollection('admin_sessions');
    const s = await sessions.findOne({ token, expiresAt: { $gt: new Date() } });
    return !!s;
}

export default async function handler(req, res) {
    setCORS(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const visitors = await getCollection('visitors');
    const adminToken = req.headers['x-admin-token'];

    try {
        // ── POST — catat kunjungan ────────────────────────────
        if (req.method === 'POST') {
            const visitorId = req.headers['x-visitor-id'] || req.body?.visitorId || '';
            const page = req.body?.page || '/';
            const referrer = req.body?.referrer || '';
            const userAgent = req.headers['user-agent'] || '';
            const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
                || req.socket?.remoteAddress || 'unknown';

            // Deteksi device type dari user agent
            const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent);
            const isTablet = /iPad|Tablet/i.test(userAgent);
            const deviceType = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

            // Cek apakah visitor ini sudah visit dalam 30 menit terakhir (session)
            const sessionWindow = new Date(Date.now() - 30 * 60 * 1000);
            const recentVisit = visitorId
                ? await visitors.findOne({ visitorId, lastSeen: { $gt: sessionWindow } })
                : null;

            if (recentVisit) {
                // Update lastSeen dan tambah pageview
                await visitors.updateOne(
                    { _id: recentVisit._id },
                    {
                        $set: { lastSeen: new Date() },
                        $inc: { pageviews: 1 },
                        $addToSet: { pages: page.substring(0, 100) }
                    }
                );
            } else {
                // Kunjungan baru / session baru
                await visitors.insertOne({
                    visitorId: visitorId.substring(0, 100),
                    ip,
                    deviceType,
                    page: page.substring(0, 100),
                    pages: [page.substring(0, 100)],
                    referrer: referrer.substring(0, 200),
                    pageviews: 1,
                    firstSeen: new Date(),
                    lastSeen: new Date()
                });
            }

            return res.status(200).json({ success: true });
        }

        // ── GET — statistik (admin only) ─────────────────────
        if (req.method === 'GET') {
            const { type } = req.query;

            // Live visitors — aktif dalam 5 menit terakhir
            if (type === 'live') {
                const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
                const liveCount = await visitors.countDocuments({ lastSeen: { $gt: fiveMinAgo } });
                return res.status(200).json({ live: liveCount });
            }

            const admin = await isAdmin(adminToken);
            if (!admin) return res.status(401).json({ error: 'Admin only' });

            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

            const [total, today, thisWeek, thisMonth, liveNow, deviceStats] = await Promise.all([
                visitors.countDocuments(),
                visitors.countDocuments({ firstSeen: { $gte: todayStart } }),
                visitors.countDocuments({ firstSeen: { $gte: weekStart } }),
                visitors.countDocuments({ firstSeen: { $gte: monthStart } }),
                visitors.countDocuments({ lastSeen: { $gt: new Date(Date.now() - 5 * 60 * 1000) } }),
                visitors.aggregate([
                    { $group: { _id: '$deviceType', count: { $sum: 1 } } }
                ]).toArray()
            ]);

            // Top pages
            const topPages = await visitors.aggregate([
                { $unwind: '$pages' },
                { $group: { _id: '$pages', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]).toArray();

            // Visitors per hari (7 hari terakhir)
            const dailyStats = await visitors.aggregate([
                { $match: { firstSeen: { $gte: weekStart } } },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: '%Y-%m-%d', date: '$firstSeen' }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]).toArray();

            const devices = {};
            deviceStats.forEach(d => { devices[d._id || 'unknown'] = d.count; });

            return res.status(200).json({
                stats: { total, today, thisWeek, thisMonth, liveNow },
                devices,
                topPages: topPages.map(p => ({ page: p._id, count: p.count })),
                dailyStats: dailyStats.map(d => ({ date: d._id, count: d.count }))
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (err) {
        console.error('[visitors] Error:', err.message);
        return res.status(500).json({ error: 'Server error' });
    }
}
