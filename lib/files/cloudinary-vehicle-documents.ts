import 'server-only';

import { randomUUID } from 'node:crypto';
import type { UploadApiResponse } from 'cloudinary';

import { getCloudinaryServerClient } from '@/lib/cloudinary/server';
import { sanitizeVehicleDocumentName } from '@/lib/vehicles/documents';

const STORAGE_KEY_PREFIX = 'cloudinary-raw-authenticated:';

export type CloudinaryVehicleDocumentUpload = {
  storageKey: string;
  publicId: string;
  format: string;
  bytes: number;
};

function extensionFor(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;

  const byType: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  };

  return byType[file.type] ?? 'bin';
}

function encodeStorageKey(publicId: string, format: string) {
  return `${STORAGE_KEY_PREFIX}${Buffer.from(JSON.stringify({ publicId, format }), 'utf8').toString('base64url')}`;
}

function parseStorageKey(storageKey: string) {
  if (!storageKey.startsWith(STORAGE_KEY_PREFIX)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(storageKey.slice(STORAGE_KEY_PREFIX.length), 'base64url').toString('utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const value = parsed as { publicId?: unknown; format?: unknown };
    if (typeof value.publicId !== 'string' || !value.publicId || typeof value.format !== 'string' || !value.format) return null;
    return { publicId: value.publicId, format: value.format };
  } catch {
    return null;
  }
}

export async function uploadVehicleDocument(vehicleId: string, file: File): Promise<CloudinaryVehicleDocumentUpload> {
  const client = getCloudinaryServerClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const format = extensionFor(file);

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        folder: `kairos-parts/vehicle-documents/${vehicleId}`,
        public_id: `${randomUUID()}.${format}`,
        resource_type: 'raw',
        type: 'authenticated',
        use_filename: false,
        unique_filename: true,
        overwrite: false,
        filename_override: sanitizeVehicleDocumentName(file.name)
      },
      (error, uploadResult) => {
        if (error || !uploadResult) {
          reject(error ?? new Error('Cloudinary document upload failed.'));
          return;
        }
        resolve(uploadResult);
      }
    );
    stream.end(buffer);
  });

  return {
    publicId: result.public_id,
    format: result.format || format,
    bytes: result.bytes || file.size,
    storageKey: encodeStorageKey(result.public_id, result.format || format)
  };
}

export async function deleteVehicleDocumentAsset(storageKey: string) {
  const asset = parseStorageKey(storageKey);
  if (!asset) throw new Error('Invalid vehicle document storage key.');

  const client = getCloudinaryServerClient();
  const result = await client.uploader.destroy(asset.publicId, {
    resource_type: 'raw',
    type: 'authenticated',
    invalidate: true
  });

  if (!['ok', 'not found'].includes(result.result)) {
    throw new Error('Cloudinary document deletion failed.');
  }
}

export async function cleanupVehicleDocumentAssets(storageKeys: string[]) {
  await Promise.allSettled(storageKeys.map((storageKey) => deleteVehicleDocumentAsset(storageKey)));
}

export async function fetchVehicleDocument(storageKey: string) {
  const asset = parseStorageKey(storageKey);
  if (!asset) return { ok: false as const, status: 'invalid_storage_key' as const };

  const client = getCloudinaryServerClient();
  const url = client.utils.private_download_url(asset.publicId, '', {
    resource_type: 'raw',
    type: 'authenticated',
    expires_at: Math.floor(Date.now() / 1000) + 60
  });

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) return { ok: false as const, status: 'file_not_available' as const };

  return { ok: true as const, buffer: await response.arrayBuffer() };
}

export function vehicleDocumentContentDisposition(fileName: string) {
  const safeName = sanitizeVehicleDocumentName(fileName);
  const asciiFallback = safeName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'document';
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;
}
