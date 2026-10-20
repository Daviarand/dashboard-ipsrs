import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ClipboardList, Clock3, FileWarning, Gauge, Wrench } from 'lucide-react';
import { DateRangeFilter, type DateRangeValue } from '@/components/DateRangeFilter';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { formatWIB, getDatePresets } from '@/lib/datetime';
import { formatDuration } from '@/lib/format';
import { mapDbError } from '@/lib/error';
import type { Database } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Summary = Database['public']['Functions']['rpc_dashboard_summary']['Returns'][number];
type Ticket = Database['public']['Views']['v_tickets']['Row'];

const monthRange = getDatePresets().find((preset) => preset.key === 'bulan_ini')!.getRange();

export function DashboardPage() {
  const [exportError, setExportError] = useState('');
  const [range, setRange] = useState<DateRangeValue>({
    from: formatWIB(monthRange.from, 'yyyy-MM-dd'),
    to: formatWIB(monthRange.to, 'yyyy-MM-dd'),
    basis: 'reported',
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', range],
    queryFn: async () => {
      const args = { p_from: range.from, p_to: range.to, p_basis: range.basis };
      const [summary, rooms, staff, materials, duration, damage, trend, classification] =
        await Promise.all([
          supabase.rpc('rpc_dashboard_summary', args),
          supabase.rpc('rpc_rooms_recap', args),
          supabase.rpc('rpc_staff_recap', args),
          supabase.rpc('rpc_materials_recap', args),
          supabase.rpc('rpc_duration_recap', args),
          supabase.rpc('rpc_damage_recap', args),
          supabase.rpc('rpc_damage_trend', args),
          supabase.rpc('rpc_laksana_recap', args),
        ]);
      const failed = [summary, rooms, staff, materials, duration, damage, trend, classification]
        .find((result) => result.error);
      if (failed?.error) throw failed.error;
      return {
        summary: summary.data?.[0] ?? null,
        rooms: rooms.data ?? [],
        staff: staff.data ?? [],
        materials: materials.data ?? [],
        duration: duration.data ?? [],
        damage: damage.data ?? [],
        trend: trend.data ?? [],
        classification: classification.data ?? [],
      };
    },
  });

  const monitoring = useQuery({
    queryKey: ['dashboard_monitoring'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data: tickets, error: queryError } = await supabase
        .from('v_tickets')
        .select('*')
        .eq('is_running', true)
        .order('reported_at', { ascending: true });
      if (queryError) throw queryError;
      return (tickets ?? []) as Ticket[];
    },
  });

  const stat = data?.summary as Summary | null | undefined;
  const attention = monitoring.data ?? [];
  const pendingForms = useQuery({
    queryKey: ['dashboard_pending_forms'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data: tickets, error: queryError } = await supabase
        .from('v_tickets')
        .select('id, ticket_no, room_name, reported_at')
        .eq('needs_form_upload', true)
        .order('finished_at', { ascending: false })
        .limit(10);
      if (queryError) throw queryError;
      return tickets ?? [];
    },
  });

  const exportSheets = () => {
    if (!data || !stat) return null;
    return [
      {
        name: 'Ringkasan',
        rows: [{
          'Tanggal mulai': range.from,
          'Tanggal akhir': range.to,
          'Acuan tanggal': range.basis === 'reported' ? 'Tanggal lapor' : 'Tanggal selesai',
          'Total tiket': stat.total,
          'Tiket berjalan': stat.running,
          'Tiket selesai': stat.finished,
          Laksana: stat.laksana,
          'Laksana (%)': stat.laksana_pct,
          'Gagal Laksana': stat.gagal_laksana,
          'Rata-rata durasi (menit)': stat.avg_duration_minutes,
          'Median durasi (menit)': stat.median_duration_minutes,
        }],
      },
      { name: 'Ruangan', rows: data.rooms.map((row) => ({ Ruangan: row.room_name, Total: row.total, Berjalan: row.running, Selesai: row.finished })) },
      { name: 'Petugas', rows: data.staff.map((row) => ({ Petugas: row.full_name, Total: row.total, Selesai: row.finished, 'Rata-rata durasi (menit)': row.avg_duration_minutes })) },
      { name: 'Material', rows: data.materials.map((row) => ({ Kode: row.code, Material: row.name, 'Terpakai': row.used_qty, Satuan: row.unit, 'Jumlah tiket': row.ticket_count, 'Stok saat ini': row.current_stock, 'Stok minimum': row.min_stock })) },
      { name: 'Durasi', rows: data.duration.map((row) => ({ Kelompok: row.group_type === 'priority' ? 'Prioritas' : 'Jenis kerusakan', Nama: row.group_name, 'Jumlah tiket': row.ticket_count, 'Rata-rata (menit)': row.avg_minutes, 'Median (menit)': row.median_minutes })) },
      { name: 'Kerusakan', rows: data.damage.map((row) => ({ 'Jenis kerusakan': row.damage_type_name, Total: row.total })) },
      { name: 'Tren bulanan', rows: data.trend.map((row) => ({ Bulan: formatWIB(row.month, 'yyyy-MM'), 'Jenis kerusakan': row.damage_type_name, Total: row.total })) },
      { name: 'Klasifikasi', rows: data.classification.map((row) => ({ Klasifikasi: row.classification === 'laksana' ? 'Laksana' : 'Gagal Laksana', Alasan: row.failure_reason_name, Total: row.total })) },
    ] satisfies { name: string; rows: Record<string, string | number | null>[] }[];
  };

  const exportExcel = async () => {
    try {
      const sheets = exportSheets();
      if (!sheets) return;
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      for (const sheet of sheets) {
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheet.rows), sheet.name);
      }
      XLSX.writeFile(workbook, `rekap-ipsrs-${range.from}-${range.to}.xlsx`);
    } catch (exportFailure) {
      setExportError(exportFailure instanceof Error ? exportFailure.message : 'Ekspor Excel gagal. Silakan coba lagi.');
    }
  };

  const exportPdf = async () => {
    try {
      const sheets = exportSheets();
      if (!sheets) return;
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const contentWidth = pdf.internal.pageSize.getWidth() - 28;
      let y = 16;
      pdf.setFontSize(15);
      pdf.text('Rekap Kinerja IPSRS', 14, y);
      y += 8;
      pdf.setFontSize(9);
      pdf.text(`Periode ${range.from} s.d. ${range.to} · Acuan ${range.basis === 'reported' ? 'tanggal lapor' : 'tanggal selesai'}`, 14, y);
      y += 8;
      for (const sheet of sheets) {
        if (y > pageHeight - 16) {
          pdf.addPage();
          y = 16;
        }
        pdf.setFontSize(11);
        pdf.text(sheet.name, 14, y);
        y += 6;
        pdf.setFontSize(8);
        const lines = sheet.rows.length
          ? sheet.rows.map((row) => Object.entries(row).map(([key, value]) => `${key}: ${value ?? '-'}`).join(' | '))
          : ['Tidak ada data'];
        for (const line of lines) {
          const wrapped = pdf.splitTextToSize(line, contentWidth) as string[];
          if (y + wrapped.length * 4 > pageHeight - 12) {
            pdf.addPage();
            y = 16;
          }
          pdf.text(wrapped, 14, y);
          y += wrapped.length * 4 + 2;
        }
        y += 3;
      }
      pdf.save(`rekap-ipsrs-${range.from}-${range.to}.pdf`);
    } catch (exportFailure) {
      setExportError(exportFailure instanceof Error ? exportFailure.message : 'Ekspor PDF gagal. Silakan coba lagi.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Ringkasan kinerja dan pantauan tiket IPSRS."
        action={
          <>
          <Button type="button" variant="outline" disabled={!data || !stat} onClick={() => { setExportError(''); void exportExcel(); }}>Ekspor Excel</Button>
          <Button type="button" variant="outline" disabled={!data || !stat} onClick={() => { setExportError(''); void exportPdf(); }}>Ekspor PDF</Button>
          </>
        }
      />
      {exportError && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{exportError}</p>}
      <DateRangeFilter value={range} onChange={setRange} />

      {isLoading && <p className="text-sm text-slate-500">Memuat rekap...</p>}
      {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{mapDbError(error)}</p>}

      {stat && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Total tiket" value={stat.total} icon={<ClipboardList />} />
          <SummaryCard label="Tiket berjalan" value={stat.running} icon={<Wrench />} />
          <SummaryCard label="Tiket selesai" value={stat.finished} icon={<Gauge />} />
          <SummaryCard label="Laksana" value={`${stat.laksana_pct ?? 0}%`} detail={`${stat.laksana} tiket`} icon={<Clock3 />} />
          <SummaryCard label="Gagal Laksana" value={stat.gagal_laksana} icon={<AlertTriangle />} />
          <SummaryCard label="Rata-rata durasi" value={formatDuration(stat.avg_duration_minutes)} />
          <SummaryCard label="Median durasi" value={formatDuration(stat.median_duration_minutes)} />
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-2">
        <RecapCard title="Permintaan per ruangan">
          <RecapTable rows={data?.rooms.slice(0, 10) ?? []} name={(row) => row.room_name} count={(row) => row.total} to={(row) => `/tiket?room_id=${row.room_id}`} />
          {(data?.rooms.length ?? 0) > 0 && <div className="mt-4 h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.rooms.slice(0, 10)} layout="vertical" margin={{ left: 12, right: 16 }}><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="room_name" width={120} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="total" name="Tiket" fill="#2563eb" isAnimationActive={false} /></BarChart></ResponsiveContainer></div>}
        </RecapCard>
        <RecapCard title="Petugas yang menangani">
          <RecapTable rows={data?.staff ?? []} name={(row) => row.full_name} count={(row) => row.total} to={(row) => `/tiket?staff_id=${row.user_id}`} />
        </RecapCard>
        <RecapCard title="Material terpakai">
          <RecapTable rows={data?.materials ?? []} name={(row) => `${row.name} (${row.code})`} count={(row) => `${row.used_qty} ${row.unit}`} to={() => '/persediaan'} />
        </RecapCard>
        <RecapCard title="Durasi perbaikan">
          <RecapTable rows={data?.duration ?? []} name={(row) => `${row.group_type === 'priority' ? 'Prioritas' : 'Jenis'}: ${row.group_name}`} count={(row) => formatDuration(row.avg_minutes)} to={(row) => row.group_type === 'priority' ? `/tiket?priority=${row.group_name}` : `/tiket?damage_type_id=${data?.damage.find((item) => item.damage_type_name === row.group_name)?.damage_type_id ?? ''}`} />
        </RecapCard>
        <RecapCard title="10 ruangan teratas">
          <RecapTable rows={data?.rooms.slice(0, 10) ?? []} name={(row) => row.room_name} count={(row) => row.total} to={(row) => `/tiket?room_id=${row.room_id}`} />
        </RecapCard>
        <RecapCard title="Jenis kerusakan berulang">
          <RecapTable rows={data?.damage ?? []} name={(row) => row.damage_type_name} count={(row) => row.total} to={(row) => `/tiket?damage_type_id=${row.damage_type_id}`} />
          {(data?.damage.length ?? 0) > 0 && <div className="mt-4 h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.damage.slice(0, 8)}><XAxis dataKey="damage_type_name" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="total" name="Tiket" fill="#2563eb" isAnimationActive={false} /></BarChart></ResponsiveContainer></div>}
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs font-semibold text-slate-600">Tren bulanan</p>
            <RecapTable rows={data?.trend ?? []} name={(row) => `${row.damage_type_name} · ${formatWIB(row.month, 'MMM yyyy')}`} count={(row) => row.total} />
          </div>
        </RecapCard>
        <RecapCard title="Laksana dan Gagal Laksana">
          <RecapTable rows={data?.classification ?? []} name={(row) => `${row.classification === 'laksana' ? 'Laksana' : 'Gagal Laksana'}${row.failure_reason_name ? ` · ${row.failure_reason_name}` : ''}`} count={(row) => row.total} to={(row) => `/tiket?classification=${row.classification}`} />
          {(data?.classification.length ?? 0) > 0 && <div className="mx-auto mt-2 h-48 max-w-xs"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data?.classification} dataKey="total" nameKey="classification" outerRadius={72} isAnimationActive={false}>{data?.classification.map((entry, index) => <Cell key={`${entry.classification}-${entry.failure_reason_name ?? index}`} fill={entry.classification === 'laksana' ? '#16a34a' : '#dc2626'} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>}
        </RecapCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <RecapCard title="Pantauan tiket berjalan" subtitle="Tidak terikat rentang tanggal. Diperbarui setiap 60 detik.">
          {attention.length === 0 ? <EmptyState title="Tidak ada tiket berjalan" /> : (
            <ul className="divide-y divide-slate-100">
              {attention.map((ticket) => (
                <li key={ticket.id} className="flex items-center justify-between gap-3 py-3">
                  <Link to={`/tiket/${ticket.id}`} className="min-w-0">
                    <span className="font-mono text-sm font-semibold text-blue-700">{ticket.ticket_no}</span>
                    <span className="ml-2 text-sm text-slate-800">{ticket.room_name}</span>
                    <p className="truncate text-xs text-slate-500">{ticket.description}</p>
                  </Link>
                  <div className="shrink-0 text-right text-xs">
                    {formatWIB(ticket.reported_at, 'yyyy-MM-dd') < formatWIB(new Date(), 'yyyy-MM-dd') && <p className="mb-1 text-slate-600">Tiket lanjutan</p>}
                    {ticket.is_overdue ? <span className="text-red-700">Melewati SLA</span> : ticket.is_near_deadline ? <span className="text-amber-700">Mendekati SLA</span> : null}
                    {ticket.reported_at && <p className="mt-1 text-slate-500">{formatWIB(ticket.reported_at, 'dd/MM HH:mm')}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </RecapCard>
        <RecapCard title="Formulir belum diunggah">
          {pendingForms.isError && <p role="alert" className="text-sm text-red-700">{mapDbError(pendingForms.error)}</p>}
          {(pendingForms.data ?? []).length === 0 ? <EmptyState title="Semua formulir sudah diunggah" /> : (
            <ul className="divide-y divide-slate-100">
              {pendingForms.data?.map((ticket) => (
                <li key={ticket.id} className="flex items-center gap-2 py-3">
                  <FileWarning className="h-4 w-4 shrink-0 text-amber-600" />
                  <Link to={`/tiket/${ticket.id}`} className="text-sm text-blue-700 hover:underline">
                    {ticket.ticket_no} · {ticket.room_name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </RecapCard>
      </section>
    </div>
  );
}

function SummaryCard({ label, value, detail, icon }: { label: string; value: string | number; detail?: string; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-4">
        <div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>{detail && <p className="text-xs text-slate-500">{detail}</p>}</div>
        {icon && <span className="text-blue-600">{icon}</span>}
      </CardContent>
    </Card>
  );
}

function RecapCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle>{subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}</CardHeader><CardContent>{children}</CardContent></Card>;
}

function RecapTable<T>({ rows, name, count, to }: { rows: T[]; name: (row: T) => string; count: (row: T) => string | number; to?: (row: T) => string }) {
  if (!rows.length) return <EmptyState title="Belum ada data pada rentang ini" />;
  return <div className="divide-y divide-slate-100">{rows.map((row, index) => <div key={index} className="flex justify-between gap-3 py-2 text-sm"><span className="text-slate-700">{to ? <Link to={to(row)} className="hover:text-blue-700 hover:underline">{name(row)}</Link> : name(row)}</span><span className="shrink-0 font-medium text-slate-900">{count(row)}</span></div>)}</div>;
}
