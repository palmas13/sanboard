import { ShieldCheck } from 'lucide-react';

export function SafeShoppingCard() {
  return (
    <section data-testid="safe-shopping-card" className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.045] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><ShieldCheck className="h-4 w-4" /></div>
        <div>
          <h2 className="text-xs font-black uppercase tracking-[0.12em] text-[var(--text-main)]">Güvenli Alışveriş</h2>
          <p className="mt-1.5 text-xs leading-5 text-[var(--text-muted)]">Sanboard üzerinden iletişim kurun, şüpheli taleplere karşı dikkatli olun.</p>
        </div>
      </div>
    </section>
  );
}