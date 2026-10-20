import { z } from 'zod';

export const ticketCreateSchema = z.object({
  roomId: z.string().uuid('Ruangan wajib dipilih.'),
  reporterName: z.string().trim().min(1, 'Nama pelapor wajib diisi.'),
  reportedAt: z.string().min(1, 'Waktu lapor wajib diisi.'),
  damageTypeId: z.string().uuid('Jenis kerusakan wajib dipilih.'),
  priority: z.enum(['urgent', 'tinggi', 'sedang', 'rendah']),
  description: z.string().trim().min(1, 'Deskripsi kendala wajib diisi.'),
  initialNote: z.string(),
  selectedStaff: z.array(z.object({
    userId: z.string().uuid(),
    isLead: z.boolean(),
  })).refine((staff) => staff.length === 0 || staff.some((person) => person.isLead), {
    message: 'Pilih satu teknisi sebagai penanggung jawab utama.',
  }),
});

export const ticketFinishSchema = z.object({
  startedAt: z.string().min(1, 'Waktu mulai wajib diisi'),
  finishedAt: z.string().min(1, 'Waktu selesai wajib diisi'),
  workDone: z.string().trim().min(1, 'Tindakan yang dilakukan wajib diisi'),
  reporterVerified: z.boolean(),
  verifierName: z.string().trim(),
});

export const ticketEditSchema = z.object({
  roomId: z.string().uuid('Ruangan wajib dipilih.'),
  reporterName: z.string().trim().min(1, 'Nama pelapor wajib diisi.'),
  reportedAt: z.string().min(1, 'Waktu lapor wajib diisi.'),
  damageTypeId: z.string().uuid('Jenis kerusakan wajib dipilih.'),
  priority: z.enum(['urgent', 'tinggi', 'sedang', 'rendah']),
  description: z.string().trim().min(1, 'Deskripsi kendala wajib diisi.'),
});
