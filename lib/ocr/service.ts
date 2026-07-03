import { access } from 'node:fs/promises';
import path from 'node:path';

import { prisma } from '@/lib/prisma';

function isImageMime(mimeType: string) {
  return mimeType.startsWith('image/');
}

function storageKeyToLocalPath(storageKey: string) {
  return path.join(process.cwd(), 'uploads', storageKey);
}

function extractPartLikeToken(text: string) {
  const match = text.match(/\b[A-Z0-9][A-Z0-9._/-]{4,}\b/i);
  return match?.[0] ?? null;
}

async function pathExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function runOcrForRequestFile(input: { requestId: string; fileId: string }) {
  const file = await prisma.requestFile.findFirst({
    where: {
      id: input.fileId,
      requestId: input.requestId
    }
  });

  if (!file) {
    throw new Error('Request file was not found.');
  }

  if (!isImageMime(file.mimeType)) {
    return prisma.oCRResult.create({
      data: {
        requestId: input.requestId,
        fileId: file.id,
        provider: 'OTHER',
        rawText: 'OCR не виконано: файл не є зображенням.'
      }
    });
  }

  const localPath = storageKeyToLocalPath(file.storageKey);

  if (!(await pathExists(localPath))) {
    return prisma.oCRResult.create({
      data: {
        requestId: input.requestId,
        fileId: file.id,
        provider: 'TESSERACT',
        rawText: 'OCR не виконано: файл недоступний у локальному сховищі. На Vercel потрібне production-safe object storage.',
        confidence: 0
      }
    });
  }

  try {
    const { recognize } = await import('tesseract.js');
    const result = await recognize(localPath, 'eng+ukr');
    const text = result.data.text.trim() || 'OCR не знайшов текст на зображенні.';
    const possibleToken = extractPartLikeToken(text);

    return prisma.oCRResult.create({
      data: {
        requestId: input.requestId,
        fileId: file.id,
        provider: 'TESSERACT',
        rawText: text,
        confidence: result.data.confidence,
        possiblePartNumber: possibleToken,
        possibleSerialNumber: possibleToken
      }
    });
  } catch (error) {
    return prisma.oCRResult.create({
      data: {
        requestId: input.requestId,
        fileId: file.id,
        provider: 'TESSERACT',
        rawText: `OCR failed: ${error instanceof Error ? error.message : 'Unknown OCR error'}`,
        confidence: 0
      }
    });
  }
}

export async function updateOcrCorrection(input: { ocrResultId: string; correctedText: string }) {
  return prisma.oCRResult.update({
    where: { id: input.ocrResultId },
    data: { correctedText: input.correctedText }
  });
}
