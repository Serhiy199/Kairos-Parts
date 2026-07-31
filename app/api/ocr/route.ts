import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { RequestFileStorageError } from '@/lib/files/request-file-storage';
import { runOcrForRequestFile } from '@/lib/ocr/service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = await requireCrmSession();

  if (!hasDatabaseUrl()) {
    return Response.json({ status: 'database_not_configured' }, { status: 503 });
  }

  const payload = (await request.json().catch(() => null)) as { requestId?: string; fileId?: string } | null;

  if (!payload?.requestId || !payload.fileId) {
    return Response.json({ status: 'validation_error', message: 'requestId and fileId are required.' }, { status: 400 });
  }

  try {
    const result = await runOcrForRequestFile({
      actor: { type: 'CRM', userId: session.user.id },
      requestId: payload.requestId,
      fileId: payload.fileId
    });

    return Response.json({
      id: result.id,
      requestId: result.requestId,
      fileId: result.fileId,
      provider: result.provider,
      rawText: result.rawText,
      correctedText: result.correctedText,
      confidence: result.confidence
    });
  } catch (error) {
    if (error instanceof RequestFileStorageError) {
      return Response.json(
        { status: error.code.toLowerCase(), message: error.message },
        { status: error.httpStatus }
      );
    }
    return Response.json(
      {
        status: 'ocr_error',
        message: error instanceof Error ? error.message : 'OCR could not be completed.'
      },
      { status: 500 }
    );
  }
}
