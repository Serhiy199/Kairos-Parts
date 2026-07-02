export default function AdminLoading() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="rounded-lg border border-border bg-card p-5 shadow-card">
            <div className="h-4 w-28 rounded bg-surface-muted" />
            <div className="mt-4 h-8 w-16 rounded bg-surface-muted" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-card p-6 shadow-card">
        <div className="h-5 w-36 rounded bg-surface-muted" />
        <div className="mt-5 grid gap-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-12 rounded bg-surface-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
