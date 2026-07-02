export default function ClientDocumentsLoading() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-card">
      <div className="h-4 w-28 rounded bg-surface-muted" />
      <div className="mt-4 h-8 w-64 rounded bg-surface-muted" />
      <div className="mt-4 h-4 max-w-2xl rounded bg-surface-muted" />
      <div className="mt-6 grid gap-3">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="grid grid-cols-4 gap-4 rounded border border-border p-4">
            <div className="h-4 rounded bg-surface-muted" />
            <div className="h-4 rounded bg-surface-muted" />
            <div className="h-4 rounded bg-surface-muted" />
            <div className="h-4 rounded bg-surface-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
