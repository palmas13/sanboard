import React from 'react';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import {
  MapPin,
  Calendar,
  Lock,
  LogIn,
  Heart,
  ArrowRight,
  CircleOff,
} from 'lucide-react';
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
import { MemberListingDetail } from '@/types';
import { sortListingImages } from '@/lib/listings/images';
import { OfferButton } from '@/components/offers/OfferButton';
import { getAbsoluteUrl, getListingUrl, parseListingRouteIdentifier } from '@/lib/urls';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const revalidate = 30;

async function resolveListing(identifier: string, profileId?: string, userId?: string) {
  const repo = getListingRepository();
  const parsed = parseListingRouteIdentifier(identifier);
  return parsed.publicId
    ? repo.getListingByPublicId(parsed.publicId, profileId, userId)
    : repo.getListingById(parsed.legacyId!, profileId, userId);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const { listing } = await resolveListing(id);
  if (!listing) return {};
  const canonical = getAbsoluteUrl(getListingUrl(listing));
  const rawImage = 'cover_image' in listing
    ? listing.cover_image
    : 'images' in listing
      ? listing.images?.[0]?.storage_path
      : undefined;
  const image = rawImage ? getAbsoluteUrl(rawImage) : undefined;
  const description = 'description' in listing ? listing.description : `${listing.title} ilanını Sanboard üzerinde inceleyin.`;
  return {
    title: listing.title,
    description,
    alternates: { canonical },
    openGraph: {
      title: listing.title,
      description,
      url: canonical,
      siteName: 'Sanboard',
      type: 'website',
      images: image ? [{ url: image, alt: listing.title }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: listing.title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

function VehicleSpecSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 pb-1 border-b border-[var(--border-app)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#FF8A1F]" />
        <h4 className="text-[11px] font-bold text-[#FF8A1F] uppercase tracking-wider">
          {title}
        </h4>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {children}
      </div>
    </div>
  );
}

function VehicleSpecItem({
  label,
  value,
  highlight,
  badge,
  span2,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
  badge?: boolean;
  span2?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-surface-secondary)]/60 border border-[var(--border-app)]/50 gap-2 min-h-[38px] ${span2 ? 'sm:col-span-2' : ''
        }`}
    >
      <span className="text-[var(--text-muted)] text-xs truncate">{label}</span>
      {badge ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-[#FF8A1F]/15 text-[#FF8A1F] border border-[#FF8A1F]/30 shrink-0">
          {value}
        </span>
      ) : (
        <span
          className={`font-semibold text-right truncate shrink-0 ${highlight ? 'text-[#FF8A1F] font-bold' : 'text-[var(--text-main)]'
            }`}
        >
          {value}
        </span>
      )}
    </div>
  );
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { id } = await params;

  const session = await getServerSession();
  const userId = session?.userId;
  const profileId = session?.profileId;

  const repo = getListingRepository();
  const { listing, isLocked, isOwner } = await resolveListing(id, profileId, userId);

  if (!listing) {
    notFound();
  }

  const canonicalPath = getListingUrl(listing);
  if (`/ilan/${id}` !== canonicalPath) permanentRedirect(canonicalPath);

  const isVehicle = listing.category === 'vehicle';
  const publicCoverImage = 'cover_image' in listing ? listing.cover_image : undefined;
  const galleryImages = sortListingImages(
    'images' in listing && listing.images
      ? listing.images
      : publicCoverImage
        ? [{
            id: `cover-${listing.id}`,
            listing_id: listing.id,
            storage_path: publicCoverImage,
            sort_order: 0,
            is_cover: true,
            size_bytes: 0,
            created_at: listing.published_at || '',
          }]
        : []
  );
  const categoryLink = isVehicle ? '/arac' : '/mulk';
  const categoryName = isVehicle ? 'Araç' : 'Mülk';

  const similarListings = isVehicle
    ? await getOptionalSimilarListings(repo, id, 6)
    : [];
  const status = 'status' in listing ? listing.status : undefined;
  const closedLabel = status === 'SOLD' ? 'Bu ilan satıldı' : status === 'REMOVED' ? 'Bu ilan yayından kaldırıldı' : null;

  return (
    <div className="max-w-7xl xl:max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-[var(--text-dim)]">
        <Link href="/" className="hover:text-[var(--text-main)] transition-colors">
          Ana Sayfa
        </Link>
        <span>/</span>
        <Link href={categoryLink} className="hover:text-[var(--text-main)] transition-colors">
          {categoryName}
        </Link>
        <span>/</span>
        <span className="text-[var(--text-muted)]">{listing.subcategory}</span>
      </nav>

      {closedLabel ? (
        <div role="status" className="surface-card flex items-center gap-3 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 text-sm font-semibold text-amber-200">
          <CircleOff className="h-5 w-5 shrink-0" />
          <div><p>{closedLabel}</p><p className="mt-0.5 text-xs font-normal text-[var(--text-muted)]">İlan bilgileri arşiv amacıyla görüntüleniyor; satıcıyla iletişim ve yeni favori işlemleri kapalıdır.</p></div>
        </div>
      ) : null}

      {/* SECTION A: INDEPENDENT LISTING HEADER */}
      <section className="surface-card p-5 sm:p-6 rounded-2xl border border-[var(--border-app)] shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 sm:gap-6">
          {/* Left / Main Area: Category Badge, Listing Number, Title, Location */}
          <div className="space-y-2 max-w-3xl flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="badge-tag badge-brand font-semibold text-xs">
                {listing.subcategory}
              </span>
            </div>

            <h1
              title={listing.title}
              className="text-2xl sm:text-[28px] lg:text-[32px] font-extrabold text-[var(--text-main)] tracking-tight leading-snug max-md:line-clamp-2 md:truncate"
            >
              {listing.title}
            </h1>

            <div className="flex items-center gap-2 text-xs sm:text-sm text-[var(--text-muted)] pt-0.5">
              {!isVehicle && (
                <>
                  <span className="flex items-center gap-1.5 font-medium text-[var(--text-main)]">
                    <MapPin className="w-3.5 h-3.5 text-[#FF8A1F] shrink-0" />
                    <span>{listing.location}</span>
                  </span>
                  <span className="text-[var(--text-dim)]">•</span>
                </>
              )}
              <span className="text-[var(--text-dim)] flex items-center gap-1">
                <Calendar className="w-3 h-3 shrink-0" />
                <span>{formatDate(listing.published_at)}</span>
              </span>
            </div>
          </div>

          {/* Right Area: Price */}
          <div className="md:text-right shrink-0 flex md:flex-col items-baseline md:items-end justify-between border-t md:border-t-0 pt-3 md:pt-0 border-[var(--border-app)]">
            <span className="text-[11px] text-[var(--text-dim)] uppercase tracking-wider font-bold hidden md:block">
              Fiyat
            </span>
            <div className="flex items-baseline gap-2 flex-wrap md:justify-end">
              {listing.previous_price && listing.price < listing.previous_price && (
                <span className="text-base sm:text-lg font-semibold text-[var(--text-muted)] line-through">
                  {formatCurrency(listing.previous_price)}
                </span>
              )}
              <div className="text-3xl sm:text-[34px] font-black text-[#FF8A1F] tracking-tight">
                {formatCurrency(listing.price)}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 sm:pt-2.5 md:justify-end">
              {!isLocked && !isOwner && !closedLabel && (listing as MemberListingDetail).offers_enabled !== false && <OfferButton listing={listing as MemberListingDetail} />}
              {isVehicle && <CompareButton listing={listing} />}
              {!isVehicle && !closedLabel && <PropertyCompareButton listing={listing} />}
              <CopyListingLinkButton path={canonicalPath} />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION B: 3-COLUMN MAIN CONTENT GRID (ALL 3 START AT SAME HORIZONTAL BASELINE) */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,1fr)_minmax(270px,0.72fr)] gap-6 items-start">
        {/* LEFT COLUMN: Gallery & Favori/Açıklama Kartı */}
        <div className="space-y-4">
          <ListingGallery
            images={galleryImages}
            title={listing.title}
            isLocked={isLocked}
          />

          {/* Social Proof Favorite Counter & İlan Açıklaması Kartı */}
          <div className="surface-card p-4 sm:p-5 rounded-2xl border border-[var(--border-app)] space-y-4 shadow-sm">
            {!closedLabel ? <FavoriteButton
              listingId={listing.id}
              initialCount={listing.favorite_count}
              initialIsFavorited={(listing as MemberListingDetail).is_favorited}
              proofText={true}
              showCount={false}
            /> : null}

            {!isLocked && (
              <>
                <div className="border-t border-[var(--border-app)]" />
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-wider">
                    İlan Açıklaması
                  </h3>
                  <p className="text-sm text-[var(--text-main)] leading-relaxed whitespace-pre-line">
                    {(listing as MemberListingDetail).description || 'Açıklama belirtilmemiş.'}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* MIDDLE COLUMN: Teknik Bilgiler (Starts directly at the top baseline!) */}
        <div className="space-y-4">
          {/* LOCKED AREA GATING FOR NON-MEMBERS */}
          {isLocked ? (
            <div className="surface-card p-6 sm:p-8 rounded-2xl border-2 border-[#FF8A1F]/30 bg-gradient-to-b from-[var(--bg-surface)] to-[var(--bg-surface-secondary)] space-y-4 text-center shadow-lg">
              <div className="w-12 h-12 mx-auto rounded-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-[var(--text-main)]">
                  İlan detaylarını görüntülemek için Sanboard hesabınla giriş yap.
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  GTA World hesabınla ücretsiz giriş yapabilirsin.
                </p>
              </div>

              <Link
                href={`/giris?redirect=/ilan/${listing.id}`}
                className="w-full btn-primary py-2.5 text-sm font-bold flex items-center justify-center gap-2 shadow-md"
              >
                <LogIn className="w-4 h-4" />
                <span>GTA World ile Giriş Yap</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            /* MEMBER-ONLY FULL TECHNICAL DATA */
            <>
              {/* Technical Specifications Compact Grid */}
              <div className="surface-card rounded-2xl border border-[var(--border-app)] overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-[var(--bg-surface-secondary)] border-b border-[var(--border-app)]">
                  <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
                    {isVehicle ? 'Teknik Özellikler' : 'Mülk Özellikleri'}
                  </h3>
                </div>

                <div className="p-4 sm:p-5 space-y-4">
                  {/* Vehicle Specific Rows Grouped Cleanly */}
                  {isVehicle && (listing as MemberListingDetail).vehicle_details && (() => {
                    const vd = (listing as MemberListingDetail).vehicle_details!;
                    const fuelLabels: Record<string, string> = {
                      BENZIN: 'Benzin',
                      DIZEL: 'Dizel',
                      ELEKTRIK: 'Elektrik',
                    };
                    return (
                      <>
                        {/* 1. ARAÇ BİLGİLERİ */}
                        <VehicleSpecSection title="Temel Bilgiler">
                          <VehicleSpecItem label="İlan Tarihi" value={formatDate(listing.published_at)} />
                          {vd.brand && <VehicleSpecItem label="Marka" value={vd.brand} />}
                          <VehicleSpecItem label="Model" value={vd.model} highlight />
                          <VehicleSpecItem label="Kategori" value={vd.vehicle_category || 'Belirtilmemiş'} />
                          <VehicleSpecItem label="Plaka" value={vd.plate || 'Belirtilmemiş'} />
                          <VehicleSpecItem label="Kilometre" value={`${vd.mileage.toLocaleString('tr-TR')} km`} />
                          {vd.fuel_type && (
                            <VehicleSpecItem label="Yakıt Türü" value={fuelLabels[vd.fuel_type] || vd.fuel_type} />
                          )}
                        </VehicleSpecSection>

                        {/* 2. MEKANİK DURUM */}
                        <VehicleSpecSection title="Mekanik Durum">
                          {vd.engine_health !== undefined && vd.engine_health !== null && (
                            <div className="sm:col-span-2 flex flex-col justify-center px-3 py-2 rounded-lg bg-[var(--bg-surface-secondary)]/60 border border-[var(--border-app)]/50 gap-1.5 min-h-[46px]">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[var(--text-muted)]">Motor Sağlığı</span>
                                <span
                                  className={`font-bold ${vd.engine_health >= 70
                                    ? 'text-emerald-400'
                                    : vd.engine_health >= 40
                                      ? 'text-amber-400'
                                      : 'text-red-400'
                                    }`}
                                >
                                  %{vd.engine_health}
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                                <div
                                  className={`h-full rounded-full transition-all ${vd.engine_health >= 70
                                    ? 'bg-emerald-500'
                                    : vd.engine_health >= 40
                                      ? 'bg-amber-500'
                                      : 'bg-red-500'
                                    }`}
                                  style={{ width: `${Math.min(100, Math.max(0, vd.engine_health))}%` }}
                                />
                              </div>
                            </div>
                          )}
                          <VehicleSpecItem label="Motor Upgrade" value={`Seviye ${vd.engine_upgrade}`} badge />
                          <VehicleSpecItem label="Şanzıman Upgrade" value={`Seviye ${vd.transmission_upgrade}`} badge />
                          <VehicleSpecItem label="Fren Upgrade" value={`Seviye ${vd.brake_upgrade}`} badge />
                          {vd.suspension && <VehicleSpecItem label="Süspansiyon" value={vd.suspension} />}
                        </VehicleSpecSection>

                        {/* 3. GÜVENLİK */}
                        {(vd.lock_level !== undefined || vd.alarm_level !== undefined || vd.anti_theft_level !== undefined) && (
                          <VehicleSpecSection title="Güvenlik Donanımı">
                            {vd.lock_level !== undefined && vd.lock_level !== null && (
                              <VehicleSpecItem label="Kilit Seviyesi" value={`Seviye ${vd.lock_level}`} badge />
                            )}
                            {vd.alarm_level !== undefined && vd.alarm_level !== null && (
                              <VehicleSpecItem label="Alarm Seviyesi" value={`Seviye ${vd.alarm_level}`} badge />
                            )}
                            {vd.anti_theft_level !== undefined && vd.anti_theft_level !== null && (
                              <VehicleSpecItem label="Hırsızlık Önleme" value={`Seviye ${vd.anti_theft_level}`} badge />
                            )}
                          </VehicleSpecSection>
                        )}

                        {/* 4. EK DONANIM & SATIŞ */}
                        <VehicleSpecSection title="Ek Donanım & Satış">
                          <VehicleSpecItem label="Turbo" value={vd.turbo ? 'Var' : 'Yok'} />
                          <VehicleSpecItem label="Subwoofer" value={vd.subwoofer ? 'Var' : 'Yok'} />
                          <VehicleSpecItem label="Takasa Açık" value={vd.trade_available ? 'Evet' : 'Hayır'} />
                          {vd.factory_price !== undefined && vd.factory_price !== null && vd.factory_price > 0 && (
                            <VehicleSpecItem label="Fabrika Çıkış Fiyatı" value={formatCurrency(vd.factory_price)} />
                          )}
                        </VehicleSpecSection>
                      </>
                    );
                  })()}

                  {/* Property Specific Rows (Location IS shown for properties) */}
                  {!isVehicle && (listing as MemberListingDetail).property_details && (
                    <VehicleSpecSection title="Mülk Detayları">
                      <VehicleSpecItem label="İlan Tarihi" value={formatDate(listing.published_at)} />
                      <VehicleSpecItem label="Konum" value={listing.location} highlight />
                      <VehicleSpecItem
                        label="Mülk Türü"
                        value={(listing as MemberListingDetail).property_details?.property_type || 'Belirtilmemiş'}
                      />
                      <VehicleSpecItem
                        label="Oda Sayısı"
                        value={(listing as MemberListingDetail).property_details?.room_count || 'Belirtilmemiş'}
                      />
                      <VehicleSpecItem
                        label="Bulunduğu Kat"
                        value={`${(listing as MemberListingDetail).property_details?.floor}. Kat`}
                      />
                      <VehicleSpecItem
                        label="Yapı Tipi"
                        value={(listing as MemberListingDetail).property_details?.building_type || 'Belirtilmemiş'}
                      />
                      <VehicleSpecItem
                        label="Eşyalı"
                        value={(listing as MemberListingDetail).property_details?.furnished ? 'Evet' : 'Hayır'}
                      />
                      <VehicleSpecItem
                        label="Balkon / Teras"
                        value={(listing as MemberListingDetail).property_details?.balcony ? 'Var' : 'Yok'}
                      />
                    </VehicleSpecSection>
                  )}
                </div>
              </div>

              {/* Owner Action Shortcut (Compact height ~56-60px) */}
              {isOwner && (
                <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--brand-orange-subtle)] border border-[rgba(255,138,31,0.25)] flex items-center justify-between gap-3 min-h-[56px] shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#FF8A1F] animate-pulse shrink-0" />
                    <span className="text-xs font-bold text-[#FF8A1F]">
                      Bu ilan size aittir.
                    </span>
                  </div>
                  <Link
                    href="/hesabim/ilanlarim"
                    className="btn-primary text-xs py-1.5 px-3.5 shadow-sm whitespace-nowrap"
                  >
                    İlanlarımı Yönet
                  </Link>
                </div>
              )}

              {/* Report Action Button */}
              <div className="flex justify-end pt-1">
                <ReportModal listingId={listing.id} />
              </div>
            </>
          )}
        </div>

        {/* RIGHT COLUMN: İlan Sahibi (Starts directly at the top baseline!) */}
        <div className="md:col-span-2 lg:col-span-1 lg:sticky lg:top-24 space-y-4">
          {isLocked ? (
            <div className="surface-card p-6 rounded-2xl border border-[var(--border-app)] text-center space-y-3 shadow-sm">
              <div className="w-12 h-12 mx-auto rounded-full bg-[var(--bg-surface-secondary)] text-[var(--text-dim)] flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-[var(--text-main)]">
                Satıcı Bilgileri Kilitli
              </h4>
              <p className="text-xs text-[var(--text-muted)]">
                Satıcıyla iletişime geçmek ve telefon/SanMail adresini görmek için giriş yapınız.
              </p>
              <Link
                href={`/giris?redirect=/ilan/${listing.id}`}
                className="w-full btn-secondary text-xs py-2 block"
              >
                Giriş Yap
              </Link>
            </div>
          ) : (
            <SellerCard
              seller={(listing as MemberListingDetail).seller}
              dealer={(listing as MemberListingDetail).dealer}
            />
          )}
        </div>
      </section>

      {/* SECTION C: SIMILAR LISTINGS */}
      {isVehicle && similarListings.length > 0 && (
        <SimilarListings listings={similarListings} />
      )}
    </div>
  );
}
