import { CheckCircle2, Info } from 'lucide-react';
import type { ListingQualityResult } from '@/lib/listings/quality';

export function ListingQualityIndicator({ quality, compact = false }: { quality: ListingQualityResult; compact?: boolean }) {
  return (
    <aside className={`rounded-2xl border border-[#FF8A1F]/25 bg-[var(--brand-orange-subtle)]/40 ${compact ? 'p-4' : 'p-5'} space-y-3`} aria-label="İlan tamamlanma özeti">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#FF8A1F]">İlan Tamamlanma</p>
          <p className="mt-0.5 text-xs font-semibold text-[var(--text-main)]">{quality.label}</p>
        </div>
        <strong className="text-xl font-black text-[#FF8A1F]">%{quality.percentage}</strong>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-surface-secondary)]" aria-hidden="true">
        <div className="h-full rounded-full bg-[#FF8A1F] transition-[width] duration-300" style={{ width: `${quality.percentage}%` }} />
      </div>
      {quality.suggestions.length > 0 ? (
        <ul className="space-y-1.5">
          {quality.suggestions.slice(0, compact ? 3 : 4).map((suggestion) => (
            <li key={suggestion} className="flex items-start gap-2 text-[11px] text-[var(--text-muted)]">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF8A1F]" />
              <span>{suggestion}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-[11px] font-semibold text-[var(--color-success)]"><CheckCircle2 className="h-3.5 w-3.5" />Önemli ilan bilgileri tamamlandı.</p>
      )}
      <p className="text-[10px] text-[var(--text-dim)]">Bu gösterge tavsiye niteliğindedir; yayın sıralamasını veya zorunlu alan doğrulamasını etkilemez.</p>
    </aside>
  );
}