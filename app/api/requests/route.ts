import { auth } from '@/auth';
import { saveRequestFileLocal } from '@/lib/files/local-storage';
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

function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

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
  const clientProfile =
    session?.user?.role === 'CLIENT'
      ? await prisma.clientProfile.findUnique({
          where: { userId: session.user.id }
        })
      : null;

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

    const createdRequest = await prisma.request.create({
      data: {
        requestNumber,
        publicStatusToken,
        source: clientProfile ? 'CLIENT_DASHBOARD' : 'WEBSITE',
        status: 'NEW',
        clientId: clientProfile?.id,
        guestName: clientProfile ? null : parsed.data.contactName,
        guestPhone: clientProfile ? null : parsed.data.phone,
        guestEmail: clientProfile ? null : parsed.data.email,
        companyName: parsed.data.contactName,
        categoryId: category?.id,
        manufacturerId: manufacturer?.id,
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
