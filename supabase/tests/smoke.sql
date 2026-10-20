-- ============================================================================
-- SMOKE TEST — Dashboard IPSRS RS. Soeharto Heerdjan
-- Sumber: IPSRS_DASHBOARD_SPEC.md §8.2
--
-- CARA MENJALANKAN:
-- 1. Pastikan migrasi 001-007 sudah dijalankan.
-- 2. Pastikan minimal sudah ada 1 akun admin aktif dan 1 akun teknisi aktif
--    di tabel public.profiles.
-- 3. Buka Supabase Dashboard -> SQL Editor -> Tempel file ini -> Run.
-- 4. Seluruh uji dibungkus BEGIN ... ROLLBACK sehingga TIDAK ADA data yang tersimpan.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_admin_id uuid;
  v_teknisi_id uuid;
  v_teknisi2_id uuid;
  v_room_id uuid;
  v_damage_id uuid;
  v_reason_id uuid;
  v_ticket_id uuid;
  v_ticket_id2 uuid;
  v_ticket_rec record;
  v_mat_id uuid;
  v_stock numeric;
  v_count integer;
  v_err_caught boolean;
BEGIN
  RAISE NOTICE '=== MEMULAI SMOKE TEST SKEMA DATABASE IPSRS ===';

  -- --------------------------------------------------------------------------
  -- 0. PREKONDISI
  -- --------------------------------------------------------------------------
  SELECT id INTO v_admin_id FROM public.profiles WHERE role = 'admin' AND is_active LIMIT 1;
  SELECT id INTO v_teknisi_id FROM public.profiles WHERE role = 'teknisi' AND is_active LIMIT 1;
  SELECT id INTO v_room_id FROM public.rooms WHERE is_active LIMIT 1;
  SELECT id INTO v_damage_id FROM public.damage_types WHERE is_active LIMIT 1;
  SELECT id INTO v_reason_id FROM public.failure_reasons WHERE is_active LIMIT 1;

  IF v_admin_id IS NULL OR v_teknisi_id IS NULL THEN
    RAISE NOTICE 'GAGAL PREKONDISI: Butuh minimal 1 admin aktif dan 1 teknisi aktif di public.profiles. Buat akun terlebih dahulu sesuai panduan.';
    RAISE EXCEPTION 'Smoke test dihentikan karena prasyarat akun belum terpenuhi.';
  END IF;

  IF v_room_id IS NULL THEN
    INSERT INTO public.rooms (name) VALUES ('Ruang Uji Smoke') RETURNING id INTO v_room_id;
  END IF;
  IF v_damage_id IS NULL THEN
    INSERT INTO public.damage_types (name) VALUES ('Kerusakan Uji') RETURNING id INTO v_damage_id;
  END IF;
  IF v_reason_id IS NULL THEN
    INSERT INTO public.failure_reasons (name) VALUES ('Alasan Uji') RETURNING id INTO v_reason_id;
  END IF;

  RAISE NOTICE 'LULUS: Prekondisi akun admin (%s) dan teknisi (%s) terpenuhi.', v_admin_id, v_teknisi_id;

  -- --------------------------------------------------------------------------
  -- 1. UJI: Waktu lapor di masa depan ditolak (BR-16)
  -- --------------------------------------------------------------------------
  v_err_caught := false;
  BEGIN
    INSERT INTO public.tickets (
      room_id, reporter_name, reported_at, description, damage_type_id, created_by
    ) VALUES (
      v_room_id, 'Pelapor Uji', now() + interval '2 hours', 'Lampu rusak di masa depan', v_damage_id, v_admin_id
    );
  EXCEPTION WHEN others THEN
    v_err_caught := true;
  END;

  IF v_err_caught THEN
    RAISE NOTICE 'LULUS [1/14]: Waktu lapor di masa depan berhasil ditolak.';
  ELSE
    RAISE NOTICE 'GAGAL [1/14]: Waktu lapor di masa depan tidak memicu error.';
  END IF;

  -- --------------------------------------------------------------------------
  -- 2. UJI: Pembuatan tiket normal, penomoran otomatis, status awal 'baru'
  -- --------------------------------------------------------------------------
  INSERT INTO public.tickets (
    room_id, reporter_name, reported_at, description, damage_type_id, priority, created_by
  ) VALUES (
    v_room_id, 'Perawat Jaga', now() - interval '2 hours', 'AC mati total di ruang perawatan', v_damage_id, 'tinggi', v_admin_id
  ) RETURNING id INTO v_ticket_id;

  SELECT * INTO v_ticket_rec FROM public.tickets WHERE id = v_ticket_id;

  IF v_ticket_rec.ticket_no LIKE 'IPSRS-%' AND v_ticket_rec.status = 'baru' THEN
    RAISE NOTICE 'LULUS [2/14]: Penomoran tiket otomatis (%s) dan status awal adalah "baru".', v_ticket_rec.ticket_no;
  ELSE
    RAISE NOTICE 'GAGAL [2/14]: Nomor tiket atau status awal tidak sesuai: %s / %s', v_ticket_rec.ticket_no, v_ticket_rec.status;
  END IF;

  -- --------------------------------------------------------------------------
  -- 3. UJI: Transisi status tidak valid ditolak (baru -> selesai langsung)
  -- --------------------------------------------------------------------------
  v_err_caught := false;
  BEGIN
    UPDATE public.tickets SET status = 'selesai' WHERE id = v_ticket_id;
  EXCEPTION WHEN others THEN
    v_err_caught := true;
  END;

  IF v_err_caught THEN
    RAISE NOTICE 'LULUS [3/14]: Transisi status tidak valid (baru -> selesai) berhasil ditolak.';
  ELSE
    RAISE NOTICE 'GAGAL [3/14]: Transisi status tidak valid dibiarkan lolos.';
  END IF;

  -- --------------------------------------------------------------------------
  -- 4. UJI: Penugasan pertama otomatis mengubah status tiket menjadi 'ditugaskan'
  -- --------------------------------------------------------------------------
  INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by)
  VALUES (v_ticket_id, v_teknisi_id, v_admin_id);

  SELECT status INTO v_ticket_rec.status FROM public.tickets WHERE id = v_ticket_id;

  IF v_ticket_rec.status = 'ditugaskan' THEN
    RAISE NOTICE 'LULUS [4/14]: Penugasan teknisi otomatis mengubah status tiket menjadi "ditugaskan".';
  ELSE
    RAISE NOTICE 'GAGAL [4/14]: Status tiket setelah penugasan adalah %s (seharusnya ditugaskan).', v_ticket_rec.status;
  END IF;

  -- --------------------------------------------------------------------------
  -- 5. UJI: Penugasan pada tiket dibatalkan ditolak (BR-15)
  -- --------------------------------------------------------------------------
  INSERT INTO public.tickets (
    room_id, reporter_name, reported_at, description, damage_type_id, status, cancel_reason, created_by
  ) VALUES (
    v_room_id, 'Pelapor Batal', now() - interval '1 hour', 'Laporan salah input', v_damage_id, 'dibatalkan', 'Salah ruangan', v_admin_id
  ) RETURNING id INTO v_ticket_id2;

  v_err_caught := false;
  BEGIN
    INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by)
    VALUES (v_ticket_id2, v_teknisi_id, v_admin_id);
  EXCEPTION WHEN others THEN
    v_err_caught := true;
  END;

  IF v_err_caught THEN
    RAISE NOTICE 'LULUS [5/14]: Penugasan pada tiket dibatalkan berhasil ditolak.';
  ELSE
    RAISE NOTICE 'GAGAL [5/14]: Penugasan pada tiket dibatalkan berhasil disisipkan.';
  END IF;

  -- --------------------------------------------------------------------------
  -- 6. UJI: Klasifikasi otomatis Laksana (durasi <= 24 jam)
  -- --------------------------------------------------------------------------
  UPDATE public.tickets SET status = 'dikerjakan' WHERE id = v_ticket_id;
  UPDATE public.tickets SET
    status = 'selesai',
    started_at = reported_at + interval '30 minutes',
    finished_at = reported_at + interval '2 hours',
    work_done = 'Penggantian kapasitor fan AC',
    reporter_verified = true,
    verifier_name = 'Sdr. Budi'
  WHERE id = v_ticket_id;

  SELECT classification, duration_minutes INTO v_ticket_rec.classification, v_ticket_rec.duration_minutes
  FROM public.tickets WHERE id = v_ticket_id;

  IF v_ticket_rec.classification = 'laksana' AND v_ticket_rec.duration_minutes = 120 THEN
    RAISE NOTICE 'LULUS [6/14]: Tiket selesai dalam 2 jam berhasil diklasifikasi "laksana" (durasi %s menit).', v_ticket_rec.duration_minutes;
  ELSE
    RAISE NOTICE 'GAGAL [6/14]: Klasifikasi tidak sesuai: %s (durasi %s menit).', v_ticket_rec.classification, v_ticket_rec.duration_minutes;
  END IF;

  -- --------------------------------------------------------------------------
  -- 7. UJI: Klasifikasi otomatis Gagal Laksana (> 24 jam) wajib isi alasan
  -- --------------------------------------------------------------------------
  INSERT INTO public.tickets (
    room_id, reporter_name, reported_at, description, damage_type_id, status, created_by
  ) VALUES (
    v_room_id, 'Pelapor GL', now() - interval '30 hours', 'Kompresor AC jebol', v_damage_id, 'baru', v_admin_id
  ) RETURNING id INTO v_ticket_id2;

  INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by)
  VALUES (v_ticket_id2, v_teknisi_id, v_admin_id);
  UPDATE public.tickets SET status = 'dikerjakan' WHERE id = v_ticket_id2;

  -- Coba selesaikan tanpa alasan gagal laksana -> harus ditolak
  v_err_caught := false;
  BEGIN
    UPDATE public.tickets SET
      status = 'selesai',
      started_at = reported_at + interval '1 hour',
      finished_at = reported_at + interval '28 hours',
      work_done = 'Menunggu kompresor baru',
      reporter_verified = true,
      verifier_name = 'Sdr. Budi',
      failure_reason_id = null
    WHERE id = v_ticket_id2;
  EXCEPTION WHEN others THEN
    v_err_caught := true;
  END;

  IF v_err_caught THEN
    RAISE NOTICE 'LULUS [7a/14]: Selesai > 24 jam tanpa alasan Gagal Laksana berhasil ditolak.';
  ELSE
    RAISE NOTICE 'GAGAL [7a/14]: Selesai > 24 jam tanpa alasan Gagal Laksana dibiarkan lolos.';
  END IF;

  -- Selesaikan dengan alasan gagal laksana -> harus sukses
  UPDATE public.tickets SET
    status = 'selesai',
    started_at = reported_at + interval '1 hour',
    finished_at = reported_at + interval '28 hours',
    work_done = 'Perlu penggantian suku cadang vendor',
    reporter_verified = true,
    verifier_name = 'Sdr. Budi',
    failure_reason_id = v_reason_id,
    failure_reason_note = 'Menunggu kiriman part'
  WHERE id = v_ticket_id2;

  SELECT classification INTO v_ticket_rec.classification FROM public.tickets WHERE id = v_ticket_id2;
  IF v_ticket_rec.classification = 'gagal_laksana' THEN
    RAISE NOTICE 'LULUS [7b/14]: Selesai > 24 jam dengan alasan berhasil diklasifikasikan "gagal_laksana".';
  ELSE
    RAISE NOTICE 'GAGAL [7b/14]: Klasifikasi tiket > 24 jam bukan gagal_laksana: %s', v_ticket_rec.classification;
  END IF;

  -- --------------------------------------------------------------------------
  -- 8. UJI: rpc_reopen_ticket tanpa alasan ditolak; dengan alasan berhasil
  -- --------------------------------------------------------------------------
  v_err_caught := false;
  BEGIN
    PERFORM public.rpc_reopen_ticket(v_ticket_id, '');
  EXCEPTION WHEN others THEN
    v_err_caught := true;
  END;

  IF v_err_caught THEN
    RAISE NOTICE 'LULUS [8a/14]: rpc_reopen_ticket tanpa alasan berhasil ditolak.';
  ELSE
    RAISE NOTICE 'GAGAL [8a/14]: rpc_reopen_ticket tanpa alasan tidak memicu error.';
  END IF;

  PERFORM public.rpc_reopen_ticket(v_ticket_id, 'Kapasitor kembali meletup');
  SELECT status INTO v_ticket_rec.status FROM public.tickets WHERE id = v_ticket_id;
  SELECT count(*) INTO v_count FROM public.ticket_notes WHERE ticket_id = v_ticket_id AND body LIKE '%Tiket dibuka kembali%';

  IF v_ticket_rec.status = 'dikerjakan' AND v_count > 0 THEN
    RAISE NOTICE 'LULUS [8b/14]: rpc_reopen_ticket berhasil mengembalikan status ke "dikerjakan" dan membuat catatan riwayat.';
  ELSE
    RAISE NOTICE 'GAGAL [8b/14]: rpc_reopen_ticket gagal mengembalikan status atau tidak ada catatan.';
  END IF;

  -- --------------------------------------------------------------------------
  -- 9. UJI: Persediaan material, current_stock dilindungi, mutasi stok divalidasi
  -- --------------------------------------------------------------------------
  INSERT INTO public.materials (code, name, category, unit, min_stock)
  VALUES ('SMK-MAT-01', 'Kapasitor AC 35uF', 'AC', 'pcs', 2)
  RETURNING id, current_stock INTO v_mat_id, v_stock;

  IF v_stock = 0 THEN
    RAISE NOTICE 'LULUS [9a/14]: current_stock awal otomatis bernilai 0.';
  ELSE
    RAISE NOTICE 'GAGAL [9a/14]: current_stock awal bernilai %s', v_stock;
  END IF;

  -- Coba update langsung current_stock lewat query klien -> harus dilindungi trigger
  UPDATE public.materials SET current_stock = 100 WHERE id = v_mat_id;
  SELECT current_stock INTO v_stock FROM public.materials WHERE id = v_mat_id;

  IF v_stock = 0 THEN
    RAISE NOTICE 'LULUS [9b/14]: current_stock terlindungi dari modifikasi langsung.';
  ELSE
    RAISE NOTICE 'GAGAL [9b/14]: current_stock berhasil dimodifikasi langsung menjadi %s', v_stock;
  END IF;

  -- Tambah stok masuk 5
  INSERT INTO public.stock_movements (material_id, type, qty_change, note, created_by)
  VALUES (v_mat_id, 'masuk', 5, 'Stok awal gudang', v_admin_id);

  SELECT current_stock INTO v_stock FROM public.materials WHERE id = v_mat_id;
  IF v_stock = 5 THEN
    RAISE NOTICE 'LULUS [9c/14]: Mutasi masuk menambah current_stock menjadi 5.';
  ELSE
    RAISE NOTICE 'GAGAL [9c/14]: current_stock setelah mutasi masuk bernilai %s', v_stock;
  END IF;

  -- Coba mutasi keluar 10 (melebihi stok 5) -> harus ditolak
  v_err_caught := false;
  BEGIN
    INSERT INTO public.stock_movements (material_id, type, qty_change, note, created_by)
    VALUES (v_mat_id, 'keluar', -10, 'Pengeluaran melebihi stok', v_admin_id);
  EXCEPTION WHEN others THEN
    v_err_caught := true;
  END;

  IF v_err_caught THEN
    RAISE NOTICE 'LULUS [9d/14]: Pengeluaran stok melebihi ketersediaan berhasil ditolak.';
  ELSE
    RAISE NOTICE 'GAGAL [9d/14]: Pengeluaran melebihi stok dibiarkan terjadi.';
  END IF;

  -- Coba mutasi koreksi tanpa alasan -> harus ditolak
  v_err_caught := false;
  BEGIN
    INSERT INTO public.stock_movements (material_id, type, qty_change, note, created_by)
    VALUES (v_mat_id, 'koreksi', -1, null, v_admin_id);
  EXCEPTION WHEN others THEN
    v_err_caught := true;
  END;

  IF v_err_caught THEN
    RAISE NOTICE 'LULUS [9e/14]: Mutasi koreksi tanpa catatan alasan berhasil ditolak.';
  ELSE
    RAISE NOTICE 'GAGAL [9e/14]: Mutasi koreksi tanpa catatan lolos.';
  END IF;

  -- --------------------------------------------------------------------------
  -- 10. UJI: Tabel append-only (stock_movements, notes, history, logs) tidak bisa diubah/dihapus
  -- --------------------------------------------------------------------------
  v_err_caught := false;
  BEGIN
    UPDATE public.stock_movements SET note = 'Ubah catatan mutasi' WHERE material_id = v_mat_id;
  EXCEPTION WHEN others THEN
    v_err_caught := true;
  END;

  IF v_err_caught THEN
    RAISE NOTICE 'LULUS [10a/14]: UPDATE pada stock_movements berhasil dicegah (append-only).';
  ELSE
    RAISE NOTICE 'GAGAL [10a/14]: stock_movements berhasil di-UPDATE.';
  END IF;

  v_err_caught := false;
  BEGIN
    DELETE FROM public.ticket_notes WHERE ticket_id = v_ticket_id;
  EXCEPTION WHEN others THEN
    v_err_caught := true;
  END;

  IF v_err_caught THEN
    RAISE NOTICE 'LULUS [10b/14]: DELETE pada ticket_notes berhasil dicegah (append-only).';
  ELSE
    RAISE NOTICE 'GAGAL [10b/14]: ticket_notes berhasil di-DELETE.';
  END IF;

  v_err_caught := false;
  BEGIN
    UPDATE public.ticket_status_history SET to_status = 'baru' WHERE ticket_id = v_ticket_id;
  EXCEPTION WHEN others THEN
    v_err_caught := true;
  END;
  IF v_err_caught THEN
    RAISE NOTICE 'LULUS [10c/14]: UPDATE pada ticket_status_history berhasil dicegah (append-only).';
  ELSE
    RAISE NOTICE 'GAGAL [10c/14]: ticket_status_history berhasil di-UPDATE.';
  END IF;

  v_err_caught := false;
  BEGIN
    UPDATE public.activity_logs SET action = 'ubah' WHERE entity = 'tickets' AND entity_id = v_ticket_id::text;
  EXCEPTION WHEN others THEN
    v_err_caught := true;
  END;
  IF v_err_caught THEN
    RAISE NOTICE 'LULUS [10d/14]: UPDATE pada activity_logs berhasil dicegah (append-only).';
  ELSE
    RAISE NOTICE 'GAGAL [10d/14]: activity_logs berhasil di-UPDATE.';
  END IF;

  -- --------------------------------------------------------------------------
  -- 11. UJI: rpc_finish_ticket atomik (gagal jika stok tidak cukup, status tetap)
  -- --------------------------------------------------------------------------
  v_err_caught := false;
  BEGIN
    PERFORM public.rpc_finish_ticket(
      p_ticket_id := v_ticket_id,
      p_started_at := now() - interval '2 hours',
      p_finished_at := now() - interval '1 hour',
      p_work_done := 'Selesai pasang',
      p_reporter_verified := true,
      p_verifier_name := 'Sdr. Budi',
      p_materials := jsonb_build_array(
        jsonb_build_object('material_id', v_mat_id, 'qty', 999) -- stok hanya 5!
      )
    );
  EXCEPTION WHEN others THEN
    v_err_caught := true;
  END;

  SELECT status INTO v_ticket_rec.status FROM public.tickets WHERE id = v_ticket_id;

  IF v_err_caught AND v_ticket_rec.status = 'dikerjakan' THEN
    RAISE NOTICE 'LULUS [11/14]: rpc_finish_ticket atomik (transaksi rollback penuh saat material melebihi stok, status tetap "dikerjakan").';
  ELSE
    RAISE NOTICE 'GAGAL [11/14]: rpc_finish_ticket tidak atomik. Status tiket: %s', v_ticket_rec.status;
  END IF;

  -- --------------------------------------------------------------------------
  -- 12. UJI: Penjaga admin aktif terakhir (BR-17)
  -- --------------------------------------------------------------------------
  UPDATE public.profiles SET is_active = false
  WHERE role = 'admin' AND is_active AND id <> v_admin_id;
  SELECT count(*) INTO v_count FROM public.profiles WHERE role = 'admin' AND is_active;
  IF v_count = 1 THEN
    v_err_caught := false;
    BEGIN
      UPDATE public.profiles SET is_active = false WHERE id = v_admin_id;
    EXCEPTION WHEN others THEN
      v_err_caught := true;
    END;

    IF v_err_caught THEN
      RAISE NOTICE 'LULUS [12/14]: Menonaktifkan admin aktif terakhir berhasil dicegah.';
    ELSE
      RAISE NOTICE 'GAGAL [12/14]: Admin aktif terakhir berhasil dinonaktifkan.';
    END IF;
  ELSE
    RAISE NOTICE 'INFO [12/14]: Ada lebih dari satu admin aktif (%s), melewati uji penjaga admin tunggal.', v_count;
  END IF;

  RAISE NOTICE '=== SEMUA UJI LEVEL DATABASE (DDL & TRIGGER) SELESAI ===';
END $$;

-- ----------------------------------------------------------------------------
-- 13. UJI: Isolasi RLS Teknisi (meniru sesi JWT teknisi)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_admin_id uuid;
  v_teknisi_id uuid;
  v_other_teknisi_id uuid;
  v_ticket_mine uuid;
  v_ticket_other uuid;
  v_room_id uuid;
  v_damage_id uuid;
  v_visible_count integer;
  v_updated_rows integer;
  v_err_caught boolean;
BEGIN
  SELECT id INTO v_admin_id FROM public.profiles WHERE role = 'admin' AND is_active LIMIT 1;
  SELECT id INTO v_teknisi_id FROM public.profiles WHERE role = 'teknisi' AND is_active LIMIT 1;
  IF v_teknisi_id IS NULL OR v_admin_id IS NULL THEN
    RAISE NOTICE 'GAGAL PREKONDISI: Uji RLS dilewati karena akun admin/teknisi aktif belum tersedia.';
    RAISE EXCEPTION 'Smoke test dihentikan karena prasyarat akun belum terpenuhi.';
  END IF;
  SELECT id INTO v_room_id FROM public.rooms WHERE is_active LIMIT 1;
  SELECT id INTO v_damage_id FROM public.damage_types WHERE is_active LIMIT 1;

  -- Buat 1 tiket milik teknisi ini dan 1 tiket tanpa teknisi ini
  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, status, created_by)
  VALUES (v_room_id, 'Pelapor A', now() - interval '1 hour', 'Tiket teknisi uji', v_damage_id, 'baru', v_admin_id)
  RETURNING id INTO v_ticket_mine;

  INSERT INTO public.ticket_assignments (ticket_id, user_id, assigned_by)
  VALUES (v_ticket_mine, v_teknisi_id, v_admin_id);

  INSERT INTO public.tickets (room_id, reporter_name, reported_at, description, damage_type_id, status, created_by)
  VALUES (v_room_id, 'Pelapor B', now() - interval '1 hour', 'Tiket rahasia orang lain', v_damage_id, 'baru', v_admin_id)
  RETURNING id INTO v_ticket_other;

  -- Simulasikan koneksi sebagai teknisi
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_teknisi_id, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- Uji SELECT: tiket milik sendiri terlihat, tiket tanpa penugasan tersembunyi
  SELECT count(*) INTO v_visible_count FROM public.tickets WHERE id = v_ticket_mine;
  IF v_visible_count = 1 THEN
    RAISE NOTICE 'LULUS [13a/15]: Teknisi dapat melihat tiket yang ditugaskan kepadanya.';
  ELSE
    RAISE NOTICE 'GAGAL [13a/15]: Teknisi tidak dapat melihat tiket miliknya.';
  END IF;

  SELECT count(*) INTO v_visible_count FROM public.tickets WHERE id = v_ticket_other;
  IF v_visible_count = 0 THEN
    RAISE NOTICE 'LULUS [13b/15]: RLS teknisi menyembunyikan tiket yang tidak ditugaskan kepadanya.';
  ELSE
    RAISE NOTICE 'GAGAL [13b/15]: Teknisi dapat melihat tiket yang tidak ditugaskan kepadanya.';
  END IF;

  -- Uji UPDATE status tiket oleh teknisi langsung (harus 0 baris terpengaruh karena policy tickets_update hanya untuk admin)
  UPDATE public.tickets SET status = 'dikerjakan' WHERE id = v_ticket_mine;
  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

  IF v_updated_rows = 0 THEN
    RAISE NOTICE 'LULUS [13c/15]: RLS mencegah teknisi mengubah status tiket secara langsung.';
  ELSE
    RAISE NOTICE 'GAGAL [13c/15]: Teknisi berhasil mengupdate status tiket.';
  END IF;

  -- Uji fungsi f_tickets dan RPC rekap: keduanya harus melempar exception untuk teknisi.
  v_err_caught := false;
  BEGIN
    PERFORM * FROM public.f_tickets(current_date - 1, current_date + 1);
  EXCEPTION WHEN others THEN
    v_err_caught := true;
  END;
  IF v_err_caught THEN
    RAISE NOTICE 'LULUS [13d/15]: f_tickets menolak pemanggil teknisi.';
  ELSE
    RAISE NOTICE 'GAGAL [13d/15]: Teknisi dapat memanggil f_tickets.';
  END IF;

  v_err_caught := false;
  BEGIN
    PERFORM public.rpc_dashboard_summary(current_date - 1, current_date + 1);
  EXCEPTION WHEN others THEN
    v_err_caught := true;
  END;
  IF v_err_caught THEN
    RAISE NOTICE 'LULUS [13e/15]: RPC rekap menolak pemanggil teknisi.';
  ELSE
    RAISE NOTICE 'GAGAL [13e/15]: Teknisi dapat memanggil RPC rekap.';
  END IF;

  EXECUTE 'RESET ROLE';
END $$;

-- ----------------------------------------------------------------------------
-- 14. UJI: Akses Role Anonim (anon) dicabut total (Migrasi 007 & NFR-12)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_err_caught boolean := false;
  v_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin' AND is_active)
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'teknisi' AND is_active) THEN
    RAISE NOTICE 'GAGAL PREKONDISI: Uji anon dilewati karena akun admin/teknisi aktif belum tersedia.';
    RAISE EXCEPTION 'Smoke test dihentikan karena prasyarat akun belum terpenuhi.';
  END IF;
  -- Simulasikan koneksi sebagai role anon
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-0000-0000-000000000000', 'role', 'anon')::text, true);
  EXECUTE 'SET LOCAL ROLE anon';

  -- SELECT tabel harus ditolak oleh GRANT, bukan hanya menghasilkan baris kosong.
  BEGIN
    SELECT count(*) INTO v_count FROM public.profiles;
    RAISE NOTICE 'GAGAL [14a/15]: Role anon dapat membaca profiles (%s baris).', v_count;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'LULUS [14a/15]: Role anon ditolak saat membaca tabel profiles.';
  END;

  -- Tes akses fungsi rpc_dashboard_summary oleh anon
  BEGIN
    PERFORM public.rpc_dashboard_summary(current_date, current_date);
  EXCEPTION WHEN others THEN
    v_err_caught := true;
  END;

  IF v_err_caught THEN
    RAISE NOTICE 'LULUS [14b/15]: Akses eksekusi RPC oleh role anon berhasil ditolak.';
  ELSE
    RAISE NOTICE 'GAGAL [14b/15]: Role anon dapat memanggil RPC dashboard summary.';
  END IF;

  EXECUTE 'RESET ROLE';
  RAISE NOTICE '=== SMOKE TEST SELESAI. Periksa seluruh baris GAGAL sebelum melanjutkan. ===';
END $$;

ROLLBACK;
-- Selesai. Seluruh data uji di-rollback bersih.
