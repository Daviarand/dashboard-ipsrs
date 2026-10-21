-- ============================================================================
-- Migrasi 008 — Tingkat Kesulitan Tiket
-- Dashboard IPSRS RS. Soeharto Heerdjan
-- Sumber: IPSRS_DASHBOARD_SPEC.md §5.2 Migrasi 008
-- ============================================================================

create type public.ticket_difficulty as enum ('low', 'medium', 'hard');

alter table public.tickets
  add column difficulty public.ticket_difficulty;

grant usage on type public.ticket_difficulty to authenticated, service_role;

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
    where n.ticket_id = b.id order by n.created_at desc limit 1) as last_note,
  b.difficulty
from base b;

notify pgrst, 'reload schema';
