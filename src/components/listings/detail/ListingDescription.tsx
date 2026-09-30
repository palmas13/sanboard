import { CalendarDays, Clock3, FileText, RefreshCw } from 'lucide-react';
import type { MemberListingDetail } from '@/types';
import { formatDate, formatTimeRemaining } from '@/lib/utils/format';

export function ListingDescription({ listing }: { listing: MemberListingDetail }) {
  const remaining = formatTimeRemaining(listing.expires_at);
  return (
    <section data-testid="listing-description" className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-4 shadow-[0_12px_36px_rgba(0,0,0,.09)] sm:p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-main)]"><FileText className="h-4 w-4 text-[#FF8A1F]" />İlan Açıklaması</h2>
      <p className="mt-3 max-w-4xl whitespace-pre-line text-sm leading-6 text-[var(--text-main)]">{listing.description || 'Açıklama belirtilmemiş.'}</p>
      <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--border-app)] pt-3 text-[11px] text-[var(--text-dim)]">
        {listing.published_at ? <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /><span>Yayınlandı <strong className="font-semibold text-[var(--text-muted)]">{formatDate(listing.published_at)}</strong></span></div> : null}
        {listing.expires_at ? <div className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /><span>Kalan süre <strong className={remaining.isExpired ? 'font-semibold text-red-300' : 'font-semibold text-[var(--text-muted)]'}>{remaining.text.replace(' kaldı', '')}</strong></span></div> : null}
        {listing.updated_at && listing.updated_at !== listing.created_at ? <div className="flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" /><span>Güncellendi <strong className="font-semibold text-[var(--text-muted)]">{formatDate(listing.updated_at)}</strong></span></div> : null}
      </dl>
    </section>
  );
}