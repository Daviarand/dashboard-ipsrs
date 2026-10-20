-- ============================================================================
-- Migrasi 002 — Fungsi Bantu dan Trigger
-- Dashboard IPSRS RS. Soeharto Heerdjan
-- Sumber: IPSRS_DASHBOARD_SPEC.md §5.2 Migrasi 002
-- ============================================================================

-- ==========================
-- FUNGSI: updated_at otomatis
-- ==========================
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_rooms_updated before update on public.rooms
  for each row execute function public.set_updated_at();
create trigger trg_damage_types_updated before update on public.damage_types
  for each row execute function public.set_updated_at();
create trigger trg_failure_reasons_updated before update on public.failure_reasons
  for each row execute function public.set_updated_at();
create trigger trg_materials_updated before update on public.materials
  for each row execute function public.set_updated_at();
create trigger trg_tickets_updated before update on public.tickets
  for each row execute function public.set_updated_at();

-- ==========================
-- FUNGSI: Helper role
-- ==========================
create or replace function public.current_role_name() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_name() = 'admin', false)
$$;

create or replace function public.is_teknisi() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_name() = 'teknisi', false)
$$;

create or replace function public.is_assigned(p_ticket uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_teknisi() and exists (
    select 1 from public.ticket_assignments a
    where a.ticket_id = p_ticket and a.user_id = auth.uid() and a.released_at is null
  )
$$;

-- ==========================
-- FUNGSI: Nomor tiket (IPSRS-YYYYMM-NNNN, bulan WIB)
-- ==========================
create or replace function public.next_ticket_no() returns text
language plpgsql security definer set search_path = public as $$
declare
  p text := to_char(now() at time zone 'Asia/Jakarta', 'YYYYMM');
  n integer;
begin
  insert into public.ticket_counters (period, last_value) values (p, 1)
  on conflict (period) do update set last_value = public.ticket_counters.last_value + 1
  returning last_value into n;
  return 'IPSRS-' || p || '-' || lpad(n::text, 4, '0');
end $$;

-- ==========================
-- FUNGSI: Validasi perpindahan status
-- ==========================
create or replace function public.is_valid_ticket_transition(
  p_old public.ticket_status, p_new public.ticket_status
) returns boolean language sql immutable as $$
  select case p_old
    when 'baru'              then p_new in ('ditugaskan', 'dibatalkan')
    when 'ditugaskan'        then p_new in ('dikerjakan', 'menunggu_material', 'selesai', 'dibatalkan')
    when 'dikerjakan'        then p_new in ('menunggu_material', 'selesai')
    when 'menunggu_material' then p_new in ('dikerjakan', 'selesai')
    when 'selesai'           then p_new = 'dikerjakan'      -- buka kembali
    else false                                              -- dibatalkan = final
  end
$$;

-- ==========================
-- TRIGGER: Tiket — penomoran, validasi status, klasifikasi otomatis
-- ==========================
create or replace function public.tickets_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_sla integer;
begin
  if tg_op = 'INSERT' then
    new.ticket_no := public.next_ticket_no();
    new.status := 'baru';
    return new;
  end if;

  new.ticket_no := old.ticket_no;      -- tidak boleh berubah
  new.created_by := old.created_by;
  new.created_at := old.created_at;

  if new.status is distinct from old.status
     and not public.is_valid_ticket_transition(old.status, new.status) then
    raise exception 'Perubahan status % ke % tidak diperbolehkan', old.status, new.status;
  end if;

  if new.status = 'selesai' then
    if new.started_at is null or new.finished_at is null or new.reporter_verified is null then
      raise exception 'Tiket selesai wajib memiliki waktu mulai, waktu selesai, dan status verifikasi pelapor';
    end if;
    select value::integer into v_sla from public.app_settings where key = 'sla_hours';
    new.duration_minutes := floor(extract(epoch from (new.finished_at - new.reported_at)) / 60)::integer;
    new.classification := case
      when (new.finished_at - new.reported_at) <= make_interval(hours => coalesce(v_sla, 24))
        then 'laksana'::public.ticket_classification
      else 'gagal_laksana'::public.ticket_classification end;
    if new.classification = 'gagal_laksana' and new.failure_reason_id is null then
      raise exception 'Alasan Gagal Laksana wajib diisi';
    end if;
    if new.classification = 'laksana' then
      new.failure_reason_id := null;
      new.failure_reason_note := null;
      new.vendor_name := null;
    end if;
  elsif new.status = 'dibatalkan' then
    if length(trim(coalesce(new.cancel_reason, ''))) = 0 then
      raise exception 'Alasan pembatalan wajib diisi';
    end if;
    new.duration_minutes := null;
    new.classification := null;
  else
    -- masih berjalan atau dibuka kembali
    new.finished_at := null;
    new.duration_minutes := null;
    new.classification := null;
  end if;

  return new;
end $$;

create trigger trg_tickets_before_write
  before insert or update on public.tickets
  for each row execute function public.tickets_before_write();

-- ==========================
-- TRIGGER: Riwayat status tiket
-- ==========================
create or replace function public.tickets_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.ticket_status_history (ticket_id, from_status, to_status)
    values (new.id, null, new.status);
  elsif new.status is distinct from old.status then
    insert into public.ticket_status_history (ticket_id, from_status, to_status)
    values (new.id, old.status, new.status);
  end if;
  return null;
end $$;

create trigger trg_tickets_after_write
  after insert or update on public.tickets
  for each row execute function public.tickets_after_write();

-- ==========================
-- TRIGGER: Penugasan — hanya teknisi aktif; penugasan pertama => status ditugaskan
-- ==========================
create or replace function public.assignments_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles
                 where id = new.user_id and role = 'teknisi' and is_active) then
    raise exception 'Hanya petugas teknis aktif yang dapat ditugaskan';
  end if;
  return new;
end $$;

create trigger trg_assignments_before_insert
  before insert on public.ticket_assignments
  for each row execute function public.assignments_before_insert();

create or replace function public.assignments_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.tickets set status = 'ditugaskan'
  where id = new.ticket_id and status = 'baru';
  return null;
end $$;

create trigger trg_assignments_after_insert
  after insert on public.ticket_assignments
  for each row execute function public.assignments_after_insert();

-- ==========================
-- TRIGGER: Stok — current_stock hanya boleh diubah trigger
-- ==========================
create or replace function public.materials_protect_stock() returns trigger
language plpgsql as $$
begin
  if pg_trigger_depth() = 1 then   -- dipanggil langsung oleh klien
    if tg_op = 'INSERT' then
      new.current_stock := 0;
    else
      new.current_stock := old.current_stock;
    end if;
  end if;
  return new;
end $$;

create trigger trg_materials_protect_stock
  before insert or update on public.materials
  for each row execute function public.materials_protect_stock();

-- ==========================
-- TRIGGER: Mutasi stok — validasi dan update current_stock
-- ==========================
create or replace function public.stock_movements_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_stock numeric;
begin
  select current_stock into v_stock from public.materials
  where id = new.material_id for update;
  if new.type = 'keluar' and v_stock + new.qty_change < 0 then
    raise exception 'Stok tidak mencukupi (tersedia %)', v_stock;
  end if;
  return new;
end $$;

create trigger trg_stock_movements_before_insert
  before insert on public.stock_movements
  for each row execute function public.stock_movements_before_insert();

create or replace function public.stock_movements_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.materials
  set current_stock = current_stock + new.qty_change
  where id = new.material_id;
  return null;
end $$;

create trigger trg_stock_movements_after_insert
  after insert on public.stock_movements
  for each row execute function public.stock_movements_after_insert();

-- ==========================
-- TRIGGER: Tabel append-only (immutable)
-- ==========================
create or replace function public.prevent_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'Tabel % bersifat append-only', tg_table_name;
end $$;

create trigger trg_stock_movements_immutable before update or delete on public.stock_movements
  for each row execute function public.prevent_mutation();
create trigger trg_ticket_notes_immutable before update or delete on public.ticket_notes
  for each row execute function public.prevent_mutation();
create trigger trg_ticket_status_history_immutable before update or delete on public.ticket_status_history
  for each row execute function public.prevent_mutation();
create trigger trg_activity_logs_immutable before update or delete on public.activity_logs
  for each row execute function public.prevent_mutation();

-- ==========================
-- TRIGGER: Audit log generik
-- ==========================
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity_logs (user_id, action, entity, entity_id, old_data, new_data)
  values (
    auth.uid(), lower(tg_op), tg_table_name,
    coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id'),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','rooms','damage_types','failure_reasons','app_settings','tickets',
    'ticket_assignments','ticket_attachments','materials','stock_movements'
  ] loop
    execute format(
      'create trigger trg_audit_%1$s after insert or update or delete on public.%1$I
       for each row execute function public.audit_row()', t);
  end loop;
end $$;
