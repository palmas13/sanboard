export function normalizeFleecaPayerName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

export function normalizeFleecaRouting(value: unknown): string | null {
  if (typeof value === 'string') {
    const routing = value.trim();
    return /^[0-9]+$/.test(routing) ? routing : null;
  }
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return String(value);
  }
  return null;
}