-- ============================================================================
-- Migrasi 005 — Data Awal (Seed)
-- Dashboard IPSRS RS. Soeharto Heerdjan
-- Sumber: IPSRS_DASHBOARD_SPEC.md Bagian 5.2 (Migrasi 005)
-- ============================================================================

-- ==========================
-- PENGATURAN APLIKASI
-- ==========================
insert into public.app_settings (key, value, description) values
  ('sla_hours', '24', 'Batas jam untuk klasifikasi Laksana'),
  ('sla_warning_hours', '20', 'Jam mulai penanda mendekati batas');

-- ==========================
-- ALASAN GAGAL LAKSANA
-- ==========================
insert into public.failure_reasons (name) values
  ('Material tidak tersedia di gudang'),
  ('Perlu penanganan pihak ketiga / vendor'),
  ('Kerusakan kompleks'),
  ('Lainnya');

-- ==========================
-- JENIS KERUSAKAN
-- ==========================
insert into public.damage_types (name) values
  ('Listrik'), ('Plumbing'), ('AC'), ('Sipil'), ('Lainnya');

-- ============================================================================
-- INSTRUKSI: Membuat Admin Pertama (manual, sekali)
-- ============================================================================
--
-- Langkah 1:
--   Buka Supabase Dashboard → Authentication → Add user
--   Email : admin@ipsrs.local
--   Password : (isi password yang diinginkan)
--   Centang "Auto Confirm"
--
-- Langkah 2:
--   Jalankan SQL berikut (ganti <UUID> dengan UUID user dari langkah 1):
--
--   INSERT INTO public.profiles (id, username, full_name, role)
--   VALUES ('<UUID user dari langkah 1>', 'admin', 'Admin IPSRS', 'admin');
--
-- Selanjutnya, akun lain dibuat dari aplikasi lewat Edge Function
-- (admin-manage-users).
-- ============================================================================
