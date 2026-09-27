import React from 'react';
import Link from 'next/link';
import {
  Car,
  Home,
  ArrowRight,
  ArrowUpRight,
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
      <section className="hero-shell relative isolate overflow-hidden border-b border-[var(--border-app)] px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[440px] max-w-5xl bg-[radial-gradient(ellipse_at_top,rgba(255,138,31,0.16),transparent_64%)]" />
        <div className="pointer-events-none absolute left-1/2 top-16 -z-10 h-52 w-52 -translate-x-1/2 rounded-full border border-[#FF8A1F]/10 bg-[#FF8A1F]/5 blur-3xl" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
          <div className="hero-reveal hero-eyebrow" aria-label="Keşfet">
            <span className="hero-eyebrow-line" aria-hidden="true" />
            <span className="hero-eyebrow-label">Keşfet</span>
            <span className="hero-eyebrow-dot" aria-hidden="true" />
          </div>
          <div className="hero-reveal hero-delay-1 mt-8"><HeroTypewriter /></div>
          <p className="hero-reveal hero-delay-2 mt-6 max-w-xl text-base leading-7 text-[var(--text-muted)] sm:text-lg sm:leading-8">
            Los Santos&apos;taki araç ve mülk ilanlarını keşfet, ilanını yayınla ve doğru alıcıyla buluş.
          </p>
          <div className="hero-reveal hero-delay-3 mt-9 flex w-full max-w-sm flex-col justify-center gap-3 sm:w-auto sm:max-w-none sm:flex-row">
            <Link href="/ilan-ver" className="hero-cta hero-cta-primary group">
              <span>İlan Ver</span>
              <span className="hero-cta-icon"><ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" /></span>
            </Link>
            <Link href="/ilanlari-kesfet" className="hero-cta hero-cta-secondary group">
              <span>İlanları Keşfet</span>
              <ArrowUpRight className="h-4 w-4 text-[#FF9D45] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
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
                <ListingCard key={listing.id} listing={listing} showCompare={false} />
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
                <ListingCard key={listing.id} listing={listing} showCompare={false} />
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
