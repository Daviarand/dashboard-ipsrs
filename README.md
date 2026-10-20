# Dashboard IPSRS — RS. Soeharto Heerdjan

Aplikasi internal untuk pencatatan tiket perbaikan, penugasan teknisi, persediaan material, formulir penyelesaian, dan rekap kinerja IPSRS.

Fitur mencakup pengelolaan tiket dan master, pencatatan mutasi material, dashboard dengan filter WIB, serta ekspor rekap dashboard ke Excel dan PDF.

## Menjalankan aplikasi

Prasyarat: Node.js 20.19 atau yang lebih baru dan npm.

```bash
npm install
```

Salin `.env.example` menjadi `.env`, lalu isi Project URL dan anon/publishable key dari Supabase. Jangan pernah menaruh service role key atau password database di frontend.

```bash
npm run dev
```

Pemeriksaan lokal:

```bash
npm test
npm run lint
npm run build
```

Panduan membuat project Supabase Cloud, menjalankan migrasi SQL secara manual, dan men-deploy Edge Function tersedia di [docs/SETUP_SUPABASE_CLOUD.md](./docs/SETUP_SUPABASE_CLOUD.md).
