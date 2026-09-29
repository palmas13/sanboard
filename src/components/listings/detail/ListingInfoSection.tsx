import { Sparkles, type LucideIcon } from 'lucide-react';

export interface ListingInfoItem {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  accent?: boolean;
  badge?: boolean;
  wide?: boolean;
}

export function ListingInfoSection({ title, items, children }: { title: string; items?: ListingInfoItem[]; children?: React.ReactNode }) {
  const visibleItems = items?.filter((item) => item.value !== null && item.value !== undefined && item.value !== '');
  if (!children && !visibleItems?.length) return null;

  return (
    <section className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-4 shadow-[0_16px_45px_rgba(0,0,0,.1)] sm:p-[18px]">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--text-muted)]"><Sparkles className="h-3.5 w-3.5 text-[#FF8A1F]" />{title}</h2>
      {children || (
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {visibleItems?.map(({ label, value, icon: Icon, accent, badge, wide }) => (
            <div key={label} className={`flex min-h-12 items-center gap-3 rounded-xl border border-white/[0.035] bg-[var(--bg-surface-secondary)]/45 px-3 py-2 ${wide ? 'sm:col-span-2' : ''}`}>
              {Icon ? <Icon className="h-4 w-4 shrink-0 text-[#FF9E45]" /> : null}
              <div className="min-w-0 flex-1">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{label}</dt>
                <dd className={`mt-1 break-words text-sm font-bold ${accent ? 'text-[#FF9E45]' : 'text-[var(--text-main)]'}`}>
                  {badge ? <span className="inline-flex rounded-full border border-[#FF8A1F]/25 bg-[#FF8A1F]/10 px-2.5 py-1 text-xs font-black text-[#FF9E45]">{value}</span> : value}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}