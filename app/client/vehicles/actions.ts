'use server';

import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';

import { getClientProfileForSession, requireClientSession } from '@/lib/client/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';

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

async function getClientProfileId() {
  const session = await requireClientSession();

  if (!hasDatabaseUrl()) {
    redirect('/client/vehicles?error=database');
  }

  const profile = await getClientProfileForSession(session.user.id);

  if (!profile) {
    redirect('/client/vehicles?error=profile');
  }

  return profile.id;
}

export async function createVehicle(formData: FormData) {
  const clientId = await getClientProfileId();
  const type = readString(formData, 'type');
  const manufacturer = readString(formData, 'manufacturer');
  const model = readString(formData, 'model');

  if (!type || !manufacturer || !model) {
    redirect('/client/vehicles/new?error=validation');
  }

  await prisma.vehicle.create({
    data: {
      clientId,
      type,
      manufacturer,
      model,
      year: readYear(formData),
      vinOrSerial: readString(formData, 'vinOrSerial') || null,
      comment: readString(formData, 'comment') || null
    }
  });

  revalidatePath('/client/vehicles');
  redirect('/client/vehicles?created=1');
}

export async function updateVehicle(formData: FormData) {
  const clientId = await getClientProfileId();
  const vehicleId = readString(formData, 'vehicleId');
  const type = readString(formData, 'type');
  const manufacturer = readString(formData, 'manufacturer');
  const model = readString(formData, 'model');

  if (!vehicleId || !type || !manufacturer || !model) {
    redirect(vehicleId ? `/client/vehicles/${vehicleId}?error=validation` : '/client/vehicles?error=validation');
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, clientId },
    select: { id: true }
  });

  if (!vehicle) {
    notFound();
  }

  await prisma.vehicle.update({
    where: { id: vehicle.id },
    data: {
      type,
      manufacturer,
      model,
      year: readYear(formData),
      vinOrSerial: readString(formData, 'vinOrSerial') || null,
      comment: readString(formData, 'comment') || null
    }
  });

  revalidatePath('/client/vehicles');
  revalidatePath(`/client/vehicles/${vehicle.id}`);
  redirect(`/client/vehicles/${vehicle.id}?updated=1`);
}
