import { revalidatePath } from 'next/cache';

import { crmAccessError, getCrmApiSession } from '@/lib/admin/access';
import { auditRequestContextFromHeaders } from '@/lib/audit-log/request-context';
import {
  RequestItemUpdateError,
  updateRequestItem
} from '@/lib/request-items/update';
import {
  deleteRequestItem,
  RequestItemDeleteError
} from '@/lib/request-items/delete';
import { parseRequestItemUpdateInput } from '@/lib/request-items/validation';

export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { itemId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body) {
    return Response.json({ status: 'invalid_json' }, { status: 400 });
  }

  const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';
  const expectedUpdatedAt = typeof body.expectedUpdatedAt === 'string'
    ? body.expectedUpdatedAt.trim()
    : '';
  const parsed = parseRequestItemUpdateInput(body);

  if (!requestId || !expectedUpdatedAt || !parsed.ok) {
    return Response.json(
      {
        status: 'validation_error',
        message: parsed.ok ? 'Invalid request item update metadata.' : parsed.error
      },
      { status: 400 }
    );
  }

  const requestContext = auditRequestContextFromHeaders(request.headers);
  let result: Awaited<ReturnType<typeof updateRequestItem>>;
  try {
    result = await updateRequestItem({
      requestItemId: itemId,
      requestId,
      expectedUpdatedAt,
      actor: { id: access.session.user.id },
      values: parsed.data,
      requestContext
    });
  } catch (error) {
    const code = error instanceof RequestItemUpdateError
      ? error.code
      : 'REQUEST_ITEM_UPDATE_FAILED';
    console.error('Request item PATCH failed.', {
      requestId,
      requestItemId: itemId,
      expectedUpdatedAt,
      errorCode: code
    });
    if (code === 'REQUEST_ITEM_NOT_FOUND' || code === 'REQUEST_ITEM_NOT_IN_REQUEST') {
      return Response.json({ status: 'not_found' }, { status: 404 });
    }
    if (code === 'ACTOR_NOT_ALLOWED') {
      return Response.json({ status: 'forbidden' }, { status: 403 });
    }
    if (code === 'REQUEST_ITEM_VERSION_CONFLICT') {
      return Response.json({ status: 'version_conflict' }, { status: 409 });
    }
    if (code === 'APPROVED_REQUEST_ITEM_LOCKED') {
      return Response.json({ status: 'approved_item_locked' }, { status: 409 });
    }
    if (code === 'REQUEST_SELECTION_MUTATION_LOCKED') {
      return Response.json({ status: 'selection_mutation_locked' }, { status: 409 });
    }
    if (code === 'REQUEST_ITEM_VALIDATION_FAILED') {
      return Response.json({ status: 'validation_error' }, { status: 400 });
    }
    return Response.json({ status: 'update_failed' }, { status: 500 });
  }

  if (result.outcome === 'no_changes') {
    return Response.json({
      status: 'no_changes',
      code: result.code,
      item: result.item,
      changedFields: []
    });
  }

  revalidatePath('/admin');
  revalidatePath('/admin/requests');
  revalidatePath(`/admin/requests/${result.item.requestId}`);

  return Response.json({
    status: 'updated',
    code: result.code,
    item: result.item,
    changedFields: result.changedFields
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { itemId } = await params;
  const requestContext = auditRequestContextFromHeaders(request.headers);
  let result: Awaited<ReturnType<typeof deleteRequestItem>>;
  try {
    result = await deleteRequestItem({
      requestItemId: itemId,
      actor: { id: access.session.user.id },
      requestContext
    });
  } catch (error) {
    if (error instanceof RequestItemDeleteError) {
      if (error.code === 'REQUEST_ITEM_NOT_FOUND') {
        return Response.json({ status: 'not_found' }, { status: 404 });
      }
      if (error.code === 'ACTOR_NOT_ALLOWED') {
        return Response.json({ status: 'forbidden' }, { status: 403 });
      }
      if (error.code === 'REQUEST_SELECTION_MUTATION_LOCKED') {
        return Response.json({ status: 'selection_mutation_locked' }, { status: 409 });
      }
      if (error.code === 'APPROVED_REQUEST_ITEM_DELETE_BLOCKED') {
        return Response.json(
          { status: 'approved_item_delete_blocked' },
          { status: 409 }
        );
      }
    }
    throw error;
  }

  revalidatePath('/admin');
  revalidatePath('/admin/requests');
  revalidatePath(`/admin/requests/${result.item.requestId}`);

  return Response.json({ status: 'deleted' });
}
