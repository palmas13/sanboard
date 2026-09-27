import { Building2, Calendar, Home, MapPin, User } from 'lucide-react';
import type { Listing } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils/format';

export interface PropertyComparisonRow {
  key: string;
  label: string;
  values: string[];
}

export function getPropertyComparisonRows(listings: Listing[]): PropertyComparisonRow[] {
  const seller = (listing: Listing) => listing.dealer?.company_name || listing.seller?.full_name || (listing.seller_type === 'CORPORATE' ? 'Kurumsal satıcı' : 'Bireysel satıcı');
  return [
    { key: 'price', label: 'Fiyat', values: listings.map((item) => formatCurrency(item.price)) },
    { key: 'location', label: 'Bölge / Konum', values: listings.map((item) => item.location || 'Belirtilmemiş') },
    { key: 'property-type', label: 'Mülk Türü', values: listings.map((item) => item.property_details?.property_type || item.subcategory || 'Belirtilmemiş') },
    { key: 'seller', label: 'Satıcı', values: listings.map(seller) },
    { key: 'published-at', label: 'İlan Tarihi', values: listings.map((item) => formatDate(item.published_at)) },
    { key: 'room-count', label: 'Oda Sayısı', values: listings.map((item) => item.property_details?.room_count || 'Belirtilmemiş') },
    { key: 'floor', label: 'Kat', values: listings.map((item) => item.property_details?.floor === undefined ? 'Belirtilmemiş' : String(item.property_details.floor)) },
    { key: 'building-type', label: 'Yapı Tipi', values: listings.map((item) => item.property_details?.building_type || 'Belirtilmemiş') },
    { key: 'furnished', label: 'Eşyalı', values: listings.map((item) => item.property_details ? (item.property_details.furnished ? 'Evet' : 'Hayır') : 'Belirtilmemiş') },
    { key: 'balcony', label: 'Balkon / Teras', values: listings.map((item) => item.property_details ? (item.property_details.balcony ? 'Var' : 'Yok') : 'Belirtilmemiş') },
  ];
}

const icons = [Home, MapPin, Building2, User, Calendar];

export function PropertyComparisonGrid({ listings }: { listings: Listing[] }) {
  const rows = getPropertyComparisonRows(listings);
  return <div className="space-y-3" data-testid="property-comparison-stacked">
    {rows.map((row, index) => {
      const Icon = icons[index % icons.length];
      return <section key={row.key} className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-4">
        <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]"><Icon className="h-4 w-4 text-[#FF8A1F]" />{row.label}</h2>
        <div className={`grid grid-cols-1 gap-2 ${listings.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
          {row.values.map((value, valueIndex) => <div key={`${row.key}-${listings[valueIndex].id}`} className="rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)] p-3">
            <p className="mb-1 truncate text-[10px] font-semibold text-[var(--text-dim)]">{listings[valueIndex].title}</p>
            <p className="text-sm font-bold text-[var(--text-main)]">{value}</p>
          </div>)}
        </div>
      </section>;
    })}
  </div>;
}