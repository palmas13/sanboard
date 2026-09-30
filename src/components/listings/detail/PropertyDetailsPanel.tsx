import { Armchair, Building2, DoorOpen, Layers3, MapPin, PanelTop } from 'lucide-react';
import type { MemberListingDetail } from '@/types';
import { formatCurrency } from '@/lib/utils/format';

export function PropertyDetailsPanel({ listing }: { listing: MemberListingDetail }) {
  const details = listing.property_details;
  if (!details) return null;
  const items = [
    { label: 'Konum', value: listing.location, icon: MapPin, accent: true },
    { label: 'Mülk Türü', value: details.property_type, icon: Building2 },
    { label: 'Oda Sayısı', value: details.room_count, icon: DoorOpen },
    { label: 'Bulunduğu Kat', value: Number.isFinite(details.floor) ? `${details.floor}. Kat` : null, icon: Layers3 },
    { label: 'Yapı Tipi', value: details.building_type, icon: Building2 },
    { label: 'Eşyalı', value: details.furnished ? 'Evet' : 'Hayır', icon: Armchair },
    { label: 'Market Değeri', value: details.market_value ? formatCurrency(details.market_value) : null, icon: Building2, accent: true },
    { label: 'Eşya Bedeli', value: details.furnished && details.furniture_value ? formatCurrency(details.furniture_value) : null, icon: Armchair },
    { label: 'Balkon / Teras', value: details.balcony ? 'Var' : 'Yok', icon: PanelTop },
  ].filter((item) => item.value !== null && item.value !== undefined && item.value !== '');

  return <section data-testid="property-details-panel" className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-4 shadow-[0_12px_36px_rgba(0,0,0,.09)]">
    <h2 className="mb-3 text-[13px] font-black text-[var(--text-main)]">Mülk Detayları</h2>
    <dl className="grid auto-rows-fr grid-cols-2 gap-1.5">
      {items.map(({ label, value, icon: Icon, accent }) => <div key={label} className="flex h-full min-h-10 items-center gap-2 rounded-lg bg-[var(--bg-surface-secondary)]/55 px-2.5 py-2">
        <Icon className="h-4 w-4 shrink-0 text-[#FF8A1F]" />
        <div className="min-w-0 flex-1"><dt className="text-[10px] font-semibold text-[var(--text-dim)]">{label}</dt><dd className={`mt-px break-words text-xs font-bold leading-4 ${accent ? 'text-[#FF9E45]' : 'text-[var(--text-main)]'}`}>{value}</dd></div>
      </div>)}
    </dl>
  </section>;
}