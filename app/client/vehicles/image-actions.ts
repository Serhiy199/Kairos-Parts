'use server';

import { getClientAccessContext, requireClientSession, vehicleAccessWhere } from '@/lib/client/access';
import { prisma } from '@/lib/prisma';
import { deleteVehicleImageForActor, reorderVehicleImagesForActor, setPrimaryVehicleImageForActor, uploadVehicleImagesForActor } from '@/lib/vehicles/image-mutations';
import type { VehicleImageActionState } from '@/lib/vehicles/images';

async function getClientVehicleContext(vehicleId: string) {
  const session = await requireClientSession();
  const access = await getClientAccessContext(session.user.id);
  if (!access) return null;
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, AND: [vehicleAccessWhere(access)] },
    select: { id: true, clientId: true, companyId: true, images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, publicId: true, sortOrder: true, isPrimary: true } } }
  });
  return vehicle ? { session, vehicle } : null;
}

export async function uploadClientVehicleImages(vehicleId: string, _state: VehicleImageActionState, formData: FormData) {
  const result = await getClientVehicleContext(vehicleId);
  if (!result) return { status: 'error', message: 'Техніку не знайдено або доступ заборонено.' } satisfies VehicleImageActionState;
  return uploadVehicleImagesForActor(result.vehicle, { userId: result.session.user.id, role: 'CLIENT' }, formData);
}

export async function setPrimaryClientVehicleImage(vehicleId: string, imageId: string) {
  const result = await getClientVehicleContext(vehicleId);
  if (!result) return { status: 'error', message: 'Техніку не знайдено або доступ заборонено.' } satisfies VehicleImageActionState;
  return setPrimaryVehicleImageForActor(result.vehicle, { userId: result.session.user.id, role: 'CLIENT' }, imageId);
}

export async function reorderClientVehicleImages(vehicleId: string, orderedImageIds: string[]) {
  const result = await getClientVehicleContext(vehicleId);
  if (!result) return { status: 'error', message: 'Техніку не знайдено або доступ заборонено.' } satisfies VehicleImageActionState;
  return reorderVehicleImagesForActor(result.vehicle, { userId: result.session.user.id, role: 'CLIENT' }, orderedImageIds);
}

export async function deleteClientVehicleImage(vehicleId: string, imageId: string) {
  const result = await getClientVehicleContext(vehicleId);
  if (!result) return { status: 'error', message: 'Техніку не знайдено або доступ заборонено.' } satisfies VehicleImageActionState;
  return deleteVehicleImageForActor(result.vehicle, { userId: result.session.user.id, role: 'CLIENT' }, imageId);
}
