# 🚀 ALFA HOSTING — Panduan Deploy & Setup Lengkap

---

## ⚡ CHECKLIST DEPLOY KE VERCEL (Baca ini dulu!)

Ikuti urutan ini agar website langsung berfungsi setelah deploy.

---

## LANGKAH 1 — Setup MongoDB Atlas (Database)

MongoDB dipakai untuk menyimpan: data user, transaksi, settings admin, newsletter, reviews, flash sale.

1. Buka **[mongodb.com](https://mongodb.com)** → klik **"Try Free"**
2. Daftar akun (bisa pakai Google)
3. Pilih **"Build a database"** → pilih **M0 FREE** (gratis selamanya)
4. Pilih region terdekat (Singapore untuk Indonesia)
5. Klik **"Create"**
6. **Database Access** → **Add New Database User**:
   - Username: `alfahosting` (atau bebas)
   - Password: klik **"Autogenerate Secure Password"** → **copy passwordnya!**
   - Role: **Atlas Admin**
   - Klik **Add User**
7. **Network Access** → **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`) → Confirm
8. **Database** → klik **Connect** → **Drivers** → pilih **Node.js**
9. Copy connection string, bentuknya:
   ```
   mongodb+srv://alfahosting:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
10. Ganti `<password>` dengan password yang tadi di-copy

**Simpan connection string ini — akan dipakai di Langkah 3.**

---

## LANGKAH 2 — Setup Google OAuth (Login User dengan Google)

Ini untuk fitur login user di website (bukan admin). Kalau tidak mau fitur ini, skip langkah ini.

1. Buka **[console.cloud.google.com](https://console.cloud.google.com)**
2. Klik dropdown project di atas → **New Project** → nama: `ALFA Hosting` → Create
3. Kiri atas pastikan project sudah dipilih
4. Menu kiri → **APIs & Services** → **OAuth consent screen**:
   - User Type: **External** → Create
   - App name: `ALFA Hosting`
   - User support email: email kamu
   - Developer contact: email kamu
   - Klik **Save and Continue** (skip semua sampai selesai)
5. Menu kiri → **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**:
   - Application type: **Web application**
   - Name: `ALFA Hosting Web`
   - Authorized JavaScript origins: (isi setelah deploy, lihat Langkah 5)
   - Klik **Create**
6. Copy **Client ID** (format: `123456789-xxxxx.apps.googleusercontent.com`)

**Simpan Client ID ini — akan dipakai di Langkah 3 dan 5.**

---

## LANGKAH 3 — Deploy ke Vercel

### A. Upload ke GitHub dulu

1. Buka **[github.com](https://github.com)** → New repository → nama: `alfa-hosting` → Create
2. Upload semua file dari folder `website gacor/` ke repository tersebut
   - Pastikan **TIDAK** upload file `.env` (sudah ada di `.gitignore`)

### B. Connect ke Vercel

1. Buka **[vercel.com](https://vercel.com)** → Login dengan GitHub
2. **New Project** → Import repository `alfa-hosting`
3. Framework Preset: **Other**
4. Root Directory: biarkan kosong (atau `/`)
5. Klik **Deploy** — tunggu sampai selesai

### C. Set Environment Variables di Vercel

Setelah deploy, buka: **Project** → **Settings** → **Environment Variables**

Tambahkan satu per satu:

| Variable Name | Value | Keterangan |
|---------------|-------|-----------|
| `MONGODB_URI` | `mongodb+srv://alfahosting:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority` | Connection string dari Langkah 1 |
| `MONGODB_DB` | `alfahosting` | Nama database |
| `GOOGLE_CLIENT_ID` | `123456789-xxxxx.apps.googleusercontent.com` | Dari Langkah 2 (opsional) |
| `OPENAI_API_KEY` | `sk-proj-xxxxx` | Dari platform.openai.com (opsional, untuk chatbot AI) |
| `OPENAI_MODEL` | `gpt-3.5-turbo` | Model AI yang dipakai |
| `SETTINGS_ENCRYPT_KEY` | Buat sendiri, minimal 32 karakter acak | Untuk enkripsi settings sensitif di DB |
| `ALLOWED_ORIGINS` | `https://nama-project.vercel.app` | Domain website kamu di Vercel |

> **Cara buat SETTINGS_ENCRYPT_KEY:** Ketik sembarang 32+ karakter, contoh: `AlfaHosting2026!SecureKey#XYZ789`

Setelah semua diisi → klik **Redeploy** (Settings → Deployments → klik titik tiga → Redeploy)

---

## LANGKAH 4 — Setup Password Admin (WAJIB!)

Password admin **tidak ada default** — kamu harus buat sendiri saat pertama kali.

### Cara Setup:

1. Buka website kamu: `https://nama-project.vercel.app/admin.html`
2. Akan muncul form login biasa
3. Coba login dengan username `admin` dan password apapun → akan gagal
4. Akan muncul tombol **"Setup Admin Pertama Kali"** atau kamu bisa langsung panggil API:

**Cara paling mudah — via browser console:**
1. Buka `https://nama-project.vercel.app/admin.html`
2. Tekan **F12** → tab **Console**
3. Ketik perintah ini dan tekan Enter:
   ```javascript
   fetch('/api/admin-auth?action=setup', {
     method: 'POST',
     headers: {'Content-Type': 'application/json'},
     body: JSON.stringify({
       username: 'admin',
       password: 'GantiIniDenganPasswordKuat!2026'
     })
   }).then(r => r.json()).then(console.log)
   ```
4. Ganti `GantiIniDenganPasswordKuat!2026` dengan password pilihanmu
5. Jika berhasil, console akan tampilkan: `{success: true, message: "Admin berhasil dibuat"}`

### Syarat Password Admin:
- ✅ Minimal **12 karakter**
- ✅ Ada **huruf kapital** (A-Z)
- ✅ Ada **angka** (0-9)
- ✅ Ada **karakter spesial** (!@#$%^&*)
- ❌ Tidak boleh mengandung: `password`, `admin`, `123456`, `qwerty`

**Contoh password yang kuat:** `AlfaH0sting#2026!`

> ⚠️ **SIMPAN PASSWORD INI BAIK-BAIK!** Jika lupa, harus reset via MongoDB Atlas.

---

## LANGKAH 5 — Update Google OAuth (Jika pakai login Google)

Setelah deploy dan dapat domain Vercel:

1. Kembali ke **[console.cloud.google.com](https://console.cloud.google.com)**
2. **Credentials** → klik nama OAuth client yang tadi dibuat
3. **Authorized JavaScript origins** → Add URI:
   - `https://nama-project.vercel.app`
4. **Authorized redirect URIs** → Add URI:
   - `https://nama-project.vercel.app`
5. Klik **Save**
6. Edit file `index.html` baris:
   ```html
   <meta name="google-client-id" content="YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com">
   ```
   Ganti `YOUR_GOOGLE_CLIENT_ID` dengan Client ID dari Langkah 2
7. Commit dan push ke GitHub → Vercel otomatis redeploy

---

## LANGKAH 6 — Setup QRIS Payment di Admin Dashboard

1. Login ke admin: `https://nama-project.vercel.app/admin.html`
2. Buka **Pengaturan** → **Pengaturan QRIS**
3. Isi semua field:
   - **API Key** — dari penyedia QRIS (website-apii-ten.vercel.app)
   - **QRIS Code** — kode QRIS kamu
   - **Merchant ID** — merchant ID untuk cek status
   - **Key Orkut** — key untuk cek status
4. Klik **Simpan Pengaturan QRIS**

---

## LANGKAH 7 — Verifikasi Semua Berfungsi

Cek satu per satu:

| Fitur | Cara Cek | Status |
|-------|----------|--------|
| Website loading | Buka `https://nama-project.vercel.app` | Harus muncul |
| Admin login | Buka `/admin.html`, login | Harus bisa masuk |
| Chatbot AI | Klik ikon chat, kirim pesan | Harus ada respons |
| Tambah ke keranjang | Klik produk → Beli | Harus masuk keranjang |
| QRIS Payment | Checkout → scan QR | Harus muncul QR |
| Login Google | Klik "Masuk" di header | Harus muncul popup Google |
| Newsletter | Tunggu 30 detik → modal muncul | Harus muncul |

---

## 📁 Struktur Project

```
website gacor/
├── index.html              # Halaman utama website
├── admin.html              # Dashboard admin
├── auth.js                 # Frontend auth (Google + email login)
├── scripts.js              # JavaScript utama website
├── admin.js                # JavaScript admin dashboard
├── styles.css              # CSS website
├── admin-styles.css        # CSS admin
├── vercel.json             # Konfigurasi Vercel
├── package.json            # Dependencies (mongodb, openai)
├── payment-success.html    # Halaman sukses pembayaran
├── privacy.html            # Kebijakan privasi
├── terms.html              # Syarat & ketentuan
├── assets/
│   └── alfa.jpg            # Logo
└── api/
    ├── openai.js           # Chatbot AI
    ├── auth.js             # Login user (Google + email)
    ├── admin-auth.js       # Login admin (PBKDF2 + MongoDB)
    ├── settings.js         # Settings admin ke MongoDB
    ├── content.js          # Newsletter, flash sale, reviews
    ├── transactions.js     # Riwayat transaksi user
    ├── user.js             # Profil user
    ├── db.js               # Koneksi MongoDB
    └── .env                # Environment variables (JANGAN di-commit!)
```

---

## 🔑 Ringkasan Semua Akun yang Dibutuhkan

| Layanan | Untuk Apa | Gratis? | Link |
|---------|-----------|---------|------|
| **Vercel** | Deploy website | ✅ Ya | vercel.com |
| **GitHub** | Simpan kode | ✅ Ya | github.com |
| **MongoDB Atlas** | Database | ✅ Ya (M0) | mongodb.com |
| **Google Cloud** | Login Google | ✅ Ya | console.cloud.google.com |
| **OpenAI** | Chatbot AI | ❌ Berbayar | platform.openai.com |
| **QRIS Provider** | Payment | Tergantung | (dari kamu) |

---

## ⚠️ Troubleshooting

### "Admin tidak bisa login"
→ Pastikan sudah setup admin via console (Langkah 4)
→ Cek MONGODB_URI sudah benar di Vercel env vars
→ Cek Network Access di MongoDB Atlas sudah allow `0.0.0.0/0`

### "Chatbot tidak merespons"
→ Pastikan OPENAI_API_KEY sudah diset di Vercel env vars
→ Cek saldo OpenAI di platform.openai.com

### "QRIS tidak muncul"
→ Login admin → Pengaturan → isi semua field QRIS → Simpan

### "Login Google tidak berfungsi"
→ Pastikan GOOGLE_CLIENT_ID sudah diset
→ Pastikan domain sudah ditambahkan di Google OAuth (Langkah 5)
→ Pastikan meta tag di index.html sudah diupdate

### "Data tidak tersimpan ke database"
→ Cek MONGODB_URI di Vercel env vars
→ Cek Network Access di MongoDB Atlas
→ Lihat Vercel Function Logs: Project → Functions → klik function yang error

### Cara lihat error di Vercel:
1. Buka vercel.com → project kamu
2. Tab **Functions** → klik nama function
3. Tab **Logs** → lihat error message

---

## ⚙️ Setup & Deployment

### 1. Clone / Download Project

```bash
git clone <repo-url>
cd Kimi_Agent_Deployment_v2
```

### 2. Konfigurasi Environment Variables

Buat file `api/.env` (atau set di Vercel Dashboard):

```env
OPENAI_API_KEY=sk-your-openai-key-here
OPENAI_MODEL=gpt-3.5-turbo
ALLOWED_ORIGINS=https://yourdomain.vercel.app
```

> ⚠️ **PENTING:** Jangan pernah commit file `.env` ke Git!

### 3. Deploy ke Vercel

```bash
npm install -g vercel
vercel
```

Atau connect repo ke [vercel.com](https://vercel.com) dan set environment variables di dashboard.

### 4. Test Lokal

Buka `index.html` langsung di browser untuk preview frontend.
Untuk test chatbot AI, butuh Vercel Dev:

```bash
vercel dev
```

---

## 🔐 Login Admin

URL: `/admin.html`

| Field | Default |
|-------|---------|
| Username | `admin` |
| Password | `admin123` |

> ⚠️ **WAJIB GANTI** sebelum production! Ganti hash di `admin.js` → `SECURITY.USERNAME_HASH` dan `SECURITY.PASSWORD_HASH`

Generate hash baru: [SHA256 Online](https://emn178.github.io/online-tools/sha256.html)

---

## 💳 Konfigurasi Pembayaran (Pakasir)

1. Daftar di [pakasir.com](https://pakasir.com)
2. Buat project dan catat **Slug** dan **API Key**
3. Login admin → Pengaturan → Pakasir → isi Slug
4. Pembayaran otomatis redirect ke Pakasir

---

## 🤖 Konfigurasi Chatbot AI

1. Dapatkan API Key di [platform.openai.com](https://platform.openai.com/api-keys)
2. Set `OPENAI_API_KEY` di environment variable Vercel
3. Pilih model di admin → Pengaturan → OpenAI

Model yang tersedia: `gpt-3.5-turbo`, `gpt-4`, `gpt-4-turbo`, `gpt-4o`

---

## 🎁 Kode Promo

| Kode | Diskon |
|------|--------|
| `ALFA20` | 20% |
| `NEWUSER` | 15% |

Tambah/edit kode di `scripts.js` → `PROMO_CODES`

---

## 📦 Produk Default

### VPS Cloud (7 paket)
- VPS BASIC 1GB — Rp 15.000
- VPS BASIC 2GB — Rp 25.000
- VPS STANDARD 2GB — Rp 30.000
- VPS STANDARD 4GB — Rp 35.000 ⭐ Best Seller
- VPS HIGH 8GB — Rp 45.000
- VPS PRO 16GB — Rp 70.000
- VPS ENTERPRISE 32GB — Rp 120.000

### Panel Pterodactyl (15 paket)
- Panel 1GB–10GB: Rp 1.000–10.000/bulan
- Panel Unlimited — Rp 15.000 ⭐
- Reseller Panel — Rp 25.000
- Admin Panel — Rp 35.000 ⭐
- Owner Panel — Rp 50.000
- Partner Panel — Rp 75.000 ⭐

### Jasa & Addons (8 layanan)
- Jasa Install Panel — Rp 15.000
- Bash Autoscript — Rp 20.000
- Jasa Rename Script — Rp 25.000
- Fix Error Script — Rp 10.000
- Jasa Buat Website — Rp 75.000
- Jasa Buat Bot WA — Rp 50.000
- Jasa Optimasi VPS — Rp 20.000
- Jasa Backup & Restore — Rp 15.000

---

## 📋 Rincian Semua Update (Lengkap)

### 🔴 Update Keamanan (Security)

#### [v1] Hapus API Keys dari Client-Side
- **File:** `scripts.js`
- **Sebelum:** `CONFIG` menyimpan `openai_apikey`, `pakasir_apikey`, `ptero_ptla`, `ptero_ptlc` dari localStorage
- **Sesudah:** Hanya menyimpan `pakasir_slug` (tidak sensitif) dan `openai_model` (preferensi saja). Semua API key dipindah ke server-side environment variables

#### [v2] Server-Side Rate Limiting di API
- **File:** `api/openai.js`
- **Sebelum:** Rate limiting hanya di client (bisa di-bypass)
- **Sesudah:** Rate limiting per IP di server menggunakan `Map` dengan sliding window 60 detik, max 30 request/menit

#### [v3] Input Sanitization (Anti-XSS)
- **File:** `scripts.js`
- **Sebelum:** User input langsung dimasukkan ke `innerHTML` tanpa sanitasi
- **Sesudah:** Fungsi `Utils.sanitize()` menggunakan `textContent` untuk escape HTML. Diterapkan di: chat messages, testimonial cards, product details, toast notifications

#### [v4] Model Whitelist di API
- **File:** `api/openai.js`
- **Sebelum:** Model bisa diisi sembarang string dari client
- **Sesudah:** Whitelist `['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o']`, request dengan model lain di-fallback ke default

#### [v5] Security Headers di Vercel
- **File:** `vercel.json`
- **Ditambahkan:**
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Content-Security-Policy` (CSP) lengkap
  - `Cache-Control: no-store` untuk API routes

#### [v6] .gitignore untuk Proteksi File Sensitif
- **File:** `.gitignore` (baru)
- Mencegah `.env`, `node_modules/`, `.vercel/` ter-commit ke Git

#### [v7] Admin Settings — API Key Tidak Ditampilkan Ulang
- **File:** `admin.js` → `loadSettings()`
- **Sebelum:** API key ditampilkan kembali di form settings
- **Sesudah:** Field kosong dengan placeholder `••••••••` jika sudah diatur. Flag `_set` disimpan untuk indikator

#### [v8] Security Notice di Admin Settings
- **File:** `admin.html`, `admin-styles.css`
- Ditambahkan warning box kuning di settings OpenAI yang mengingatkan admin untuk simpan API key di Vercel env vars

#### [v9] Validasi Input Testimonial
- **File:** `scripts.js`
- Nama: min 2, max 50 karakter
- Pesan: min 10, max 500 karakter
- Strip karakter `<>` sebelum disimpan

---

### 🟠 Update Fitur Utama

#### [v10] Search Bar Produk
- **File:** `index.html`, `scripts.js`, `styles.css`
- Search real-time berdasarkan nama, deskripsi, dan fitur produk
- Tombol clear (×) muncul saat ada teks
- Pesan "tidak ada produk ditemukan" jika hasil kosong
- Search state tersimpan saat ganti kategori

#### [v11] Pagination Testimoni
- **File:** `scripts.js`
- **Sebelum:** Semua testimoni ditampilkan sekaligus (bisa sangat panjang)
- **Sesudah:** 6 testimoni per halaman dengan tombol navigasi Sebelumnya/Selanjutnya dan indikator halaman

#### [v12] Hover Preview Bintang Rating
- **File:** `scripts.js`
- **Sebelum:** Klik bintang langsung set rating
- **Sesudah:** Hover menampilkan preview rating, mouseLeave kembali ke nilai sebelumnya, klik untuk konfirmasi

#### [v13] Typing Dots Animation di Chat
- **File:** `scripts.js`, `styles.css`
- **Sebelum:** Spinner `fa-circle-notch fa-spin` saat menunggu respons AI
- **Sesudah:** Tiga titik bouncing (CSS animation) yang lebih natural

#### [v14] Product Features Preview di Card
- **File:** `scripts.js`, `styles.css`
- Menampilkan 3 fitur pertama sebagai tag kecil di bawah deskripsi produk
- Style `.feat-tag` dengan warna primary transparan

#### [v15] Label Harga `/bulan`
- **File:** `scripts.js`
- Harga produk sekarang menampilkan `/bulan` dalam font kecil

#### [v16] Announcement Bar
- **File:** `index.html`, `styles.css`
- Bar promo di atas header dengan kode `ALFA20`
- Gradient primary, responsive

#### [v17] Back-to-Top Button
- **File:** `index.html`, `styles.css`
- Muncul setelah scroll 400px
- Smooth scroll ke atas saat diklik
- Animasi hover

#### [v18] Promo Code Fungsional
- **File:** `scripts.js`
- **Sebelum:** Kode promo hanya menampilkan toast, tidak ada diskon nyata
- **Sesudah:** `PROMO_CODES` object dengan persentase diskon. Diskon dihitung dan ditampilkan di cart summary. `activePromo` state tersimpan

#### [v19] Visitor Counter
- **File:** `scripts.js`
- Setiap kunjungan halaman menambah counter di `localStorage`
- Counter ditampilkan di admin dashboard → Total Pengunjung

#### [v20] Order Status Auto-Update
- **File:** `payment-success.html`
- **Sebelum:** Status order tetap `pending` setelah pembayaran
- **Sesudah:** Status otomatis berubah ke `completed` saat halaman payment-success dibuka

#### [v21] Order Status Dropdown di Admin
- **File:** `admin.js`
- **Sebelum:** Status order hanya badge statis
- **Sesudah:** Dropdown `<select>` untuk ubah status langsung (pending/completed/cancelled) tanpa reload

#### [v22] Copy Order ID
- **File:** `admin.js`, `admin.html`
- Klik Order ID di tabel untuk copy ke clipboard
- Feedback Swal.fire konfirmasi

#### [v23] Refresh Dashboard Button
- **File:** `admin.html`, `admin.js`
- Tombol refresh di header admin untuk update semua data dan chart tanpa reload halaman

#### [v24] Empty State di Tabel Admin
- **File:** `admin.js`
- Tabel pesanan dan testimoni sekarang menampilkan pesan "Belum ada data" dengan ikon saat kosong

#### [v25] addProduct / updateProduct / deleteProduct di ProductManager
- **File:** `scripts.js`
- **Sebelum:** Fungsi-fungsi ini tidak ada, admin.js error saat tambah/edit/hapus produk
- **Sesudah:** Implementasi lengkap dengan ID auto-generate menggunakan timestamp

---

### 🟡 Update UX & UI

#### [v26] FAQ Accordion Toggle Benar
- **File:** `scripts.js`
- **Sebelum:** Klik FAQ item lagi tidak menutupnya
- **Sesudah:** Klik item yang sudah terbuka akan menutupnya (toggle). Hanya satu item terbuka sekaligus

#### [v27] Counter Animasi Timing
- **File:** `scripts.js`
- **Sebelum:** Counter animasi jalan bersamaan dengan loading screen (tidak terlihat)
- **Sesudah:** Counter mulai 200ms setelah loading screen hilang

#### [v28] Mobile Menu Close on Outside Click
- **File:** `scripts.js`
- **Sebelum:** Mobile menu hanya tutup saat klik tombol hamburger
- **Sesudah:** Klik di luar area menu juga menutup menu

#### [v29] Chat Input Disabled Saat Loading
- **File:** `scripts.js`
- Input chat di-disable saat menunggu respons AI untuk mencegah spam

#### [v30] Chat Toggle Button Fix
- **File:** `scripts.js`
- **Sebelum:** Tombol chat toggle tidak muncul kembali setelah chat ditutup
- **Sesudah:** Toggle button kembali muncul dengan `display: flex` (bukan `block`)

#### [v31] IntersectionObserver untuk Active Nav
- **File:** `scripts.js`
- **Sebelum:** Active nav menggunakan `scroll` event dengan `offsetTop` (tidak akurat)
- **Sesudah:** `IntersectionObserver` dengan threshold 0.3 untuk deteksi section yang terlihat

#### [v32] Header Shadow on Scroll
- **File:** `scripts.js`
- Header mendapat shadow saat scroll > 50px untuk depth visual

#### [v33] Keranjang di Nav Menu
- **File:** `index.html`
- Tambah link "Keranjang" di navigasi desktop

#### [v34] Cart Count Hidden When Zero
- **File:** `scripts.js`
- Badge cart count disembunyikan (`display:none`) saat keranjang kosong

#### [v35] SEO Meta Tags
- **File:** `index.html`
- Ditambahkan: `description`, `keywords`, `og:title`, `og:description`, `og:type`

#### [v36] Dynamic Footer Year
- **File:** `index.html`
- Tahun di footer otomatis menggunakan `new Date().getFullYear()`

#### [v37] Tambah FAQ
- **File:** `index.html`
- Ditambahkan 2 FAQ baru: metode pembayaran dan request fitur custom

#### [v38] Accessibility Improvements
- **File:** `index.html`
- Tambah `aria-label` pada mobile menu button
- Tambah `title` attribute pada cart button

---

### 🔧 Update Code Quality & Bug Fixes

#### [v39] Fix Typo Bug di admin.js
- **File:** `admin.js`
- **Sebelum:** `window.updateSalesChart = updateSalesChart;indow.updateSalesChart = updateSalesChart;` (typo duplikat)
- **Sesudah:** Satu baris yang benar

#### [v40] Hapus Duplikasi DOMContentLoaded
- **File:** `scripts.js`
- **Sebelum:** Ada dua `DOMContentLoaded` listener (satu baru, satu lama yang tersisa)
- **Sesudah:** Satu listener yang bersih dan lengkap

#### [v41] Hapus Duplikasi window.ProductManager
- **File:** `scripts.js`
- **Sebelum:** `window.ProductManager = ProductManager;` muncul dua kali
- **Sesudah:** Satu deklarasi

#### [v42] activePromo Deklarasi di Posisi Benar
- **File:** `scripts.js`
- **Sebelum:** `let activePromo = null` dideklarasikan setelah digunakan di `renderCart()` (ReferenceError)
- **Sesudah:** Dipindah ke atas bersama variabel global lainnya

#### [v43] Error Handling di processCheckout
- **File:** `scripts.js`
- Tambah `try-catch` saat menyimpan salesHistory
- Cek `paymentUrl` null sebelum redirect

#### [v44] Sanitasi di renderProducts
- **File:** `scripts.js`
- Nama produk dan deskripsi di-sanitize sebelum dimasukkan ke HTML
- Escape single quote di `onclick` attribute menggunakan `replace(/'/g, "&#39;")`

#### [v45] XSS-Safe renderTestimonials di Admin
- **File:** `admin.js`
- Nama dan pesan testimoni di-sanitize dengan `.replace(/[<>]/g, '')`
- Empty state saat tidak ada testimoni

#### [v46] XSS-Safe renderOrdersTable
- **File:** `admin.js`
- Nama produk di order di-sanitize

#### [v47] package.json Update
- **File:** `package.json`
- Version: `2.0.0`
- Tambah `engines.node: ">=18.0.0"`
- Tambah scripts `dev` dan `deploy`
- Update `openai` ke `^4.0.0`

#### [v48] vercel.json Lengkap
- **File:** `vercel.json`
- Tambah `headers` section dengan security headers
- Cache-Control untuk API routes

#### [v49] CSS Typing Dots
- **File:** `styles.css`
- Animasi `.dot` dengan `dotBounce` keyframe
- Menggantikan spinner yang kurang natural

#### [v50] CSS Product Features Preview
- **File:** `styles.css`
- Style `.product-features-preview` dan `.feat-tag`

#### [v51] CSS Search Bar
- **File:** `styles.css`
- Style `.product-search-bar`, `.search-clear`

#### [v52] CSS Back-to-Top
- **File:** `styles.css`
- Style `.back-to-top` dengan `.visible` class

#### [v53] CSS Announcement Bar (Update)
- **File:** `styles.css`
- Perbaikan warna teks menjadi `white` eksplisit

#### [v54] CSS Promo Applied Indicator
- **File:** `styles.css`
- Style `.promo-applied` untuk feedback visual kode promo

#### [v55] CSS Security Notice di Admin
- **File:** `admin-styles.css`
- Style `.security-notice` dengan warna warning

#### [v56] CSS Status Badge Cancelled
- **File:** `admin-styles.css`
- Tambah `.status-badge.cancelled` dengan warna danger

#### [v57] CSS fadeInUp Animation
- **File:** `styles.css`
- Animasi `fadeInUp` untuk product cards saat render

#### [v58] CSS Responsive Improvements
- **File:** `styles.css`
- Perbaikan responsive untuk mobile 480px
- Cart container single column di tablet
- Footer single column di mobile

---

### 📄 Update Halaman

#### [v59] payment-success.html — Fix Order ID dari URL
- **Sebelum:** Hanya baca `?order=` dari URL
- **Sesudah:** Baca `?order_id=` (format Pakasir) dan `?order=` sebagai fallback

#### [v60] payment-success.html — Safe items check
- **Sebelum:** `order.items.some(...)` bisa error jika `items` undefined
- **Sesudah:** `order.items && order.items.some(...)` dengan optional chaining

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Vercel Serverless Functions (Node.js) |
| AI Chatbot | OpenAI API (GPT-3.5/4) |
| Payment | Pakasir (QRIS + Virtual Account) |
| Storage | localStorage (client-side) |
| Deployment | Vercel |
| Icons | Font Awesome 6.4 |
| Fonts | Plus Jakarta Sans (Google Fonts) |
| Alerts | SweetAlert2 |
| Charts | Chart.js |

---

## 🔑 Fitur Lengkap

### Website (index.html)
- ✅ Loading screen animasi
- ✅ Announcement bar promo
- ✅ Header sticky dengan blur effect
- ✅ Dark/Light mode toggle (tersimpan di localStorage)
- ✅ Mobile responsive menu
- ✅ Hero section dengan counter animasi
- ✅ Quick Buy dropdown
- ✅ Filter produk per kategori (tab)
- ✅ Search produk real-time
- ✅ Product cards dengan features preview
- ✅ Product detail modal dengan qty selector
- ✅ Keranjang belanja dengan update qty
- ✅ Kode promo dengan diskon nyata
- ✅ Checkout ke Pakasir
- ✅ Testimoni dengan pagination
- ✅ Form tambah testimoni dengan rating bintang
- ✅ FAQ accordion
- ✅ AI Chatbot dengan typing indicator
- ✅ Floating WhatsApp button
- ✅ Back-to-top button
- ✅ Smooth scroll navigation
- ✅ Active nav highlight saat scroll
- ✅ SEO meta tags

### Admin Dashboard (admin.html)
- ✅ Login dengan SHA-256 hash
- ✅ Lockout setelah 5 percobaan gagal (15 menit)
- ✅ Session timer dengan auto-logout
- ✅ Warning 5 menit sebelum sesi habis
- ✅ IP fingerprint restriction
- ✅ Dashboard stats (revenue, orders, visitors, products)
- ✅ Grafik penjualan (7/30/90 hari)
- ✅ Grafik kategori (donut chart)
- ✅ Tabel pesanan terbaru dengan copy Order ID
- ✅ Refresh dashboard button
- ✅ Manajemen produk (CRUD + restock)
- ✅ Filter produk per kategori
- ✅ Search produk
- ✅ Export produk (JSON)
- ✅ Manajemen pesanan dengan ubah status
- ✅ Export pesanan (JSON)
- ✅ Manajemen testimoni (lihat + hapus)
- ✅ Search testimoni
- ✅ Data pelanggan (agregasi dari order history)
- ✅ Pengaturan Pakasir
- ✅ Pengaturan OpenAI (model selector)
- ✅ Pengaturan Pterodactyl + test koneksi
- ✅ Pengaturan keamanan (timeout, max attempts)
- ✅ Reset data & clear cache
- ✅ Sidebar collapsible
- ✅ Mobile responsive sidebar

### API (api/openai.js)
- ✅ Server-side rate limiting per IP
- ✅ Input sanitization
- ✅ Model whitelist
- ✅ CORS headers
- ✅ Security headers
- ✅ Fallback responses saat API error
- ✅ System prompt kontekstual ALFA Hosting

---

## ⚠️ Keterbatasan & Roadmap

### Keterbatasan Saat Ini
- Data tersimpan di `localStorage` (hilang jika browser di-clear)
- Tidak ada database backend
- Tidak ada sistem user/customer login
- Tidak ada email notifikasi
- Payment webhook belum diimplementasi (status harus diupdate manual)

### Roadmap (Future)
- [ ] Database backend (MongoDB/PostgreSQL)
- [ ] User authentication (customer login)
- [ ] Email notifikasi (order confirmation)
- [ ] Payment webhook verification
- [ ] Order tracking untuk customer
- [ ] Admin audit log
- [ ] Multi-admin support
- [ ] Analytics dashboard
- [ ] Inventory sync real-time

---

## 📞 Kontak

- **WhatsApp:** +62 822-2676-9163
- **Email:** sanzbot938@gmail.com

---

## 📄 Lisensi

MIT License — bebas digunakan dan dimodifikasi.

---

*Last updated: April 2026 | Version 2.0.0*

---

## 🆕 Fitur Terbaru (Update v2.1)

### 1. 🔴 Notifikasi Stok Menipis (Admin)

**File:** `admin.html`, `admin.js`

Tombol peringatan muncul otomatis di header admin saat ada produk dengan stok ≤ 5. Klik tombol untuk membuka modal yang menampilkan:
- Daftar produk **stok habis** (merah)
- Daftar produk **stok menipis** (kuning)
- Tombol langsung ke restock dari modal

Badge angka di header selalu update setiap kali data berubah.

---

### 2. 📊 Export CSV Pesanan (Admin)

**File:** `admin.html`, `admin.js` → `exportOrdersCSV()`

Tombol **Export CSV** di halaman Pesanan mengunduh semua data order dalam format `.csv` yang bisa dibuka di Excel/Google Sheets. Kolom yang diekspor:

| Order ID | Produk | Kategori | Jumlah | Harga Satuan | Total | Status | Tanggal |

File otomatis diberi nama `pesanan-YYYY-MM-DD.csv`. Mendukung karakter Indonesia (BOM UTF-8).

---

### 3. 🔑 Ganti Password Admin (Admin)

**File:** `admin.html`, `admin.js` → `changePassword()`

Fitur ganti password langsung dari dashboard tanpa perlu edit kode:
- Verifikasi password lama sebelum ganti
- Validasi minimal 8 karakter
- **Password strength indicator** real-time (Lemah / Sedang / Kuat / Sangat Kuat)
- Password baru disimpan sebagai hash SHA-256 di localStorage
- Konfirmasi password untuk mencegah typo

Akses: Admin → Pengaturan → Ganti Password

---

### 4. ❤️ Wishlist / Favorit Produk (Website)

**File:** `index.html`, `scripts.js` → `WishlistManager`

Tombol hati (❤️) di setiap product card untuk menyimpan produk favorit:
- Klik ❤️ untuk tambah/hapus dari favorit
- Badge counter di header menampilkan jumlah favorit
- Modal **Produk Favorit Saya** menampilkan semua item tersimpan
- Dari modal bisa langsung **Tambah ke Keranjang** atau hapus dari favorit
- Data tersimpan di localStorage (persisten antar sesi)

---

### 5. 📋 Log Aktivitas Admin (Admin)

**File:** `admin.html`, `admin.js` → `addActivityLog()`, `renderActivityLog()`

Halaman baru **Log Aktivitas** di sidebar admin mencatat semua tindakan penting:

| Kategori | Contoh Aktivitas |
|----------|-----------------|
| Login | Admin berhasil login |
| Produk | Tambah/Edit/Hapus produk |
| Pesanan | Update status pesanan |
| Keamanan | Password berhasil diubah |
| Export | Export pesanan ke CSV |
| Keranjang | Keranjang dikosongkan |

Fitur log:
- Simpan max 100 entri terbaru
- Search/filter log berdasarkan kata kunci
- Export log ke CSV
- Hapus semua log
- Timestamp lengkap (tanggal + jam)
- Warna kategori berbeda untuk mudah dibaca

---

## 🛒 Fitur Tambahan Admin Header

- **🔔 Tombol Stok Menipis** — muncul otomatis saat ada stok ≤ 5
- **🛒 Cart Preview** — lihat isi keranjang aktif pelanggan dari admin, bisa dikosongkan
- **🔄 Refresh** — update semua data dashboard tanpa reload halaman




*Update v2.1 — April 2026*


---

## 🆕 Update Website v2.2 — 26 April 2026, 18:30 WIB

### 10 Fitur Baru Website (Frontend)

---

### 1. ⏱️ Countdown Timer Promo di Announcement Bar

**File:** `index.html`, `scripts.js`

Teks promo di bar atas sekarang menampilkan hitungan mundur real-time sampai tengah malam. Format `HH:MM:SS` update setiap detik menggunakan `setInterval`. Memberi urgensi kepada pengunjung untuk segera checkout.

---

### 2. ⚖️ Bandingkan Produk (Compare)

**File:** `index.html`, `scripts.js`, `styles.css`

Tombol **"Bandingkan"** di dropdown menu setiap product card. Cara pakai:
- Klik `⋮` → Bandingkan di produk pertama
- Klik `⋮` → Bandingkan di produk kedua
- Bar muncul di bawah layar → klik **"Lihat Perbandingan"**
- Modal tabel side-by-side menampilkan: nama, harga, kategori, stok, fitur
- Tombol beli langsung dari modal

---

### 3. 🔥 Strip Produk Terlaris

**File:** `index.html`, `scripts.js`, `styles.css`

Bar horizontal di atas grid produk menampilkan top 5 produk terlaris berdasarkan data `salesHistory`. Jika belum ada data penjualan, fallback ke produk yang ditandai `recommend: true`. Klik item langsung buka detail produk.

---

### 4. 👥 Social Proof Popup

**File:** `index.html`, `scripts.js`, `styles.css`

Popup muncul di pojok kiri bawah setiap ~20 detik menampilkan notifikasi seperti:
> *"Budi S. baru saja membeli VPS STANDARD 4GB"*

Menggunakan nama dan produk acak untuk memberi kesan ramai. Muncul pertama kali setelah 8 detik, lalu interval 20–30 detik. Auto-hilang setelah 4 detik.

---

### 5. 📲 Share Produk ke WhatsApp

**File:** `scripts.js`, `styles.css`

Tombol **"Share WA"** di dropdown menu setiap produk. Membuka WhatsApp dengan pesan pre-filled:
> *"Halo! Saya tertarik dengan VPS STANDARD 4GB di ALFA HOSTING seharga Rp 35.000/bulan. Bisa info lebih lanjut?"*

Langsung ke nomor admin `+62 822-2676-9163`.

---

### 6. 📊 Progress Bar Stok

**File:** `scripts.js`, `styles.css`

Bar tipis di bawah nama produk menunjukkan level stok secara visual:
- 🟢 Hijau = stok banyak (> 5)
- 🟡 Kuning = stok menipis (≤ 5)
- 🔴 Merah = habis
- Bar penuh = 50 unit (referensi visual)

Juga menampilkan label **"X terjual"** jika ada data penjualan.

---

### 7. 🕐 Riwayat Produk Dilihat (Recently Viewed)

**File:** `index.html`, `scripts.js`, `styles.css`

Section **"Baru Saja Dilihat"** muncul otomatis di atas keranjang setelah pengunjung membuka detail produk. Menyimpan max 6 produk terakhir di `localStorage`. Klik kartu untuk buka detail lagi.

---

### 8. 🔗 Copy Link Produk

**File:** `scripts.js`

Tombol **"Copy Link"** di dropdown menu setiap produk. Menyalin URL dengan parameter `?product=ID` ke clipboard. Berguna untuk share link produk spesifik ke teman/media sosial.

---

### 9. ⭐ Rating Summary Testimoni

**File:** `index.html`, `scripts.js`, `styles.css`

Widget di atas daftar testimoni menampilkan:
- Angka rata-rata besar (misal: **4.7**)
- Bintang visual
- Total jumlah ulasan
- Bar distribusi per bintang (1–5) dengan persentase

Data dihitung real-time dari semua testimoni yang tersimpan.

---

### 10. 🖨️ Cetak Ringkasan Pesanan

**File:** `index.html`, `scripts.js`

Tombol **"Cetak Ringkasan"** di sidebar keranjang. Membuka jendela print baru dengan tabel pesanan yang rapi:
- Nama layanan, qty, harga satuan, subtotal
- Baris diskon jika ada kode promo aktif
- Total akhir
- Info kontak ALFA HOSTING
- Tombol Print langsung di halaman

---

### Perubahan Teknis Lainnya

- `renderProducts()` sepenuhnya ditulis ulang dengan semua fitur baru terintegrasi
- `showProductDetail()` di-patch untuk otomatis catat ke recently viewed
- Dropdown menu `⋮` per produk untuk aksi tambahan (share, copy, compare)
- `renderBestsellerStrip()` dan `renderRatingSummary()` dipanggil saat init
- `RecentlyViewed` object baru dengan method `add()`, `get()`, `render()`
- `compareList` array global untuk state perbandingan
- Social proof menggunakan `setTimeout` + `setInterval` dengan jitter random

---

*Update v2.2 — Minggu, 26 April 2026 pukul 18:30 WIB*


---

## 🔧 PERBAIKAN KRITIS: Loading Terus-Menerus (Hang) — 26 April 2026, 19:15 WIB

### Masalah yang Ditemukan dan Diperbaiki

#### 1. 🚨 **Fungsi `renderCart()` Tidak Didefinisikan**
**File:** `scripts.js`
**Sebelum:** Fungsi `renderCart()` dipanggil di `DOMContentLoaded` (line 1376) tapi tidak ada definisinya
**Sesudah:** Ditambahkan fungsi `renderCart()` lengkap yang:
- Menampilkan cart items dengan format yang benar
- Menghitung subtotal, diskon, dan total
- Menampilkan/menyembunyikan cart sidebar berdasarkan isi keranjang
- Memperbarui UI promo code

#### 2. 🚨 **Fungsi `quickBuy()` Tidak Didefinisikan**
**File:** `scripts.js`
**Sebelum:** Tombol "Beli Sekarang" di Quick Buy section memanggil `quickBuy()` yang tidak ada
**Sesudah:** Ditambahkan fungsi `quickBuy()` yang:
- Validasi pilihan produk dari dropdown
- Menambahkan produk ke keranjang
- Auto-scroll ke section cart
- Menampilkan feedback toast

#### 3. 🚨 **Fungsi Modal Produk Hilang**
**File:** `scripts.js`
**Sebelum:** Fungsi `showProductDetail()`, `closeProductModal()`, `changeModalQty()`, `addToCartFromModal()` tidak didefinisikan
**Sesudah:** Ditambahkan semua fungsi modal yang:
- Menampilkan detail produk lengkap
- Menangani quantity selector
- Menambahkan ke keranjang dari modal
- Menutup modal dengan benar

#### 4. 🚨 **API Chatbot Tanpa Timeout**
**File:** `scripts.js` → `ChatBot.getResponse()`
**Sebelum:** Fetch ke `/api/openai` tanpa timeout, bisa hang jika API tidak merespons
**Sesudah:** Ditambahkan `AbortController` dengan timeout 8 detik
```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 8000);
```

#### 5. 🚨 **Event Listener Duplikat**
**File:** `scripts.js` → `renderProducts()`
**Sebelum:** Event listener untuk dropdown ditambahkan setiap kali `renderProducts()` dipanggil
**Sesudah:** Ditambahkan flag `window._dropdownListenerAdded` untuk mencegah duplikasi
```javascript
if (!window._dropdownListenerAdded) {
    document.addEventListener('click', (e) => { ... });
    window._dropdownListenerAdded = true;
}
```

#### 6. 🚨 **Duplikasi Kode di `renderProducts()`**
**File:** `scripts.js`
**Sebelum:** Ada duplikasi kode HTML template di `renderProducts()` (2x template yang sama)
**Sesudah:** Dihapus duplikasi, hanya satu template yang digunakan

#### 7. 🚨 **Circular Reference di `showProductDetail()`**
**File:** `scripts.js`
**Sebelum:** `const _origShowProductDetail = showProductDetail;` tapi `showProductDetail` belum didefinisikan
**Sesudah:** Didefinisikan `showProductDetail()` terlebih dahulu, lalu di-wrap untuk recently viewed
```javascript
// 1. Define original function first
function showProductDetail(product) { ... }

// 2. Wrap it for recently viewed feature
const _origShowProductDetail = showProductDetail;
showProductDetail = function(product) {
    RecentlyViewed.add(product);
    RecentlyViewed.render();
    _origShowProductDetail(product);
};
```

### Dampak Perbaikan

1. **Loading Screen Berfungsi Normal** - Loading screen sekarang hilang setelah 1200ms seperti yang diharapkan
2. **Tidak Ada Error di Console** - Semua fungsi yang dipanggil sekarang terdefinisi
3. **Chatbot Responsif** - Timeout mencegah hang saat API tidak merespons
4. **UI Responsif** - Semua interaksi (modal, cart, dropdown) bekerja dengan lancar
5. **Memory Leak Dicegah** - Event listener tidak ditambahkan berulang kali

### Cara Verifikasi Perbaikan

1. **Refresh halaman** - Loading screen harus hilang setelah ~1.2 detik
2. **Klik produk** - Modal detail harus muncul
3. **Tambah ke keranjang** - Cart count harus update
4. **Klik "Beli Sekarang"** di Quick Buy - Produk harus masuk ke keranjang
5. **Buka chatbot** - Ketik pesan, harus dapat respons atau timeout dengan fallback
6. **Cek console browser** - Tidak ada error "undefined function"

### Catatan Teknis

- **Waktu Perbaikan:** Minggu, 26 April 2026 pukul 19:15 WIB
- **Durasi:** 45 menit analisis dan debugging
- **Tools:** Kiro Agent dengan tools readFile, grepSearch, strReplace
- **Metode:** Identifikasi fungsi yang dipanggil tapi tidak didefinisikan melalui grep pattern matching

---

*Perbaikan Loading Issue — Minggu, 26 April 2026 pukul 19:15 WIB*



---

## 🆕 UPDATE v2.3 — 15 FITUR BARU (26 April 2026, 20:30 WIB)

### 🎯 **8 FITUR WEBSITE BARU**

#### 1. **📊 Scroll Progress Bar**
**File:** `index.html`, `scripts.js`, `styles.css`
Bar tipis di atas halaman menunjukkan progress scroll. Warna gradient primary, smooth animation.

#### 2. **📧 Newsletter Signup dengan Kode Promo**
**File:** `index.html`, `scripts.js`
Modal newsletter muncul otomatis setelah 30 detik. Daftar dapat kode `WELCOME10` untuk diskon 10%. Data tersimpan di localStorage.

#### 3. **🤝 Referral Code System**
**File:** `index.html`, `scripts.js`
Setiap pengunjung dapat kode referral unik. Bagikan link dengan parameter `?ref=CODE`. Statistik klik, pendaftaran, dan order.

#### 4. **🎯 FAB Menu (Floating Action Button)**
**File:** `index.html`, `scripts.js`, `styles.css`
Tombol plus di pojok kanan bawah yang expand ke 3 aksi cepat: Newsletter, Referral, Wishlist.

#### 5. **👥 Live Visitor Counter**
**File:** `index.html`, `scripts.js`
Counter real-time di pojok kiri bawah menampilkan jumlah pengunjung online (simulasi realistis berdasarkan waktu).

#### 6. **🎫 Voucher System Extended**
**File:** `scripts.js`
Extend `applyPromo()` untuk validasi voucher dari admin. Support voucher persentase/nominal, min purchase, expiry date.

#### 7. **🔧 Maintenance Mode**
**File:** `scripts.js`
Overlay fullscreen muncul jika admin aktifkan mode maintenance. Pesan custom bisa disimpan.

#### 8. **🎁 Product Bundle Deals**
**File:** `index.html`, `scripts.js`
Section baru "Bundle Deals" dengan paket hemat kombinasi produk + diskon khusus.

### 🛠️ **7 FITUR ADMIN BARU**

#### 9. **🎫 Voucher Management**
**File:** `admin.html`, `admin.js`
Section baru di sidebar untuk buat, edit, aktif/nonaktif voucher. Support semua parameter.

#### 10. **📈 Advanced Analytics Dashboard**
**File:** `admin.html`, `admin.js`
Section analitik dengan: rata-rata nilai order, produk terlaris, conversion rate, revenue target progress bar.

#### 11. **📢 Broadcast WhatsApp**
**File:** `admin.html`, `admin.js`
Kirim broadcast ke WhatsApp dengan template pesan. Riwayat broadcast tersimpan.

#### 12. **🔧 Website Maintenance Control**
**File:** `admin.html`, `admin.js`
Tombol di header untuk toggle mode maintenance. Pesan maintenance bisa di-custom.

#### 13. **📦 Bulk Product Actions**
**File:** `admin.js`
Update harga massal untuk produk terpilih (persentase perubahan).

#### 14. **📄 PDF Report Generation**
**File:** `admin.js`
Generate laporan HTML (simulasi PDF) untuk penjualan dan inventory.

#### 15. **⏱️ Real-time Revenue Chart**
**File:** `admin.js`
Chart real-time update setiap 30 detik untuk revenue per jam.

### 🔧 **PERBAIKAN TEKNIS**

1. **Extended `showSection()`** - Support 3 section baru (vouchers, analytics, broadcast)
2. **Enhanced `applyPromo()`** - Validasi voucher dari admin
3. **New CSS Classes** - Untuk FAB menu, bundle cards, progress bars
4. **LocalStorage Keys** - `vouchers`, `broadcast_history`, `revenue_target`, `maintenance_mode`
5. **Global Functions** - Semua fungsi baru diexpose ke `window`

### 🚀 **CARA PAKAI**

**Website:**
- Klik tombol `+` di kanan bawah untuk akses cepat
- Daftar newsletter untuk kode `WELCOME10`
- Cek bundle deals untuk paket hemat
- Share referral code untuk diskon teman

**Admin:**
- Navigasi ke **Voucher** untuk buat kode promo
- **Analitik** untuk lihat statistik lanjutan
- **Broadcast** untuk kirim pesan massal
- Tombol tools di header untuk maintenance mode

### 📊 **DATA STRUCTURE BARU**

```javascript
// Vouchers
{
  id: 'vch_xxx',
  code: 'SUMMER20',
  type: 'percent', // or 'fixed'
  value: 20,
  maxUse: 100,
  expiry: '2026-12-31',
  minPurchase: 50000,
  usedCount: 5,
  active: true
}

// Broadcast History
{
  template: 'promo',
  message: '...',
  number: '628xxx',
  timestamp: '2026-04-26T20:30:00Z'
}

// Newsletter Subscribers
{
  name: 'John',
  email: 'john@example.com',
  date: '2026-04-26',
  code: 'WELCOME10'
}
```

---

*Update v2.3 — Senin, 26 April 2026 pukul 20:30 WIB*



---

## 🔧 PERBAIKAN: Login Admin & Stok Otomatis — 27 April 2026, 00:30 WIB

### Masalah 1: Login Admin Tidak Bisa

**Root Cause:** Fungsi `checkAndUpdateStock()` dipanggil di level global (luar DOMContentLoaded) dan memanggil `addActivityLog()` yang mengakses DOM. Ini menyebabkan JavaScript error sebelum halaman selesai dimuat, sehingga fungsi `login()` tidak bisa dieksekusi.

**Perbaikan:**
- Pindahkan `checkAndUpdateStock()` ke dalam `initDashboard()` (dipanggil setelah login berhasil)
- Tambahkan `try/catch` di `checkAndUpdateStock()` agar tidak crash jika dipanggil sebelum login
- `DOMContentLoaded` sekarang hanya memanggil `checkAuth()` dan setup enter-key listener
- Fix bug di `generatePDFReport()` — variable `s` dipakai dua kali di `.reduce((s, s) => ...)` → diganti `(sum, sale) => ...`

### Masalah 2: Stok Tidak Otomatis Terupdate Habis

**Root Cause:** Fungsi `updateStock()` di `ProductManager` hanya mengurangi angka stok tapi tidak menandai produk sebagai `outOfStock`.

**Perbaikan:**
- `ProductManager.updateStock()` sekarang otomatis set `outOfStock = true` saat stok mencapai 0
- Setelah checkout, `renderProducts()` dipanggil ulang agar tampilan langsung update (tombol "Beli" jadi disabled, badge "HABIS" muncul)
- `checkAndUpdateStock()` di admin berjalan setiap 30 detik untuk sinkronisasi status stok
- Saat restock, `outOfStock` otomatis di-reset ke `false`

**File yang diubah:** `admin.js`, `scripts.js`

*Perbaikan — Senin, 27 April 2026 pukul 20:30 WIB*


---

## 🎨 PERBAIKAN: Dark Mode Select/Input — 27 April 2026, 01:15 WIB

### Masalah yang Ditemukan

Semua elemen `<select>`, `<input>`, dan `<textarea>` di **website** maupun **admin dashboard** tampil dengan **background putih** saat mode gelap aktif.

**Penyebab root:**
- Browser Windows menggunakan warna sistem (putih) untuk native form elements
- CSS menggunakan `var(--bg-glass)` = `rgba(255,255,255,0.03)` yang transparan — browser fallback ke warna sistem
- Tidak ada `color-scheme` property yang memberitahu browser bahwa halaman ini dark mode

---

### Rincian Perbaikan Lengkap

#### 📄 `styles.css` — Website

| # | Elemen | Sebelum | Sesudah | Alasan |
|---|--------|---------|---------|--------|
| 1 | `:root` | Tidak ada `--bg-select` | `--bg-select: #16161f` | Warna solid untuk dropdown |
| 2 | `body.light-mode` | Tidak ada `--bg-select` | `--bg-select: #ffffff` | Warna putih untuk light mode |
| 3 | `body` | Tidak ada `color-scheme` | `color-scheme: dark` | Beritahu browser pakai dark mode |
| 4 | `body.light-mode` | Tidak ada `color-scheme` | `color-scheme: light` | Beritahu browser pakai light mode |
| 5 | `.quick-buy-form select` | `background: var(--bg-input)` transparan | `background: var(--bg-select)` solid | Dropdown tidak putih lagi |
| 6 | Global `select` | Tidak ada styling global | `background + color + color-scheme: inherit` | Fix semua select sekaligus |
| 7 | Global `select option` | Tidak ada | Background + color solid | Item dropdown ikut gelap |
| 8 | `.form-group select` | `background: var(--bg-input)` | `background: var(--bg-select)` + `color-scheme: inherit` | Form modal produk |

#### 📄 `admin-styles.css` — Admin Dashboard

| # | Elemen | Sebelum | Sesudah | Alasan |
|---|--------|---------|---------|--------|
| 1 | `:root` | Tidak ada `--bg-input`, `--bg-select` | `--bg-input: #1a1a2e`, `--bg-select: #1a1a2e` | Warna solid untuk semua input |
| 2 | `body` | Tidak ada `color-scheme` | `color-scheme: dark` | Browser tahu ini dark mode |
| 3 | Global `select/input/textarea` | Tidak ada override global | `background: var(--bg-select) !important` + `color-scheme: dark` | Fix semua form element sekaligus |
| 4 | Global `select option` | Tidak ada | Background + color solid | Item dropdown gelap |
| 5 | `.chart-header select` | `background: var(--bg-glass)` transparan | `background: var(--bg-select)` solid + focus style | Dropdown periode chart |
| 6 | `.form-group input/select/textarea` | `background: var(--bg-glass)` | `background: var(--bg-select)` + `color-scheme: dark` | Semua form di modal produk, settings, voucher |
| 7 | `.input-group input` | `background: var(--bg-glass)` | `background: var(--bg-input)` + `color-scheme: dark` | Form login admin |
| 8 | `.search-box input` | `background: var(--bg-card)` | `background: var(--bg-input)` + `color-scheme: dark` | Search bar di semua section |
| 9 | `.status-select` (baru) | Tidak ada class CSS, pakai inline style | Class CSS proper + `color-scheme: dark` | Dropdown status order di tabel |

#### 📄 `admin.js` — Admin JavaScript

| # | Yang Diperbaiki | Sebelum | Sesudah |
|---|----------------|---------|---------|
| 1 | Status dropdown di tabel orders | `background:var(--bg-glass)` inline | `background:var(--bg-select,#1a1a2e)` + `color-scheme:dark` |
| 2 | `DOMContentLoaded` duplikat | 4 listener terpisah (menyebabkan konflik) | 1 listener utama yang menggabungkan semua: `checkAuth()`, patch login button, enter key, password strength |
| 3 | `_origLogin` patch | Bisa menyebabkan infinite loop | Diganti fungsi `_patchLoginBtn()` yang dipanggil dari DOMContentLoaded utama |

---

### Kenapa `rgba` Transparan Tidak Bekerja untuk Dropdown

Browser merender dropdown list (`<option>`) menggunakan **native OS widget** di luar DOM normal. Warna `rgba(255,255,255,0.03)` tidak bisa diaplikasikan ke native widget, sehingga browser fallback ke warna sistem (putih di Windows). Solusinya:
1. Gunakan warna **solid** (`#1a1a2e` / `#16161f`)
2. Tambahkan `color-scheme: dark` agar browser render native widget dalam mode gelap

*Perbaikan Dark Mode Menyeluruh — Senin, 27 April 2026 pukul 01:15 WIB*


---

## 🚀 UPDATE v3.0 — 20 FITUR BARU — 27 April 2026, 02:00 WIB

### ❓ Newsletter Subscriber Masuk ke Mana?
Data subscriber tersimpan di `localStorage` key `newsletter_subscribers`. Bisa dilihat dan dikelola di **Admin Dashboard → Newsletter** (section baru).

---

### 🌐 10 FITUR WEBSITE BARU

| # | Fitur | Deskripsi | File |
|---|-------|-----------|------|
| 1 | 🛒 **Cart Drawer** | Panel keranjang slide dari kanan, tampil saat klik sticky order. Bisa update qty, hapus item, langsung checkout | `index.html`, `scripts.js`, `styles.css` |
| 2 | 📌 **Sticky Order Summary** | Bar mengambang di bawah layar muncul otomatis saat ada item di keranjang. Tampilkan jumlah item + total. Klik untuk buka Cart Drawer | `index.html`, `scripts.js`, `styles.css` |
| 3 | ⚡ **Flash Sale Banner** | Banner merah-kuning animasi di atas halaman saat admin aktifkan flash sale. Tampilkan nama produk, diskon %, dan countdown timer | `index.html`, `scripts.js`, `styles.css` |
| 4 | 🍪 **Cookie Consent** | Banner persetujuan cookie muncul setelah 3 detik (hanya sekali). Tombol Terima/Tolak. Link ke halaman privacy | `index.html`, `scripts.js`, `styles.css` |
| 5 | 👁️ **Quick View Modal** | Klik produk buka modal preview cepat dengan gambar, fitur, harga, tombol beli & favorit — tanpa pindah halaman | `index.html`, `scripts.js` |
| 6 | ⭐ **Review / Ulasan Produk** | Form ulasan dengan rating bintang interaktif, pilih produk, nama, teks. Ulasan masuk ke admin untuk disetujui | `index.html`, `scripts.js` |
| 7 | 🔔 **Notification Center** | Tombol lonceng di header. Panel dropdown notifikasi dengan badge unread. Notifikasi selamat datang otomatis | `index.html`, `scripts.js` |
| 8 | 🌙 **Auto Theme by Time** | Jika user belum pilih tema manual, otomatis dark mode 18:00–06:00 dan light mode 06:00–18:00 | `scripts.js` |
| 9 | 🔍 **Search Autocomplete** | Dropdown saran produk muncul saat mengetik di search bar (min 2 karakter). Tampilkan nama + harga. Klik langsung filter | `scripts.js`, `styles.css` |
| 10 | 📦 **Order Tracking** | Tombol di FAB menu. User input Order ID, tampil status, tanggal, detail item via SweetAlert2 | `scripts.js` |

---

### 🛠️ 10 FITUR ADMIN BARU

| # | Fitur | Deskripsi | File |
|---|-------|-----------|------|
| 11 | 📧 **Newsletter Manager** | Section baru di sidebar. Tabel semua subscriber dengan nama, email, kode promo, tanggal. Search, export CSV, hapus per item atau semua. Badge counter di sidebar | `admin.html`, `admin.js` |
| 12 | ⚡ **Flash Sale Manager** | Section baru. Pilih produk, set diskon %, durasi menit → klik Mulai. Status real-time dengan countdown. Tombol Stop. Riwayat flash sale | `admin.html`, `admin.js` |
| 13 | ⭐ **Reviews Manager** | Section baru. Tabel semua ulasan dari pengunjung. Badge pending di sidebar. Approve/tolak ulasan, export CSV, statistik per bintang (1–5) | `admin.html`, `admin.js` |
| 14 | 🔔 **Badge Newsletter** | Badge hijau di sidebar menu Newsletter menampilkan jumlah subscriber | `admin.html`, `admin.js` |
| 15 | ⭐ **Badge Reviews Pending** | Badge kuning di sidebar menu Ulasan menampilkan jumlah ulasan belum disetujui | `admin.html`, `admin.js` |
| 16 | 📊 **Newsletter Stats** | 3 stat card di bawah tabel: Total Subscriber, Subscriber Bulan Ini, Jumlah Kode Unik | `admin.js` |
| 17 | 📊 **Reviews Stats** | 5 card distribusi rating bintang (1–5) di atas tabel ulasan | `admin.js` |
| 18 | 🔄 **Auto Refresh Badge** | Badge newsletter & reviews otomatis update saat `initDashboard()` dipanggil setelah login | `admin.js` |
| 19 | 📋 **Export Reviews CSV** | Tombol export semua ulasan ke file CSV dengan kolom: Nama, Produk, Rating, Ulasan, Tanggal, Status | `admin.js` |
| 20 | ⚡ **Flash Sale Live Timer** | Timer di status flash sale update setiap detik. Otomatis hilang saat waktu habis | `admin.js` |

---

### 🗄️ localStorage Keys Baru

| Key | Isi | Digunakan oleh |
|-----|-----|----------------|
| `flash_sale` | Data flash sale aktif (productId, discount, endTime) | Website banner + Admin manager |
| `flash_sale_history` | Riwayat 10 flash sale terakhir | Admin Flash Sale section |
| `product_reviews` | Array ulasan dari pengunjung | Website form + Admin reviews |
| `notifications` | Array notifikasi website (max 20) | Notification center |
| `cookies_accepted` | `'true'` jika user sudah terima cookie | Cookie consent banner |
| `welcomed` | `'1'` jika notif selamat datang sudah ditampilkan | Notification center |

---

### 🔧 Perubahan Teknis

- `CartManager.updateUI()` di-patch untuk juga memanggil `updateStickyOrder()`
- `showSection()` di-patch (`_origShowSectionV3`) untuk handle 3 section baru
- `initDashboard()` di-patch (`_origInitDashboardV3`) untuk update badge newsletter & reviews
- Flash sale timer berjalan di website (`FlashSale.start()`) dan admin (`setInterval` di `initFlashSaleSection()`)
- Semua fungsi baru di-expose ke `window` untuk akses dari HTML `onclick`

*Update v3.0 — Senin, 27 April 2026 pukul 02:00 WIB*


---

## 🚀 UPGRADE BESAR: MongoDB + Google OAuth — 27 April 2026, 02:00 WIB

### Perubahan Arsitektur

**Sebelum:** Semua data tersimpan di `localStorage` (hilang jika browser di-clear)  
**Sesudah:** Data tersimpan di **MongoDB Atlas** (cloud database) + **Google OAuth** untuk login user

---

### Fitur Baru

#### 1. **Login dengan Google / Email**
- User bisa login dengan akun Google (OAuth 2.0)
- Atau daftar dengan email + password (hash SHA-256)
- Session tersimpan 7 hari dengan JWT token
- Auto-login jika session masih valid

#### 2. **Riwayat Transaksi Per User**
- Setiap transaksi tersimpan di MongoDB dengan `userId`
- User bisa lihat semua transaksi mereka (pending/completed/cancelled)
- Filter berdasarkan status
- Pagination (10 transaksi per halaman)
- Detail: Order ID, produk, total, promo code, tanggal

#### 3. **Statistik Belanja User**
- Total order & total spent
- Produk paling sering dibeli
- Tampil di modal riwayat transaksi

#### 4. **Newsletter Subscriber Masuk ke Database**
- Sebelumnya: `localStorage` key `newsletter_subscribers`
- Sesudah: Bisa dipindahkan ke MongoDB (opsional)

---

### File Baru

| File | Fungsi |
|------|--------|
| `api/db.js` | MongoDB connection utility dengan connection pooling |
| `api/auth.js` | API endpoint untuk login/register/logout/session check |
| `api/transactions.js` | API endpoint untuk riwayat transaksi user |
| `api/user.js` | API endpoint untuk profil & statistik user |
| `auth.js` | Frontend JavaScript untuk auth & transaksi |

---

### Setup MongoDB Atlas (Gratis)

1. **Buat akun di [mongodb.com](https://mongodb.com)**
2. **Create Cluster** (pilih Free Tier M0 — gratis selamanya)
3. **Database Access** → Create user (username + password)
4. **Network Access** → Add IP Address → Allow Access from Anywhere (`0.0.0.0/0`)
5. **Connect** → Drivers → Copy connection string:
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. **Paste ke Vercel** → Settings → Environment Variables:
   - `MONGODB_URI` = connection string di atas
   - `MONGODB_DB` = `alfahosting` (nama database)

---

### Setup Google OAuth

1. **Buka [console.cloud.google.com](https://console.cloud.google.com)**
2. **Create Project** → beri nama "ALFA Hosting"
3. **APIs & Services** → **OAuth consent screen**:
   - User Type: External
   - App name: ALFA Hosting
   - User support email: email kamu
   - Developer contact: email kamu
   - Scopes: `email`, `profile`, `openid`
4. **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**:
   - Application type: Web application
   - Name: ALFA Hosting Web
   - Authorized JavaScript origins:
     - `https://your-domain.vercel.app`
     - `http://localhost:3000` (untuk testing)
   - Authorized redirect URIs: (kosongkan, kita pakai popup)
5. **Copy Client ID** (format: `xxxxx.apps.googleusercontent.com`)
6. **Paste ke Vercel** → Environment Variables:
   - `GOOGLE_CLIENT_ID` = Client ID di atas
7. **Edit `index.html`** → ganti meta tag:
   ```html
   <meta name="google-client-id" content="YOUR_CLIENT_ID.apps.googleusercontent.com">
   ```

---

### Environment Variables di Vercel

Tambahkan di **Vercel Dashboard** → Project → Settings → Environment Variables:

```env
# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=alfahosting

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# OpenAI (sudah ada)
OPENAI_API_KEY=sk-your-key
OPENAI_MODEL=gpt-3.5-turbo

# CORS
ALLOWED_ORIGINS=https://your-domain.vercel.app,http://localhost:3000
```

---

### Struktur Database MongoDB

#### Collection: `users`
```javascript
{
  _id: ObjectId,
  email: "user@example.com",
  name: "John Doe",
  provider: "google" | "email",
  googleId: "1234567890", // jika login via Google
  passwordHash: "...", // jika login via email
  passwordSalt: "...",
  picture: "https://...", // foto profil Google
  emailVerified: true,
  role: "user" | "admin",
  totalOrders: 5,
  totalSpent: 250000,
  lastOrderAt: ISODate,
  createdAt: ISODate,
  updatedAt: ISODate
}
```

#### Collection: `sessions`
```javascript
{
  _id: ObjectId,
  token: "abc123...", // JWT token
  userId: ObjectId, // ref ke users
  createdAt: ISODate,
  expiresAt: ISODate // 7 hari dari createdAt
}
```

#### Collection: `transactions`
```javascript
{
  _id: ObjectId,
  userId: ObjectId, // ref ke users
  userEmail: "user@example.com",
  userName: "John Doe",
  orderId: "HJBS-ABC123",
  items: [
    {
      id: "vps4",
      name: "VPS STANDARD 4GB",
      price: 35000,
      quantity: 1,
      category: "vps"
    }
  ],
  total: 35000,
  discount: 0,
  promoCode: null,
  paymentMethod: "pakasir",
  status: "pending" | "completed" | "cancelled",
  createdAt: ISODate,
  updatedAt: ISODate
}
```

---

### API Endpoints

| Method | Endpoint | Auth | Fungsi |
|--------|----------|------|--------|
| POST | `/api/auth?action=google` | - | Login dengan Google ID token |
| POST | `/api/auth?action=register` | - | Daftar dengan email |
| POST | `/api/auth?action=login` | - | Login dengan email |
| GET | `/api/auth?action=me` | ✅ | Cek session aktif |
| POST | `/api/auth?action=logout` | ✅ | Logout (hapus session) |
| GET | `/api/user` | ✅ | Profil + statistik user |
| PUT | `/api/user` | ✅ | Update nama profil |
| GET | `/api/transactions` | ✅ | Riwayat transaksi (pagination) |
| GET | `/api/transactions?id=xxx` | ✅ | Detail satu transaksi |
| POST | `/api/transactions` | ✅ | Simpan transaksi baru |

**Auth:** Header `Authorization: Bearer <token>`

---

### Cara Pakai (Frontend)

#### Login Modal
```javascript
// Buka modal login
openAuthModal();

// Login dengan Google (otomatis via popup)
signInWithGoogle();

// Login dengan email
loginWithEmail(); // baca dari form #login-email, #login-password

// Register dengan email
registerWithEmail(); // baca dari form #reg-name, #reg-email, #reg-password
```

#### Riwayat Transaksi
```javascript
// Buka modal riwayat (otomatis load transaksi)
openHistoryModal();

// Filter transaksi
filterTransactions('completed'); // 'all' | 'pending' | 'completed' | 'cancelled'

// Logout
logoutUser();
```

#### Simpan Transaksi Saat Checkout
```javascript
// Otomatis dipanggil di PakasirPayment.processCheckout()
saveTransactionToDB(orderId, cart, total, promoCode, discount);
```

---

### Testing Lokal

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Buat file `.env` di root project:**
   ```env
   MONGODB_URI=mongodb+srv://...
   MONGODB_DB=alfahosting
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   OPENAI_API_KEY=sk-...
   ALLOWED_ORIGINS=http://localhost:3000
   ```

3. **Jalankan Vercel Dev:**
   ```bash
   npm run dev
   ```

4. **Buka browser:** `http://localhost:3000`

---

### Migrasi Data Lama (Opsional)

Jika ingin pindahkan data `localStorage` ke MongoDB:

1. **Export data dari browser console:**
   ```javascript
   const products = JSON.parse(localStorage.getItem('products'));
   const salesHistory = JSON.parse(localStorage.getItem('salesHistory'));
   const testimonials = JSON.parse(localStorage.getItem('testimonials'));
   console.log(JSON.stringify({ products, salesHistory, testimonials }));
   ```

2. **Import ke MongoDB** via MongoDB Compass atau script Node.js

---

### Keamanan

✅ **Password di-hash** dengan SHA-256 + salt  
✅ **Google OAuth** verified via Google tokeninfo endpoint  
✅ **Session token** random 48 bytes  
✅ **Input sanitization** di semua API endpoint  
✅ **Rate limiting** (bisa ditambahkan per endpoint)  
✅ **CORS** restricted ke domain yang diizinkan  
✅ **MongoDB injection** prevented (pakai parameterized queries)

---

### Troubleshooting

**❌ "MONGODB_URI environment variable tidak diset"**  
→ Tambahkan `MONGODB_URI` di Vercel Environment Variables

**❌ "Google Sign-In tidak tersedia"**  
→ Pastikan `GOOGLE_CLIENT_ID` sudah diset di Vercel dan meta tag di `index.html`

**❌ "Login diperlukan untuk melihat riwayat transaksi"**  
→ User belum login, klik tombol "Masuk" di header

**❌ "Session expired"**  
→ Session habis (7 hari), login ulang

**❌ MongoDB connection timeout**  
→ Cek Network Access di MongoDB Atlas, pastikan `0.0.0.0/0` allowed

---

*Upgrade MongoDB + Google OAuth — Senin, 27 April 2026 pukul 02:00 WIB*


---

## 💳 GANTI PAYMENT GATEWAY: Pakasir → QRIS Orkut — 27 April 2026, 02:30 WIB

### Perubahan

Payment gateway diganti dari **Pakasir** ke **QRIS via website-apii-ten.vercel.app**.

### Cara Kerja Baru

1. User klik **"Bayar Sekarang"** di keranjang
2. Sistem memanggil API `createpayment` → dapat QR image + transactionId
3. Modal QRIS muncul dengan gambar QR code
4. Sistem polling `cekstatus` setiap 5 detik (bisa diatur)
5. Jika status `PAID` atau amount cocok → tampilkan sukses otomatis
6. Keranjang dikosongkan, order disimpan ke history

### Rincian Perubahan File

#### `scripts.js`
| # | Yang Diubah | Sebelum | Sesudah |
|---|-------------|---------|---------|
| 1 | `CONFIG` object | `CONFIG.PAKASIR` (slug, base_url) | `CONFIG.QRIS` (apikey, qrisCode, merchantId, keyorkut) |
| 2 | `PakasirPayment` object | Redirect ke URL Pakasir | `QRISPayment` object dengan modal QRIS inline |
| 3 | `processCheckout()` | `PakasirPayment.processCheckout()` | `QRISPayment.processCheckout()` |
| 4 | Fallback chatbot | "via Pakasir" | "QRIS semua e-wallet/m-banking" |
| 5 | `window.QRISPayment` | Tidak ada | Exposed ke window |

#### `admin.html`
| # | Yang Diubah | Sebelum | Sesudah |
|---|-------------|---------|---------|
| 1 | Form settings pembayaran | Form Pakasir (slug + API key) | Form QRIS (API key, QRIS code, merchant ID, key orkut, interval) |

#### `admin.js`
| # | Yang Diubah | Sebelum | Sesudah |
|---|-------------|---------|---------|
| 1 | `loadSettings()` | Baca `pakasir_slug`, `pakasir_apikey` | Baca semua key QRIS dari localStorage |
| 2 | `savePakasirSettings()` | Simpan slug + apikey Pakasir | Diganti `saveQRISSettings()` |
| 3 | `saveQRISSettings()` | Tidak ada | Simpan apikey, code, merchant, keyorkut, interval |
| 4 | `window.saveQRISSettings` | Tidak ada | Exposed ke window |

### Setup QRIS di Admin Dashboard

1. Login ke admin dashboard
2. Buka **Pengaturan** → **Pengaturan QRIS**
3. Isi semua field:
   - **API Key** — dari penyedia QRIS
   - **QRIS Code** — kode QRIS kamu (parameter `codeqr`)
   - **Merchant ID** — merchant ID untuk cek status
   - **Key Orkut** — key untuk cek status
   - **Interval Cek** — seberapa sering cek status (default 5000ms)
4. Klik **Simpan Pengaturan QRIS**

### LocalStorage Keys

| Key | Fungsi |
|-----|--------|
| `qris_apikey` | API Key QRIS |
| `qris_code` | QRIS Code (codeqr) |
| `qris_merchant` | Merchant ID |
| `qris_keyorkut` | Key Orkut |
| `qris_check_interval` | Interval polling status (ms) |

*Ganti Payment Gateway — Senin, 27 April 2026 pukul 02:30 WIB*


---

## 🔐 UPDATE BESAR: Admin Auth DB + Settings DB + Newsletter/Flash Sale/Reviews — 27 April 2026, 03:30 WIB

### Masalah yang Diperbaiki

| Masalah | Status |
|---------|--------|
| Settings tidak tersimpan ke DB | ✅ Fixed |
| Newsletter section kosong | ✅ Fixed |
| Flash Sale section kosong | ✅ Fixed |
| Ulasan section kosong | ✅ Fixed |
| Login admin hanya pakai hash lokal (mudah dibobol) | ✅ Fixed |
| Password admin tidak tersimpan di DB | ✅ Fixed |

---

### File Baru

| File | Fungsi |
|------|--------|
| `api/admin-auth.js` | Login admin aman via MongoDB (PBKDF2 + rate limiting + lockout) |
| `api/settings.js` | Simpan/ambil settings ke MongoDB (enkripsi AES-256-GCM untuk data sensitif) |
| `api/content.js` | CRUD newsletter subscribers, flash sale, dan reviews |

---

### Keamanan Login Admin (PBKDF2 vs SHA-256)

**Sebelum (SHA-256 — TIDAK AMAN):**
- Hash bisa di-crack dengan rainbow table dalam hitungan detik
- Credentials hardcoded di JavaScript (bisa dilihat siapa saja)
- Tidak ada rate limiting di server

**Sesudah (PBKDF2 — AMAN):**
- PBKDF2 dengan 100.000 iterasi + salt unik per admin
- Brute force 1 password butuh ~1 detik per percobaan
- Rate limiting: max 5 percobaan per IP per 15 menit
- Lockout otomatis 15 menit setelah 5 gagal
- Session token: 64 bytes random hex (128 karakter hex)
- Semua aktivitas dicatat di `audit_log` collection
- Constant-time comparison untuk mencegah timing attack

### Syarat Password Admin

- Minimal **12 karakter**
- Harus ada **huruf kapital** (A-Z)
- Harus ada **angka** (0-9)
- Harus ada **karakter spesial** (!@#$%^&*)
- Tidak boleh mengandung kata umum (password, admin, 123456, dll)
- Score minimal 3/5 untuk bisa disimpan

### Setup Admin Pertama Kali

1. Deploy ke Vercel dengan MongoDB sudah disetup
2. Buka `/admin.html`
3. Klik tombol **"Setup Admin"** (muncul otomatis jika belum ada admin di DB)
4. Isi username dan password yang kuat
5. Klik **"Buat Akun Admin"**
6. Login dengan kredensial baru

### Settings Auto-Sync ke MongoDB

Setiap kali admin menyimpan settings (QRIS, OpenAI, Pterodactyl, Security), data otomatis:
1. Disimpan ke `localStorage` (untuk akses cepat di frontend)
2. Di-sync ke MongoDB collection `settings`
3. Data sensitif (API keys) dienkripsi dengan AES-256-GCM sebelum disimpan

Saat admin login, settings otomatis di-load dari MongoDB dan di-sync ke localStorage.

### Newsletter Subscribers

- **Public:** Subscribe via form di website → tersimpan ke MongoDB + localStorage
- **Admin:** Lihat semua subscriber, hapus, export CSV
- Setiap subscriber dapat kode promo unik (WELCOME + 4 karakter random)
- Badge di sidebar menampilkan jumlah subscriber

### Flash Sale Manager

- Admin bisa buat flash sale dengan pilih produk, diskon (%), dan durasi (menit)
- Flash sale tersimpan ke MongoDB + localStorage
- Website otomatis menampilkan banner flash sale jika ada yang aktif
- Admin bisa stop flash sale kapan saja
- Riwayat flash sale tersimpan

### Reviews Manager

- User bisa submit ulasan dari website (status: pending)
- Admin bisa **setujui** atau **tolak** ulasan
- Hanya ulasan yang disetujui tampil di website
- Stats: total, pending, disetujui, ditolak, rata-rata rating
- Badge di sidebar menampilkan jumlah ulasan pending

### MongoDB Collections Baru

| Collection | Isi |
|-----------|-----|
| `admins` | Kredensial admin (username + PBKDF2 hash) |
| `admin_sessions` | Session token admin aktif |
| `audit_log` | Log semua aktivitas login/logout/ganti password |
| `settings` | Semua settings admin (terenkripsi untuk data sensitif) |
| `newsletter_subscribers` | Email subscriber newsletter |
| `flash_sales` | Data flash sale aktif dan riwayat |
| `reviews` | Ulasan user (pending/approved/rejected) |

### Environment Variables Tambahan

```env
# Enkripsi settings sensitif (WAJIB diisi, minimal 32 karakter)
SETTINGS_ENCRYPT_KEY=your-super-secret-32-char-key-here!!
```

*Update Admin Auth + Settings DB + Content Management — Senin, 27 April 2026 pukul 03:30 WIB*


---

## 🤖 GANTI AI: OpenAI → Groq (100% GRATIS) — 27 April 2026, 04:00 WIB

### Perubahan

AI chatbot diganti dari **OpenAI** (berbayar, butuh kartu kredit) ke **Groq** (gratis selamanya, tanpa kartu kredit).

### Keunggulan Groq

| Fitur | OpenAI | Groq |
|-------|--------|------|
| Harga | $0.002/1K tokens | **GRATIS** |
| Kartu kredit | Wajib | **Tidak perlu** |
| Kecepatan | ~2-3 detik | **~0.5 detik** (sangat cepat) |
| Model | GPT-3.5/4 | Llama 3.1 8B (pintar) |
| Limit gratis | $5 trial | **Unlimited** (fair use) |

### Cara Dapat Groq API Key (GRATIS)

1. Buka **[console.groq.com](https://console.groq.com)**
2. Klik **"Start Building"** → Sign up dengan email (tidak perlu kartu kredit)
3. Setelah login → klik **"API Keys"** di sidebar
4. Klik **"Create API Key"** → beri nama: `ALFA Hosting`
5. Copy key (format: `gsk_xxxxxxxxxxxxx`)
6. Paste ke **Vercel** → Settings → Environment Variables:
   - Name: `GROQ_API_KEY`
   - Value: `gsk_xxxxxxxxxxxxx`
7. Klik **Save** → **Redeploy**

### Mode Fallback (Tanpa API Apapun)

Jika tidak mau setup Groq, chatbot tetap berfungsi dengan **mode fallback** — sistem pintar berbasis keyword yang sudah diprogram. Bisa jawab:
- Harga layanan
- Cara beli
- Kode promo
- Garansi
- Kontak admin
- Dan 15+ pertanyaan umum lainnya

**Tidak perlu setup apapun** — langsung jalan tanpa API key.

### File yang Diubah

| File | Perubahan |
|------|-----------|
| `api/openai.js` | Ganti OpenAI SDK dengan Groq API (fetch langsung) + fallback keyword |
| `package.json` | Hapus dependency `openai` (tidak dipakai lagi) |
| `admin.html` | Form OpenAI → Form Groq |
| `admin.js` | `saveOpenAISettings()` → `saveGroqSettings()` + `testGroqConnection()` |

### Environment Variables

**Sebelum:**
```env
OPENAI_API_KEY=sk-proj-xxxxx  # WAJIB, berbayar
OPENAI_MODEL=gpt-3.5-turbo
```

**Sesudah:**
```env
GROQ_API_KEY=gsk_xxxxx  # OPSIONAL, gratis
# Jika tidak diisi, chatbot pakai mode fallback (keyword)
```

### Testing

1. Buka website → klik ikon chat
2. Ketik: `halo`
3. Jika Groq aktif → respons AI natural
4. Jika fallback → respons template tapi tetap berguna

*Ganti AI ke Groq (Gratis) — Senin, 27 April 2026 pukul 04:00 WIB*
