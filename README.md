# Prosentase SO API

Next.js API proxy untuk mengambil data prosentase stock opname dari AlfaStore dan mengubah tabel HTML menjadi format yang lebih sederhana untuk parser React Native.

## Endpoint

```text
GET /api/prosentase-so?storeId=STORE_ID&dateSo=YYYY-MM-DD
```

Contoh setelah deploy ke Vercel:

```text
https://NAMA-PROJECT.vercel.app/api/prosentase-so?storeId=T123&dateSo=2026-08-19
```

## Jalankan lokal

```bash
npm install
npm run dev
```

Lalu buka:

```text
http://localhost:3000/api/prosentase-so?storeId=T123&dateSo=2026-08-19
```

## Deploy ke Vercel

1. Upload seluruh isi folder project ini ke repository GitHub.
2. Buka Vercel.
3. Add New > Project.
4. Import repository GitHub.
5. Pastikan Framework Preset = Next.js.
6. Klik Deploy.
