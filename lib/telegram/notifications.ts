import { prisma } from '@/lib/prisma';
import { formatInvoiceMoney, generateInvoicePdfBuffer, resolveInvoiceTotalAmount } from '@/lib/invoices/pdf';
import { sendTelegramDocument, sendTelegramMessage, TelegramApiError } from '@/lib/telegram/bot';

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

function getClientBaseUrl() {
  const baseUrl = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || 'https://kairos-parts.vercel.app';

  return baseUrl.replace(/\/$/, '');
}

function buildClientDirectUrl(path: string) {
  return `${getClientBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

export function buildRequestItemsApprovalUrl(requestId: string) {
  return buildClientDirectUrl(`/client/requests/${requestId}`);
}

export function buildRequestItemsApprovalMessage(requestNumber: string) {
  return [
    `По вашій заявці ${requestNumber} менеджер підібрав позиції.`,
    '',
    'Перейдіть в особистий кабінет, щоб переглянути варіанти, обрати потрібні позиції та погодити їх для рахунку.'
  ].join('\n');
}

export function buildInvoicePrintUrl(invoiceId: string) {
  return buildClientDirectUrl(`/client/invoices/${invoiceId}/print`);
}

export function buildInvoiceRequestUrl(requestId: string) {
  return buildClientDirectUrl(`/client/requests/${requestId}`);
}

function safeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message.slice(0, 500);
  }

  return 'Unknown error';
}

function safeTelegramErrorDetails(error: unknown) {
  if (error instanceof TelegramApiError) {
    return {
      telegramErrorCode: error.errorCode ?? null,
      telegramErrorDescription: error.description?.slice(0, 500) ?? null,
      telegramHttpStatus: error.status,
      telegramResponsePreview: error.responsePreview?.slice(0, 300) ?? null
    };
  }

  return {
    telegramErrorCode: null,
    telegramErrorDescription: null,
    telegramHttpStatus: null,
    telegramResponsePreview: null
  };
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
    `Сума до оплати: ${formatInvoiceMoney(totalAmount, currency)}.`,
    '',
    'Переглянути рахунок можна в особистому кабінеті Kairos Parts.'
  ].join('\n');
}

function buildInvoicePdfCaption({
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
    `Рахунок ${invoiceNumber} по заявці ${requestNumber}`,
    `Сума до оплати: ${formatInvoiceMoney(totalAmount, currency)}`
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
  } catch (error) {
    const errorMessage = safeErrorMessage(error);
    console.warn('Telegram request items approval notification failed', {
      requestId: request.id,
      requestNumber: request.requestNumber,
      chatIdExists: true,
      error: errorMessage
    });
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: 'FAILED',
        message: `${message}\n\nTelegram delivery failed: ${errorMessage}`
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
      items: {
        select: {
          quantity: true,
          price: true,
          total: true
        }
      },
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

  const totalAmount = resolveInvoiceTotalAmount({
    totalAmount: invoice.totalAmount,
    items: invoice.items
  });
  const message = buildInvoiceSentMessage({
    requestNumber: invoice.request.requestNumber,
    invoiceNumber: invoice.invoiceNumber,
    totalAmount,
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
  } catch (error) {
    const errorMessage = safeErrorMessage(error);
    console.warn('Telegram invoice text notification failed', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      requestId: invoice.request.id,
      chatIdExists: true,
      error: errorMessage
    });
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: 'FAILED',
        message: `${message}\n\nTelegram delivery failed: ${errorMessage}`
      }
    });

    return { status: 'failed', notificationId: notification.id };
  }

  const pdfCaption = buildInvoicePdfCaption({
    requestNumber: invoice.request.requestNumber,
    invoiceNumber: invoice.invoiceNumber,
    totalAmount,
    currency: invoice.currency
  });
  const pdfNotification = await prisma.notification.create({
    data: {
      requestId: invoice.request.id,
      userId: recipient.userId,
      channel: 'TELEGRAM',
      status: 'PENDING',
      message: `${pdfCaption}\n\nPDF document pending.`
    }
  });

  let pdfGenerated = false;
  let pdfBufferSize: number | null = null;
  let pdfFilename: string | null = null;
  let sendDocumentAttempted = false;

  try {
    const pdf = await generateInvoicePdfBuffer(invoice.id);
    pdfGenerated = true;
    pdfBufferSize = pdf.buffer.length;
    pdfFilename = pdf.filename;

    if (pdf.buffer.length === 0) {
      throw new Error('invoice_pdf_empty_buffer');
    }

    console.info('Telegram invoice PDF generated', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      requestId: invoice.request.id,
      chatIdExists: true,
      pdfGenerated: true,
      pdfBufferSize,
      pdfFilename
    });
    console.info('Telegram invoice PDF sendDocument attempt', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      requestId: invoice.request.id,
      chatIdExists: true,
      pdfGenerated: true,
      pdfBufferSize,
      pdfFilename,
      sendDocumentAttempted: true
    });
    sendDocumentAttempted = true;
    const documentResult = await sendTelegramDocument({
      chatId: recipient.chatId,
      buffer: pdf.buffer,
      filename: pdf.filename,
      caption: pdfCaption
    });
    console.info('Telegram invoice PDF sendDocument success', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      requestId: invoice.request.id,
      chatIdExists: true,
      sendDocumentAttempted: true,
      sendDocumentOk: true,
      telegramFileIdExists: Boolean(documentResult.file_id),
      telegramFileSize: documentResult.file_size ?? null
    });
    await prisma.notification.update({
      where: { id: pdfNotification.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        message: [
          pdfCaption,
          '',
          'PDF document sent.',
          `event=INVOICE_PDF_SENT`,
          `invoiceId=${invoice.id}`,
          `invoiceNumber=${invoice.invoiceNumber}`,
          `requestId=${invoice.request.id}`,
          `chatIdExists=true`,
          `pdfGenerated=true`,
          `pdfBufferSize=${pdfBufferSize}`,
          `pdfFilename=${pdfFilename}`,
          `sendDocumentAttempted=true`,
          `sendDocumentOk=true`,
          `documentSent=true`,
          `telegramFileIdExists=${Boolean(documentResult.file_id)}`,
          `telegramFileSize=${documentResult.file_size ?? ''}`
        ].join('\n')
      }
    });
  } catch (error) {
    const errorMessage = safeErrorMessage(error);
    const telegramError = safeTelegramErrorDetails(error);
    console.warn('Telegram invoice PDF delivery failed', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      requestId: invoice.request.id,
      chatIdExists: true,
      pdfGenerated,
      pdfBufferSize,
      pdfFilename,
      sendDocumentAttempted,
      ...telegramError,
      error: errorMessage
    });
    await prisma.notification.update({
      where: { id: pdfNotification.id },
      data: {
        status: 'FAILED',
        message: [
          pdfCaption,
          '',
          'PDF document delivery failed.',
          `event=INVOICE_PDF_FAILED`,
          `invoiceId=${invoice.id}`,
          `invoiceNumber=${invoice.invoiceNumber}`,
          `requestId=${invoice.request.id}`,
          `chatIdExists=true`,
          `pdfGenerated=${pdfGenerated}`,
          `pdfBufferSize=${pdfBufferSize ?? ''}`,
          `pdfFilename=${pdfFilename ?? ''}`,
          `sendDocumentAttempted=${sendDocumentAttempted}`,
          `telegramErrorCode=${telegramError.telegramErrorCode ?? ''}`,
          `telegramHttpStatus=${telegramError.telegramHttpStatus ?? ''}`,
          `telegramErrorDescription=${telegramError.telegramErrorDescription ?? ''}`,
          `telegramResponsePreview=${telegramError.telegramResponsePreview ?? ''}`,
          `error=${errorMessage}`
        ].join('\n')
      }
    });
  }

  return { status: 'sent', notificationId: notification.id };
}
