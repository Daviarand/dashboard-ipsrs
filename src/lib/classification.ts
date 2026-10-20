export type TicketClassification = 'laksana' | 'gagal_laksana';

export function previewClassification(
  reportedAt: string | Date,
  finishedAt: string | Date,
  slaHours: number,
): TicketClassification {
  const duration = new Date(finishedAt).getTime() - new Date(reportedAt).getTime();
  return duration <= slaHours * 60 * 60 * 1000 ? 'laksana' : 'gagal_laksana';
}
