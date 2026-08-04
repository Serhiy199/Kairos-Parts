export function isNonEmptyUploadedFile(value: unknown): value is File {
  return value instanceof File
    && value.size > 0
    && value.name.trim().length > 0;
}

export function normalizeUploadedFiles(values: Iterable<unknown>): File[] {
  return Array.from(values).filter(isNonEmptyUploadedFile);
}

export function getNonEmptyUploadedFiles(formData: FormData, key: string): File[] {
  return normalizeUploadedFiles(formData.getAll(key));
}
