export const REQUEST_SOURCES = ['WEBSITE', 'CLIENT_DASHBOARD', 'TELEGRAM', 'MANAGER'] as const;

export type RequestSource = (typeof REQUEST_SOURCES)[number];

export const REQUEST_SOURCE_LABELS: Record<RequestSource, string> = {
  WEBSITE: 'Публічний сайт',
  CLIENT_DASHBOARD: 'Кабінет клієнта',
  TELEGRAM: 'Telegram',
  MANAGER: 'Менеджер'
};
