import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { formatDateTimeWIB } from '@/lib/datetime';
import { mapDbError } from '@/lib/error';
import { ITEMS_PER_PAGE } from '@/lib/constants';

export function ActivityLogPage() {
  const [page, setPage] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userId, setUserId] = useState('all');
  const [entity, setEntity] = useState('');
  const users = useQuery({
    queryKey: ['activity_log_users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, username, full_name').order('full_name');
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data, isLoading, error } = useQuery({
    queryKey: ['activity_logs', page, dateFrom, dateTo, userId, entity],
    queryFn: async () => {
      const from = page * ITEMS_PER_PAGE;
      let query = supabase
        .from('activity_logs')
        .select('id, user_id, action, entity, entity_id, old_data, new_data, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, from + ITEMS_PER_PAGE - 1);
      if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00+07:00`);
      if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59.999+07:00`);
      if (userId !== 'all') query = query.eq('user_id', userId);
      if (entity.trim()) query = query.ilike('entity', `%${entity.trim()}%`);
      const { data: rows, error: queryError, count } = await query;
      if (queryError) throw queryError;
      return { rows: rows ?? [], count: count ?? 0 };
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Log Aktivitas" description="Riwayat perubahan data yang tercatat di sistem." />
      <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 text-xs text-slate-600">Dari tanggal<Input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(0); }} /></label>
        <label className="space-y-1 text-xs text-slate-600">Sampai tanggal<Input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(0); }} /></label>
        <label className="space-y-1 text-xs text-slate-600">Pengguna<Select value={userId} onChange={(event) => { setUserId(event.target.value); setPage(0); }}><option value="all">Semua pengguna</option>{users.data?.map((user) => <option key={user.id} value={user.id}>{user.full_name} (@{user.username})</option>)}</Select></label>
        <label className="space-y-1 text-xs text-slate-600">Entitas<Input value={entity} onChange={(event) => { setEntity(event.target.value); setPage(0); }} placeholder="Contoh: tickets" /></label>
      </div>
      {isLoading && <p className="text-sm text-slate-500">Memuat log aktivitas...</p>}
      {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{mapDbError(error)}</p>}
      {users.error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{mapDbError(users.error)}</p>}
      {(data?.rows.length ?? 0) === 0 && !isLoading ? <EmptyState title="Belum ada aktivitas" /> : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Waktu</th><th className="px-3 py-2">Pengguna</th><th className="px-3 py-2">Aksi</th><th className="px-3 py-2">Entitas</th><th className="px-3 py-2">Perubahan</th></tr></thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {data?.rows.map((log) => <tr key={log.id} className="align-top">
                <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{formatDateTimeWIB(log.created_at)}</td>
                <td className="px-3 py-3 font-mono text-xs">{log.user_id?.slice(0, 8) ?? 'Sistem'}</td>
                <td className="px-3 py-3">{log.action}</td>
                <td className="px-3 py-3">{log.entity}<div className="font-mono text-[11px] text-slate-400">{log.entity_id}</div></td>
                <td className="max-w-lg px-3 py-3"><details><summary className="cursor-pointer text-xs text-blue-700">Lihat nilai lama/baru</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-[10px]">{JSON.stringify({ lama: log.old_data, baru: log.new_data }, null, 2)}</pre></details></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Sebelumnya</Button>
        <span className="text-xs text-slate-500">Halaman {page + 1} · {data?.count ?? 0} aktivitas</span>
        <Button variant="outline" size="sm" disabled={!data || (page + 1) * ITEMS_PER_PAGE >= data.count} onClick={() => setPage((value) => value + 1)}>Berikutnya</Button>
      </div>
      {error && <span className="sr-only">{mapDbError(error)}</span>}
    </div>
  );
}
