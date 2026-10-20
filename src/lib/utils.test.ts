import { describe, expect, it } from 'vitest';
import { datetimeLocalToUTC, formatDateTimeWIB } from '@/lib/datetime';
import { formatDuration } from '@/lib/format';
import { mapDbError } from '@/lib/error';
import { previewClassification } from '@/lib/classification';
import { getClassificationLabel, getStatusLabel } from '@/lib/labels';
import { ticketCreateSchema, ticketFinishSchema } from '@/features/tickets/schemas';

describe('waktu WIB', () => {
  it('menampilkan tengah malam WIB dengan benar dari UTC', () => {
    expect(formatDateTimeWIB('2026-10-20T17:00:00.000Z')).toBe('21/10/2026 00:00');
  });

  it('mengubah datetime-local WIB menjadi UTC secara konsisten', () => {
    expect(datetimeLocalToUTC('2026-10-21T00:00')).toBe('2026-10-20T17:00:00.000Z');
    expect(datetimeLocalToUTC('2026-10-21T07:30')).toBe('2026-10-21T00:30:00.000Z');
  });

  it('menolak nilai waktu yang tidak valid', () => {
    expect(() => datetimeLocalToUTC('2026-02-30T11:20')).toThrow('Waktu tidak valid.');
  });
});

describe('format durasi', () => {
  it.each([
    [null, '–'],
    [0, '–'],
    [45, '45 menit'],
    [60, '1 jam'],
    [125, '2 jam 5 menit'],
  ])('memformat %s menit', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });
});

describe('pemetaan pesan dan label', () => {
  it('memetakan waktu lapor dan selesai ke pesan Indonesia', () => {
    expect(mapDbError({ message: 'Waktu lapor tidak boleh di masa depan' })).toBe('Waktu tidak boleh di masa depan.');
    expect(mapDbError({ message: 'Waktu selesai tidak boleh di masa depan' })).toBe('Waktu tidak boleh di masa depan.');
  });

  it('memetakan kode database dan label enum', () => {
    expect(mapDbError({ code: '23505' })).toBe('Nama atau kode sudah digunakan.');
    expect(getStatusLabel('menunggu_material')).toBe('Menunggu Material');
    expect(getClassificationLabel('gagal_laksana')).toBe('Gagal Laksana');
  });
});

describe('pratinjau klasifikasi', () => {
  const reportedAt = '2026-10-20T00:00:00.000Z';

  it('menganggap tepat pada batas SLA sebagai Laksana', () => {
    expect(previewClassification(reportedAt, '2026-10-21T00:00:00.000Z', 24)).toBe('laksana');
  });

  it('menganggap waktu lewat SLA sebagai Gagal Laksana', () => {
    expect(previewClassification(reportedAt, '2026-10-21T00:00:01.000Z', 24)).toBe('gagal_laksana');
  });
});

describe('validasi formulir tiket', () => {
  it('menerima tiket lengkap dengan penanggung jawab utama', () => {
    expect(ticketCreateSchema.safeParse({
      roomId: '11111111-1111-4111-8111-111111111111',
      reporterName: 'Pelapor',
      reportedAt: '2026-10-20T10:00',
      damageTypeId: '22222222-2222-4222-8222-222222222222',
      priority: 'sedang',
      description: 'Lampu tidak menyala',
      initialNote: '',
      selectedStaff: [{ userId: '33333333-3333-4333-8333-333333333333', isLead: true }],
    }).success).toBe(true);
  });

  it('mewajibkan penanggung jawab bila ada teknisi terpilih', () => {
    const result = ticketCreateSchema.safeParse({
      roomId: '11111111-1111-4111-8111-111111111111',
      reporterName: 'Pelapor',
      reportedAt: '2026-10-20T10:00',
      damageTypeId: '22222222-2222-4222-8222-222222222222',
      priority: 'sedang',
      description: 'Lampu tidak menyala',
      initialNote: '',
      selectedStaff: [{ userId: '33333333-3333-4333-8333-333333333333', isLead: false }],
    });
    expect(result.success).toBe(false);
  });

  it('memvalidasi waktu dan tindakan pada formulir selesai', () => {
    expect(ticketFinishSchema.safeParse({
      startedAt: '2026-10-20T10:00',
      finishedAt: '2026-10-20T11:00',
      workDone: 'Lampu diganti',
      reporterVerified: true,
      verifierName: 'Pelapor',
    }).success).toBe(true);
  });
});
