import { ArrowLeftRight, Handshake, ShieldCheck } from 'lucide-react';

export function SafeShoppingCard() {
  return (
    <aside data-testid="safe-shopping-card" className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-3.5 text-[11px] leading-4 text-[var(--text-muted)]">
      <div className="flex items-start gap-2.5"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300/80" /><p><strong className="font-semibold text-[var(--text-main)]">Güvenli alışveriş:</strong>{' '}Sanboard üzerinden iletişim kurun ve şüpheli taleplere karşı dikkatli olun.</p></div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 border-t border-[var(--border-app)] pt-2">
        <span className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface)]/55 px-2 py-1.5 font-semibold text-[var(--text-main)]"><ArrowLeftRight className="h-3.5 w-3.5 text-[#FF8A1F]" />Hızlı Karşılaştır</span>
        <span className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface)]/55 px-2 py-1.5 font-semibold text-[var(--text-main)]"><Handshake className="h-3.5 w-3.5 text-[#FF8A1F]" />Güvenli Teklif</span>
      </div>
    </aside>
  );
}