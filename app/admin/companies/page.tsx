import Link from 'next/link';

import { createCompany } from '@/app/admin/company-actions';
import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const inputClass = 'rounded-md border border-border px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25';

function resultMessage(result?: string) {
  const messages: Record<string, string> = {
    database: 'DATABASE_URL не налаштовано.',
    validation: 'Перевірте обовʼязкові поля компанії.',
    duplicate: 'Компанія з такою назвою та ЄДРПОУ вже існує.'
  };

  return result ? messages[result] : null;
}

export default async function AdminCompaniesPage({
  searchParams
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  await requireCrmSession();
  const query = await searchParams;

  if (!hasDatabaseUrl()) {
    return <AdminDbBlocker />;
  }

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          members: true,
          requests: true,
          vehicles: true
        }
      }
    }
  });
  const message = resultMessage(query.result);

  return (
    <div className="cabinet-stack">
      <div className="cabinet-card">
        <p className="text-sm font-bold uppercase text-accent">Компанії</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Company accounts</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Створюйте компанії та додавайте існуючих CLIENT-користувачів до спільного кабінету компанії.
        </p>
        {message ? <div className="mt-4 rounded-md border border-warning/30 bg-[#FFF7E0] p-4 text-sm font-semibold text-[#8A5B24]">{message}</div> : null}
      </div>

      <form action={createCompany} className="cabinet-card grid gap-4">
        <h2 className="text-lg font-bold text-foreground">Створити компанію</h2>
        <div className="cabinet-form-grid">
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Назва *
            <input name="name" required className={inputClass} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            ЄДРПОУ
            <input name="edrpou" className={inputClass} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Email
            <input name="email" type="email" className={inputClass} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Телефон
            <input name="phone" className={inputClass} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground lg:col-span-2">
            Юридична адреса
            <input name="legalAddress" className={inputClass} />
          </label>
        </div>
        <button className="w-fit rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover">
          Створити компанію
        </button>
      </form>

      <div className="cabinet-card">
        <h2 className="text-lg font-bold text-foreground">Список компаній</h2>
        <div className="mt-5 grid gap-3 xl:hidden">
          {companies.map((company) => (
            <article key={company.id} className="rounded-md border border-border p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Link href={`/admin/companies/${company.id}`} className="font-bold text-foreground transition hover:text-accent">
                  {company.name}
                </Link>
                <span className="text-sm text-muted">{company.createdAt.toLocaleDateString('uk-UA')}</span>
              </div>
              <dl className="cabinet-record-grid mt-4">
                <CompanyCardField label="ЄДРПОУ" value={company.edrpou ?? '—'} />
                <CompanyCardField label="Email" value={company.email ?? 'Не вказано'} />
                <CompanyCardField label="Телефон" value={company.phone ?? 'Не вказано'} />
                <CompanyCardField label="Учасники" value={String(company._count.members)} />
                <CompanyCardField label="Заявки" value={String(company._count.requests)} />
                <CompanyCardField label="Техніка" value={String(company._count.vehicles)} />
              </dl>
            </article>
          ))}
        </div>
        <div className="mt-5 hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-muted">
                <th className="px-4 py-3 font-bold">Компанія</th>
                <th className="px-4 py-3 font-bold">ЄДРПОУ</th>
                <th className="px-4 py-3 font-bold">Контакти</th>
                <th className="px-4 py-3 font-bold">Учасники</th>
                <th className="px-4 py-3 font-bold">Заявки</th>
                <th className="px-4 py-3 font-bold">Техніка</th>
                <th className="px-4 py-3 font-bold">Створено</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/companies/${company.id}`} className="font-bold text-foreground transition hover:text-accent">
                      {company.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{company.edrpou ?? '—'}</td>
                  <td className="px-4 py-3 text-muted">
                    <p>{company.email ?? 'Email не вказано'}</p>
                    <p className="mt-1">{company.phone ?? 'Телефон не вказано'}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">{company._count.members}</td>
                  <td className="px-4 py-3 font-semibold text-foreground">{company._count.requests}</td>
                  <td className="px-4 py-3 font-semibold text-foreground">{company._count.vehicles}</td>
                  <td className="px-4 py-3 text-muted">{company.createdAt.toLocaleDateString('uk-UA')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {companies.length === 0 ? <p className="mt-5 rounded-md border border-dashed border-border p-5 text-sm text-muted">Компаній ще немає.</p> : null}
      </div>
    </div>
  );
}

function CompanyCardField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold uppercase text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm text-foreground">{value}</dd>
    </div>
  );
}
