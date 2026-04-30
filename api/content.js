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
    if (token.startsWith('local_')) return true; // fallback login
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

        // ════════════════════════════════════════════════════
        // TESTIMONIALS (digabung dari testimonials.js)
        // ════════════════════════════════════════════════════
        if (type === 'testimonials') {
            const col = await getCollection('testimonials');
            const DEFAULT_TESTIMONIALS = [
                { name: "Zaki_MCPE", rating: 5, message: "Gila vps 4gb nya kenceng bgt bang buat server mcpe. Lancar jaya gak ada lag sama sekali padahal player rame. Thx min!", date: "2026-02-18", status: "approved" },
                { name: "Fauzan.dev", rating: 5, message: "Awalnya iseng nyoba panel 1gb hemat buat naruh script bot wa doang, eh ternyata stabil bngt. Harga seribu perak dapet segini mah worth it parah.", date: "2026-02-17", status: "approved" },
                { name: "Rizky Store", rating: 4, message: "Makasih mase, jasa buat web top up ku jadi cakep. cuma revisi warna temanya lumayan nunggu lama balasan adminnya wkwk. tp overal hasil mantap.", date: "2026-02-15", status: "approved" },
                { name: "Dika Santoso", rating: 5, message: "Sultan beneran ini mah panel unlimitednya. Udah deploy 5 server barengan resource masi aman sentosa, ga kena suspend.", date: "2026-02-14", status: "approved" },
                { name: "Bima_Aji", rating: 4, message: "Fitur bot wa nya lengkap bgt sesuai rikues, tp jujur awal2 agak bingung cara run nya di panel. untung adminnya sabar njelasin sampe bisa.", date: "2026-02-12", status: "approved" },
                { name: "Kelvin.jr", rating: 5, message: "Penyelamat bgt asli!! Script bot ku error dari kemarin, pake jasa fix error langsung jalan lagi normal. murah lg wkwk", date: "2026-02-10", status: "approved" },
                { name: "Sandi VPN", rating: 4, message: "Vps basic 1gb nya mayan bgt buat tunneling pribadi. ping sempet naik turun kmrn siang tp skrg dah stabil lg jos.", date: "2026-02-08", status: "approved" },
                { name: "Tegar_SAMP", rating: 5, message: "Pake panel 10gb turbo buat server SAMP, ping nya dapet ijo terus bang. Server SG premium nya emang beda.", date: "2026-02-05", status: "approved" },
                { name: "Agung_Store", rating: 5, message: "Jasa rename script nya rapih bang. Sekarang bot nya udah full pake nama & logo store ku sendiri. Keren euy", date: "2026-02-03", status: "approved" },
                { name: "Rio.P", rating: 3, message: "Order jasa install panel ptero ke vps sendiri. jujur agak lama prosesnya ampe 3 jam karna katanya lg antri panjang. tp yaudah lah yg penting panel nyala normal.", date: "2026-02-01", status: "approved" }
            ];

            if (req.method === 'GET') {
                const query = admin ? {} : { status: 'approved' };
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 50;
                const [data, total] = await Promise.all([
                    col.find(query).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).toArray(),
                    col.countDocuments(query)
                ]);
                if (data.length === 0 && !admin) {
                    return res.status(200).json({ testimonials: DEFAULT_TESTIMONIALS, total: DEFAULT_TESTIMONIALS.length, source: 'default' });
                }
                return res.status(200).json({ testimonials: data, total });
            }

            if (req.method === 'POST' && req.query.action === 'init') {
                if (!admin) return res.status(401).json({ error: 'Admin only' });
                const count = await col.countDocuments();
                if (count > 0) return res.status(409).json({ error: 'Testimoni sudah ada', count });
                await col.insertMany(DEFAULT_TESTIMONIALS.map(t => ({ ...t, createdAt: new Date() })));
                return res.status(201).json({ success: true, inserted: DEFAULT_TESTIMONIALS.length });
            }

            if (req.method === 'POST') {
                const { name, rating, message } = req.body;
                if (!name || !message || message.length < 10) return res.status(400).json({ error: 'Nama dan pesan (min 10 karakter) diperlukan' });
                await col.insertOne({ name: sanitize(name, 100), rating: Math.min(Math.max(parseInt(rating)||5,1),5), message: sanitize(message, 500), date: new Date().toISOString().split('T')[0], status: 'pending', createdAt: new Date() });
                return res.status(201).json({ success: true, message: 'Testimoni dikirim, menunggu persetujuan.' });
            }

            if (req.method === 'PUT') {
                if (!admin) return res.status(401).json({ error: 'Admin only' });
                const { id } = req.query;
                const { status } = req.body;
                if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Status harus approved atau rejected' });
                await col.updateOne({ _id: new ObjectId(id) }, { $set: { status } });
                return res.status(200).json({ success: true });
            }

            if (req.method === 'DELETE') {
                if (!admin) return res.status(401).json({ error: 'Admin only' });
                await col.deleteOne({ _id: new ObjectId(req.query.id) });
                return res.status(200).json({ success: true });
            }
        }

        // ════════════════════════════════════════════════════
        // ACTIVITY LOG (digabung dari admin.js)
        // ════════════════════════════════════════════════════
        if (type === 'activity-log') {
            if (!admin) return res.status(401).json({ error: 'Admin only' });
            const col = await getCollection('activity_log');

            if (req.method === 'GET') {
                const limit = parseInt(req.query.limit) || 100;
                const logs = await col.find({}).sort({ time: -1 }).limit(limit).toArray();
                return res.status(200).json({ logs });
            }

            if (req.method === 'POST') {
                const { category, message, time } = req.body;
                if (!category || !message) return res.status(400).json({ error: 'category dan message diperlukan' });
                await col.insertOne({
                    category: sanitize(category, 50),
                    message: sanitize(message, 500),
                    time: time || new Date().toISOString(),
                    createdAt: new Date()
                });
                // Keep max 500 logs
                const count = await col.countDocuments();
                if (count > 500) {
                    const oldest = await col.find({}).sort({ time: 1 }).limit(count - 500).toArray();
                    if (oldest.length > 0) {
                        await col.deleteMany({ _id: { $in: oldest.map(o => o._id) } });
                    }
                }
                return res.status(201).json({ success: true });
            }

            if (req.method === 'DELETE') {
                await col.deleteMany({});
                return res.status(200).json({ success: true });
            }
        }

        return res.status(400).json({ error: 'Type tidak dikenal. Gunakan: newsletter, flash-sale, reviews, testimonials, activity-log' });

    } catch (err) {
        console.error('[content] Error:', err.message);
        return res.status(500).json({ error: 'Server error: ' + err.message });
    }
}