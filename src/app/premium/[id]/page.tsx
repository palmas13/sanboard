import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getDealerRepository, getListingRepository } from '@/lib/db/repositories';
import { ListingCard } from '@/components/listings/ListingCard';
import {
  Crown,
  MapPin,
  Phone,
  Mail,
  Car,
  Home,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { formatDate } from '@/lib/utils/format';
import { resolveMediaUrl } from '@/lib/media/url';
import { isUuid } from '@/lib/db/id-mapper';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const revalidate = 60; // 1-minute ISR for public store vitrin

export default async function PremiumStoreVitrinPage({ params }: PageProps) {
  const { id } = await params;
  const dealerRepo = getDealerRepository();

  let dealer: any = null;

  // 1. If numeric public_id
  if (/^\d+$/.test(id)) {
    const numId = parseInt(id, 10);
    // Try lookup by public_id if method exists or query repo
    if (typeof (dealerRepo as any).getDealerByPublicId === 'function') {
      dealer = await (dealerRepo as any).getDealerByPublicId(numId);
    }
  }

  // 2. If UUID lookup
  if (!dealer && isUuid(id)) {
    dealer = await dealerRepo.getDealerById(id);
    // If dealer has a sequential public_id, redirect to canonical /premium/[public_id]
    if (dealer && dealer.public_id) {
      redirect(`/premium/${dealer.public_id}`);
    }
  }

  // 3. Fallbacks: profile ID or slug
  if (!dealer) {
    dealer = await dealerRepo.getDealerByProfileId(id);
  }
  if (!dealer) {
    dealer = await dealerRepo.getDealerBySlug(id);
  }

  // 4. Default fallback: if id is '1' and no public_id yet, fallback to first approved store
  if (!dealer && id === '1') {
    const all = await dealerRepo.getDealerById('dealer-apex-01');
    dealer = all;
  }

  if (!dealer || dealer.status !== 'APPROVED') {
    notFound();
  }

  const ownerProfileId = dealer.owner_profile_id || dealer.profile_id;
  const listingRepo = getListingRepository();
  const allListings = await listingRepo.getUserListings(ownerProfileId);
  const vehicles = allListings.filter((l) => l.category === 'vehicle' && l.status === 'ACTIVE');
  const properties = allListings.filter((l) => l.category === 'property' && l.status === 'ACTIVE');

  const mapToSummary = (l: any) => ({
    id: l.id,
    listing_number: l.listing_number,
    category: l.category,
    subcategory: l.subcategory,
    title: l.title,
    price: l.price,
    location: l.location,
    published_at: l.published_at,
    cover_image: l.images?.find((i: any) => i.is_cover)?.storage_path || l.images?.[0]?.storage_path,
    favorite_count: l.favorite_count || 0,
    is_locked: true as const,
  });

  const vehicleSummaries = vehicles.map(mapToSummary);
  const propertySummaries = properties.map(mapToSummary);

  const logoSrc = resolveMediaUrl(dealer.logo_path || dealer.logo_url);
  const bannerSrc = resolveMediaUrl(dealer.banner_path || dealer.banner_url);

  return (
    <div className="space-y-8 pb-16">
      {/* Top Banner Image */}
      <div className="relative h-48 sm:h-72 w-full overflow-hidden bg-[var(--bg-surface-secondary)] border-b border-[var(--border-app)]">
        {bannerSrc ? (
          <img
            src={bannerSrc}
            alt={dealer.company_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-[#1a1208] to-[var(--bg-surface-secondary)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-app)] via-black/40 to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Dealer Header Profile Card */}
        <div className="surface-card -mt-20 sm:-mt-24 p-6 sm:p-8 rounded-2xl border border-[var(--border-app)] shadow-2xl relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-4 border-[var(--bg-surface)] shadow-lg bg-[var(--bg-surface)] shrink-0 flex items-center justify-center">
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt={dealer.company_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] flex items-center justify-center text-3xl font-black">
                  {dealer.company_name?.charAt(0) || 'M'}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-main)]">
                  {dealer.company_name}
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] border border-[#FF8A1F]/30 text-xs font-black shadow-sm">
                  <Crown className="w-3.5 h-3.5 fill-current" />
                  <span>PREMIUM SATICI</span>
                </span>
                {dealer.public_id && (
                  <span className="text-xs font-mono text-[var(--text-dim)] px-2 py-0.5 rounded bg-[var(--bg-surface-secondary)] border border-[var(--border-app)]">
                    #{dealer.public_id}
                  </span>
                )}
              </div>

              {dealer.description && (
                <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-2xl leading-relaxed">
                  {dealer.description}
                </p>
              )}

              <div className="flex items-center gap-4 text-xs text-[var(--text-dim)] pt-1 flex-wrap">
                {dealer.address && (
                  <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                    <MapPin className="w-3.5 h-3.5 text-[#FF8A1F] shrink-0" />
                    <span>{dealer.address}</span>
                  </div>
                )}
                {dealer.created_at && (
                  <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                    <Calendar className="w-3.5 h-3.5 text-[var(--text-dim)] shrink-0" />
                    <span>Kayıt: {formatDate(dealer.created_at)}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-emerald-400 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Doğrulanmış Kurumsal Üye</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Contact Info */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 w-full md:w-auto shrink-0 bg-[var(--bg-surface-secondary)] p-4 rounded-xl border border-[var(--border-app)] text-xs">
            {dealer.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#FF8A1F] shrink-0" />
                <span className="font-mono font-bold text-[var(--text-main)]">{dealer.phone}</span>
              </div>
            )}
            {(dealer.sanmail_email || dealer.email) && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#FF8A1F] shrink-0" />
                <span className="text-[var(--text-muted)] truncate max-w-[200px]">
                  {dealer.sanmail_email || dealer.email}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Listings Section */}
        <div className="space-y-12">
          {/* Vehicles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-app)]">
              <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                <Car className="w-5 h-5 text-[#FF8A1F]" />
                <span>Araç Galerisi ({vehicleSummaries.length})</span>
              </h2>
            </div>

            {vehicleSummaries.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {vehicleSummaries.map((listing: any) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-dim)] py-6 text-center">
                Bu mağazanın şu anda yayında araç ilanı bulunmuyor.
              </p>
            )}
          </div>

          {/* Properties */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-app)]">
              <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                <Home className="w-5 h-5 text-[#FF8A1F]" />
                <span>Emlak Portföyü ({propertySummaries.length})</span>
              </h2>
            </div>

            {propertySummaries.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {propertySummaries.map((listing: any) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-dim)] py-6 text-center">
                Bu mağazanın şu anda yayında mülk ilanı bulunmuyor.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
