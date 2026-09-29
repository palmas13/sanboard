import { CalendarDays, Clock3, RefreshCw } from 'lucide-react';
import type { MemberListingDetail } from '@/types';
import { formatDate, formatTimeRemaining } from '@/lib/utils/format';

export function ListingDescription({ listing }: { listing: MemberListingDetail }) {
  const remaining = formatTimeRemaining(listing.expires_at);
  return (
    <section data-testid="listing-description" className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-5 shadow-[0_16px_45px_rgba(0,0,0,.12)] sm:p-6">
      <h2 className="text-xs font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">İlan Açıklaması</h2>
      <div className="my-4 h-px bg-[var(--border-app)]" />
      <p className="whitespace-pre-line text-sm leading-7 text-[var(--text-main)]">{listing.description || 'Açıklama belirtilmemiş.'}</p>
      <dl className="mt-6 grid gap-3 border-t border-[var(--border-app)] pt-4 text-xs text-[var(--text-muted)] sm:grid-cols-3">
        {listing.published_at ? <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[var(--text-dim)]" /><span>Yayınlandı <strong className="text-[var(--text-main)]">{formatDate(listing.published_at)}</strong></span></div> : null}
        {listing.expires_at ? <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-[var(--text-dim)]" /><span>Kalan Süre <strong className={remaining.isExpired ? 'text-red-300' : 'text-[var(--text-main)]'}>{remaining.text.replace(' kaldı', '')}</strong></span></div> : null}
        {listing.updated_at && listing.updated_at !== listing.created_at ? <div className="flex items-center gap-2"><RefreshCw className="h-4 w-4 text-[var(--text-dim)]" /><span>Güncellendi <strong className="text-[var(--text-main)]">{formatDate(listing.updated_at)}</strong></span></div> : null}
      </dl>
    </section>
  );
}