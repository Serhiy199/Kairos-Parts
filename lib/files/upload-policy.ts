export const ALLOWED_UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
] as const;

export const ALLOWED_UPLOAD_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf', '.xls', '.xlsx', '.csv', '.doc', '.docx'] as const;

export function getUploadMaxSizeMb() {
  const parsed = Number(process.env.FILE_UPLOAD_MAX_SIZE_MB ?? 20);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
}

export function getUploadMaxSizeBytes() {
  return getUploadMaxSizeMb() * 1024 * 1024;
}

export function isAllowedUpload(file: File) {
  const lowerName = file.name.toLowerCase();
  const hasAllowedExtension = ALLOWED_UPLOAD_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
  const hasAllowedMimeType = ALLOWED_UPLOAD_MIME_TYPES.includes(file.type as (typeof ALLOWED_UPLOAD_MIME_TYPES)[number]);

  return hasAllowedExtension && (hasAllowedMimeType || file.type === '');
}
