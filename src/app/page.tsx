import React from 'react';
import Link from 'next/link';
import {
  Car,
  Home,
  ArrowRight,
  Sparkles,
  PlusCircle,
} from 'lucide-react';
import { getPublicListings } from '@/lib/db/listings';
import { ListingCard } from '@/components/listings/ListingCard';
import { PopularShowcase } from '@/components/home/PopularShowcase';

export const revalidate = 0; // Fresh listing feed

export default async function HomePage() {
  const [vehicleListings, propertyListings, popularListings] = await Promise.all([
    getPublicListings({ category: 'vehicle', sort: 'newest' }),
    getPublicListings({ category: 'property', sort: 'newest' }),
    getPublicListings({ sort: 'popular' }),
  ]);

  const latestVehicles = vehicleListings.slice(0, 6);
  const latestProperties = propertyListings.slice(0, 6);
  const popularFeed = popularListings.slice(0, 10);

  return (
    <div className="space-y-12 pb-20">
      {/* 1. HERO SECTION */}
      <section className="relative pt-12 pb-14 px-4 sm:px-6 lg:px-8 border-b border-[var(--border-app)] bg-gradient-to-b from-[var(--bg-surface)] to-[var(--bg-app)]">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--brand-orange-subtle)] border border-[rgba(255,138,31,0.25)] text-[#FF8A1F] text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>GTA World Roleplay İlan Platformu</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[var(--text-main)]">
            San Andreas'ta <span className="text-[#FF8A1F]">aradığını</span> bul.
          </h1>

          <p className="text-base sm:text-lg text-[var(--text-muted)] max-w-2xl mx-auto">
            Araç ve mülk ilanlarını incele veya kendi ilanını oluştur. Alıcı ve satıcıları buluşturan en güvenilir Los Santos vitrini.
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
