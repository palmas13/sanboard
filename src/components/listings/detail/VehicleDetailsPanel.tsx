import { CarFront, Gauge, Hash, Sparkles, Tag } from 'lucide-react';
import type { MemberListingDetail } from '@/types';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import type { ListingInfoItem } from './ListingInfoSection';

const level = (value: unknown) => {
  const numericValue = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : Number.NaN;
  return Number.isInteger(numericValue) && numericValue >= 0 && numericValue <= 4 ? `Seviye ${numericValue}` : null;
};

function TechnicalSection({ title, items, children, first = false, columns = 'standard' }: { title: string; items?: ListingInfoItem[]; children?: React.ReactNode; first?: boolean; columns?: 'standard' | 'wide' }) {
  const visibleItems = items?.filter((item) => item.value !== null && item.value !== undefined && item.value !== '');
  if (!children && !visibleItems?.length) return null;

  return (
    <section data-testid={`vehicle-technical-section-${title.toLocaleLowerCase('tr-TR').replaceAll(' ', '-')}`} className={first ? '' : 'border-t border-[var(--border-app)]/80 pt-3.5'}>
      <h3 className="mb-3 flex items-center gap-1.5 text-[13px] font-black text-[var(--text-main)]"><Sparkles className="h-4 w-4 text-[#FF8A1F]" />{title}</h3>
      {children || <dl className={`grid auto-rows-fr grid-cols-2 gap-1.5 ${columns === 'wide' ? 'sm:grid-cols-3' : ''}`}>
        {visibleItems?.map(({ label, value, icon: Icon, accent, badge }) => <div key={label} className="flex h-full min-h-10 items-center gap-2 rounded-lg bg-[var(--bg-surface-secondary)]/55 px-2.5 py-2">
          {Icon ? <Icon className="h-4 w-4 shrink-0 text-[#FF8A1F]" /> : null}
          <div className="min-w-0 flex-1"><dt className="text-[10px] font-semibold text-[var(--text-dim)]">{label}</dt><dd className={`mt-px break-words text-xs font-bold leading-4 ${accent ? 'text-[#FF9E45]' : 'text-[var(--text-main)]'}`}>{badge ? <span className="inline-flex rounded-md bg-[#FF8A1F]/10 px-1.5 py-0.5 text-[11px] font-bold text-[#FF9E45]">{value}</span> : value}</dd></div>
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
    { label: 'Mil', value: Number.isFinite(details.mileage) ? `${formatNumber(details.mileage)} mil` : null, icon: Gauge },
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
  const engineHealth = Math.min(100, Math.max(0, details.engine_health ?? 0));
  const engineHealthTone = engineHealth >= 70 ? 'bg-[var(--color-success)] text-[var(--color-success)]' : engineHealth >= 40 ? 'bg-[var(--color-warning)] text-[var(--color-warning)]' : 'bg-[var(--color-danger)] text-[var(--color-danger)]';
  const additional: ListingInfoItem[] = [
    { label: 'Turbo', value: details.turbo ? 'Var' : 'Yok' },
    { label: 'Subwoofer', value: details.subwoofer ? 'Var' : 'Yok' },
    { label: 'Takasa Açık', value: details.trade_available ? 'Evet' : 'Hayır' },
    { label: 'Fabrika Çıkış Fiyatı', value: details.factory_price && details.factory_price > 0 ? formatCurrency(details.factory_price) : null, accent: true },
  ];

  return (
    <section data-testid="vehicle-details-panel" className="h-full rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-4 shadow-[0_12px_36px_rgba(0,0,0,.09)]">
      <div className="space-y-3.5">
        <TechnicalSection title="Temel Bilgiler" items={basic} first />
        <TechnicalSection title="Mekanik Durum">
          {details.engine_health !== null && details.engine_health !== undefined ? (
            <div className="mb-1.5 rounded-lg bg-[var(--bg-surface-secondary)]/55 px-2.5 py-2">
              <div className="mb-1.5 flex items-center justify-between text-[11px] leading-4"><span className="font-semibold text-[var(--text-muted)]">Motor Sağlığı</span><strong className={`min-w-[3.25rem] text-right tabular-nums ${engineHealthTone.split(' ')[1]}`}>%{details.engine_health}</strong></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-black/25" role="meter" aria-label="Motor sağlığı" aria-valuemin={0} aria-valuemax={100} aria-valuenow={engineHealth}><div className={`h-full rounded-full transition-[width] duration-300 ${engineHealthTone.split(' ')[0]}`} style={{ width: `${engineHealth}%` }} /></div>
            </div>
          ) : null}
          <dl className="grid auto-rows-fr grid-cols-2 gap-1.5">
            {upgrades.filter((item) => item.value !== null).map((item) => <div key={item.label} className="grid h-full min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-[var(--bg-surface-secondary)]/55 px-2.5 py-2"><dt className="text-[10px] font-semibold leading-4 text-[var(--text-muted)]">{item.label}</dt><dd className="min-w-[4.25rem] shrink-0 rounded-md text-center tabular-nums bg-[#FF8A1F]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#FF9E45]">{item.value}</dd></div>)}
          </dl>
        </TechnicalSection>
        <TechnicalSection title="Güvenlik Donanımı" items={security} columns="wide" />
        <TechnicalSection title="Ek Donanım" items={additional} columns="wide" />
      </div>
    </section>
  );
}