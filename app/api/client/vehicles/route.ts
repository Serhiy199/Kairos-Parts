import { Prisma } from '@prisma/client';

import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import { getClientApiSession, vehicleAccessWhere } from '@/lib/client/access';
import { prisma } from '@/lib/prisma';
import {
  findVehicleVinDuplicate,
  VEHICLE_VIN_DUPLICATE_MESSAGE
} from '@/lib/vehicles/duplicates';
import { vehicleOwnershipForClient } from '@/lib/vehicles/ownership';
import { pickEditableVehicleFields } from '@/lib/vehicles/change-snapshot';
import { normalizeVehicleVin } from '@/lib/vehicles/vin';
import { validateVehicleName } from '@/lib/vehicles/name';

export const runtime = 'nodejs';

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

async function getClientAccess() {
  const result = await getClientApiSession();
  return result.ok ? { status: 'ok' as const, access: result.access } : result;
}

export async function GET() {
  const result = await getClientAccess();

  if (result.status !== 'ok') {
    const statusCode = result.statusCode;
    return Response.json({ status: result.status }, { status: statusCode });
  }

  const vehicles = await prisma.vehicle.findMany({
    where: vehicleAccessWhere(result.access),
    orderBy: { createdAt: 'desc' }
  });

  return Response.json({ items: vehicles });
}

export async function POST(request: Request) {
  const result = await getClientAccess();

  if (result.status !== 'ok') {
    const statusCode = result.statusCode;
    return Response.json({ status: result.status }, { status: statusCode });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const nameResult = validateVehicleName(body.name);
  const type = readString(body.type);
  const manufacturer = readString(body.manufacturer);
  const model = readString(body.model);
  const vinSource = readString(body.vinOrSerial);
  const yearValue = typeof body.year === 'number' ? body.year : Number(readString(body.year));
  const year = Number.isInteger(yearValue) && yearValue > 1900 && yearValue < 2200 ? yearValue : null;

  if (!nameResult.ok) {
    return Response.json(
      { status: 'validation_error', message: nameResult.message, field: 'name' },
      { status: 400 }
    );
  }

  if (!type || !manufacturer || !model || vinSource.length > 120) {
    return Response.json(
      { status: 'validation_error', message: 'Перевірте обовʼязкові поля та довжину VIN або серійного номера.' },
      { status: 400 }
    );
  }

  const owner = vehicleOwnershipForClient(result.access);
  const vinOrSerial = normalizeVehicleVin(vinSource);
  const transactionResult = await prisma.$transaction(async (tx) => {
    const duplicate = await findVehicleVinDuplicate({ db: tx, owner, normalizedVin: vinOrSerial });

    if (duplicate) {
      return { duplicate: true as const };
    }

    const vehicle = await tx.vehicle.create({
      data: {
        ...owner,
        name: nameResult.name,
        type,
        manufacturer,
        model,
        year,
        vinOrSerial,
        comment: readString(body.comment) || null
      }
    });
    await writeAuditLog(tx, {
      actor: auditUserActor(result.access.userId),
      companyId: result.access.companyId,
      entityType: 'VEHICLE',
      entityId: vehicle.id,
      action: 'ENTITY_UPDATED',
      category: 'STANDARD',
      newValue: pickEditableVehicleFields(vehicle),
      metadata: {
        event: 'VEHICLE_CREATED',
        actorRole: 'CLIENT',
        ownerType: result.access.companyId ? 'company' : 'client',
        ownerId: result.access.companyId ?? result.access.clientProfileId
      },
      allowedFields: {
        newValue: ['name', 'type', 'manufacturer', 'model', 'year', 'vinOrSerial', 'comment'],
        metadata: ['event', 'actorRole', 'ownerType', 'ownerId']
      }
    });
    return { duplicate: false as const, vehicle };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  if (transactionResult.duplicate) {
    return Response.json(
      { status: 'duplicate_vin', message: VEHICLE_VIN_DUPLICATE_MESSAGE },
      { status: 409 }
    );
  }

  return Response.json({ vehicle: transactionResult.vehicle }, { status: 201 });
}
