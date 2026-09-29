import { CalendarDays, CarFront, Fuel, Gauge, Hash, Tag } from 'lucide-react';
import type { MemberListingDetail } from '@/types';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils/format';
import { ListingInfoSection, type ListingInfoItem } from './ListingInfoSection';

const fuelLabels: Record<string, string> = { BENZIN: 'Benzin', DIZEL: 'Dizel', ELEKTRIK: 'Elektrik' };
const level = (value: number | null | undefined) => value === null || value === undefined ? null : `Seviye ${value}`;

export function VehicleDetailsPanel({ listing }: { listing: MemberListingDetail }) {
  const details = listing.vehicle_details;
  if (!details) return null;

  const basic: ListingInfoItem[] = [
    { label: 'Marka', value: details.brand, icon: CarFront },
    { label: 'Model', value: details.model, icon: Tag },
    { label: 'Kategori', value: details.vehicle_category, icon: Tag },
    { label: 'İlan Tarihi', value: listing.published_at ? formatDate(listing.published_at) : null, icon: CalendarDays },
    { label: 'Plaka', value: details.plate, icon: Hash },
    { label: 'Kilometre', value: Number.isFinite(details.mileage) ? `${formatNumber(details.mileage)} km` : null, icon: Gauge },
    { label: 'Yakıt Türü', value: details.fuel_type ? fuelLabels[details.fuel_type] || details.fuel_type : null, icon: Fuel },
  ];
  const upgrades: ListingInfoItem[] = [
    { label: 'Motor Yükseltme', value: level(details.engine_upgrade), badge: true },
    { label: 'Şanzıman Yükseltme', value: level(details.transmission_upgrade), badge: true },
    { label: 'Fren Yükseltme', value: level(details.brake_upgrade), badge: true },
    ...(details.vehicle_category !== 'Motosiklet' && details.suspension !== null && details.suspension !== undefined
      ? [{ label: 'Süspansiyon', value: level(details.suspension), badge: true }]
      : []),
  ];
  const security: ListingInfoItem[] = [
    { label: 'Kilit Seviyesi', value: level(details.lock_level), badge: true },
    { label: 'Alarm Seviyesi', value: level(details.alarm_level), badge: true },
    { label: 'Hırsızlık Önleyici', value: level(details.anti_theft_level), badge: true },
  ];
  const additional: ListingInfoItem[] = [
    { label: 'Turbo', value: details.turbo ? 'Var' : 'Yok' },
    { label: 'Subwoofer', value: details.subwoofer ? 'Var' : 'Yok' },
    { label: 'Takasa Açık', value: details.trade_available ? 'Evet' : 'Hayır' },
    { label: 'Fabrika Çıkış Fiyatı', value: details.factory_price && details.factory_price > 0 ? formatCurrency(details.factory_price) : null, accent: true },
  ];

  return (
    <div data-testid="vehicle-details-panel" className="space-y-4">
      <ListingInfoSection title="Temel Bilgiler" items={basic} />
      <ListingInfoSection title="Mekanik Durum">
        {details.engine_health !== null && details.engine_health !== undefined ? (
          <div className="mb-3 rounded-xl border border-white/[0.035] bg-[var(--bg-surface-secondary)]/45 p-3.5">
            <div className="mb-2 flex items-center justify-between text-xs"><span className="font-bold text-[var(--text-muted)]">Motor Sağlığı</span><strong className="text-[#FF9E45]">%{details.engine_health}</strong></div>
            <div className="h-2 overflow-hidden rounded-full bg-black/25"><div className="h-full rounded-full bg-gradient-to-r from-[#E87500] to-[#FF9E45]" style={{ width: `${Math.min(100, Math.max(0, details.engine_health))}%` }} /></div>
          </div>
        ) : null}
        <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {upgrades.map((item) => <div key={item.label} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-white/[0.035] bg-[var(--bg-surface-secondary)]/45 px-3.5 py-2.5"><dt className="text-xs font-bold text-[var(--text-muted)]">{item.label}</dt><dd className="shrink-0 rounded-full border border-[#FF8A1F]/25 bg-[#FF8A1F]/10 px-2.5 py-1 text-xs font-black text-[#FF9E45]">{item.value}</dd></div>)}
        </dl>
      </ListingInfoSection>
      <ListingInfoSection title="Güvenlik Donanımı" items={security} />
      <ListingInfoSection title="Ek Donanım & Satış" items={additional} />
    </div>
  );
}