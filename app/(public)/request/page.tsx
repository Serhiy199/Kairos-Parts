import { catalogCategories, getCategoryBySlug } from '@/lib/catalog/catalog-data';
import { getUploadMaxSizeMb } from '@/lib/files/upload-policy';

import { RequestForm } from './request-form';

export default async function RequestPage({
  searchParams
}: {
  searchParams: Promise<{ category?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const initialCategory = params.category && getCategoryBySlug(params.category) ? params.category : undefined;
  const maxSizeMb = getUploadMaxSizeMb();

  return (
    <>
      <section className="bg-primary px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-bold uppercase text-accent">Створити заявку</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
            Опишіть потребу, додайте файл або фото, і менеджер підбере рішення
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-sidebar-text">
            Форма збирає дані для менеджера Kairos Parts. Це не кошик і не автоматичне замовлення: заявка
            потрапляє в базу для подальшої обробки CRM.
          </p>
        </div>
      </section>

      <section className="bg-background px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_0.45fr] lg:items-start">
          <RequestForm categories={[...catalogCategories]} initialCategory={initialCategory} initialMode={params.mode} maxSizeMb={maxSizeMb} />
          <aside className="rounded-lg border border-border bg-card p-6 shadow-card">
            <p className="text-sm font-bold uppercase text-accent">Що підготувати</p>
            <div className="mt-5 grid gap-4 text-sm leading-6 text-muted">
              <p>1. Назву компанії або контактну особу.</p>
              <p>2. Телефон для уточнення деталей.</p>
              <p>3. Опис деталі, вузла або проблеми.</p>
              <p>4. Фото, PDF, Excel або DOC список, якщо є.</p>
            </div>
            {initialCategory ? (
              <div className="mt-6 rounded-md border border-accent/40 bg-[#FFFBEB] p-4 text-sm text-foreground">
                Категорію вже підставлено з посилання: {getCategoryBySlug(initialCategory)?.name}
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    </>
  );
}
