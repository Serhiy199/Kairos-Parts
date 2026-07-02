import { getAllManufacturers } from '@/lib/catalog/catalog-data';
import { requireAdminSession } from '@/lib/admin/access';

export default async function AdminManufacturersPage() {
  await requireAdminSession();
  const manufacturers = getAllManufacturers();

  return (
    <section className="mx-auto max-w-7xl">
      <div className="rounded-lg border border-border bg-card p-6 shadow-card">
        <p className="text-sm font-semibold text-warning">Day 5 CRM placeholder</p>
        <h2 className="mt-2 text-2xl font-bold text-foreground">Виробники</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
          Стартовий перелік виробників для інформаційної структури. Це не повний довідник і не товарний каталог.
          Повний CRUD буде додано в окремому admin/CRM етапі.
        </p>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <div className="grid grid-cols-[1fr_1fr] border-b border-border bg-surface-muted px-4 py-3 text-xs font-bold uppercase text-muted">
          <span>Виробник</span>
          <span>Напрям</span>
        </div>
        <div className="divide-y divide-border">
          {manufacturers.map((manufacturer) => (
            <div key={`${manufacturer.name}-${manufacturer.categorySlug}`} className="grid grid-cols-[1fr_1fr] gap-3 px-4 py-3 text-sm">
              <span className="font-semibold text-foreground">{manufacturer.name}</span>
              <span className="text-muted">{manufacturer.categoryName}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
