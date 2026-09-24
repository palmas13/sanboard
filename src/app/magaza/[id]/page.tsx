import React from 'react';
import { notFound } from 'next/navigation';
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

interface PageProps {
  params: Promise<{ id: string }>;
}

export const revalidate = 0;

export default async function MagazaVitrinPage({ params }: PageProps) {
  const { id } = await params;
  const dealerRepo = getDealerRepository();
  let dealer = await dealerRepo.getDealerById(id);

  // If not found by dealer ID, search by profile ID or slug
  if (!dealer) {
    dealer = await dealerRepo.getDealerByProfileId(id);
  }
  if (!dealer) {
    dealer = await dealerRepo.getDealerBySlug(id);
  }

  if (!dealer || dealer.status !== 'APPROVED') {
    notFound();
  }

  const ownerProfileId = (dealer as any).owner_profile_id || (dealer as any).profile_id;
  const listingRepo = getListingRepository();
  const allListings = await listingRepo.getUserListings(ownerProfileId);
  const vehicles = allListings.filter((l) => l.category === 'vehicle' && l.status === 'ACTIVE');
  const properties = allListings.filter((l) => l.category === 'property' && l.status === 'ACTIVE');

  // Map to public listing format for cards
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

  return (
    <div className="space-y-8 pb-16">
      {/* Top Banner Image */}
      <div className="relative h-48 sm:h-72 w-full overflow-hidden bg-[var(--bg-surface-secondary)] border-b border-[var(--border-app)]">
        <img
          src={dealer.banner_url || 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1600'}
          alt={dealer.company_name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-app)] via-black/40 to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Dealer Header Profile Card */}
        <div className="surface-card -mt-20 sm:-mt-24 p-6 sm:p-8 rounded-2xl border border-[var(--border-app)] shadow-2xl relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <img
              src={dealer.logo_url || 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=300'}
              alt={dealer.company_name}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-4 border-[var(--bg-surface)] shadow-lg bg-[var(--bg-surface)] shrink-0"
            />
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-main)]">
                  {dealer.company_name}
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] border border-[#FF8A1F]/30 text-xs font-black shadow-sm">
                  <Crown className="w-3.5 h-3.5 fill-current" />
                  <span>PREMIUM SATICI</span>
                </span>
              </div>

              <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-2xl leading-relaxed">
                {dealer.description}
              </p>

              <div className="flex items-center gap-4 text-xs text-[var(--text-dim)] pt-1 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[var(--color-success)]" />
                  <span>Onaylı Kurumsal Galeri</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  <span>Kayıt: {formatDate(dealer.created_at)}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Contact Box */}
          <div className="w-full md:w-auto p-4 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] space-y-2.5 shrink-0 text-xs">
            <div className="flex items-center gap-2 text-[var(--text-main)] font-semibold">
              <MapPin className="w-4 h-4 text-[#FF8A1F] shrink-0" />
              <span>{dealer.address || 'Los Santos, San Andreas'}</span>
            </div>
            {dealer.phone && (
              <div className="flex items-center gap-2 text-[var(--text-muted)]">
                <Phone className="w-4 h-4 text-[#FF8A1F] shrink-0" />
                <span className="font-mono font-bold text-[var(--text-main)]">{dealer.phone}</span>
              </div>
            )}
            {dealer.sanmail_email && (
              <div className="flex items-center gap-2 text-[var(--text-muted)]">
                <Mail className="w-4 h-4 text-[#FF8A1F] shrink-0" />
                <span className="truncate max-w-[200px]">{dealer.sanmail_email}</span>
              </div>
            )}
          </div>
        </div>

        {/* ACTIVE VEHICLE LISTINGS */}
        <section className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-app)]">
            <h2 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
              <Car className="w-5 h-5 text-[#FF8A1F]" />
              <span>Aktif Araç İlanları ({vehicleSummaries.length})</span>
            </h2>
          </div>

          {vehicleSummaries.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {vehicleSummaries.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <div className="surface-card p-10 text-center text-xs text-[var(--text-muted)]">
              Bu kurumsal mağazanın şu anda aktif araç ilanı bulunmuyor.
            </div>
          )}
        </section>

        {/* ACTIVE PROPERTY LISTINGS */}
        <section className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-app)]">
            <h2 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
              <Home className="w-5 h-5 text-[#FF8A1F]" />
              <span>Aktif Mülk İlanları ({propertySummaries.length})</span>
            </h2>
          </div>

          {propertySummaries.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {propertySummaries.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <div className="surface-card p-10 text-center text-xs text-[var(--text-muted)]">
              Bu kurumsal mağazanın şu anda aktif mülk ilanı bulunmuyor.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
