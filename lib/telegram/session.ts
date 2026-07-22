import { saveRequestFileBufferLocal } from '@/lib/files/local-storage';
import {
  EQUIPMENT_TAXONOMY_TELEGRAM_FIELDS_ENABLED,
  EQUIPMENT_TEXT_FIELD_MAX_LENGTH
} from '@/lib/features/equipment-taxonomy';
import { getPhoneLookupTail, normalizeUkrainianPhone, phoneNumbersMatch } from '@/lib/phone/normalize';
import { prisma } from '@/lib/prisma';
import { generatePublicStatusToken } from '@/lib/requests/identifiers';
import { vehicleAccessWhereForClient } from '@/lib/vehicles/ownership';
import { getActiveEquipmentTypeNames, getActiveManufacturerNamesForType, validateEquipmentTaxonomySelection } from '@/lib/vehicles/taxonomy';

import { answerCallbackQuery, downloadTelegramFile, getTelegramFile, sendTelegramMessage } from './bot';
import {
  buildManufacturerKeyboard,
  buildEquipmentTypeKeyboard,
  buildCreatedMessage,
  buildEquipmentTypePrompt,
  buildManufacturerPrompt,
  buildProfileFoundMessage,
  buildRegistrationKeyboard,
  buildRegistrationRequiredMessage,
  buildStartMessage,
  buildSummary,
  buildVehicleSelectionKeyboard,
  buildVehicleSelectionMessage,
  confirmationKeyboard,
  contactKeyboard,
  continueRequestKeyboard,
  createdRequestKeyboard,
  isSkipText,
  removeKeyboard,
  skipKeyboard,
  TELEGRAM_CALLBACKS,
  TELEGRAM_VEHICLE_PAGE_SIZE
} from './messages';
import { validateManualEquipmentField } from './request-fields';
import type { TelegramCallbackQuery, TelegramDraftFile, TelegramMessage, TelegramUpdate } from './types';

type TelegramDraft = NonNullable<Awaited<ReturnType<typeof getDraft>>>;
type FoundClientProfile = NonNullable<Awaited<ReturnType<typeof findClientProfileByPhone>>>;

type TelegramDraftMetadata = {
  files: TelegramDraftFile[];
  partsText: string | null;
  manufacturer: string | null;
  model: string | null;
  vehicleYear: number | null;
  vinOrSerial: string | null;
  email: string | null;
  vehicleId: string | null;
};

const MAX_TELEGRAM_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_DOCUMENT_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf', 'xls', 'xlsx', 'csv', 'doc', 'docx'];

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
      partsText: null,
      manufacturer: null,
      model: null,
      vehicleYear: null,
      vinOrSerial: null,
      email: null,
      vehicleId: null
    };
  }

  if (!value || typeof value !== 'object') {
    return {
      files: [],
      partsText: null,
      manufacturer: null,
      model: null,
      vehicleYear: null,
      vinOrSerial: null,
      email: null,
      vehicleId: null
    };
  }

  const candidate = value as {
    files?: unknown;
    partsText?: unknown;
    manufacturer?: unknown;
    model?: unknown;
    vehicleYear?: unknown;
    vinOrSerial?: unknown;
    email?: unknown;
    vehicleId?: unknown;
  };
  const vehicleYear = typeof candidate.vehicleYear === 'number' && Number.isInteger(candidate.vehicleYear) ? candidate.vehicleYear : null;

  return {
    files: readDraftFilesFromValue(candidate.files),
    partsText: typeof candidate.partsText === 'string' && candidate.partsText.trim() ? candidate.partsText.trim() : null,
    manufacturer: typeof candidate.manufacturer === 'string' && candidate.manufacturer.trim() ? candidate.manufacturer.trim() : null,
    model: typeof candidate.model === 'string' && candidate.model.trim() ? candidate.model.trim() : null,
    vehicleYear,
    vinOrSerial: typeof candidate.vinOrSerial === 'string' && candidate.vinOrSerial.trim() ? candidate.vinOrSerial.trim() : null,
    email: typeof candidate.email === 'string' && candidate.email.trim() ? candidate.email.trim() : null,
    vehicleId: typeof candidate.vehicleId === 'string' && candidate.vehicleId.trim() ? candidate.vehicleId.trim() : null
  };
}

function buildDraftMetadata(input: Partial<TelegramDraftMetadata> & { files: TelegramDraftFile[] }) {
  return {
    files: input.files,
    partsText: input.partsText?.trim() || null,
    manufacturer: input.manufacturer?.trim() || null,
    model: input.model?.trim() || null,
    vehicleYear: input.vehicleYear ?? null,
    vinOrSerial: input.vinOrSerial?.trim() || null,
    email: input.email?.trim() || null,
    vehicleId: input.vehicleId?.trim() || null
  };
}

function mergeDraftMetadata(value: unknown, patch: Partial<TelegramDraftMetadata>) {
  const current = readDraftMetadata(value);

  return buildDraftMetadata({
    ...current,
    ...patch,
    files: patch.files ?? current.files
  });
}

function getMessageText(message: TelegramMessage) {
  return message.text?.trim() ?? '';
}

function getAppBaseUrl() {
  return process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || 'https://kairos-parts.vercel.app';
}

function buildStatusUrl(publicStatusToken: string) {
  const baseUrl = getAppBaseUrl();
  const path = `/request/status/${publicStatusToken}`;

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

function getFileExtension(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function isAllowedTelegramFile(file: TelegramDraftFile) {
  if (file.kind === 'photo') {
    return true;
  }

  return ALLOWED_DOCUMENT_EXTENSIONS.includes(getFileExtension(file.fileName));
}

function isValidVehicleYear(text: string) {
  const year = Number(text);

  if (!Number.isInteger(year) || year < 1950 || year > 2100) {
    return null;
  }

  return year;
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

  const metadata = readDraftMetadata(updatedDraft.fileMetadata);

  await sendTelegramMessage(
    updatedDraft.chatId,
    buildSummary({
      contactName: updatedDraft.contactName,
      phone: updatedDraft.phone,
      companyName: updatedDraft.companyName,
      email: metadata.email,
      equipmentType: updatedDraft.equipmentType,
      manufacturer: metadata.manufacturer,
      model: metadata.model,
      vehicleYear: metadata.vehicleYear,
      vinOrSerial: metadata.vinOrSerial,
      selectedVehicle: Boolean(metadata.vehicleId),
      description: updatedDraft.description,
      files: metadata.files
    }),
    { replyMarkup: confirmationKeyboard }
  );
}

async function showRegistrationRequired(input: {
  telegramUserId: string;
  chatId: string;
  phone: string;
  contactName?: string | null;
}) {
  await prisma.telegramDraftRequest.upsert({
    where: { telegramUserId: input.telegramUserId },
    create: {
      telegramUserId: input.telegramUserId,
      chatId: input.chatId,
      step: 'AWAITING_REGISTRATION',
      phone: input.phone,
      contactName: input.contactName ?? null,
      fileMetadata: buildDraftMetadata({ files: [] })
    },
    update: {
      chatId: input.chatId,
      step: 'AWAITING_REGISTRATION',
      phone: input.phone,
      contactName: input.contactName ?? undefined
    }
  });

  await sendTelegramMessage(input.chatId, buildRegistrationRequiredMessage(), {
    replyMarkup: buildRegistrationKeyboard(getAppBaseUrl())
  });
}

async function confirmClientProfile(input: {
  telegramUserId: string;
  chatId: string;
  phone: string;
  clientProfile: FoundClientProfile;
  contactNameFallback?: string | null;
}) {
  const { clientProfile } = input;
  const contactName = clientProfile.contactName ?? input.contactNameFallback ?? clientProfile.user.name;
  const companyName = clientProfile.companyName ?? clientProfile.user.companyMemberships[0]?.company.name ?? null;
  const email = clientProfile.email ?? clientProfile.user.email;

  await linkTelegramClient({
    clientProfileId: clientProfile.id,
    telegramUserId: input.telegramUserId,
    chatId: input.chatId,
    phone: input.phone
  });

  await prisma.telegramDraftRequest.upsert({
    where: { telegramUserId: input.telegramUserId },
    create: {
      telegramUserId: input.telegramUserId,
      chatId: input.chatId,
      step: 'CONFIRM_PROFILE',
      phone: input.phone,
      contactName,
      companyName,
      fileMetadata: buildDraftMetadata({ files: [], email })
    },
    update: {
      chatId: input.chatId,
      step: 'CONFIRM_PROFILE',
      phone: input.phone,
      contactName,
      companyName,
      equipmentType: null,
      description: null,
      fileMetadata: buildDraftMetadata({ files: [], email })
    }
  });

  await sendTelegramMessage(input.chatId, 'Номер підтверджено.', { replyMarkup: removeKeyboard });
  await sendTelegramMessage(
    input.chatId,
    buildProfileFoundMessage({ contactName, companyName, phone: input.phone, email }),
    { replyMarkup: continueRequestKeyboard }
  );
}

async function resumeAfterRegistration(draft: TelegramDraft) {
  if (!draft.phone) {
    return false;
  }

  const clientProfile = await findClientProfileByPhone(draft.phone);

  if (!clientProfile) {
    await showRegistrationRequired({
      telegramUserId: draft.telegramUserId,
      chatId: draft.chatId,
      phone: draft.phone,
      contactName: draft.contactName
    });
    return true;
  }

  await confirmClientProfile({
    telegramUserId: draft.telegramUserId,
    chatId: draft.chatId,
    phone: draft.phone,
    clientProfile,
    contactNameFallback: draft.contactName
  });
  return true;
}

function vehicleAccessContext(clientProfile: FoundClientProfile) {
  return {
    clientProfileId: clientProfile.id,
    companyId: clientProfile.user.companyMemberships[0]?.companyId ?? null
  };
}

const telegramVehicleSelect = {
  id: true,
  name: true,
  type: true,
  manufacturer: true,
  model: true,
  year: true,
  vinOrSerial: true
} as const;

async function getAvailableVehicles(clientProfile: FoundClientProfile) {
  return prisma.vehicle.findMany({
    where: {
      AND: [
        vehicleAccessWhereForClient(vehicleAccessContext(clientProfile)),
        { archivedAt: null }
      ]
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: telegramVehicleSelect
  });
}

async function findAvailableVehicle(clientProfile: FoundClientProfile, vehicleId: string) {
  return prisma.vehicle.findFirst({
    where: {
      id: vehicleId,
      AND: [
        vehicleAccessWhereForClient(vehicleAccessContext(clientProfile)),
        { archivedAt: null }
      ]
    },
    select: telegramVehicleSelect
  });
}

function clearVehicleMetadata(value: unknown) {
  return mergeDraftMetadata(value, {
    vehicleId: null,
    manufacturer: null,
    model: null,
    vehicleYear: null,
    vinOrSerial: null
  });
}

async function beginManualEquipmentFlow(draft: TelegramDraft, chatId: number | string) {
  await prisma.telegramDraftRequest.update({
    where: { telegramUserId: draft.telegramUserId },
    data: {
      step: 'ASK_EQUIPMENT',
      equipmentType: null,
      fileMetadata: clearVehicleMetadata(draft.fileMetadata)
    }
  });

  if (!EQUIPMENT_TAXONOMY_TELEGRAM_FIELDS_ENABLED) {
    await sendTelegramMessage(chatId, buildEquipmentTypePrompt(), { replyMarkup: removeKeyboard });
    return;
  }

  const equipmentTypeOptions = await getActiveEquipmentTypeNames();
  await sendTelegramMessage(chatId, 'Оберіть тип техніки:', {
    replyMarkup: buildEquipmentTypeKeyboard(equipmentTypeOptions)
  });
}

async function openVehicleSelectionOrManual(draft: TelegramDraft, chatId: number | string, requestedPage = 0) {
  const clientProfile = draft.phone ? await findClientProfileByPhone(draft.phone) : null;

  if (!clientProfile) {
    if (draft.phone) {
      await showRegistrationRequired({
        telegramUserId: draft.telegramUserId,
        chatId: toStringId(chatId),
        phone: draft.phone,
        contactName: draft.contactName
      });
    }
    return;
  }

  const vehicles = await getAvailableVehicles(clientProfile);

  if (vehicles.length === 0) {
    await beginManualEquipmentFlow(draft, chatId);
    return;
  }

  const totalPages = Math.ceil(vehicles.length / TELEGRAM_VEHICLE_PAGE_SIZE);
  const page = Number.isInteger(requestedPage) && requestedPage >= 0 && requestedPage < totalPages ? requestedPage : 0;
  const pageVehicles = vehicles.slice(page * TELEGRAM_VEHICLE_PAGE_SIZE, (page + 1) * TELEGRAM_VEHICLE_PAGE_SIZE);

  await prisma.telegramDraftRequest.update({
    where: { telegramUserId: draft.telegramUserId },
    data: { step: 'SELECT_VEHICLE' }
  });
  await sendTelegramMessage(chatId, buildVehicleSelectionMessage(), {
    replyMarkup: buildVehicleSelectionKeyboard({ vehicles: pageVehicles, page, totalPages })
  });
}

async function sendDescriptionPrompt(chatId: number | string) {
  await sendTelegramMessage(
    chatId,
    'Вкажіть каталожний номер та назву запчастини, яку шукаєте.\n\nЯкщо позицій декілька — напишіть їх одним повідомленням.'
  );
}

async function handleContact(message: TelegramMessage) {
  const telegramUserId = toStringId(message.from?.id ?? message.chat.id);
  const chatId = toStringId(message.chat.id);
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

  const phone = normalizeUkrainianPhone(contact.phone_number);

  if (!phone) {
    await prisma.telegramDraftRequest.deleteMany({ where: { telegramUserId } });
    await sendTelegramMessage(
      message.chat.id,
      'Введіть коректний номер телефону у форматі +380XXXXXXXXX.',
      { replyMarkup: contactKeyboard }
    );
    return;
  }

  const clientProfile = await findClientProfileByPhone(phone);

  if (!clientProfile) {
    await showRegistrationRequired({
      telegramUserId,
      chatId,
      phone,
      contactName: getContactNameFromMessage(message)
    });
    return;
  }

  await confirmClientProfile({
    telegramUserId,
    chatId,
    phone,
    clientProfile,
    contactNameFallback: getContactNameFromMessage(message)
  });
}

async function handleFileMessage(message: TelegramMessage, draft: TelegramDraft) {
  const file = getDocument(message) ?? getLargestPhoto(message);

  if (!file) {
    return false;
  }

  if (draft.step !== 'ASK_FILES') {
    await sendTelegramMessage(
      draft.chatId,
      'Файл можна додати на окремому кроці після опису заявки. Будь ласка, спочатку дайте відповідь на поточне питання.'
    );
    return true;
  }

  if ((file.size ?? 0) > MAX_TELEGRAM_FILE_SIZE_BYTES) {
    await sendTelegramMessage(
      draft.chatId,
      'Файл завеликий. Максимальний розмір одного файлу — 20 MB. Надішліть інший файл або натисніть “Пропустити”.',
      { replyMarkup: skipKeyboard }
    );
    return true;
  }

  if (!isAllowedTelegramFile(file)) {
    await sendTelegramMessage(
      draft.chatId,
      'Формат файлу не підтримується. Дозволені формати: JPG, PNG, PDF, XLS, XLSX, CSV, DOC, DOCX.',
      { replyMarkup: skipKeyboard }
    );
    return true;
  }

  const metadata = readDraftMetadata(draft.fileMetadata);
  const files = [...metadata.files, file];

  await prisma.telegramDraftRequest.update({
    where: { telegramUserId: draft.telegramUserId },
    data: {
      step: 'ASK_FILES',
      fileMetadata: mergeDraftMetadata(draft.fileMetadata, { files })
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

  if (draft.step === 'CONFIRM_PROFILE') {
    await sendTelegramMessage(message.chat.id, 'Щоб продовжити, натисніть кнопку “Продовжити створення заявки”.', {
      replyMarkup: continueRequestKeyboard
    });
    return;
  }

  if (draft.step === 'AWAITING_REGISTRATION') {
    await sendTelegramMessage(
      message.chat.id,
      'Після реєстрації поверніться до бота та надішліть /start. Бот повторно перевірить уже підтверджений номер.',
      { replyMarkup: buildRegistrationKeyboard(getAppBaseUrl()) }
    );
    return;
  }

  if (draft.step === 'SELECT_VEHICLE') {
    await sendTelegramMessage(message.chat.id, 'Оберіть техніку кнопкою зі списку або натисніть «Пропустити».');
    await openVehicleSelectionOrManual(draft, message.chat.id);
    return;
  }

  if (draft.step === 'ASK_EQUIPMENT') {
    if (!EQUIPMENT_TAXONOMY_TELEGRAM_FIELDS_ENABLED) {
      const result = validateManualEquipmentField(text);

      if (!result.ok) {
        const messageText = result.reason === 'too_long'
          ? `Тип техніки не може перевищувати ${EQUIPMENT_TEXT_FIELD_MAX_LENGTH} символів.`
          : 'Вкажіть тип техніки текстом.';
        await sendTelegramMessage(message.chat.id, messageText);
        return;
      }

      await prisma.telegramDraftRequest.update({
        where: { telegramUserId: draft.telegramUserId },
        data: {
          equipmentType: result.value,
          step: 'ASK_MANUFACTURER',
          fileMetadata: mergeDraftMetadata(draft.fileMetadata, { vehicleId: null })
        }
      });
      await sendTelegramMessage(message.chat.id, buildManufacturerPrompt(), { replyMarkup: removeKeyboard });
      return;
    }

    const equipmentTypeOptions = await getActiveEquipmentTypeNames();
    if (!equipmentTypeOptions.includes(text)) {
      await sendTelegramMessage(message.chat.id, 'Оберіть тип техніки зі списку або введіть власний варіант.', {
        replyMarkup: buildEquipmentTypeKeyboard(equipmentTypeOptions)
      });
      return;
    }

    await prisma.telegramDraftRequest.update({
      where: { telegramUserId: draft.telegramUserId },
      data: { equipmentType: text, step: 'ASK_MANUFACTURER' }
    });
    const manufacturerOptions = await getActiveManufacturerNamesForType(text);

    if (manufacturerOptions.length > 0) {
      await sendTelegramMessage(message.chat.id, 'Оберіть виробника / марку техніки:', {
        replyMarkup: buildManufacturerKeyboard(manufacturerOptions)
      });
      return;
    }

    await sendTelegramMessage(message.chat.id, 'Введіть виробника або марку техніки.\n\nНаприклад: John Deere, MAN, Claas', {
      replyMarkup: removeKeyboard
    });
    return;
  }

  if (draft.step === 'ASK_MANUFACTURER') {
    if (!EQUIPMENT_TAXONOMY_TELEGRAM_FIELDS_ENABLED) {
      const result = validateManualEquipmentField(text);

      if (!result.ok) {
        const messageText = result.reason === 'too_long'
          ? `Виробник або марка не може перевищувати ${EQUIPMENT_TEXT_FIELD_MAX_LENGTH} символів.`
          : 'Вкажіть виробника або марку техніки текстом.';
        await sendTelegramMessage(message.chat.id, messageText);
        return;
      }

      await prisma.telegramDraftRequest.update({
        where: { telegramUserId: draft.telegramUserId },
        data: {
          step: 'ASK_MODEL',
          fileMetadata: mergeDraftMetadata(draft.fileMetadata, { manufacturer: result.value })
        }
      });
      await sendTelegramMessage(message.chat.id, 'Вкажіть модель техніки.\n\nНаприклад: MAN TGX 18.440, John Deere 8430');
      return;
    }

    const manufacturerOptions = await getActiveManufacturerNamesForType(draft.equipmentType ?? '');
    if (!manufacturerOptions.includes(text)) {
      await sendTelegramMessage(message.chat.id, 'Оберіть виробника / марку зі списку.', {
        replyMarkup: buildManufacturerKeyboard(manufacturerOptions)
      });
      return;
    }

    await prisma.telegramDraftRequest.update({
      where: { telegramUserId: draft.telegramUserId },
      data: {
        step: 'ASK_MODEL',
        fileMetadata: mergeDraftMetadata(draft.fileMetadata, { manufacturer: text })
      }
    });
    await sendTelegramMessage(message.chat.id, 'Вкажіть модель техніки.\n\nНаприклад: MAN TGX 18.440, John Deere 8430');
    return;
  }

  if (draft.step === 'ASK_MODEL') {
    await prisma.telegramDraftRequest.update({
      where: { telegramUserId: draft.telegramUserId },
      data: {
        step: 'ASK_YEAR',
        fileMetadata: mergeDraftMetadata(draft.fileMetadata, { model: text })
      }
    });
    await sendTelegramMessage(message.chat.id, 'Вкажіть рік випуску техніки.\n\nНаприклад: 2018');
    return;
  }

  if (draft.step === 'ASK_YEAR') {
    const vehicleYear = isValidVehicleYear(text);

    if (!vehicleYear) {
      await sendTelegramMessage(message.chat.id, 'Будь ласка, введіть рік випуску числом у форматі YYYY, наприклад 2018.');
      return;
    }

    await prisma.telegramDraftRequest.update({
      where: { telegramUserId: draft.telegramUserId },
      data: {
        step: 'ASK_VIN',
        fileMetadata: mergeDraftMetadata(draft.fileMetadata, { vehicleYear })
      }
    });
    await sendTelegramMessage(message.chat.id, 'Вкажіть VIN, серійний номер або номер шасі.');
    return;
  }

  if (draft.step === 'ASK_VIN') {
    await prisma.telegramDraftRequest.update({
      where: { telegramUserId: draft.telegramUserId },
      data: {
        step: 'ASK_DESCRIPTION',
        fileMetadata: mergeDraftMetadata(draft.fileMetadata, { vinOrSerial: text })
      }
    });
    await sendDescriptionPrompt(message.chat.id);
    return;
  }

  if (draft.step === 'ASK_DESCRIPTION') {
    if (text.length < 5) {
      await sendTelegramMessage(message.chat.id, 'Будь ласка, опишіть потребу детальніше: мінімум 5 символів.');
      return;
    }

    await prisma.telegramDraftRequest.update({
      where: { telegramUserId: draft.telegramUserId },
      data: {
        description: text,
        step: 'ASK_FILES'
      }
    });
    await sendTelegramMessage(
      message.chat.id,
      [
        'Додайте фото, список або документ.',
        '',
        'Можна прикріпити фото деталі, список позицій, PDF, Excel або документ із артикулами.',
        '',
        'Або натисніть “Пропустити”.'
      ].join('\n'),
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
    await sendTelegramMessage(message.chat.id, 'Будь ласка, використайте кнопки “Створити заявку”, “Скасувати” або “Почати заново”.', {
      replyMarkup: confirmationKeyboard
    });
    return;
  }

  await prisma.telegramDraftRequest.deleteMany({ where: { telegramUserId: draft.telegramUserId } });
  await sendTelegramMessage(
    message.chat.id,
    'Ми оновили форму заявки. Будь ласка, почніть створення заявки заново.',
    { replyMarkup: contactKeyboard }
  );
}

async function findClientProfileByPhone(phone: string) {
  const normalizedPhone = normalizeUkrainianPhone(phone);
  const phoneTail = getPhoneLookupTail(normalizedPhone);

  if (!normalizedPhone || !phoneTail) {
    return null;
  }

  const candidates = await prisma.clientProfile.findMany({
    where: {
      user: {
        is: { role: 'CLIENT' }
      },
      OR: [
        { phone: { contains: phoneTail } },
        {
          user: {
            is: {
              OR: [
                { normalizedPhone },
                { phone: { contains: phoneTail } }
              ]
            }
          }
        }
      ]
    },
    include: {
      user: {
        include: {
          companyMemberships: {
            take: 1,
            orderBy: { createdAt: 'asc' },
            include: { company: { select: { id: true, name: true } } }
          }
        }
      }
    },
    take: 50
  });

  const profile = candidates.find((candidate) => (
    candidate.user.role === 'CLIENT' &&
    (
      candidate.user.normalizedPhone === normalizedPhone ||
      phoneNumbersMatch(candidate.phone, normalizedPhone) ||
      phoneNumbersMatch(candidate.user.phone, normalizedPhone)
    )
  ));

  return profile ?? null;
}

async function linkTelegramClient(input: { clientProfileId: string; telegramUserId: string; chatId: string; phone: string }) {
  const phone = normalizeUkrainianPhone(input.phone);
  if (!phone) {
    throw new Error('Invalid Ukrainian phone passed to Telegram client linking.');
  }

  await prisma.clientProfile.update({
    where: { id: input.clientProfileId },
    data: {
      telegramUserId: input.telegramUserId,
      telegramChatId: input.chatId,
      phone,
      user: {
        update: { phone, normalizedPhone: phone }
      }
    }
  });
}

function getContactNameFromMessage(message: TelegramMessage) {
  return [message.contact?.first_name, message.contact?.last_name].filter(Boolean).join(' ') || null;
}

function buildTelegramRequestDescription(input: { description?: string | null }) {
  return input.description?.trim() || 'Не вказано';
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
  const metadata = readDraftMetadata(draft.fileMetadata);

  if (
    !draft.phone ||
    !draft.contactName ||
    !draft.description
  ) {
    throw new Error('Telegram draft is incomplete.');
  }

  const clientProfile = await findClientProfileByPhone(draft.phone);

  if (!clientProfile) {
    throw new Error('Registered client profile is required for Telegram request.');
  }

  const publicStatusToken = generatePublicStatusToken();
  const files = metadata.files;
  const company = clientProfile.user.companyMemberships[0]?.company ?? null;
  const selectedVehicle = metadata.vehicleId
    ? await findAvailableVehicle(clientProfile, metadata.vehicleId)
    : null;

  if (metadata.vehicleId && !selectedVehicle) {
    throw new Error('Selected vehicle is no longer available.');
  }

  if (
    !selectedVehicle &&
    (!draft.equipmentType || !metadata.manufacturer || !metadata.model || !metadata.vehicleYear || !metadata.vinOrSerial)
  ) {
    throw new Error('Telegram draft is incomplete.');
  }

  const vehicleId = selectedVehicle?.id ?? null;
  let equipmentType = selectedVehicle ? draft.equipmentType ?? selectedVehicle.type : draft.equipmentType;
  let manufacturerId: string | null = null;
  let manufacturerName = selectedVehicle ? metadata.manufacturer ?? selectedVehicle.manufacturer : metadata.manufacturer;
  const model = selectedVehicle ? metadata.model ?? selectedVehicle.model : metadata.model;
  const vehicleYear = metadata.vehicleYear;
  const vinOrSerial = metadata.vinOrSerial;

  if (!selectedVehicle && EQUIPMENT_TAXONOMY_TELEGRAM_FIELDS_ENABLED) {
    if (!equipmentType || !manufacturerName) {
      throw new Error('Telegram draft is incomplete.');
    }
    const taxonomy = await validateEquipmentTaxonomySelection({
      equipmentType,
      manufacturer: manufacturerName
    });
    if (!taxonomy.ok) {
      throw new Error('Telegram equipment taxonomy selection is no longer active.');
    }

    equipmentType = taxonomy.equipmentType.name;
    manufacturerId = taxonomy.manufacturer.id;
    manufacturerName = taxonomy.manufacturer.name;
  }
  const description = buildTelegramRequestDescription({ description: draft.description });

  const createdRequest = await prisma.request.create({
    data: {
      publicStatusToken,
      source: 'TELEGRAM',
      status: 'NEW',
      clientId: clientProfile.id,
      companyId: company?.id ?? null,
      guestName: null,
      guestPhone: null,
      companyName: draft.companyName ?? clientProfile.companyName ?? company?.name ?? draft.contactName,
      vehicleId,
      manufacturerId,
      manufacturerName,
      equipmentType,
      model,
      vehicleYear,
      vinOrSerial,
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
            `attachedFiles: ${files.length}`,
            `vehicleSelected: ${Boolean(vehicleId)}`,
            `manufacturer: ${manufacturerName}`,
            `model: ${model}`,
            `vehicleYear: ${vehicleYear}`,
            `vinOrSerial: ${vinOrSerial}`
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

  if (data === TELEGRAM_CALLBACKS.continueRequest) {
    const draft = await getDraft(telegramUserId);

    if (!draft || draft.step !== 'CONFIRM_PROFILE') {
      await answerCallbackQuery(callbackQuery.id, 'Почніть створення заявки з /start.');
      await sendTelegramMessage(chatId, 'Щоб створити заявку, натисніть /start і підтвердьте номер телефону.');
      return;
    }

    await answerCallbackQuery(callbackQuery.id);
    await openVehicleSelectionOrManual(draft, chatId);
    return;
  }

  if (data === TELEGRAM_CALLBACKS.edit) {
    const draft = await getDraft(telegramUserId);

    if (!draft || draft.step !== 'CONFIRM') {
      await answerCallbackQuery(callbackQuery.id, 'Дані заявки недоступні для редагування.');
      return;
    }

    await answerCallbackQuery(callbackQuery.id, 'Оновіть дані заявки.');
    await openVehicleSelectionOrManual(draft, chatId);
    return;
  }

  if (data?.startsWith(TELEGRAM_CALLBACKS.vehiclePagePrefix)) {
    const draft = await getDraft(telegramUserId);
    const pageText = data.slice(TELEGRAM_CALLBACKS.vehiclePagePrefix.length);
    const page = /^\d+$/.test(pageText) ? Number(pageText) : 0;

    if (!draft || draft.step !== 'SELECT_VEHICLE') {
      await answerCallbackQuery(callbackQuery.id, 'Список техніки вже неактуальний.');
      return;
    }

    await answerCallbackQuery(callbackQuery.id);
    await openVehicleSelectionOrManual(draft, chatId, page);
    return;
  }

  if (data === TELEGRAM_CALLBACKS.vehicleSkip) {
    const draft = await getDraft(telegramUserId);

    if (!draft || draft.step !== 'SELECT_VEHICLE') {
      await answerCallbackQuery(callbackQuery.id, 'Список техніки вже неактуальний.');
      return;
    }

    await answerCallbackQuery(callbackQuery.id, 'Введіть дані техніки вручну.');
    await beginManualEquipmentFlow(draft, chatId);
    return;
  }

  if (data?.startsWith(TELEGRAM_CALLBACKS.vehiclePrefix)) {
    const draft = await getDraft(telegramUserId);
    const vehicleId = data.slice(TELEGRAM_CALLBACKS.vehiclePrefix.length);

    if (!draft || draft.step !== 'SELECT_VEHICLE') {
      await answerCallbackQuery(callbackQuery.id, 'Список техніки вже неактуальний.');
      return;
    }

    const clientProfile = draft.phone ? await findClientProfileByPhone(draft.phone) : null;
    const vehicle = clientProfile && vehicleId ? await findAvailableVehicle(clientProfile, vehicleId) : null;

    if (!vehicle) {
      await answerCallbackQuery(callbackQuery.id, 'Ця техніка більше недоступна. Оновлюємо список.');
      await openVehicleSelectionOrManual(draft, chatId);
      return;
    }

    await prisma.telegramDraftRequest.update({
      where: { telegramUserId },
      data: {
        step: 'ASK_DESCRIPTION',
        equipmentType: vehicle.type,
        fileMetadata: mergeDraftMetadata(draft.fileMetadata, {
          vehicleId: vehicle.id,
          manufacturer: vehicle.manufacturer,
          model: vehicle.model,
          vehicleYear: vehicle.year,
          vinOrSerial: vehicle.vinOrSerial
        })
      }
    });
    await answerCallbackQuery(callbackQuery.id, 'Техніку обрано.');
    await sendDescriptionPrompt(chatId);
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

  const claim = await prisma.telegramDraftRequest.updateMany({
    where: { id: draft.id, step: 'CONFIRM' },
    data: { step: 'CREATING' }
  });

  if (claim.count !== 1) {
    await answerCallbackQuery(callbackQuery.id, 'Заявка вже обробляється.');
    return;
  }

  try {
    const createdRequest = await createTelegramRequest(draft);
    await answerCallbackQuery(callbackQuery.id, 'Заявку створено.');
    await sendTelegramMessage(
      chatId,
      buildCreatedMessage({
        requestNumber: createdRequest.requestNumber,
        statusUrl: buildStatusUrl(createdRequest.publicStatusToken)
      }),
      { replyMarkup: createdRequestKeyboard }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Selected vehicle is no longer available.') {
      await answerCallbackQuery(callbackQuery.id, 'Обрана техніка більше недоступна.');
      await openVehicleSelectionOrManual(draft, chatId);
      return;
    }

    if (error instanceof Error && error.message === 'Registered client profile is required for Telegram request.') {
      await prisma.telegramDraftRequest.updateMany({
        where: { telegramUserId, step: 'CREATING' },
        data: { step: 'AWAITING_REGISTRATION' }
      });
      await answerCallbackQuery(callbackQuery.id, 'Потрібен клієнтський кабінет.');
      await showRegistrationRequired({
        telegramUserId,
        chatId: toStringId(chatId),
        phone: draft.phone ?? '',
        contactName: draft.contactName
      });
      return;
    }

    await prisma.telegramDraftRequest.updateMany({
      where: { telegramUserId, step: 'CREATING' },
      data: { step: 'CONFIRM' }
    });
    throw error;
  }
}

async function handleMessage(message: TelegramMessage) {
  const telegramUserId = toStringId(message.from?.id ?? message.chat.id);
  const text = getMessageText(message);

  if (text === '/start') {
    const existingDraft = await getDraft(telegramUserId);

    if (existingDraft?.step === 'AWAITING_REGISTRATION' && await resumeAfterRegistration(existingDraft)) {
      return;
    }

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
