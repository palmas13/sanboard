import React from 'react';
import Link from 'next/link';
import { SanboardLogo } from '../common/SanboardLogo';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--border-app)] bg-[var(--bg-surface)] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-[var(--border-app)]">
          <div className="space-y-2 max-w-sm">
            <SanboardLogo size="md" />
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              San Andreas'ın en kapsamlı roleplay ilan platformu. Araç ve mülk alım satımında güvenilir buluşma noktası.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[var(--text-muted)]">
            <Link href="/arac" className="hover:text-[var(--text-main)] transition-colors">
              Araç İlanları
            </Link>
            <Link href="/mulk" className="hover:text-[var(--text-main)] transition-colors">
              Mülk İlanları
            </Link>
            <Link href="/ilan-ver" className="hover:text-[#FF8A1F] transition-colors font-medium">
              İlan Ver
            </Link>
            <Link href="/hakkimizda" className="hover:text-[var(--text-main)] transition-colors">
              Hakkımızda
            </Link>
            <Link href="/kullanim-kosullari" className="hover:text-[var(--text-main)] transition-colors">
              Kullanım Koşulları
            </Link>
            <Link href="/gizlilik" className="hover:text-[var(--text-main)] transition-colors">
              Gizlilik
            </Link>
            <Link href="/iletisim" className="hover:text-[var(--text-main)] transition-colors">
              İletişim
            </Link>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-dim)]">
          <p>© {new Date().getFullYear()} Sanboard. Tüm hakları saklıdır.</p>
          <p className="flex items-center gap-1.5">
            <span>Los Santos, San Andreas</span>
            <span>•</span>
            <span className="text-[var(--text-muted)]">GTA World RP Community</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
