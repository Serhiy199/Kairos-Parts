import type { UsedEquipmentStatus } from '@prisma/client';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ComponentType } from 'react';
import { FaCalendarAlt, FaIndustry, FaTractor } from 'react-icons/fa';

import { PublicUsedEquipmentGallery } from '@/components/used-equipment/public-used-equipment-gallery';
import { UsedEquipmentInquiryDialog } from '@/components/used-equipment/used-equipment-inquiry-dialog';
import { SafeRichText } from '@/components/ui/safe-rich-text';
import { hasDatabaseUrl } from '@/lib/env/database';
import { buildAbsoluteUrl } from '@/lib/site-url';
import { getUsedEquipmentDescriptionExcerpt } from '@/lib/used-equipment/description';
import { getPublicUsedEquipmentBySlug } from '@/lib/used-equipment/queries';
import { getUsedEquipmentPublicStatusLabel } from '@/lib/used-equipment/status';
import { getEquipmentTypeLabel } from '@/lib/vehicles/equipment-types';

export const dynamic = 'force-dynamic';

type PageParams = {
  slug: string;
};

type PageProps = {
  params: Promise<PageParams>;
};

const statusTone: Record<UsedEquipmentStatus, string> = {
  DRAFT: 'border-public-border bg-public-elevated text-public-muted',
  PUBLISHED: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200',
  ARCHIVED: 'border-public-border bg-public-elevated text-public-muted'
};

async function getPublicItemFromParams(params: Promise<PageParams>) {
  const { slug } = await params;

  if (!hasDatabaseUrl() || !slug?.trim()) {
    return null;
  }

  return getPublicUsedEquipmentBySlug(slug);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const item = await getPublicItemFromParams(params);

  if (!item) {
    return {
      title: 'БВ техніка | Kairos Parts'
    };
  }

  const description = getUsedEquipmentDescriptionExcerpt(item.description, 170);
  const url = buildAbsoluteUrl(`/used-equipment/${item.slug}`);
  const primaryImage = item.images.find((image) => image.isPrimary) ?? item.images[0];

  return {
    title: `${item.title} | БВ техніка | Kairos Parts`,
    description,
    alternates: {
      canonical: url
    },
    openGraph: {
      title: `${item.title} | БВ техніка | Kairos Parts`,
      description,
      url,
      type: 'article',
      images: primaryImage
        ? [
            {
              url: primaryImage.url,
              width: primaryImage.width ?? 1200,
              height: primaryImage.height ?? 630,
              alt: primaryImage.alt ?? `${item.title} - БВ техніка`
            }
          ]
        : undefined
    }
  };
}

function InfoTile({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-public-border bg-primary/25 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent" aria-hidden="true">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-public-subtle">{label}</p>
          <p className="mt-1 break-words text-sm font-bold text-public-primary">{value}</p>
        </div>
      </div>
    </div>
  );
}

function ErrorState() {
  return (
    <section className="bg-public-page py-16">
      <div className="kp-container">
        <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-8 text-red-800">
          <h1 className="text-2xl font-bold">Сторінка тимчасово недоступна</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6">
            Не вдалося підключитися до бази даних. Спробуйте відкрити сторінку пізніше або поверніться до каталогу.
          </p>
          <Link
            href="/used-equipment"
            className="mt-5 inline-flex rounded-md border border-red-200 px-4 py-2 text-sm font-bold transition hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
          >
            Повернутися до БВ техніки
          </Link>
        </div>
      </div>
    </section>
  );
}

export default async function UsedEquipmentDetailPage({ params }: PageProps) {
  if (!hasDatabaseUrl()) {
    return <ErrorState />;
  }

  const { slug } = await params;

  if (!slug?.trim()) {
    notFound();
  }

  const item = await getPublicUsedEquipmentBySlug(slug);

  if (!item) {
    notFound();
  }

  const statusLabel = getUsedEquipmentPublicStatusLabel(item.status);
  const equipmentTypeLabel = getEquipmentTypeLabel(item.equipmentType);
  const statusClassName = statusTone[item.status];

  return (
    <div className="relative overflow-hidden bg-public-page py-8 sm:py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_8%,rgba(200,150,66,0.09),transparent_32%)]" />
      <div className="kp-container">
        <nav aria-label="Хлібні крихти" className="mb-6 flex flex-wrap items-center gap-2 text-sm text-public-muted">
          <Link
            href="/"
            className="font-semibold transition hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Головна
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            href="/used-equipment"
            className="font-semibold transition hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            БВ техніка
          </Link>
          <span aria-hidden="true">/</span>
          <span className="line-clamp-1 text-public-subtle">{item.title}</span>
        </nav>

        <article className="relative grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] lg:items-start">
          <PublicUsedEquipmentGallery title={item.title} images={item.images} />

          <aside className="rounded-lg border border-accent/25 bg-public-card p-5 shadow-[0_20px_50px_rgba(0,0,0,0.3)] sm:p-6">
            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClassName}`}>{statusLabel}</span>
            <h1 className="mt-4 break-words text-3xl font-bold leading-tight text-public-primary sm:text-4xl">{item.title}</h1>
            <p className="mt-4 text-sm leading-6 text-public-muted">
              Перевірена техніка для аграрних, транспортних і спеціальних робіт. Уточніть деталі та домовтеся про перегляд із менеджером Kairos Parts.
            </p>

            <div className="mt-6 grid gap-3">
              <InfoTile icon={FaIndustry} label="Виробник" value={item.manufacturerName} />
              <InfoTile icon={FaTractor} label="Тип техніки" value={equipmentTypeLabel} />
              <InfoTile icon={FaCalendarAlt} label="Рік" value={item.year ? String(item.year) : 'уточнюється'} />
            </div>

            <div className="mt-6 rounded-lg border border-accent/30 bg-primary/35 p-4">
              <div className="mb-4 h-px w-16 bg-accent" />
              <p className="text-lg font-bold text-public-primary">Зацікавила ця техніка?</p>
              <p className="mt-2 text-sm leading-6 text-public-muted">
                Залиште ім’я та номер телефону — менеджер Kairos Parts зв’яжеться з вами, щоб уточнити деталі перегляду.
              </p>
              <UsedEquipmentInquiryDialog
                usedEquipmentId={item.id}
                equipmentTitle={item.title}
                source="DETAIL_PAGE"
                trigger="Запит на перегляд техніки"
                triggerClassName="mt-4 inline-flex h-11 w-full items-center justify-center rounded-md bg-accent px-5 text-sm font-bold text-foreground transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            </div>
          </aside>
        </article>

        <section className="relative mt-8 rounded-lg border border-accent/25 bg-public-card p-5 shadow-[0_18px_44px_rgba(0,0,0,0.28)] sm:p-6">
          <h2 className="text-2xl font-bold text-public-primary">Опис техніки</h2>
          <SafeRichText
            html={item.description}
            className="mt-5 text-base leading-7 text-public-muted [&_h2]:text-public-primary [&_h3]:text-public-primary [&_p]:break-words [&_a]:break-all [&_a]:text-accent [&_blockquote]:rounded-r-md [&_blockquote]:bg-primary/30 [&_blockquote]:py-2 [&_li]:marker:text-accent"
          />
        </section>

        <div className="mt-8">
          <Link
            href="/used-equipment"
            className="inline-flex rounded-md border border-accent/45 bg-primary/30 px-5 py-3 text-sm font-bold text-accent transition hover:border-accent hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Повернутися до БВ техніки
          </Link>
        </div>
      </div>
    </div>
  );
}
