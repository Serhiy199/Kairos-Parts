'use server';

import { requireCrmSession } from '@/lib/admin/access';
import { prisma } from '@/lib/prisma';
import { deleteVehicleImageForActor, reorderVehicleImagesForActor, setPrimaryVehicleImageForActor, uploadVehicleImagesForActor } from '@/lib/vehicles/image-mutations';
import type { VehicleImageActionState } from '@/lib/vehicles/images';

async function getVehicleContext(vehicleId: string) {
  return prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { id: true, clientId: true, companyId: true, images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, publicId: true, sortOrder: true, isPrimary: true } } }
  });
}

function actorRole(role: string | undefined) {
  return role === 'ADMIN' ? 'ADMIN' as const : 'MANAGER' as const;
}

export async function uploadAdminVehicleImages(vehicleId: string, _state: VehicleImageActionState, formData: FormData) {
  const session = await requireCrmSession();
  const vehicle = await getVehicleContext(vehicleId);
  if (!vehicle) return { status: 'error', message: 'Техніку не знайдено.' } satisfies VehicleImageActionState;
  return uploadVehicleImagesForActor(vehicle, { userId: session.user.id, role: actorRole(session.user.role) }, formData);
}

export async function setPrimaryVehicleImage(vehicleId: string, imageId: string) {
  const session = await requireCrmSession();
  const vehicle = await getVehicleContext(vehicleId);
  if (!vehicle) return { status: 'error', message: 'Техніку не знайдено.' } satisfies VehicleImageActionState;
  return setPrimaryVehicleImageForActor(vehicle, { userId: session.user.id, role: actorRole(session.user.role) }, imageId);
}

export async function reorderAdminVehicleImages(vehicleId: string, orderedImageIds: string[]) {
  const session = await requireCrmSession();
  const vehicle = await getVehicleContext(vehicleId);
  if (!vehicle) return { status: 'error', message: 'Техніку не знайдено.' } satisfies VehicleImageActionState;
  return reorderVehicleImagesForActor(vehicle, { userId: session.user.id, role: actorRole(session.user.role) }, orderedImageIds);
}

export async function deleteAdminVehicleImage(vehicleId: string, imageId: string) {
  const session = await requireCrmSession();
  const vehicle = await getVehicleContext(vehicleId);
  if (!vehicle) return { status: 'error', message: 'Техніку не знайдено.' } satisfies VehicleImageActionState;
  return deleteVehicleImageForActor(vehicle, { userId: session.user.id, role: actorRole(session.user.role) }, imageId);
}
