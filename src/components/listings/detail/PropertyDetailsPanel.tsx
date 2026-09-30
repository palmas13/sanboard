import { Armchair, Building2, DoorOpen, Layers3, MapPin, PanelTop } from 'lucide-react';
import type { MemberListingDetail } from '@/types';
import { ListingInfoSection } from './ListingInfoSection';
import { formatCurrency } from '@/lib/utils/format';

export function PropertyDetailsPanel({ listing }: { listing: MemberListingDetail }) {
  const details = listing.property_details;
  if (!details) return null;
  return <div data-testid="property-details-panel"><ListingInfoSection title="Mülk Detayları" items={[
    { label: 'Konum', value: listing.location, icon: MapPin, accent: true },
    { label: 'Mülk Türü', value: details.property_type, icon: Building2 },
    { label: 'Oda Sayısı', value: details.room_count, icon: DoorOpen },
    { label: 'Bulunduğu Kat', value: Number.isFinite(details.floor) ? `${details.floor}. Kat` : null, icon: Layers3 },
    { label: 'Yapı Tipi', value: details.building_type, icon: Building2 },
    { label: 'Eşyalı', value: details.furnished ? 'Evet' : 'Hayır', icon: Armchair },
    { label: 'Market Değeri', value: details.market_value ? formatCurrency(details.market_value) : null, icon: Building2, accent: true },
    { label: 'Eşya Bedeli', value: details.furnished && details.furniture_value ? formatCurrency(details.furniture_value) : null, icon: Armchair },
    { label: 'Balkon / Teras', value: details.balcony ? 'Var' : 'Yok', icon: PanelTop },
  ]} /></div>;
}