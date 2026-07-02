export function ClientDbBlocker() {
  return (
    <div className="rounded-lg border border-warning/30 bg-[#FFFBEB] p-6 shadow-card">
      <p className="text-sm font-bold uppercase text-warning">Потрібна база даних</p>
      <h2 className="mt-2 text-xl font-bold text-foreground">DATABASE_URL не налаштований</h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        Кабінет клієнта читає реальні профілі та заявки з PostgreSQL. Без `DATABASE_URL` дані не симулюються.
      </p>
    </div>
  );
}
