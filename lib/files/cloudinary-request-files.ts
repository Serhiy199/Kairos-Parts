import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import type { UploadApiResponse } from 'cloudinary';

import { getCloudinaryServerClient } from '@/lib/cloudinary/server';
import { getUploadMaxSizeBytes } from '@/lib/files/upload-policy';
import { isOcrCompatibleMimeType } from '@/lib/files/request-file-validation';

export type RequestFileCloudinaryResourceType = 'image' | 'raw';

export type CloudinaryRequestFileUpload = {
  storageKey: string;
  publicId: string;
  resourceType: RequestFileCloudinaryResourceType;
  deliveryType: 'authenticated';
  version?: string;
  format?: string;
  bytes: number;
  checksumSha256: string;
};

type CloudinaryRequestFileLocator = {
  publicId: string;
  resourceType: RequestFileCloudinaryResourceType;
  deliveryType: 'authenticated';
  version?: string | null;
  format?: string | null;
};

const STORAGE_KEY_PREFIX = 'cloudinary-request-file:';
const FETCH_TIMEOUT_MS = 15_000;

function extensionWithoutDot(fileName: string) {
  return path.extname(fileName).toLowerCase().replace(/^\./, '');
}

export function requestFileCloudinaryFolder(requestId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(requestId)) {
    throw new Error('Invalid request id for Cloudinary folder.');
  }
  return `kairos-parts/requests/${requestId}/files`;
}

export function encodeRequestFileStorageKey(locator: CloudinaryRequestFileLocator) {
  return `${STORAGE_KEY_PREFIX}${Buffer.from(JSON.stringify(locator), 'utf8').toString('base64url')}`;
}

export async function uploadRequestFileToCloudinary(input: {
  requestId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<CloudinaryRequestFileUpload> {
  const client = getCloudinaryServerClient();
  const resourceType: RequestFileCloudinaryResourceType = isOcrCompatibleMimeType(input.mimeType)
    ? 'image'
    : 'raw';
  const fallbackFormat = extensionWithoutDot(input.fileName);
  const opaqueId = randomUUID();
  const publicId = resourceType === 'raw' && fallbackFormat
    ? `${opaqueId}.${fallbackFormat}`
    : opaqueId;

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        folder: requestFileCloudinaryFolder(input.requestId),
        public_id: publicId,
        resource_type: resourceType,
        type: 'authenticated',
        use_filename: false,
        unique_filename: false,
        overwrite: false,
        ...(resourceType === 'image'
          ? { allowed_formats: ['jpg', 'jpeg', 'png', 'webp'] }
          : {})
      },
      (error, uploadResult) => {
        if (error || !uploadResult) {
          reject(error ?? new Error('Cloudinary request-file upload failed.'));
          return;
        }
        resolve(uploadResult);
      }
    );
    stream.end(input.buffer);
  });

  const format = result.format || fallbackFormat || undefined;
  const locator: CloudinaryRequestFileLocator = {
    publicId: result.public_id,
    resourceType,
    deliveryType: 'authenticated',
    version: result.version === undefined ? null : String(result.version),
    format: format ?? null
  };

  return {
    storageKey: encodeRequestFileStorageKey(locator),
    publicId: result.public_id,
    resourceType,
    deliveryType: 'authenticated',
    version: result.version === undefined ? undefined : String(result.version),
    format,
    bytes: result.bytes || input.buffer.byteLength,
    checksumSha256: createHash('sha256').update(input.buffer).digest('hex')
  };
}

export async function downloadRequestFileBytesFromCloudinary(
  locator: CloudinaryRequestFileLocator,
  options: { maxBytes?: number; timeoutMs?: number } = {}
) {
  const client = getCloudinaryServerClient();
  const url = client.utils.private_download_url(locator.publicId, locator.format ?? '', {
    resource_type: locator.resourceType,
    type: locator.deliveryType,
    expires_at: Math.floor(Date.now() / 1000) + 60
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal
    });
    if (!response.ok) {
      return { ok: false as const, code: 'REQUEST_FILE_CLOUDINARY_FETCH_FAILED' as const };
    }

    const maxBytes = options.maxBytes ?? getUploadMaxSizeBytes();
    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    if (declaredLength > maxBytes) {
      return { ok: false as const, code: 'REQUEST_FILE_TOO_LARGE' as const };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) {
      return { ok: false as const, code: 'REQUEST_FILE_TOO_LARGE' as const };
    }
    return { ok: true as const, buffer };
  } catch (error) {
    return {
      ok: false as const,
      code: error instanceof Error && error.name === 'AbortError'
        ? 'REQUEST_FILE_STORAGE_TIMEOUT' as const
        : 'REQUEST_FILE_CLOUDINARY_FETCH_FAILED' as const
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function deleteRequestFileFromCloudinary(locator: CloudinaryRequestFileLocator) {
  const client = getCloudinaryServerClient();
  const result = await client.uploader.destroy(locator.publicId, {
    resource_type: locator.resourceType,
    type: locator.deliveryType,
    invalidate: true
  });
  if (!['ok', 'not found'].includes(result.result)) {
    throw new Error('Cloudinary request-file deletion failed.');
  }
  return { deleted: result.result === 'ok', alreadyMissing: result.result === 'not found' };
}
