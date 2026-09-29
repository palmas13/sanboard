import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, CalendarDays, Heart, MapPin, Tag } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import type { HomepageStats } from '@/lib/db/homepage-stats';
import { HeroStats, HeroTypewriter } from './HeroDynamicContent';

const HERO_BACKGROUND = '/home/sanboard-background1.png';
const decorativeListings = [
  { kind: 'property', category: 'Ev / Daire', title: 'Vinewood Crest Estate', price: 1_250_000, location: 'Vinewood Hills', date: '14 Şub 2026', favorites: 12, image: '/home/Vinewood Crest Estate.webp', objectPosition: '50% 48%' },
  { kind: 'vehicle', category: 'Otomobil', title: 'Grotti Turismo R', price: 320_000, date: '27 May 2026', favorites: 24, image: '/home/Grotti Turismo R.webp', objectPosition: '50% 50%' },
  { kind: 'vehicle', category: 'Motosiklet', title: 'Nagasaki Shinobi', price: 150_000, date: '9 Ağu 2026', favorites: 8, image: '/home/Nagasaki Shinobi.png', objectPosition: '50% 54%' },
] as const;

function HeroDecorativeListingCard({ listing, index }: { listing: typeof decorativeListings[number]; index: number }) {
  return (
    <article className={`hero-listing-card hero-listing-card-${index + 1}`} aria-hidden="true">
      <div className="relative aspect-[1.42/1] overflow-hidden rounded-t-[inherit]">
        <Image src={listing.image} alt="" fill unoptimized sizes="(max-width: 768px) 48vw, 340px" quality={95} className="object-cover" style={{ objectPosition: listing.objectPosition }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
        <span className="absolute left-3 top-3 rounded-md border border-white/10 bg-black/70 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">{listing.category}</span>
        <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-white/10 bg-black/70 px-2 py-1 text-[10px] text-white backdrop-blur-sm"><Heart className="h-3 w-3" /> {listing.favorites}</span>
      </div>
      <div className="hero-listing-card-content space-y-1.5 p-3.5">
        <p className="text-lg font-black tracking-tight text-[#ff921f]">{formatCurrency(listing.price)}</p>
        <h3 className="truncate text-sm font-bold text-white">{listing.title}</h3>
        <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-400">
          {listing.kind === 'property'
            ? <span className="flex min-w-0 items-center gap-1"><MapPin className="h-3 w-3 shrink-0 text-[#ff8a1f]" /><span className="truncate">{listing.location}</span></span>
            : <span className="flex min-w-0 items-center gap-1"><Tag className="h-3 w-3 shrink-0 text-[#ff8a1f]" /><span className="truncate">{listing.category}</span></span>}
          <span className="flex shrink-0 items-center gap-1"><CalendarDays className="h-3 w-3" />{listing.date}</span>
        </div>
      </div>
    </article>
  );
}

function HeroAnnotations() {
  return <div className="hero-annotations" aria-hidden="true"><div className="hero-note hero-note-primary"><span>Hayalindeki araca<br />bir adım daha yakın</span><svg viewBox="0 0 150 82"><path d="M8 8 C 42 10, 67 23, 83 43 C 98 61, 116 68, 140 67" /><path d="M129 58 L141 67 L129 75" /></svg></div><div className="hero-note hero-note-secondary"><span>Los Santos&apos;ta daha fazlası<br />seni bekliyor</span><svg viewBox="0 0 150 82"><path d="M142 8 C 130 20, 124 34, 126 49 C 128 59, 121 65, 111 67" /><path d="M121 57 L110 67 L122 73" /></svg></div></div>;
}

export function HeroShowcase({ stats }: { stats: HomepageStats }) {
  return (
    <section className="homepage-hero relative isolate overflow-hidden border-b border-[var(--border-app)]">
      <Image src={HERO_BACKGROUND} alt="" fill preload sizes="100vw" quality={95} className="-z-30 object-cover object-[66%_50%] opacity-80" />
      <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,#08090b_0%,rgba(8,9,11,.95)_30%,rgba(8,9,11,.53)_59%,rgba(8,9,11,.12)_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(5,6,8,.15),rgba(5,6,8,.22)_62%,#0d0e10_100%)]" />
      <div className="mx-auto grid min-h-[610px] max-w-[1480px] items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[.88fr_1.12fr] lg:px-8 lg:py-14 xl:min-h-[650px]">
        <div className="relative z-20 max-w-[610px] hero-reveal">
          <div className="mb-7 flex flex-wrap items-center gap-3"><span className="rounded-md border border-[#ff8a1f]/60 bg-black/45 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.22em] text-[#ff9d45] backdrop-blur-sm">Sanboard</span><span className="text-xs text-zinc-400">Los Santos&apos;un ilan platformu</span></div>
          <h1 className="max-w-[650px] text-[clamp(2.75rem,5.4vw,5.2rem)] font-black leading-[.94] tracking-[-.055em] text-white"><span className="block">Los Santos&apos;ta</span><HeroTypewriter /></h1>
          <p className="mt-6 max-w-[560px] text-sm leading-6 text-zinc-400 sm:text-base sm:leading-7">Los Santos&apos;taki araç ve mülk ilanlarını keşfet, ilanını yayınla ve doğru alıcıyla buluş.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/ilan-ver" className="hero-cta hero-cta-primary group"><span>İlan Ver</span><span className="hero-cta-icon"><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span></Link><Link href="/ilanlari-kesfet" className="hero-cta hero-cta-secondary group"><span>İlanları Keşfet</span><ArrowUpRight className="h-4 w-4 text-[#ff9d45] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></Link></div>
          <HeroStats stats={stats} />
        </div>
        <div className="hero-card-stage relative z-10 min-h-[330px] lg:min-h-[500px]" aria-label="Dekoratif ilan vitrini">{decorativeListings.map((listing, index) => <HeroDecorativeListingCard key={listing.title} listing={listing} index={index} />)}<HeroAnnotations /></div>
      </div>
    </section>
  );
}