import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getUserRepository, getListingRepository } from '@/lib/db/repositories';
import { ListingCard } from '@/components/listings/ListingCard';
import { resolveAvatarUrl } from '@/lib/media/url';
import { isUuid } from '@/lib/db/id-mapper';
import { User, Calendar, Phone, Mail, Car, Home } from 'lucide-react';
import { formatDate } from '@/lib/utils/format';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const revalidate = 60; // 1-minute ISR for public character profile

export default async function PublicUserProfilePage({ params }: PageProps) {
  const { id } = await params;
  const userRepo = getUserRepository();

  let profile: any = null;

  // 1. If numeric public_id
  if (/^\d+$/.test(id)) {
    const numId = parseInt(id, 10);
    if (typeof (userRepo as any).getProfileByPublicId === 'function') {
      profile = await (userRepo as any).getProfileByPublicId(numId);
    }
  }

  // 2. If legacy UUID lookup
  if (!profile && isUuid(id)) {
    profile = await userRepo.getProfileById(id);
    // If profile has a canonical public_id, redirect permanently to /user/[public_id]
    if (profile && profile.public_id) {
      redirect(`/user/${profile.public_id}`);
    }
  }

  // 3. Fallback lookup by profile id string
  if (!profile) {
    profile = await userRepo.getProfileById(id);
    if (profile && profile.public_id) {
      redirect(`/user/${profile.public_id}`);
    }
  }

  if (!profile) {
    notFound();
  }

  const listingRepo = getListingRepository();
  const allListings = await listingRepo.getUserListings(profile.id);
  const activeListings = allListings.filter(
    (l) => l.status === 'ACTIVE' && l.seller_type !== 'CORPORATE' && !l.corporate_profile_id
  );
  const vehicles = activeListings.filter((l) => l.category === 'vehicle');
  const properties = activeListings.filter((l) => l.category === 'property');

  const avatarSrc = resolveAvatarUrl(profile.avatar_path || profile.avatar_url);
  const initials = profile.full_name
    ? profile.full_name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
    : 'U';

  const mapToSummary = (l: any) => ({
    id: l.id,
    listing_number: l.listing_number,
    category: l.category,
    subcategory: l.subcategory,
    title: l.title,
    price: l.price,
    previous_price: l.previous_price,
    location: l.location,
    published_at: l.published_at,
    cover_image: l.images?.find((i: any) => i.is_cover)?.storage_path || l.images?.[0]?.storage_path,
    favorite_count: l.favorite_count || 0,
    is_favorited: false,
  });

  const vehicleSummaries = vehicles.map(mapToSummary);
  const propertySummaries = properties.map(mapToSummary);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Profile Card */}
      <div className="surface-card p-6 sm:p-8 rounded-2xl border border-[var(--border-app)] shadow-sm">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          {/* Avatar */}
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#FF8A1F] bg-[var(--bg-surface-secondary)] shadow-md shrink-0 flex items-center justify-center">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={profile.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] flex items-center justify-center text-3xl font-black">
                {initials}
              </div>
            )}
          </div>

          {/* Profile Details */}
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center justify-center sm:justify-start gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--brand-orange-subtle)] text-[#FF8A1F] border border-[#FF8A1F]/30">
                <User className="w-3.5 h-3.5" />
                <span>Bireysel Satıcı</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-main)] tracking-tight">
              {profile.full_name}
            </h1>

            <div className="flex items-center justify-center sm:justify-start gap-4 text-xs text-[var(--text-muted)] flex-wrap pt-1">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[var(--text-dim)]" />
                <span>Üyelik: {formatDate(profile.created_at)}</span>
              </span>

              {profile.phone && (
                <span className="flex items-center gap-1 font-mono text-[var(--text-main)]">
                  <Phone className="w-3.5 h-3.5 text-[#FF8A1F]" />
                  <span>{profile.phone}</span>
                </span>
              )}

              {profile.sanmail_email && (
                <span className="flex items-center gap-1 text-[var(--text-main)]">
                  <Mail className="w-3.5 h-3.5 text-[#FF8A1F]" />
                  <span>{profile.sanmail_email}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Listings Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-app)]">
          <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
            <span>Yayındaki İlanları</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-surface-secondary)] text-[var(--text-muted)]">
              {activeListings.length}
            </span>
          </h2>
        </div>

        {activeListings.length === 0 ? (
          <div className="surface-card p-12 text-center rounded-2xl border border-[var(--border-app)] text-xs text-[var(--text-muted)]">
            Bu kullanıcının şu anda aktif bir ilanı bulunmuyor.
          </div>
        ) : (
          <div className="space-y-8">
            {/* Vehicle Listings */}
            {vehicleSummaries.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-wider flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-[#FF8A1F]" />
                  <span>Araç İlanları ({vehicleSummaries.length})</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {vehicleSummaries.map((listing) => (
                    <ListingCard key={listing.id} listing={listing as any} />
                  ))}
                </div>
              </div>
            )}

            {/* Property Listings */}
            {propertySummaries.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-wider flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5 text-[#FF8A1F]" />
                  <span>Mülk İlanları ({propertySummaries.length})</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {propertySummaries.map((listing) => (
                    <ListingCard key={listing.id} listing={listing as any} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
