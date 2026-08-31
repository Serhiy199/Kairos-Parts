import 'server-only';

import { Prisma } from '@prisma/client';

import type { AuditRequestContext } from '@/lib/audit-log/contracts';
import { auditAnonymousActor, auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import {
  RequestFileUploadError,
  requestFileInputFromFile,
  uploadRequestFilesForActor
} from '@/lib/files/request-file-upload-service';
import { prisma } from '@/lib/prisma';
import type { RequestSubmitIdentity } from '@/lib/requests/identity';
import { generatePublicStatusToken } from '@/lib/requests/identifiers';
import type { ParsedRequestInput } from '@/lib/requests/validation';
import { notifyNewPartsRequest } from '@/lib/staff-telegram/notifications';
import { validateEquipmentTaxonomySelection } from '@/lib/vehicles/taxonomy';
import { EQUIPMENT_TAXONOMY_REQUEST_FIELDS_ENABLED } from '@/lib/features/equipment-taxonomy';

export class RequestCreationError extends Error {
  constructor(
    readonly code:
      | 'VEHICLE_ACCESS_DENIED'
      | 'TAXONOMY_INVALID'
      | 'IDEMPOTENCY_CONFLICT'
      | 'FILE_UPLOAD_FAILED',
    message: string,
    readonly statusCode: 400 | 409 | 503 = 400
  ) {
    super(message);
    this.name = 'RequestCreationError';
  }
}

type CreateRequestInput = {
  identity: RequestSubmitIdentity;
  parsed: ParsedRequestInput;
  requestContext?: AuditRequestContext;
};

type RequestCreationDependencies = {
  uploadFiles?: typeof uploadRequestFilesForActor;
  notifyManager?: typeof notifyNewPartsRequest;
};

const resultSelect = {
  id: true,
  requestNumber: true,
  publicStatusToken: true,
  source: true,
  status: true,
  clientId: true,
  companyId: true,
  guestName: true,
  guestPhone: true,
  guestEmail: true,
  companyName: true,
  manufacturerName: true,
  vehicleId: true,
  equipmentType: true,
  model: true,
  vehicleYear: true,
  vinOrSerial: true,
  description: true,
  files: { select: { id: true, fileName: true, mimeType: true, size: true } }
} satisfies Prisma.RequestSelect;

type RequestResult = Prisma.RequestGetPayload<{ select: typeof resultSelect }>;

function buildDescription(description: string, comment?: string) {
  return comment ? `${description}\n\nКоментар клієнта:\n${comment}` : description;
}

function intentMatches(
  existing: RequestResult,
  input: CreateRequestInput,
  resolved: { manufacturerName: string; description: string }
) {
  const companyName = input.identity.type === 'GUEST'
    ? input.parsed.companyName
    : input.parsed.companyName ?? input.parsed.contactName;
  const identityMatches = input.identity.type === 'GUEST'
    ? existing.source === 'WEBSITE'
      && existing.clientId === null
      && existing.companyId === null
      && existing.guestName === input.parsed.contactName
      && existing.guestPhone === input.parsed.phone
      && existing.guestEmail === input.parsed.email
    : existing.source === 'CLIENT_DASHBOARD'
      && existing.clientId === input.identity.access.clientProfileId
      && existing.companyId === input.identity.access.companyId;

  return identityMatches
    && existing.companyName === companyName
    && existing.manufacturerName === resolved.manufacturerName
    && existing.vehicleId === (input.identity.type === 'CLIENT' ? input.parsed.vehicleId ?? null : null)
    && existing.equipmentType === input.parsed.equipmentType
    && existing.model === input.parsed.model
    && existing.vehicleYear === input.parsed.vehicleYear
    && existing.vinOrSerial === input.parsed.vinOrSerial
    && existing.description === resolved.description;
}

async function findIdempotentRequest(idempotencyKey: string) {
  return prisma.request.findUnique({ where: { idempotencyKey }, select: resultSelect });
}

async function cleanupRequestAfterUploadFailure(requestId: string) {
  await prisma.$transaction([
    prisma.auditLog.deleteMany({
      where: { entityType: 'REQUEST', entityId: requestId, action: 'REQUEST_CREATED' }
    }),
    prisma.request.deleteMany({ where: { id: requestId } })
  ]).catch((cleanupError) => {
    console.error('Request cleanup failed after file upload failure.', {
      requestId,
      errorType: cleanupError instanceof Error ? cleanupError.name : 'UnknownError'
    });
  });
}

export async function createPartsRequest(
  input: CreateRequestInput,
  dependencies: RequestCreationDependencies = {}
) {
  const uploadFiles = dependencies.uploadFiles ?? uploadRequestFilesForActor;
  const notifyManager = dependencies.notifyManager ?? notifyNewPartsRequest;
  let equipmentType = input.parsed.equipmentType;
  let manufacturerId: string | null = null;
  let manufacturerName = input.parsed.manufacturer;

  if (EQUIPMENT_TAXONOMY_REQUEST_FIELDS_ENABLED) {
    const taxonomy = await validateEquipmentTaxonomySelection({ equipmentType, manufacturer: manufacturerName });
    if (!taxonomy.ok) {
      throw new RequestCreationError('TAXONOMY_INVALID', taxonomy.message);
    }
    equipmentType = taxonomy.equipmentType.name;
    manufacturerId = taxonomy.manufacturer.id;
    manufacturerName = taxonomy.manufacturer.name;
  }

  const description = buildDescription(input.parsed.description, input.parsed.comment);
  const resolved = { manufacturerName, description };
  const existing = await findIdempotentRequest(input.parsed.idempotencyKey);
  if (existing) {
    if (!intentMatches(existing, input, resolved)) {
      throw new RequestCreationError(
        'IDEMPOTENCY_CONFLICT',
        'Цей ключ надсилання вже використано для іншої заявки.',
        409
      );
    }
    return { request: existing, createdNew: false };
  }

  let vehicleId: string | null = null;
  if (input.identity.type === 'CLIENT' && input.parsed.vehicleId) {
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: input.parsed.vehicleId,
        ...(input.identity.access.companyId
          ? {
              OR: [
                { companyId: input.identity.access.companyId, clientId: null },
                { clientId: input.identity.access.clientProfileId, companyId: null }
              ]
            }
          : { clientId: input.identity.access.clientProfileId, companyId: null })
      },
      select: { id: true }
    });
    if (!vehicle) {
      throw new RequestCreationError('VEHICLE_ACCESS_DENIED', 'Обрану техніку не знайдено або доступ до неї заборонено.');
    }
    vehicleId = vehicle.id;
  }

  const publicStatusToken = generatePublicStatusToken();
  let created: RequestResult;
  try {
    created = await prisma.$transaction(async (tx) => {
      const request = await tx.request.create({
        data: {
          idempotencyKey: input.parsed.idempotencyKey,
          publicStatusToken,
          source: input.identity.type === 'GUEST' ? 'WEBSITE' : 'CLIENT_DASHBOARD',
          status: 'NEW',
          clientId: input.identity.type === 'CLIENT' ? input.identity.access.clientProfileId : null,
          companyId: input.identity.type === 'CLIENT' ? input.identity.access.companyId : null,
          guestName: input.identity.type === 'GUEST' ? input.parsed.contactName : null,
          guestPhone: input.identity.type === 'GUEST' ? input.parsed.phone : null,
          guestEmail: input.identity.type === 'GUEST' ? input.parsed.email : null,
          companyName: input.identity.type === 'GUEST'
            ? input.parsed.companyName
            : input.parsed.companyName ?? input.parsed.contactName,
          categoryId: null,
          subcategoryId: null,
          manufacturerId,
          manufacturerName,
          vehicleId,
          equipmentType,
          model: input.parsed.model,
          vehicleYear: input.parsed.vehicleYear,
          vinOrSerial: input.parsed.vinOrSerial,
          description
        },
        select: resultSelect
      });
      await writeAuditLog(tx, {
        actor: input.identity.type === 'GUEST'
          ? auditAnonymousActor()
          : auditUserActor(input.identity.userId),
        companyId: request.companyId,
        entityType: 'REQUEST',
        entityId: request.id,
        entityLabel: `Заявка ${request.requestNumber}`,
        action: 'REQUEST_CREATED',
        category: 'STANDARD',
        metadata: { source: request.source },
        allowedFields: { metadata: ['source'] },
        requestContext: input.requestContext
      });
      return request;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await findIdempotentRequest(input.parsed.idempotencyKey);
      if (raced && intentMatches(raced, input, resolved)) {
        return { request: raced, createdNew: false };
      }
      throw new RequestCreationError('IDEMPOTENCY_CONFLICT', 'Цей ключ надсилання вже використано для іншої заявки.', 409);
    }
    throw error;
  }

  try {
    const fileInputs = await Promise.all(input.parsed.files.map(requestFileInputFromFile));
    const savedFiles = await uploadFiles({
      actor: input.identity.type === 'GUEST'
        ? { type: 'WEBSITE_GUEST', publicStatusToken }
        : {
            type: 'CLIENT',
            userId: input.identity.userId,
            clientProfileId: input.identity.access.clientProfileId,
            companyId: input.identity.access.companyId
          },
      requestId: created.id,
      files: fileInputs,
      requestContext: input.requestContext
    });
    created = { ...created, files: savedFiles.map(({ id, fileName, mimeType, size }) => ({ id, fileName, mimeType, size })) };
  } catch (error) {
    await cleanupRequestAfterUploadFailure(created.id);
    if (error instanceof RequestFileUploadError) {
      throw new RequestCreationError('FILE_UPLOAD_FAILED', error.message, error.code === 'REQUEST_FILE_VALIDATION_FAILED' ? 400 : 503);
    }
    throw error;
  }

  try {
    await notifyManager({
      id: created.id,
      requestNumber: created.requestNumber,
      companyName: input.parsed.companyName,
      contactName: input.parsed.contactName,
      contactPhone: input.parsed.phone,
      contactEmail: input.parsed.email,
      equipment: [equipmentType, manufacturerName, input.parsed.model].filter(Boolean).join(' · ') || null,
      description: input.parsed.description,
      source: input.identity.type === 'GUEST' ? 'WEBSITE' : 'CLIENT_DASHBOARD'
    });
  } catch (error) {
    console.error('Request manager notification failed.', {
      requestId: created.id,
      errorType: error instanceof Error ? error.name : 'UnknownError'
    });
  }

  return { request: created, createdNew: true };
}
