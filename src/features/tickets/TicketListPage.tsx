import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { ClassificationBadge } from '@/components/ClassificationBadge';
import { datetimeLocalToUTC, formatDateTimeWIB } from '@/lib/datetime';
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from '@/lib/labels';
import { ITEMS_PER_PAGE } from '@/lib/constants';
import { mapDbError } from '@/lib/error';
import {
  Plus,
  Search,
  AlertTriangle,
  Clock,
  FileWarning,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { Database } from '@/types/database';

type TicketView = Database['public']['Views']['v_tickets']['Row'];

export function TicketListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [damageTypeFilter, setDamageTypeFilter] = useState<string>('all');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'near_deadline' | 'overdue' | 'needs_upload'>('all');

  useEffect(() => {
    setRoomFilter(searchParams.get('room_id') ?? 'all');
    setStaffFilter(searchParams.get('staff_id') ?? 'all');
    setDamageTypeFilter(searchParams.get('damage_type_id') ?? 'all');
    setPriorityFilter(searchParams.get('priority') ?? 'all');
    setClassificationFilter(searchParams.get('classification') ?? 'all');
    setPage(1);
  }, [searchParams]);

  // Master options
  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms_active'],
    queryFn: async () => {
      const { data } = await supabase.from('rooms').select('id, name').order('name');
      return data || [];
    },
  });
  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians_active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'teknisi')
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: damageTypes = [] } = useQuery({
    queryKey: ['damage_types_active'],
    queryFn: async () => {
      const { data } = await supabase.from('damage_types').select('id, name').order('name');
      return data || [];
    },
  });

  // Query tickets with server-side pagination & filter
  const { data: result, isLoading, error } = useQuery({
    queryKey: [
      'tickets_list',
      page,
      search,
      statusFilter,
      priorityFilter,
      roomFilter,
      damageTypeFilter,
      staffFilter,
      classificationFilter,
      dateFrom,
      dateTo,
      quickFilter,
    ],
    queryFn: async () => {
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from('v_tickets')
        .select('*', { count: 'exact' });

      if (staffFilter !== 'all') {
        const { data: assignments, error: assignmentError } = await supabase
          .from('ticket_assignments')
          .select('ticket_id')
          .eq('user_id', staffFilter)
          .is('released_at', null);
        if (assignmentError) throw assignmentError;
        const assignedTicketIds = [...new Set((assignments ?? []).map((row) => row.ticket_id))];
        if (assignedTicketIds.length === 0) return { tickets: [] as TicketView[], total: 0 };
        query = query.in('id', assignedTicketIds);
      }
      if (classificationFilter !== 'all') {
        query = query.eq('effective_classification', classificationFilter as NonNullable<TicketView['effective_classification']>);
      }

      // Search by ticket number, reporter, or issue description.
      if (search.trim()) {
        query = query.or(`description.ilike.%${search.trim()}%,reporter_name.ilike.%${search.trim()}%,ticket_no.ilike.%${search.trim()}%`);
      }

      // Dropdown Filters
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as TicketView['status']);
      }
      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter as TicketView['priority']);
      }
      if (roomFilter !== 'all') {
        query = query.eq('room_id', roomFilter);
      }
      if (damageTypeFilter !== 'all') {
        query = query.eq('damage_type_id', damageTypeFilter);
      }
      if (dateFrom) query = query.gte('reported_at', datetimeLocalToUTC(`${dateFrom}T00:00`));
      if (dateTo) query = query.lte('reported_at', datetimeLocalToUTC(`${dateTo}T23:59:59.999`));

      // Quick Pantauan Filters
      if (quickFilter === 'near_deadline') {
        query = query.eq('is_near_deadline', true);
      } else if (quickFilter === 'overdue') {
        query = query.eq('is_overdue', true);
      } else if (quickFilter === 'needs_upload') {
        query = query.eq('needs_form_upload', true);
      }

      // Default sorting: reported_at desc
      query = query.order('reported_at', { ascending: false }).range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      return {
        tickets: (data as TicketView[]) || [],
        total: count || 0,
      };
    },
  });

  const tickets = result?.tickets || [];
  const totalItems = result?.total || 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;

  const columns: Column<TicketView>[] = [
    {
      key: 'ticket_no',
      header: 'No. Tiket',
      className: 'w-36 font-mono font-medium text-blue-600',
      render: (t) => (
        <div>
          <span>{t.ticket_no}</span>
          <div className="flex items-center gap-1 mt-0.5">
            {t.is_overdue && (
              <span className="inline-flex items-center text-[10px] text-red-600 font-semibold gap-0.5" title="Melewati SLA 24 Jam">
                <AlertTriangle className="h-3 w-3" /> &gt;24j
              </span>
            )}
            {t.is_near_deadline && (
              <span className="inline-flex items-center text-[10px] text-orange-600 font-semibold gap-0.5" title="Mendekati Batas 24 Jam">
                <Clock className="h-3 w-3" /> &gt;20j
              </span>
            )}
            {t.needs_form_upload && (
              <span className="inline-flex items-center text-[10px] text-amber-600 font-medium gap-0.5" title="Formulir belum diunggah">
                <FileWarning className="h-3 w-3" /> Form
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'reported_at',
      header: 'Waktu Lapor',
      className: 'w-32 text-xs text-slate-500',
      render: (t) => formatDateTimeWIB(t.reported_at),
    },
    {
      key: 'room_name',
      header: 'Ruangan & Kendala',
      render: (t) => (
        <div className="max-w-md">
          <div className="font-semibold text-slate-900">{t.room_name}</div>
          <div className="text-xs text-slate-600 truncate mt-0.5">{t.description}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Pelapor: {t.reporter_name} • Kategori: {t.damage_type_name}
          </div>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Prioritas',
      className: 'w-24',
      render: (t) => <PriorityBadge priority={t.priority} />,
    },
    {
      key: 'status',
      header: 'Status',
      className: 'w-28',
      render: (t) => <StatusBadge status={t.status} />,
    },
    {
      key: 'assignees',
      header: 'Petugas Teknis',
      className: 'w-44 text-xs',
      render: (t) => {
        const assignees = t.assignees || [];
        if (assignees.length === 0) {
          return <span className="text-slate-400 italic">Belum ditugaskan</span>;
        }
        return (
          <div className="space-y-0.5">
            {assignees.map((a) => (
              <div key={a.user_id} className="truncate">
                {a.full_name} {a.is_lead && <span className="text-blue-600 font-bold">(Penanggung Jawab)</span>}
              </div>
            ))}
          </div>
        );
      },
    },
    {
      key: 'classification',
      header: 'Hasil',
      className: 'w-28',
      render: (t) => (
        <ClassificationBadge classification={t.classification || t.effective_classification} />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Daftar Tiket Perbaikan"
        description="Pantau seluruh laporan kerusakan sarana prasarana yang masuk dari grup WhatsApp"
        action={
          <Button type="button" onClick={() => navigate('/tiket/baru')} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Buat Tiket Baru
          </Button>
        }
      />

      {/* Quick Pantauan Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <Button
          type="button"
          size="sm"
          variant={quickFilter === 'all' ? 'primary' : 'outline'}
          onClick={() => { setQuickFilter('all'); setPage(1); }}
          className="text-xs h-7"
        >
          Semua Tiket ({totalItems})
        </Button>
        <Button
          type="button"
          size="sm"
          variant={quickFilter === 'near_deadline' ? 'primary' : 'outline'}
          onClick={() => { setQuickFilter('near_deadline'); setPage(1); }}
          className="text-xs h-7 text-orange-700 border-orange-200 hover:bg-orange-50"
        >
          <Clock className="mr-1 h-3.5 w-3.5 text-orange-600" />
          Mendekati 24 Jam
        </Button>
        <Button
          type="button"
          size="sm"
          variant={quickFilter === 'overdue' ? 'primary' : 'outline'}
          onClick={() => { setQuickFilter('overdue'); setPage(1); }}
          className="text-xs h-7 text-red-700 border-red-200 hover:bg-red-50"
        >
          <AlertTriangle className="mr-1 h-3.5 w-3.5 text-red-600" />
          Melewati 24 Jam
        </Button>
        <Button
          type="button"
          size="sm"
          variant={quickFilter === 'needs_upload' ? 'primary' : 'outline'}
          onClick={() => { setQuickFilter('needs_upload'); setPage(1); }}
          className="text-xs h-7 text-amber-700 border-amber-200 hover:bg-amber-50"
        >
          <FileWarning className="mr-1 h-3.5 w-3.5 text-amber-600" />
          Formulir Belum Diunggah
        </Button>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 mb-4 p-3 bg-slate-50/70 border border-slate-200 rounded-lg">
        {/* Search */}
        <div className="relative sm:col-span-2">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Cari no. tiket, pelapor, atau kendala..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-8 text-xs h-8 bg-white"
          />
        </div>

        {/* Status */}
        <div>
          <Select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="text-xs h-8 py-0"
          >
            <option value="all">Semua Status</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Priority */}
        <div>
          <Select
            value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
            className="text-xs h-8 py-0"
          >
            <option value="all">Semua Prioritas</option>
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Room */}
        <div>
          <Select
            value={roomFilter}
            onChange={(e) => { setRoomFilter(e.target.value); setPage(1); }}
            className="text-xs h-8 py-0"
          >
            <option value="all">Semua Ruangan</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Select
            aria-label="Filter jenis kerusakan"
            value={damageTypeFilter}
            onChange={(e) => { setDamageTypeFilter(e.target.value); setPage(1); }}
            className="text-xs h-8 py-0"
          >
            <option value="all">Semua Jenis Kerusakan</option>
            {damageTypes.map((damageType) => <option key={damageType.id} value={damageType.id}>{damageType.name}</option>)}
          </Select>
        </div>
        <div>
          <Select
            aria-label="Filter petugas"
            value={staffFilter}
            onChange={(e) => { setStaffFilter(e.target.value); setPage(1); }}
            className="text-xs h-8 py-0"
          >
            <option value="all">Semua Petugas</option>
            {technicians.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
          </Select>
        </div>
        <div>
          <Select
            aria-label="Filter klasifikasi"
            value={classificationFilter}
            onChange={(e) => { setClassificationFilter(e.target.value); setPage(1); }}
            className="text-xs h-8 py-0"
          >
            <option value="all">Semua Klasifikasi</option>
            <option value="laksana">Laksana</option>
            <option value="gagal_laksana">Gagal Laksana</option>
          </Select>
        </div>
        <label className="text-xs text-slate-500">Dari tanggal lapor<Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="mt-1 h-8 bg-white text-xs" /></label>
        <label className="text-xs text-slate-500">Sampai tanggal lapor<Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="mt-1 h-8 bg-white text-xs" /></label>
      </div>

      {error && <p role="alert" className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{mapDbError(error as { code?: string; message?: string })}</p>}
      {/* Tickets Table */}
      <DataTable
        columns={columns}
        data={tickets}
        isLoading={isLoading}
        rowKey={(t) => t.id}
        onRowClick={(t) => navigate(`/tiket/${t.id}`)}
        emptyMessage="Tidak ada tiket yang sesuai dengan filter pencarian"
      />

      {/* Pagination Controls */}
      <div className="flex items-center justify-between border-t border-slate-200 px-2 py-3 mt-4 text-xs text-slate-500">
        <div>
          Menampilkan <span className="font-semibold text-slate-800">{tickets.length}</span> dari{' '}
          <span className="font-semibold text-slate-800">{totalItems}</span> tiket
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || isLoading}
            className="h-7 px-2"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Sebelumnya
          </Button>

          <span className="px-2 font-medium">
            Hal {page} dari {totalPages}
          </span>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || isLoading}
            className="h-7 px-2"
          >
            Berikutnya
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
