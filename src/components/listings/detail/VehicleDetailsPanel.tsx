import { CarFront, Gauge, Hash, Sparkles, Tag } from 'lucide-react';
import type { MemberListingDetail } from '@/types';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import type { ListingInfoItem } from './ListingInfoSection';

const level = (value: unknown) => {
  const numericValue = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : Number.NaN;
  return Number.isInteger(numericValue) && numericValue >= 0 && numericValue <= 4 ? `Seviye ${numericValue}` : null;
};

function TechnicalSection({ title, items, children, first = false }: { title: string; items?: ListingInfoItem[]; children?: React.ReactNode; first?: boolean }) {
  const visibleItems = items?.filter((item) => item.value !== null && item.value !== undefined && item.value !== '');
  if (!children && !visibleItems?.length) return null;

  return (
    <section data-testid={`vehicle-technical-section-${title.toLocaleLowerCase('tr-TR').replaceAll(' ', '-')}`} className={first ? '' : 'border-t border-[var(--border-app)] pt-4'}>
      <h3 className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]"><Sparkles className="h-3.5 w-3.5 text-[#FF8A1F]" />{title}</h3>
      {children || <dl className="grid auto-rows-fr grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {visibleItems?.map(({ label, value, icon: Icon, accent, badge }) => <div key={label} className="flex h-full min-h-12 items-center gap-2.5 rounded-xl border border-white/[0.05] bg-[var(--bg-surface-secondary)]/50 px-3 py-2.5">
          {Icon ? <Icon className="h-4 w-4 shrink-0 text-[#FF9E45]" /> : null}
          <div className="min-w-0 flex-1"><dt className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{label}</dt><dd className={`mt-0.5 break-words text-xs font-bold ${accent ? 'text-[#FF9E45]' : 'text-[var(--text-main)]'}`}>{badge ? <span className="inline-flex rounded-full border border-[#FF8A1F]/25 bg-[#FF8A1F]/10 px-2 py-0.5 text-[11px] font-black text-[#FF9E45]">{value}</span> : value}</dd></div>
        </div>)}
      </dl>}
    </section>
  );
}

export function VehicleDetailsPanel({ listing }: { listing: MemberListingDetail }) {
  const details = listing.vehicle_details;
  if (!details) return null;

  const basic: ListingInfoItem[] = [
    { label: 'Marka', value: details.brand, icon: CarFront },
    { label: 'Model', value: details.model, icon: Tag },
    { label: 'Plaka', value: details.plate, icon: Hash },
    { label: 'Kilometre', value: Number.isFinite(details.mileage) ? `${formatNumber(details.mileage)} km` : null, icon: Gauge },
  ];
  const upgrades: ListingInfoItem[] = [
    { label: 'Motor Yükseltme', value: level(details.engine_upgrade), badge: true },
    { label: 'Şanzıman Yükseltme', value: level(details.transmission_upgrade), badge: true },
    { label: 'Fren Yükseltme', value: level(details.brake_upgrade), badge: true },
    ...(details.vehicle_category !== 'Motosiklet' && level(details.suspension)
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
    <section data-testid="vehicle-details-panel" className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-4 shadow-[0_16px_45px_rgba(0,0,0,.1)] sm:p-5">
      <div className="space-y-4">
        <TechnicalSection title="Temel Bilgiler" items={basic} first />
        <TechnicalSection title="Mekanik Durum">
          {details.engine_health !== null && details.engine_health !== undefined ? (
            <div className="mb-2 rounded-xl border border-white/[0.035] bg-[var(--bg-surface-secondary)]/45 p-3">
              <div className="mb-2 flex items-center justify-between text-xs"><span className="font-bold text-[var(--text-muted)]">Motor Sağlığı</span><strong className="text-[#FF9E45]">%{details.engine_health}</strong></div>
              <div className="h-2 overflow-hidden rounded-full bg-black/25"><div className="h-full rounded-full bg-gradient-to-r from-[#E87500] to-[#FF9E45]" style={{ width: `${Math.min(100, Math.max(0, details.engine_health))}%` }} /></div>
            </div>
          ) : null}
          <dl className="grid auto-rows-fr grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {upgrades.filter((item) => item.value !== null).map((item) => <div key={item.label} className="flex h-full min-h-12 items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-[var(--bg-surface-secondary)]/50 px-3 py-2.5"><dt className="text-xs font-bold text-[var(--text-muted)]">{item.label}</dt><dd className="shrink-0 rounded-full border border-[#FF8A1F]/25 bg-[#FF8A1F]/10 px-2.5 py-1 text-xs font-black text-[#FF9E45]">{item.value}</dd></div>)}
          </dl>
        </TechnicalSection>
        <TechnicalSection title="Güvenlik Donanımı" items={security} />
        <TechnicalSection title="Ek Donanım" items={additional} />
      </div>
    </section>
  );
}