import { Armchair, BellRing, Building2, CircleDollarSign, DoorOpen, Hash, Layers3, MapPin, PanelTop, Sparkles } from 'lucide-react';
import type { MemberListingDetail } from '@/types';
import { formatCurrency } from '@/lib/utils/format';

type PropertyInfoItem = {
  label: string;
  value: React.ReactNode;
  icon: typeof Building2;
  accent?: boolean;
};

function PropertySection({ title, items, grow = false }: { title: string; items: PropertyInfoItem[]; grow?: boolean }) {
  const visibleItems = items.filter((item) => item.value !== null && item.value !== undefined && item.value !== '');
  if (!visibleItems.length) return null;

  return <section className={grow ? 'flex flex-1 flex-col' : ''}>
    <h2 className="mb-3 flex items-center gap-2 text-base font-black text-[var(--text-main)] sm:text-[17px]">
      <Sparkles className="h-[18px] w-[18px] text-[#FF8A1F]" />
      {title}
    </h2>
    <dl className={`grid auto-rows-fr grid-cols-1 gap-2.5 sm:grid-cols-2 ${grow ? 'flex-1 content-start' : ''}`}>
      {visibleItems.map(({ label, value, icon: Icon, accent }) => <div key={label} className="flex h-full min-h-14 items-center gap-3 rounded-xl bg-[var(--bg-surface-secondary)]/55 px-3.5 py-3">
        <Icon className="h-[18px] w-[18px] shrink-0 text-[#FF8A1F]" />
        <div className="min-w-0 flex-1">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.055em] text-[var(--text-dim)]">{label}</dt>
          <dd className={`mt-1 break-words text-sm font-bold leading-[1.15rem] ${accent ? 'text-[#FF9E45]' : 'text-[var(--text-main)]'}`}>{value}</dd>
        </div>
      </div>)}
    </dl>
  </section>;
}

export function PropertyDetailsPanel({ listing }: { listing: MemberListingDetail }) {
  const details = listing.property_details;
  if (!details) return null;
  const propertyItems: PropertyInfoItem[] = [
    { label: 'Konum', value: listing.location, icon: MapPin, accent: true },
    { label: 'Mülk Türü', value: details.property_type, icon: Building2 },
    { label: 'Oda Sayısı', value: details.room_count, icon: DoorOpen },
    { label: 'Oda No', value: Number.isInteger(details.room_number) ? details.room_number : null, icon: Hash },
    { label: 'Bulunduğu Kat', value: Number.isFinite(details.floor) ? `${details.floor}. Kat` : null, icon: Layers3 },
    { label: 'Yapı Tipi', value: details.building_type, icon: Building2 },
    { label: 'Eşyalı', value: details.furnished ? 'Evet' : 'Hayır', icon: Armchair },
    { label: 'Alarm', value: details.alarm === true ? 'Var' : details.alarm === false ? 'Yok' : null, icon: BellRing },
  ];
  const financialItems: PropertyInfoItem[] = [
    { label: 'Piyasa Fiyatı', value: details.market_value ? formatCurrency(details.market_value) : null, icon: CircleDollarSign, accent: true },
    { label: 'Eşya Bedeli', value: details.furnished && details.furniture_value ? formatCurrency(details.furniture_value) : null, icon: Armchair, accent: true },
    { label: 'Balkon / Teras', value: details.balcony ? 'Var' : 'Yok', icon: PanelTop },
  ];

  return <section data-testid="property-details-panel" className="flex h-full flex-col rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-4 shadow-[0_12px_36px_rgba(0,0,0,.09)] sm:p-5">
    <PropertySection title="Mülk Detayları" items={propertyItems} grow />
    <div className="my-5 border-t border-[var(--border-app)]/80" />
    <PropertySection title="Fiyat ve Ek Bilgiler" items={financialItems} grow />
  </section>;
}
