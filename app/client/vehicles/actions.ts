'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';

import { getClientAccessContext, requireClientSession, vehicleAccessWhere } from '@/lib/client/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';
import { findVehicleVinDuplicate } from '@/lib/vehicles/duplicates';
import {
  isValidVehicleOwnership,
  vehicleOwnershipForClient
} from '@/lib/vehicles/ownership';
import { normalizeVehicleVin } from '@/lib/vehicles/vin';

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function readYear(formData: FormData) {
  const value = readString(formData, 'year');
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 1900 && parsed < 2200 ? parsed : null;
}

async function getClientAccess() {
  const session = await requireClientSession();

  if (!hasDatabaseUrl()) {
    redirect('/client/vehicles?error=database');
  }

  const access = await getClientAccessContext(session.user.id);

  if (!access) {
    redirect('/client/vehicles?error=profile');
  }

  return access;
}

export async function createVehicle(formData: FormData) {
  const access = await getClientAccess();
  const type = readString(formData, 'type');
  const manufacturer = readString(formData, 'manufacturer');
  const model = readString(formData, 'model');
  const vinSource = readString(formData, 'vinOrSerial');

  if (!type || !manufacturer || !model || vinSource.length > 120) {
    redirect('/client/vehicles/new?error=validation');
  }

  const owner = vehicleOwnershipForClient(access);
  const vinOrSerial = normalizeVehicleVin(vinSource);
  const duplicate = await prisma.$transaction(async (tx) => {
    const found = await findVehicleVinDuplicate({ db: tx, owner, normalizedVin: vinOrSerial });

    if (found) {
      return found;
    }

    await tx.vehicle.create({
      data: {
        ...owner,
        type,
        manufacturer,
        model,
        year: readYear(formData),
        vinOrSerial,
        comment: readString(formData, 'comment') || null
      }
    });
    return null;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  if (duplicate) {
    redirect('/client/vehicles/new?error=duplicate');
  }

  revalidatePath('/client/vehicles');
  redirect('/client/vehicles?created=1');
}

export async function updateVehicle(formData: FormData) {
  const access = await getClientAccess();
  const vehicleId = readString(formData, 'vehicleId');
  const type = readString(formData, 'type');
  const manufacturer = readString(formData, 'manufacturer');
  const model = readString(formData, 'model');
  const vinSource = readString(formData, 'vinOrSerial');

  if (!vehicleId || !type || !manufacturer || !model || vinSource.length > 120) {
    redirect(vehicleId ? `/client/vehicles/${vehicleId}?error=validation` : '/client/vehicles?error=validation');
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, AND: [vehicleAccessWhere(access)] },
    select: { id: true, clientId: true, companyId: true }
  });

  if (!vehicle || !isValidVehicleOwnership(vehicle)) {
    notFound();
  }

  const vinOrSerial = normalizeVehicleVin(vinSource);
  const duplicate = await prisma.$transaction(async (tx) => {
    const found = await findVehicleVinDuplicate({
      db: tx,
      owner: vehicle,
      normalizedVin: vinOrSerial,
      excludeVehicleId: vehicle.id
    });

    if (found) {
      return found;
    }

    await tx.vehicle.update({
      where: { id: vehicle.id },
      data: {
        type,
        manufacturer,
        model,
        year: readYear(formData),
        vinOrSerial,
        comment: readString(formData, 'comment') || null
      }
    });
    return null;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  if (duplicate) {
    redirect(`/client/vehicles/${vehicle.id}?error=duplicate`);
  }

  revalidatePath('/client/vehicles');
  revalidatePath(`/client/vehicles/${vehicle.id}`);
  redirect(`/client/vehicles/${vehicle.id}?updated=1`);
}
