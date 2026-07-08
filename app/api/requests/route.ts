import { auth } from '@/auth';
import { getClientAccessContext, vehicleAccessWhere } from '@/lib/client/access';
import { saveRequestFileLocal } from '@/lib/files/local-storage';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';
import { generatePublicStatusToken, generateRequestNumber } from '@/lib/requests/identifiers';
import { parseRequestFormData } from '@/lib/requests/validation';

export function GET() {
  return Response.json(
    {
      status: 'not_implemented',
      contract: {
        module: 'requests',
        method: 'GET',
        path: '/api/requests',
        auth: 'manager-or-admin',
        summary: 'List requests for CRM-level workflows with future filters by status, source, manager, and date range.',
        response: { items: 'RequestListItem[]', pagination: '{ page, pageSize, total }' }
      }
    },
    { status: 501 }
  );
}

export const runtime = 'nodejs';

function buildDescription(description: string, comment?: string) {
  if (!comment) {
    return description;
  }

  return `${description}\n\nКоментар клієнта:\n${comment}`;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const parsed = parseRequestFormData(formData);

  if (!parsed.data) {
    return Response.json({ status: 'validation_error', errors: parsed.errors }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    return Response.json(
      {
        status: 'database_not_configured',
        message: 'DATABASE_URL is not configured. Request validation passed, but database insert requires a local PostgreSQL database.',
        errors: []
      },
      { status: 503 }
    );
  }

  const session = await auth();
  const clientAccess = session?.user?.role === 'CLIENT' ? await getClientAccessContext(session.user.id) : null;

  const category = parsed.data.categorySlug
    ? await prisma.category.findUnique({
        where: { slug: parsed.data.categorySlug }
      })
    : null;
  const manufacturer = parsed.data.manufacturer
    ? await prisma.manufacturer.findFirst({
        where: {
          name: parsed.data.manufacturer,
          ...(category ? { categoryId: category.id } : {})
        }
      })
    : null;

  try {
    const requestNumber = generateRequestNumber();
    const publicStatusToken = generatePublicStatusToken();
    const vehicle = parsed.data.vehicleId
      ? await prisma.vehicle.findFirst({
          where: {
            id: parsed.data.vehicleId,
            ...(clientAccess ? vehicleAccessWhere(clientAccess) : { id: '__not_allowed_for_guest__' })
          },
          select: { id: true }
        })
      : null;

    const createdRequest = await prisma.request.create({
      data: {
        requestNumber,
        publicStatusToken,
        source: clientAccess && parsed.data.source === 'client' ? 'CLIENT_DASHBOARD' : 'WEBSITE',
        status: 'NEW',
        clientId: clientAccess?.clientProfileId,
        companyId: clientAccess?.companyId,
        guestName: clientAccess ? null : parsed.data.contactName,
        guestPhone: clientAccess ? null : parsed.data.phone,
        guestEmail: clientAccess ? null : parsed.data.email,
        companyName: parsed.data.companyName ?? parsed.data.contactName,
        categoryId: category?.id,
        manufacturerId: manufacturer?.id,
        vehicleId: vehicle?.id,
        equipmentType: parsed.data.equipmentType,
        model: parsed.data.model,
        vinOrSerial: parsed.data.vinOrSerial,
        description: buildDescription(parsed.data.description, parsed.data.comment)
      }
    });

    const savedFiles = [];

    for (const file of parsed.data.files) {
      const savedFile = await saveRequestFileLocal(createdRequest.id, file);
      const requestFile = await prisma.requestFile.create({
        data: {
          requestId: createdRequest.id,
          fileName: savedFile.fileName,
          storageKey: savedFile.storageKey,
          fileUrl: savedFile.fileUrl,
          mimeType: savedFile.mimeType,
          size: savedFile.size
        }
      });
      savedFiles.push(requestFile);
    }

    return Response.json(
      {
        id: createdRequest.id,
        requestNumber: createdRequest.requestNumber,
        status: createdRequest.status,
        publicStatusUrl: `/request/status/${createdRequest.publicStatusToken}`,
        files: savedFiles.map((file) => ({
          id: file.id,
          fileName: file.fileName,
          mimeType: file.mimeType,
          size: file.size
        }))
      },
      { status: 201 }
    );
  } catch (error) {
    return Response.json(
      {
        status: 'database_error',
        message: 'Request could not be created. Check DATABASE_URL, Prisma migration state, and local file permissions.',
        detail: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    );
  }
}
