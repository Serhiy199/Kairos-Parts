import { formatPhoneForDisplay } from '@/lib/phone/normalize';
import { buildAbsoluteUrl } from '@/lib/site-url';
import { getUsedEquipmentInquirySourceLabel } from '@/lib/used-equipment/status';

export type UsedEquipmentInquiryManagerNotificationContent = {
  equipmentTitle: string;
  customerName: string;
  phone: string;
  source: string;
};

export function escapeTelegramHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildUsedEquipmentInquiryManagerUrl(inquiryId: string) {
  return buildAbsoluteUrl(`/admin/used-equipment/inquiries/${inquiryId}`);
}

export function buildUsedEquipmentInquiryManagerMessage({
  equipmentTitle,
  customerName,
  phone,
  source
}: UsedEquipmentInquiryManagerNotificationContent) {
  const phoneLabel = formatPhoneForDisplay(phone) || phone;

  return [
    '<b>Нова заявка на перегляд БВ техніки</b>',
    '',
    `<b>Техніка:</b> ${escapeTelegramHtml(equipmentTitle)}`,
    `<b>Клієнт:</b> ${escapeTelegramHtml(customerName)}`,
    `<b>Телефон:</b> ${escapeTelegramHtml(phoneLabel)}`,
    `<b>Джерело:</b> ${escapeTelegramHtml(getUsedEquipmentInquirySourceLabel(source))}`,
    '',
    'Перейдіть у CRM, щоб взяти заявку в роботу.'
  ].join('\n');
}
