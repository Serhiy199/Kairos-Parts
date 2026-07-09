import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { getUploadRoot } from './local-storage';

export function isSafeStorageKey(storageKey: string | null | undefined) {
  return Boolean(storageKey) && !path.isAbsolute(storageKey ?? '') && !(storageKey ?? '').split(/[\\/]/).includes('..');
}

export function resolveUploadPath(storageKey: string) {
  const uploadsRoot = getUploadRoot();
  const filePath = path.resolve(uploadsRoot, storageKey);

  if (!filePath.startsWith(`${uploadsRoot}${path.sep}`)) {
    return null;
  }

  return filePath;
}

export function contentDispositionFileName(fileName: string) {
  return fileName.replace(/["\r\n]/g, '_');
}

export async function readLocalUpload(storageKey: string) {
  const filePath = resolveUploadPath(storageKey);

  if (!filePath) {
    return { ok: false as const, status: 'invalid_storage_key' as const };
  }

  try {
    await stat(filePath);
    return { ok: true as const, buffer: await readFile(filePath) };
  } catch {
    return { ok: false as const, status: 'file_not_available' as const };
  }
}
