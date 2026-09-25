export default function RootLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6" aria-busy="true">
      <div className="h-8 w-64 rounded-xl bg-[var(--bg-surface-secondary)] animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="surface-card overflow-hidden rounded-2xl border border-[var(--border-app)]">
            <div className="aspect-[16/10] bg-[var(--bg-surface-secondary)] animate-pulse" />
            <div className="p-4 space-y-3">
              <div className="h-6 w-1/3 rounded bg-[var(--bg-surface-secondary)] animate-pulse" />
              <div className="h-4 w-4/5 rounded bg-[var(--bg-surface-secondary)] animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-[var(--bg-surface-secondary)] animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}