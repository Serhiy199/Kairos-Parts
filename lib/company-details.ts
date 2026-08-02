import { siteContacts } from '@/lib/site-contacts';

export const companyLegalDetails = {
  shortName: 'ТОВ «КАЙРОС ПАРТС»',
  fullName: 'ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ «КАЙРОС ПАРТС»',
  edrpou: '46387973',
  legalAddress: {
    display:
      '09201, Україна, Київська область, Обухівський район, м. Кагарлик, вул. Сергієнка, буд. 20'
  },
  legalPhone: {
    display: '+38 (067) 668-08-08',
    href: 'tel:+380676680808'
  },
  email: siteContacts.email,
  personalDataController: 'ТОВ «КАЙРОС ПАРТС»'
} as const;
