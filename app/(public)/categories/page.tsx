import Link from 'next/link';

import { catalogCategories } from '@/lib/catalog/catalog-data';

export default function CategoriesPage() {
  return (
    <>
      <section className="bg-primary px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-bold uppercase text-accent">Напрями підбору</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
            Категорії, підкатегорії та виробники для швидкого старту заявки
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-sidebar-text">
            Це не інтернет-магазин і не каталог товарів із цінами. Категорії допомагають зорієнтуватися,
            яку техніку або напрям обрати перед створенням заявки на підбір.
          </p>
        </div>
      </section>

      <section className="bg-background px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-2">
          {catalogCategories.map((category) => (
            <article key={category.id} className="rounded-lg border border-border bg-card p-6 shadow-card">
              <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">{category.name}</h2>
                  <p className="mt-3 text-sm leading-6 text-muted">{category.description}</p>
                </div>
                <Link
                  href={`/categories/${category.slug}`}
                  className="rounded-md border border-border px-4 py-2 text-center text-sm font-semibold text-foreground transition hover:border-accent hover:bg-surface-muted"
                >
                  Детальніше
                </Link>
              </div>
              <div className="mt-5">
                <p className="text-xs font-bold uppercase text-muted">Приклади підкатегорій</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {category.subcategories.slice(0, 6).map((item) => (
                    <span key={item} className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-foreground">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-5">
                <p className="text-xs font-bold uppercase text-muted">Виробники</p>
                <p className="mt-2 text-sm leading-6 text-foreground">{category.manufacturers.slice(0, 5).join(', ')}</p>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={`/request?category=${category.slug}`}
                  className="rounded-md bg-accent px-5 py-3 text-center text-sm font-bold text-foreground transition hover:bg-[#DFA600]"
                >
                  Створити заявку
                </Link>
                <Link
                  href={`/categories/${category.slug}`}
                  className="rounded-md border border-border px-5 py-3 text-center text-sm font-semibold text-foreground transition hover:border-accent hover:bg-surface-muted"
                >
                  Переглянути напрям
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
