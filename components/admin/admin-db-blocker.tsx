export function AdminDbBlocker() {
  return (
    <div className="rounded-lg border border-warning/30 bg-[#F7F1E8] p-6 shadow-card">
      <p className="text-sm font-bold uppercase text-warning">CRM тимчасово недоступна</p>
      <h2 className="mt-2 text-2xl font-bold text-foreground">DATABASE_URL не налаштований</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
        Для CRM потрібне підключення до бази даних. Дані не імітуються, щоб менеджер не працював з фейковими заявками.
      </p>
    </div>
  );
}
