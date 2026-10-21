import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from './AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Wrench, AlertCircle } from 'lucide-react';

const loginSchema = z.object({
  username: z.string().min(1, 'Username wajib diisi').trim(),
  password: z.string().min(1, 'Kata sandi wajib diisi'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await login(values.username, values.password);
      if (!result.ok) {
        setErrorMessage(result.error || 'Gagal masuk. Periksa kembali username dan kata sandi Anda.');
      } else {
        // Redirection handled by Auth route guard or navigate
        navigate('/');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Header */}
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md mb-3">
            <Wrench className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Dashboard IPSRS</h1>
          <p className="text-xs text-slate-500 mt-0.5">RS. Soeharto Heerdjan</p>
        </div>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-base text-center">Masuk ke Sistem</CardTitle>
            <CardDescription className="text-xs text-center">
              Masukkan username dan kata sandi akun Anda
            </CardDescription>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 p-2.5 text-xs text-red-700 border border-red-200 mb-4">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Username atau email
                </label>
                <Input
                  {...register('username')}
                  placeholder="admin atau email akun"
                  autoComplete="username"
                  autoFocus
                  error={errors.username?.message}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Kata Sandi
                </label>
                <Input
                  type="password"
                  {...register('password')}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  error={errors.password?.message}
                />
              </div>

              <Button
                type="submit"
                className="w-full mt-2"
                isLoading={isSubmitting}
              >
                Masuk
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-400">
                Laporan kerusakan sarana diajukan melalui grup WhatsApp. Akun sistem dikelola oleh Admin IPSRS.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
