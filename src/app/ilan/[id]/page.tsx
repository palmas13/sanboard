import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import {
  MapPin,
  Calendar,
  Lock,
  LogIn,
  Heart,
  ArrowRight,
} from 'lucide-react';
import { getListingRepository } from '@/lib/db/repositories';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { ListingGallery } from '@/components/listings/ListingGallery';
import { SellerCard } from '@/components/listings/SellerCard';
import { FavoriteButton } from '@/components/listings/FavoriteButton';
import { ReportModal } from '@/components/listings/ReportModal';
import { MemberListingDetail } from '@/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ListingDetailPage({ params }: PageProps) {
  const { id } = await params;

  // Retrieve current user profile ID and user ID from cookies if present
  const cookieStore = await cookies();
  const profileIdCookie = cookieStore.get('sanboard_profile_id')?.value;
  const userIdCookie = cookieStore.get('sanboard_user_id')?.value;

  const repo = getListingRepository();
  const { listing, isLocked, isOwner } = await repo.getListingById(id, profileIdCookie, userIdCookie);

  if (!listing) {
    notFound();
  }

  const isVehicle = listing.category === 'vehicle';
  const categoryLink = isVehicle ? '/arac' : '/mulk';
  const categoryName = isVehicle ? 'Araç' : 'Mülk';

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
        <span>/</span>
        <span className="text-[#FF8A1F] font-semibold">{listing.listing_number}</span>
      </nav>

      {/* SECTION A: INDEPENDENT LISTING HEADER */}
      <section className="surface-card p-5 sm:p-6 rounded-2xl border border-[var(--border-app)] shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 sm:gap-6">
          {/* Left / Main Area: Category Badge, Listing Number, Title, Location */}
          <div className="space-y-2 max-w-3xl flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="badge-tag badge-brand font-semibold text-xs">
                {listing.subcategory}
              </span>
              <span className="text-xs font-mono font-medium text-[var(--text-dim)]">
                {listing.listing_number}
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
              {listing.previous_price && listing.previous_price !== listing.price && (
                <span className="text-base sm:text-lg font-semibold text-[var(--text-muted)] line-through">
                  {formatCurrency(listing.previous_price)}
                </span>
              )}
              <div className="text-3xl sm:text-[34px] font-black text-[#FF8A1F] tracking-tight">
                {formatCurrency(listing.price)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION B: 3-COLUMN MAIN CONTENT GRID (ALL 3 START AT SAME HORIZONTAL BASELINE) */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,1fr)_minmax(270px,0.72fr)] gap-6 items-start">
        {/* LEFT COLUMN: Gallery & Favori/Açıklama Kartı */}
        <div className="space-y-4">
          <ListingGallery
            images={(listing as MemberListingDetail).images || []}
            title={listing.title}
            isLocked={isLocked}
          />

          {/* Social Proof Favorite Counter & İlan Açıklaması Kartı */}
          <div className="surface-card p-4 sm:p-5 rounded-2xl border border-[var(--border-app)] space-y-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <Heart className="w-4 h-4 text-[#FF8A1F] fill-[#FF8A1F]/20 shrink-0" />
                <span>
                  <strong className="text-[var(--text-main)]">{listing.favorite_count} kişi</strong> bu ilanı favori listesine ekledi.
                </span>
              </div>
              <FavoriteButton
                listingId={listing.id}
                initialCount={listing.favorite_count}
                initialIsFavorited={(listing as MemberListingDetail).is_favorited}
                showCount={false}
              />
            </div>

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
              {/* Technical Specifications Compact Table */}
              <div className="surface-card rounded-2xl border border-[var(--border-app)] overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-[var(--bg-surface-secondary)] border-b border-[var(--border-app)]">
                  <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
                    {isVehicle ? 'Teknik Bilgiler' : 'Mülk Özellikleri'}
                  </h3>
                </div>

                <div className="divide-y divide-[var(--border-app)] text-xs sm:text-[13px]">
                  <div className="flex items-center justify-between px-4 py-2.5 min-h-[42px]">
                    <span className="text-[var(--text-muted)]">İlan No</span>
                    <span className="font-mono font-semibold text-[var(--text-main)] text-right">
                      {listing.listing_number}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 min-h-[42px]">
                    <span className="text-[var(--text-muted)]">İlan Tarihi</span>
                    <span className="font-medium text-[var(--text-main)] text-right">
                      {formatDate(listing.published_at)}
                    </span>
                  </div>

                  {/* Vehicle Specific Rows (NO Location for Vehicles) */}
                  {isVehicle && (listing as MemberListingDetail).vehicle_details && (
                    <>
                      {(listing as MemberListingDetail).vehicle_details?.brand && (
                        <div className="flex items-center justify-between px-4 py-2.5 min-h-[42px]">
                          <span className="text-[var(--text-muted)]">Marka</span>
                          <span className="font-bold text-[var(--text-main)] text-right">
                            {(listing as MemberListingDetail).vehicle_details?.brand}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between px-4 py-2.5 min-h-[42px]">
                        <span className="text-[var(--text-muted)]">Model</span>
                        <span className="font-bold text-[var(--text-main)] text-right">
                          {(listing as MemberListingDetail).vehicle_details?.model}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5 min-h-[42px]">
                        <span className="text-[var(--text-muted)]">Plaka</span>
                        <span className="font-mono font-bold text-[var(--text-main)] uppercase text-right">
                          {(listing as MemberListingDetail).vehicle_details?.plate}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5 min-h-[42px]">
                        <span className="text-[var(--text-muted)]">Kilometre</span>
                        <span className="font-semibold text-[var(--text-main)] text-right">
                          {(listing as MemberListingDetail).vehicle_details?.mileage.toLocaleString('tr-TR')} km
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5 min-h-[42px]">
                        <span className="text-[var(--text-muted)]">Motor</span>
                        <span className="font-bold text-[#FF8A1F] text-right">
                          Seviye {(listing as MemberListingDetail).vehicle_details?.engine_upgrade}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5 min-h-[42px]">
                        <span className="text-[var(--text-muted)]">Şanzıman</span>
                        <span className="font-bold text-[#FF8A1F] text-right">
                          Seviye {(listing as MemberListingDetail).vehicle_details?.transmission_upgrade}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5 min-h-[42px]">
                        <span className="text-[var(--text-muted)]">Fren</span>
                        <span className="font-bold text-[#FF8A1F] text-right">
                          Seviye {(listing as MemberListingDetail).vehicle_details?.brake_upgrade}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5 min-h-[42px]">
                        <span className="text-[var(--text-muted)]">Turbo</span>
                        <span className="font-semibold text-[var(--text-main)] text-right">
                          {(listing as MemberListingDetail).vehicle_details?.turbo ? 'Var' : 'Yok'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5 min-h-[42px]">
                        <span className="text-[var(--text-muted)]">Subwoofer</span>
                        <span className="font-semibold text-[var(--text-main)] text-right">
                          {(listing as MemberListingDetail).vehicle_details?.subwoofer ? 'Var' : 'Yok'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5 min-h-[42px]">
                        <span className="text-[var(--text-muted)]">Takasa Açık</span>
                        <span className="font-semibold text-[var(--text-main)] text-right">
                          {(listing as MemberListingDetail).vehicle_details?.trade_available ? 'Evet' : 'Hayır'}
                        </span>
                      </div>
                    </>
                  )}

                  {/* Property Specific Rows (Location IS shown for properties) */}
                  {!isVehicle && (listing as MemberListingDetail).property_details && (
                    <>
                      <div className="flex items-center justify-between px-4 py-2.5 min-h-[42px]">
                        <span className="text-[var(--text-muted)]">Konum</span>
                        <span className="font-medium text-[var(--text-main)] text-right">
                          {listing.location}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5 min-h-[42px]">
                        <span className="text-[var(--text-muted)]">Mülk Türü</span>
                        <span className="font-bold text-[var(--text-main)] text-right">
                          {(listing as MemberListingDetail).property_details?.property_type}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5 min-h-[42px]">
                        <span className="text-[var(--text-muted)]">Oda Sayısı</span>
                        <span className="font-bold text-[var(--text-main)] text-right">
                          {(listing as MemberListingDetail).property_details?.room_count}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5 min-h-[42px]">
                        <span className="text-[var(--text-muted)]">Bulunduğu Kat</span>
                        <span className="font-semibold text-[var(--text-main)] text-right">
                          {(listing as MemberListingDetail).property_details?.floor}. Kat
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5 min-h-[42px]">
                        <span className="text-[var(--text-muted)]">Yapı Tipi</span>
                        <span className="font-semibold text-[var(--text-main)] text-right">
                          {(listing as MemberListingDetail).property_details?.building_type}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5 min-h-[42px]">
                        <span className="text-[var(--text-muted)]">Eşyalı</span>
                        <span className="font-semibold text-[var(--text-main)] text-right">
                          {(listing as MemberListingDetail).property_details?.furnished ? 'Evet' : 'Hayır'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5 min-h-[42px]">
                        <span className="text-[var(--text-muted)]">Balkon / Teras</span>
                        <span className="font-semibold text-[var(--text-main)] text-right">
                          {(listing as MemberListingDetail).property_details?.balcony ? 'Var' : 'Yok'}
                        </span>
                      </div>
                    </>
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
    </div>
  );
}
