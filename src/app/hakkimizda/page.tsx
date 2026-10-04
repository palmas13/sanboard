import React from 'react';
import { SanboardLogo } from '@/components/common/SanboardLogo';
import { ShieldCheck, Building, Car, Gamepad2 } from 'lucide-react';

export default function HakkimizdaPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-10">
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <SanboardLogo size="lg" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-main)]">
          Los Santos'un İlan Platformu
        </h1>
        <p className="text-sm text-[var(--text-muted)] max-w-xl mx-auto">
          Sanboard, GTA World evreninde araç ve mülk alım satımını kolaylaştıran bağımsız bir roleplay ilan ağıdır.
        </p>
      </div>

      <div className="surface-card p-6 sm:p-8 rounded-2xl border border-[var(--border-app)] space-y-6 text-sm text-[var(--text-main)] leading-relaxed">
        <h2 className="text-lg font-bold text-[#FF8A1F]">Platform Mantığı</h2>
        <p>
          Sanboard, doğrudan oyun içi araç veya mülk devri yapmaz. Platformumuz alıcı ile satıcıyı profesyonel bir ortamda buluşturur, ilanları yayınlar ve satıcının iletişim kanallarını üye oyunculara sunar.
        </p>
        <p>
          Tüm pazarlık, araç inceleme, noter satışı ve mülk tapu devir işlemleri GTA World San Andreas sunucusu içerisinde oyuncular arasında rol çerçevesinde gerçekleştirilir.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[var(--border-app)]">
          <div className="p-4 rounded-xl bg-[var(--bg-surface-secondary)] space-y-1 text-center">
            <Car className="w-6 h-6 text-[#FF8A1F] mx-auto" />
            <h4 className="font-bold text-sm">Geniş Araç Pazarı</h4>
            <p className="text-xs text-[var(--text-muted)]">Otomobil, SUV ve motosiklet ilanları</p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--bg-surface-secondary)] space-y-1 text-center">
            <Building className="w-6 h-6 text-[#FF8A1F] mx-auto" />
            <h4 className="font-bold text-sm">Gayrimenkul Portföyü</h4>
            <p className="text-xs text-[var(--text-muted)]">Daireler, lüks villalar ve ticari alanlar</p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--bg-surface-secondary)] space-y-1 text-center">
            <ShieldCheck className="w-6 h-6 text-[#FF8A1F] mx-auto" />
            <h4 className="font-bold text-sm">Doğrulanmış Karakterler</h4>
            <p className="text-xs text-[var(--text-muted)]">GTA World kimlik ve SanMail entegrasyonu</p>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.04] p-6 sm:p-8" aria-labelledby="ooc-title">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-400/10 text-sky-300"><Gamepad2 className="h-5 w-5" /></span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-300">OOC · Platform sınırları</p>
            <h2 id="ooc-title" className="mt-2 text-lg font-bold text-[var(--text-main)]">Bağımsız Sanboard projesi</h2>
            <div className="mt-3 space-y-4 text-sm leading-6 text-[var(--text-muted)]">
              <p>(( Sanboard, <a href="https://discord.com/users/1081946432401068125" target="_blank" rel="noopener noreferrer" className="font-semibold text-sky-400 underline decoration-sky-400/40 underline-offset-4 transition-colors hover:text-sky-300 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">palmas</a> ve <a href="https://discord.com/users/1008025961431830559" target="_blank" rel="noopener noreferrer" className="font-semibold text-sky-400 underline decoration-sky-400/40 underline-offset-4 transition-colors hover:text-sky-300 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">mavisim</a> tarafından GTA World Türkiye oyuncuları için bağımsız olarak geliştirilmiş bir ilan platformudur. Platformun temel amacı, oyuncuların oyun içi araç ve mülk ticaretini daha kolay, hızlı ve keyifli bir şekilde gerçekleştirebilmesini sağlamaktır.</p>
              <p>Sanboard üzerinde yer alan ilanlar, fiyatlar, ödemeler ve diğer tüm ekonomik değerler yalnızca oyun içi kullanım amacı taşır ve gerçek hayatta herhangi bir maddi karşılığı bulunmaz. Sanboard’un GTA World veya GTA World Türkiye ile resmî bir bağlantısı, ortaklığı ya da temsil ilişkisi bulunmamaktadır. Platform tamamen bağımsız bir proje olarak geliştirilmiştir.</p>
              <p>Site içerisinde karşılaştığınız hataları bildirmek, önerilerinizi iletmek veya bizimle iletişime geçmek için Discord adreslerimiz üzerinden bize ulaşabilirsiniz. ))</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
