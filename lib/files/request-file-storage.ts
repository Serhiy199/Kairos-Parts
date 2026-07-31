import 'server-only';

import { createHash } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import type {
  RequestFileStorageProvider,
  RequestFileStorageStatus
} from '@prisma/client';

import {
  deleteRequestFileFromCloudinary,
  downloadRequestFileBytesFromCloudinary
} from '@/lib/files/cloudinary-request-files';
import {
  MAX_OCR_FILE_BYTES,
  isOcrCompatibleMimeType,
  validateRequestFileBuffer
} from '@/lib/files/request-file-validation';
import {
  isSafeStorageKey,
  readLocalUpload,
  resolveUploadPath
} from '@/lib/files/secure-local-file';
import { prisma } from '@/lib/prisma';

export type RequestFileStorageErrorCode =
  | 'REQUEST_NOT_FOUND'
  | 'REQUEST_ACCESS_DENIED'
  | 'REQUEST_FILE_NOT_FOUND'
  | 'REQUEST_FILE_STORAGE_UNAVAILABLE'
  | 'REQUEST_FILE_LEGACY_MISSING'
  | 'REQUEST_FILE_CLOUDINARY_FETCH_FAILED'
  | 'REQUEST_FILE_STORAGE_TIMEOUT'
  | 'REQUEST_FILE_TOO_LARGE'
  | 'REQUEST_FILE_MIME_NOT_SUPPORTED_FOR_OCR'
  | 'PDF_OCR_NOT_SUPPORTED'
  | 'REQUEST_FILE_INTEGRITY_FAILED'
  | 'REQUEST_FILE_DELETE_FAILED';

export class RequestFileStorageError extends Error {
  constructor(
    public readonly code: RequestFileStorageErrorCode,
    message: string,
    public readonly httpStatus = 500
  ) {
    super(message);
    this.name = 'RequestFileStorageError';
  }
}

export type RequestFileActor =
  | { type: 'CRM'; userId: string }
  | {
      type: 'CLIENT';
      userId: string;
      clientProfileId: string;
      companyId: string | null;
    };

type RequestFileStorageMetadata = {
  id: string;
  requestId: string;
  fileName: string;
  storageKey: string;
  mimeType: string;
  size: number;
  storageProvider: RequestFileStorageProvider;
  storageStatus: RequestFileStorageStatus;
  storagePublicId: string | null;
  storageResourceType: string | null;
  storageDeliveryType: string | null;
  storageVersion: string | null;
  storageFormat: string | null;
  storageChecksumSha256: string | null;
};

function clientRequestWhere(actor: Extract<RequestFileActor, { type: 'CLIENT' }>) {
  if (actor.companyId) {
    return {
      OR: [
        { companyId: actor.companyId },
        { clientId: actor.clientProfileId, companyId: null }
      ]
    };
  }
  return { clientId: actor.clientProfileId };
}

function missingFileMessage() {
  return 'Файл недоступний. Ймовірно, він був завантажений у старе локальне сховище та не зберігся. Завантажте файл повторно.';
}

export function requestFileContentDisposition(fileName: string, inline: boolean) {
  const safeName = fileName.replace(/[\u0000-\u001f\u007f"/\\]/g, '_').trim() || 'request-file';
  const asciiFallback = safeName.replace(/[^\x20-\x7e]/g, '_');
  return `${inline ? 'inline' : 'attachment'}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;
}

export async function loadRequestFileBytes(
  file: RequestFileStorageMetadata,
  options: { maxBytes?: number } = {}
) {
  if (file.storageStatus === 'MISSING') {
    throw new RequestFileStorageError(
      file.storageProvider === 'LEGACY_LOCAL'
        ? 'REQUEST_FILE_LEGACY_MISSING'
        : 'REQUEST_FILE_STORAGE_UNAVAILABLE',
      missingFileMessage(),
      410
    );
  }

  if (file.storageProvider === 'CLOUDINARY') {
    if (
      file.storageStatus !== 'AVAILABLE'
      || !file.storagePublicId
      || !['image', 'raw'].includes(file.storageResourceType ?? '')
      || file.storageDeliveryType !== 'authenticated'
    ) {
      throw new RequestFileStorageError(
        'REQUEST_FILE_STORAGE_UNAVAILABLE',
        'Файл тимчасово недоступний.',
        503
      );
    }

    const downloaded = await downloadRequestFileBytesFromCloudinary({
      publicId: file.storagePublicId,
      resourceType: file.storageResourceType as 'image' | 'raw',
      deliveryType: 'authenticated',
      version: file.storageVersion,
      format: file.storageFormat
    }, { maxBytes: options.maxBytes });

    if (!downloaded.ok) {
      const code = downloaded.code === 'REQUEST_FILE_STORAGE_TIMEOUT'
        ? 'REQUEST_FILE_STORAGE_TIMEOUT'
        : downloaded.code === 'REQUEST_FILE_TOO_LARGE'
          ? 'REQUEST_FILE_TOO_LARGE'
          : 'REQUEST_FILE_CLOUDINARY_FETCH_FAILED';
      throw new RequestFileStorageError(
        code,
        code === 'REQUEST_FILE_TOO_LARGE'
          ? 'Файл перевищує дозволений розмір обробки.'
          : 'Не вдалося отримати файл зі сховища.',
        code === 'REQUEST_FILE_TOO_LARGE' ? 413 : 503
      );
    }

    if (file.storageChecksumSha256) {
      const actualChecksum = createHash('sha256').update(downloaded.buffer).digest('hex');
      if (actualChecksum !== file.storageChecksumSha256) {
        throw new RequestFileStorageError(
          'REQUEST_FILE_INTEGRITY_FAILED',
          'Перевірка цілісності файла не пройдена.',
          503
        );
      }
    }
    return downloaded.buffer;
  }

  if (!isSafeStorageKey(file.storageKey)) {
    throw new RequestFileStorageError(
      'REQUEST_FILE_LEGACY_MISSING',
      missingFileMessage(),
      410
    );
  }
  const localFile = await readLocalUpload(file.storageKey);
  if (!localFile.ok) {
    throw new RequestFileStorageError(
      'REQUEST_FILE_LEGACY_MISSING',
      missingFileMessage(),
      410
    );
  }
  if (options.maxBytes !== undefined && localFile.buffer.byteLength > options.maxBytes) {
    throw new RequestFileStorageError(
      'REQUEST_FILE_TOO_LARGE',
      'Файл перевищує дозволений розмір обробки.',
      413
    );
  }
  return localFile.buffer;
}

export async function loadRequestFileForProcessing(input: {
  actor: RequestFileActor;
  requestId: string;
  fileId: string;
}) {
  const file = await prisma.requestFile.findFirst({
    where: {
      id: input.fileId,
      requestId: input.requestId,
      ...(input.actor.type === 'CLIENT'
        ? { request: clientRequestWhere(input.actor) }
        : {})
    },
    select: {
      id: true,
      requestId: true,
      fileName: true,
      storageKey: true,
      mimeType: true,
      size: true,
      storageProvider: true,
      storageStatus: true,
      storagePublicId: true,
      storageResourceType: true,
      storageDeliveryType: true,
      storageVersion: true,
      storageFormat: true,
      storageChecksumSha256: true
    }
  });
  if (!file) {
    throw new RequestFileStorageError(
      'REQUEST_FILE_NOT_FOUND',
      'Файл заявки не знайдено.',
      404
    );
  }
  if (file.size > MAX_OCR_FILE_BYTES) {
    throw new RequestFileStorageError(
      'REQUEST_FILE_TOO_LARGE',
      'Файл перевищує максимальний розмір для OCR.',
      413
    );
  }

  const buffer = await loadRequestFileBytes(file, { maxBytes: MAX_OCR_FILE_BYTES });
  const validation = validateRequestFileBuffer({
    fileName: file.fileName,
    mimeType: file.mimeType,
    buffer
  });
  if (!validation.ok) {
    throw new RequestFileStorageError(
      'REQUEST_FILE_INTEGRITY_FAILED',
      'Формат або вміст файла не пройшов перевірку.',
      422
    );
  }
  if (validation.file.mimeType === 'application/pdf') {
    throw new RequestFileStorageError(
      'PDF_OCR_NOT_SUPPORTED',
      'OCR для PDF поки не підтримується. Завантажте зображення сторінки у форматі JPG, PNG або WebP.',
      422
    );
  }
  if (!isOcrCompatibleMimeType(validation.file.mimeType)) {
    throw new RequestFileStorageError(
      'REQUEST_FILE_MIME_NOT_SUPPORTED_FOR_OCR',
      'OCR підтримує лише JPG, PNG або WebP.',
      422
    );
  }

  return {
    buffer,
    mimeType: validation.file.mimeType,
    originalName: file.fileName,
    sizeBytes: buffer.byteLength,
    storageProvider: file.storageProvider
  };
}

export async function deleteRequestFileAsset(file: RequestFileStorageMetadata) {
  try {
    if (file.storageProvider === 'CLOUDINARY') {
      if (
        !file.storagePublicId
        || !['image', 'raw'].includes(file.storageResourceType ?? '')
        || file.storageDeliveryType !== 'authenticated'
      ) {
        throw new Error('Cloudinary metadata is incomplete.');
      }
      return await deleteRequestFileFromCloudinary({
        publicId: file.storagePublicId,
        resourceType: file.storageResourceType as 'image' | 'raw',
        deliveryType: 'authenticated',
        version: file.storageVersion,
        format: file.storageFormat
      });
    }

    const localPath = isSafeStorageKey(file.storageKey)
      ? resolveUploadPath(file.storageKey)
      : null;
    if (!localPath) {
      return { deleted: false, alreadyMissing: true };
    }
    await unlink(localPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
    return { deleted: true, alreadyMissing: false };
  } catch {
    throw new RequestFileStorageError(
      'REQUEST_FILE_DELETE_FAILED',
      'Не вдалося видалити файл зі сховища.',
      503
    );
  }
}
