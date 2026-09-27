import React from 'react';
import { Gauge, Headphones, Info, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { Listing } from '@/types';
import { formatCurrency } from '@/lib/utils/format';

interface VehicleComparisonTableProps {
  listingA: Listing;
  listingB: Listing | null;
}

interface SpecRow {
  key: string;
  label: string;
  rawA: unknown;
  rawB: unknown;
  valA: string;
  valB: string;
  kind?: 'boolean';
}

interface SpecSection {
  key: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  rows: SpecRow[];
}

export function getVehicleComparisonSections(listingA: Listing, listingB: Listing | null): SpecSection[] {
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

  const formatFuel = (fuel?: string | null) => {
    if (!fuel) return 'Belirtilmemiş';
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

  const row = (key: string, label: string, rawA: unknown, rawB: unknown, valA: string, valB: string, kind?: 'boolean'): SpecRow => ({ key, label, rawA, rawB, valA, valB, kind });
  const missingB = (value: string) => listingB ? value : '—';

  return [
    { key: 'general', title: 'Genel', description: 'Temel araç ve fiyat bilgileri', icon: Info, rows: [
      row('price', 'Fiyat', listingA.price, listingB?.price, formatCurrency(listingA.price), listingB ? formatCurrency(listingB.price) : '—'),
      row('category', 'Kategori', listingA.subcategory, listingB?.subcategory, listingA.subcategory || 'Araç', listingB?.subcategory || '—'),
      row('brand', 'Marka', vA?.brand, vB?.brand, vA?.brand || 'Belirtilmemiş', missingB(vB?.brand || 'Belirtilmemiş')),
      row('model', 'Model', vA?.model, vB?.model, vA?.model || 'Belirtilmemiş', missingB(vB?.model || 'Belirtilmemiş')),
      row('mileage', 'Kilometre', vA?.mileage, vB?.mileage, vA?.mileage === undefined ? 'Belirtilmemiş' : `${vA.mileage.toLocaleString('tr-TR')} km`, missingB(vB?.mileage === undefined ? 'Belirtilmemiş' : `${vB.mileage.toLocaleString('tr-TR')} km`)),
      row('fuel', 'Yakıt Tipi', vA?.fuel_type, vB?.fuel_type, formatFuel(vA?.fuel_type), missingB(formatFuel(vB?.fuel_type))),
    ]},
    { key: 'performance', title: 'Performans', description: 'Motor, aktarma ve sürüş donanımları', icon: Gauge, rows: [
      row('engine-health', 'Motor Sağlığı', vA?.engine_health, vB?.engine_health, formatEngineHealth(vA?.engine_health), missingB(formatEngineHealth(vB?.engine_health))),
      row('engine-upgrade', 'Motor Güçlendirmesi', vA?.engine_upgrade, vB?.engine_upgrade, formatUpgrade(vA?.engine_upgrade), missingB(formatUpgrade(vB?.engine_upgrade))),
      row('brake-upgrade', 'Fren Güçlendirmesi', vA?.brake_upgrade, vB?.brake_upgrade, formatUpgrade(vA?.brake_upgrade), missingB(formatUpgrade(vB?.brake_upgrade))),
      row('transmission-upgrade', 'Şanzıman Güçlendirmesi', vA?.transmission_upgrade, vB?.transmission_upgrade, formatUpgrade(vA?.transmission_upgrade), missingB(formatUpgrade(vB?.transmission_upgrade))),
      row('turbo', 'Turbo', vA?.turbo, vB?.turbo, formatBoolean(vA?.turbo), missingB(formatBoolean(vB?.turbo)), 'boolean'),
      row('suspension', 'Süspansiyon', vA?.suspension, vB?.suspension, vA?.suspension || 'Belirtilmemiş', missingB(vB?.suspension || 'Belirtilmemiş')),
    ]},
    { key: 'comfort', title: 'Ses & Konfor', description: 'Kullanım ve satış tercihleri', icon: Headphones, rows: [
      row('subwoofer', 'Subwoofer', vA?.subwoofer, vB?.subwoofer, formatBoolean(vA?.subwoofer), missingB(formatBoolean(vB?.subwoofer)), 'boolean'),
      row('trade', 'Takas İmkanı', vA?.trade_available, vB?.trade_available, formatBoolean(vA?.trade_available), missingB(formatBoolean(vB?.trade_available)), 'boolean'),
    ]},
    { key: 'security', title: 'Güvenlik', description: 'Araç koruma ve güvenlik seviyeleri', icon: ShieldCheck, rows: [
      row('lock', 'Kilit Seviyesi', vA?.lock_level, vB?.lock_level, formatSecurityLevel(vA?.lock_level), missingB(formatSecurityLevel(vB?.lock_level))),
      row('alarm', 'Alarm Seviyesi', vA?.alarm_level, vB?.alarm_level, formatSecurityLevel(vA?.alarm_level), missingB(formatSecurityLevel(vB?.alarm_level))),
      row('anti-theft', 'Immobilizer / Anti Theft', vA?.anti_theft_level, vB?.anti_theft_level, formatSecurityLevel(vA?.anti_theft_level), missingB(formatSecurityLevel(vB?.anti_theft_level))),
    ]},
    { key: 'other', title: 'Diğer', description: 'Kimlik ve referans fiyat bilgileri', icon: SlidersHorizontal, rows: [
      row('plate', 'Plaka', vA?.plate, vB?.plate, vA?.plate || 'Belirtilmemiş', missingB(vB?.plate || 'Belirtilmemiş')),
      row('factory-price', 'Fabrika Fiyatı', vA?.factory_price, vB?.factory_price, vA?.factory_price ? formatCurrency(vA.factory_price) : 'Belirtilmemiş', missingB(vB?.factory_price ? formatCurrency(vB.factory_price) : 'Belirtilmemiş')),
    ]},
  ];
}

function ComparisonValue({ value, kind }: { value: string; kind?: 'boolean' }) {
  if (kind !== 'boolean' || value === '—' || value === 'Belirtilmemiş') return <span className="font-semibold text-[var(--text-main)]">{value}</span>;
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${value === 'Var' ? 'border-[#FF8A1F]/25 bg-[#FF8A1F]/10 text-[#FF9D45]' : 'border-[var(--border-app)] bg-black/10 text-[var(--text-muted)]'}`}>{value}</span>;
}

export function VehicleComparisonTable({ listingA, listingB }: VehicleComparisonTableProps) {
  const sections = getVehicleComparisonSections(listingA, listingB);
  const nameA = [listingA.vehicle_details?.brand, listingA.vehicle_details?.model].filter(Boolean).join(' ') || listingA.title;
  const nameB = listingB ? [listingB.vehicle_details?.brand, listingB.vehicle_details?.model].filter(Boolean).join(' ') || listingB.title : 'İkinci Araç';

  return (
    <div className="space-y-5" data-testid="vehicle-comparison-sections">
      <div className="sticky top-[68px] z-20 hidden rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)]/95 px-4 py-3 shadow-xl backdrop-blur-lg md:grid md:grid-cols-[minmax(150px,0.8fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-dim)]">Karşılaştırma</span>
        <span className="truncate px-4 text-xs font-bold text-[var(--text-main)]">{nameA}</span>
        <span className="truncate border-l border-[var(--border-app)] px-4 text-xs font-bold text-[var(--text-main)]">{nameB}</span>
      </div>

      {sections.map((section) => {
        const Icon = section.icon;
        return <section key={section.key} className="overflow-hidden rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] shadow-sm" data-comparison-category={section.key}>
          <header className="flex items-center gap-3 border-b border-[var(--border-app)] bg-[var(--bg-surface-secondary)]/55 px-4 py-4 sm:px-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#FF8A1F]/20 bg-[#FF8A1F]/10 text-[#FF8A1F]"><Icon className="h-4 w-4" /></span>
            <div><h3 className="text-sm font-extrabold uppercase tracking-[0.12em] text-[var(--text-main)]">{section.title}</h3><p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{section.description}</p></div>
          </header>
          <div className="divide-y divide-[var(--border-app)]/70">
            {section.rows.map((row, index) => {
              const isDifferent = Boolean(listingB) && (row.rawA ?? null) !== (row.rawB ?? null);
              return <div key={row.key} data-different={isDifferent ? 'true' : 'false'} className={`relative grid grid-cols-2 gap-x-3 gap-y-2 px-4 py-3.5 sm:px-5 md:grid-cols-[minmax(150px,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] md:gap-0 ${isDifferent ? 'bg-[#FF8A1F]/[0.045]' : index % 2 ? 'bg-white/[0.012]' : ''}`}>
                {isDifferent && <span className="absolute inset-y-0 left-0 w-0.5 bg-[#FF8A1F]/70" aria-hidden="true" />}
                <div className="col-span-2 flex items-center gap-2 text-[11px] font-semibold text-[var(--text-muted)] md:col-span-1 md:pr-4">{isDifferent && <span className="h-1.5 w-1.5 rounded-full bg-[#FF8A1F]" title="Değerler farklı" />}{row.label}</div>
                <div className="min-w-0 rounded-lg border border-[var(--border-app)]/60 bg-black/[0.06] px-3 py-2 text-xs md:rounded-none md:border-0 md:bg-transparent md:px-4 md:py-0"><ComparisonValue value={row.valA} kind={row.kind} /></div>
                <div className="min-w-0 rounded-lg border border-[var(--border-app)]/60 bg-black/[0.06] px-3 py-2 text-xs md:rounded-none md:border-y-0 md:border-r-0 md:border-l md:bg-transparent md:px-4 md:py-0"><ComparisonValue value={row.valB} kind={row.kind} /></div>
              </div>;
            })}
          </div>
        </section>;
      })}
    </div>
  );
}
