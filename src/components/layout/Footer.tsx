import React from 'react';
import Link from 'next/link';
import { SanboardLogo } from '../common/SanboardLogo';

export function Footer() {
  return (
    <footer className="mt-auto px-4 pb-4 pt-12 sm:px-6 sm:pb-6 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-[2rem] border border-[var(--border-app)] bg-[var(--bg-surface)] px-6 py-10 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:px-10 sm:py-12">
        <div className="flex flex-col items-center border-b border-[var(--border-app)] pb-9 text-center">
          <div className="max-w-xl space-y-4">
            <SanboardLogo size="md" />
            <p className="text-sm leading-relaxed text-[var(--text-muted)]">
              Los Santos'ta araç ve mülk alım satımının buluşma noktası. İlan ver, keşfet, iletişime geç.
            </p>
          </div>

          <nav aria-label="Footer" className="mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm text-[var(--text-muted)]">
            <Link href="/arac" className="transition-colors hover:text-[#FF8A1F]">
              Araçlar
            </Link>
            <Link href="/mulk" className="transition-colors hover:text-[#FF8A1F]">
              Mülkler
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
          </nav>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 pt-6 text-xs text-[var(--text-dim)] sm:flex-row">
          <p>© 2026 Sanboard</p>
          <div className="flex gap-5"><Link href="/gizlilik" className="transition-colors hover:text-[#FF8A1F]">Gizlilik</Link><Link href="/kullanim-kosullari" className="transition-colors hover:text-[#FF8A1F]">Kullanım Koşulları</Link></div>
        </div>
      </div>
    </footer>
  );
}
