import React from 'react';
import Link from 'next/link';
import {
  Car,
  Home,
  ArrowRight,
  Sparkles,
  PlusCircle,
} from 'lucide-react';
import { getListingRepository } from '@/lib/db/repositories';
import { ListingCard } from '@/components/listings/ListingCard';
import { PopularShowcase } from '@/components/home/PopularShowcase';
import { HeroTypewriter } from '@/components/home/HeroTypewriter';

export const revalidate = 30; // 30-second controlled server cache with targeted on-mutation invalidation

export default async function HomePage() {
  const repo = getListingRepository();
  const allListings = await repo.getPublicListings({ sort: 'newest' });

  const vehicleListings = allListings.filter((l) => l.category === 'vehicle');
  const propertyListings = allListings.filter((l) => l.category === 'property');
  const latestVehicles = vehicleListings.slice(0, 6);
  const latestProperties = propertyListings.slice(0, 6);
  const popularFeed = [...allListings]
    .sort((a, b) => (b.favorite_count || 0) - (a.favorite_count || 0))
    .slice(0, 10);

  return (
    <div className="space-y-12 pb-20">
      {/* 1. HERO SECTION */}
      <section className="relative pt-14 pb-16 px-4 sm:px-6 lg:px-8 border-b border-[var(--border-app)] bg-gradient-to-b from-[var(--bg-surface)] via-[var(--bg-surface)]/80 to-[var(--bg-app)] overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-radial from-[#FF8A1F]/10 via-transparent to-transparent pointer-events-none blur-3xl" />

        <div className="relative max-w-5xl mx-auto text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[var(--brand-orange-subtle)] border border-[rgba(255,138,31,0.25)] text-[#FF8A1F] text-xs font-semibold shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>GTA World Roleplay İlan Platformu</span>
          </div>

          <HeroTypewriter />

          <p className="text-sm sm:text-base text-[var(--text-muted)] max-w-2xl mx-auto leading-relaxed">
            Araç ve mülk ilanlarını incele, kendi ilanını oluştur ve Los Santos&apos;ta alıcılarla satıcıları güvenli şekilde buluştur.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
        {/* 2. CTA BANNER (IMMEDIATELY AFTER HERO) */}
        <section className="surface-card p-6 sm:p-8 rounded-2xl border border-[rgba(255,138,31,0.25)] bg-gradient-to-r from-[var(--bg-surface)] via-[var(--brand-orange-subtle)]/20 to-[var(--bg-surface)] flex flex-col md:flex-row items-center justify-between gap-6 shadow-md">
          <div className="space-y-1.5 text-center md:text-left">
            <h2 className="text-xl sm:text-2xl font-black text-[var(--text-main)]">
              Aracını veya Mülkünü San Andreas'a Duyur
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              7 günlük ilanını oluştur ve binlerce kişinin görmesini sağla.
            </p>
          </div>
          <Link
            href="/ilan-ver"
            className="btn-primary text-sm py-3 px-7 shrink-0 shadow-lg flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>İlan Ver</span>
          </Link>
        </section>

        {/* 3. POPÜLER İLANLAR (Animated Carousel Showcase) */}
        <PopularShowcase listings={popularFeed} />

        {/* 4. YENİ ARAÇ İLANLARI (6 listings) */}
        <section className="space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-app)]">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
                <Car className="w-5 h-5 text-[#FF8A1F]" />
                <span>Yeni Araç İlanları</span>
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Los Santos sokaklarındaki en taze araç fırsatları
              </p>
            </div>
            <Link
              href="/arac"
              className="text-xs font-semibold text-[#FF8A1F] hover:underline flex items-center gap-1"
            >
              <span>Tümünü Gör ({vehicleListings.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {latestVehicles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {latestVehicles.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <div className="surface-card p-12 text-center text-sm text-[var(--text-muted)] rounded-2xl border border-[var(--border-app)]">
              Henüz yayınlanmış aktif araç ilanı bulunmuyor.
            </div>
          )}
        </section>

        {/* 5. YENİ MÜLK İLANLARI (6 listings) */}
        <section className="space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-app)]">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
                <Home className="w-5 h-5 text-[#FF8A1F]" />
                <span>Yeni Mülk İlanları</span>
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Lüks villalar, sahil daireleri ve ticari gayrimenkuller
              </p>
            </div>
            <Link
              href="/mulk"
              className="text-xs font-semibold text-[#FF8A1F] hover:underline flex items-center gap-1"
            >
              <span>Tümünü Gör ({propertyListings.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {latestProperties.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {latestProperties.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <div className="surface-card p-12 text-center text-sm text-[var(--text-muted)] rounded-2xl border border-[var(--border-app)]">
              Henüz yayınlanmış aktif mülk ilanı bulunmuyor.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
