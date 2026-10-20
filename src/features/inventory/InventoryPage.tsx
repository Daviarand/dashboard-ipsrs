import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useAuth } from '@/features/auth/AuthContext';
import { mapDbError } from '@/lib/error';
import { formatDateTimeWIB } from '@/lib/datetime';
import { getMovementTypeLabel } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type Material = Database['public']['Tables']['materials']['Row'];
type MovementType = Database['public']['Enums']['stock_movement_type'];

const materialSchema = z.object({
  code: z.string().trim().min(1, 'Kode wajib diisi'),
  name: z.string().trim().min(1, 'Nama material wajib diisi'),
  category: z.string(),
  unit: z.string().trim().min(1, 'Satuan wajib diisi'),
  minStock: z.coerce.number().min(0, 'Stok minimum tidak boleh negatif'),
});

export function InventoryPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isTechnician = profile?.role === 'teknisi';
  const [showInactive, setShowInactive] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [materialForm, setMaterialForm] = useState({ code: '', name: '', category: '', unit: '', minStock: '0' });
  const [materialError, setMaterialError] = useState('');
  const [movementMaterial, setMovementMaterial] = useState('');
  const [movementType, setMovementType] = useState<MovementType>('masuk');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [movementError, setMovementError] = useState('');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');

  const materialsQuery = useQuery({
    queryKey: ['materials', showInactive],
    queryFn: async () => {
      let query = supabase.from('v_materials').select('*').order('name');
      if (!showInactive) query = query.eq('is_active', true);
      const { data, error } = await query;
      if (error) throw error;
      return data as Material[];
    },
  });

  const movementQuery = useQuery({
    queryKey: ['stock_movements', historyFrom, historyTo],
    queryFn: async () => {
      let query = supabase.from('stock_movements')
        .select('id, material_id, type, qty_change, ticket_id, note, created_by, created_at, materials(name, code)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (historyFrom) query = query.gte('created_at', `${historyFrom}T00:00:00+07:00`);
      if (historyTo) query = query.lte('created_at', `${historyTo}T23:59:59.999+07:00`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const createMaterial = useMutation({
    mutationFn: async () => {
      const parsed = materialSchema.safeParse({
        ...materialForm,
        minStock: materialForm.minStock,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Periksa data material.');
      const values = {
        code: parsed.data.code,
        name: parsed.data.name,
        category: parsed.data.category.trim() || null,
        unit: parsed.data.unit,
        min_stock: parsed.data.minStock,
      };
      const { error } = editingMaterialId
        ? await supabase.from('materials').update(values).eq('id', editingMaterialId)
        : await supabase.from('materials').insert(values);
      if (error) throw error;
    },
    onSuccess: async () => {
      setEditingMaterialId(null);
      setMaterialForm({ code: '', name: '', category: '', unit: '', minStock: '0' });
      setMaterialError('');
      await queryClient.invalidateQueries({ queryKey: ['materials'] });
    },
    onError: (error: unknown) => setMaterialError(error instanceof Error && !('code' in error) ? error.message : mapDbError(error as { code?: string; message?: string })),
  });

  const toggleMaterialActive = useMutation({
    mutationFn: async (material: Material) => {
      const { error } = await supabase.from('materials')
        .update({ is_active: !material.is_active })
        .eq('id', material.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['materials'] });
    },
    onError: (error: unknown) => setMaterialError(mapDbError(error as { code?: string; message?: string })),
  });

  const recordMovement = useMutation({
    mutationFn: async () => {
      const qty = Number(quantity);
      if (!movementMaterial) throw new Error('Pilih material terlebih dahulu.');
      if (!Number.isFinite(qty) || qty === 0 || (movementType !== 'koreksi' && qty < 0)) {
        throw new Error(movementType === 'koreksi' ? 'Jumlah koreksi tidak boleh nol.' : 'Jumlah harus lebih dari 0.');
      }
      if (movementType === 'koreksi' && !note.trim()) throw new Error('Alasan koreksi wajib diisi.');
      const signedQty = movementType === 'keluar' ? -Math.abs(qty) : movementType === 'masuk' ? Math.abs(qty) : qty;
      const { error } = await supabase.from('stock_movements').insert({
        material_id: movementMaterial,
        type: movementType,
        qty_change: signedQty,
        note: note.trim() || null,
        created_by: profile?.id,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setQuantity('');
      setNote('');
      setMovementError('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['materials'] }),
        queryClient.invalidateQueries({ queryKey: ['stock_movements'] }),
      ]);
    },
    onError: (error: unknown) => setMovementError(error instanceof Error && !('code' in error) ? error.message : mapDbError(error as { code?: string; message?: string })),
  });

  const materialRows = useMemo(() => materialsQuery.data ?? [], [materialsQuery.data]);

  return (
    <div className="space-y-5">
      <PageHeader title="Persediaan Material" description="Pantau stok dan catat mutasi material." />
      {(materialsQuery.error || movementQuery.error) && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{mapDbError((materialsQuery.error ?? movementQuery.error) as { code?: string; message?: string })}</p>}
      <section className="grid gap-4 xl:grid-cols-2">
        {isTechnician && <Card>
          <CardHeader><CardTitle className="text-base">{editingMaterialId ? 'Ubah Material' : 'Tambah Material'}</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); setMaterialError(''); createMaterial.mutate(); }}>
              <Field label="Kode"><Input required value={materialForm.code} onChange={(e) => setMaterialForm({ ...materialForm, code: e.target.value })} /></Field>
              <Field label="Nama"><Input required value={materialForm.name} onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })} /></Field>
              <Field label="Kategori"><Input value={materialForm.category} onChange={(e) => setMaterialForm({ ...materialForm, category: e.target.value })} /></Field>
              <Field label="Satuan"><Input required value={materialForm.unit} onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })} /></Field>
              <Field label="Stok minimum"><Input type="number" min="0" step="0.01" value={materialForm.minStock} onChange={(e) => setMaterialForm({ ...materialForm, minStock: e.target.value })} /></Field>
              <div className="flex items-end gap-2"><Button type="submit" isLoading={createMaterial.isPending}>Simpan Material</Button>{editingMaterialId && <Button type="button" variant="outline" onClick={() => { setEditingMaterialId(null); setMaterialForm({ code: '', name: '', category: '', unit: '', minStock: '0' }); }}>Batal</Button>}</div>
            </form>
            {materialError && <p role="alert" className="mt-3 text-sm text-red-700">{materialError}</p>}
          </CardContent>
        </Card>}
        {isTechnician && <Card>
          <CardHeader><CardTitle className="text-base">Catat Mutasi Stok</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); setMovementError(''); recordMovement.mutate(); }}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Material"><Select required value={movementMaterial} onChange={(e) => setMovementMaterial(e.target.value)}><option value="">Pilih material</option>{materialRows.filter((material) => material.is_active).map((material) => <option key={material.id} value={material.id}>{material.code} · {material.name}</option>)}</Select></Field>
                <Field label="Jenis mutasi"><Select value={movementType} onChange={(e) => setMovementType(e.target.value as MovementType)}><option value="masuk">Stok Masuk</option><option value="keluar">Stok Keluar</option><option value="koreksi">Koreksi</option></Select></Field>
                <Field label={movementType === 'koreksi' ? 'Jumlah koreksi (negatif untuk mengurangi)' : 'Jumlah'}><Input required type="number" min={movementType === 'koreksi' ? undefined : '0.01'} step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field>
                <Field label={movementType === 'koreksi' ? 'Alasan koreksi (wajib)' : 'Catatan (opsional)'}><Input required={movementType === 'koreksi'} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
              </div>
              {movementError && <p role="alert" className="text-sm text-red-700">{movementError}</p>}
              <Button type="submit" isLoading={recordMovement.isPending}>Simpan Mutasi</Button>
            </form>
          </CardContent>
        </Card>}
      </section>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Daftar Material</CardTitle>
          <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Tampilkan nonaktif</label>
        </CardHeader>
        <CardContent>
          {materialsQuery.isLoading ? <p className="text-sm text-slate-500">Memuat material...</p> : materialRows.length === 0 ? <EmptyState title="Belum ada material" /> : (
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500"><tr><th className="py-2 pr-4">Kode</th><th className="py-2 pr-4">Material</th><th className="py-2 pr-4">Stok</th><th className="py-2 pr-4">Minimum</th><th className="py-2">Status</th>{isTechnician && <th className="py-2">Aksi</th>}</tr></thead>
              <tbody className="divide-y divide-slate-100">{materialRows.map((material) => <tr key={material.id}>
                <td className="py-3 pr-4 font-mono text-xs">{material.code}</td><td className="py-3 pr-4">{material.name}<div className="text-xs text-slate-500">{material.category ?? 'Tanpa kategori'}</div></td>
                <td className={`py-3 pr-4 font-medium ${material.current_stock <= material.min_stock ? 'text-red-700' : ''}`}>{material.current_stock} {material.unit}</td><td className="py-3 pr-4">{material.min_stock} {material.unit}</td>
                <td className="py-3">{!material.is_active ? <span className="text-slate-500">Nonaktif</span> : material.current_stock <= material.min_stock ? <span className="rounded-full bg-red-50 px-2 py-1 text-xs text-red-700">Stok rendah</span> : <span className="text-xs text-emerald-700">Tersedia</span>}</td>
                {isTechnician && <td className="py-3"><div className="flex gap-1"><Button type="button" size="sm" variant="outline" onClick={() => { setEditingMaterialId(material.id); setMaterialForm({ code: material.code, name: material.name, category: material.category ?? '', unit: material.unit, minStock: String(material.min_stock) }); }}>Ubah</Button><Button type="button" size="sm" variant="ghost" isLoading={toggleMaterialActive.isPending} onClick={() => toggleMaterialActive.mutate(material)}>{material.is_active ? 'Nonaktifkan' : 'Aktifkan'}</Button></div></td>}
              </tr>)}</tbody>
            </table></div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Riwayat Mutasi</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3"><Field label="Dari tanggal"><Input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} /></Field><Field label="Sampai tanggal"><Input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} /></Field></div>
          {movementQuery.isLoading ? <p className="text-sm text-slate-500">Memuat mutasi...</p> : (movementQuery.data?.length ?? 0) === 0 ? <EmptyState title="Belum ada mutasi stok" /> : (
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs text-slate-500"><tr><th className="py-2 pr-4">Waktu</th><th className="py-2 pr-4">Material</th><th className="py-2 pr-4">Jenis</th><th className="py-2 pr-4">Jumlah</th><th className="py-2">Catatan</th></tr></thead><tbody className="divide-y divide-slate-100">
              {movementQuery.data?.map((movement) => <tr key={movement.id}><td className="whitespace-nowrap py-2 pr-4 text-xs text-slate-500">{formatDateTimeWIB(movement.created_at)}</td><td className="py-2 pr-4">{movement.materials?.name ?? movement.material_id}</td><td className="py-2 pr-4">{getMovementTypeLabel(movement.type)}</td><td className="py-2 pr-4">{movement.qty_change}</td><td className="py-2">{movement.note ?? '—'}</td></tr>)}
            </tbody></table></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1 text-xs font-medium text-slate-700">{label}{children}</label>;
}
