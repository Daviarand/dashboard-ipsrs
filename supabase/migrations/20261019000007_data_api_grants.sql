-- ============================================================================
-- Migrasi 007 — Hak Akses Data API
-- Dashboard IPSRS RS. Soeharto Heerdjan
-- Sumber: IPSRS_DASHBOARD_SPEC.md §5.2 Migrasi 007
-- ============================================================================

-- Bersihkan hak akses lama untuk anon (proyek lama bisa memiliki default lama)
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Tabel: hanya operasi yang memang dipakai aplikasi (dibatasi lagi oleh RLS)
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.rooms to authenticated;
grant select, insert, update on public.damage_types to authenticated;
grant select, insert, update on public.failure_reasons to authenticated;
grant select, update on public.app_settings to authenticated;
grant select, insert, update on public.materials to authenticated;
grant select, insert on public.stock_movements to authenticated;
grant select, insert, update on public.tickets to authenticated;
grant select, insert, update on public.ticket_assignments to authenticated;
grant select, insert on public.ticket_notes to authenticated;
grant select on public.ticket_status_history to authenticated;
grant select, insert, delete on public.ticket_attachments to authenticated;
grant select on public.activity_logs to authenticated;
-- ticket_counters: sengaja tanpa grant (hanya diakses fungsi security definer)

-- View
grant select on public.v_tickets, public.v_materials to authenticated;

-- Fungsi bantu yang dipakai policy RLS
-- (rpc_* dan f_tickets sudah diberi grant di Migrasi 006 bagian 11)
grant execute on function public.current_role_name() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_teknisi() to authenticated;
grant execute on function public.is_assigned(uuid) to authenticated;

-- service_role (dipakai Edge Function admin-manage-users)
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
