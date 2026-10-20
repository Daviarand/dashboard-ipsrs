import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { AlertCircle, Database, Key } from 'lucide-react';

export function MissingConfigPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md mb-3">
            <Database className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard IPSRS</h1>
          <p className="text-xs text-slate-500 mt-0.5">RS. Soeharto Heerdjan</p>
        </div>

        <Card className="shadow-md border-slate-200">
          <CardHeader className="bg-amber-50/60 border-b border-amber-100/60 rounded-t-lg pb-4">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
              <CardTitle className="text-base text-amber-900">Konfigurasi Belum Lengkap</CardTitle>
            </div>
            <CardDescription className="text-xs text-amber-800/80 mt-1">
              Variabel lingkungan Supabase belum diatur di file <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-mono">.env</code>.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6 space-y-4 text-xs text-slate-600">
            <p>
              Untuk menghubungkan aplikasi ke backend Supabase Cloud, silakan ikuti panduan lengkap di dokumen:
            </p>
            <div className="rounded-md bg-slate-100 p-3 font-mono text-slate-800 border border-slate-200">
              docs/SETUP_SUPABASE_CLOUD.md
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <h4 className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Key className="h-4 w-4 text-slate-500" />
                Langkah Cepat:
              </h4>
              <ol className="list-decimal list-inside space-y-1.5 pl-1 text-slate-600 leading-relaxed">
                <li>Buka Supabase Dashboard project Anda.</li>
                <li>Masuk ke <strong>Project Settings → API</strong>.</li>
                <li>Salin <strong>Project URL</strong> dan <strong>anon public key</strong>.</li>
                <li>Buka file <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">.env</code> di root project dan isi:</li>
              </ol>

              <pre className="mt-2 rounded bg-slate-900 p-3 text-[11px] text-slate-100 overflow-x-auto font-mono">
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1...`}
              </pre>
            </div>

            <div className="pt-2 text-center">
              <p className="text-[11px] text-slate-400">
                Setelah mengisi file <code className="font-mono">.env</code>, muat ulang (refresh) halaman ini.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
