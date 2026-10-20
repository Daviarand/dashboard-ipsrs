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
import { formatDateWIB } from '@/lib/datetime';
import { Plus, Key, PowerOff, Power, Search, Shield, Wrench, AlertCircle } from 'lucide-react';
import type { Database } from '@/types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];

export function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  // Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Reset Password Modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);

  // Toggle Confirm
  const [toggleUser, setToggleUser] = useState<Profile | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  // Fetch all profiles
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('role', { ascending: true })
        .order('full_name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Call Edge Function helper
  const invokeManageUsers = async (payload: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Sesi tidak valid. Silakan login kembali.');
    }

    const response = await supabase.functions.invoke('admin-manage-users', {
      body: payload,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (response.error) {
      throw new Error(response.error.message || 'Gagal menghubungi Edge Function');
    }

    const result = response.data;
    if (!result?.ok) {
      throw new Error(result?.error || 'Operasi gagal dilakukan');
    }

    return result;
  };

  // Create User Mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      return invokeManageUsers({
        action: 'create',
        username: newUsername.trim().toLowerCase(),
        full_name: newFullName.trim(),
        password: newPassword,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setCreateModalOpen(false);
      setNewUsername('');
      setNewFullName('');
      setNewPassword('');
      setCreateError(null);
    },
    onError: (err: Error) => {
      setCreateError(err.message);
    },
  });

  // Reset Password Mutation
  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) return;
      return invokeManageUsers({
        action: 'reset_password',
        user_id: selectedUser.id,
        new_password: resetPasswordVal,
      });
    },
    onSuccess: () => {
      setResetModalOpen(false);
      setSelectedUser(null);
      setResetPasswordVal('');
      setResetError(null);
    },
    onError: (err: Error) => {
      setResetError(err.message);
    },
  });

  // Toggle Active Mutation
  const toggleMutation = useMutation({
    mutationFn: async () => {
      if (!toggleUser) return;
      return invokeManageUsers({
        action: 'set_active',
        user_id: toggleUser.id,
        is_active: !toggleUser.is_active,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setToggleUser(null);
      setToggleError(null);
    },
    onError: (err: Error) => {
      setToggleError(err.message);
    },
  });

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return u.full_name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
  });

  const columns: Column<Profile>[] = [
    {
      key: 'full_name',
      header: 'Nama Pengguna',
      render: (u) => (
        <div>
          <span className="font-medium text-slate-900 block">{u.full_name}</span>
          <span className="text-xs text-slate-400 font-mono">@{u.username}</span>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Peran (Role)',
      className: 'w-32',
      render: (u) =>
        u.role === 'admin' ? (
          <Badge variant="blue" className="gap-1">
            <Shield className="h-3 w-3" />
            Admin
          </Badge>
        ) : (
          <Badge variant="slate" className="gap-1">
            <Wrench className="h-3 w-3" />
            Teknisi
          </Badge>
        ),
    },
    {
      key: 'is_active',
      header: 'Status',
      className: 'w-28',
      render: (u) =>
        u.is_active ? (
          <Badge variant="green">Aktif</Badge>
        ) : (
          <Badge variant="slate">Nonaktif</Badge>
        ),
    },
    {
      key: 'created_at',
      header: 'Terdaftar',
      className: 'w-32 text-xs text-slate-500',
      render: (u) => formatDateWIB(u.created_at),
    },
    {
      key: 'actions',
      header: 'Aksi',
      className: 'w-36 text-right',
      render: (u) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedUser(u);
              setResetPasswordVal('');
              setResetError(null);
              setResetModalOpen(true);
            }}
            title="Reset Kata Sandi"
            className="h-7 w-7 text-slate-500 hover:text-blue-600"
          >
            <Key className="h-3.5 w-3.5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setToggleError(null);
              setToggleUser(u);
            }}
            title={u.is_active ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
            className={`h-7 w-7 ${
              u.is_active
                ? 'text-slate-400 hover:text-red-600'
                : 'text-slate-400 hover:text-emerald-600'
            }`}
          >
            {u.is_active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Manajemen Akun Pengguna"
        description="Kelola akun tim teknis dan petugas IPSRS yang memiliki akses login sistem"
        action={
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setNewUsername('');
              setNewFullName('');
              setNewPassword('');
              setCreateError(null);
              setCreateModalOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Tambah Teknisi
          </Button>
        }
      />

      <div className="flex items-center justify-between gap-3 mb-4 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Cari nama atau username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs h-9"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredUsers}
        isLoading={isLoading}
        rowKey={(u) => u.id}
        emptyMessage="Tidak ada pengguna yang ditemukan"
      />

      {/* Create Technician Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogHeader>
          <DialogTitle>Tambah Akun Teknisi Baru</DialogTitle>
          <DialogDescription>
            Akun teknisi baru akan dibuatkan autentikasi dan langsung dapat login menggunakan username dan kata sandi ini.
          </DialogDescription>
        </DialogHeader>

        {createError && (
          <div className="flex items-center gap-2 p-2.5 mb-3 rounded-md bg-red-50 text-red-700 text-xs border border-red-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{createError}</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Nama Lengkap</label>
            <Input
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
              placeholder="Contoh: Budi Santoso"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Username</label>
            <Input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
              placeholder="Contoh: budi.s"
              required
            />
            <p className="text-[11px] text-slate-400 mt-0.5">
              3-30 karakter (huruf kecil, angka, titik, atau strip).
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Kata Sandi Awal</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
              required
              minLength={8}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateModalOpen(false)}
              disabled={createMutation.isPending}
            >
              Batal
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Simpan Akun
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Reset Password Modal */}
      <Dialog open={resetModalOpen} onOpenChange={setResetModalOpen}>
        <DialogHeader>
          <DialogTitle>Reset Kata Sandi</DialogTitle>
          <DialogDescription>
            Masukkan kata sandi baru untuk akun <strong>{selectedUser?.full_name}</strong> (@{selectedUser?.username}).
          </DialogDescription>
        </DialogHeader>

        {resetError && (
          <div className="flex items-center gap-2 p-2.5 mb-3 rounded-md bg-red-50 text-red-700 text-xs border border-red-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{resetError}</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            resetMutation.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Kata Sandi Baru</label>
            <Input
              type="password"
              value={resetPasswordVal}
              onChange={(e) => setResetPasswordVal(e.target.value)}
              placeholder="Minimal 8 karakter"
              required
              minLength={8}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setResetModalOpen(false)}
              disabled={resetMutation.isPending}
            >
              Batal
            </Button>
            <Button type="submit" isLoading={resetMutation.isPending}>
              Ubah Sandi
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Toggle Confirm Dialog */}
      {toggleUser && (
        <ConfirmDialog
          open={Boolean(toggleUser)}
          onOpenChange={(open) => !open && setToggleUser(null)}
          title={toggleUser.is_active ? 'Nonaktifkan Akun Pengguna?' : 'Aktifkan Akun Pengguna?'}
          description={
            toggleError
              ? toggleError
              : toggleUser.is_active
              ? `Pengguna "${toggleUser.full_name}" tidak akan dapat login ke sistem dan tidak dapat ditugaskan pada tiket baru.`
              : `Pengguna "${toggleUser.full_name}" akan kembali dapat login dan ditugaskan.`
          }
          confirmLabel={toggleUser.is_active ? 'Nonaktifkan' : 'Aktifkan'}
          variant={toggleUser.is_active ? 'danger' : 'primary'}
          isLoading={toggleMutation.isPending}
          onConfirm={() => toggleMutation.mutate()}
        />
      )}
    </div>
  );
}
