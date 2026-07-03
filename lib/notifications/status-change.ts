import type { RequestStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { REQUEST_STATUS_LABELS } from '@/lib/requests/statuses';
import { sendTelegramMessage } from '@/lib/telegram/bot';

type RequestForNotification = {
  id: string;
  requestNumber: string;
  publicStatusToken: string;
  source: 'WEBSITE' | 'CLIENT_DASHBOARD' | 'TELEGRAM' | 'MANAGER';
  status: RequestStatus;
  guestEmail: string | null;
  guestPhone: string | null;
  client: {
    id: string;
    email: string | null;
    phone: string | null;
    userId: string;
    user: {
      id: string;
      email: string | null;
      phone: string | null;
    };
  } | null;
  comments: Array<{ message: string }>;
};

function buildStatusUrl(publicStatusToken: string) {
  const baseUrl = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || '';
  const path = `/request/status/${publicStatusToken}`;

  return baseUrl ? `${baseUrl.replace(/\/$/, '')}${path}` : path;
}

function extractTelegramChatId(request: RequestForNotification) {
  for (const comment of request.comments) {
    const match = comment.message.match(/^chatId:\s*(.+)$/m);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function buildStatusMessage(request: RequestForNotification, nextStatus: RequestStatus) {
  return [
    'Статус вашої заявки оновлено.',
    '',
    `Заявка: ${request.requestNumber}`,
    `Новий статус: ${REQUEST_STATUS_LABELS[nextStatus]}`,
    'Переглянути статус:',
    buildStatusUrl(request.publicStatusToken)
  ].join('\n');
}

export async function notifyRequestStatusChange(requestId: string, nextStatus: RequestStatus) {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      client: { include: { user: true } },
      comments: {
        where: { internal: true },
        orderBy: { createdAt: 'desc' },
        take: 10
      }
    }
  });

  if (!request) {
    return;
  }

  const message = buildStatusMessage(request, nextStatus);
  const chatId = request.source === 'TELEGRAM' ? extractTelegramChatId(request) : null;

  if (chatId) {
    const notification = await prisma.notification.create({
      data: {
        requestId: request.id,
        userId: request.client?.userId,
        channel: 'TELEGRAM',
        status: 'PENDING',
        message
      }
    });

    try {
      await sendTelegramMessage(chatId, message);
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'SENT', sentAt: new Date() }
      });
      return;
    } catch (error) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'FAILED',
          message: `${message}\n\nDelivery error: ${error instanceof Error ? error.message : 'Unknown Telegram error'}`
        }
      });
      return;
    }
  }

  const email = request.client?.email ?? request.client?.user.email ?? request.guestEmail;

  if (email) {
    await prisma.notification.create({
      data: {
        requestId: request.id,
        userId: request.client?.userId,
        channel: 'EMAIL',
        status: 'PENDING',
        message: `${message}\n\nEmail delivery placeholder for: ${email}`
      }
    });
    return;
  }

  await prisma.notification.create({
    data: {
      requestId: request.id,
      userId: request.client?.userId,
      channel: request.source === 'TELEGRAM' ? 'TELEGRAM' : 'EMAIL',
      status: 'FAILED',
      message: `${message}\n\nNo available notification channel.`
    }
  });
}
