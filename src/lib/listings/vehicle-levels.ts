export const VEHICLE_LEVEL_FIELDS = {
  lock_level: { label: 'Kilit', max: 3 },
  alarm_level: { label: 'Alarm', max: 4 },
  anti_theft_level: { label: 'Hırsızlık Önleyici', max: 4 },
  brake_upgrade: { label: 'Fren Yükseltme', max: 3 },
  engine_upgrade: { label: 'Motor Yükseltme', max: 4 },
  transmission_upgrade: { label: 'Şanzıman Yükseltme', max: 3 },
  suspension: { label: 'Süspansiyon', max: 4 },
  turbo: { label: 'Turbo', max: 1 },
} as const;

export type VehicleLevelField = keyof typeof VEHICLE_LEVEL_FIELDS;

export function getVehicleLevelOptions(field: VehicleLevelField) {
  const { max } = VEHICLE_LEVEL_FIELDS[field];
  return Array.from({ length: max + 1 }, (_, level) => ({
    value: String(level),
    label: String(level),
  }));
}

export function normalizeVehicleLevel(value: unknown, field: VehicleLevelField, fallback = '0') {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? ''));
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return String(Math.min(parsed, VEHICLE_LEVEL_FIELDS[field].max));
}