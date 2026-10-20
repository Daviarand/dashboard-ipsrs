import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { PriorityBadge } from '@/components/PriorityBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { formatDuration } from '@/lib/format';
import { formatWIB } from '@/lib/datetime';
import { REFETCH_INTERVAL } from '@/lib/constants';
import { mapDbError } from '@/lib/error';
import type { Database } from '@/types/database';

type Ticket = Database['public']['Views']['v_tickets']['Row'];

export function TaskPage() {
  const { profile } = useAuth();
  const { data: tickets = [], isLoading, error } = useQuery({
    queryKey: ['my_tasks', profile?.id],
    enabled: Boolean(profile?.id),
    refetchInterval: REFETCH_INTERVAL,
    queryFn: async () => {
      const { data: assignments, error: assignmentError } = await supabase
        .from('ticket_assignments')
        .select('ticket_id')
        .eq('user_id', profile!.id)
        .is('released_at', null);
      if (assignmentError) throw assignmentError;
      const ids = [...new Set((assignments ?? []).map((assignment) => assignment.ticket_id))];
      if (!ids.length) return [] as Ticket[];
      const { data, error: ticketError } = await supabase
        .from('v_tickets')
        .select('*')
        .in('id', ids)
        .neq('status', 'dibatalkan')
        .order('priority', { ascending: true })
        .order('reported_at', { ascending: true });
      if (ticketError) throw ticketError;
      const rank = { urgent: 0, tinggi: 1, sedang: 2, rendah: 3 };
      return ((data ?? []) as Ticket[]).sort((a, b) =>
        rank[a.priority] - rank[b.priority] ||
        new Date(a.reported_at).getTime() - new Date(b.reported_at).getTime()
      );
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Tugas Saya" description="Daftar tiket yang sedang ditugaskan kepada Anda." />
      {isLoading && <p className="text-sm text-slate-500">Memuat tugas...</p>}
      {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{mapDbError(error)}</p>}
      {!isLoading && tickets.length === 0 && <EmptyState title="Belum ada tugas aktif" description="Tiket yang ditugaskan kepada Anda akan muncul di sini." />}
      <div className="grid gap-3">
        {tickets.map((ticket) => {
          const carryOver = formatWIB(ticket.reported_at, 'yyyy-MM-dd') < formatWIB(new Date(), 'yyyy-MM-dd');
          return (
            <Card key={ticket.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link to={`/tiket/${ticket.id}`} className="font-mono text-sm font-semibold text-blue-700 hover:underline">{ticket.ticket_no}</Link>
                  <div className="flex gap-2"><PriorityBadge priority={ticket.priority} /><StatusBadge status={ticket.status} /></div>
                </div>
                <Link to={`/tiket/${ticket.id}`} className="block">
                  <h2 className="font-semibold text-slate-900">{ticket.room_name}</h2>
                  <p className="mt-1 text-sm text-slate-600">{ticket.description}</p>
                </Link>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span>{ticket.reporter_name} · Dilaporkan {formatWIB(ticket.reported_at, 'dd/MM/yyyy HH:mm')} WIB</span>
                  <div className="flex gap-2">
                    {carryOver && <span className="rounded-full bg-amber-50 px-2 py-1 font-medium text-amber-800">Tiket lanjutan</span>}
                    {ticket.elapsed_minutes !== null && <span className="rounded-full bg-slate-100 px-2 py-1">Berjalan {formatDuration(ticket.elapsed_minutes)}</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="text-center text-[11px] text-slate-400">Daftar diperbarui otomatis setiap 60 detik.</p>
    </div>
  );
}
