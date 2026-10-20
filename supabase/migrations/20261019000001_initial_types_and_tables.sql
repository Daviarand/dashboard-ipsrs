-- ============================================================================
-- Migrasi 001 — Tipe ENUM dan Tabel
-- Dashboard IPSRS RS. Soeharto Heerdjan
-- Sumber: IPSRS_DASHBOARD_SPEC.md §5.2 Migrasi 001
-- ============================================================================

-- ==========================
-- ENUM TYPES
-- ==========================
create type public.user_role as enum ('admin', 'teknisi');
create type public.ticket_priority as enum ('urgent', 'tinggi', 'sedang', 'rendah');
create type public.ticket_status as enum
  ('baru', 'ditugaskan', 'dikerjakan', 'menunggu_material', 'selesai', 'dibatalkan');
create type public.ticket_classification as enum ('laksana', 'gagal_laksana');
create type public.stock_movement_type as enum ('masuk', 'keluar', 'koreksi');

-- ==========================
-- TABEL: PROFILES
-- ==========================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  full_name text not null,
  role public.user_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_username_key on public.profiles (lower(username));

-- ==========================
-- TABEL: MASTER DATA
-- ==========================

-- Ruangan
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index rooms_name_key on public.rooms (lower(name));

-- Jenis Kerusakan
create table public.damage_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index damage_types_name_key on public.damage_types (lower(name));

-- Alasan Gagal Laksana
create table public.failure_reasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index failure_reasons_name_key on public.failure_reasons (lower(name));

-- Pengaturan Aplikasi
create table public.app_settings (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz not null default now()
);

-- ==========================
-- TABEL: MATERIAL
-- ==========================
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  category text,
  unit text not null,
  min_stock numeric(12,2) not null default 0 check (min_stock >= 0),
  current_stock numeric(12,2) not null default 0,   -- hanya diubah oleh trigger
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index materials_code_key on public.materials (lower(code));

-- ==========================
-- TABEL: TIKET
-- ==========================

-- Penomoran tiket per bulan
create table public.ticket_counters (
  period text primary key,            -- 'YYYYMM'
  last_value integer not null default 0
);

-- Tiket perbaikan
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no text not null unique default '',            -- diisi trigger, mis. IPSRS-202610-0001
  room_id uuid not null references public.rooms(id),
  reporter_name text not null check (length(trim(reporter_name)) > 0),
  reported_at timestamptz not null,                      -- waktu lapor di WA (input admin)
  description text not null check (length(trim(description)) > 0),
  damage_type_id uuid not null references public.damage_types(id),
  priority public.ticket_priority not null default 'sedang',
  status public.ticket_status not null default 'baru',

  -- formulir selesai
  started_at timestamptz,
  finished_at timestamptz,
  work_done text,
  reporter_verified boolean,                             -- sudah ditandatangani pelapor?
  verifier_name text,

  -- hasil (dihitung trigger)
  duration_minutes integer,
  classification public.ticket_classification,
  failure_reason_id uuid references public.failure_reasons(id),
  failure_reason_note text,
  vendor_name text,

  cancel_reason text,

  created_by uuid not null references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),         -- waktu input
  updated_at timestamptz not null default now(),

  constraint tickets_finished_after_reported check (finished_at is null or finished_at >= reported_at),
  constraint tickets_finished_after_started check (started_at is null or finished_at is null or finished_at >= started_at)
);
create index tickets_status_idx on public.tickets (status);
create index tickets_reported_at_idx on public.tickets (reported_at);
create index tickets_finished_at_idx on public.tickets (finished_at);
create index tickets_room_idx on public.tickets (room_id);
create index tickets_damage_type_idx on public.tickets (damage_type_id);

-- Penugasan tiket ke teknisi (many-to-many)
create table public.ticket_assignments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id),
  user_id uuid not null references public.profiles(id),
  is_lead boolean not null default false,
  assigned_by uuid references public.profiles(id) default auth.uid(),
  assigned_at timestamptz not null default now(),
  released_at timestamptz
);
create unique index ticket_assignments_active_key
  on public.ticket_assignments (ticket_id, user_id) where released_at is null;
create unique index ticket_assignments_lead_key
  on public.ticket_assignments (ticket_id) where is_lead and released_at is null;
create index ticket_assignments_user_idx
  on public.ticket_assignments (user_id) where released_at is null;

-- Riwayat catatan tiket (append-only)
create table public.ticket_notes (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id),
  author_id uuid not null references public.profiles(id) default auth.uid(),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index ticket_notes_ticket_idx on public.ticket_notes (ticket_id, created_at);

-- Riwayat status tiket (append-only)
create table public.ticket_status_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id),
  from_status public.ticket_status,
  to_status public.ticket_status not null,
  changed_by uuid references public.profiles(id) default auth.uid(),
  changed_at timestamptz not null default now()
);
create index ticket_status_history_ticket_idx on public.ticket_status_history (ticket_id, changed_at);

-- Foto formulir fisik
create table public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id),
  file_name text not null,
  storage_path text not null,            -- path di bucket 'ticket-forms'
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  uploaded_by uuid not null references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index ticket_attachments_ticket_idx on public.ticket_attachments (ticket_id);

-- ==========================
-- TABEL: MUTASI STOK
-- ==========================
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id),
  type public.stock_movement_type not null,
  qty_change numeric(12,2) not null,      -- bertanda: masuk +, keluar -, koreksi +/-
  ticket_id uuid references public.tickets(id),
  note text,
  created_by uuid not null references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  constraint stock_movements_sign check (
    (type = 'masuk' and qty_change > 0) or
    (type = 'keluar' and qty_change < 0) or
    (type = 'koreksi' and qty_change <> 0)
  ),
  constraint stock_movements_koreksi_note check (
    type <> 'koreksi' or length(trim(coalesce(note, ''))) > 0
  )
);
create index stock_movements_material_idx on public.stock_movements (material_id, created_at);
create index stock_movements_ticket_idx on public.stock_movements (ticket_id);

-- ==========================
-- TABEL: LOG AKTIVITAS
-- ==========================
create table public.activity_logs (
  id bigint generated always as identity primary key,
  user_id uuid,
  action text not null,                  -- insert | update | delete
  entity text not null,                  -- nama tabel
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index activity_logs_created_idx on public.activity_logs (created_at desc);
create index activity_logs_entity_idx on public.activity_logs (entity, entity_id);
