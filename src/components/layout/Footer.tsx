import React from 'react';
import Link from 'next/link';
import { SanboardLogo } from '../common/SanboardLogo';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-[color:var(--border-app)]/80 bg-[var(--bg-surface)] transition-colors">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-7 border-b border-[color:var(--border-app)]/70 pb-8 md:flex-row md:items-center">
          <div className="max-w-md space-y-3">
            <SanboardLogo size="md" />
            <p className="text-sm leading-relaxed text-[var(--text-muted)]">
              Los Santos'ta araç ve mülk alım satımının buluşma noktası. İlan ver, keşfet, iletişime geç.
            </p>
          </div>

          <div className="flex max-w-xl flex-wrap items-center gap-x-6 gap-y-3 text-sm text-[var(--text-muted)]">
            <Link href="/arac" className="transition-colors hover:text-[#FF8A1F]">
              Araç İlanları
            </Link>
            <Link href="/mulk" className="transition-colors hover:text-[#FF8A1F]">
              Mülk İlanları
            </Link>
            <Link href="/ilan-ver" className="hover:text-[#FF8A1F] transition-colors font-medium">
              İlan Ver
            </Link>
            <Link href="/sss" className="transition-colors hover:text-[var(--text-main)]">
              S.S.S
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
          <p>© 2026 Sanboard.</p>
        </div>
      </div>
    </footer>
  );
}
