import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { mapDbError } from '@/lib/error';
import { Plus, Edit2, PowerOff, Power, Search } from 'lucide-react';
import type { Database } from '@/types/database';

type Room = Database['public']['Tables']['rooms']['Row'];

export function RoomsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomName, setRoomName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmToggleRoom, setConfirmToggleRoom] = useState<Room | null>(null);

  // Fetch Rooms
  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Create / Update Mutation
  const saveMutation = useMutation({
    mutationFn: async ({ id, name }: { id?: string; name: string }) => {
      if (id) {
        const { error } = await supabase
          .from('rooms')
          .update({ name: name.trim() })
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('rooms')
          .insert({ name: name.trim() });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setModalOpen(false);
      setEditingRoom(null);
      setRoomName('');
    },
    onError: (err: unknown) => {
      setFormError(mapDbError(err as { code?: string; message?: string }));
    },
  });

  // Toggle Active Mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('rooms')
        .update({ is_active: !isActive })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setConfirmToggleRoom(null);
    },
  });

  const handleOpenCreate = () => {
    setEditingRoom(null);
    setRoomName('');
    setFormError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (room: Room) => {
    setEditingRoom(room);
    setRoomName(room.name);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) {
      setFormError('Nama ruangan tidak boleh kosong');
      return;
    }
    saveMutation.mutate({ id: editingRoom?.id, name: roomName });
  };

  const filteredRooms = rooms.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = showActiveOnly ? r.is_active : true;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<Room>[] = [
    {
      key: 'name',
      header: 'Nama Ruangan',
      render: (r) => <span className="font-medium text-slate-900">{r.name}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      className: 'w-32',
      render: (r) =>
        r.is_active ? (
          <Badge variant="green">Aktif</Badge>
        ) : (
          <Badge variant="slate">Nonaktif</Badge>
        ),
    },
    {
      key: 'actions',
      header: 'Aksi',
      className: 'w-32 text-right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenEdit(r);
            }}
            title="Ubah Nama"
            className="h-7 w-7 text-slate-500 hover:text-blue-600"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmToggleRoom(r);
            }}
            title={r.is_active ? 'Nonaktifkan' : 'Aktifkan'}
            className={`h-7 w-7 ${
              r.is_active
                ? 'text-slate-400 hover:text-red-600'
                : 'text-slate-400 hover:text-emerald-600'
            }`}
          >
            {r.is_active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Master Ruangan"
        description="Kelola daftar ruangan rumah sakit untuk pelaporan tiket perbaikan"
        action={
          <Button type="button" onClick={handleOpenCreate} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Tambah Ruangan
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Cari nama ruangan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs h-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={showActiveOnly ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setShowActiveOnly(!showActiveOnly)}
            className="text-xs h-9"
          >
            {showActiveOnly ? 'Hanya Aktif' : 'Semua Status'}
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredRooms}
        isLoading={isLoading}
        rowKey={(r) => r.id}
        emptyMessage="Tidak ada ruangan yang ditemukan"
      />

      {/* Add / Edit Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogHeader>
          <DialogTitle>{editingRoom ? 'Ubah Ruangan' : 'Tambah Ruangan Baru'}</DialogTitle>
          <DialogDescription>
            {editingRoom
              ? 'Perubahan nama akan otomatis terhubung ke seluruh riwayat tiket ruangan ini.'
              : 'Masukkan nama ruangan yang unik.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Nama Ruangan</label>
            <Input
              value={roomName}
              onChange={(e) => {
                setRoomName(e.target.value);
                setFormError(null);
              }}
              placeholder="Contoh: Ruang Rawat Inap Melati"
              autoFocus
              error={formError || undefined}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={saveMutation.isPending}
            >
              Batal
            </Button>
            <Button type="submit" isLoading={saveMutation.isPending}>
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Toggle Confirm Dialog */}
      {confirmToggleRoom && (
        <ConfirmDialog
          open={Boolean(confirmToggleRoom)}
          onOpenChange={(open) => !open && setConfirmToggleRoom(null)}
          title={confirmToggleRoom.is_active ? 'Nonaktifkan Ruangan?' : 'Aktifkan Ruangan?'}
          description={
            confirmToggleRoom.is_active
              ? `Ruangan "${confirmToggleRoom.name}" tidak akan muncul pada pilihan input tiket baru, namun riwayat tiket lama tetap tersimpan utuh.`
              : `Ruangan "${confirmToggleRoom.name}" akan kembali muncul pada pilihan input tiket.`
          }
          confirmLabel={confirmToggleRoom.is_active ? 'Nonaktifkan' : 'Aktifkan'}
          variant={confirmToggleRoom.is_active ? 'danger' : 'primary'}
          isLoading={toggleMutation.isPending}
          onConfirm={() =>
            toggleMutation.mutate({
              id: confirmToggleRoom.id,
              isActive: confirmToggleRoom.is_active,
            })
          }
        />
      )}
    </div>
  );
}
