import 'server-only';

import { prisma } from '@/lib/prisma';
import { getManufacturersForEquipmentType } from '@/lib/vehicles/equipment-manufacturers';

export type AdminVehicleManufacturerOption = {
  value: string;
  label: string;
  name: string;
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('uk-UA');
}

export async function getAdminVehicleManufacturerOptions(): Promise<AdminVehicleManufacturerOption[]> {
  const manufacturers = await prisma.manufacturer.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true
    }
  });

  return manufacturers.map((manufacturer) => ({
    value: manufacturer.id,
    label: manufacturer.name,
    name: manufacturer.name
  }));
}

export async function validateAdminVehicleManufacturer(manufacturerId: string, equipmentType: string) {
  const manufacturer = await prisma.manufacturer.findUnique({
    where: { id: manufacturerId },
    select: { id: true, name: true }
  });

  if (!manufacturer) {
    return { ok: false as const, message: 'Оберіть виробника зі списку.' };
  }

  const allowedNames = getManufacturersForEquipmentType(equipmentType).map(normalize);
  if (!allowedNames.includes(normalize(manufacturer.name))) {
    return { ok: false as const, message: 'Обраний виробник не відповідає типу техніки.' };
  }

  return { ok: true as const, manufacturer };
}
