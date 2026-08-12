import { normalizeUkrainianPhone } from '@/lib/phone/normalize';

export type ClientProfilePresentation = {
  clientType: 'INDIVIDUAL' | 'BUSINESS';
  firstName: string;
  lastName: string;
  companyName: string;
  taxId: string;
  contactName: string;
  email: string;
  phone: string;
  companyFieldsEditable: boolean;
  createdAtLabel: string;
};

export type ClientProfileEditableValues = Pick<
  ClientProfilePresentation,
  'firstName' | 'lastName' | 'companyName' | 'taxId' | 'contactName' | 'email' | 'phone'
>;

export function editableClientProfileValues(
  profile: ClientProfilePresentation
): ClientProfileEditableValues {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    companyName: profile.companyName,
    taxId: profile.taxId,
    contactName: profile.contactName,
    email: profile.email,
    phone: profile.phone
  };
}

export function clientProfileReadOnlyRows(profile: ClientProfilePresentation) {
  const commonRows = [
    { label: 'Email', value: profile.email || '—' },
    { label: 'Телефон', value: profile.phone || '—' }
  ];

  if (profile.clientType === 'INDIVIDUAL') {
    return [
      { label: 'Тип клієнта', value: 'Фіз особа' },
      { label: 'Імʼя', value: profile.firstName || '—' },
      { label: 'Прізвище', value: profile.lastName || '—' },
      ...commonRows,
      { label: 'Дата створення профілю', value: profile.createdAtLabel }
    ];
  }

  return [
    { label: 'Тип клієнта', value: 'ФОП / Юр особа' },
    { label: 'Назва компанії', value: profile.companyName || '—' },
    { label: 'ЄДРПОУ / ІПН', value: profile.taxId || '—' },
    { label: 'Контактна особа', value: profile.contactName || '—' },
    ...commonRows,
    { label: 'Дата створення профілю', value: profile.createdAtLabel }
  ];
}

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizedPhoneForComparison(value: string) {
  return normalizeUkrainianPhone(value) ?? value.trim();
}

export function clientProfileIdentityChanged(
  initial: Pick<ClientProfileEditableValues, 'email' | 'phone'>,
  current: Pick<ClientProfileEditableValues, 'email' | 'phone'>
) {
  return normalizedEmail(initial.email) !== normalizedEmail(current.email)
    || normalizedPhoneForComparison(initial.phone) !== normalizedPhoneForComparison(current.phone);
}
