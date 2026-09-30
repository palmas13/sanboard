const TURKISH_GROUP_SEPARATOR = '.';

export function normalizeIntegerInput(value: string): string | null {
  if (value === '') return '';
  if (!/^\d+$/.test(value)) return null;
  return value.replace(/^0+(?=\d)/, '');
}

export function normalizeTurkishIntegerInput(value: string): string | null {
  if (value === '') return '';
  if (!/^[\d.]+$/.test(value)) return null;
  const digits = value.split(TURKISH_GROUP_SEPARATOR).join('');
  if (!/^\d+$/.test(digits)) return null;
  return digits.replace(/^0+(?=\d)/, '');
}

export function formatTurkishInteger(value: string | number | null | undefined): string {
  if (value === '' || value === null || value === undefined) return '';
  const normalized = String(value).replace(/\D/g, '');
  if (!normalized) return '';
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Number(normalized));
}

export function isIntegerInRange(value: string, min: number, max: number): boolean {
  if (!/^\d+$/.test(value)) return false;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max;
}