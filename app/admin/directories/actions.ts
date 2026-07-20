'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireAdminSession } from '@/lib/admin/access';
import { createAuditLog } from '@/lib/audit-log/service';
import { prisma } from '@/lib/prisma';
import { normalizeTaxonomyName, taxonomySlug } from '@/lib/vehicles/taxonomy-normalization';

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === 'string' ? entry.trim() : '';
}

function order(formData: FormData) {
  const parsed = Number(value(formData, 'sortOrder'));
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function redirectWithResult(path: string, result: string): never {
  redirect(`${path}?result=${result}`);
}

function revalidateDirectories() {
  revalidatePath('/admin/directories');
  revalidatePath('/admin/directories/equipment-types');
  revalidatePath('/admin/directories/manufacturers');
  revalidatePath('/request');
  revalidatePath('/client/vehicles/new');
  revalidatePath('/admin/used-equipment/items/new');
}

export async function createEquipmentType(formData: FormData) {
  const session = await requireAdminSession();
  const name = value(formData, 'name').replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 120) redirectWithResult('/admin/directories/equipment-types', 'validation');
  const normalizedName = normalizeTaxonomyName(name);
  const exists = await prisma.equipmentType.findUnique({ where: { normalizedName }, select: { id: true } });
  if (exists) redirectWithResult('/admin/directories/equipment-types', 'duplicate');

  let slug = taxonomySlug(name);
  const slugExists = await prisma.equipmentType.findUnique({ where: { slug }, select: { id: true } });
  if (slugExists) slug = `${slug}-${Date.now().toString(36)}`;
  await prisma.$transaction(async (tx) => {
    const created = await tx.equipmentType.create({ data: { name, normalizedName, slug, sortOrder: order(formData) } });
    await createAuditLog(tx, {
      actorId: session.user.id, entityType: 'EQUIPMENT_TYPE', entityId: created.id, action: 'ENTITY_UPDATED',
      newValue: { name: created.name, slug: created.slug, isActive: created.isActive, sortOrder: created.sortOrder },
      metadata: { event: 'EQUIPMENT_TYPE_CREATED', actorRole: session.user.role }
    });
  });
  revalidateDirectories();
  redirectWithResult('/admin/directories/equipment-types', 'created');
}

export async function updateEquipmentType(formData: FormData) {
  const session = await requireAdminSession();
  const id = value(formData, 'id');
  const name = value(formData, 'name').replace(/\s+/g, ' ');
  const slug = value(formData, 'slug').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!id || name.length < 2 || !slug) redirectWithResult('/admin/directories/equipment-types', 'validation');
  const current = await prisma.equipmentType.findUnique({ where: { id } });
  if (!current) redirectWithResult('/admin/directories/equipment-types', 'not-found');
  const duplicate = await prisma.equipmentType.findFirst({
    where: { id: { not: id }, OR: [{ normalizedName: normalizeTaxonomyName(name) }, { slug }] },
    select: { id: true }
  });
  if (duplicate) redirectWithResult('/admin/directories/equipment-types', 'duplicate');
  const next = { name, normalizedName: normalizeTaxonomyName(name), slug, isActive: value(formData, 'isActive') === 'on', sortOrder: order(formData) };
  if (current.name === next.name && current.slug === next.slug && current.isActive === next.isActive && current.sortOrder === next.sortOrder) {
    redirectWithResult('/admin/directories/equipment-types', 'unchanged');
  }
  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.equipmentType.update({ where: { id }, data: next });
      await createAuditLog(tx, {
        actorId: session.user.id, entityType: 'EQUIPMENT_TYPE', entityId: id, action: 'ENTITY_UPDATED',
        oldValue: { name: current.name, slug: current.slug, isActive: current.isActive, sortOrder: current.sortOrder },
        newValue: { name: updated.name, slug: updated.slug, isActive: updated.isActive, sortOrder: updated.sortOrder },
        metadata: { event: current.isActive !== updated.isActive ? 'EQUIPMENT_TYPE_ACTIVATION_CHANGED' : current.sortOrder !== updated.sortOrder ? 'EQUIPMENT_TYPE_ORDER_CHANGED' : 'EQUIPMENT_TYPE_UPDATED', actorRole: session.user.role }
      });
    });
  } catch {
    redirectWithResult('/admin/directories/equipment-types', 'duplicate');
  }
  revalidateDirectories();
  redirectWithResult('/admin/directories/equipment-types', 'updated');
}

export async function createManufacturer(formData: FormData) {
  const session = await requireAdminSession();
  const name = value(formData, 'name').replace(/\s+/g, ' ');
  const typeIds = formData.getAll('equipmentTypeIds').filter((item): item is string => typeof item === 'string');
  if (name.length < 2 || name.length > 120) redirectWithResult('/admin/directories/manufacturers', 'validation');
  const existing = await prisma.manufacturer.findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, select: { id: true } });
  if (existing) redirectWithResult('/admin/directories/manufacturers', 'duplicate');
  let slug = taxonomySlug(name);
  if (await prisma.manufacturer.findFirst({ where: { slug }, select: { id: true } })) slug = `${slug}-${Date.now().toString(36)}`;
  const validTypes = await prisma.equipmentType.findMany({ where: { id: { in: typeIds } }, select: { id: true } });
  await prisma.$transaction(async (tx) => {
    const created = await tx.manufacturer.create({
      data: { name, slug, sortOrder: order(formData), equipmentTypes: { create: validTypes.map((type) => ({ equipmentTypeId: type.id })) } }
    });
    await createAuditLog(tx, {
      actorId: session.user.id, entityType: 'MANUFACTURER', entityId: created.id, action: 'ENTITY_UPDATED',
      newValue: { name: created.name, isActive: created.isActive, sortOrder: created.sortOrder, equipmentTypeIds: validTypes.map((type) => type.id) },
      metadata: { event: 'MANUFACTURER_CREATED', actorRole: session.user.role }
    });
  });
  revalidateDirectories();
  redirectWithResult('/admin/directories/manufacturers', 'created');
}

export async function updateManufacturer(formData: FormData) {
  const session = await requireAdminSession();
  const id = value(formData, 'id');
  const name = value(formData, 'name').replace(/\s+/g, ' ');
  const typeIds = [...new Set(formData.getAll('equipmentTypeIds').filter((item): item is string => typeof item === 'string'))];
  if (!id || name.length < 2 || name.length > 120) redirectWithResult('/admin/directories/manufacturers', 'validation');
  const current = await prisma.manufacturer.findUnique({
    where: { id },
    include: { equipmentTypes: { select: { equipmentTypeId: true } } }
  });
  if (!current) redirectWithResult('/admin/directories/manufacturers', 'not-found');
  const duplicate = await prisma.manufacturer.findFirst({
    where: { id: { not: id }, name: { equals: name, mode: 'insensitive' } },
    select: { id: true }
  });
  if (duplicate) redirectWithResult('/admin/directories/manufacturers', 'duplicate');
  const validTypes = await prisma.equipmentType.findMany({ where: { id: { in: typeIds } }, select: { id: true } });
  const nextTypeIds = validTypes.map((type) => type.id).sort();
  const oldTypeIds = current.equipmentTypes.map((type) => type.equipmentTypeId).sort();
  const next = { name, isActive: value(formData, 'isActive') === 'on', sortOrder: order(formData) };
  const typesChanged = nextTypeIds.join('|') !== oldTypeIds.join('|');
  if (current.name === next.name && current.isActive === next.isActive && current.sortOrder === next.sortOrder && !typesChanged) {
    redirectWithResult('/admin/directories/manufacturers', 'unchanged');
  }
  await prisma.$transaction(async (tx) => {
    const updated = await tx.manufacturer.update({ where: { id }, data: next });
    if (typesChanged) {
      await tx.manufacturerEquipmentType.deleteMany({ where: { manufacturerId: id } });
      if (nextTypeIds.length) await tx.manufacturerEquipmentType.createMany({ data: nextTypeIds.map((equipmentTypeId) => ({ manufacturerId: id, equipmentTypeId })) });
    }
    await createAuditLog(tx, {
      actorId: session.user.id, entityType: 'MANUFACTURER', entityId: id, action: 'ENTITY_UPDATED',
      oldValue: { name: current.name, isActive: current.isActive, sortOrder: current.sortOrder, equipmentTypeIds: oldTypeIds },
      newValue: { name: updated.name, isActive: updated.isActive, sortOrder: updated.sortOrder, equipmentTypeIds: nextTypeIds },
      metadata: { event: typesChanged ? 'MANUFACTURER_TYPES_CHANGED' : current.isActive !== updated.isActive ? 'MANUFACTURER_ACTIVATION_CHANGED' : current.sortOrder !== updated.sortOrder ? 'MANUFACTURER_ORDER_CHANGED' : 'MANUFACTURER_UPDATED', actorRole: session.user.role }
    });
  });
  revalidateDirectories();
  redirectWithResult('/admin/directories/manufacturers', 'updated');
}
