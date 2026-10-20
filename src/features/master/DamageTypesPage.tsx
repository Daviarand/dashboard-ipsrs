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

type DamageType = Database['public']['Tables']['damage_types']['Row'];

export function DamageTypesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DamageType | null>(null);
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmToggleItem, setConfirmToggleItem] = useState<DamageType | null>(null);

  const { data: damageTypes = [], isLoading } = useQuery({
    queryKey: ['damage_types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('damage_types')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, name }: { id?: string; name: string }) => {
      if (id) {
        const { error } = await supabase
          .from('damage_types')
          .update({ name: name.trim() })
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('damage_types')
          .insert({ name: name.trim() });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['damage_types'] });
      setModalOpen(false);
      setEditingItem(null);
      setName('');
    },
    onError: (err: unknown) => {
      setFormError(mapDbError(err as { code?: string; message?: string }));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('damage_types')
        .update({ is_active: !isActive })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['damage_types'] });
      setConfirmToggleItem(null);
    },
  });

  const handleOpenCreate = () => {
    setEditingItem(null);
    setName('');
    setFormError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: DamageType) => {
    setEditingItem(item);
    setName(item.name);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Nama jenis kerusakan tidak boleh kosong');
      return;
    }
    saveMutation.mutate({ id: editingItem?.id, name });
  };

  const filteredItems = damageTypes.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  const columns: Column<DamageType>[] = [
    {
      key: 'name',
      header: 'Jenis Kerusakan',
      render: (d) => <span className="font-medium text-slate-900">{d.name}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      className: 'w-32',
      render: (d) =>
        d.is_active ? (
          <Badge variant="green">Aktif</Badge>
        ) : (
          <Badge variant="slate">Nonaktif</Badge>
        ),
    },
    {
      key: 'actions',
      header: 'Aksi',
      className: 'w-32 text-right',
      render: (d) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => handleOpenEdit(d)}
            title="Ubah Nama"
            className="h-7 w-7 text-slate-500 hover:text-blue-600"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setConfirmToggleItem(d)}
            title={d.is_active ? 'Nonaktifkan' : 'Aktifkan'}
            className={`h-7 w-7 ${
              d.is_active
                ? 'text-slate-400 hover:text-red-600'
                : 'text-slate-400 hover:text-emerald-600'
            }`}
          >
            {d.is_active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Master Jenis Kerusakan"
        description="Daftar kategori kerusakan sarana prasarana (Listrik, Plumbing, AC, Sipil, dll.)"
        action={
          <Button type="button" onClick={handleOpenCreate} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Tambah Kategori
          </Button>
        }
      />

      <div className="flex items-center justify-between gap-3 mb-4 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Cari jenis kerusakan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs h-9"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredItems}
        isLoading={isLoading}
        rowKey={(d) => d.id}
        emptyMessage="Tidak ada jenis kerusakan yang ditemukan"
      />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogHeader>
          <DialogTitle>
            {editingItem ? 'Ubah Jenis Kerusakan' : 'Tambah Jenis Kerusakan'}
          </DialogTitle>
          <DialogDescription>
            Masukkan nama kategori kerusakan (misal: Listrik, Plumbing, AC, Sipil).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Nama Kategori</label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFormError(null);
              }}
              placeholder="Contoh: Elektrikal"
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

      {confirmToggleItem && (
        <ConfirmDialog
          open={Boolean(confirmToggleItem)}
          onOpenChange={(open) => !open && setConfirmToggleItem(null)}
          title={confirmToggleItem.is_active ? 'Nonaktifkan Kategori?' : 'Aktifkan Kategori?'}
          description={
            confirmToggleItem.is_active
              ? `Kategori "${confirmToggleItem.name}" tidak akan muncul pada pilihan input tiket baru.`
              : `Kategori "${confirmToggleItem.name}" akan kembali aktif.`
          }
          confirmLabel={confirmToggleItem.is_active ? 'Nonaktifkan' : 'Aktifkan'}
          variant={confirmToggleItem.is_active ? 'danger' : 'primary'}
          isLoading={toggleMutation.isPending}
          onConfirm={() =>
            toggleMutation.mutate({
              id: confirmToggleItem.id,
              isActive: confirmToggleItem.is_active,
            })
          }
        />
      )}
    </div>
  );
}
