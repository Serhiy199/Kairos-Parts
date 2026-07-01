export const OCR_PROVIDERS = ['TESSERACT', 'GOOGLE_VISION', 'AWS_TEXTRACT', 'AZURE_VISION', 'OTHER'] as const;

export type OCRProvider = (typeof OCR_PROVIDERS)[number];

export type OCRResultSummary = {
  id: string;
  requestId: string;
  fileId?: string | null;
  rawText: string;
  possibleSerialNumber?: string | null;
  possiblePartNumber?: string | null;
  possibleModelNumber?: string | null;
  correctedText?: string | null;
  confidence?: number | null;
  provider: OCRProvider;
};
