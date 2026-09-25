import React from 'react';
import { Listing } from '@/types';
import { formatCurrency } from '@/lib/utils/format';

interface VehicleComparisonTableProps {
  listingA: Listing;
  listingB: Listing | null;
}

interface SpecRow {
  label: string;
  valA: string;
  valB: string;
  isDifferent: boolean;
}

export function VehicleComparisonTable({ listingA, listingB }: VehicleComparisonTableProps) {
  const vA = listingA.vehicle_details;
  const vB = listingB?.vehicle_details;

  const formatUpgrade = (level?: number | null) => {
    if (level === undefined || level === null) return 'Standart (0)';
    return `Seviye ${level}`;
  };

  const formatBoolean = (val?: boolean | null) => {
    if (val === undefined || val === null) return 'Belirtilmemiş';
    return val ? 'Var' : 'Yok';
  };

  const formatYesNo = (val?: boolean | null) => {
    if (val === undefined || val === null) return 'Belirtilmemiş';
    return val ? 'Evet' : 'Hayır';
  };

  const formatFuel = (fuel?: string | null) => {
    if (!fuel) return 'Standart';
    if (fuel === 'BENZIN') return 'Benzin';
    if (fuel === 'DIZEL') return 'Dizel';
    if (fuel === 'ELEKTRIK') return 'Elektrik';
    return fuel;
  };

  const formatEngineHealth = (health?: number | null) => {
    if (health === undefined || health === null) return 'Belirtilmemiş';
    return `%${health}`;
  };

  const formatSecurityLevel = (level?: number | null) => {
    if (level === undefined || level === null) return 'Standart (0)';
    return `Seviye ${level}`;
  };

  // Build rows comparing REAL vehicle fields
  const rows: SpecRow[] = [
    {
      label: 'Fiyat',
      valA: formatCurrency(listingA.price),
      valB: listingB ? formatCurrency(listingB.price) : '—',
      isDifferent: Boolean(listingB && listingA.price !== listingB.price),
    },
    {
      label: 'Kategori',
      valA: listingA.subcategory || 'Araç',
      valB: listingB?.subcategory || '—',
      isDifferent: Boolean(listingB && listingA.subcategory !== listingB.subcategory),
    },
    {
      label: 'Marka',
      valA: vA?.brand || 'Belirtilmemiş',
      valB: vB?.brand || (listingB ? 'Belirtilmemiş' : '—'),
      isDifferent: Boolean(listingB && vA?.brand !== vB?.brand),
    },
    {
      label: 'Model',
      valA: vA?.model || 'Belirtilmemiş',
      valB: vB?.model || (listingB ? 'Belirtilmemiş' : '—'),
      isDifferent: Boolean(listingB && vA?.model !== vB?.model),
    },
    {
      label: 'Kilometre',
      valA: vA?.mileage !== undefined ? `${vA.mileage.toLocaleString('tr-TR')} km` : 'Belirtilmemiş',
      valB: vB?.mileage !== undefined ? `${vB.mileage.toLocaleString('tr-TR')} km` : (listingB ? 'Belirtilmemiş' : '—'),
      isDifferent: Boolean(listingB && vA?.mileage !== vB?.mileage),
    },
    {
      label: 'Motor Sağlığı',
      valA: formatEngineHealth(vA?.engine_health),
      valB: listingB ? formatEngineHealth(vB?.engine_health) : '—',
      isDifferent: Boolean(listingB && vA?.engine_health !== vB?.engine_health),
    },
    {
      label: 'Motor Güçlendirmesi',
      valA: formatUpgrade(vA?.engine_upgrade),
      valB: listingB ? formatUpgrade(vB?.engine_upgrade) : '—',
      isDifferent: Boolean(listingB && vA?.engine_upgrade !== vB?.engine_upgrade),
    },
    {
      label: 'Fren Güçlendirmesi',
      valA: formatUpgrade(vA?.brake_upgrade),
      valB: listingB ? formatUpgrade(vB?.brake_upgrade) : '—',
      isDifferent: Boolean(listingB && vA?.brake_upgrade !== vB?.brake_upgrade),
    },
    {
      label: 'Şanzıman Güçlendirmesi',
      valA: formatUpgrade(vA?.transmission_upgrade),
      valB: listingB ? formatUpgrade(vB?.transmission_upgrade) : '—',
      isDifferent: Boolean(listingB && vA?.transmission_upgrade !== vB?.transmission_upgrade),
    },
    {
      label: 'Turbo',
      valA: formatBoolean(vA?.turbo),
      valB: listingB ? formatBoolean(vB?.turbo) : '—',
      isDifferent: Boolean(listingB && vA?.turbo !== vB?.turbo),
    },
    {
      label: 'Subwoofer',
      valA: formatBoolean(vA?.subwoofer),
      valB: listingB ? formatBoolean(vB?.subwoofer) : '—',
      isDifferent: Boolean(listingB && vA?.subwoofer !== vB?.subwoofer),
    },
    {
      label: 'Takas İmkanı',
      valA: formatYesNo(vA?.trade_available),
      valB: listingB ? formatYesNo(vB?.trade_available) : '—',
      isDifferent: Boolean(listingB && vA?.trade_available !== vB?.trade_available),
    },
    {
      label: 'Yakıt Tipi',
      valA: formatFuel(vA?.fuel_type),
      valB: listingB ? formatFuel(vB?.fuel_type) : '—',
      isDifferent: Boolean(listingB && vA?.fuel_type !== vB?.fuel_type),
    },
    {
      label: 'Süspansiyon',
      valA: vA?.suspension || 'Standart',
      valB: vB?.suspension || (listingB ? 'Standart' : '—'),
      isDifferent: Boolean(listingB && vA?.suspension !== vB?.suspension),
    },
    {
      label: 'Kilit Seviyesi',
      valA: formatSecurityLevel(vA?.lock_level),
      valB: listingB ? formatSecurityLevel(vB?.lock_level) : '—',
      isDifferent: Boolean(listingB && vA?.lock_level !== vB?.lock_level),
    },
    {
      label: 'Alarm Seviyesi',
      valA: formatSecurityLevel(vA?.alarm_level),
      valB: listingB ? formatSecurityLevel(vB?.alarm_level) : '—',
      isDifferent: Boolean(listingB && vA?.alarm_level !== vB?.alarm_level),
    },
    {
      label: 'İmmobilizer',
      valA: formatSecurityLevel(vA?.anti_theft_level),
      valB: listingB ? formatSecurityLevel(vB?.anti_theft_level) : '—',
      isDifferent: Boolean(listingB && vA?.anti_theft_level !== vB?.anti_theft_level),
    },
    {
      label: 'Plaka',
      valA: vA?.plate || 'Standart',
      valB: vB?.plate || (listingB ? 'Standart' : '—'),
      isDifferent: Boolean(listingB && vA?.plate !== vB?.plate),
    },
    {
      label: 'Fabrika Fiyatı',
      valA: vA?.factory_price ? formatCurrency(vA.factory_price) : 'Belirtilmemiş',
      valB: vB?.factory_price ? formatCurrency(vB.factory_price) : (listingB ? 'Belirtilmemiş' : '—'),
      isDifferent: Boolean(listingB && vA?.factory_price !== vB?.factory_price),
    },
  ];

  return (
    <div className="surface-card rounded-2xl border border-[var(--border-app)] overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[500px]">
          {/* Table Sticky Header */}
          <thead className="sticky top-0 bg-[var(--bg-surface-secondary)]/95 backdrop-blur-sm z-10 border-b border-[var(--border-app)]">
            <tr>
              <th className="py-3 px-4 text-xs font-bold text-[var(--text-muted)] w-1/3">
                Teknik Özellik
              </th>
              <th className="py-3 px-4 text-xs font-bold text-[#FF8A1F] w-1/3">
                {vA?.brand || ''} {vA?.model || listingA.title}
              </th>
              <th className="py-3 px-4 text-xs font-bold text-[#FF8A1F] w-1/3">
                {listingB ? `${vB?.brand || ''} ${vB?.model || listingB.title}` : 'İkinci Araç'}
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--border-app)] text-xs">
            {rows.map((row, idx) => (
              <tr
                key={idx}
                className={`transition-colors ${
                  row.isDifferent
                    ? 'bg-[#FF8A1F]/[0.03] hover:bg-[#FF8A1F]/[0.07]'
                    : 'hover:bg-[var(--bg-surface-secondary)]/40'
                }`}
              >
                <td className="py-3 px-4 font-medium text-[var(--text-muted)] flex items-center gap-1.5">
                  {row.label}
                  {row.isDifferent && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-[#FF8A1F]/70 inline-block"
                      title="Farklı Değer"
                    />
                  )}
                </td>
                <td className="py-3 px-4 font-semibold text-[var(--text-main)]">
                  {row.valA}
                </td>
                <td className="py-3 px-4 font-semibold text-[var(--text-main)]">
                  {row.valB}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
