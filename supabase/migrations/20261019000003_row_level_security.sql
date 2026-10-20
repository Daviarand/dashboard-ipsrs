-- ============================================================================
-- Migrasi 003 — Row Level Security
-- Dashboard IPSRS RS. Soeharto Heerdjan
-- Sumber: IPSRS_DASHBOARD_SPEC.md Bagian 5.2 (Migrasi 003)
-- ============================================================================

-- ==========================
-- ENABLE RLS pada semua tabel
-- ==========================
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.damage_types enable row level security;
alter table public.failure_reasons enable row level security;
alter table public.app_settings enable row level security;
alter table public.materials enable row level security;
alter table public.ticket_counters enable row level security;      -- tanpa policy (hanya fungsi)
alter table public.tickets enable row level security;
alter table public.ticket_assignments enable row level security;
alter table public.ticket_notes enable row level security;
alter table public.ticket_status_history enable row level security;
alter table public.ticket_attachments enable row level security;
alter table public.stock_movements enable row level security;
alter table public.activity_logs enable row level security;

-- ==========================
-- POLICIES: PROFILES
-- Semua pengguna aktif boleh membaca (tim kecil); hanya admin mengubah
-- ==========================
create policy profiles_select on public.profiles for select to authenticated
  using (public.current_role_name() is not null);
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ==========================
-- POLICIES: MASTER DATA — baca semua, tulis admin (tanpa delete)
-- ==========================

-- Rooms
create policy rooms_select on public.rooms for select to authenticated
  using (public.current_role_name() is not null);
create policy rooms_insert on public.rooms for insert to authenticated with check (public.is_admin());
create policy rooms_update on public.rooms for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Damage Types
create policy damage_types_select on public.damage_types for select to authenticated
  using (public.current_role_name() is not null);
create policy damage_types_insert on public.damage_types for insert to authenticated with check (public.is_admin());
create policy damage_types_update on public.damage_types for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Failure Reasons
create policy failure_reasons_select on public.failure_reasons for select to authenticated
  using (public.current_role_name() is not null);
create policy failure_reasons_insert on public.failure_reasons for insert to authenticated with check (public.is_admin());
create policy failure_reasons_update on public.failure_reasons for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- App Settings
create policy app_settings_select on public.app_settings for select to authenticated
  using (public.current_role_name() is not null);
create policy app_settings_update on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ==========================
-- POLICIES: MATERIAL — semua baca; teknisi kelola
-- ==========================
create policy materials_select on public.materials for select to authenticated
  using (public.current_role_name() is not null);
create policy materials_insert on public.materials for insert to authenticated with check (public.is_teknisi());
create policy materials_update on public.materials for update to authenticated
  using (public.is_teknisi()) with check (public.is_teknisi());

-- ==========================
-- POLICIES: MUTASI STOK
-- ==========================
create policy stock_movements_select on public.stock_movements for select to authenticated
  using (public.current_role_name() is not null);
create policy stock_movements_insert_teknisi on public.stock_movements for insert to authenticated
  with check (
    public.is_teknisi() and created_by = auth.uid()
    and (type <> 'keluar' or ticket_id is null or public.is_assigned(ticket_id))
  );
create policy stock_movements_insert_admin on public.stock_movements for insert to authenticated
  with check (
    public.is_admin() and created_by = auth.uid()
    and type = 'keluar' and ticket_id is not null
  );

-- ==========================
-- POLICIES: TIKET
-- ==========================
create policy tickets_select on public.tickets for select to authenticated
  using (public.is_admin() or public.is_assigned(id));
create policy tickets_insert on public.tickets for insert to authenticated with check (public.is_admin());
create policy tickets_update on public.tickets for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ==========================
-- POLICIES: PENUGASAN TIKET
-- ==========================
create policy assignments_select on public.ticket_assignments for select to authenticated
  using (public.is_admin() or public.is_assigned(ticket_id));
create policy assignments_insert on public.ticket_assignments for insert to authenticated
  with check (public.is_admin());
create policy assignments_update on public.ticket_assignments for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ==========================
-- POLICIES: CATATAN TIKET
-- ==========================
create policy notes_select on public.ticket_notes for select to authenticated
  using (public.is_admin() or public.is_assigned(ticket_id));
create policy notes_insert on public.ticket_notes for insert to authenticated
  with check (author_id = auth.uid() and (public.is_admin() or public.is_assigned(ticket_id)));

-- ==========================
-- POLICIES: RIWAYAT STATUS TIKET
-- ==========================
create policy status_history_select on public.ticket_status_history for select to authenticated
  using (public.is_admin() or public.is_assigned(ticket_id));

-- ==========================
-- POLICIES: LAMPIRAN TIKET
-- ==========================
create policy attachments_select on public.ticket_attachments for select to authenticated
  using (public.is_admin());
create policy attachments_insert on public.ticket_attachments for insert to authenticated
  with check (public.is_admin() and uploaded_by = auth.uid());
create policy attachments_delete on public.ticket_attachments for delete to authenticated
  using (public.is_admin());

-- ==========================
-- POLICIES: LOG AKTIVITAS
-- ==========================
create policy activity_logs_select on public.activity_logs for select to authenticated
  using (public.is_admin());

-- ==========================
-- STORAGE: Bucket privat khusus admin
-- ==========================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ticket-forms', 'ticket-forms', false, 10485760,
        array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do nothing;

create policy ticket_forms_admin_all on storage.objects for all to authenticated
  using (bucket_id = 'ticket-forms' and public.is_admin())
  with check (bucket_id = 'ticket-forms' and public.is_admin());
