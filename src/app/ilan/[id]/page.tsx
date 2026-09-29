import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { CalendarDays, CircleOff, Heart, Lock, MapPin, Settings2 } from 'lucide-react';
import { getListingRepository } from '@/lib/db/repositories';
import { getServerSession } from '@/lib/auth/session';
import { formatCurrency, formatDate } from '@/lib/utils/format';
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
  if (isLocked) return <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 text-center shadow-[0_18px_55px_rgba(0,0,0,.16)]"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-surface-secondary)] text-[var(--text-dim)]"><Lock className="h-5 w-5" /></div><h2 className="mt-4 text-sm font-black">Satıcı Bilgileri Kilitli</h2><p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">Satıcıyla iletişime geçmek ve görünür iletişim bilgilerini görmek için giriş yapınız.</p><Link href={`/giris?redirect=${getListingUrl(listing)}`} className="btn-primary mt-4 w-full text-xs">Giriş Yap</Link></div>;

  const actions = isOwner ? <Link href="/hesabim/ilanlarim" className="btn-primary w-full text-xs"><Settings2 className="h-4 w-4" />İlanı Yönet</Link> : !closedLabel ? <>{listing.offers_enabled !== false ? <OfferButton listing={listing} className="w-full text-xs" /> : null}<p className="text-center text-[10px] leading-4 text-[var(--text-dim)]">Görünür telefon veya SanMail bilgisini kullanarak satıcıyla iletişime geçebilirsiniz.</p></> : null;
  return <SellerCard seller={listing.seller} dealer={listing.dealer} actions={actions} />;
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

  return <main className="mx-auto max-w-[1480px] space-y-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 overflow-hidden text-xs text-[var(--text-dim)]"><Link href="/" className="shrink-0 hover:text-[#FF9E45]">Ana Sayfa</Link><span>/</span><Link href={categoryLink} className="shrink-0 hover:text-[#FF9E45]">{categoryName}</Link><span>/</span><span className="truncate">{listing.subcategory}</span>{detailReady && isVehicle && memberListing.vehicle_details?.brand ? <><span>/</span><span className="truncate">{memberListing.vehicle_details.brand}</span></> : null}{detailReady && isVehicle && memberListing.vehicle_details?.model ? <><span>/</span><span className="truncate text-[var(--text-muted)]">{memberListing.vehicle_details.model}</span></> : null}</nav>

    {closedLabel ? <div role="status" className="flex items-center gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/8 p-4 text-sm font-semibold text-amber-200"><CircleOff className="h-5 w-5 shrink-0" /><div><p>{closedLabel}</p><p className="mt-0.5 text-xs font-normal text-[var(--text-muted)]">İlan bilgileri arşiv amacıyla görüntüleniyor; yeni iletişim ve favori işlemleri kapalıdır.</p></div></div> : null}

    <header data-testid="listing-detail-header" className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-5 shadow-[0_18px_60px_rgba(0,0,0,.15)] sm:p-6">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0 max-w-4xl"><span className="inline-flex rounded-full border border-[#FF8A1F]/25 bg-[#FF8A1F]/10 px-3 py-1 text-[11px] font-black text-[#FF9E45]">{listing.subcategory}</span><h1 className="mt-3 text-2xl font-black leading-tight tracking-[-0.025em] text-[var(--text-main)] sm:text-3xl lg:text-[34px]">{listing.title}</h1><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--text-muted)]">{listing.location ? <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{listing.location}</span> : null}{listing.published_at ? <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{formatDate(listing.published_at)}</span> : null}<span className="flex items-center gap-1.5"><Heart className="h-3.5 w-3.5" />{listing.favorite_count || 0} kişi favoriledi</span></div></div>
        <div className="shrink-0 border-t border-[var(--border-app)] pt-4 lg:min-w-72 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-dim)]">Fiyat</p><div className="mt-1 flex flex-wrap items-baseline gap-2 lg:justify-between">{listing.previous_price && listing.price < listing.previous_price ? <span className="text-base font-bold text-[var(--text-muted)] line-through">{formatCurrency(listing.previous_price)}</span> : null}<strong className="text-3xl font-black tracking-tight text-[#FF9E45] sm:text-[34px]">{formatCurrency(listing.price)}</strong></div><div className="mt-4">{headerActions}</div></div>
      </div>
    </header>

    {isVehicle ? <section data-testid="vehicle-listing-layout" className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,.95fr)_minmax(280px,.65fr)]">
      <div className="space-y-5 md:col-span-2 xl:col-span-1"><ListingGallery images={galleryImages} title={listing.title} isLocked={result.isLocked} variant="vehicle" />{detailReady ? <ListingDescription listing={memberListing} /> : null}</div>
      <div className="order-3 md:order-none">{detailReady ? <VehicleDetailsPanel listing={memberListing} /> : <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--text-muted)]">Teknik detayları görmek için giriş yapınız.</div>}</div>
      <aside className="order-2 space-y-4 md:order-none xl:sticky xl:top-24"><SellerArea listing={memberListing} isLocked={result.isLocked} isOwner={result.isOwner} closedLabel={closedLabel} /></aside>
    </section> : <section data-testid="property-listing-layout" className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)]">
      <div className="space-y-5"><ListingGallery images={galleryImages} title={listing.title} isLocked={result.isLocked} variant="property" />{detailReady ? <ListingDescription listing={memberListing} /> : null}</div>
      <aside className="space-y-4 lg:sticky lg:top-24">{detailReady ? <PropertyDetailsPanel listing={memberListing} /> : null}<SellerArea listing={memberListing} isLocked={result.isLocked} isOwner={result.isOwner} closedLabel={closedLabel} /></aside>
    </section>}

    {isVehicle && similarListings.length > 0 ? <SimilarListings listings={similarListings} /> : null}
  </main>;
}