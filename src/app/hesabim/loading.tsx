export default function AccountLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="surface-card p-6 rounded-2xl border border-[var(--border-app)] space-y-3">
        <div className="h-7 w-52 rounded bg-[var(--bg-surface-secondary)] animate-pulse" />
        <div className="h-4 w-3/4 rounded bg-[var(--bg-surface-secondary)] animate-pulse" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="surface-card p-5 rounded-2xl border border-[var(--border-app)] space-y-4">
            <div className="h-9 w-9 rounded-xl bg-[var(--bg-surface-secondary)] animate-pulse" />
            <div className="h-8 w-16 rounded bg-[var(--bg-surface-secondary)] animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}