import Link from 'next/link';

export default function ClientVehicleNotFound() {
  return (
    <section className="rounded-lg border border-dashed border-border bg-card p-8 text-center shadow-card">
      <h2 className="text-xl font-bold text-foreground">Техніку не знайдено</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
        Ця одиниця техніки не існує або недоступна у вашому кабінеті.
      </p>
      <Link href="/client/vehicles" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        Повернутися до парку техніки
      </Link>
    </section>
  );
}
