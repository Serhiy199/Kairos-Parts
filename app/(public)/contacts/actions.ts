'use server';

import { hasDatabaseUrl } from '@/lib/env/database';
import {
  type ContactMessageFieldErrors,
  parseContactMessageFormData
} from '@/lib/contact-messages';
import { prisma } from '@/lib/prisma';

export type ContactFormActionState = {
  status: 'idle' | 'success' | 'error';
  message: string;
  fieldErrors: ContactMessageFieldErrors;
  values: ContactFormValues;
  submissionId: number;
};

export type ContactFormValues = {
  name: string;
  company: string;
  phone: string;
  email: string;
  topic: string;
  message: string;
  consent: boolean;
};

const GENERIC_ERROR_MESSAGE = 'Не вдалося надіслати повідомлення. Перевірте дані та спробуйте ще раз.';
const SUCCESS_MESSAGE = 'Дякуємо. Ваше повідомлення надіслано. Менеджер зв’яжеться з вами після опрацювання звернення.';

const EMPTY_VALUES: ContactFormValues = {
  name: '',
  company: '',
  phone: '',
  email: '',
  topic: '',
  message: '',
  consent: false
};

function readValue(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function readSubmittedValues(formData: FormData): ContactFormValues {
  return {
    name: readValue(formData, 'name', 100),
    company: readValue(formData, 'company', 150),
    phone: readValue(formData, 'phone', 50),
    email: readValue(formData, 'email', 254),
    topic: readValue(formData, 'topic', 40),
    message: readValue(formData, 'message', 5000),
    consent: formData.get('consent') === 'on' || formData.get('consent') === 'true'
  };
}

export async function submitContactMessage(
  previousState: ContactFormActionState,
  formData: FormData
): Promise<ContactFormActionState> {
  const submissionId = previousState.submissionId + 1;
  const values = readSubmittedValues(formData);
  const parsed = parseContactMessageFormData(formData);

  if (!parsed.ok) {
    return {
      status: 'error',
      message: parsed.isHoneypot ? GENERIC_ERROR_MESSAGE : 'Перевірте виділені поля.',
      fieldErrors: parsed.errors,
      values,
      submissionId
    };
  }

  if (!hasDatabaseUrl()) {
    return { status: 'error', message: GENERIC_ERROR_MESSAGE, fieldErrors: {}, values, submissionId };
  }

  try {
    await prisma.contactMessage.create({
      data: parsed.data
    });

    return {
      status: 'success',
      message: SUCCESS_MESSAGE,
      fieldErrors: {},
      values: EMPTY_VALUES,
      submissionId
    };
  } catch (error) {
    console.error('Contact message creation failed.', {
      errorType: error instanceof Error ? error.name : 'UnknownError'
    });

    return { status: 'error', message: GENERIC_ERROR_MESSAGE, fieldErrors: {}, values, submissionId };
  }
}
