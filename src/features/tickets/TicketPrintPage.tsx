import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { formatDateTimeWIB } from '@/lib/datetime';
import type { Database } from '@/types/database';

type Ticket = Database['public']['Views']['v_tickets']['Row'];

export function TicketPrintPage() {
  const { id = '' } = useParams();
  const { data: ticket, isLoading, error } = useQuery({
    queryKey: ['ticket_print', id],
    queryFn: async () => {
      const { data, error: queryError } = await supabase.from('v_tickets').select('*').eq('id', id).single();
      if (queryError) throw queryError;
      return data as Ticket;
    },
  });

  if (isLoading) return <p className="text-sm text-slate-500">Memuat lembar tugas...</p>;
  if (error || !ticket) return <p role="alert" className="text-sm text-red-700">Lembar tugas tidak dapat dimuat.</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="no-print flex items-center justify-between">
        <PageHeader title="Cetak Lembar Tugas" description={ticket.ticket_no} />
        <div className="flex gap-2"><Link to={`/tiket/${id}`} className="self-center text-sm text-blue-700 hover:underline">Kembali</Link><Button type="button" onClick={() => window.print()}>Cetak</Button></div>
      </div>
      <article className="rounded border border-slate-300 bg-white p-8 text-slate-900 print:border-0 print:p-0">
        <header className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
          <div><p className="text-xs font-semibold uppercase tracking-wide">Rumah Sakit Soeharto Heerdjan</p><h1 className="mt-1 text-xl font-bold">Lembar Tugas IPSRS</h1><p className="mt-1 font-mono text-sm">{ticket.ticket_no}</p></div>
          <QRCodeSVG value={ticket.ticket_no} size={100} />
        </header>
        <dl className="my-6 grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <Entry label="Ruangan" value={ticket.room_name} />
          <Entry label="Prioritas" value={ticket.priority.toUpperCase()} />
          <Entry label="Nama Pelapor" value={ticket.reporter_name} />
          <Entry label="Waktu Lapor (WIB)" value={formatDateTimeWIB(ticket.reported_at)} />
          <Entry label="Jenis Kerusakan" value={ticket.damage_type_name} />
          <Entry label="Status" value={ticket.status.replaceAll('_', ' ')} />
          <div className="col-span-2"><Entry label="Uraian Kendala" value={ticket.description} /></div>
          <div className="col-span-2"><Entry label="Petugas Ditugaskan" value={ticket.assignees.map((person) => `${person.full_name}${person.is_lead ? ' (Penanggung Jawab)' : ''}`).join(', ') || 'Belum ditugaskan'} /></div>
        </dl>
        <div className="mt-10 grid grid-cols-2 gap-10 text-center text-sm">
          <div><p>Pelapor / Penanggung Jawab Ruangan</p><div className="mt-20 border-t border-slate-500 pt-2">Nama & tanda tangan</div></div>
          <div><p>Petugas IPSRS</p><div className="mt-20 border-t border-slate-500 pt-2">Nama & tanda tangan</div></div>
        </div>
      </article>
    </div>
  );
}

function Entry({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap">{value}</dd></div>;
}
