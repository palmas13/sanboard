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
import { ListingDetailLayout } from '@/components/listings/detail/ListingDetailLayout';

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

  const manageHref = listing.seller_type === 'CORPORATE' ? `/hesabim/kurumsal?listing=${encodeURIComponent(listing.id)}#ilanlar` : `/hesabim/ilanlarim/${listing.id}/duzenle`;
  const actions = isOwner ? <Link href={manageHref} className="btn-primary w-full text-xs"><Settings2 className="h-4 w-4" />İlanı Yönet</Link> : !closedLabel && listing.offers_enabled !== false ? <OfferButton listing={listing} className="w-full text-xs" /> : null;
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

  const favoriteProof = !closedLabel ? <FavoriteButton listingId={listing.id} initialCount={listing.favorite_count} initialIsFavorited={memberListing.is_favorited} proofText /> : <span className="inline-block min-w-[16rem]">{listing.favorite_count || 0} kişi favoriledi</span>;
  const headerActions = <div data-testid="listing-actions" className="flex flex-wrap items-center gap-1.5 [&_button]:min-h-8 [&_button]:px-2.5 [&_a]:min-h-8 [&_a]:px-2.5">
    <CopyListingLinkButton path={canonicalPath} />
    {isVehicle ? <CompareButton listing={listing} /> : !closedLabel ? <PropertyCompareButton listing={listing} /> : null}
  </div>;
  const descriptionReport = !result.isOwner ? <ReportModal listingId={listing.id} compact /> : null;

  return <main className="mx-auto w-full max-w-[1580px] space-y-4 px-3 py-4 sm:px-5 lg:px-6 lg:py-5">
    {closedLabel ? <div role="status" className="flex items-center gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/8 p-4 text-sm font-semibold text-amber-200"><CircleOff className="h-5 w-5 shrink-0" /><div><p>{closedLabel}</p><p className="mt-0.5 text-xs font-normal text-[var(--text-muted)]">İlan bilgileri arşiv amacıyla görüntüleniyor; yeni iletişim ve favori işlemleri kapalıdır.</p></div></div> : null}

    <ListingDetailHeader listing={listing} categoryHref={categoryLink} categoryName={categoryName} actions={headerActions} favoriteProof={favoriteProof} />

    <ListingDetailLayout
      category={isVehicle ? 'vehicle' : 'property'}
      gallery={<ListingGallery images={galleryImages} title={listing.title} isLocked={result.isLocked} variant="vehicle" />}
      seller={<SellerArea listing={memberListing} isLocked={result.isLocked} isOwner={result.isOwner} closedLabel={closedLabel} />}
      description={detailReady ? <ListingDescription listing={memberListing} reportAction={descriptionReport} /> : undefined}
      details={detailReady
        ? (isVehicle ? <VehicleDetailsPanel listing={memberListing} /> : <PropertyDetailsPanel listing={memberListing} />)
        : <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--text-muted)]">İlan detaylarını görmek için giriş yapınız.</div>}
    />

    {isVehicle && similarListings.length > 0 ? <SimilarListings listings={similarListings} /> : null}
  </main>;
}