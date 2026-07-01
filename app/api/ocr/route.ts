import { contractNotImplemented } from '@/lib/api/not-implemented';

export function POST() {
  return contractNotImplemented({
    module: 'ocr-service',
    method: 'POST',
    path: '/api/ocr',
    auth: 'manager-or-admin',
    summary: 'Run OCR against a request file and store OCRResult for manager review.',
    request: '{ requestId: string, fileId?: string, provider?: OCRProvider }',
    response: 'OCRResultSummary',
    notes: ['Day 2 only defines the service boundary; no Tesseract.js execution yet.']
  });
}
