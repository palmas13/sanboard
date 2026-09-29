export const FLEECA_API_BASE_URL = 'https://banking-tr.gta.world/api';

export function getFleecaMode(): 0 | 1 {
  const raw = process.env.FLEECA_MODE ?? '0';
  if (raw !== '0' && raw !== '1') throw new Error('FLEECA_MODE must be 0 (sandbox) or 1 (live).');
  return Number(raw) as 0 | 1;
}

export function getFleecaApiKey(): string {
  const key = process.env.FLEECA_API_KEY?.trim();
  if (!key) throw new Error('FLEECA_API_KEY is not configured.');
  return key;
}