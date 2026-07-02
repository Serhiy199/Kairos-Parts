export default function AdminClientsLoading() {
  return (
    <div className="grid gap-6">
      <div className="rounded-lg border border-border bg-card p-6 shadow-card">
        <div className="h-4 w-36 rounded bg-surface-muted" />
        <div className="mt-4 h-8 w-44 rounded bg-surface-muted" />
      </div>
      <div className="rounded-lg border border-border bg-card p-6 shadow-card">
        <div className="grid gap-3">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-12 rounded bg-surface-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
