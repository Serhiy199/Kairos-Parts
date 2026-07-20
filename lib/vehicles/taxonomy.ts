import 'server-only';

import { prisma } from '@/lib/prisma';
import { normalizeTaxonomyName } from '@/lib/vehicles/taxonomy-normalization';

export type EquipmentTaxonomyManufacturer = { id: string; name: string };
export type EquipmentTaxonomyType = {
  id: string;
  name: string;
  slug: string;
  manufacturers: EquipmentTaxonomyManufacturer[];
};

export async function getActiveEquipmentTaxonomy(current?: {
  equipmentType?: string;
  manufacturer?: string;
}): Promise<EquipmentTaxonomyType[]> {
  const currentType = current?.equipmentType?.trim();
  const currentManufacturer = current?.manufacturer?.trim();
  const types = await prisma.equipmentType.findMany({
    where: currentType
      ? { OR: [{ isActive: true }, { normalizedName: normalizeTaxonomyName(currentType) }] }
      : { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      manufacturers: {
        where: currentManufacturer
          ? { manufacturer: { OR: [{ isActive: true }, { name: { equals: currentManufacturer, mode: 'insensitive' } }] } }
          : { manufacturer: { isActive: true } },
        orderBy: [{ manufacturer: { sortOrder: 'asc' } }, { manufacturer: { name: 'asc' } }],
        select: { manufacturer: { select: { id: true, name: true } } }
      }
    }
  });

  return types.map((type) => ({
    id: type.id,
    name: type.name,
    slug: type.slug,
    manufacturers: type.manufacturers.map((item) => item.manufacturer)
  }));
}

export async function getActiveEquipmentTypeNames() {
  const types = await prisma.equipmentType.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { name: true }
  });
  return types.map((type) => type.name);
}

export async function getActiveManufacturerNamesForType(equipmentType: string) {
  const normalizedName = normalizeTaxonomyName(equipmentType);
  const type = await prisma.equipmentType.findUnique({
    where: { normalizedName },
    select: {
      isActive: true,
      manufacturers: {
        where: { manufacturer: { isActive: true } },
        orderBy: [{ manufacturer: { sortOrder: 'asc' } }, { manufacturer: { name: 'asc' } }],
        select: { manufacturer: { select: { name: true } } }
      }
    }
  });
  if (!type?.isActive) return [];
  return type.manufacturers.map((item) => item.manufacturer.name);
}

export async function validateEquipmentTaxonomySelection(input: {
  equipmentType: string;
  manufacturer?: string;
  manufacturerId?: string;
}) {
  const normalizedName = normalizeTaxonomyName(input.equipmentType);
  const equipmentType = await prisma.equipmentType.findUnique({
    where: { normalizedName },
    select: { id: true, name: true, isActive: true }
  });
  if (!equipmentType?.isActive) {
    return { ok: false as const, field: 'equipmentType' as const, message: 'Оберіть активний тип техніки зі списку.' };
  }

  const manufacturer = input.manufacturerId
    ? await prisma.manufacturer.findUnique({ where: { id: input.manufacturerId }, select: { id: true, name: true, isActive: true } })
    : await prisma.manufacturer.findFirst({
        where: { name: { equals: input.manufacturer?.trim() ?? '', mode: 'insensitive' } },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, name: true, isActive: true }
      });

  if (!manufacturer?.isActive) {
    return { ok: false as const, field: 'manufacturer' as const, message: 'Оберіть активного виробника зі списку.' };
  }

  const relation = await prisma.manufacturerEquipmentType.findUnique({
    where: { manufacturerId_equipmentTypeId: { manufacturerId: manufacturer.id, equipmentTypeId: equipmentType.id } },
    select: { manufacturerId: true }
  });
  if (!relation) {
    return { ok: false as const, field: 'manufacturer' as const, message: 'Обраний виробник не відповідає типу техніки.' };
  }

  return { ok: true as const, equipmentType, manufacturer };
}
