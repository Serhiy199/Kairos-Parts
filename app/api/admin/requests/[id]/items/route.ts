import { revalidatePath } from 'next/cache';

import { crmAccessError, getCrmApiSession } from '@/lib/admin/access';
import { auditRequestContextFromHeaders } from '@/lib/audit-log/request-context';
import {
  createRequestItemDraft,
  RequestItemDraftCreateError
} from '@/lib/request-items/create-draft';
import { parseRequestItemInput } from '@/lib/request-items/validation';
import { prisma } from '@/lib/prisma';
import { RequestStatusTransitionError } from '@/lib/requests/status-transition';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { id } = await params;
  const items = await prisma.requestItem.findMany({
    where: { requestId: id },
    orderBy: { createdAt: 'desc' }
  });

  return Response.json({ items });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body) {
    return Response.json({ status: 'invalid_json' }, { status: 400 });
  }

  const parsed = parseRequestItemInput(body);

  if (!parsed.ok) {
    return Response.json({ status: 'validation_error', message: parsed.error }, { status: 400 });
  }

  const requestContext = auditRequestContextFromHeaders(request.headers);
  try {
    const result = await createRequestItemDraft({
      requestId: id,
      data: parsed.data,
      actor: { id: access.session.user.id },
      requestContext
    });

    revalidatePath('/admin');
    revalidatePath('/admin/requests');
    revalidatePath(`/admin/requests/${result.request.id}`);

    return Response.json({ item: result.item, transition: result.transition }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestItemDraftCreateError) {
      if (error.code === 'REQUEST_NOT_FOUND') {
        return Response.json({ status: 'not_found' }, { status: 404 });
      }
      if (error.code === 'ACTOR_NOT_ALLOWED') {
        return Response.json({ status: 'forbidden' }, { status: 403 });
      }
      if (error.code === 'FINAL_CLIENT_SELECTION_LOCKED') {
        return Response.json(
          { status: 'selection_mutation_locked' },
          { status: 409 }
        );
      }
      if (error.code === 'REQUEST_STATUS_DOES_NOT_ALLOW_ITEM_CREATION') {
        return Response.json({ status: 'request_status_locked' }, { status: 409 });
      }
      return Response.json({ status: 'request_item_create_failed' }, { status: 500 });
    }
    if (error instanceof RequestStatusTransitionError) {
      const statusCode = error.code === 'ROLE_NOT_ALLOWED' ? 403 : 409;
      return Response.json({ status: error.code.toLowerCase() }, { status: statusCode });
    }
    return Response.json({ status: 'create_failed' }, { status: 500 });
  }
}
