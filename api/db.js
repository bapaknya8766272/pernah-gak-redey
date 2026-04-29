/**
 * MongoDB Connection Utility
 * Menggunakan connection pooling agar tidak buat koneksi baru setiap request
 */

import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'alfahosting';

if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable tidak diset. Tambahkan di Vercel Dashboard.');
}

let cachedClient = null;
let cachedDb = null;

export async function connectDB() {
    if (cachedClient && cachedDb) {
        return { client: cachedClient, db: cachedDb };
    }

    const client = new MongoClient(MONGODB_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 10000,
    });

    await client.connect();
    const db = client.db(DB_NAME);

    cachedClient = client;
    cachedDb = db;

    return { client, db };
}

export async function getCollection(name) {
    const { db } = await connectDB();
    return db.collection(name);
}
