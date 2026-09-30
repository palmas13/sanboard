import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, CarFront, Home, MoveRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'İlanları Keşfet | Sanboard',
  description: 'Sanboard araç ve mülk ilanları arasında keşfe çıkın.',
};

const discoveryOptions = [
  {
    href: '/arac',
    eyebrow: 'Yollara çık',
    title: 'Araç mı arıyorsun?',
    description: 'Araç ilanlarına göz at.',
    detail: 'Otomobil, motosiklet, SUV ve daha fazlasını tek akışta keşfet.',
    icon: CarFront,
    number: '01',
  },
  {
    href: '/mulk',
    eyebrow: 'Yeni bir yer bul',
    title: 'Mülk mü arıyorsun?',
    description: 'Mülk ilanlarına göz at.',
    detail: 'Ev, daire, iş yeri ve Los Santos’un özel lokasyonlarını incele.',
    icon: Home,
    number: '02',
  },
] as const;

export default function ExplorePage() {
  return (
    <div className="relative isolate min-h-[calc(100vh-68px)] overflow-hidden px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--bg-surface)_72%,var(--bg-app)),var(--bg-app)_70%)]" />
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[480px] w-[760px] max-w-[110vw] -translate-x-1/2 rounded-full bg-[#FF8A1F]/10 blur-[110px]" />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:64px_64px]" />

      <main className="mx-auto max-w-6xl">
        <header className="mx-auto max-w-3xl text-center">
          <div className="explore-reveal inline-flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.28em] text-[#FF9D45]">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-[#FF8A1F]" />
            Sanboard&apos;da keşfet
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-[#FF8A1F]" />
          </div>
          <h1 className="explore-reveal explore-delay-1 mt-7 pb-2 text-balance text-[clamp(2.6rem,7vw,5.25rem)] font-black leading-[1.03] tracking-[-0.055em] text-[var(--text-main)]">
            Aradığın şey,
            <span className="block bg-gradient-to-r from-[#FFB267] via-[#FF8A1F] to-[#DE6800] bg-clip-text text-transparent">bir seçim uzağında.</span>
          </h1>
          <p className="explore-reveal explore-delay-2 mx-auto mt-6 max-w-xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">
            Rotanı seç, Sanboard&apos;daki güncel ilanları sana uygun akışta keşfetmeye başla.
          </p>
        </header>

        <section aria-label="İlan kategorisi seçimi" className="mt-12 grid gap-5 lg:mt-16 lg:grid-cols-2">
          {discoveryOptions.map((option, index) => {
            const Icon = option.icon;
            return (
              <Link
                key={option.href}
                href={option.href}
                className={`explore-reveal explore-card group relative min-h-[310px] overflow-hidden rounded-[2rem] border border-[var(--border-app)] bg-[var(--bg-surface)]/88 p-6 outline-none hover:border-[#FF8A1F]/45 hover:bg-[var(--bg-surface-secondary)]/80 hover:shadow-[0_30px_80px_-38px_rgba(255,138,31,0.65)] focus-visible:border-[#FF8A1F] focus-visible:ring-2 focus-visible:ring-[#FF8A1F]/55 sm:min-h-[350px] sm:p-9 ${index === 0 ? 'explore-delay-2' : 'explore-delay-3'}`}
              >
                <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full border border-[#FF8A1F]/10 bg-[#FF8A1F]/5 transition-transform duration-500 group-hover:scale-110" />
                <div className="pointer-events-none absolute bottom-0 right-5 text-[9rem] font-black leading-none tracking-[-0.08em] text-white/[0.025] sm:text-[11rem]">{option.number}</div>
                <div className="relative flex h-full flex-col">
                  <div className="flex items-start justify-between gap-6">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#FF8A1F]/20 bg-[#FF8A1F]/10 text-[#FF9D45] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-300 group-hover:rotate-[-4deg] group-hover:border-[#FF8A1F]/40 group-hover:bg-[#FF8A1F]/15">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-app)] text-[var(--text-muted)] transition-all duration-300 group-hover:border-[#FF8A1F]/40 group-hover:bg-[#FF8A1F] group-hover:text-[#1A0E04]">
                      <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </span>
                  </div>
                  <div className="mt-auto pt-16">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#FF8A1F]">{option.eyebrow}</p>
                    <h2 className="mt-3 text-2xl font-black tracking-[-0.035em] text-[var(--text-main)] sm:text-3xl">{option.title}</h2>
                    <p className="mt-2 text-base font-semibold text-[var(--text-main)]/85">{option.description}</p>
                    <div className="mt-5 flex items-end justify-between gap-5 border-t border-[var(--border-app)] pt-5">
                      <p className="max-w-sm text-xs leading-6 text-[var(--text-muted)] sm:text-sm">{option.detail}</p>
                      <MoveRight className="h-5 w-5 shrink-0 text-[#FF8A1F] transition-transform duration-300 group-hover:translate-x-1.5" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      </main>
    </div>
  );
}