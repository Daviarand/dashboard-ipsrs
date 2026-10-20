-- ============================================================================
-- Migrasi 006 — Penyempurnaan dan RPC Aksi
-- Dashboard IPSRS RS. Soeharto Heerdjan
-- Sumber: IPSRS_DASHBOARD_SPEC.md §5.2 Migrasi 006
-- ============================================================================

-- 1. audit_row: dukung tabel ber-PK 'key' (app_settings)
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity_logs (user_id, action, entity, entity_id, old_data, new_data)
  values (
    auth.uid(), lower(tg_op), tg_table_name,
    coalesce(
      to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id',
      to_jsonb(new) ->> 'key', to_jsonb(old) ->> 'key'
    ),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end $$;

-- 2. Format username (FR-AUTH-07)
alter table public.profiles
  add constraint profiles_username_format check (username ~ '^[a-z0-9._-]{3,30}$');

-- 3. Minimal satu admin aktif (BR-17)
create or replace function public.profiles_guard_last_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin' and old.is_active
     and (new.role <> 'admin' or not new.is_active)
     and not exists (select 1 from public.profiles p
                     where p.role = 'admin' and p.is_active and p.id <> old.id) then
    raise exception 'Minimal harus ada satu admin aktif';
  end if;
  return new;
end $$;

create trigger trg_profiles_guard_last_admin
  before update on public.profiles
  for each row execute function public.profiles_guard_last_admin();

-- 4. Validasi waktu tiket (BR-16)
create or replace function public.tickets_validate_times() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'INSERT' or new.reported_at is distinct from old.reported_at)
     and new.reported_at > now() + interval '5 minutes' then
    raise exception 'Waktu lapor tidak boleh di masa depan';
  end if;
  if new.started_at is not null and new.started_at < new.reported_at then
    raise exception 'Waktu mulai tidak boleh sebelum waktu lapor';
  end if;
  if new.finished_at is not null and new.finished_at > now() + interval '5 minutes' then
    raise exception 'Waktu selesai tidak boleh di masa depan';
  end if;
  return new;
end $$;

create trigger trg_tickets_validate_times
  before insert or update on public.tickets
  for each row execute function public.tickets_validate_times();

-- 5. Penugasan: teknisi aktif + tiket belum selesai/dibatalkan (BR-15)
create or replace function public.assignments_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles
                 where id = new.user_id and role = 'teknisi' and is_active) then
    raise exception 'Hanya petugas teknis aktif yang dapat ditugaskan';
  end if;
  if exists (select 1 from public.tickets
             where id = new.ticket_id and status in ('selesai', 'dibatalkan')) then
    raise exception 'Tiket yang sudah selesai atau dibatalkan tidak dapat ditugaskan';
  end if;
  return new;
end $$;

-- 6. Stok: tolak pemakaian pada tiket dibatalkan (BR-18) + cek stok
create or replace function public.stock_movements_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_stock numeric;
begin
  if new.ticket_id is not null and exists (
       select 1 from public.tickets where id = new.ticket_id and status = 'dibatalkan') then
    raise exception 'Tiket yang dibatalkan tidak dapat memiliki pemakaian material';
  end if;
  select current_stock into v_stock from public.materials
  where id = new.material_id for update;
  if new.type = 'keluar' and v_stock + new.qty_change < 0 then
    raise exception 'Stok tidak mencukupi (tersedia %)', v_stock;
  end if;
  return new;
end $$;

-- 7. Policy teknisi: stok masuk/koreksi tidak boleh dikaitkan ke tiket
drop policy stock_movements_insert_teknisi on public.stock_movements;
create policy stock_movements_insert_teknisi on public.stock_movements
  for insert to authenticated
  with check (
    public.is_teknisi() and created_by = auth.uid()
    and (
      (type = 'keluar' and (ticket_id is null or public.is_assigned(ticket_id)))
      or (type <> 'keluar' and ticket_id is null)
    )
  );

-- 8. Rekap hanya dapat dipanggil admin, bukan sekadar mengembalikan hasil kosong
create or replace function public.f_tickets(
  p_from date, p_to date, p_basis text default 'reported'
) returns setof public.v_tickets
language plpgsql stable security invoker set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat mengakses rekap tiket';
  end if;
  return query
    select t.* from public.v_tickets t
    where t.status <> 'dibatalkan'
      and (case when p_basis = 'finished'
                then (t.finished_at at time zone 'Asia/Jakarta')::date
                else (t.reported_at at time zone 'Asia/Jakarta')::date end)
          between p_from and p_to;
end $$;

-- 9. RPC: ubah status (selain selesai dan buka kembali), catatan opsional
create or replace function public.rpc_change_status(
  p_ticket_id uuid, p_new_status public.ticket_status, p_note text default null
) returns public.tickets
language plpgsql security invoker set search_path = public as $$
declare v_old public.ticket_status; v_ticket public.tickets;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat mengubah status tiket';
  end if;
  if p_new_status = 'selesai' then
    raise exception 'Gunakan penyelesaian tiket (rpc_finish_ticket)';
  end if;
  select status into v_old from public.tickets where id = p_ticket_id for update;
  if not found then raise exception 'Tiket tidak ditemukan'; end if;
  if v_old = 'selesai' then
    raise exception 'Gunakan membuka kembali tiket (rpc_reopen_ticket)';
  end if;
  if p_new_status = 'dibatalkan' and length(trim(coalesce(p_note, ''))) = 0 then
    raise exception 'Alasan pembatalan wajib diisi';
  end if;

  update public.tickets
     set status = p_new_status,
         cancel_reason = case when p_new_status = 'dibatalkan'
                              then trim(p_note) else cancel_reason end
   where id = p_ticket_id
  returning * into v_ticket;

  if p_new_status <> 'dibatalkan' and length(trim(coalesce(p_note, ''))) > 0 then
    insert into public.ticket_notes (ticket_id, body) values (p_ticket_id, trim(p_note));
  end if;
  return v_ticket;
end $$;

-- 10. RPC: buka kembali tiket selesai (alasan wajib -> otomatis jadi catatan)
create or replace function public.rpc_reopen_ticket(p_ticket_id uuid, p_reason text)
returns public.tickets
language plpgsql security invoker set search_path = public as $$
declare v_ticket public.tickets;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat membuka kembali tiket';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Alasan membuka kembali tiket wajib diisi';
  end if;
  update public.tickets set status = 'dikerjakan'
   where id = p_ticket_id and status = 'selesai'
  returning * into v_ticket;
  if not found then
    raise exception 'Hanya tiket berstatus selesai yang dapat dibuka kembali';
  end if;
  insert into public.ticket_notes (ticket_id, body)
  values (p_ticket_id, 'Tiket dibuka kembali: ' || trim(p_reason));
  return v_ticket;
end $$;

-- 11. RPC: selesaikan tiket secara atomik (formulir selesai + material + status)
--     p_materials = [{"material_id": "<uuid>", "qty": 2}, ...]  (hanya pemakaian BARU)
create or replace function public.rpc_finish_ticket(
  p_ticket_id uuid,
  p_started_at timestamptz,
  p_finished_at timestamptz,
  p_work_done text,
  p_reporter_verified boolean,
  p_verifier_name text,
  p_failure_reason_id uuid default null,
  p_failure_reason_note text default null,
  p_vendor_name text default null,
  p_materials jsonb default '[]'::jsonb
) returns public.tickets
language plpgsql security invoker set search_path = public as $$
declare
  v_status public.ticket_status;
  v_ticket public.tickets;
  m jsonb;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat menyelesaikan tiket';
  end if;
  select status into v_status from public.tickets where id = p_ticket_id for update;
  if not found then raise exception 'Tiket tidak ditemukan'; end if;
  if v_status not in ('ditugaskan', 'dikerjakan', 'menunggu_material') then
    raise exception 'Tiket berstatus % tidak dapat diselesaikan', v_status;
  end if;

  for m in select value from jsonb_array_elements(coalesce(p_materials, '[]'::jsonb)) loop
    if coalesce((m ->> 'qty')::numeric, 0) <= 0 then
      raise exception 'Jumlah material harus lebih dari 0';
    end if;
    insert into public.stock_movements (material_id, type, qty_change, ticket_id, note)
    values ((m ->> 'material_id')::uuid, 'keluar', -((m ->> 'qty')::numeric),
            p_ticket_id, 'Pemakaian pada tiket');
  end loop;

  update public.tickets set
    started_at = p_started_at,
    finished_at = p_finished_at,
    work_done = p_work_done,
    reporter_verified = p_reporter_verified,
    verifier_name = p_verifier_name,
    failure_reason_id = p_failure_reason_id,
    failure_reason_note = p_failure_reason_note,
    vendor_name = p_vendor_name,
    status = 'selesai'
  where id = p_ticket_id
  returning * into v_ticket;

  return v_ticket;
end $$;

-- 12. Cabut akses anon, beri akses authenticated (NFR-12)
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname like 'rpc\_%' or p.proname = 'f_tickets')
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
