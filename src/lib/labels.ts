import type { Enums } from '@/types/database';

// ─── Status ──────────────────────────────────────────────────────────

const STATUS_LABELS: Record<Enums<'ticket_status'>, string> = {
  baru: 'Baru',
  ditugaskan: 'Ditugaskan',
  dikerjakan: 'Dikerjakan',
  menunggu_material: 'Menunggu Material',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
} as const;

const STATUS_COLORS: Record<Enums<'ticket_status'>, string> = {
  baru: 'slate',
  ditugaskan: 'blue',
  dikerjakan: 'amber',
  menunggu_material: 'orange',
  selesai: 'green',
  dibatalkan: 'red',
} as const;

export function getStatusLabel(status: Enums<'ticket_status'>): string {
  return STATUS_LABELS[status];
}

export function getStatusColor(status: Enums<'ticket_status'>): string {
  return STATUS_COLORS[status];
}

// ─── Priority ────────────────────────────────────────────────────────

const PRIORITY_LABELS: Record<Enums<'ticket_priority'>, string> = {
  urgent: 'Urgent',
  tinggi: 'Tinggi',
  sedang: 'Sedang',
  rendah: 'Rendah',
} as const;

const PRIORITY_COLORS: Record<Enums<'ticket_priority'>, string> = {
  urgent: 'red',
  tinggi: 'orange',
  sedang: 'blue',
  rendah: 'slate',
} as const;

export function getPriorityLabel(priority: Enums<'ticket_priority'>): string {
  return PRIORITY_LABELS[priority];
}

export function getPriorityColor(priority: Enums<'ticket_priority'>): string {
  return PRIORITY_COLORS[priority];
}

// ─── Difficulty ─────────────────────────────────────────────────────

const DIFFICULTY_LABELS: Record<Enums<'ticket_difficulty'>, string> = {
  low: 'Mudah',
  medium: 'Sedang',
  hard: 'Sulit',
} as const;

export function getDifficultyLabel(difficulty: Enums<'ticket_difficulty'>): string {
  return DIFFICULTY_LABELS[difficulty];
}

export const DIFFICULTY_OPTIONS = (
  Object.keys(DIFFICULTY_LABELS) as Enums<'ticket_difficulty'>[]
).map((key) => ({
  value: key,
  label: DIFFICULTY_LABELS[key],
}));

// ─── Classification ─────────────────────────────────────────────────

const CLASSIFICATION_LABELS: Record<Enums<'ticket_classification'>, string> = {
  laksana: 'Laksana',
  gagal_laksana: 'Gagal Laksana',
} as const;

const CLASSIFICATION_COLORS: Record<Enums<'ticket_classification'>, string> = {
  laksana: 'green',
  gagal_laksana: 'red',
} as const;

export function getClassificationLabel(
  classification: Enums<'ticket_classification'>
): string {
  return CLASSIFICATION_LABELS[classification];
}

export function getClassificationColor(
  classification: Enums<'ticket_classification'>
): string {
  return CLASSIFICATION_COLORS[classification];
}

// ─── Stock Movement Type ─────────────────────────────────────────────

const MOVEMENT_TYPE_LABELS: Record<Enums<'stock_movement_type'>, string> = {
  masuk: 'Stok Masuk',
  keluar: 'Stok Keluar',
  koreksi: 'Koreksi',
} as const;

export function getMovementTypeLabel(
  type: Enums<'stock_movement_type'>
): string {
  return MOVEMENT_TYPE_LABELS[type];
}

// ─── Option arrays (useful for <Select> dropdowns) ───────────────────

export const STATUS_OPTIONS = (
  Object.keys(STATUS_LABELS) as Enums<'ticket_status'>[]
).map((key) => ({
  value: key,
  label: STATUS_LABELS[key],
}));

export const PRIORITY_OPTIONS = (
  Object.keys(PRIORITY_LABELS) as Enums<'ticket_priority'>[]
).map((key) => ({
  value: key,
  label: PRIORITY_LABELS[key],
}));

export const CLASSIFICATION_OPTIONS = (
  Object.keys(CLASSIFICATION_LABELS) as Enums<'ticket_classification'>[]
).map((key) => ({
  value: key,
  label: CLASSIFICATION_LABELS[key],
}));

export const MOVEMENT_TYPE_OPTIONS = (
  Object.keys(MOVEMENT_TYPE_LABELS) as Enums<'stock_movement_type'>[]
).map((key) => ({
  value: key,
  label: MOVEMENT_TYPE_LABELS[key],
}));
