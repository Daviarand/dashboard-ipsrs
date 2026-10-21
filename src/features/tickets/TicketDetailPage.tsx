import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { FileUploader } from '@/components/FileUploader';
import { PageHeader } from '@/components/PageHeader';
import { PriorityBadge } from '@/components/PriorityBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/features/auth/AuthContext';
import { datetimeLocalToUTC, formatDateTimeWIB, utcToDatetimeLocal } from '@/lib/datetime';
import { previewClassification } from '@/lib/classification';
import { mapDbError } from '@/lib/error';
import { DIFFICULTY_OPTIONS, getDifficultyLabel } from '@/lib/labels';
import { SIGNED_URL_EXPIRY } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import type { Database, Json } from '@/types/database';
import { ticketFinishSchema } from '@/features/tickets/schemas';
import { ticketEditSchema } from '@/features/tickets/schemas';

type Ticket = Database['public']['Views']['v_tickets']['Row'];
type Status = Database['public']['Enums']['ticket_status'];
const transitions: Partial<Record<Status, Status[]>> = {
  baru: ['dibatalkan'],
  ditugaskan: ['dikerjakan', 'menunggu_material', 'dibatalkan'],
  dikerjakan: ['menunggu_material'],
  menunggu_material: ['dikerjakan'],
};

export function TicketDetailPage() {
  const { id = '' } = useParams();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === 'admin';
  const [note, setNote] = useState('');
  const [newStatus, setNewStatus] = useState<Status | ''>('');
  const [statusNote, setStatusNote] = useState('');
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');
  const [startedAt, setStartedAt] = useState(() => utcToDatetimeLocal(new Date().toISOString()));
  const [finishedAt, setFinishedAt] = useState(() => utcToDatetimeLocal(new Date().toISOString()));
  const [workDone, setWorkDone] = useState('');
  const [reporterVerified, setReporterVerified] = useState(false);
  const [verifierName, setVerifierName] = useState('');
  const [failureReasonId, setFailureReasonId] = useState('');
  const [failureNote, setFailureNote] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [materialRows, setMaterialRows] = useState<Array<{ materialId: string; qty: string }>>([]);
  const [finishMaterialRows, setFinishMaterialRows] = useState<Array<{ materialId: string; qty: string }>>([]);
  const [file, setFile] = useState<File | null>(null);
  const [assignUser, setAssignUser] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    roomId: '',
    reporterName: '',
    reportedAt: '',
    damageTypeId: '',
    priority: 'sedang' as Database['public']['Enums']['ticket_priority'],
    difficulty: null as Database['public']['Enums']['ticket_difficulty'] | null,
    description: '',
  });

  const ticketQuery = useQuery({
    queryKey: ['ticket', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('v_tickets').select('*').eq('id', id).single();
      if (error) throw error;
      return data as Ticket;
    },
  });
  const ticket = ticketQuery.data;

  const notesQuery = useQuery({
    queryKey: ['ticket_notes', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('ticket_notes').select('id, author_id, body, created_at').eq('ticket_id', id).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const assignmentQuery = useQuery({
    queryKey: ['ticket_assignments', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('ticket_assignments').select('id, user_id, is_lead, assigned_at, released_at, profiles(full_name, username)').eq('ticket_id', id).order('assigned_at');
      if (error) throw error;
      return data ?? [];
    },
  });
  const historyQuery = useQuery({
    queryKey: ['ticket_status_history', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('ticket_status_history').select('id, from_status, to_status, changed_by, changed_at').eq('ticket_id', id).order('changed_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const materialsQuery = useQuery({
    queryKey: ['ticket_materials', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('stock_movements').select('id, material_id, qty_change, note, created_at, materials(name, unit)').eq('ticket_id', id).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const attachmentQuery = useQuery({
    queryKey: ['ticket_attachments', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('ticket_attachments').select('*').eq('ticket_id', id).order('created_at', { ascending: false });
      if (error) throw error;
      const signed = await Promise.all((data ?? []).map(async (attachment) => {
        const { data: urlData, error: urlError } = await supabase.storage.from('ticket-forms').createSignedUrl(attachment.storage_path, SIGNED_URL_EXPIRY);
        if (urlError) throw urlError;
        return { ...attachment, signedUrl: urlData.signedUrl };
      }));
      return signed;
    },
  });
  const masterQuery = useQuery({
    queryKey: ['ticket_form_options'],
    queryFn: async () => {
      const [technicians, materials, reasons, setting, rooms, damageTypes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, username').eq('role', 'teknisi').eq('is_active', true).order('full_name'),
        supabase.from('materials').select('id, name, unit, current_stock').eq('is_active', true).order('name'),
        supabase.from('failure_reasons').select('id, name').eq('is_active', true).order('name'),
        supabase.from('app_settings').select('value').eq('key', 'sla_hours').single(),
        supabase.from('rooms').select('id, name, is_active').order('name'),
        supabase.from('damage_types').select('id, name, is_active').order('name'),
      ]);
      const failed = [technicians, materials, reasons, setting, rooms, damageTypes].find((result) => result.error);
      if (failed?.error) throw failed.error;
      return {
        technicians: technicians.data ?? [],
        materials: materials.data ?? [],
        reasons: reasons.data ?? [],
        sla: Number(setting.data?.value ?? 24),
        rooms: rooms.data ?? [],
        damageTypes: damageTypes.data ?? [],
      };
    },
  });

  const invalidateTicket = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['ticket', id] }),
      queryClient.invalidateQueries({ queryKey: ['ticket_notes', id] }),
      queryClient.invalidateQueries({ queryKey: ['ticket_assignments', id] }),
      queryClient.invalidateQueries({ queryKey: ['ticket_status_history', id] }),
      queryClient.invalidateQueries({ queryKey: ['ticket_materials', id] }),
      queryClient.invalidateQueries({ queryKey: ['ticket_attachments', id] }),
      queryClient.invalidateQueries({ queryKey: ['tickets_list'] }),
    ]);
  };

  const addNote = useMutation({
    mutationFn: async () => {
      if (!note.trim()) throw new Error('Catatan wajib diisi.');
      const { error } = await supabase.from('ticket_notes').insert({ ticket_id: id, body: note.trim(), author_id: profile?.id });
      if (error) throw error;
    },
    onSuccess: async () => { setNote(''); setSuccess('Catatan berhasil ditambahkan.'); await invalidateTicket(); },
    onError: (error: unknown) => setActionError(getErrorMessage(error)),
  });
  const updateTicket = useMutation({
    mutationFn: async () => {
      if (!ticket) throw new Error('Tiket tidak ditemukan.');
      const parsed = ticketEditSchema.safeParse(editForm);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Periksa kembali data tiket.');
      const reportedAtUtc = datetimeLocalToUTC(parsed.data.reportedAt);
      if (new Date(reportedAtUtc).getTime() > Date.now() + 5 * 60 * 1000) {
        throw new Error('Waktu lapor tidak boleh di masa depan.');
      }
      const { data, error } = await supabase.from('tickets')
        .update({
          room_id: parsed.data.roomId,
          reporter_name: parsed.data.reporterName,
          reported_at: reportedAtUtc,
          damage_type_id: parsed.data.damageTypeId,
          priority: parsed.data.priority,
          difficulty: parsed.data.difficulty ?? null,
          description: parsed.data.description,
        })
        .eq('id', id)
        .eq('updated_at', ticket.updated_at)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Tiket telah diubah pengguna lain. Muat ulang halaman sebelum menyimpan perubahan.');
    },
    onSuccess: async () => { setIsEditing(false); setSuccess('Data tiket berhasil diperbarui.'); await invalidateTicket(); },
    onError: (error: unknown) => setActionError(getErrorMessage(error)),
  });
  const changeStatus = useMutation({
    mutationFn: async () => {
      if (!newStatus) throw new Error('Pilih status tujuan.');
      const { error } = await supabase.rpc('rpc_change_status', { p_ticket_id: id, p_new_status: newStatus, p_note: statusNote || null });
      if (error) throw error;
    },
    onSuccess: async () => { setNewStatus(''); setStatusNote(''); setSuccess('Status tiket berhasil diperbarui.'); await invalidateTicket(); },
    onError: (error: unknown) => setActionError(getErrorMessage(error)),
  });
  const addAssignment = useMutation({
    mutationFn: async () => {
      if (!assignUser) throw new Error('Pilih teknisi.');
      const { data: currentLeads, error: leadError } = await supabase.from('ticket_assignments')
        .select('id')
        .eq('ticket_id', id)
        .eq('is_lead', true)
        .is('released_at', null);
      if (leadError) throw leadError;
      const { error } = await supabase.from('ticket_assignments').insert({
        ticket_id: id,
        user_id: assignUser,
        assigned_by: profile?.id,
        is_lead: (currentLeads?.length ?? 0) === 0,
      });
      if (error) throw error;
    },
    onSuccess: async () => { setAssignUser(''); setSuccess('Teknisi berhasil ditugaskan.'); await invalidateTicket(); },
    onError: (error: unknown) => setActionError(getErrorMessage(error)),
  });
  const setLead = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error: clearError } = await supabase.from('ticket_assignments')
        .update({ is_lead: false })
        .eq('ticket_id', id)
        .is('released_at', null);
      if (clearError) throw clearError;
      const { error } = await supabase.from('ticket_assignments')
        .update({ is_lead: true })
        .eq('id', assignmentId)
        .eq('ticket_id', id)
        .is('released_at', null);
      if (error) throw error;
    },
    onSuccess: invalidateTicket,
    onError: (error: unknown) => setActionError(getErrorMessage(error)),
  });
  const releaseAssignment = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase.from('ticket_assignments').update({ released_at: new Date().toISOString() }).eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: invalidateTicket,
    onError: (error: unknown) => setActionError(getErrorMessage(error)),
  });
  const useMaterial = useMutation({
    mutationFn: async (values: { materialId: string; qty: string }) => {
      const amount = Number(values.qty);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Jumlah material harus lebih dari 0.');
      const { error } = await supabase.from('stock_movements').insert({
        material_id: values.materialId,
        type: 'keluar',
        qty_change: -amount,
        ticket_id: id,
        note: 'Pemakaian pada tiket',
        created_by: profile?.id,
      });
      if (error) throw error;
    },
    onSuccess: async () => { setSuccess('Pemakaian material berhasil dicatat.'); await invalidateTicket(); await queryClient.invalidateQueries({ queryKey: ['materials'] }); },
    onError: (error: unknown) => setActionError(getErrorMessage(error)),
  });
  const finishTicket = useMutation({
    mutationFn: async () => {
      if (!ticket) throw new Error('Tiket tidak ditemukan.');
      const parsed = ticketFinishSchema.safeParse({ startedAt, finishedAt, workDone, reporterVerified, verifierName });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Lengkapi formulir penyelesaian.');
      if (reporterVerified && !verifierName.trim()) throw new Error('Nama penandatangan wajib diisi.');
      const startedUtc = datetimeLocalToUTC(startedAt);
      const finishedUtc = datetimeLocalToUTC(finishedAt);
      if (new Date(startedUtc) < new Date(ticket.reported_at)) throw new Error('Waktu mulai tidak boleh sebelum waktu lapor.');
      if (new Date(finishedUtc) < new Date(startedUtc)) throw new Error('Waktu selesai tidak boleh sebelum waktu mulai.');
      const durationMs = new Date(finishedUtc).getTime() - new Date(ticket.reported_at).getTime();
      const isFailure = durationMs > (masterQuery.data?.sla ?? 24) * 60 * 60 * 1000;
      if (isFailure && !failureReasonId) throw new Error('Pilih alasan Gagal Laksana.');
      const newMaterials = finishMaterialRows.filter((row) => row.materialId && row.qty).map((row) => ({ material_id: row.materialId, qty: Number(row.qty) }));
      const { error } = await supabase.rpc('rpc_finish_ticket', {
        p_ticket_id: id,
        p_started_at: startedUtc,
        p_finished_at: finishedUtc,
        p_work_done: workDone.trim(),
        p_reporter_verified: reporterVerified,
        p_verifier_name: verifierName.trim() || '',
        p_failure_reason_id: isFailure ? failureReasonId : null,
        p_failure_reason_note: isFailure ? failureNote.trim() || null : null,
        p_vendor_name: isFailure ? vendorName.trim() || null : null,
        p_materials: newMaterials as Json,
      });
      if (error) throw error;
      return newMaterials.length;
    },
    onSuccess: async (newCount) => {
      setSuccess(`Tiket berhasil diselesaikan${newCount ? ` beserta ${newCount} baris pemakaian material` : ''}. Berkas formulir dapat diunggah di bawah.`);
      await invalidateTicket();
      await queryClient.invalidateQueries({ queryKey: ['materials'] });
    },
    onError: (error: unknown) => setActionError(getErrorMessage(error)),
  });
  const reopenTicket = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('rpc_reopen_ticket', { p_ticket_id: id, p_reason: reopenReason });
      if (error) throw error;
    },
    onSuccess: async () => { setReopenReason(''); setSuccess('Tiket dibuka kembali.'); await invalidateTicket(); },
    onError: (error: unknown) => setActionError(getErrorMessage(error)),
  });
  const uploadFile = useMutation({
    mutationFn: async () => {
      if (!ticket || !file) throw new Error('Pilih berkas formulir terlebih dahulu.');
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('ticket-forms').upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { error: rowError } = await supabase.from('ticket_attachments').insert({
        ticket_id: id,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_by: profile?.id,
      });
      if (rowError) {
        const { error: cleanupError } = await supabase.storage.from('ticket-forms').remove([path]);
        if (cleanupError) console.error('Failed to remove orphaned ticket form:', cleanupError);
        throw rowError;
      }
    },
    onSuccess: async () => { setFile(null); setSuccess('Berkas formulir berhasil diunggah.'); await invalidateTicket(); },
    onError: (error: unknown) => setActionError(getErrorMessage(error)),
  });
  const deleteAttachment = useMutation({
    mutationFn: async (attachment: { id: string; storage_path: string }) => {
      const { error: storageError } = await supabase.storage.from('ticket-forms').remove([attachment.storage_path]);
      if (storageError) throw storageError;
      const { error } = await supabase.from('ticket_attachments').delete().eq('id', attachment.id);
      if (error) throw error;
    },
    onSuccess: invalidateTicket,
    onError: (error: unknown) => setActionError(getErrorMessage(error)),
  });

  if (ticketQuery.isLoading) return <p className="text-sm text-slate-500">Memuat tiket...</p>;
  if (ticketQuery.error || !ticket) return <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{ticketQuery.error ? getErrorMessage(ticketQuery.error) : 'Tiket tidak ditemukan atau Anda tidak memiliki akses.'}</p>;

  const expectedClassification = previewClassification(
    ticket.reported_at,
    finishedAt ? datetimeLocalToUTC(finishedAt) : new Date(),
    masterQuery.data?.sla ?? 24,
  ) === 'laksana' ? 'Laksana' : 'Gagal Laksana';

  return (
    <div className="space-y-5">
      <PageHeader title={ticket.ticket_no} description={`${ticket.room_name} · ${ticket.damage_type_name}`} />
      {[notesQuery.error, assignmentQuery.error, historyQuery.error, materialsQuery.error, attachmentQuery.error, masterQuery.error]
        .filter(Boolean)
        .map((queryError, index) => <p key={index} role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{getErrorMessage(queryError)}</p>)}
      <div className="flex flex-wrap items-center gap-2"><PriorityBadge priority={ticket.priority} /><StatusBadge status={ticket.status} />{ticket.effective_classification && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{ticket.effective_classification === 'laksana' ? 'Laksana' : 'Gagal Laksana'}</span>}<Link to={`/tiket/${id}/cetak`} className="ml-auto text-sm text-blue-700 hover:underline">Cetak lembar tugas</Link></div>
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Informasi tiket</CardTitle>{isAdmin && <Button type="button" variant="outline" size="sm" onClick={() => { setEditForm({ roomId: ticket.room_id, reporterName: ticket.reporter_name, reportedAt: utcToDatetimeLocal(ticket.reported_at), damageTypeId: ticket.damage_type_id, priority: ticket.priority, difficulty: ticket.difficulty, description: ticket.description }); setIsEditing((current) => !current); }}>Ubah Data</Button>}</CardHeader><CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <Info label="Pelapor" value={ticket.reporter_name} /><Info label="Waktu lapor" value={`${formatDateTimeWIB(ticket.reported_at)} WIB`} /><Info label="Jenis kerusakan" value={ticket.damage_type_name} /><Info label="Tingkat kesulitan" value={ticket.difficulty ? getDifficultyLabel(ticket.difficulty) : 'Belum ditentukan'} /><Info label="Dibuat" value={`${formatDateTimeWIB(ticket.input_at)} WIB`} />
            <div className="sm:col-span-2"><Info label="Kendala" value={ticket.description} /></div>
            {ticket.work_done && <div className="sm:col-span-2"><Info label="Tindakan" value={ticket.work_done} /></div>}
          </CardContent></Card>
          {isEditing && isAdmin && <Card><CardHeader><CardTitle className="text-base">Ubah Data Tiket</CardTitle></CardHeader><CardContent>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); setActionError(''); updateTicket.mutate(); }}>
              <label className="space-y-1 text-xs">Ruangan<Select value={editForm.roomId} onChange={(event) => setEditForm({ ...editForm, roomId: event.target.value })}>{masterQuery.data?.rooms.filter((room) => room.is_active || room.id === ticket.room_id).map((room) => <option key={room.id} value={room.id}>{room.name}{room.is_active ? '' : ' (nonaktif)'}</option>)}</Select></label>
              <label className="space-y-1 text-xs">Nama pelapor<Input value={editForm.reporterName} onChange={(event) => setEditForm({ ...editForm, reporterName: event.target.value })} /></label>
              <label className="space-y-1 text-xs">Waktu lapor (WIB)<Input type="datetime-local" value={editForm.reportedAt} onChange={(event) => setEditForm({ ...editForm, reportedAt: event.target.value })} /></label>
              <label className="space-y-1 text-xs">Jenis kerusakan<Select value={editForm.damageTypeId} onChange={(event) => setEditForm({ ...editForm, damageTypeId: event.target.value })}>{masterQuery.data?.damageTypes.filter((item) => item.is_active || item.id === ticket.damage_type_id).map((item) => <option key={item.id} value={item.id}>{item.name}{item.is_active ? '' : ' (nonaktif)'}</option>)}</Select></label>
              <label className="space-y-1 text-xs">Prioritas<Select value={editForm.priority} onChange={(event) => setEditForm({ ...editForm, priority: event.target.value as Ticket['priority'] })}><option value="urgent">Urgent</option><option value="tinggi">Tinggi</option><option value="sedang">Sedang</option><option value="rendah">Rendah</option></Select></label>
              <label className="space-y-1 text-xs">Tingkat kesulitan (opsional)<Select value={editForm.difficulty ?? ''} onChange={(event) => setEditForm({ ...editForm, difficulty: event.target.value ? event.target.value as NonNullable<Ticket['difficulty']> : null })}><option value="">Belum ditentukan</option>{DIFFICULTY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></label>
              <label className="space-y-1 text-xs sm:col-span-2">Kendala<Textarea rows={3} value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} /></label>
              <div className="flex gap-2 sm:col-span-2"><Button type="submit" isLoading={updateTicket.isPending}>Simpan Perubahan</Button><Button type="button" variant="outline" onClick={() => setIsEditing(false)}>Batal</Button></div>
            </form>
          </CardContent></Card>}

          <Card><CardHeader><CardTitle className="text-base">Catatan tiket</CardTitle></CardHeader><CardContent className="space-y-4">
            <form onSubmit={(event) => { event.preventDefault(); setActionError(''); addNote.mutate(); }} className="space-y-2"><label htmlFor="ticket-note" className="text-xs font-medium">Tambah catatan</label><Textarea id="ticket-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Tuliskan perkembangan atau kendala..." /><Button size="sm" type="submit" isLoading={addNote.isPending}>Simpan Catatan</Button></form>
            <div className="divide-y divide-slate-100">{(notesQuery.data ?? []).map((item) => <div key={item.id} className="py-3"><p className="whitespace-pre-wrap text-sm text-slate-700">{item.body}</p><p className="mt-1 text-[11px] text-slate-400">{formatDateTimeWIB(item.created_at)} WIB · {item.author_id === profile?.id ? 'Anda' : item.author_id.slice(0, 8)}</p></div>)}{(notesQuery.data ?? []).length === 0 && <p className="text-sm text-slate-500">Belum ada catatan.</p>}</div>
          </CardContent></Card>

          <Card><CardHeader><CardTitle className="text-base">Riwayat status</CardTitle></CardHeader><CardContent><ol className="space-y-3">{(historyQuery.data ?? []).map((item) => <li key={item.id} className="border-l-2 border-blue-200 pl-3 text-sm"><p>{item.from_status ? `${item.from_status} → ` : ''}{item.to_status}</p><p className="text-xs text-slate-500">{formatDateTimeWIB(item.changed_at)} WIB</p></li>)}</ol></CardContent></Card>

          <Card><CardHeader><CardTitle className="text-base">Pemakaian material tercatat</CardTitle></CardHeader><CardContent className="space-y-3">
            {(materialsQuery.data ?? []).length === 0 ? <p className="text-sm text-slate-500">Belum ada pemakaian material.</p> : <ul className="divide-y divide-slate-100">{materialsQuery.data?.map((movement) => <li key={movement.id} className="flex justify-between py-2 text-sm"><span>{movement.materials?.name ?? movement.material_id}</span><span>{Math.abs(movement.qty_change)} {movement.materials?.unit}</span></li>)}</ul>}
            {!isAdmin && ticket.status !== 'selesai' && ticket.status !== 'dibatalkan' && <div className="space-y-2 border-t border-slate-100 pt-3"><p className="text-xs font-medium">Catat pemakaian baru</p>{materialRows.map((row, index) => <div key={index} className="flex gap-2"><Select value={row.materialId} onChange={(event) => setMaterialRows((current) => current.map((entry, i) => i === index ? { ...entry, materialId: event.target.value } : entry))}><option value="">Pilih material</option>{masterQuery.data?.materials.map((material) => <option key={material.id} value={material.id}>{material.name} · stok {material.current_stock} {material.unit}</option>)}</Select><Input aria-label="Jumlah material" type="number" min="0.01" step="0.01" value={row.qty} onChange={(event) => setMaterialRows((current) => current.map((entry, i) => i === index ? { ...entry, qty: event.target.value } : entry))} /><Button type="button" variant="outline" onClick={() => useMaterial.mutate(row)}>Catat</Button><Button type="button" variant="ghost" onClick={() => setMaterialRows((current) => current.filter((_, i) => i !== index))}>Hapus</Button></div>)}<Button type="button" variant="outline" size="sm" onClick={() => setMaterialRows((current) => [...current, { materialId: '', qty: '' }])}>Tambah Baris</Button></div>}
          </CardContent></Card>

          <Card><CardHeader><CardTitle className="text-base">Berkas formulir</CardTitle></CardHeader><CardContent className="space-y-3">
            {isAdmin && <><FileUploader onFileReady={setFile} /><Button type="button" disabled={!file} isLoading={uploadFile.isPending} onClick={() => uploadFile.mutate()}>Unggah Berkas</Button></>}
            {(attachmentQuery.data ?? []).map((attachment) => <div key={attachment.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 py-2 text-sm"><a href={attachment.signedUrl} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">{attachment.file_name}</a><span className="text-xs text-slate-500">{(attachment.size_bytes / 1024 / 1024).toFixed(2)} MB</span>{isAdmin && <Button type="button" variant="outline" size="sm" onClick={() => deleteAttachment.mutate(attachment)}>Hapus</Button>}</div>)}
            {(attachmentQuery.data ?? []).length === 0 && <p className="text-sm text-slate-500">Belum ada berkas. Tiket dapat tetap selesai tanpa berkas.</p>}
          </CardContent></Card>
        </div>
        <aside className="space-y-4">
          <Card><CardHeader><CardTitle className="text-base">Petugas</CardTitle></CardHeader><CardContent className="space-y-3">
            {(assignmentQuery.data ?? []).map((assignment) => <div key={assignment.id} className="flex items-center justify-between gap-2 text-sm"><span>{assignment.profiles?.full_name ?? assignment.user_id}{assignment.is_lead && <span className="ml-1 text-xs text-blue-700">(penanggung jawab)</span>}{assignment.released_at && <span className="ml-1 text-xs text-slate-400">(dilepas)</span>}</span>{isAdmin && !assignment.released_at && <div className="flex">{!assignment.is_lead && <Button type="button" variant="ghost" size="sm" onClick={() => setLead.mutate(assignment.id)}>Jadikan utama</Button>}{ticket.status !== 'selesai' && ticket.status !== 'dibatalkan' && <Button type="button" variant="ghost" size="sm" onClick={() => releaseAssignment.mutate(assignment.id)}>Lepas</Button>}</div>}</div>)}
            {isAdmin && ticket.status !== 'selesai' && ticket.status !== 'dibatalkan' && <form className="flex gap-2 border-t border-slate-100 pt-3" onSubmit={(event) => { event.preventDefault(); addAssignment.mutate(); }}><Select value={assignUser} onChange={(event) => setAssignUser(event.target.value)}><option value="">Pilih teknisi</option>{masterQuery.data?.technicians.filter((person) => !assignmentQuery.data?.some((assigned) => assigned.user_id === person.id && !assigned.released_at)).map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</Select><Button type="submit" size="sm" isLoading={addAssignment.isPending}>Tambah</Button></form>}
          </CardContent></Card>

          {isAdmin && <Card><CardHeader><CardTitle className="text-base">Ubah status</CardTitle></CardHeader><CardContent className="space-y-2">
            {ticket.status === 'selesai' ? <><Input aria-label="Alasan membuka kembali" value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} placeholder="Alasan membuka kembali" /><Button type="button" onClick={() => reopenTicket.mutate()} isLoading={reopenTicket.isPending}>Buka Kembali</Button></> : ticket.status !== 'dibatalkan' && <>
              <Select value={newStatus} onChange={(event) => setNewStatus(event.target.value as Status | '')}><option value="">Pilih status baru</option>{(transitions[ticket.status] ?? []).map((status) => <option key={status} value={status}>{status}</option>)}</Select>
              <Input value={statusNote} onChange={(event) => setStatusNote(event.target.value)} placeholder={newStatus === 'dibatalkan' ? 'Alasan pembatalan wajib' : 'Catatan (opsional)'} />
              <Button type="button" disabled={!newStatus} onClick={() => changeStatus.mutate()} isLoading={changeStatus.isPending}>Simpan Status</Button>
            </>}
          </CardContent></Card>}

          {isAdmin && ['ditugaskan', 'dikerjakan', 'menunggu_material'].includes(ticket.status) && <Card><CardHeader><CardTitle className="text-base">Formulir selesai</CardTitle></CardHeader><CardContent>
            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); setActionError(''); finishTicket.mutate(); }}>
              <label className="block space-y-1 text-xs">Waktu mulai<Input type="datetime-local" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} /></label>
              <label className="block space-y-1 text-xs">Waktu selesai<Input type="datetime-local" value={finishedAt} onChange={(event) => setFinishedAt(event.target.value)} /></label>
              <label className="block space-y-1 text-xs">Tindakan<Textarea required value={workDone} onChange={(event) => setWorkDone(event.target.value)} rows={3} /></label>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={reporterVerified} onChange={(event) => setReporterVerified(event.target.checked)} /> Sudah diverifikasi/ditandatangani pelapor</label>
              <label className="block space-y-1 text-xs">Nama penandatangan<Input value={verifierName} onChange={(event) => setVerifierName(event.target.value)} /></label>
              <p className="rounded bg-slate-50 p-2 text-xs">Pratinjau klasifikasi: <strong>{expectedClassification}</strong></p>
              {expectedClassification === 'Gagal Laksana' && <>
                <label className="block space-y-1 text-xs">Alasan Gagal Laksana<Select required value={failureReasonId} onChange={(event) => setFailureReasonId(event.target.value)}><option value="">Pilih alasan</option>{masterQuery.data?.reasons.map((reason) => <option key={reason.id} value={reason.id}>{reason.name}</option>)}</Select></label>
                <label className="block space-y-1 text-xs">Keterangan tambahan<Input value={failureNote} onChange={(event) => setFailureNote(event.target.value)} /></label>
                <label className="block space-y-1 text-xs">Nama vendor (opsional)<Input value={vendorName} onChange={(event) => setVendorName(event.target.value)} /></label>
              </>}
              <div className="space-y-2 border-t border-slate-100 pt-3"><p className="text-xs font-medium">Pemakaian baru (opsional)</p>{finishMaterialRows.map((row, index) => <div key={index} className="flex gap-2"><Select value={row.materialId} onChange={(event) => setFinishMaterialRows((current) => current.map((entry, i) => i === index ? { ...entry, materialId: event.target.value } : entry))}><option value="">Pilih material</option>{masterQuery.data?.materials.map((material) => <option key={material.id} value={material.id}>{material.name} · {material.current_stock} {material.unit}</option>)}</Select><Input aria-label="Jumlah material baru" type="number" min="0.01" step="0.01" value={row.qty} onChange={(event) => setFinishMaterialRows((current) => current.map((entry, i) => i === index ? { ...entry, qty: event.target.value } : entry))} /></div>)}<Button type="button" size="sm" variant="outline" onClick={() => setFinishMaterialRows((current) => [...current, { materialId: '', qty: '' }])}>Tambah Material</Button></div>
              <Button type="submit" className="w-full" isLoading={finishTicket.isPending}>Selesaikan Tiket</Button>
            </form>
          </CardContent></Card>}
          <Card><CardHeader><CardTitle className="text-base">Lembar cetak</CardTitle></CardHeader><CardContent className="flex flex-col items-center gap-3"><QRCodeSVG value={ticket.ticket_no} size={128} /><p className="font-mono text-xs">{ticket.ticket_no}</p><Link to={`/tiket/${id}/cetak`} className="text-sm text-blue-700 hover:underline">Buka halaman cetak</Link></CardContent></Card>
        </aside>
      </div>
      {actionError && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}
      {success && <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 whitespace-pre-wrap">{value}</p></div>;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return mapDbError(error as { code?: string; message: string });
  }
  return error instanceof Error ? error.message : 'Terjadi kesalahan. Coba lagi.';
}
