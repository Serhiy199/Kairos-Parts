export const CONTACT_MESSAGE_TOPICS = [
  'PARTS_REQUEST',
  'COMMERCIAL_OFFER',
  'REQUEST_QUESTION',
  'PARTNERSHIP',
  'OTHER'
] as const;

export const CONTACT_MESSAGE_TOPIC_LABELS: Record<ContactMessageTopicValue, string> = {
  PARTS_REQUEST: 'Підбір запчастин',
  COMMERCIAL_OFFER: 'Комерційна пропозиція',
  REQUEST_QUESTION: 'Питання щодо заявки',
  PARTNERSHIP: 'Співпраця',
  OTHER: 'Інше'
};

export const CONTACT_MESSAGE_STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'SPAM'] as const;

export const CONTACT_MESSAGE_STATUS_LABELS: Record<ContactMessageStatusValue, string> = {
  NEW: 'Нове',
  IN_PROGRESS: 'В роботі',
  RESOLVED: 'Опрацьовано',
  SPAM: 'Спам'
};

export const CONTACT_MESSAGE_STATUS_CLASSES: Record<ContactMessageStatusValue, string> = {
  NEW: 'bg-[#FFF3D6] text-[#8A5A00]',
  IN_PROGRESS: 'bg-[#E8F0FF] text-[#2959A8]',
  RESOLVED: 'bg-[#E7F6EC] text-success',
  SPAM: 'bg-surface-muted text-muted'
};

export type ContactMessageTopicValue = (typeof CONTACT_MESSAGE_TOPICS)[number];
export type ContactMessageStatusValue = (typeof CONTACT_MESSAGE_STATUSES)[number];
export type ContactMessageField = 'name' | 'company' | 'phone' | 'email' | 'topic' | 'message' | 'consent';
export type ContactMessageFieldErrors = Partial<Record<ContactMessageField, string>>;

export type ContactMessageInput = {
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  topic: ContactMessageTopicValue;
  message: string;
};

export type ContactMessageParseResult =
  | { ok: true; data: ContactMessageInput; isHoneypot: false }
  | { ok: false; errors: ContactMessageFieldErrors; isHoneypot: false }
  | { ok: false; errors: ContactMessageFieldErrors; isHoneypot: true };

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export function parseContactMessageFormData(formData: FormData): ContactMessageParseResult {
  const website = readString(formData, 'website');

  if (website) {
    return { ok: false, errors: {}, isHoneypot: true };
  }

  const name = readString(formData, 'name');
  const company = readString(formData, 'company');
  const phone = readString(formData, 'phone');
  const email = readString(formData, 'email').toLowerCase();
  const topic = readString(formData, 'topic');
  const message = readString(formData, 'message');
  const consent = formData.get('consent') === 'on' || formData.get('consent') === 'true';
  const errors: ContactMessageFieldErrors = {};

  if (name.length < 2) errors.name = 'Ім’я має містити щонайменше 2 символи.';
  if (name.length > 100) errors.name = 'Ім’я не може перевищувати 100 символів.';
  if (company.length > 150) errors.company = 'Назва компанії не може перевищувати 150 символів.';
  if (phone.length > 50) errors.phone = 'Телефон не може перевищувати 50 символів.';

  if (!phone && !email) {
    errors.phone = 'Вкажіть телефон або email.';
    errors.email = 'Вкажіть email або телефон.';
  }

  if (email.length > 254) {
    errors.email = 'Email не може перевищувати 254 символи.';
  } else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Вкажіть коректну email-адресу.';
  }

  if (!CONTACT_MESSAGE_TOPICS.includes(topic as ContactMessageTopicValue)) {
    errors.topic = 'Оберіть тему звернення.';
  }

  if (message.length < 10) errors.message = 'Повідомлення має містити щонайменше 10 символів.';
  if (message.length > 5000) errors.message = 'Повідомлення не може перевищувати 5000 символів.';
  if (!consent) errors.consent = 'Потрібна згода на обробку персональних даних.';

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, isHoneypot: false };
  }

  return {
    ok: true,
    isHoneypot: false,
    data: {
      name,
      company: company || null,
      phone: phone || null,
      email: email || null,
      topic: topic as ContactMessageTopicValue,
      message
    }
  };
}

export function getTelephoneHref(phone: string) {
  const normalized = phone.replace(/(?!^\+)\D/g, '');
  const digitCount = normalized.replace(/\D/g, '').length;
  return digitCount >= 7 ? `tel:${normalized}` : null;
}
