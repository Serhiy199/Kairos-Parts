import { prisma } from '@/lib/prisma';
import { sendTelegramMessage } from '@/lib/telegram/bot';

type TelegramRecipient = {
  chatId: string;
  userId: string;
};

type RequestItemsApprovalNotificationResult =
  | { status: 'sent'; notificationId: string }
  | { status: 'failed'; notificationId: string }
  | { status: 'skipped-no-recipient' }
  | { status: 'skipped-request-not-found' };

type InvoiceSentNotificationResult =
  | { status: 'sent'; notificationId: string }
  | { status: 'failed'; notificationId: string }
  | { status: 'skipped-no-recipient' }
  | { status: 'skipped-invoice-not-found' };

function buildClientLoginUrl(nextPath: string) {
  const baseUrl = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || 'https://kairos-parts.vercel.app';

  return `${baseUrl.replace(/\/$/, '')}/login?next=${encodeURIComponent(nextPath)}`;
}

export function buildRequestItemsApprovalUrl(requestId: string) {
  return buildClientLoginUrl(`/client/requests/${requestId}`);
}

export function buildRequestItemsApprovalMessage(requestNumber: string) {
  return [
    `По вашій заявці ${requestNumber} менеджер підібрав позиції.`,
    '',
    'Перейдіть в особистий кабінет, щоб переглянути варіанти, обрати потрібні позиції та погодити їх для рахунку.'
  ].join('\n');
}

export function buildInvoicePrintUrl(invoiceId: string) {
  return buildClientLoginUrl(`/client/invoices/${invoiceId}/print`);
}

export function buildInvoiceRequestUrl(requestId: string) {
  return buildClientLoginUrl(`/client/requests/${requestId}`);
}

function formatInvoiceAmount(amount: { toString: () => string }, currency: string) {
  const numericAmount = Number(amount.toString());

  if (!Number.isFinite(numericAmount)) {
    return `${amount.toString()} ${currency}`;
  }

  return `${numericAmount.toLocaleString('uk-UA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} ${currency}`;
}

export function buildInvoiceSentMessage({
  requestNumber,
  invoiceNumber,
  totalAmount,
  currency
}: {
  requestNumber: string;
  invoiceNumber: string;
  totalAmount: { toString: () => string };
  currency: string;
}) {
  return [
    `По вашій заявці ${requestNumber} сформовано рахунок ${invoiceNumber}.`,
    '',
    `Сума до оплати: ${formatInvoiceAmount(totalAmount, currency)}.`,
    '',
    'Переглянути рахунок можна в особистому кабінеті Kairos Parts.'
  ].join('\n');
}

export function resolveRequestItemsApprovalRecipient(request: {
  client: { userId: string; telegramChatId: string | null } | null;
  company: {
    members: Array<{
      isPrimaryContact: boolean;
      user: {
        id: string;
        clientProfile: { telegramChatId: string | null } | null;
      };
    }>;
  } | null;
}): TelegramRecipient | null {
  const membersWithTelegram =
    request.company?.members.flatMap((member) => {
      const chatId = member.user.clientProfile?.telegramChatId;
      return chatId ? [{ chatId, userId: member.user.id, isPrimaryContact: member.isPrimaryContact }] : [];
    }) ?? [];
  const primaryContact = membersWithTelegram.find((member) => member.isPrimaryContact);

  if (primaryContact) {
    return { chatId: primaryContact.chatId, userId: primaryContact.userId };
  }

  if (request.client?.telegramChatId) {
    return { chatId: request.client.telegramChatId, userId: request.client.userId };
  }

  const fallbackMember = membersWithTelegram[0];
  return fallbackMember ? { chatId: fallbackMember.chatId, userId: fallbackMember.userId } : null;
}

export async function sendTelegramRequestItemsApprovalNotification({
  requestId
}: {
  requestId: string;
}): Promise<RequestItemsApprovalNotificationResult> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      requestNumber: true,
      client: {
        select: {
          userId: true,
          telegramChatId: true
        }
      },
      company: {
        select: {
          members: {
            orderBy: { createdAt: 'asc' },
            select: {
              isPrimaryContact: true,
              user: {
                select: {
                  id: true,
                  clientProfile: {
                    select: { telegramChatId: true }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!request) {
    return { status: 'skipped-request-not-found' };
  }

  const recipient = resolveRequestItemsApprovalRecipient(request);

  if (!recipient) {
    return { status: 'skipped-no-recipient' };
  }

  const message = buildRequestItemsApprovalMessage(request.requestNumber);
  const requestUrl = buildRequestItemsApprovalUrl(request.id);
  const notification = await prisma.notification.create({
    data: {
      requestId: request.id,
      userId: recipient.userId,
      channel: 'TELEGRAM',
      status: 'PENDING',
      message
    }
  });

  try {
    await sendTelegramMessage(recipient.chatId, message, {
      replyMarkup: {
        inline_keyboard: [[{ text: 'Переглянути заявку', url: requestUrl }]]
      }
    });
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: 'SENT', sentAt: new Date() }
    });

    return { status: 'sent', notificationId: notification.id };
  } catch {
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: 'FAILED',
        message: `${message}\n\nTelegram delivery failed.`
      }
    });

    return { status: 'failed', notificationId: notification.id };
  }
}

export async function sendTelegramInvoiceSentNotification({
  invoiceId
}: {
  invoiceId: string;
}): Promise<InvoiceSentNotificationResult> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      invoiceNumber: true,
      currency: true,
      totalAmount: true,
      request: {
        select: {
          id: true,
          requestNumber: true,
          client: {
            select: {
              userId: true,
              telegramChatId: true
            }
          },
          company: {
            select: {
              members: {
                orderBy: { createdAt: 'asc' },
                select: {
                  isPrimaryContact: true,
                  user: {
                    select: {
                      id: true,
                      clientProfile: {
                        select: { telegramChatId: true }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!invoice) {
    return { status: 'skipped-invoice-not-found' };
  }

  const recipient = resolveRequestItemsApprovalRecipient(invoice.request);

  if (!recipient) {
    return { status: 'skipped-no-recipient' };
  }

  const message = buildInvoiceSentMessage({
    requestNumber: invoice.request.requestNumber,
    invoiceNumber: invoice.invoiceNumber,
    totalAmount: invoice.totalAmount,
    currency: invoice.currency
  });
  const notification = await prisma.notification.create({
    data: {
      requestId: invoice.request.id,
      userId: recipient.userId,
      channel: 'TELEGRAM',
      status: 'PENDING',
      message
    }
  });

  try {
    await sendTelegramMessage(recipient.chatId, message, {
      replyMarkup: {
        inline_keyboard: [
          [{ text: 'Переглянути рахунок', url: buildInvoicePrintUrl(invoice.id) }],
          [{ text: 'Відкрити заявку', url: buildInvoiceRequestUrl(invoice.request.id) }]
        ]
      }
    });
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: 'SENT', sentAt: new Date() }
    });

    return { status: 'sent', notificationId: notification.id };
  } catch {
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: 'FAILED',
        message: `${message}\n\nTelegram delivery failed.`
      }
    });

    return { status: 'failed', notificationId: notification.id };
  }
}
