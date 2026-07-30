import 'server-only';

import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import {
  loadRequestFileForProcessing,
  RequestFileStorageError,
  type RequestFileActor
} from '@/lib/files/request-file-storage';
import { prisma } from '@/lib/prisma';

const OCR_TIMEOUT_MS = 60_000;
let ocrQueue: Promise<void> = Promise.resolve();

export class OcrServiceError extends Error {
  constructor(
    public readonly code: 'OCR_ENGINE_FAILED' | 'OCR_TIMEOUT',
    message: string
  ) {
    super(message);
    this.name = 'OcrServiceError';
  }
}

function extractPartLikeToken(text: string) {
  const match = text.match(/\b[A-Z0-9][A-Z0-9._/-]{4,}\b/i);
  return match?.[0] ?? null;
}

function withProcessOcrQueue<T>(task: () => Promise<T>) {
  const run = ocrQueue.then(task, task);
  ocrQueue = run.then(() => undefined, () => undefined);
  return run;
}

async function recognizeImage(buffer: Buffer) {
  return withProcessOcrQueue(async () => {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng+ukr');
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const timedOut = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new OcrServiceError('OCR_TIMEOUT', 'OCR перевищив дозволений час виконання.'));
        }, OCR_TIMEOUT_MS);
      });
      return await Promise.race([worker.recognize(buffer), timedOut]);
    } finally {
      if (timeout) clearTimeout(timeout);
      await worker.terminate().catch(() => undefined);
    }
  });
}

async function auditOcr(input: {
  actor: RequestFileActor;
  requestId: string;
  fileId: string;
  action: 'OCR_STARTED' | 'OCR_COMPLETED' | 'OCR_FAILED';
  errorCode?: string;
}) {
  const request = await prisma.request.findUnique({
    where: { id: input.requestId },
    select: { companyId: true }
  });
  await writeAuditLog(prisma, {
    actor: auditUserActor(input.actor.userId),
    companyId: request?.companyId,
    entityType: 'REQUEST_FILE',
    entityId: input.fileId,
    action: input.action,
    category: input.action === 'OCR_FAILED' ? 'TECHNICAL' : 'STANDARD',
    metadata: {
      requestId: input.requestId,
      fileId: input.fileId,
      ...(input.errorCode ? { errorCode: input.errorCode } : {})
    },
    allowedFields: { metadata: ['requestId', 'fileId', 'errorCode'] }
  });
}

export async function runOcrForRequestFile(input: {
  actor: RequestFileActor;
  requestId: string;
  fileId: string;
}) {
  await auditOcr({ ...input, action: 'OCR_STARTED' });

  let loaded: Awaited<ReturnType<typeof loadRequestFileForProcessing>>;
  try {
    loaded = await loadRequestFileForProcessing(input);
  } catch (error) {
    await auditOcr({
      ...input,
      action: 'OCR_FAILED',
      errorCode: error instanceof RequestFileStorageError
        ? error.code
        : 'REQUEST_FILE_STORAGE_UNAVAILABLE'
    });
    throw error;
  }

  try {
    const result = await recognizeImage(loaded.buffer);
    const text = result.data.text.trim() || 'OCR не знайшов текст на зображенні.';
    const possibleToken = extractPartLikeToken(text);

    return await prisma.$transaction(async (tx) => {
      const ocrResult = await tx.oCRResult.create({
        data: {
          requestId: input.requestId,
          fileId: input.fileId,
          provider: 'TESSERACT',
          rawText: text,
          confidence: result.data.confidence,
          possiblePartNumber: possibleToken,
          possibleSerialNumber: possibleToken
        }
      });
      const request = await tx.request.findUnique({
        where: { id: input.requestId },
        select: { companyId: true }
      });
      await writeAuditLog(tx, {
        actor: auditUserActor(input.actor.userId),
        companyId: request?.companyId,
        entityType: 'REQUEST_FILE',
        entityId: input.fileId,
        action: 'OCR_COMPLETED',
        category: 'STANDARD',
        metadata: {
          requestId: input.requestId,
          fileId: input.fileId,
          provider: 'TESSERACT'
        },
        allowedFields: { metadata: ['requestId', 'fileId', 'provider'] }
      });
      return ocrResult;
    });
  } catch (error) {
    const serviceError = error instanceof OcrServiceError
      ? error
      : new OcrServiceError('OCR_ENGINE_FAILED', 'Не вдалося розпізнати текст у файлі.');
    await auditOcr({
      ...input,
      action: 'OCR_FAILED',
      errorCode: serviceError.code
    });
    throw serviceError;
  }
}

export async function updateOcrCorrection(input: {
  actor: RequestFileActor;
  requestId: string;
  ocrResultId: string;
  correctedText: string;
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.oCRResult.findFirst({
      where: {
        id: input.ocrResultId,
        requestId: input.requestId
      },
      select: {
        id: true,
        fileId: true,
        request: { select: { companyId: true } }
      }
    });
    if (!existing) {
      throw new Error('OCR result was not found.');
    }
    const updated = await tx.oCRResult.update({
      where: { id: existing.id },
      data: { correctedText: input.correctedText }
    });
    await writeAuditLog(tx, {
      actor: auditUserActor(input.actor.userId),
      companyId: existing.request.companyId,
      entityType: 'REQUEST_FILE',
      entityId: existing.fileId ?? existing.id,
      action: 'OCR_CORRECTED',
      category: 'STANDARD',
      metadata: {
        requestId: input.requestId,
        fileId: existing.fileId,
        ocrResultId: existing.id
      },
      allowedFields: { metadata: ['requestId', 'fileId', 'ocrResultId'] }
    });
    return updated;
  });
}
