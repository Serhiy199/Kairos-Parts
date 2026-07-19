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
import { getEquipmentTypeLabel } from '@/lib/vehicles/equipment-types';

export const dynamic = 'force-dynamic';

type PageParams = {
  slug: string;
};

type PageProps = {
  params: Promise<PageParams>;
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

function InfoRow({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-public-border py-4 last:border-b-0">
      <span className="inline-flex size-9 shrink-0 items-center justify-center text-accent" aria-hidden="true">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase text-public-subtle">{label}</p>
        <p className="mt-1 break-words text-sm font-bold text-public-primary">{value}</p>
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

  const equipmentTypeLabel = getEquipmentTypeLabel(item.equipmentType);

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

        <article className="relative overflow-hidden rounded-lg border border-accent/25 bg-public-card shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
          <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:gap-8">
            <PublicUsedEquipmentGallery title={item.title} images={item.images} />

            <div className="flex min-w-0 flex-col">
              <h1 className="break-words text-3xl font-bold leading-tight text-public-primary sm:text-4xl">{item.title}</h1>

              <div className="mt-5 border-y border-public-border">
                <InfoRow icon={FaIndustry} label="Виробник" value={item.manufacturerName} />
                <InfoRow icon={FaTractor} label="Тип техніки" value={equipmentTypeLabel} />
                {item.year ? <InfoRow icon={FaCalendarAlt} label="Рік" value={String(item.year)} /> : null}
              </div>

              <UsedEquipmentInquiryDialog
                usedEquipmentId={item.id}
                equipmentTitle={item.title}
                source="DETAIL_PAGE"
                trigger="Запит на перегляд техніки"
                triggerClassName="mt-6 inline-flex h-12 w-full items-center justify-center rounded-md bg-accent px-5 text-sm font-bold text-foreground transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:mt-auto"
              />
            </div>
          </div>

          <section className="border-t border-public-border p-4 sm:p-6">
            <h2 className="text-2xl font-bold text-public-primary">Опис техніки</h2>
            <SafeRichText
              html={item.description}
              className="mt-5 text-base leading-7 text-public-muted [&_h2]:text-public-primary [&_h3]:text-public-primary [&_p]:break-words [&_a]:break-all [&_a]:text-accent [&_blockquote]:rounded-r-md [&_blockquote]:bg-primary/30 [&_blockquote]:py-2 [&_li]:marker:text-accent [&_td]:border-public-border [&_th]:border-public-border [&_th]:bg-primary/40 [&_th]:text-public-primary"
            />
          </section>
        </article>

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
