-- ============================================================================
-- SEED DATA PENGEMBANGAN (DEV SEED)
-- Dashboard IPSRS RS. Soeharto Heerdjan
-- Sumber: IPSRS_DASHBOARD_SPEC.md §8.2
--
-- PERINGATAN:
-- 1. Script ini HANYA untuk lingkungan pengujian/pengembangan lokal/staging.
-- 2. JANGAN dijalankan di database produksi!
-- 3. Membutuhkan minimal 1 akun admin dan 1 akun teknisi yang SUDAH ADA di profiles.
-- 4. Dirancang idempoten: jika dijalankan ulang, tidak akan menduplikasi jika data sudah ada.
-- ============================================================================

DO $$
DECLARE
  v_admin_id uuid;
  v_tek1_id uuid;
  v_tek2_id uuid;

  -- Master IDs
  v_dmg_listrik uuid;
  v_dmg_plumbing uuid;
  v_dmg_ac uuid;
  v_dmg_sipil uuid;
  v_dmg_lainnya uuid;

  v_fail_mat uuid;
  v_fail_vendor uuid;
  v_fail_kompleks uuid;
  v_fail_lainnya uuid;

  v_room_ids uuid[] := array[]::uuid[];
  v_mat_lampu uuid;
  v_mat_saklar uuid;
  v_mat_stopkontak uuid;
  v_mat_pipa uuid;
  v_mat_kran uuid;
  v_mat_sealtape uuid;
  v_mat_kapasitor uuid;
  v_mat_cat uuid;

  v_tkt uuid;
  v_rep_time timestamptz;
BEGIN
  -- 1. Ambil Admin dan Teknisi yang sudah ada
  SELECT id INTO v_admin_id FROM public.profiles WHERE role = 'admin' AND is_active ORDER BY created_at ASC LIMIT 1;
  SELECT id INTO v_tek1_id FROM public.profiles WHERE role = 'teknisi' AND is_active ORDER BY created_at ASC LIMIT 1;
  SELECT id INTO v_tek2_id FROM public.profiles WHERE role = 'teknisi' AND is_active ORDER BY created_at DESC LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Tidak ditemukan akun admin aktif di public.profiles. Buat akun admin terlebih dahulu!';
  END IF;

  IF v_tek1_id IS NULL THEN
    RAISE EXCEPTION 'Tidak ditemukan akun teknisi aktif di public.profiles. Buat akun teknisi terlebih dahulu!';
  END IF;
  IF v_tek2_id IS NULL THEN
    v_tek2_id := v_tek1_id;
  END IF;

  -- Jangan menambahkan master, stok, atau tiket berulang setelah seed awal.
  IF EXISTS (SELECT 1 FROM public.tickets WHERE description LIKE '%[DEV-SEED]%') THEN
    RAISE NOTICE 'Data DEV-SEED sudah pernah di-generate. Tidak ada perubahan yang dilakukan.';
    RETURN;
  END IF;

  -- 2. Ambil Master Jenis Kerusakan
  SELECT id INTO v_dmg_listrik FROM public.damage_types WHERE name = 'Listrik';
  SELECT id INTO v_dmg_plumbing FROM public.damage_types WHERE name = 'Plumbing';
  SELECT id INTO v_dmg_ac FROM public.damage_types WHERE name = 'AC';
  SELECT id INTO v_dmg_sipil FROM public.damage_types WHERE name = 'Sipil';
  SELECT id INTO v_dmg_lainnya FROM public.damage_types WHERE name = 'Lainnya';

  -- 3. Ambil Master Alasan Gagal Laksana
  SELECT id INTO v_fail_mat FROM public.failure_reasons WHERE name ILIKE '%material%';
  SELECT id INTO v_fail_vendor FROM public.failure_reasons WHERE name ILIKE '%pihak ketiga%' OR name ILIKE '%vendor%';
  SELECT id INTO v_fail_kompleks FROM public.failure_reasons WHERE name ILIKE '%kompleks%';
  SELECT id INTO v_fail_lainnya FROM public.failure_reasons WHERE name ILIKE '%lainnya%';
  IF v_dmg_listrik IS NULL OR v_dmg_plumbing IS NULL OR v_dmg_ac IS NULL
     OR v_dmg_sipil IS NULL OR v_dmg_lainnya IS NULL OR v_fail_mat IS NULL
     OR v_fail_vendor IS NULL OR v_fail_kompleks IS NULL OR v_fail_lainnya IS NULL THEN
    RAISE EXCEPTION 'Data master seed tidak lengkap. Jalankan migrasi 005 terlebih dahulu.';
  END IF;

  -- 4. Seed 15 Ruangan
  INSERT INTO public.rooms (name) VALUES
    ('Ruang Rawat Inap Melati'),
    ('Ruang Rawat Inap Mawar'),
    ('Ruang Rawat Inap Anggrek'),
    ('Ruang Rawat Inap Dahlia'),
    ('Ruang Rawat Inap Kenanga'),
    ('Ruang Rawat Inap Cempaka'),
    ('Instalasi Gawat Darurat (IGD)'),
    ('Intensive Care Unit (ICU)'),
    ('Poli Jiwa Dewasa'),
    ('Poli Jiwa Anak & Remaja'),
    ('Poli Penyakit Dalam'),
    ('Poli Gigi & Mulut'),
    ('Instalasi Farmasi'),
    ('Laboratorium Patologi Klinik'),
    ('Unit Radiologi & Rekam Medis')
  ON CONFLICT (lower(name)) DO UPDATE SET is_active = true;

  SELECT array_agg(id ORDER BY name) INTO v_room_ids
  FROM public.rooms
  WHERE name IN (
    'Ruang Rawat Inap Melati', 'Ruang Rawat Inap Mawar', 'Ruang Rawat Inap Anggrek',
    'Ruang Rawat Inap Dahlia', 'Ruang Rawat Inap Kenanga', 'Ruang Rawat Inap Cempaka',
    'Instalasi Gawat Darurat (IGD)', 'Intensive Care Unit (ICU)', 'Poli Jiwa Dewasa',
    'Poli Jiwa Anak & Remaja', 'Poli Penyakit Dalam', 'Poli Gigi & Mulut',
    'Instalasi Farmasi', 'Laboratorium Patologi Klinik', 'Unit Radiologi & Rekam Medis'
  );

  -- 5. Seed Material & Stok Awal
  INSERT INTO public.materials (code, name, category, unit, min_stock) VALUES
    ('MAT-EL-01', 'Lampu LED Philips 18W', 'Listrik', 'pcs', 10),
    ('MAT-EL-02', 'Saklar Ganda Broco', 'Listrik', 'pcs', 5),
    ('MAT-EL-03', 'Stop Kontak Panasonic', 'Listrik', 'pcs', 5),
    ('MAT-PL-01', 'Pipa PVC 1/2 inch Rucika', 'Plumbing', 'batang', 5),
    ('MAT-PL-02', 'Kran Air Besi Onda 1/2 inch', 'Plumbing', 'pcs', 8),
    ('MAT-PL-03', 'Seal Tape Onda', 'Plumbing', 'roll', 10),
    ('MAT-AC-01', 'Kapasitor AC 35uF', 'AC', 'pcs', 4),
    ('MAT-CV-01', 'Cat Tembok Putih Dulux 5kg', 'Sipil', 'pail', 2)
  ON CONFLICT (lower(code)) DO NOTHING;

  SELECT id INTO v_mat_lampu FROM public.materials WHERE code = 'MAT-EL-01';
  SELECT id INTO v_mat_saklar FROM public.materials WHERE code = 'MAT-EL-02';
  SELECT id INTO v_mat_stopkontak FROM public.materials WHERE code = 'MAT-EL-03';
  SELECT id INTO v_mat_pipa FROM public.materials WHERE code = 'MAT-PL-01';
  SELECT id INTO v_mat_kran FROM public.materials WHERE code = 'MAT-PL-02';
  SELECT id INTO v_mat_sealtape FROM public.materials WHERE code = 'MAT-PL-03';
  SELECT id INTO v_mat_kapasitor FROM public.materials WHERE code = 'MAT-AC-01';
  SELECT id INTO v_mat_cat FROM public.materials WHERE code = 'MAT-CV-01';

  -- Isi stok awal masuk bila current_stock masih 0
  IF (SELECT current_stock FROM public.materials WHERE id = v_mat_lampu) = 0 THEN
    INSERT INTO public.stock_movements (material_id, type, qty_change, note, created_by) VALUES
      (v_mat_lampu, 'masuk', 50, 'Stok awal dev', v_admin_id),
      (v_mat_saklar, 'masuk', 30, 'Stok awal dev', v_admin_id),
      (v_mat_stopkontak, 'masuk', 25, 'Stok awal dev', v_admin_id),
      (v_mat_pipa, 'masuk', 20, 'Stok awal dev', v_admin_id),
      (v_mat_kran, 'masuk', 35, 'Stok awal dev', v_admin_id),
      (v_mat_sealtape, 'masuk', 60, 'Stok awal dev', v_admin_id),
      (v_mat_kapasitor, 'masuk', 15, 'Stok awal dev', v_admin_id),
      (v_mat_cat, 'masuk', 8, 'Stok awal dev', v_admin_id);
  END IF;

  -- 6. Seed 30 Tiket Bervariasi
  -- --------------------------------------------------------------------------
  -- KELOMPOK A: Tiket Baru (4 tiket)
  -- --------------------------------------------------------------------------
  v_rep_time := now() - interval '2 hours';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[1], 'Sr. Linda', v_rep_time, '[DEV-SEED] Lampu kamar mandi pasien padam', v_dmg_listrik, 'sedang', v_admin_id);

  v_rep_time := now() - interval '4 hours';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[7], 'dr. Kevin (IGD)', v_rep_time, '[DEV-SEED] Stop kontak alat EKG longgar dan percik api', v_dmg_listrik, 'urgent', v_admin_id);

  v_rep_time := now() - interval '5 hours';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[9], 'Ns. Maya', v_rep_time, '[DEV-SEED] Handle pintu ruang konsultasi lepas', v_dmg_sipil, 'rendah', v_admin_id);

  v_rep_time := now() - interval '1 hour';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[13], 'Apt. Rian', v_rep_time, '[DEV-SEED] Wastafel tempat cuci racikan bocor merembes', v_dmg_plumbing, 'tinggi', v_admin_id);

  -- --------------------------------------------------------------------------
  -- KELOMPOK B: Tiket Ditugaskan (5 tiket)
  -- --------------------------------------------------------------------------
  v_rep_time := now() - interval '6 hours';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[2], 'Sr. Ratna', v_rep_time, '[DEV-SEED] AC kamar 204 berisik dan bergetar keras', v_dmg_ac, 'sedang', v_admin_id) RETURNING id INTO v_tkt;
  INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by) VALUES (v_tkt, v_tek1_id, v_admin_id);

  v_rep_time := now() - interval '8 hours';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[8], 'Perawat ICU', v_rep_time, '[DEV-SEED] Saklar suction port 2 macet', v_dmg_listrik, 'urgent', v_admin_id) RETURNING id INTO v_tkt;
  INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by) VALUES (v_tkt, v_tek1_id, v_admin_id);

  v_rep_time := now() - interval '10 hours';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[3], 'Bdn. Siti', v_rep_time, '[DEV-SEED] Kran air bak mandi patah', v_dmg_plumbing, 'tinggi', v_admin_id) RETURNING id INTO v_tkt;
  INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by) VALUES (v_tkt, v_tek2_id, v_admin_id);

  v_rep_time := now() - interval '14 hours';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[14], 'Analis Dian', v_rep_time, '[DEV-SEED] Lampu penerangan mikroskop redup', v_dmg_listrik, 'sedang', v_admin_id) RETURNING id INTO v_tkt;
  INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by) VALUES (v_tkt, v_tek2_id, v_admin_id);

  v_rep_time := now() - interval '18 hours';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[10], 'Ns. Dodi', v_rep_time, '[DEV-SEED] Plafon pojok ruang bermain anak mengelupas', v_dmg_sipil, 'rendah', v_admin_id) RETURNING id INTO v_tkt;
  INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by) VALUES (v_tkt, v_tek1_id, v_admin_id);

  -- --------------------------------------------------------------------------
  -- KELOMPOK C: Tiket Dikerjakan (4 tiket)
  -- --------------------------------------------------------------------------
  v_rep_time := now() - interval '5 hours';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[4], 'Sr. Wati', v_rep_time, '[DEV-SEED] Pipa pembuangan AC bocor menetes ke lantai', v_dmg_ac, 'tinggi', v_admin_id) RETURNING id INTO v_tkt;
  INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by) VALUES (v_tkt, v_tek1_id, v_admin_id);
  UPDATE public.tickets SET status = 'dikerjakan', started_at = now() - interval '2 hours' WHERE id = v_tkt;
  INSERT INTO public.ticket_notes (ticket_id, body, author_id) VALUES (v_tkt, 'Sedang pembersihan saluran drainase AC', v_tek1_id);

  v_rep_time := now() - interval '12 hours';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[11], 'dr. Bambang Sp.PD', v_rep_time, '[DEV-SEED] AC ruang dokter tidak dingin, hanya angin', v_dmg_ac, 'sedang', v_admin_id) RETURNING id INTO v_tkt;
  INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by) VALUES (v_tkt, v_tek2_id, v_admin_id);
  UPDATE public.tickets SET status = 'dikerjakan', started_at = now() - interval '1 hour' WHERE id = v_tkt;

  v_rep_time := now() - interval '22 hours';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[15], 'Staf Arsip', v_rep_time, '[DEV-SEED] Lampu TL lorong rekam medis berkedip terus', v_dmg_listrik, 'sedang', v_admin_id) RETURNING id INTO v_tkt;
  INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by) VALUES (v_tkt, v_tek1_id, v_admin_id);
  UPDATE public.tickets SET status = 'dikerjakan', started_at = now() - interval '3 hours' WHERE id = v_tkt;

  v_rep_time := now() - interval '26 hours'; -- Mendekati/lewat SLA (overdue carry-over)
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[5], 'Sr. Hana', v_rep_time, '[DEV-SEED] Saluran closet mampet', v_dmg_plumbing, 'urgent', v_admin_id) RETURNING id INTO v_tkt;
  INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by) VALUES (v_tkt, v_tek2_id, v_admin_id);
  UPDATE public.tickets SET status = 'dikerjakan', started_at = now() - interval '4 hours' WHERE id = v_tkt;

  -- --------------------------------------------------------------------------
  -- KELOMPOK D: Tiket Menunggu Material (Carry-over) (3 tiket)
  -- --------------------------------------------------------------------------
  v_rep_time := now() - interval '3 days';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[6], 'Sr. Dewi', v_rep_time, '[DEV-SEED] Motor blower AC sentral mati', v_dmg_ac, 'urgent', v_admin_id) RETURNING id INTO v_tkt;
  INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by) VALUES (v_tkt, v_tek1_id, v_admin_id);
  UPDATE public.tickets SET status = 'menunggu_material' WHERE id = v_tkt;
  INSERT INTO public.ticket_notes (ticket_id, body, author_id) VALUES (v_tkt, 'Stok motor blower kosong di logistik, menunggu pembelian', v_tek1_id);

  v_rep_time := now() - interval '2 days';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[12], 'drg. Shinta', v_rep_time, '[DEV-SEED] Selang water switch dental chair bocor', v_dmg_plumbing, 'tinggi', v_admin_id) RETURNING id INTO v_tkt;
  INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by) VALUES (v_tkt, v_tek2_id, v_admin_id);
  UPDATE public.tickets SET status = 'menunggu_material' WHERE id = v_tkt;
  INSERT INTO public.ticket_notes (ticket_id, body, author_id) VALUES (v_tkt, 'Perlu ukuran selang dental khusus 6mm, sedang dicari', v_tek2_id);

  v_rep_time := now() - interval '36 hours';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[1], 'Sr. Linda', v_rep_time, '[DEV-SEED] Engsel pintu kamar 101 jebol', v_dmg_sipil, 'sedang', v_admin_id) RETURNING id INTO v_tkt;
  INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by) VALUES (v_tkt, v_tek1_id, v_admin_id);
  UPDATE public.tickets SET status = 'menunggu_material' WHERE id = v_tkt;

  -- --------------------------------------------------------------------------
  -- KELOMPOK E: Tiket Selesai - LAKSANA (<= 24 jam) (7 tiket)
  -- --------------------------------------------------------------------------
  -- E1
  v_rep_time := now() - interval '25 days';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[1], 'Sr. Linda', v_rep_time, '[DEV-SEED] Lampu kamar 102 mati', v_dmg_listrik, 'sedang', v_admin_id) RETURNING id INTO v_tkt;
  INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by) VALUES (v_tkt, v_tek1_id, v_admin_id);
  UPDATE public.tickets SET status = 'dikerjakan' WHERE id = v_tkt;
  UPDATE public.tickets SET
    status = 'selesai', started_at = v_rep_time + interval '1 hour', finished_at = v_rep_time + interval '3 hours',
    work_done = 'Penggantian 1 unit lampu LED Philips 18W', reporter_verified = true, verifier_name = 'Sr. Linda'
  WHERE id = v_tkt;
  INSERT INTO public.stock_movements (material_id, type, qty_change, ticket_id, note, created_by)
  VALUES (v_mat_lampu, 'keluar', -1, v_tkt, 'Pemakaian pada tiket', v_tek1_id);

  -- E2
  v_rep_time := now() - interval '20 days';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[2], 'Sr. Ratna', v_rep_time, '[DEV-SEED] Kran wastafel kamar 201 patah', v_dmg_plumbing, 'tinggi', v_admin_id) RETURNING id INTO v_tkt;
  INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by) VALUES (v_tkt, v_tek2_id, v_admin_id);
  UPDATE public.tickets SET status = 'dikerjakan' WHERE id = v_tkt;
  UPDATE public.tickets SET
    status = 'selesai', started_at = v_rep_time + interval '2 hours', finished_at = v_rep_time + interval '5 hours',
    work_done = 'Pasang kran besi dan seal tape baru', reporter_verified = true, verifier_name = 'Sr. Ratna'
  WHERE id = v_tkt;
  INSERT INTO public.stock_movements (material_id, type, qty_change, ticket_id, note, created_by)
  VALUES (v_mat_kran, 'keluar', -1, v_tkt, 'Pemakaian pada tiket', v_tek2_id),
         (v_mat_sealtape, 'keluar', -1, v_tkt, 'Pemakaian pada tiket', v_tek2_id);

  -- E3
  v_rep_time := now() - interval '18 days';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[7], 'dr. Kevin', v_rep_time, '[DEV-SEED] Saklar lampu tindakan IGD macet', v_dmg_listrik, 'urgent', v_admin_id) RETURNING id INTO v_tkt;
  INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by) VALUES (v_tkt, v_tek1_id, v_admin_id);
  UPDATE public.tickets SET status = 'dikerjakan' WHERE id = v_tkt;
  UPDATE public.tickets SET
    status = 'selesai', started_at = v_rep_time + interval '30 minutes', finished_at = v_rep_time + interval '2 hours',
    work_done = 'Ganti saklar ganda baru', reporter_verified = true, verifier_name = 'dr. Kevin'
  WHERE id = v_tkt;
  INSERT INTO public.stock_movements (material_id, type, qty_change, ticket_id, note, created_by)
  VALUES (v_mat_saklar, 'keluar', -1, v_tkt, 'Pemakaian pada tiket', v_tek1_id);

  -- E4
  v_rep_time := now() - interval '14 days';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[8], 'Perawat ICU', v_rep_time, '[DEV-SEED] Stop kontak ventilator kamar isolasi longgar', v_dmg_listrik, 'urgent', v_admin_id) RETURNING id INTO v_tkt;
  INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by) VALUES (v_tkt, v_tek1_id, v_admin_id);
  UPDATE public.tickets SET status = 'dikerjakan' WHERE id = v_tkt;
  UPDATE public.tickets SET
    status = 'selesai', started_at = v_rep_time + interval '1 hour', finished_at = v_rep_time + interval '2 hours 30 minutes',
    work_done = 'Kencangkan baut fiksasi dan ganti stop kontak', reporter_verified = true, verifier_name = 'Sr. Maria'
  WHERE id = v_tkt;
  INSERT INTO public.stock_movements (material_id, type, qty_change, ticket_id, note, created_by)
  VALUES (v_mat_stopkontak, 'keluar', -1, v_tkt, 'Pemakaian pada tiket', v_tek1_id);

  -- E5
  v_rep_time := now() - interval '10 days';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[9], 'Ns. Maya', v_rep_time, '[DEV-SEED] AC poli jiwa tidak dingin', v_dmg_ac, 'sedang', v_admin_id) RETURNING id INTO v_tkt;
  INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by) VALUES (v_tkt, v_tek2_id, v_admin_id);
  UPDATE public.tickets SET status = 'dikerjakan' WHERE id = v_tkt;
  UPDATE public.tickets SET
    status = 'selesai', started_at = v_rep_time + interval '2 hours', finished_at = v_rep_time + interval '6 hours',
    work_done = 'Ganti kapasitor AC outdoor 35uF dan cuci filter', reporter_verified = true, verifier_name = 'Ns. Maya'
  WHERE id = v_tkt;
  INSERT INTO public.stock_movements (material_id, type, qty_change, ticket_id, note, created_by)
  VALUES (v_mat_kapasitor, 'keluar', -1, v_tkt, 'Pemakaian pada tiket', v_tek2_id);

  -- E6
  v_rep_time := now() - interval '7 days';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[13], 'Apt. Rian', v_rep_time, '[DEV-SEED] Lampu gudang obat mati 2 titik', v_dmg_listrik, 'sedang', v_admin_id) RETURNING id INTO v_tkt;
  INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by) VALUES (v_tkt, v_tek1_id, v_admin_id);
  UPDATE public.tickets SET status = 'dikerjakan' WHERE id = v_tkt;
  UPDATE public.tickets SET
    status = 'selesai', started_at = v_rep_time + interval '1 hour', finished_at = v_rep_time + interval '4 hours',
    work_done = 'Penggantian 2 lampu LED', reporter_verified = true, verifier_name = 'Apt. Rian'
  WHERE id = v_tkt;
  INSERT INTO public.stock_movements (material_id, type, qty_change, ticket_id, note, created_by)
  VALUES (v_mat_lampu, 'keluar', -2, v_tkt, 'Pemakaian pada tiket', v_tek1_id);

  -- E7
  v_rep_time := now() - interval '4 days';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[14], 'Analis Dian', v_rep_time, '[DEV-SEED] Kran pembuangan reagen patah', v_dmg_plumbing, 'tinggi', v_admin_id) RETURNING id INTO v_tkt;
  INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by) VALUES (v_tkt, v_tek2_id, v_admin_id);
  UPDATE public.tickets SET status = 'dikerjakan' WHERE id = v_tkt;
  UPDATE public.tickets SET
    status = 'selesai', started_at = v_rep_time + interval '3 hours', finished_at = v_rep_time + interval '8 hours',
    work_done = 'Pasang kran baru dan sambung shock pipa', reporter_verified = true, verifier_name = 'Analis Dian'
  WHERE id = v_tkt;
  INSERT INTO public.stock_movements (material_id, type, qty_change, ticket_id, note, created_by)
  VALUES (v_mat_kran, 'keluar', -1, v_tkt, 'Pemakaian pada tiket', v_tek2_id);

  -- --------------------------------------------------------------------------
  -- KELOMPOK F: Tiket Selesai - GAGAL LAKSANA (> 24 jam) (4 tiket)
  -- --------------------------------------------------------------------------
  -- F1: Alasan Material
  v_rep_time := now() - interval '22 days';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[3], 'Bdn. Siti', v_rep_time, '[DEV-SEED] Kebocoran pipa utama lantai 2', v_dmg_plumbing, 'urgent', v_admin_id) RETURNING id INTO v_tkt;
  INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by) VALUES (v_tkt, v_tek2_id, v_admin_id);
  UPDATE public.tickets SET status = 'menunggu_material' WHERE id = v_tkt;
  UPDATE public.tickets SET
    status = 'selesai', started_at = v_rep_time + interval '1 day', finished_at = v_rep_time + interval '2 days 4 hours',
    work_done = 'Penyambungan pipa pipa PVC 1/2 inch setelah material dibeli',
    reporter_verified = true, verifier_name = 'Bdn. Siti',
    failure_reason_id = v_fail_mat, failure_reason_note = 'Stok pipa PVC dan lem di gudang habis'
  WHERE id = v_tkt;
  INSERT INTO public.stock_movements (material_id, type, qty_change, ticket_id, note, created_by)
  VALUES (v_mat_pipa, 'keluar', -2, v_tkt, 'Pemakaian pada tiket', v_tek2_id);

  -- F2: Alasan Vendor
  v_rep_time := now() - interval '16 days';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[15], 'Staf Radiologi', v_rep_time, '[DEV-SEED] Chiller pendingin mesin rontgen mati', v_dmg_ac, 'urgent', v_admin_id) RETURNING id INTO v_tkt;
  INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by) VALUES (v_tkt, v_tek1_id, v_admin_id);
  UPDATE public.tickets SET status = 'dikerjakan' WHERE id = v_tkt;
  UPDATE public.tickets SET
    status = 'selesai', started_at = v_rep_time + interval '4 hours', finished_at = v_rep_time + interval '3 days',
    work_done = 'Penanganan dilakukan oleh teknisi resmi vendor GE Healthcare',
    reporter_verified = true, verifier_name = 'dr. Sp.Rad',
    failure_reason_id = v_fail_vendor, failure_reason_note = 'Garansi alat medis khusus', vendor_name = 'PT Medika Vendor'
  WHERE id = v_tkt;

  -- F3: Alasan Kerusakan Kompleks
  v_rep_time := now() - interval '12 days';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[5], 'Sr. Hana', v_rep_time, '[DEV-SEED] Dinding kamar mandi retak dan rembes parah ke koridor', v_dmg_sipil, 'sedang', v_admin_id) RETURNING id INTO v_tkt;
  INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by) VALUES (v_tkt, v_tek2_id, v_admin_id);
  UPDATE public.tickets SET status = 'dikerjakan' WHERE id = v_tkt;
  UPDATE public.tickets SET
    status = 'selesai', started_at = v_rep_time + interval '1 day', finished_at = v_rep_time + interval '4 days',
    work_done = 'Bongkar keramik, waterproofing ulang, dan plester acian dinding',
    reporter_verified = true, verifier_name = 'Sr. Hana',
    failure_reason_id = v_fail_kompleks, failure_reason_note = 'Perlu pembongkaran struktur semen dan pengeringan'
  WHERE id = v_tkt;
  INSERT INTO public.stock_movements (material_id, type, qty_change, ticket_id, note, created_by)
  VALUES (v_mat_cat, 'keluar', -1, v_tkt, 'Pemakaian cat pada tiket', v_tek2_id);

  -- F4: Alasan Lainnya
  v_rep_time := now() - interval '6 days';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by)
  VALUES (v_room_ids[4], 'Sr. Wati', v_rep_time, '[DEV-SEED] Perbaikan instalasi listrik bed pasien 402', v_dmg_listrik, 'sedang', v_admin_id) RETURNING id INTO v_tkt;
  INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by) VALUES (v_tkt, v_tek1_id, v_admin_id);
  UPDATE public.tickets SET status = 'dikerjakan' WHERE id = v_tkt;
  UPDATE public.tickets SET
    status = 'selesai', started_at = v_rep_time + interval '2 hours', finished_at = v_rep_time + interval '1 day 10 hours',
    work_done = 'Perapihan jalur kabel pipa konduit',
    reporter_verified = true, verifier_name = 'Sr. Wati',
    failure_reason_id = v_fail_lainnya, failure_reason_note = 'Menunggu pasien dipindahkan ke ruang transit terlebih dahulu'
  WHERE id = v_tkt;

  -- --------------------------------------------------------------------------
  -- KELOMPOK G: Tiket Dibatalkan (3 tiket)
  -- --------------------------------------------------------------------------
  v_rep_time := now() - interval '21 days';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, created_by)
  VALUES (v_room_ids[1], 'Sr. Linda', v_rep_time, '[DEV-SEED] AC mati di ruang perawat', v_dmg_ac, v_admin_id)
  RETURNING id INTO v_tkt;
  UPDATE public.tickets SET status = 'dibatalkan', cancel_reason = 'Laporan ganda / duplikat' WHERE id = v_tkt;

  v_rep_time := now() - interval '15 days';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, created_by)
  VALUES (v_room_ids[7], 'Perawat IGD', v_rep_time, '[DEV-SEED] Kabel monitor pasien terkelupas', v_dmg_listrik, v_admin_id)
  RETURNING id INTO v_tkt;
  UPDATE public.tickets SET status = 'dibatalkan', cancel_reason = 'Bukan sarpras rumah sakit, milik vendor alkes' WHERE id = v_tkt;

  v_rep_time := now() - interval '8 days';
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, created_by)
  VALUES (v_room_ids[9], 'Ns. Maya', v_rep_time, '[DEV-SEED] Pintu terkunci dari dalam', v_dmg_sipil, v_admin_id)
  RETURNING id INTO v_tkt;
  UPDATE public.tickets SET status = 'dibatalkan', cancel_reason = 'Kunci cadangan sudah ditemukan oleh ruangan' WHERE id = v_tkt;

  RAISE NOTICE 'SUCCESS: Seed data pengembangan (15 ruangan, 8 material, 30 tiket) berhasil disisipkan!';
END $$;
