/**
 * API: /api/testimonials
 * Kelola testimoni pelanggan
 *
 * GET  /api/testimonials              — list testimoni (public, hanya approved)
 * GET  /api/testimonials?admin=1      — list semua (admin)
 * POST /api/testimonials              — tambah testimoni baru (public)
 * PUT  /api/testimonials?id=xxx       — approve/reject (admin)
 * DELETE /api/testimonials?id=xxx     — hapus (admin)
 * POST /api/testimonials?action=init  — inisialisasi default (admin)
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
    { name: "Rio.P", rating: 3, message: "Order jasa install panel ptero ke vps sendiri. jujur agak lama prosesnya ampe 3 jam karna katanya lg antri panjang. tp yaudah lah yg penting panel nyala normal.", date: "2026-02-01", status: "approved" },
    { name: "CEO_Ngelag", rating: 5, message: "Beli VPS Enterprise 32GB buat database kantor, gila ngacir bener bang. Xeon 8 core nya ga main-main.", date: "2026-01-29", status: "approved" },
    { name: "Rafly_MTA", rating: 5, message: "Panel 5gb nya pas bgt buat server MTA player 50an. Harga 5rb doang udah dapet server SG Premium.", date: "2026-01-28", status: "approved" },
    { name: "Cuan_Maksimal", rating: 5, message: "Paket reseller panelnya mantap min, modal 25rb udah bisa jualan panel ptero sendiri. Auto balik modal ini mah hahaha", date: "2026-01-26", status: "approved" },
    { name: "Ivan_Tkj", rating: 4, message: "Jasa optimasi vps nya ngaruh bgt. Serverku awalnya sering OOM mati sendiri, abis disettingin swap jadi agak mendingan lah.", date: "2026-01-25", status: "approved" },
    { name: "Fajar_Hosting", rating: 5, message: "Backup & Restore nya ngebantu bgt pas kemaren ganti vps. Data bot aman semua pindah dgn selamat.", date: "2026-01-22", status: "approved" }
];

export default async function handler(req, res) {
    setCORS(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const adminToken = req.headers['x-admin-token'];
    const admin = await isAdmin(adminToken);
    const testimonials = await getCollection('testimonials');
    const { id, action } = req.query;

    try {
        // ── GET ──────────────────────────────────────────────
        if (req.method === 'GET') {
            const query = admin ? {} : { status: 'approved' };
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;

            const [data, total] = await Promise.all([
                testimonials.find(query).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).toArray(),
                testimonials.countDocuments(query)
            ]);

            // Jika kosong, return default
            if (data.length === 0 && !admin) {
                return res.status(200).json({ testimonials: DEFAULT_TESTIMONIALS, total: DEFAULT_TESTIMONIALS.length, source: 'default' });
            }

            return res.status(200).json({ testimonials: data, total });
        }

        // ── POST action=init ─────────────────────────────────
        if (req.method === 'POST' && action === 'init') {
            if (!admin) return res.status(401).json({ error: 'Admin only' });
            const count = await testimonials.countDocuments();
            if (count > 0) return res.status(409).json({ error: 'Testimoni sudah ada', count });
            const now = new Date();
            const docs = DEFAULT_TESTIMONIALS.map(t => ({ ...t, createdAt: now }));
            await testimonials.insertMany(docs);
            return res.status(201).json({ success: true, inserted: docs.length });
        }

        // ── POST — tambah testimoni baru ─────────────────────
        if (req.method === 'POST') {
            const { name, rating, message } = req.body;
            if (!name || !message) return res.status(400).json({ error: 'name dan message diperlukan' });
            if (message.length < 10) return res.status(400).json({ error: 'Pesan minimal 10 karakter' });

            const newTestimonial = {
                name: sanitize(name, 100),
                rating: Math.min(Math.max(parseInt(rating) || 5, 1), 5),
                message: sanitize(message, 500),
                date: new Date().toISOString().split('T')[0],
                status: 'pending',
                createdAt: new Date()
            };
            await testimonials.insertOne(newTestimonial);
            return res.status(201).json({ success: true, message: 'Testimoni dikirim, menunggu persetujuan.' });
        }

        // ── PUT — approve/reject ─────────────────────────────
        if (req.method === 'PUT') {
            if (!admin) return res.status(401).json({ error: 'Admin only' });
            if (!id) return res.status(400).json({ error: 'id diperlukan' });
            const { status } = req.body;
            if (!['approved', 'rejected'].includes(status)) {
                return res.status(400).json({ error: 'Status harus approved atau rejected' });
            }
            await testimonials.updateOne({ _id: new ObjectId(id) }, { $set: { status } });
            return res.status(200).json({ success: true });
        }

        // ── DELETE ───────────────────────────────────────────
        if (req.method === 'DELETE') {
            if (!admin) return res.status(401).json({ error: 'Admin only' });
            if (!id) return res.status(400).json({ error: 'id diperlukan' });
            await testimonials.deleteOne({ _id: new ObjectId(id) });
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (err) {
        console.error('[testimonials] Error:', err.message);
        return res.status(500).json({ error: 'Server error: ' + err.message });
    }
}
