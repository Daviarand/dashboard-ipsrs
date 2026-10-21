# Panduan Setup Supabase Cloud — Dashboard IPSRS
**Rumah Sakit Soeharto Heerdjan**

Panduan ini disusun untuk membantu administrator atau staf teknis melakukan instalasi dan konfigurasi backend Supabase Cloud **tanpa perlu menginstal Docker atau Supabase CLI**. Seluruh proses dilakukan langsung melalui antarmuka web (browser) di [Supabase Dashboard](https://supabase.com/dashboard).

---

## 📋 Ringkasan Persiapan

Sebelum memulai, pastikan Anda:
1. Memiliki akun di [supabase.com](https://supabase.com).
2. Membuka folder proyek Dashboard IPSRS di komputer Anda.
3. Menyiapkan catatan aman (password manager) untuk menyimpan kredensial database.

> [!CAUTION]
> **PENTING TENTANG KEAMANAN KUNCI RAHASIA:**
> Jangan pernah membagikan atau menyimpan **Service Role Key** atau **Database Password** ke dalam repositori kode git, file `.env` di komputer klien, maupun pesan chat umum. Kunci ini hanya digunakan di server Supabase!

---

## 🚀 Langkah demi Langkah

### Langkah 1: Membuat Proyek Baru di Supabase Cloud

1. Masuk ke [Supabase Dashboard](https://supabase.com/dashboard).
2. Klik tombol **New project**.
3. Pilih organisasi Anda.
4. Isi form pembuatan proyek:
   - **Name**: `ipsrs-dashboard` (atau nama lain yang sesuai kebijakan RS).
   - **Database Password**: Klik *Generate a password* atau buat password yang sangat kuat. **Salin dan simpan password ini di tempat yang aman.**
   - **Region**: Pilih yang terdekat dengan Indonesia, disarankan **Singapore (`ap-southeast-1`)** agar akses cepat dan latensi rendah.
   - **Pricing Plan**: Pilih paket yang sesuai (Free untuk uji coba, atau Pro untuk produksi agar tidak tertidur otomatis).
5. Klik **Create new project** dan tunggu 1–2 menit sampai database siap.

---

### Langkah 2: Mengatur Keamanan Autentikasi (Auth)

Karena sistem tiket IPSRS hanya diperuntukkan bagi staf internal (Admin & Teknisi), **pendaftaran publik mandiri harus dimatikan**:

1. Di menu bilah sisi kiri Supabase, klik ikon **Authentication** (atau menu **Auth**).
2. Buka tab **Providers** -> pilih **Email**.
3. Pastikan pengaturan berikut:
   - **Enable Email provider**: Aktifkan (`ON`).
   - **Allow new users to sign up**: Nonaktifkan (`OFF`). *(Ini mencegah orang asing mendaftar sendiri dari luar)*.
   - **Confirm email**: Matikan (`OFF`) karena akun teknisi dibuat secara resmi oleh Admin IPSRS.
4. Buka tab **Configuration** (atau **Policies / Settings**):
   - **Minimum password length**: Atur minimal **8** karakter.
5. Klik **Save**.

---

### Langkah 3: Menjalankan Migrasi Database SQL (001 sampai 008)

Seluruh rancangan tabel, aturan keamanan, dan fungsi rekap dijalankan melalui fitur **SQL Editor** bawaan Supabase.

1. Di menu bilah sisi kiri, klik ikon **SQL Editor**.
2. Klik tombol **+ New query**.
3. Buka file-file SQL di folder `supabase/migrations/` di komputer Anda, lalu salin dan tempel isinya **secara berurutan satu per satu**:

| Urutan | File Migrasi di Komputer | Isi / Fungsi |
|:---:|---|---|
| **1** | `supabase/migrations/20261019000001_initial_types_and_tables.sql` | Membuat ENUM tipe data dan 14 tabel utama. |
| **2** | `supabase/migrations/20261019000002_functions_and_triggers.sql` | Membuat nomor tiket otomatis, trigger audit, validasi status, dan proteksi stok. |
| **3** | `supabase/migrations/20261019000003_row_level_security.sql` | Mengaktifkan RLS (keamanan data), 32 kebijakan hak akses, dan bucket penyimpanan formulir fisik. |
| **4** | `supabase/migrations/20261019000004_views_and_recap_functions.sql` | Membuat view rekap dan 8 fungsi laporan/dashboard berbasis tanggal (WIB). |
| **5** | `supabase/migrations/20261019000005_seed_initial_data.sql` | Mengisi pengaturan awal SLA (24 jam) serta jenis kerusakan dan alasan gagal standar. |
| **6** | `supabase/migrations/20261019000006_hardening_and_rpc_actions.sql` | Penguatan validasi waktu, pencegahan hapus admin terakhir, dan aksi atomik selesai/buka tiket. |
| **7** | `supabase/migrations/20261019000007_data_api_grants.sql` | Memberikan izin hak akses eksplisit Data API (mencegah error `42501 permission denied`). |
| **8** | `supabase/migrations/20261020000008_ticket_difficulty.sql` | Menambahkan tingkat kesulitan opsional ke tiket dan view tiket. |

> [!TIP]
> **Cara Menjalankan Setiap File:**
> - Tempel isi file ke lembar SQL Editor.
> - Klik tombol hijau **Run** (atau tekan `Ctrl + Enter`).
> - Pastikan muncul pesan sukses: `Success. No rows returned` (atau sejenisnya).
> - **Jika ada peringatan atau error, berhenti terlebih dahulu**, jangan lanjutkan ke file berikutnya sebelum error tersebut diselesaikan.
> - Jika muncul dialog peringatan *"Tables have no Row Level Security"* saat menjalankan migrasi 001, pilih opsi **Enable RLS** (hasil akhirnya sama dengan Migrasi 003).

Jika migrasi 001–007 sudah pernah berhasil dijalankan di project ini, **jangan jalankan ulang**; jalankan hanya Migrasi 008. Migrasi 008 menambahkan kolom kesulitan pada tiket yang sudah ada tanpa menghapus data lama.

---

### Langkah 4: Menjalankan Query Verifikasi Pasca-Migrasi

Untuk memastikan seluruh skema berhasil terpasang sempurna tanpa ada yang terlewat, buat query baru di **SQL Editor**, tempel script berikut, lalu klik **Run**:

```sql
-- a. Semua tabel ber-RLS: harus menghasilkan 0 baris (tidak ada tabel publik tanpa pengaman)
select tablename from pg_tables where schemaname = 'public' and not rowsecurity;

-- b. Jumlah tabel di schema public: harus bernilai 14
select count(*) as jumlah_tabel from pg_tables where schemaname = 'public';

-- c. Jumlah policy keamanan di schema public: harus bernilai 32
select count(*) as jumlah_policy from pg_policies where schemaname = 'public';

-- d. Fungsi RPC: harus terdaftar 11 fungsi (8 fungsi rekap dashboard + 3 fungsi aksi atomik)
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname like 'rpc\_%' order by proname;

-- e. Bucket penyimpanan berkas fisik: harus ada 'ticket-forms' dengan public = false
select id, name, public from storage.buckets;

-- f. Pengaturan SLA awal: sla_hours = 24 dan sla_warning_hours = 20
select * from public.app_settings order by key;

-- g. Izin Data API: pengguna anonim (anon) tidak boleh muncul sama sekali
select grantee, table_name, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
group by grantee, table_name order by grantee, table_name;
```

---

### Langkah 5: Membuat Akun Admin Pertama

Sistem membutuhkan satu akun Admin utama sebagai pengelola sistem:

1. Buka menu **Authentication** -> klik tab **Users**.
2. Klik tombol **Add user** -> pilih **Create new user**.
3. Masukkan data:
   - **Email**: `admin@ipsrs.local`
   - **Password**: Masukkan kata sandi yang kuat (minimal 8 karakter).
   - Centang opsi **Auto Confirm User?** (agar langsung aktif tanpa verifikasi email).
4. Klik **Create user**.
5. Setelah user muncul di daftar tabel pengguna, **salin User UID** (berupa deretan huruf dan angka panjang berformat UUID, misalnya `a1b2c3d4-e5f6-...`).
6. Kembali ke **SQL Editor**, buat query baru, dan jalankan perintah berikut (ganti `<UUID_DARI_LANGKAH_5>` dengan UID yang Anda salin):

```sql
insert into public.profiles (id, username, full_name, role)
values ('<UUID_DARI_LANGKAH_5>', 'admin', 'Admin Koordinator IPSRS', 'admin');
```

7. Klik **Run**. Sekarang akun Admin utama Anda telah aktif dan siap digunakan untuk masuk ke aplikasi.

---

### Langkah 6: Konfigurasi File Lingkungan Aplikasi (`.env`)

Aplikasi web frontend membutuhkan alamat URL dan kunci publik (*anon key*) untuk berkomunikasi dengan database:

1. Di Supabase Dashboard, klik ikon gerigi **Project Settings** (di pojok kiri bawah).
2. Pilih submenu **API** (atau klik tombol **Connect** di bagian atas dashboard).
3. Cari informasi berikut:
   - **Project URL** (contoh: `https://xyzcompany.supabase.co`)
   - **Project API Keys** -> Salin bagian **`anon` `public`** (atau `publishable key`).
4. Buka file `.env` di folder utama project komputer Anda (buat baru jika belum ada), lalu isi:

```env
VITE_SUPABASE_URL=https://xyzcompany.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_LOGIN_EMAIL_DOMAIN=ipsrs.local
```

`VITE_LOGIN_EMAIL_DOMAIN` boleh dihilangkan; aplikasi memakai `ipsrs.local` sebagai default. Ini domain email semu internal untuk membentuk alamat login Supabase dari username, bukan alamat email sungguhan dan tidak perlu memiliki inbox. Contohnya username `admin` dipetakan menjadi `admin@ipsrs.local`; pengguna tetap masuk ke aplikasi dengan username `admin`. Karena konfirmasi email dimatikan, tidak perlu menerima email untuk alamat tersebut. Jika Supabase menolak domain itu saat membuat pengguna, ganti domain ini dan samakan dengan secret `LOGIN_EMAIL_DOMAIN` di Edge Function. Setelah mengubah `.env`, hentikan lalu jalankan kembali server `npm run dev`.

---

### Langkah 7: Deploy Edge Function `admin-manage-users`

Edge Function digunakan oleh admin untuk membuat akun teknisi baru dan mereset kata sandi teknisi dengan aman dari dalam aplikasi:

1. Di Supabase Dashboard, klik menu **Edge Functions**.
2. Klik tombol **Deploy a new function** (atau **Create Function**).
3. Pilih opsi **Via Editor** (tulis di browser).
4. Beri nama function: `admin-manage-users`.
5. Buka file `supabase/functions/admin-manage-users/index.ts` di komputer Anda, salin seluruh isinya, lalu tempel ke editor Supabase.
6. Pastikan opsi **Enforce JWT Verification** tetap aktif (`ON`).
7. Di pengaturan Secrets/Environment Variables Edge Function, isi `ALLOWED_ORIGIN` dengan origin aplikasi (contoh lokal `http://localhost:5173`; untuk produksi gunakan alamat hosting aplikasi). Jika domain email semu bukan `ipsrs.local`, atur `LOGIN_EMAIL_DOMAIN` dan samakan dengan `VITE_LOGIN_EMAIL_DOMAIN` di `.env`.
8. Jangan menyalin atau menaruh `SUPABASE_SERVICE_ROLE_KEY` ke source code atau `.env` frontend. Supabase menyediakan secret server tersebut di lingkungan Edge Function.
9. Klik tombol **Deploy**.

---

### Langkah 8: Menjalankan Aplikasi dan Membuat Akun Teknisi

1. Pastikan `.env` sudah diisi, lalu jalankan dari folder proyek:

```powershell
npm install
npm run dev
```

2. Buka alamat lokal yang ditampilkan terminal, lalu masuk menggunakan username `admin` dan kata sandi akun admin.
3. Buka **Data Master → Akun Teknisi**, lalu buat empat akun teknisi. Kata sandi awal minimal 8 karakter; bagikan kredensial melalui cara yang aman.

### Langkah 9: Smoke Test dan Data Contoh Pengembangan

Sebelum mencoba aplikasi, jalankan smoke test untuk memeriksa trigger bisnis, klasifikasi, aksi RPC atomik, append-only, dan RLS. Jika akun admin/teknisi belum ada, skrip berhenti dengan pesan prasyarat yang jelas.

1. Buka file `supabase/tests/smoke.sql`.
2. Salin dan tempel ke **SQL Editor** Supabase, lalu klik **Run**.
3. Buka tab **Messages / Results**: pastikan tidak ada pesan `GAGAL` dan transaksi berakhir dengan `ROLLBACK`.

Untuk mengisi data simulasi (15 ruangan, 8 material, dan 30 tiket) **hanya pada project development/uji coba**:
1. Buka file `supabase/seed-dev.sql`.
2. Salin dan tempel ke **SQL Editor**, lalu klik **Run**.
3. Data simulasi siap dijelajahi melalui aplikasi. Jangan menjalankan seed di project produksi.
