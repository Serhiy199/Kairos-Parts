import Link from 'next/link';
import { notFound } from 'next/navigation';

import { catalogCategories, getCategoryBySlug } from '@/lib/catalog/catalog-data';

export function generateStaticParams() {
  return catalogCategories.map((category) => ({
    slug: category.slug
  }));
}

export default async function CategoryDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  return (
    <>
      <section className="bg-primary px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Link href="/categories" className="text-sm font-semibold text-accent transition hover:text-white">
            Назад до всіх категорій
          </Link>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">{category.name}</h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-sidebar-text">{category.description}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/request?category=${category.slug}`}
              className="rounded-md bg-accent px-5 py-3 text-center text-sm font-bold text-foreground transition hover:bg-[#DFA600]"
            >
              Створити заявку на підбір
            </Link>
            <Link
              href={`/request?category=${category.slug}&mode=file`}
              className="rounded-md border border-white/20 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Надіслати фото або список
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-background px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_0.85fr]">
          <div className="rounded-lg border border-border bg-card p-6 shadow-card">
            <p className="text-sm font-bold uppercase text-accent">Підкатегорії</p>
            <h2 className="mt-2 text-3xl font-bold text-foreground">Що можна вказати у заявці</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {category.subcategories.map((subcategory) => (
                <div key={subcategory} className="rounded-md border border-border bg-surface-muted px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">{subcategory}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6 shadow-card">
            <p className="text-sm font-bold uppercase text-accent">Виробники</p>
            <h2 className="mt-2 text-3xl font-bold text-foreground">Стартовий перелік</h2>
            <p className="mt-4 text-sm leading-6 text-muted">
              Список не є повним каталогом. Якщо потрібного виробника немає, його можна вказати в описі заявки.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {category.manufacturers.map((manufacturer) => (
                <span key={manufacturer} className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-foreground">
                  {manufacturer}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-card px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-lg border border-border bg-surface-muted p-6">
            <p className="text-sm font-bold uppercase text-accent">Як створити заявку по цій категорії</p>
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {[
                'Оберіть цей напрям або перейдіть до заявки з підставленою категорією.',
                category.requestHint,
                'Менеджер перевірить сумісність, уточнить деталі та підбере рішення.'
              ].map((item, index) => (
                <div key={item} className="rounded-lg border border-border bg-card p-5">
                  <div className="grid size-10 place-items-center rounded-md bg-primary text-sm font-bold text-accent">{index + 1}</div>
                  <p className="mt-4 text-sm font-semibold leading-6 text-foreground">{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/request?category=${category.slug}`}
                className="rounded-md bg-accent px-5 py-3 text-center text-sm font-bold text-foreground transition hover:bg-[#DFA600]"
              >
                Створити заявку на підбір
              </Link>
              <Link
                href="/categories"
                className="rounded-md border border-border px-5 py-3 text-center text-sm font-semibold text-foreground transition hover:border-accent hover:bg-card"
              >
                До всіх категорій
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
