export default function ClientVehiclesLoading() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Завантаження парку техніки">
      <div className="rounded-lg border border-border bg-card p-6 shadow-card">
        <div className="h-4 w-36 animate-pulse rounded bg-surface-muted" />
        <div className="mt-4 h-8 w-full max-w-72 animate-pulse rounded bg-surface-muted" />
        <div className="mt-4 h-4 w-full max-w-xl animate-pulse rounded bg-surface-muted" />
      </div>
      <div className="h-10 w-52 animate-pulse rounded bg-surface-muted" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
            <div className="aspect-[16/10] animate-pulse bg-surface-muted" />
            <div className="p-5">
              <div className="h-4 w-24 animate-pulse rounded bg-surface-muted" />
              <div className="mt-3 h-7 w-48 max-w-full animate-pulse rounded bg-surface-muted" />
              <div className="mt-5 h-24 animate-pulse rounded bg-surface-muted" />
              <div className="mt-5 h-10 animate-pulse rounded bg-surface-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
