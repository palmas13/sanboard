import React from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getDealerRepository, getListingRepository } from '@/lib/db/repositories';
import { ListingCard } from '@/components/listings/ListingCard';
import { CorporateStoreFollow } from '@/components/dealers/CorporateStoreFollow';
import { SanboardImage } from '@/components/media/SanboardImage';
import {
  BadgeCheck,
  MapPin,
  Phone,
  Mail,
  Car,
  Home,
  Calendar,
  AlertCircle,
  Share2,
} from 'lucide-react';
import { formatDate } from '@/lib/utils/format';
import { isPublicListingVisible } from '@/lib/listings/visibility';
import { resolveMediaUrl } from '@/lib/media/url';
import { normalizeSocialMedia } from '@/lib/dealers/social';
import { verifySessionToken } from '@/lib/auth/session';
import { getAbsoluteUrl, getCorporateUrl } from '@/lib/urls';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 60; // 1-minute ISR for public store vitrin

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const dealer = await getDealerRepository().getDealerBySlug(slug);
  const now = Date.now();
  if (!dealer || dealer.status !== 'APPROVED' || dealer.moderation_status !== 'ACTIVE'
    || dealer.subscription_status !== 'ACTIVE' || !dealer.subscription_expires_at
    || new Date(dealer.subscription_expires_at).getTime() <= now || dealer.deleted_at) return {};
  const canonical = getAbsoluteUrl(getCorporateUrl(dealer));
  const image = resolveMediaUrl(dealer.logo_path || dealer.logo_url);
  return {
    title: dealer.company_name,
    description: dealer.description,
    alternates: { canonical },
    openGraph: { title: dealer.company_name, description: dealer.description, url: canonical, images: image ? [image] : undefined },
  };
}

export default async function CorporateStorePage({ params }: PageProps) {
  const { slug } = await params;
  const dealerRepo = getDealerRepository();
  const dealer: any = await dealerRepo.getDealerBySlug(slug);

  if (
    !dealer ||
    dealer.status !== 'APPROVED' ||
    dealer.subscription_status !== 'ACTIVE' ||
    !dealer.subscription_expires_at ||
    new Date(dealer.subscription_expires_at).getTime() <= Date.now() ||
    dealer.moderation_status !== 'ACTIVE' ||
    dealer.deleted_at
  ) {
    notFound();
  }
  if (dealer.slug !== slug) permanentRedirect(getCorporateUrl(dealer));

  // Follower count lookup
  let followerCount = dealer.follower_count || 0;
  if (!dealer.follower_count && typeof (dealerRepo as any).getFollowers === 'function') {
    try {
      const followersList = await (dealerRepo as any).getFollowers(dealer.id);
      followerCount = followersList.length;
    } catch {
      // Ignore
    }
  }

  // Check initial follow state on server to eliminate F5 flicker (Sections 15-17)
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('sanboard_session')?.value;
  let activeProfileId: string | undefined;
  if (sessionCookie) {
    const verified = verifySessionToken(sessionCookie);
    if (verified?.profileId) activeProfileId = verified.profileId;
  }

  let initialIsFollowing: boolean | null = null;
  if (activeProfileId && dealer?.id && typeof (dealerRepo as any).isFollowing === 'function') {
    try {
      initialIsFollowing = await (dealerRepo as any).isFollowing(activeProfileId, dealer.id);
    } catch {
      initialIsFollowing = null;
    }
  }

  const isSuspended = dealer.moderation_status === 'SUSPENDED';

  const listingRepo = getListingRepository();
  const allListings = await listingRepo.getCorporateListings(dealer.id);
  // While suspended, corporate listings are removed from public marketplace visibility (Section 14)
  const vehicles = isSuspended ? [] : allListings.filter((l) => l.category === 'vehicle' && isPublicListingVisible(l, dealer));
  const properties = isSuspended ? [] : allListings.filter((l) => l.category === 'property' && isPublicListingVisible(l, dealer));

  const mapToSummary = (l: any) => ({
    id: l.id,
    public_id: l.public_id,
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
    is_featured: l.is_featured,
  });

  const vehicleSummaries = vehicles.map(mapToSummary);
  const propertySummaries = properties.map(mapToSummary);

  const logoSrc = resolveMediaUrl(dealer.logo_path || dealer.logo_url);
  const bannerSrc = resolveMediaUrl(dealer.banner_path || dealer.banner_url);

  const isExpired = dealer.subscription_status === 'EXPIRED';

  return (
    <div className="space-y-8 pb-16">
      {/* Top Banner Image */}
      <div className="relative h-48 sm:h-72 w-full overflow-hidden bg-[var(--bg-surface-secondary)] border-b border-[var(--border-app)]">
        {bannerSrc ? (
          <SanboardImage
            src={bannerSrc}
            alt={dealer.company_name}
            fill
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-[#1a1208] to-[var(--bg-surface-secondary)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-app)] via-black/40 to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Expired Subscription Notice Banner */}
        {isExpired && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>
              Bu işletmenin kurumsal Sanboard üyeliği sona ermiştir. Önceden yayınlanmış ilanlar süreleri dolana kadar yayında kalır.
            </span>
          </div>
        )}

        {/* Dealer Header Profile Card */}
        <div className="surface-card -mt-20 sm:-mt-24 p-6 sm:p-8 rounded-2xl border border-[var(--border-app)] shadow-2xl relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 flex-1 min-w-0">
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-4 border-[var(--bg-surface)] shadow-lg bg-[var(--bg-surface)] shrink-0 flex items-center justify-center">
              {logoSrc ? (
                <SanboardImage
                  src={logoSrc}
                  alt={dealer.company_name}
                  fill
                  sizes="(max-width: 640px) 96px, 112px"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] flex items-center justify-center text-3xl font-black">
                  {dealer.company_name?.charAt(0) || 'M'}
                </div>
              )}
            </div>
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-main)]">
                  {dealer.company_name}
                </h1>
                {dealer.is_verified && <BadgeCheck aria-label="Doğrulanmış kurumsal profil" className="h-5 w-5 shrink-0 text-[#FF8A1F]" />}
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
              </div>

              {/* Social Media Links (Sections 18-23: Up to 2 non-empty valid entries) */}
              {(() => {
                const links = normalizeSocialMedia(dealer.social_media);
                if (links.length === 0) return null;
                return (
                  <div className="flex items-center gap-3 pt-1 flex-wrap">
                    {links.map((link, idx) => (
                      <a
                        key={idx}
                        href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-app)] bg-[var(--bg-surface-secondary)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--text-main)] transition-colors hover:bg-[#FF8A1F]/20 hover:text-[#FF8A1F]"
                      >
                        <Share2 className="w-3 h-3 text-[#FF8A1F]" />
                        <span>{link.name}</span>
                        <span className="text-[9px]">↗</span>
                      </a>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Quick Contact Info & Follow Actions */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-3 w-full md:w-auto shrink-0">
            <CorporateStoreFollow
              dealerId={dealer.id}
              initialFollowerCount={followerCount}
              initialIsFollowing={initialIsFollowing}
            />

            <div className="bg-[var(--bg-surface-secondary)] p-4 rounded-xl border border-[var(--border-app)] text-xs space-y-2">
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
        </div>

        {/* Listings Section */}
        <div className="space-y-12">
          {/* Vehicles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-app)]">
              <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                <Car className="w-5 h-5 text-[#FF8A1F]" />
                <span>Araç İlanları ({vehicleSummaries.length})</span>
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
                <span>Mülk İlanları ({propertySummaries.length})</span>
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
