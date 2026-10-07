# clutch-tech

Kerangka awal Next.js (App Router + TypeScript) untuk migrasi dari
`clutch-disc-production-system` (PHP + PostgreSQL).

## Isi kerangka ini

```
clutch-tech/
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx          # root layout
│  │  ├─ page.tsx            # halaman utama (placeholder)
│  │  └─ api/
│  │     └─ health/route.ts  # tes koneksi database
│  └─ lib/
│     └─ db.ts               # helper koneksi Postgres (setara database.php)
├─ .env.local.example        # contoh variabel environment
├─ package.json
├─ tsconfig.json
└─ next.config.ts
```

`src/lib/db.ts` menyediakan dua fungsi, setara dengan `database.php` versi lama:

- `dbSelect(sql, params)` → setara `db_select()`, untuk SELECT.
- `dbExecute(sql, params)` → setara `db_execute()`, untuk INSERT/UPDATE/DELETE.

Keduanya pakai parameterized query (`$1`, `$2`, dst) supaya aman dari SQL
injection, sama seperti PDO prepared statement di versi PHP.

## Cara menjalankan di komputer Anda

### 1. Install dependencies

Dari dalam folder `clutch-tech`:

```bash
npm install
```

### 2. Siapkan environment variable

Copy `.env.local.example` jadi `.env.local`:

```bash
copy .env.local.example .env.local
```

(di PowerShell/Windows, atau `cp` kalau di Mac/Linux)

Buka `.env.local`, isi `DATABASE_URL` dengan **connection string mode
"Transaction pooler"** dari Supabase (Project Settings → Database →
Connection string), port **6543**. Mode ini yang paling cocok untuk
dipakai saat aplikasi jalan (baik di lokal maupun nanti di Vercel),
karena cocok untuk banyak koneksi singkat sekaligus.

### 3. Jalankan development server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

### 4. Cek koneksi database

Buka [http://localhost:3000/api/health](http://localhost:3000/api/health).

Kalau berhasil, akan muncul JSON berisi daftar `process_stage` dari
database Supabase Anda (Mixing, Preforming, Hot Press, Drilling,
Finishing). Kalau gagal, pesan error akan menjelaskan penyebabnya
(biasanya `DATABASE_URL` salah atau password salah).

## Modul Preforming (pilot pertama)

Port dari `view/preforming.php` + `api_preforming.php`:

- `src/app/api/preforming/route.ts` — logika agregasi tetap sama persis
  dengan versi PHP (target 200 pcs/sisi, deteksi shift overnight, status
  RUNNING/OFF, dll), query pakai parameterized query ($1, $2, ...).
- `src/app/preforming/page.tsx` + `PreformingDashboard.tsx` — tampilan
  dashboard: filter tanggal/shift, KPI card, grid status mesin per sisi
  A/B, dan **chart Actual vs Target per mesin** (pakai Recharts — ini
  tambahan baru, tidak ada di versi PHP lama).
- Auto-refresh tiap 10 detik, sama seperti `setInterval` di versi lama.
- `src/types/preforming.ts` — tipe data bersama + helper
  `getCurrentShiftState()` untuk menentukan tanggal/shift default saat
  halaman dibuka.

**Catatan penyederhanaan:** logika "Minggu libur" (kasus shift-3 dini
hari di hari Minggu diperlakukan beda) dari `preforming.php` versi lama
sengaja disederhanakan di `getCurrentShiftState()`. Untuk pemakaian
produksi nyata, sesuaikan lagi kalau pabrik benar-benar libur hari
Minggu.

Buka `http://localhost:3000/preforming` untuk melihatnya.

## Catatan penting

- **Jangan pernah commit `.env.local`** — sudah masuk `.gitignore`.
- Saat deploy ke Vercel nanti, `DATABASE_URL` yang sama diisi ulang
  lewat **Vercel → Project Settings → Environment Variables**, bukan
  lewat file.
- Pool koneksi (`db.ts`) memakai `globalThis` supaya aman dari
  connection leak saat `next dev` hot-reload. Ini normal dan tidak
  perlu diubah.
