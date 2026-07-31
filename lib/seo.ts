import type { Metadata } from 'next';

import { buildPublicUrl } from '@/lib/site-url';

export const SITE_NAME = 'Kairos Parts';
export const SITE_LOCALE = 'uk_UA';

export const PUBLIC_PAGE_SEO = {
  home: {
    path: '/',
    title: 'Підбір запчастин для техніки — Kairos Parts',
    description:
      'Kairos Parts допомагає бізнесу підібрати та замовити запчастини для аграрної, вантажної й спеціальної техніки.'
  },
  about: {
    path: '/about',
    title: 'Про Kairos Parts — підбір запчастин для бізнесу',
    description:
      'Дізнайтеся, як Kairos Parts організовує підбір, постачання та цифрову історію запчастин для техніки підприємств.'
  },
  howItWorks: {
    path: '/how-it-works',
    title: 'Як працює підбір запчастин — Kairos Parts',
    description:
      'Сім зрозумілих кроків від створення заявки до погодження, доставки та збереження історії обслуговування техніки.'
  },
  contacts: {
    path: '/contacts',
    title: 'Контакти Kairos Parts — зв’язок із командою',
    description:
      'Зв’яжіться з Kairos Parts щодо підбору запчастин, комерційної пропозиції, співпраці або статусу заявки.'
  },
  categories: {
    path: '/categories',
    title: 'Категорії запчастин і техніки — Kairos Parts',
    description:
      'Оберіть напрям підбору запчастин для аграрної, вантажної, комерційної та спеціальної техніки.'
  },
  usedEquipment: {
    path: '/used-equipment',
    title: 'БВ техніка — Kairos Parts',
    description:
      'Публічний каталог перевіреної вживаної аграрної, вантажної та спеціальної техніки Kairos Parts.'
  }
} as const;

type PublicMetadataInput = {
  path: string;
  title: string;
  description: string;
};

export function createPublicMetadata({ path, title, description }: PublicMetadataInput): Metadata {
  const canonicalUrl = buildPublicUrl(path);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl
    },
    openGraph: {
      type: 'website',
      locale: SITE_LOCALE,
      url: canonicalUrl,
      siteName: SITE_NAME,
      title,
      description
    },
    twitter: {
      card: 'summary',
      title,
      description
    },
    robots: {
      index: true,
      follow: true
    }
  };
}

export const NOINDEX_METADATA: Metadata = {
  robots: {
    index: false,
    follow: false
  }
};
