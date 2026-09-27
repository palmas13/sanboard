import type { TicketCategory } from '@/types';

export const TICKET_CATEGORIES = [
  { value: 'LISTING', label: 'İlan Sorunu' },
  { value: 'PAYMENT', label: 'Ödeme Sorunu' },
  { value: 'CORPORATE', label: 'Kurumsal Hesap' },
  { value: 'ACCOUNT_CHARACTER', label: 'Hesap / Karakter' },
  { value: 'REPORT_MODERATION', label: 'Rapor / Moderasyon' },
  { value: 'OTHER', label: 'Diğer' },
] as const satisfies ReadonlyArray<{ value: TicketCategory; label: string }>;

const CATEGORY_VALUES = new Set<string>(TICKET_CATEGORIES.map((item) => item.value));

export function isTicketCategory(value: unknown): value is TicketCategory {
  return typeof value === 'string' && CATEGORY_VALUES.has(value);
}

export function normalizeTicketCategory(value: unknown): TicketCategory {
  return isTicketCategory(value) ? value : 'OTHER';
}

export function getTicketCategoryLabel(value: unknown): string {
  const category = normalizeTicketCategory(value);
  return TICKET_CATEGORIES.find((item) => item.value === category)?.label || 'Diğer';
}