import 'server-only';

import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

let isConfigured = false;

function getCloudinaryCredentials() {
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET
  };
}

export function hasCloudinaryConfig() {
  const { cloudName, apiKey, apiSecret } = getCloudinaryCredentials();
  return Boolean(cloudName && apiKey && apiSecret);
}

function getCloudinaryClient() {
  const { cloudName, apiKey, apiSecret } = getCloudinaryCredentials();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary is not configured.');
  }

  if (!isConfigured) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true
    });
    isConfigured = true;
  }

  return cloudinary;
}

export type CloudinaryUsedEquipmentUpload = {
  publicId: string;
  secureUrl: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
};

export type CloudinaryVehicleUpload = CloudinaryUsedEquipmentUpload;

async function uploadImage(
  folder: string,
  file: File,
  transformation?: { width: number; height: number; crop: 'limit'; angle: 'auto'; quality: 'auto' }[]
): Promise<CloudinaryUsedEquipmentUpload> {
  const client = getCloudinaryClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        use_filename: false,
        unique_filename: true,
        overwrite: false,
        ...(transformation ? { transformation } : {})
      },
      (error, uploadResult) => {
        if (error || !uploadResult) {
          reject(error ?? new Error('Cloudinary upload failed.'));
          return;
        }

        resolve(uploadResult);
      }
    );

    stream.end(buffer);
  });

  return {
    publicId: result.public_id,
    secureUrl: result.secure_url,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes
  };
}

export async function uploadUsedEquipmentImage(usedEquipmentId: string, file: File): Promise<CloudinaryUsedEquipmentUpload> {
  return uploadImage(`kairos-parts/used-equipment/${usedEquipmentId}`, file);
}

export async function uploadVehicleImage(vehicleId: string, file: File): Promise<CloudinaryVehicleUpload> {
  return uploadImage(`kairos-parts/vehicles/${vehicleId}`, file, [
    { width: 2400, height: 2400, crop: 'limit', angle: 'auto', quality: 'auto' }
  ]);
}

export async function deleteCloudinaryAsset(publicId: string) {
  if (!publicId || !hasCloudinaryConfig()) {
    return;
  }

  const client = getCloudinaryClient();
  await client.uploader.destroy(publicId, { resource_type: 'image' });
}

export async function cleanupCloudinaryAssets(publicIds: string[]) {
  await Promise.allSettled(publicIds.map((publicId) => deleteCloudinaryAsset(publicId)));
}
