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
      'Контактні канали, адреса та юридична інформація Kairos Parts для звернень щодо запчастин, документів і співпраці.'
  },
  privacyPolicy: {
    path: '/privacy-policy',
    title: 'Політика конфіденційності | Kairos Parts',
    description:
      'Інформація про те, які персональні дані обробляє Kairos Parts, для чого вони використовуються, як захищаються та як подати запит щодо своїх даних.'
  },
  logistics: {
    path: '/logistics',
    title: 'Kairos Logistics — доставка товарів для агропідприємств | Kairos Parts',
    description:
      'Забір товарів у постачальників у межах Київської області та доставка до бази Kairos Parts у Кагарлику або в господарства Кагарлицької громади.'
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
