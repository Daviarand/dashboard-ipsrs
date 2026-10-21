import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DIFFICULTY_OPTIONS, PRIORITY_OPTIONS } from '@/lib/labels';
import { datetimeLocalToUTC, utcToDatetimeLocal } from '@/lib/datetime';
import { mapDbError } from '@/lib/error';
import { ticketCreateSchema } from '@/features/tickets/schemas';
import { ArrowLeft, AlertTriangle, UserCheck, Star } from 'lucide-react';
import type { Database } from '@/types/database';

type Priority = Database['public']['Enums']['ticket_priority'];

export function TicketCreatePage() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  // Form states
  const [roomId, setRoomId] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reportedAtLocal, setReportedAtLocal] = useState(() =>
    utcToDatetimeLocal(new Date().toISOString())
  );
  const [damageTypeId, setDamageTypeId] = useState('');
  const [priority, setPriority] = useState<Priority>('sedang');
  const [difficulty, setDifficulty] = useState<Database['public']['Enums']['ticket_difficulty'] | ''>('');
  const [description, setDescription] = useState('');
  const [initialNote, setInitialNote] = useState('');

  // Assignees: array of { userId: string, isLead: boolean }
  const [selectedStaff, setSelectedStaff] = useState<Array<{ userId: string; isLead: boolean }>>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [partialTicket, setPartialTicket] = useState<{ id: string; ticketNo: string } | null>(null);

  // Active rooms
  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms_active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Active damage types
  const { data: damageTypes = [] } = useQuery({
    queryKey: ['damage_types_active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('damage_types')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Active technicians
  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians_active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'teknisi')
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return data || [];
    },
  });

  // FR-TKT-12: Duplicate Check
  const { data: duplicateTickets = [] } = useQuery({
    queryKey: ['duplicate_check', roomId, damageTypeId],
    enabled: Boolean(roomId && damageTypeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_tickets')
        .select('id, ticket_no, room_name, description, status, reported_at')
        .eq('room_id', roomId)
        .eq('damage_type_id', damageTypeId)
        .eq('is_running', true);
      if (error) throw error;
      return data || [];
    },
  });

  const handleToggleStaff = (userId: string) => {
    setSelectedStaff((prev) => {
      const exists = prev.find((s) => s.userId === userId);
      if (exists) {
        return prev.filter((s) => s.userId !== userId);
      } else {
        // If first selected, make it lead by default
        return [...prev, { userId, isLead: prev.length === 0 }];
      }
    });
  };

  const handleSetLead = (userId: string) => {
    setSelectedStaff((prev) =>
      prev.map((s) => ({
        ...s,
        isLead: s.userId === userId,
      }))
    );
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      setFormError(null);
      setPartialTicket(null);
      const parsed = ticketCreateSchema.safeParse({
        roomId,
        reporterName,
        reportedAt: reportedAtLocal,
        damageTypeId,
        priority,
        difficulty: difficulty || null,
        description,
        initialNote,
        selectedStaff,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Periksa kembali data tiket.');

      const reportedAtUTC = datetimeLocalToUTC(parsed.data.reportedAt);
      if (new Date(reportedAtUTC).getTime() > Date.now() + 5 * 60 * 1000) {
        throw new Error('Waktu lapor tidak boleh di masa depan.');
      }

      // 1. Insert Ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          room_id: roomId,
          reporter_name: parsed.data.reporterName,
          reported_at: reportedAtUTC,
          description: parsed.data.description,
          damage_type_id: damageTypeId,
          priority,
          difficulty: parsed.data.difficulty ?? null,
          created_by: profile?.id,
        })
        .select()
        .single();

      if (ticketError || !ticket) {
        throw ticketError || new Error('Gagal membuat tiket');
      }

      // 2. Insert Assignments if any
      if (selectedStaff.length > 0) {
        const assignmentsData = parsed.data.selectedStaff.map((s) => ({
          ticket_id: ticket.id,
          user_id: s.userId,
          is_lead: s.isLead,
          assigned_by: profile?.id,
        }));

        const { error: assignError } = await supabase
          .from('ticket_assignments')
          .insert(assignmentsData);

        if (assignError) {
          console.error('Ticket created but assignment failed:', assignError);
          setPartialTicket({ id: ticket.id, ticketNo: ticket.ticket_no });
          throw new Error('Tiket tersimpan, tetapi penugasan petugas gagal. Buka tiket ini untuk melengkapi penugasan.');
        }
      }

      // 3. Insert Initial Note if provided
      if (parsed.data.initialNote.trim()) {
        const { error: noteError } = await supabase.from('ticket_notes').insert({
          ticket_id: ticket.id,
          body: parsed.data.initialNote.trim(),
          author_id: profile?.id,
        });
        if (noteError) {
          console.error('Ticket created but initial note failed:', noteError);
          setPartialTicket({ id: ticket.id, ticketNo: ticket.ticket_no });
          throw new Error('Tiket tersimpan, tetapi catatan awal gagal disimpan. Buka tiket ini untuk melengkapi catatan.');
        }
      }

      return ticket;
    },
    onSuccess: (newTicket) => {
      navigate(`/tiket/${newTicket.id}`);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof Error && !('code' in err) ? err.message : mapDbError(err as { code?: string; message?: string }));
    },
  });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigate('/tiket')}
          className="text-xs text-slate-500 hover:text-slate-800 p-0 h-auto"
        >
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          Kembali ke Daftar Tiket
        </Button>
      </div>

      <PageHeader
        title="Buat Tiket Perbaikan Baru"
        description="Catat laporan kerusakan sarana dari ruangan untuk segera ditugaskan ke tim teknis"
      />

      {formError && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-xs text-red-700 border border-red-200 mb-4">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{formError}</span>
        </div>
      )}
      {partialTicket && (
        <p className="mb-4 text-sm text-blue-700">
          <Link to={`/tiket/${partialTicket.id}`} className="underline">
            Buka tiket {partialTicket.ticketNo} untuk melengkapi data yang belum tersimpan.
          </Link>
        </p>
      )}

      {/* Duplicate Warning Alert */}
      {duplicateTickets.length > 0 && (
        <div className="rounded-md bg-amber-50 p-3.5 text-xs text-amber-800 border border-amber-200 mb-6">
          <div className="flex items-center gap-2 font-semibold text-amber-900 mb-1">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>Peringatan Potensi Laporan Ganda (Duplikat)</span>
          </div>
          <p className="text-[11px] text-amber-700 mb-2 leading-relaxed">
            Ditemukan tiket terbuka dalam 24 jam terakhir dengan ruangan dan jenis kerusakan yang sama:
          </p>
          <ul className="space-y-1 pl-2">
            {duplicateTickets.map((d) => (
              <li key={d.id} className="text-xs font-medium">
                • <span className="font-mono text-blue-600">{d.ticket_no}</span>: "{d.description}" (Status: {d.status})
              </li>
            ))}
          </ul>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
        className="space-y-6"
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Informasi Laporan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Ruangan */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Ruangan <span className="text-red-500">*</span>
                </label>
                <Select
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  required
                >
                  <option value="">Pilih Ruangan...</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Nama Pelapor */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Pelapor <span className="text-red-500">*</span>
                </label>
                <Input
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  placeholder="Contoh: Sr. Ratna / dr. Kevin"
                  required
                />
              </div>

              {/* Waktu Lapor (WIB) */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Waktu Lapor (WIB) <span className="text-red-500">*</span>
                </label>
                <Input
                  type="datetime-local"
                  value={reportedAtLocal}
                  onChange={(e) => setReportedAtLocal(e.target.value)}
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Sesuaikan dengan jam pesan WhatsApp masuk.
                </p>
              </div>

              {/* Jenis Kerusakan */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Jenis Kerusakan <span className="text-red-500">*</span>
                </label>
                <Select
                  value={damageTypeId}
                  onChange={(e) => setDamageTypeId(e.target.value)}
                  required
                >
                  <option value="">Pilih Kategori...</option>
                  {damageTypes.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tingkat Kesulitan <span className="text-slate-400">(opsional)</span>
                </label>
                <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}>
                  <option value="">Belum ditentukan</option>
                  {DIFFICULTY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Prioritas */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tingkat Prioritas
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRIORITY_OPTIONS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value as Priority)}
                    className={`px-3 py-2 text-xs font-medium rounded-md border text-center transition-colors ${
                      priority === p.value
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Deskripsi Kendala */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Deskripsi Kerusakan / Kendala <span className="text-red-500">*</span>
              </label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Jelaskan kendala secara spesifik, misalnya: AC meneteskan air ke tempat tidur pasien kamar 201..."
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Penugasan Tim Teknis */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Penugasan Petugas Teknis (Opsional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-500">
              Pilih satu atau lebih teknisi yang akan menangani tiket ini. Tandai ikon bintang{' '}
              <Star className="inline h-3 w-3 text-amber-500" /> untuk penanggung jawab utama.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {technicians.map((t) => {
                const assigned = selectedStaff.find((s) => s.userId === t.id);
                const isLead = assigned?.isLead || false;

                return (
                  <div
                    key={t.id}
                    onClick={() => handleToggleStaff(t.id)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                      assigned
                        ? 'border-blue-500 bg-blue-50/40 text-blue-900 font-medium'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-4 w-4 rounded-sm border flex items-center justify-center ${
                          assigned ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                        }`}
                      >
                        {assigned && <UserCheck className="h-3 w-3" />}
                      </div>
                      <span>{t.full_name}</span>
                    </div>

                    {assigned && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetLead(t.id);
                        }}
                        title={isLead ? 'Penanggung Jawab Utama' : 'Jadikan Penanggung Jawab Utama'}
                        className={`p-1 rounded hover:bg-white/60 ${
                          isLead ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'
                        }`}
                      >
                        <Star className={`h-4 w-4 ${isLead ? 'fill-amber-500' : ''}`} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {technicians.length === 0 && (
              <p className="text-xs text-slate-400 italic">
                Belum ada data teknisi aktif. Tambahkan teknisi di menu Data Master → Akun Pengguna.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Catatan Awal */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Catatan Awal (Opsional)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={2}
              value={initialNote}
              onChange={(e) => setInitialNote(e.target.value)}
              placeholder="Tambahkan catatan khusus, misal: Perlu membawa tangga lipat..."
            />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/tiket')}
            disabled={createMutation.isPending}
          >
            Batal
          </Button>
          <Button type="submit" isLoading={createMutation.isPending}>
            Buat Tiket
          </Button>
        </div>
      </form>
    </div>
  );
}
