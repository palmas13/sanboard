import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { CircleOff, Lock, Settings2 } from 'lucide-react';
import { getListingRepository } from '@/lib/db/repositories';
import { getServerSession } from '@/lib/auth/session';
import { ListingGallery } from '@/components/listings/ListingGallery';
import { SellerCard } from '@/components/listings/SellerCard';
import { FavoriteButton } from '@/components/listings/FavoriteButton';
import { ReportModal } from '@/components/listings/ReportModal';
import { CompareButton } from '@/components/compare/CompareButton';
import { SimilarListings } from '@/components/listings/SimilarListings';
import { CopyListingLinkButton } from '@/components/listings/CopyListingLinkButton';
import { PropertyCompareButton } from '@/components/compare/PropertyCompareButton';
import { getOptionalSimilarListings } from '@/lib/db/optional-listing-data';
import type { MemberListingDetail } from '@/types';
import { sortListingImages } from '@/lib/listings/images';
import { OfferButton } from '@/components/offers/OfferButton';
import { getListingUrl, parseListingRouteIdentifier } from '@/lib/urls';
import { GENERIC_SHARE_DATA, resolveListingShareData } from '@/lib/seo/listing-share';
import { SITE_NAME } from '@/lib/seo/site-metadata';
import { VehicleDetailsPanel } from '@/components/listings/detail/VehicleDetailsPanel';
import { PropertyDetailsPanel } from '@/components/listings/detail/PropertyDetailsPanel';
import { ListingDescription } from '@/components/listings/detail/ListingDescription';
import { ListingDetailHeader } from '@/components/listings/detail/ListingDetailHeader';
import { SafeShoppingCard } from '@/components/listings/detail/SafeShoppingCard';

interface PageProps { params: Promise<{ id: string }> }
export const revalidate = 30;

async function resolveListing(identifier: string, profileId?: string, userId?: string) {
  const repo = getListingRepository();
  const parsed = parseListingRouteIdentifier(identifier);
  return parsed.publicId ? repo.getListingByPublicId(parsed.publicId, profileId, userId) : repo.getListingById(parsed.legacyId!, profileId, userId);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const listing = await resolveListingShareData(id);
  const share = listing || GENERIC_SHARE_DATA;
  return { title: share.title, description: share.description, alternates: { canonical: share.canonical }, openGraph: { title: share.title, description: share.description, url: share.canonical, siteName: SITE_NAME, type: 'website', images: [{ url: share.ogImage, width: 1200, height: 630, alt: share.title }] }, twitter: { card: 'summary_large_image', title: share.title, description: share.description, images: [share.ogImage] } };
}

function SellerArea({ listing, isLocked, isOwner, closedLabel }: { listing: MemberListingDetail; isLocked: boolean; isOwner: boolean; closedLabel: string | null }) {
  if (isLocked) return <><div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 text-center shadow-[0_18px_55px_rgba(0,0,0,.16)]"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-surface-secondary)] text-[var(--text-dim)]"><Lock className="h-5 w-5" /></div><h2 className="mt-4 text-sm font-black">Satıcı Bilgileri Kilitli</h2><p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">Satıcıyla iletişime geçmek ve görünür iletişim bilgilerini görmek için giriş yapınız.</p><Link href={`/giris?redirect=${getListingUrl(listing)}`} className="btn-primary mt-4 w-full text-xs">Giriş Yap</Link></div><SafeShoppingCard /></>;

  const actions = isOwner ? <Link href="/hesabim/ilanlarim" className="btn-primary w-full text-xs"><Settings2 className="h-4 w-4" />İlanı Yönet</Link> : !closedLabel && listing.offers_enabled !== false ? <OfferButton listing={listing} className="w-full text-xs" /> : null;
  return <><SellerCard seller={listing.seller} dealer={listing.dealer} actions={actions} /><SafeShoppingCard /></>;
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getServerSession();
  const repo = getListingRepository();
  const result = await resolveListing(id, session?.profileId, session?.userId);
  if (!result.listing) notFound();
  const listing = result.listing;
  const canonicalPath = getListingUrl(listing);
  if (`/ilan/${id}` !== canonicalPath) permanentRedirect(canonicalPath);

  const isVehicle = listing.category === 'vehicle';
  const publicCoverImage = 'cover_image' in listing ? listing.cover_image : undefined;
  const galleryImages = sortListingImages('images' in listing && listing.images ? listing.images : publicCoverImage ? [{ id: `cover-${listing.id}`, listing_id: listing.id, storage_path: publicCoverImage, sort_order: 0, is_cover: true, size_bytes: 0, created_at: listing.published_at || '' }] : []);
  const status = 'status' in listing ? listing.status : undefined;
  const closedLabel = status === 'SOLD' ? 'Bu ilan satıldı' : status === 'REMOVED' ? 'Bu ilan yayından kaldırıldı' : status === 'EXPIRED' ? 'Bu ilanın süresi doldu' : null;
  const categoryLink = isVehicle ? '/arac' : '/mulk';
  const categoryName = isVehicle ? 'Araç' : 'Mülk';
  const memberListing = listing as MemberListingDetail;
  const similarListings = isVehicle ? await getOptionalSimilarListings(repo, id, 6) : [];
  const detailReady = !result.isLocked;

  const headerActions = <div data-testid="listing-actions" className="flex flex-wrap gap-2">
    {!closedLabel ? <FavoriteButton listingId={listing.id} initialCount={listing.favorite_count} initialIsFavorited={memberListing.is_favorited} showCount={false} /> : null}
    <CopyListingLinkButton path={canonicalPath} />
    {!result.isOwner ? <ReportModal listingId={listing.id} /> : null}
    {isVehicle ? <CompareButton listing={listing} /> : !closedLabel ? <PropertyCompareButton listing={listing} /> : null}
  </div>;

  return <main className="mx-auto w-full max-w-[1500px] space-y-5 px-3 py-4 sm:px-5 lg:px-7 lg:py-6">
    {closedLabel ? <div role="status" className="flex items-center gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/8 p-4 text-sm font-semibold text-amber-200"><CircleOff className="h-5 w-5 shrink-0" /><div><p>{closedLabel}</p><p className="mt-0.5 text-xs font-normal text-[var(--text-muted)]">İlan bilgileri arşiv amacıyla görüntüleniyor; yeni iletişim ve favori işlemleri kapalıdır.</p></div></div> : null}

    <ListingDetailHeader listing={listing} categoryHref={categoryLink} categoryName={categoryName} actions={headerActions} />

    {isVehicle ? <section data-testid="vehicle-listing-layout" className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,.9fr)_minmax(290px,.75fr)]">
      <div data-testid="vehicle-left-column" className="listing-detail-left-column flex min-w-0 flex-col gap-5 md:col-span-2 xl:col-span-1">
        <ListingGallery images={galleryImages} title={listing.title} isLocked={result.isLocked} variant="vehicle" />
        {detailReady ? <ListingDescription listing={memberListing} /> : null}
      </div>
      <div data-testid="vehicle-middle-column" className="listing-detail-middle-column min-w-0 md:col-start-1 xl:col-start-auto">
        {detailReady ? <VehicleDetailsPanel listing={memberListing} /> : <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--text-muted)]">Teknik detayları görmek için giriş yapınız.</div>}
      </div>
      <aside data-testid="vehicle-right-column" className="listing-detail-right-column min-w-0 space-y-4 md:col-start-2 xl:col-start-auto xl:sticky xl:top-24">
        <SellerArea listing={memberListing} isLocked={result.isLocked} isOwner={result.isOwner} closedLabel={closedLabel} />
      </aside>
    </section> : <section data-testid="property-listing-layout" className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(380px,1fr)]">
      <div data-testid="property-left-column" className="listing-detail-left-column flex min-w-0 flex-col gap-5">
        <ListingGallery images={galleryImages} title={listing.title} isLocked={result.isLocked} variant="property" />
        {detailReady ? <ListingDescription listing={memberListing} /> : null}
      </div>
      <aside data-testid="property-right-column" className="listing-detail-right-column min-w-0 space-y-4 lg:sticky lg:top-24">
        {detailReady ? <PropertyDetailsPanel listing={memberListing} /> : null}
        <SellerArea listing={memberListing} isLocked={result.isLocked} isOwner={result.isOwner} closedLabel={closedLabel} />
      </aside>
    </section>}

    {isVehicle && similarListings.length > 0 ? <SimilarListings listings={similarListings} /> : null}
  </main>;
}