export default function ClientVehiclesLoading() {
  return (
    <div className="grid gap-6">
      <div className="rounded-lg border border-border bg-card p-6 shadow-card">
        <div className="h-4 w-36 rounded bg-surface-muted" />
        <div className="mt-4 h-8 w-72 rounded bg-surface-muted" />
        <div className="mt-4 h-4 max-w-xl rounded bg-surface-muted" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[1, 2].map((item) => (
          <div key={item} className="rounded-lg border border-border bg-card p-5 shadow-card">
            <div className="h-4 w-28 rounded bg-surface-muted" />
            <div className="mt-4 h-7 w-56 rounded bg-surface-muted" />
            <div className="mt-4 h-4 w-44 rounded bg-surface-muted" />
            <div className="mt-6 flex gap-3">
              <div className="h-10 w-28 rounded bg-surface-muted" />
              <div className="h-10 w-44 rounded bg-surface-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
