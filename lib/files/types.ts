export type StoredFileContract = {
  id: string;
  fileName: string;
  storageKey: string;
  fileUrl?: string | null;
  mimeType: string;
  size: number;
  createdAt: string;
};
