import {
  auditDiffRows,
  auditValueRows,
  formatAuditMetadata
} from '@/lib/audit-log/presentation';

function ValueCard({ title, value }: { title: string; value: unknown }) {
  const rows = auditValueRows(value);
  return (
    <section className="min-w-0 rounded-lg border border-border bg-card p-4">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      {rows.length ? (
        <dl className="mt-4 grid gap-3">
          {rows.map((row) => (
            <div key={row.key} className="min-w-0 rounded-md bg-surface-muted p-3">
              <dt className="text-xs font-bold uppercase text-muted">{row.label}</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : <p className="mt-4 text-sm text-muted">—</p>}
    </section>
  );
}

export function AuditBeforeAfter({ oldValue, newValue }: { oldValue: unknown; newValue: unknown }) {
  const diff = auditDiffRows(oldValue, newValue);
  return (
    <section className="cabinet-card">
      <h2 className="text-xl font-bold text-foreground">Зміни</h2>
      {diff.length ? (
        <div className="mt-5 overflow-hidden rounded-lg border border-border">
          <div className="hidden grid-cols-[minmax(10rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] bg-surface-muted text-sm font-bold text-muted sm:grid">
            <div className="px-4 py-3">Поле</div><div className="px-4 py-3">Було</div><div className="px-4 py-3">Стало</div>
          </div>
          <div className="divide-y divide-border">
            {diff.map((row) => (
              <div key={row.key} className={`grid min-w-0 gap-3 p-4 sm:grid-cols-[minmax(10rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] ${row.changed ? 'bg-amber-50/60' : 'bg-card'}`}>
                <p className="break-words font-bold text-foreground">{row.label}</p>
                <div className="min-w-0"><p className="text-xs font-bold uppercase text-muted sm:hidden">Було</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted sm:mt-0">{row.before}</p></div>
                <div className="min-w-0"><p className="text-xs font-bold uppercase text-muted sm:hidden">Стало</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground sm:mt-0">{row.after}</p></div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <ValueCard title="Було" value={oldValue} />
          <ValueCard title="Стало" value={newValue} />
        </div>
      )}
    </section>
  );
}

export function AuditMetadata({ metadata }: { metadata: unknown }) {
  const details = formatAuditMetadata(metadata);
  return (
    <section className="cabinet-card">
      <h2 className="text-xl font-bold text-foreground">Деталі події</h2>
      {details.length ? (
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {details.map((detail) => (
            <div key={detail.key} className="min-w-0 rounded-md bg-surface-muted p-4">
              <dt className="text-xs font-bold uppercase text-muted">{detail.label}</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">{detail.value}</dd>
            </div>
          ))}
        </dl>
      ) : <p className="mt-4 text-sm text-muted">Додаткових даних немає.</p>}
    </section>
  );
}
