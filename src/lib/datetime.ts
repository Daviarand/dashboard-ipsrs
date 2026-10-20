import { format } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

/** WIB timezone identifier */
export const WIB_TIMEZONE = 'Asia/Jakarta';

/**
 * Convert a UTC date to WIB (Asia/Jakarta) zoned time.
 */
export function toWIB(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  return toZonedTime(d, WIB_TIMEZONE);
}

/**
 * Format a UTC date in WIB timezone using the given format string.
 * Uses date-fns format tokens (e.g. "dd/MM/yyyy HH:mm").
 */
export function formatWIB(date: Date | string, fmt: string): string {
  const wibDate = toWIB(date);
  return format(wibDate, fmt);
}

/**
 * Format a UTC date as "dd/MM/yyyy HH:mm" in WIB.
 */
export function formatDateTimeWIB(date: Date | string): string {
  return formatWIB(date, 'dd/MM/yyyy HH:mm');
}

/**
 * Format a UTC date as "dd/MM/yyyy" in WIB.
 */
export function formatDateWIB(date: Date | string): string {
  return formatWIB(date, 'dd/MM/yyyy');
}

/**
 * Format a UTC date as "HH:mm" in WIB.
 */
export function formatTimeWIB(date: Date | string): string {
  return formatWIB(date, 'HH:mm');
}

/**
 * Convert a datetime-local input value (treated as WIB) to a UTC ISO string.
 *
 * HTML datetime-local inputs produce values like "2024-01-15T08:30".
 * We interpret this as WIB and convert to UTC for storage.
 */
export function datetimeLocalToUTC(datetimeLocalValue: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(datetimeLocalValue);
  if (!match) throw new Error('Format waktu tidak valid.');
  const [, yearText, monthText, dayText, hourText, minuteText, secondText = '00', millisecondText = '0'] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const check = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59
  ) {
    throw new Error('Waktu tidak valid.');
  }
  const milliseconds = millisecondText.padEnd(3, '0').slice(0, 3);
  return new Date(`${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}:${secondText}.${milliseconds}+07:00`).toISOString();
}

/**
 * Convert a UTC ISO string to a datetime-local value in WIB.
 *
 * Returns a string formatted as "YYYY-MM-DDTHH:mm" for use in
 * HTML datetime-local inputs.
 */
export function utcToDatetimeLocal(isoString: string): string {
  const wibDate = toWIB(isoString);
  return format(wibDate, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Get the start of day in WIB, returned as a UTC Date.
 */
export function startOfDayWIB(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  const wibDate = toZonedTime(d, WIB_TIMEZONE);
  wibDate.setHours(0, 0, 0, 0);
  return fromZonedTime(wibDate, WIB_TIMEZONE);
}

/**
 * Get the end of day in WIB, returned as a UTC Date.
 */
export function endOfDayWIB(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  const wibDate = toZonedTime(d, WIB_TIMEZONE);
  wibDate.setHours(23, 59, 59, 999);
  return fromZonedTime(wibDate, WIB_TIMEZONE);
}

/** Date preset identifier */
export type DatePresetKey =
  | 'hari_ini'
  | '7_hari'
  | 'bulan_ini'
  | 'bulan_lalu'
  | 'kustom';

/** A single date filter preset */
export interface DatePreset {
  key: DatePresetKey;
  label: string;
  getRange: () => { from: Date; to: Date };
}

/**
 * Returns date filter presets: Hari ini, 7 hari terakhir, Bulan ini,
 * Bulan lalu, Kustom.
 *
 * All ranges are calculated in WIB and returned as UTC Dates.
 */
export function getDatePresets(): DatePreset[] {
  return [
    {
      key: 'hari_ini',
      label: 'Hari ini',
      getRange: () => {
        const now = new Date();
        return { from: startOfDayWIB(now), to: endOfDayWIB(now) };
      },
    },
    {
      key: '7_hari',
      label: '7 hari terakhir',
      getRange: () => {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        return { from: startOfDayWIB(sevenDaysAgo), to: endOfDayWIB(now) };
      },
    },
    {
      key: 'bulan_ini',
      label: 'Bulan ini',
      getRange: () => {
        const now = new Date();
        const wibNow = toZonedTime(now, WIB_TIMEZONE);
        const firstOfMonth = new Date(
          wibNow.getFullYear(),
          wibNow.getMonth(),
          1
        );
        return {
          from: fromZonedTime(firstOfMonth, WIB_TIMEZONE),
          to: endOfDayWIB(now),
        };
      },
    },
    {
      key: 'bulan_lalu',
      label: 'Bulan lalu',
      getRange: () => {
        const now = new Date();
        const wibNow = toZonedTime(now, WIB_TIMEZONE);
        const firstOfLastMonth = new Date(
          wibNow.getFullYear(),
          wibNow.getMonth() - 1,
          1
        );
        const lastDayOfLastMonth = new Date(
          wibNow.getFullYear(),
          wibNow.getMonth(),
          0
        );
        return {
          from: fromZonedTime(firstOfLastMonth, WIB_TIMEZONE),
          to: endOfDayWIB(
            fromZonedTime(lastDayOfLastMonth, WIB_TIMEZONE)
          ),
        };
      },
    },
    {
      key: 'kustom',
      label: 'Kustom',
      getRange: () => {
        // Kustom returns current day as default; actual range comes from user input
        const now = new Date();
        return { from: startOfDayWIB(now), to: endOfDayWIB(now) };
      },
    },
  ];
}
