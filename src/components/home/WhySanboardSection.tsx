'use client';

import { ArrowLeftRight, MessagesSquare, ShieldCheck } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useHomepageReveal } from './useHomepageReveal';

const features = [
  { icon: ArrowLeftRight, title: 'Hızlı Karşılaştır', description: 'Farklı ilanları kolayca karşılaştır, ihtiyaçlarına en uygun seçeneği bul.' },
  { icon: ShieldCheck, title: 'Güvenli Teklif', description: 'Sanboard teklif sistemi üzerinden ilan sahibine yapılandırılmış teklif gönder.' },
  { icon: MessagesSquare, title: 'Doğrudan İletişim', description: 'Teklif kabul edildiğinde görünür iletişim bilgileri üzerinden satıcıya ulaş.' },
];

export function WhySanboardSection() {
  const sectionRef = useHomepageReveal<HTMLElement>();

  return <section ref={sectionRef} className="homepage-why mx-auto mt-10 max-w-[1480px] px-4 sm:mt-14 sm:px-6 lg:px-8"><div className="grid gap-7 rounded-2xl border border-[var(--border-app)] bg-[color-mix(in_srgb,var(--bg-surface)_82%,transparent)] p-5 sm:p-7 lg:grid-cols-[.8fr_1.2fr] lg:items-center lg:p-8"><div className="homepage-why-copy"><span className="inline-flex rounded-md border border-[#ff8a1f]/45 bg-[#ff8a1f]/8 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.18em] text-[#ff9d45]">Neden Sanboard?</span><h2 className="mt-4 text-2xl font-black leading-tight tracking-[-.035em] text-[var(--text-main)] sm:text-3xl">Los Santos&apos;ta daha kolay,<br /><span className="text-[#ff8a1f]">daha güvenli, daha hızlı.</span></h2></div><div className="grid gap-3 sm:grid-cols-3">{features.map(({ icon: Icon, title, description }, index) => <article key={title} className="homepage-feature-card homepage-why-card" style={{ '--reveal-index': index } as CSSProperties}><span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#ff8a1f]/25 bg-[#ff8a1f]/10 text-[#ff9d45] shadow-[0_0_24px_rgba(255,138,31,.08)]"><Icon className="h-4 w-4" /></span><h3 className="mt-4 text-sm font-extrabold text-[var(--text-main)]">{title}</h3><p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{description}</p></article>)}</div></div></section>;
}