export default function AccountLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Hesap özeti yükleniyor">
      <div className="surface-card flex items-center gap-4 rounded-2xl border border-[var(--border-app)] p-5">
        <div className="h-12 w-12 animate-pulse rounded-full bg-[var(--bg-surface-secondary)]" />
        <div className="flex-1 space-y-2"><div className="h-5 w-40 animate-pulse rounded bg-[var(--bg-surface-secondary)]" /><div className="h-3 w-2/3 animate-pulse rounded bg-[var(--bg-surface-secondary)]" /></div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => <div key={index} className="surface-card space-y-3 rounded-2xl border border-[var(--border-app)] p-4"><div className="h-5 w-5 animate-pulse rounded bg-[var(--bg-surface-secondary)]" /><div className="h-8 w-16 animate-pulse rounded bg-[var(--bg-surface-secondary)]" /></div>)}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--bg-surface-secondary)]" />)}</div>
      <div className="surface-card space-y-3 rounded-2xl border border-[var(--border-app)] p-5"><div className="h-5 w-48 animate-pulse rounded bg-[var(--bg-surface-secondary)]" />{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-xl bg-[var(--bg-surface-secondary)]" />)}</div>
    </div>
  );
}