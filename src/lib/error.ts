/**
 * Supabase / PostgREST error shape.
 * We accept a partial shape to keep things flexible without using `any`.
 */
interface SupabaseError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * Error message mappings: [regex/substring matcher, user-facing message].
 *
 * Order matters — first match wins.
 */
const ERROR_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /Perubahan status .* tidak diperbolehkan/i,
    'Perubahan status tidak diperbolehkan.',
  ],
  [
    /Tiket selesai wajib memiliki waktu mulai/i,
    'Lengkapi waktu mulai, waktu selesai, dan status verifikasi pelapor.',
  ],
  [
    /Alasan Gagal Laksana wajib diisi/i,
    'Tiket melewati 1x24 jam. Pilih alasan Gagal Laksana.',
  ],
  [
    /Alasan pembatalan wajib diisi/i,
    'Isi alasan pembatalan.',
  ],
  [
    /Alasan membuka kembali tiket wajib diisi/i,
    'Isi alasan membuka kembali tiket.',
  ],
  [
    /Stok tidak mencukupi \(tersedia (\d+)\)/i,
    'Stok tidak mencukupi. Tersedia $1.',
  ],
  [
    /Waktu (?:lapor|selesai) tidak boleh di masa depan/i,
    'Waktu tidak boleh di masa depan.',
  ],
  [
    /Waktu mulai tidak boleh sebelum waktu lapor/i,
    'Waktu mulai tidak boleh sebelum waktu lapor.',
  ],
  [
    /Hanya petugas teknis aktif yang dapat ditugaskan/i,
    'Pilih petugas teknis yang aktif.',
  ],
  [
    /Tiket yang sudah selesai atau dibatalkan tidak dapat ditugaskan/i,
    'Tiket ini sudah ditutup, tidak bisa ditugaskan.',
  ],
  [
    /Tiket yang dibatalkan tidak dapat memiliki pemakaian material/i,
    'Tiket dibatalkan, material tidak dapat dicatat.',
  ],
  [
    /Minimal harus ada satu admin aktif/i,
    'Minimal harus ada satu admin aktif.',
  ],
  [
    /Tabel .* bersifat append-only/i,
    'Data ini tidak dapat diubah atau dihapus.',
  ],
] as const;

const FALLBACK_MESSAGE = 'Terjadi kesalahan. Coba lagi atau hubungi admin.';

/**
 * Map a Supabase/PostgREST error to a user-friendly Indonesian message.
 *
 * Checks error code first for known PostgreSQL codes, then pattern-matches
 * the error message against known database-raised messages.
 */
export function mapDbError(error: SupabaseError): string {
  const { code, message } = error;

  // Unique violation (PostgreSQL code 23505)
  if (code === '23505') {
    return 'Nama atau kode sudah digunakan.';
  }

  // Insufficient privilege (PostgreSQL code 42501) or RLS violation
  if (code === '42501') {
    return 'Anda tidak memiliki akses untuk tindakan ini.';
  }

  // Check message for RLS-related strings (PostgREST may use different phrasing)
  if (
    message &&
    /row-level security|new row violates row-level security policy/i.test(
      message
    )
  ) {
    return 'Anda tidak memiliki akses untuk tindakan ini.';
  }

  // Pattern match against known database error messages
  if (message) {
    for (const [pattern, userMessage] of ERROR_PATTERNS) {
      const match = pattern.exec(message);
      if (match) {
        // Replace capture group placeholders ($1, $2, …)
        return userMessage.replace(/\$(\d+)/g, (_, idx: string) => {
          const groupIndex = parseInt(idx, 10);
          return match[groupIndex] ?? '';
        });
      }
    }
  }

  return FALLBACK_MESSAGE;
}
