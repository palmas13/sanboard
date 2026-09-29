import { ShieldCheck } from 'lucide-react';

export function SafeShoppingCard() {
  return (
    <section data-testid="safe-shopping-card" className="rounded-2xl border border-emerald-400/15 bg-[var(--bg-surface)] p-3.5 shadow-[0_14px_40px_rgba(0,0,0,.1)]">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300"><ShieldCheck className="h-4 w-4" /></div>
        <div>
          <h2 className="text-xs font-black uppercase tracking-[0.12em] text-[var(--text-main)]">Güvenli Alışveriş</h2>
          <p className="mt-1 text-[11px] leading-4 text-[var(--text-muted)]">Sanboard üzerinden iletişim kurun, şüpheli taleplere karşı dikkatli olun.</p>
        </div>
      </div>
    </section>
  );
}