import type { DocumentSource } from '@prisma/client';

const CLIENT_SOURCE_LABELS: Record<DocumentSource, string> = {
  CLIENT: 'Додано вами',
  MANAGER: 'Додано менеджером',
  ADMIN: 'Додано адміністратором',
  LEGACY: 'Документ техніки',
  SYSTEM: 'Системний документ'
};

const CRM_SOURCE_LABELS: Record<DocumentSource, string> = {
  CLIENT: 'Клієнт',
  MANAGER: 'Менеджер',
  ADMIN: 'Адміністратор',
  LEGACY: 'Історичний документ',
  SYSTEM: 'Система'
};

export function vehicleDocumentSourceLabel(source: DocumentSource, viewer: 'CLIENT' | 'CRM') {
  return viewer === 'CLIENT' ? CLIENT_SOURCE_LABELS[source] : CRM_SOURCE_LABELS[source];
}
