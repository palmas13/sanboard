import { ShieldCheck } from 'lucide-react';

export function SafeShoppingCard() {
  return (
    <aside data-testid="safe-shopping-card" className="flex items-start gap-2.5 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)]/35 px-3 py-2.5 text-[11px] leading-4 text-[var(--text-muted)]">
      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300/80" />
      <div>
        <strong className="font-semibold text-[var(--text-main)]">Güvenli alışveriş:</strong>{' '}
        Sanboard üzerinden iletişim kurun ve şüpheli taleplere karşı dikkatli olun.
      </div>
    </aside>
  );
}