'use server';

import { revalidatePath } from 'next/cache';

import { requireCrmSession } from '@/lib/admin/access';
import {
  CONTACT_MESSAGE_STATUSES,
  type ContactMessageStatusValue
} from '@/lib/contact-messages';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';

export type ContactMessageStatusActionState = {
  status: 'idle' | 'success' | 'error';
  message: string;
  submissionId: number;
};

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export async function updateContactMessageStatus(
  previousState: ContactMessageStatusActionState,
  formData: FormData
): Promise<ContactMessageStatusActionState> {
  await requireCrmSession();

  const submissionId = previousState.submissionId + 1;
  const contactMessageId = readString(formData, 'contactMessageId');
  const status = readString(formData, 'status');

  if (
    !hasDatabaseUrl() ||
    !contactMessageId ||
    !CONTACT_MESSAGE_STATUSES.includes(status as ContactMessageStatusValue)
  ) {
    return { status: 'error', message: 'Не вдалося змінити статус. Спробуйте ще раз.', submissionId };
  }

  try {
    await prisma.contactMessage.update({
      where: { id: contactMessageId },
      data: { status: status as ContactMessageStatusValue },
      select: { id: true }
    });

    revalidatePath('/admin/contact-messages');
    revalidatePath(`/admin/contact-messages/${contactMessageId}`);
    revalidatePath('/admin', 'layout');

    return { status: 'success', message: 'Статус звернення оновлено.', submissionId };
  } catch (error) {
    console.error('Contact message status update failed.', {
      errorType: error instanceof Error ? error.name : 'UnknownError'
    });

    return { status: 'error', message: 'Не вдалося змінити статус. Спробуйте ще раз.', submissionId };
  }
}
