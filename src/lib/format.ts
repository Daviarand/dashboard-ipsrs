/**
 * Format a duration in minutes as "X jam Y menit".
 *
 * - null or 0 → "–"
 * - < 60 → "Y menit"
 * - exactly divisible by 60 → "X jam"
 * - otherwise → "X jam Y menit"
 */
export function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === 0) {
    return '–';
  }

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  if (hours === 0) {
    return `${remaining} menit`;
  }

  if (remaining === 0) {
    return `${hours} jam`;
  }

  return `${hours} jam ${remaining} menit`;
}

/**
 * Format a number using Indonesian locale (id-ID).
 *
 * Examples:
 *   1000    → "1.000"
 *   1500.5  → "1.500,5"
 */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('id-ID').format(n);
}
