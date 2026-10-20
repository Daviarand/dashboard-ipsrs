import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/features/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

const passwordSchema = z.object({
  password: z.string().min(8, 'Kata sandi minimal 8 karakter'),
  confirmPassword: z.string(),
}).refine((values) => values.password === values.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Konfirmasi kata sandi tidak sama',
});
type PasswordForm = z.infer<typeof passwordSchema>;

export function ProfilePage() {
  const { profile } = useAuth();
  const [success, setSuccess] = useState('');
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const onSubmit = async ({ password }: PasswordForm) => {
    setSuccess('');
    setServerError('');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setServerError('Kata sandi belum berhasil diperbarui. Silakan coba kembali.');
      console.error('Password update failed:', error);
      return;
    }
    reset();
    setSuccess('Kata sandi berhasil diperbarui.');
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Profil & Kata Sandi" description="Perbarui kata sandi akun Anda." />
      <Card className="max-w-xl">
        <CardHeader><CardTitle className="text-base">Informasi akun</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 text-sm"><dt className="text-slate-500">Nama</dt><dd>{profile?.full_name}</dd><dt className="text-slate-500">Username</dt><dd>{profile?.username}</dd><dt className="text-slate-500">Peran</dt><dd>{profile?.role === 'admin' ? 'Admin-Koordinator' : 'Tim Teknis-Logistik'}</dd></dl>
          <hr className="border-slate-100" />
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div><label htmlFor="new-password" className="mb-1 block text-sm font-medium">Kata sandi baru</label><Input id="new-password" type="password" autoComplete="new-password" {...register('password')} error={errors.password?.message} /></div>
            <div><label htmlFor="confirm-password" className="mb-1 block text-sm font-medium">Ulangi kata sandi baru</label><Input id="confirm-password" type="password" autoComplete="new-password" {...register('confirmPassword')} error={errors.confirmPassword?.message} /></div>
            {success && <p role="status" className="text-sm text-emerald-700">{success}</p>}
            {serverError && <p role="alert" className="text-sm text-red-700">{serverError}</p>}
            <Button type="submit" isLoading={isSubmitting}>Simpan kata sandi</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
