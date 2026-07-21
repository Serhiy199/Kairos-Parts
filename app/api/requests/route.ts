import { getClientApiSession, vehicleAccessWhere } from '@/lib/client/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { EQUIPMENT_TAXONOMY_REQUEST_FIELDS_ENABLED } from '@/lib/features/equipment-taxonomy';
import { saveRequestFileLocal } from '@/lib/files/local-storage';
import { prisma } from '@/lib/prisma';
import { generatePublicStatusToken } from '@/lib/requests/identifiers';
import { parseRequestFormData } from '@/lib/requests/validation';
import { validateEquipmentTaxonomySelection } from '@/lib/vehicles/taxonomy';

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
  const authResult = await getClientApiSession();

  if (!authResult.ok && authResult.status === 'unauthorized') {
    return Response.json(
      {
        status: 'unauthorized',
        message: 'Щоб створити заявку, увійдіть у клієнтський кабінет.'
      },
      { status: 401 }
    );
  }

  if (!authResult.ok && authResult.status === 'forbidden') {
    return Response.json(
      {
        status: 'forbidden',
        message: 'Створення заявки доступне тільки для клієнтського акаунта.'
      },
      { status: 403 }
    );
  }

  if (!authResult.ok) {
    return Response.json(
      {
        status: authResult.status,
        message: 'Не вдалося перевірити доступ до клієнтського кабінету.'
      },
      { status: authResult.statusCode }
    );
  }

  const formData = await request.formData();
  const parsed = parseRequestFormData(formData);

  if (!parsed.data) {
    return Response.json(
      {
        status: 'validation_error',
        message: 'Перевірте обовʼязкові поля заявки.',
        errors: parsed.errors
      },
      { status: 400 }
    );
  }

  if (!hasDatabaseUrl()) {
    return Response.json(
      {
        status: 'database_not_configured',
        message: 'Зараз не вдалося створити заявку через налаштування сервера. Спробуйте пізніше або напишіть нам у Telegram.',
        errors: []
      },
      { status: 503 }
    );
  }

  const clientAccess = authResult.access;

  try {
    let equipmentType = parsed.data.equipmentType;
    let manufacturerId: string | null = null;
    let manufacturerName = parsed.data.manufacturer;

    if (EQUIPMENT_TAXONOMY_REQUEST_FIELDS_ENABLED) {
      const taxonomy = await validateEquipmentTaxonomySelection({
        equipmentType,
        manufacturer: manufacturerName
      });
      if (!taxonomy.ok) {
        return Response.json(
          { status: 'validation_error', message: taxonomy.message, errors: [taxonomy.message] },
          { status: 400 }
        );
      }

      equipmentType = taxonomy.equipmentType.name;
      manufacturerId = taxonomy.manufacturer.id;
      manufacturerName = taxonomy.manufacturer.name;
    }
    const publicStatusToken = generatePublicStatusToken();
    const vehicle = parsed.data.vehicleId
      ? await prisma.vehicle.findFirst({
          where: {
            id: parsed.data.vehicleId,
            ...vehicleAccessWhere(clientAccess)
          },
          select: { id: true }
        })
      : null;

    const createdRequest = await prisma.request.create({
      data: {
        publicStatusToken,
        source: 'CLIENT_DASHBOARD',
        status: 'NEW',
        clientId: clientAccess.clientProfileId,
        companyId: clientAccess.companyId,
        guestName: null,
        guestPhone: null,
        guestEmail: null,
        companyName: parsed.data.companyName ?? parsed.data.contactName,
        categoryId: null,
        subcategoryId: null,
        manufacturerId,
        manufacturerName,
        vehicleId: vehicle?.id,
        equipmentType,
        model: parsed.data.model,
        vehicleYear: parsed.data.vehicleYear,
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
    console.error('Request creation failed', error);
    return Response.json(
      {
        status: 'database_error',
        message: 'Не вдалося створити заявку. Спробуйте ще раз або напишіть нам у Telegram.'
      },
      { status: 503 }
    );
  }
}
