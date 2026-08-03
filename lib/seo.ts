import type { Metadata } from 'next';

import { buildPublicUrl } from '@/lib/site-url';

export const SITE_NAME = 'Kairos Parts';
export const SITE_LOCALE = 'uk_UA';

export const PUBLIC_PAGE_SEO = {
  home: {
    path: '/',
    title: 'Підбір запчастин у Кагарлику | Kairos Parts',
    description:
      'Підбір оригінальних запчастин і перевірених аналогів для сільськогосподарської, вантажної та спеціальної техніки в Кагарлику й Кагарлицькій територіальній громаді.'
  },
  about: {
    path: '/about',
    title: 'Про Kairos Parts — підбір запчастин для бізнесу',
    description:
      'Дізнайтеся, як Kairos Parts організовує підбір, постачання та цифрову історію запчастин для техніки підприємств.'
  },
  howItWorks: {
    path: '/how-it-works',
    title: 'Як відбувається підбір запчастин онлайн | Kairos Parts',
    description:
      'Дізнайтеся, як Kairos Parts підбирає запчастини за моделлю техніки, VIN, серійним або каталожним номером, фото чи списком позицій та погоджує оригінали й аналоги.'
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
  termsOfUse: {
    path: '/terms-of-use',
    title: 'Умови користування | Kairos Parts',
    description:
      'Правила користування сайтом Kairos Parts, особистим кабінетом, заявками, документами та іншими функціями сервісу.'
  },
  logistics: {
    path: '/logistics',
    title: 'Логістика для агропідприємств у Кагарлику | Kairos Logistics',
    description:
      'Забір товарів і запчастин у постачальників у межах Київської області та доставка до бази Kairos Parts у Кагарлику або господарств Кагарлицької територіальної громади.'
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
