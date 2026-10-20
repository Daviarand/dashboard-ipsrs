-- ============================================================================
-- Migrasi 004 — View dan Fungsi Rekap
-- Dashboard IPSRS RS. Soeharto Heerdjan
-- Sumber: IPSRS_DASHBOARD_SPEC.md Bagian 5.2 (Migrasi 004)
-- ============================================================================

-- ==========================
-- VIEW: v_tickets — tiket dengan field turunan
-- ==========================
create or replace view public.v_tickets with (security_invoker = true) as
with s as (
  select
    (select value::integer from public.app_settings where key = 'sla_hours') as sla_hours,
    (select value::integer from public.app_settings where key = 'sla_warning_hours') as warn_hours
),
base as (
  select
    t.*,
    r.name as room_name,
    d.name as damage_type_name,
    fr.name as failure_reason_name,
    t.status in ('baru', 'ditugaskan', 'dikerjakan', 'menunggu_material') as is_running,
    s.sla_hours, s.warn_hours
  from public.tickets t
  join public.rooms r on r.id = t.room_id
  join public.damage_types d on d.id = t.damage_type_id
  left join public.failure_reasons fr on fr.id = t.failure_reason_id
  cross join s
)
select
  b.id, b.ticket_no, b.room_id, b.room_name, b.reporter_name,
  b.reported_at, b.created_at as input_at, b.description,
  b.damage_type_id, b.damage_type_name, b.priority, b.status,
  b.started_at, b.finished_at, b.work_done, b.reporter_verified, b.verifier_name,
  b.duration_minutes, b.classification,
  b.failure_reason_id, b.failure_reason_name, b.failure_reason_note, b.vendor_name,
  b.cancel_reason, b.created_by, b.updated_at,
  b.is_running,
  case
    when b.is_running then round(extract(epoch from (now() - b.reported_at)) / 60)::integer
    when b.status = 'selesai' then b.duration_minutes
  end as elapsed_minutes,
  case
    when b.status = 'selesai' then b.classification
    when b.is_running and now() - b.reported_at > make_interval(hours => b.sla_hours)
      then 'gagal_laksana'::public.ticket_classification
  end as effective_classification,
  (b.is_running and now() - b.reported_at > make_interval(hours => b.sla_hours)) as is_overdue,
  (b.is_running
    and now() - b.reported_at <= make_interval(hours => b.sla_hours)
    and now() - b.reported_at > make_interval(hours => b.warn_hours)) as is_near_deadline,
  exists (select 1 from public.ticket_attachments a where a.ticket_id = b.id) as has_attachment,
  (b.status = 'selesai'
    and not exists (select 1 from public.ticket_attachments a where a.ticket_id = b.id)) as needs_form_upload,
  (select coalesce(jsonb_agg(jsonb_build_object(
            'user_id', p.id, 'full_name', p.full_name, 'is_lead', a.is_lead)), '[]'::jsonb)
     from public.ticket_assignments a
     join public.profiles p on p.id = a.user_id
    where a.ticket_id = b.id and a.released_at is null) as assignees,
  (select n.body from public.ticket_notes n
    where n.ticket_id = b.id order by n.created_at desc limit 1) as last_note
from base b;

-- ==========================
-- VIEW: v_materials — stok dengan penanda stok rendah
-- ==========================
create or replace view public.v_materials with (security_invoker = true) as
select m.*, (m.current_stock <= m.min_stock) as is_low_stock
from public.materials m;

-- ==========================
-- FUNGSI: Filter tanggal terpusat (WIB)
-- Hanya admin; tiket dibatalkan dikecualikan.
-- ==========================
create or replace function public.f_tickets(
  p_from date, p_to date, p_basis text default 'reported'   -- 'reported' | 'finished'
) returns setof public.v_tickets
language sql stable security invoker set search_path = public as $$
  select t.* from public.v_tickets t
  where public.is_admin()
    and t.status <> 'dibatalkan'
    and (case when p_basis = 'finished'
              then (t.finished_at at time zone 'Asia/Jakarta')::date
              else (t.reported_at at time zone 'Asia/Jakarta')::date end)
        between p_from and p_to
$$;

-- ==========================
-- RPC: Ringkasan dashboard
-- ==========================
create or replace function public.rpc_dashboard_summary(
  p_from date, p_to date, p_basis text default 'reported'
) returns table (
  total bigint, running bigint, finished bigint, laksana bigint, gagal_laksana bigint,
  laksana_pct numeric, avg_duration_minutes numeric, median_duration_minutes numeric
) language sql stable security invoker set search_path = public as $$
  select
    count(*),
    count(*) filter (where t.is_running),
    count(*) filter (where t.status = 'selesai'),
    count(*) filter (where t.effective_classification = 'laksana'),
    count(*) filter (where t.effective_classification = 'gagal_laksana'),
    round(100.0 * count(*) filter (where t.effective_classification = 'laksana')
          / nullif(count(*) filter (where t.effective_classification is not null), 0), 1),
    round(avg(t.duration_minutes) filter (where t.status = 'selesai'), 0),
    round((percentile_cont(0.5) within group (order by t.duration_minutes)
           filter (where t.status = 'selesai'))::numeric, 0)
  from public.f_tickets(p_from, p_to, p_basis) t
$$;

-- ==========================
-- RPC: Rekap 1 & 5 — Permintaan per ruangan (top 10 = limit 10 di aplikasi)
-- ==========================
create or replace function public.rpc_rooms_recap(
  p_from date, p_to date, p_basis text default 'reported'
) returns table (room_id uuid, room_name text, total bigint, running bigint, finished bigint)
language sql stable security invoker set search_path = public as $$
  select t.room_id, t.room_name, count(*),
         count(*) filter (where t.is_running),
         count(*) filter (where t.status = 'selesai')
  from public.f_tickets(p_from, p_to, p_basis) t
  group by t.room_id, t.room_name
  order by count(*) desc, t.room_name
$$;

-- ==========================
-- RPC: Rekap 2 — Petugas yang menangani
-- ==========================
create or replace function public.rpc_staff_recap(
  p_from date, p_to date, p_basis text default 'reported'
) returns table (user_id uuid, full_name text, total bigint, finished bigint, avg_duration_minutes numeric)
language sql stable security invoker set search_path = public as $$
  select p.id, p.full_name, count(*),
         count(*) filter (where t.status = 'selesai'),
         round(avg(t.duration_minutes) filter (where t.status = 'selesai'), 0)
  from public.f_tickets(p_from, p_to, p_basis) t
  join public.ticket_assignments a on a.ticket_id = t.id and a.released_at is null
  join public.profiles p on p.id = a.user_id
  group by p.id, p.full_name
  order by count(*) desc
$$;

-- ==========================
-- RPC: Rekap 3 — Material terpakai pada tiket dalam rentang
-- ==========================
create or replace function public.rpc_materials_recap(
  p_from date, p_to date, p_basis text default 'reported'
) returns table (
  material_id uuid, code text, name text, unit text,
  used_qty numeric, ticket_count bigint, current_stock numeric, min_stock numeric
) language sql stable security invoker set search_path = public as $$
  select m.id, m.code, m.name, m.unit,
         sum(-sm.qty_change), count(distinct sm.ticket_id), m.current_stock, m.min_stock
  from public.stock_movements sm
  join public.materials m on m.id = sm.material_id
  join public.f_tickets(p_from, p_to, p_basis) t on t.id = sm.ticket_id
  where sm.type = 'keluar'
  group by m.id
  order by sum(-sm.qty_change) desc
$$;

-- ==========================
-- RPC: Rekap 4 — Durasi perbaikan per jenis kerusakan dan per prioritas (hanya tiket selesai)
-- ==========================
create or replace function public.rpc_duration_recap(
  p_from date, p_to date, p_basis text default 'reported'
) returns table (group_type text, group_name text, ticket_count bigint, avg_minutes numeric, median_minutes numeric)
language sql stable security invoker set search_path = public as $$
  select 'damage_type'::text, t.damage_type_name, count(*),
         round(avg(t.duration_minutes), 0),
         round((percentile_cont(0.5) within group (order by t.duration_minutes))::numeric, 0)
  from public.f_tickets(p_from, p_to, p_basis) t
  where t.status = 'selesai' group by t.damage_type_name
  union all
  select 'priority'::text, t.priority::text, count(*),
         round(avg(t.duration_minutes), 0),
         round((percentile_cont(0.5) within group (order by t.duration_minutes))::numeric, 0)
  from public.f_tickets(p_from, p_to, p_basis) t
  where t.status = 'selesai' group by t.priority
$$;

-- ==========================
-- RPC: Rekap 6 — Jenis kerusakan terbanyak
-- ==========================
create or replace function public.rpc_damage_recap(
  p_from date, p_to date, p_basis text default 'reported'
) returns table (damage_type_id uuid, damage_type_name text, total bigint)
language sql stable security invoker set search_path = public as $$
  select t.damage_type_id, t.damage_type_name, count(*)
  from public.f_tickets(p_from, p_to, p_basis) t
  group by t.damage_type_id, t.damage_type_name
  order by count(*) desc
$$;

-- ==========================
-- RPC: Rekap 6 — Tren bulanan jenis kerusakan
-- ==========================
create or replace function public.rpc_damage_trend(
  p_from date, p_to date, p_basis text default 'reported'
) returns table (month date, damage_type_name text, total bigint)
language sql stable security invoker set search_path = public as $$
  select date_trunc('month', t.reported_at at time zone 'Asia/Jakarta')::date,
         t.damage_type_name, count(*)
  from public.f_tickets(p_from, p_to, p_basis) t
  group by 1, 2 order by 1, 3 desc
$$;

-- ==========================
-- RPC: Rekap 7 — Laksana vs Gagal Laksana beserta alasan
-- ==========================
create or replace function public.rpc_laksana_recap(
  p_from date, p_to date, p_basis text default 'reported'
) returns table (classification text, failure_reason_name text, total bigint)
language sql stable security invoker set search_path = public as $$
  select t.effective_classification::text, t.failure_reason_name, count(*)
  from public.f_tickets(p_from, p_to, p_basis) t
  where t.effective_classification is not null
  group by 1, 2 order by 1, 3 desc
$$;
