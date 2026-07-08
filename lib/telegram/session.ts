import { saveRequestFileBufferLocal } from '@/lib/files/local-storage';
import { prisma } from '@/lib/prisma';
import { generatePublicStatusToken, generateRequestNumber } from '@/lib/requests/identifiers';

import { answerCallbackQuery, downloadTelegramFile, getTelegramFile, sendTelegramMessage } from './bot';
import {
  buildCreatedMessage,
  buildStartMessage,
  buildSummary,
  confirmationKeyboard,
  contactKeyboard,
  isSkipText,
  removeKeyboard,
  skipKeyboard,
  TELEGRAM_CALLBACKS
} from './messages';
import type { TelegramCallbackQuery, TelegramDraftFile, TelegramMessage, TelegramUpdate } from './types';

type TelegramDraft = NonNullable<Awaited<ReturnType<typeof getDraft>>>;

type TelegramDraftMetadata = {
  files: TelegramDraftFile[];
  partsText: string | null;
};

function toStringId(id: number | string) {
  return String(id);
}

function readDraftFilesFromValue(value: unknown): TelegramDraftFile[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is TelegramDraftFile => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const candidate = item as Partial<TelegramDraftFile>;
    return (
      (candidate.kind === 'photo' || candidate.kind === 'document') &&
      typeof candidate.fileId === 'string' &&
      typeof candidate.fileName === 'string' &&
      typeof candidate.mimeType === 'string'
    );
  });
}

function readDraftMetadata(value: unknown): TelegramDraftMetadata {
  if (Array.isArray(value)) {
    return {
      files: readDraftFilesFromValue(value),
      partsText: null
    };
  }

  if (!value || typeof value !== 'object') {
    return {
      files: [],
      partsText: null
    };
  }

  const candidate = value as { files?: unknown; partsText?: unknown };

  return {
    files: readDraftFilesFromValue(candidate.files),
    partsText: typeof candidate.partsText === 'string' && candidate.partsText.trim() ? candidate.partsText.trim() : null
  };
}

function readDraftFiles(value: unknown): TelegramDraftFile[] {
  return readDraftMetadata(value).files;
}

function readDraftPartsText(value: unknown) {
  return readDraftMetadata(value).partsText;
}

function buildDraftMetadata(input: { files: TelegramDraftFile[]; partsText?: string | null }) {
  return {
    files: input.files,
    partsText: input.partsText?.trim() || null
  };
}

function getMessageText(message: TelegramMessage) {
  return message.text?.trim() ?? '';
}

function buildStatusUrl(publicStatusToken: string) {
  const baseUrl = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || '';
  const path = `/request/status/${publicStatusToken}`;

  if (!baseUrl) {
    return path;
  }

  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

function getLargestPhoto(message: TelegramMessage): TelegramDraftFile | null {
  const photo = message.photo?.toSorted((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0))[0];

  if (!photo) {
    return null;
  }

  return {
    kind: 'photo',
    fileId: photo.file_id,
    fileUniqueId: photo.file_unique_id,
    fileName: `telegram-photo-${photo.file_unique_id || photo.file_id}.jpg`,
    mimeType: 'image/jpeg',
    size: photo.file_size
  };
}

function getDocument(message: TelegramMessage): TelegramDraftFile | null {
  if (!message.document) {
    return null;
  }

  return {
    kind: 'document',
    fileId: message.document.file_id,
    fileUniqueId: message.document.file_unique_id,
    fileName: message.document.file_name || `telegram-document-${message.document.file_id}`,
    mimeType: message.document.mime_type || 'application/octet-stream',
    size: message.document.file_size
  };
}

async function getDraft(telegramUserId: string) {
  return prisma.telegramDraftRequest.findUnique({
    where: { telegramUserId }
  });
}

async function resetDraft(input: { telegramUserId: string; chatId: string }) {
  return prisma.telegramDraftRequest.upsert({
    where: { telegramUserId: input.telegramUserId },
    create: {
      telegramUserId: input.telegramUserId,
      chatId: input.chatId,
      step: 'AWAITING_CONTACT',
      fileMetadata: buildDraftMetadata({ files: [] })
    },
    update: {
      chatId: input.chatId,
      step: 'AWAITING_CONTACT',
      phone: null,
      contactName: null,
      companyName: null,
      equipmentType: null,
      description: null,
      fileMetadata: buildDraftMetadata({ files: [] })
    }
  });
}

async function askForContact(message: TelegramMessage) {
  await resetDraft({
    telegramUserId: toStringId(message.from?.id ?? message.chat.id),
    chatId: toStringId(message.chat.id)
  });
  await sendTelegramMessage(message.chat.id, buildStartMessage(), { replyMarkup: contactKeyboard });
}

async function showConfirmation(draft: TelegramDraft) {
  await prisma.telegramDraftRequest.update({
    where: { telegramUserId: draft.telegramUserId },
    data: { step: 'CONFIRM' }
  });
  const updatedDraft = await getDraft(draft.telegramUserId);

  if (!updatedDraft) {
    return;
  }

  await sendTelegramMessage(
    updatedDraft.chatId,
    buildSummary({
      contactName: updatedDraft.contactName,
      phone: updatedDraft.phone,
      companyName: updatedDraft.companyName,
      equipmentType: updatedDraft.equipmentType,
      partsText: readDraftPartsText(updatedDraft.fileMetadata),
      description: updatedDraft.description,
      files: readDraftFiles(updatedDraft.fileMetadata)
    }),
    { replyMarkup: confirmationKeyboard }
  );
}

async function handleContact(message: TelegramMessage) {
  const telegramUserId = toStringId(message.from?.id ?? message.chat.id);
  const contact = message.contact;

  if (!contact) {
    return;
  }

  if (contact.user_id && message.from?.id && contact.user_id !== message.from.id) {
    await sendTelegramMessage(
      message.chat.id,
      'Будь ласка, поділіться власним номером телефону через кнопку Telegram.',
      { replyMarkup: contactKeyboard }
    );
    return;
  }

  await prisma.telegramDraftRequest.upsert({
    where: { telegramUserId },
    create: {
      telegramUserId,
      chatId: toStringId(message.chat.id),
      step: 'ASK_NAME',
      phone: contact.phone_number,
      contactName: [contact.first_name, contact.last_name].filter(Boolean).join(' ') || null,
      fileMetadata: buildDraftMetadata({ files: [] })
    },
    update: {
      chatId: toStringId(message.chat.id),
      step: 'ASK_NAME',
      phone: contact.phone_number,
      contactName: [contact.first_name, contact.last_name].filter(Boolean).join(' ') || null
    }
  });

  await sendTelegramMessage(message.chat.id, 'Дякуємо, номер підтверджено. Як до вас звертатися?', {
    replyMarkup: removeKeyboard
  });
}

async function handleFileMessage(message: TelegramMessage, draft: TelegramDraft) {
  const file = getDocument(message) ?? getLargestPhoto(message);

  if (!file) {
    return false;
  }

  const metadata = readDraftMetadata(draft.fileMetadata);
  const files = [...metadata.files, file];

  await prisma.telegramDraftRequest.update({
    where: { telegramUserId: draft.telegramUserId },
    data: {
      step: 'ASK_FILES',
      fileMetadata: buildDraftMetadata({
        files,
        partsText: metadata.partsText
      })
    }
  });

  await sendTelegramMessage(
    draft.chatId,
    `Файл додано (${files.length}). Надішліть ще фото/файл або напишіть “Пропустити”, щоб перейти до підтвердження.`
  );
  return true;
}

async function handleTextMessage(message: TelegramMessage, draft: TelegramDraft) {
  const text = getMessageText(message);

  if (!draft.phone || draft.step === 'AWAITING_CONTACT') {
    await sendTelegramMessage(
      message.chat.id,
      'Для створення заявки потрібно підтвердити номер через кнопку “Поділитися номером телефону”.',
      { replyMarkup: contactKeyboard }
    );
    return;
  }

  if (!text) {
    await sendTelegramMessage(message.chat.id, 'Будь ласка, надішліть текстову відповідь.');
    return;
  }

  if (draft.step === 'ASK_NAME') {
    await prisma.telegramDraftRequest.update({
      where: { telegramUserId: draft.telegramUserId },
      data: { contactName: text, step: 'ASK_COMPANY' }
    });
    await sendTelegramMessage(message.chat.id, 'Вкажіть назву компанії або напишіть “Пропустити”.');
    return;
  }

  if (draft.step === 'ASK_COMPANY') {
    await prisma.telegramDraftRequest.update({
      where: { telegramUserId: draft.telegramUserId },
      data: { companyName: isSkipText(text) ? null : text, step: 'ASK_EQUIPMENT' }
    });
    await sendTelegramMessage(message.chat.id, 'Який тип техніки? Наприклад: трактор, вантажівка, комбайн, спецтехніка.');
    return;
  }

  if (draft.step === 'ASK_EQUIPMENT') {
    await prisma.telegramDraftRequest.update({
      where: { telegramUserId: draft.telegramUserId },
      data: { equipmentType: text, step: 'ASK_PARTS' }
    });
    await sendTelegramMessage(
      message.chat.id,
      [
        'Вкажіть каталожний номер та назву запчастини, яку шукаєте.',
        'Якщо позицій декілька — напишіть їх одним повідомленням.',
        '',
        'Якщо маєте готову заявку файлом — натисніть або напишіть “Пропустити”.'
      ].join('\n'),
      { replyMarkup: skipKeyboard }
    );
    return;
  }

  if (draft.step === 'ASK_PARTS') {
    const files = readDraftFiles(draft.fileMetadata);

    if (isSkipText(text)) {
      await prisma.telegramDraftRequest.update({
        where: { telegramUserId: draft.telegramUserId },
        data: {
          step: 'ASK_FILES',
          fileMetadata: buildDraftMetadata({ files })
        }
      });
      await sendTelegramMessage(
        message.chat.id,
        'Можете надіслати фото, файл або список. Якщо файлів немає — напишіть “Пропустити”.',
        { replyMarkup: skipKeyboard }
      );
      return;
    }

    await prisma.telegramDraftRequest.update({
      where: { telegramUserId: draft.telegramUserId },
      data: {
        step: 'ASK_DESCRIPTION',
        fileMetadata: buildDraftMetadata({
          files,
          partsText: text
        })
      }
    });
    await sendTelegramMessage(
      message.chat.id,
      'Додайте короткий опис потреби або коментар для менеджера. Якщо коментар не потрібен — напишіть “Пропустити”.',
      { replyMarkup: skipKeyboard }
    );
    return;
  }

  if (draft.step === 'ASK_DESCRIPTION') {
    const metadata = readDraftMetadata(draft.fileMetadata);

    await prisma.telegramDraftRequest.update({
      where: { telegramUserId: draft.telegramUserId },
      data: {
        description: isSkipText(text) ? null : text,
        step: 'ASK_FILES',
        fileMetadata: buildDraftMetadata(metadata)
      }
    });
    await sendTelegramMessage(
      message.chat.id,
      'Можете надіслати фото, файл або список. Якщо файлів немає — напишіть “Пропустити”.',
      { replyMarkup: skipKeyboard }
    );
    return;
  }

  if (draft.step === 'ASK_FILES') {
    if (isSkipText(text)) {
      await showConfirmation(draft);
      return;
    }

    await sendTelegramMessage(message.chat.id, 'Надішліть фото/файл або напишіть “Пропустити”, щоб перейти до підтвердження.');
    return;
  }

  if (draft.step === 'CONFIRM') {
    await sendTelegramMessage(message.chat.id, 'Будь ласка, використайте кнопки “Підтвердити заявку”, “Скасувати” або “Почати заново”.', {
      replyMarkup: confirmationKeyboard
    });
  }
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '');
}

async function findClientProfileByPhone(phone: string) {
  const normalizedPhone = normalizePhone(phone);
  const phoneTail = normalizedPhone.length >= 9 ? normalizedPhone.slice(-9) : normalizedPhone;

  if (!phoneTail) {
    return null;
  }

  const candidates = await prisma.clientProfile.findMany({
    where: {
      OR: [
        { phone: { contains: phoneTail } },
        {
          user: {
            is: {
              phone: { contains: phoneTail }
            }
          }
        }
      ]
    },
    include: { user: true },
    take: 20
  });

  return (
    candidates.find((candidate) => {
      const profilePhone = candidate.phone ? normalizePhone(candidate.phone) : '';
      const userPhone = candidate.user.phone ? normalizePhone(candidate.user.phone) : '';
      return profilePhone.endsWith(phoneTail) || userPhone.endsWith(phoneTail);
    }) ?? null
  );
}

function buildTelegramRequestDescription(input: {
  equipmentType: string;
  partsText?: string | null;
  description?: string | null;
}) {
  return [
    `Тип техніки: ${input.equipmentType}`,
    '',
    'Каталожний номер / назва запчастини:',
    input.partsText || 'Не вказано',
    '',
    'Опис потреби / коментар:',
    input.description || 'Не вказано',
    '',
    'Джерело: Telegram'
  ].join('\n');
}

async function attachTelegramFiles(requestId: string, files: TelegramDraftFile[]) {
  const savedFiles = [];

  for (const file of files) {
    try {
      const telegramFile = await getTelegramFile(file.fileId);

      if (!telegramFile.file_path) {
        throw new Error('Telegram file path is missing.');
      }

      const buffer = await downloadTelegramFile(telegramFile.file_path);
      const savedFile = await saveRequestFileBufferLocal(requestId, {
        fileName: file.fileName,
        buffer,
        mimeType: file.mimeType
      });
      const requestFile = await prisma.requestFile.create({
        data: {
          requestId,
          fileName: savedFile.fileName,
          storageKey: savedFile.storageKey,
          fileUrl: savedFile.fileUrl,
          mimeType: savedFile.mimeType,
          size: savedFile.size
        }
      });
      savedFiles.push(requestFile);
    } catch {
      const requestFile = await prisma.requestFile.create({
        data: {
          requestId,
          fileName: file.fileName,
          storageKey: `telegram/${file.fileId}`,
          mimeType: file.mimeType,
          size: file.size ?? 0
        }
      });
      savedFiles.push(requestFile);
    }
  }

  return savedFiles;
}

async function createTelegramRequest(draft: TelegramDraft) {
  if (!draft.phone || !draft.contactName || !draft.equipmentType) {
    throw new Error('Telegram draft is incomplete.');
  }

  const clientProfile = await findClientProfileByPhone(draft.phone);
  const requestNumber = generateRequestNumber();
  const publicStatusToken = generatePublicStatusToken();
  const metadata = readDraftMetadata(draft.fileMetadata);
  const files = metadata.files;
  const description = buildTelegramRequestDescription({
    equipmentType: draft.equipmentType,
    partsText: metadata.partsText,
    description: draft.description
  });

  const createdRequest = await prisma.request.create({
    data: {
      requestNumber,
      publicStatusToken,
      source: 'TELEGRAM',
      status: 'NEW',
      clientId: clientProfile?.id,
      guestName: clientProfile ? null : draft.contactName,
      guestPhone: clientProfile ? null : draft.phone,
      companyName: draft.companyName ?? clientProfile?.companyName ?? draft.contactName,
      equipmentType: draft.equipmentType,
      description,
      statusHistory: {
        create: {
          newStatus: 'NEW'
        }
      },
      comments: {
        create: {
          internal: true,
          message: [
            'Telegram request metadata',
            `telegramUserId: ${draft.telegramUserId}`,
            `chatId: ${draft.chatId}`,
            `attachedFiles: ${files.length}`
          ].join('\n')
        }
      }
    }
  });

  await attachTelegramFiles(createdRequest.id, files);
  await prisma.telegramDraftRequest.delete({
    where: { telegramUserId: draft.telegramUserId }
  });

  return createdRequest;
}

async function handleCallback(callbackQuery: TelegramCallbackQuery) {
  const chatId = callbackQuery.message?.chat.id;
  const telegramUserId = toStringId(callbackQuery.from.id);
  const data = callbackQuery.data;

  if (!chatId) {
    await answerCallbackQuery(callbackQuery.id);
    return;
  }

  if (data === TELEGRAM_CALLBACKS.restart) {
    await answerCallbackQuery(callbackQuery.id, 'Починаємо заново.');
    await askForContact({
      message_id: callbackQuery.message?.message_id ?? 0,
      chat: { id: chatId },
      from: callbackQuery.from
    });
    return;
  }

  if (data === TELEGRAM_CALLBACKS.cancel) {
    await prisma.telegramDraftRequest.deleteMany({ where: { telegramUserId } });
    await answerCallbackQuery(callbackQuery.id, 'Заявку скасовано.');
    await sendTelegramMessage(chatId, 'Заявку скасовано. Щоб почати нову, натисніть /start.');
    return;
  }

  if (data !== TELEGRAM_CALLBACKS.confirm) {
    await answerCallbackQuery(callbackQuery.id);
    return;
  }

  const draft = await getDraft(telegramUserId);

  if (!draft || draft.step !== 'CONFIRM') {
    await answerCallbackQuery(callbackQuery.id, 'Заявка ще не готова до підтвердження.');
    await sendTelegramMessage(chatId, 'Щоб створити заявку, пройдіть сценарій з /start.');
    return;
  }

  const createdRequest = await createTelegramRequest(draft);
  await answerCallbackQuery(callbackQuery.id, 'Заявку створено.');
  await sendTelegramMessage(
    chatId,
    buildCreatedMessage({
      requestNumber: createdRequest.requestNumber,
      statusUrl: buildStatusUrl(createdRequest.publicStatusToken)
    })
  );
}

async function handleMessage(message: TelegramMessage) {
  const telegramUserId = toStringId(message.from?.id ?? message.chat.id);
  const text = getMessageText(message);

  if (text === '/start') {
    await askForContact(message);
    return;
  }

  if (message.contact) {
    await handleContact(message);
    return;
  }

  const draft = await getDraft(telegramUserId);

  if (!draft) {
    await askForContact(message);
    return;
  }

  const handledFile = await handleFileMessage(message, draft);

  if (handledFile) {
    return;
  }

  await handleTextMessage(message, draft);
}

export async function handleTelegramUpdate(update: TelegramUpdate) {
  if (update.callback_query) {
    await handleCallback(update.callback_query);
    return;
  }

  if (update.message) {
    await handleMessage(update.message);
  }
}
