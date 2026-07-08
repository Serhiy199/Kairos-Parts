import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type SavedUpload = {
  fileName: string;
  storageKey: string;
  fileUrl?: string;
  mimeType: string;
  size: number;
};

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function saveRequestFileLocal(requestId: string, file: File): Promise<SavedUpload> {
  const uploadRoot = path.join(process.cwd(), 'uploads', 'request-files', requestId);
  await mkdir(uploadRoot, { recursive: true });

  const safeName = `${Date.now()}-${sanitizeFileName(file.name)}`;
  const storageKey = path.join('request-files', requestId, safeName).replace(/\\/g, '/');
  const targetPath = path.join(uploadRoot, safeName);
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(targetPath, buffer);

  return {
    fileName: file.name,
    storageKey,
    mimeType: file.type || 'application/octet-stream',
    size: file.size
  };
}

export async function saveRequestFileBufferLocal(
  requestId: string,
  input: {
    fileName: string;
    buffer: Buffer;
    mimeType?: string;
  }
): Promise<SavedUpload> {
  const uploadRoot = path.join(process.cwd(), 'uploads', 'request-files', requestId);
  await mkdir(uploadRoot, { recursive: true });

  const safeName = `${Date.now()}-${sanitizeFileName(input.fileName)}`;
  const storageKey = path.join('request-files', requestId, safeName).replace(/\\/g, '/');
  const targetPath = path.join(uploadRoot, safeName);

  await writeFile(targetPath, input.buffer);

  return {
    fileName: input.fileName,
    storageKey,
    mimeType: input.mimeType || 'application/octet-stream',
    size: input.buffer.byteLength
  };
}

export async function saveRequestDocumentLocal(requestId: string, file: File): Promise<SavedUpload> {
  const uploadRoot = path.join(process.cwd(), 'uploads', 'request-documents', requestId);
  await mkdir(uploadRoot, { recursive: true });

  const safeName = `${Date.now()}-${sanitizeFileName(file.name)}`;
  const storageKey = path.join('request-documents', requestId, safeName).replace(/\\/g, '/');
  const targetPath = path.join(uploadRoot, safeName);
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(targetPath, buffer);

  return {
    fileName: file.name,
    storageKey,
    mimeType: file.type || 'application/octet-stream',
    size: file.size
  };
}
