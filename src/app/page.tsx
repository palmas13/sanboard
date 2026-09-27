import React from 'react';
import Link from 'next/link';
import {
  Car,
  Home,
  ArrowRight,
  Sparkles,
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
      <section className="hero-shell relative overflow-hidden border-b border-[var(--border-app)] px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,138,31,0.12),transparent_38%)]" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
          <div className="hero-reveal inline-flex items-center gap-2 rounded-full border border-[#FF8A1F]/25 bg-[var(--brand-orange-subtle)] px-3.5 py-1.5 text-xs font-semibold text-[#FF8A1F]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Los Santos ilan deneyimi</span>
          </div>
          <div className="hero-reveal hero-delay-1 mt-7"><HeroTypewriter /></div>
          <p className="hero-reveal hero-delay-2 mt-6 max-w-2xl text-base leading-7 text-[var(--text-muted)] sm:text-lg">
            Los Santos&apos;taki araç ve mülk ilanlarını keşfet, ilanını yayınla ve doğru alıcıyla buluş.
          </p>
          <div className="hero-reveal hero-delay-3 mt-8 flex w-full max-w-md flex-col justify-center gap-3 sm:w-auto sm:max-w-none sm:flex-row">
            <Link href="/ilan-ver" className="btn-primary min-h-12 px-7 transition-transform duration-150 hover:-translate-y-0.5">İlan Ver <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/arac" className="btn-secondary min-h-12 px-7">İlanları Keşfet</Link>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
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
