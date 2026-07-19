export default function ClientVehicleDetailLoading() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Завантаження даних техніки">
      <div className="h-5 w-48 animate-pulse rounded bg-surface-muted" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="rounded-lg border border-border bg-card p-5 shadow-card">
          <div className="h-7 w-52 animate-pulse rounded bg-surface-muted" />
          <div className="mt-4 aspect-[16/9] animate-pulse rounded bg-surface-muted" />
        </div>
        <div className="rounded-lg border border-border bg-card p-6 shadow-card">
          <div className="h-6 w-32 animate-pulse rounded bg-surface-muted" />
          <div className="mt-5 h-9 w-64 max-w-full animate-pulse rounded bg-surface-muted" />
          <div className="mt-8 grid gap-4">
            {[1, 2, 3, 4].map((item) => <div key={item} className="h-6 animate-pulse rounded bg-surface-muted" />)}
          </div>
        </div>
      </div>
      <div className="h-44 animate-pulse rounded-lg border border-border bg-card shadow-card" />
    </div>
  );
}
