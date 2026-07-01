import Link from 'next/link';

import { catalogCategories } from '@/lib/catalog/catalog-data';

export default function AdminCategoriesPage() {
  return (
    <section className="mx-auto max-w-7xl">
      <div className="rounded-lg border border-border bg-card p-6 shadow-card">
        <p className="text-sm font-semibold text-warning">Day 5 CRM placeholder</p>
        <div className="mt-2 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Категорії та підкатегорії</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
              Стартова структура напрямів підбору. Повне редагування, валідація slug і CRUD будуть реалізовані
              в наступних admin/CRM етапах.
            </p>
          </div>
          <Link
            href="/categories"
            className="rounded-md border border-border px-4 py-2 text-center text-sm font-semibold text-foreground transition hover:border-accent hover:bg-surface-muted"
          >
            Public view
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {catalogCategories.map((category) => (
          <article key={category.id} className="rounded-lg border border-border bg-card p-5 shadow-card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">{category.name}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{category.description}</p>
              </div>
              <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">{category.slug}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {category.subcategories.map((subcategory) => (
                <span key={subcategory} className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-foreground">
                  {subcategory}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
