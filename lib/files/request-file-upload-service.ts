import 'server-only';

import type { Prisma, RequestFileSource } from '@prisma/client';

import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import {
  deleteRequestFileFromCloudinary,
  uploadRequestFileToCloudinary,
  type CloudinaryRequestFileUpload
} from '@/lib/files/cloudinary-request-files';
import {
  assertRequestFileQuota,
  validateRequestFileBuffer,
  type RequestFileBufferInput,
  type ValidatedRequestFile
} from '@/lib/files/request-file-validation';
import { prisma } from '@/lib/prisma';

export type RequestFileUploadActor = {
  type: 'CLIENT' | 'TELEGRAM';
  userId: string;
  clientProfileId: string;
  companyId: string | null;
};

export class RequestFileUploadError extends Error {
  constructor(
    public readonly code:
      | 'REQUEST_ACCESS_DENIED'
      | 'REQUEST_FILE_VALIDATION_FAILED'
      | 'REQUEST_FILE_UPLOAD_FAILED'
      | 'REQUEST_FILE_DB_SAVE_FAILED'
      | 'REQUEST_FILE_ASSET_CLEANUP_FAILED',
    message: string,
    public readonly cleanupFailed = false
  ) {
    super(message);
    this.name = 'RequestFileUploadError';
  }
}

type UploadedFile = {
  file: ValidatedRequestFile;
  asset: CloudinaryRequestFileUpload;
};

function requestFileSource(actor: RequestFileUploadActor): RequestFileSource {
  return actor.type === 'TELEGRAM' ? 'TELEGRAM' : 'CLIENT_FORM';
}

function requestActorWhere(actor: RequestFileUploadActor): Prisma.RequestWhereInput {
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

async function cleanupUploadedFiles(uploaded: readonly UploadedFile[]) {
  const results = await Promise.allSettled(
    uploaded.map(({ asset }) => deleteRequestFileFromCloudinary({
      publicId: asset.publicId,
      resourceType: asset.resourceType,
      deliveryType: asset.deliveryType,
      version: asset.version,
      format: asset.format
    }))
  );
  return results.filter((result) => result.status === 'rejected').length;
}

export async function requestFileInputFromFile(file: File): Promise<RequestFileBufferInput> {
  return {
    fileName: file.name,
    mimeType: file.type,
    buffer: Buffer.from(await file.arrayBuffer())
  };
}

export async function uploadRequestFilesForActor(input: {
  actor: RequestFileUploadActor;
  requestId: string;
  files: readonly RequestFileBufferInput[];
}) {
  if (input.files.length === 0) return [];

  const request = await prisma.request.findFirst({
    where: { id: input.requestId, ...requestActorWhere(input.actor) },
    select: { id: true, companyId: true }
  });
  if (!request) {
    throw new RequestFileUploadError(
      'REQUEST_ACCESS_DENIED',
      'Заявку не знайдено або доступ до неї заборонено.'
    );
  }

  const validatedFiles: ValidatedRequestFile[] = [];
  for (const candidate of input.files) {
    const validation = validateRequestFileBuffer(candidate);
    if (!validation.ok) {
      throw new RequestFileUploadError(
        'REQUEST_FILE_VALIDATION_FAILED',
        validation.message
      );
    }
    validatedFiles.push(validation.file);
  }

  const existing = await prisma.requestFile.aggregate({
    where: { requestId: input.requestId },
    _count: { _all: true },
    _sum: { size: true }
  });
  try {
    assertRequestFileQuota({
      existingCount: existing._count._all,
      existingBytes: existing._sum.size ?? 0,
      files: validatedFiles
    });
  } catch (error) {
    throw new RequestFileUploadError(
      'REQUEST_FILE_VALIDATION_FAILED',
      error instanceof Error ? error.message : 'Перевищено ліміт файлів заявки.'
    );
  }

  const uploaded: UploadedFile[] = [];
  try {
    for (const file of validatedFiles) {
      const asset = await uploadRequestFileToCloudinary({
        requestId: input.requestId,
        fileName: file.fileName,
        mimeType: file.mimeType,
        buffer: file.buffer
      });
      if (asset.bytes !== file.size) {
        throw new Error('Cloudinary byte count does not match the uploaded file.');
      }
      uploaded.push({ file, asset });
    }
  } catch (error) {
    const cleanupFailures = await cleanupUploadedFiles(uploaded);
    console.error('Request file Cloudinary upload failed', {
      requestId: input.requestId,
      uploadedCount: uploaded.length,
      cleanupFailures,
      reason: error instanceof Error ? error.name : 'unknown'
    });
    throw new RequestFileUploadError(
      cleanupFailures > 0
        ? 'REQUEST_FILE_ASSET_CLEANUP_FAILED'
        : 'REQUEST_FILE_UPLOAD_FAILED',
      'Не вдалося зберегти файли заявки.',
      cleanupFailures > 0
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const authorizedRequest = await tx.request.findFirst({
        where: { id: input.requestId, ...requestActorWhere(input.actor) },
        select: { id: true, companyId: true }
      });
      if (!authorizedRequest) {
        throw new RequestFileUploadError(
          'REQUEST_ACCESS_DENIED',
          'Заявку не знайдено або доступ до неї заборонено.'
        );
      }

      const current = await tx.requestFile.aggregate({
        where: { requestId: input.requestId },
        _count: { _all: true },
        _sum: { size: true }
      });
      assertRequestFileQuota({
        existingCount: current._count._all,
        existingBytes: current._sum.size ?? 0,
        files: uploaded.map(({ file }) => file)
      });

      const created = [];
      for (const { file, asset } of uploaded) {
        const requestFile = await tx.requestFile.create({
          data: {
            requestId: input.requestId,
            fileName: file.fileName,
            storageKey: asset.storageKey,
            fileUrl: null,
            mimeType: file.mimeType,
            size: file.size,
            storageProvider: 'CLOUDINARY',
            storageStatus: 'AVAILABLE',
            storagePublicId: asset.publicId,
            storageResourceType: asset.resourceType,
            storageDeliveryType: asset.deliveryType,
            storageVersion: asset.version,
            storageFormat: asset.format,
            storageChecksumSha256: asset.checksumSha256,
            source: requestFileSource(input.actor)
          }
        });
        await writeAuditLog(tx, {
          actor: auditUserActor(input.actor.userId),
          companyId: authorizedRequest.companyId,
          entityType: 'REQUEST_FILE',
          entityId: requestFile.id,
          entityLabel: requestFile.fileName,
          action: 'REQUEST_FILE_UPLOADED',
          category: 'STANDARD',
          metadata: {
            requestId: input.requestId,
            fileId: requestFile.id,
            storageProvider: 'CLOUDINARY',
            mimeType: requestFile.mimeType,
            sizeBytes: requestFile.size,
            source: requestFile.source
          },
          allowedFields: {
            metadata: [
              'requestId',
              'fileId',
              'storageProvider',
              'mimeType',
              'sizeBytes',
              'source'
            ]
          }
        });
        created.push(requestFile);
      }
      return created;
    });
  } catch (error) {
    const cleanupFailures = await cleanupUploadedFiles(uploaded);
    console.error('Request file database save failed after Cloudinary upload', {
      requestId: input.requestId,
      uploadedCount: uploaded.length,
      cleanupFailures,
      reason: error instanceof Error ? error.name : 'unknown'
    });
    throw new RequestFileUploadError(
      cleanupFailures > 0
        ? 'REQUEST_FILE_ASSET_CLEANUP_FAILED'
        : 'REQUEST_FILE_DB_SAVE_FAILED',
      'Не вдалося зберегти метадані файлів заявки.',
      cleanupFailures > 0
    );
  }
}
