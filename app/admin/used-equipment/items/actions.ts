'use server';

import { redirect } from 'next/navigation';

import {
  cleanupCloudinaryAssets,
  deleteCloudinaryAsset,
  hasCloudinaryConfig,
  uploadUsedEquipmentImage,
  type CloudinaryUsedEquipmentUpload
} from '@/lib/cloudinary/server';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';
import {
  canUseUsedEquipmentStatusWithImageCount,
  getCreatePrimaryIndex,
  getUsedEquipmentImageFiles,
  mapUploadToImageCreateInput,
  parseUsedEquipmentImageKeys,
  validateUsedEquipmentImageFiles
} from '@/lib/used-equipment/images';
import { generateUniqueUsedEquipmentSlug } from '@/lib/used-equipment/slug';
import { resolveUsedEquipmentStatusDates } from '@/lib/used-equipment/status-dates';
import {
  getUsedEquipmentFormValues,
  type UsedEquipmentFormState,
  validateUsedEquipmentForm
} from '@/lib/used-equipment/validation';
import { getManufacturersForEquipmentType } from '@/lib/vehicles/equipment-manufacturers';

function serverError(values: ReturnType<typeof getUsedEquipmentFormValues>, message = 'Не вдалося зберегти техніку. Спробуйте ще раз.') {
  return {
    status: 'error' as const,
    message,
    values
  };
}

async function validateManufacturer(manufacturerId: string, equipmentType: string) {
  const manufacturer = await prisma.manufacturer.findUnique({
    where: { id: manufacturerId },
    select: { id: true, name: true }
  });

  if (!manufacturer) {
    return { ok: false as const, message: 'Оберіть виробника зі списку.' };
  }

  const allowedManufacturerNames = getManufacturersForEquipmentType(equipmentType).map((name) => name.toLocaleLowerCase('uk-UA'));
  if (!allowedManufacturerNames.includes(manufacturer.name.toLocaleLowerCase('uk-UA'))) {
    return { ok: false as const, message: 'Обраний виробник не відповідає типу техніки.' };
  }

  return { ok: true as const, manufacturer };
}

function imageError(values: ReturnType<typeof getUsedEquipmentFormValues>, message: string): UsedEquipmentFormState {
  return {
    status: 'error',
    message,
    values,
    fieldErrors: {
      images: message
    }
  };
}

async function deleteEquipmentBestEffort(equipmentId: string) {
  try {
    await prisma.usedEquipment.delete({ where: { id: equipmentId } });
  } catch {
    // The UI reports the original failure; cleanup is best-effort.
  }
}

export async function createUsedEquipment(_state: UsedEquipmentFormState, formData: FormData): Promise<UsedEquipmentFormState> {
  const session = await requireCrmSession();
  const values = getUsedEquipmentFormValues(formData, 'DRAFT');

  if (!hasDatabaseUrl()) {
    return serverError(values, 'База даних не налаштована.');
  }

  const validation = validateUsedEquipmentForm(values, { allowStatusEdit: false });
  if (!validation.ok) {
    return {
      status: 'error',
      message: 'Перевірте обов’язкові поля.',
      values,
      fieldErrors: validation.fieldErrors
    };
  }

  const files = getUsedEquipmentImageFiles(formData);
  const imageValidation = validateUsedEquipmentImageFiles(files, { existingCount: 0, requireAtLeastOne: true });
  if (!imageValidation.ok) {
    return imageError(values, imageValidation.message);
  }

  if (!hasCloudinaryConfig()) {
    return imageError(values, 'Cloudinary не налаштований. Додайте змінні CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY і CLOUDINARY_API_SECRET.');
  }

  const manufacturerResult = await validateManufacturer(validation.data.manufacturerId, validation.data.equipmentType);
  if (!manufacturerResult.ok) {
    return {
      status: 'error',
      message: 'Перевірте обов’язкові поля.',
      values,
      fieldErrors: {
        manufacturerId: manufacturerResult.message
      }
    };
  }

  const slug = await generateUniqueUsedEquipmentSlug(validation.data.title);
  const primaryIndex = getCreatePrimaryIndex(formData, files.length);
  let equipmentId: string | null = null;
  const uploadedPublicIds: string[] = [];

  try {
    const item = await prisma.usedEquipment.create({
      data: {
        title: validation.data.title,
        slug,
        equipmentType: validation.data.equipmentType,
        manufacturerId: manufacturerResult.manufacturer.id,
        manufacturerName: manufacturerResult.manufacturer.name,
        year: validation.data.year,
        description: validation.data.description,
        internalComment: validation.data.internalComment,
        status: 'DRAFT',
        createdById: session.user.id,
        updatedById: session.user.id,
        ...resolveUsedEquipmentStatusDates({ nextStatus: 'DRAFT' })
      },
      select: {
        id: true
      }
    });
    equipmentId = item.id;

    const uploads: CloudinaryUsedEquipmentUpload[] = [];
    for (const file of files) {
      const upload = await uploadUsedEquipmentImage(item.id, file);
      uploadedPublicIds.push(upload.publicId);
      uploads.push(upload);
    }

    await prisma.usedEquipmentImage.createMany({
      data: uploads.map((upload, index) =>
        mapUploadToImageCreateInput({
          upload,
          usedEquipmentId: item.id,
          alt: `${validation.data.title} — фото ${index + 1}`,
          sortOrder: index,
          isPrimary: index === primaryIndex
        })
      )
    });
  } catch {
    await cleanupCloudinaryAssets(uploadedPublicIds);
    if (equipmentId) {
      await deleteEquipmentBestEffort(equipmentId);
    }
    return serverError(values);
  }

  redirect('/admin/used-equipment/items');
}

export async function updateUsedEquipment(equipmentId: string, _state: UsedEquipmentFormState, formData: FormData): Promise<UsedEquipmentFormState> {
  const session = await requireCrmSession();
  const values = getUsedEquipmentFormValues(formData, 'DRAFT');

  if (!hasDatabaseUrl()) {
    return serverError(values, 'База даних не налаштована.');
  }

  const existingItem = await prisma.usedEquipment.findUnique({
    where: { id: equipmentId },
    select: {
      id: true,
      status: true,
      publishedAt: true,
      archivedAt: true,
      images: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          cloudinaryPublicId: true,
          sortOrder: true,
          isPrimary: true
        }
      }
    }
  });

  if (!existingItem) {
    return serverError(values, 'Техніку не знайдено.');
  }

  const validation = validateUsedEquipmentForm(values, { allowStatusEdit: true });
  if (!validation.ok) {
    return {
      status: 'error',
      message: 'Перевірте обов’язкові поля.',
      values,
      fieldErrors: validation.fieldErrors
    };
  }

  const files = getUsedEquipmentImageFiles(formData);
  const imageKeys = parseUsedEquipmentImageKeys(formData, existingItem.images, files);
  const finalImageCount = imageKeys.orderedKeys.length;
  const imageValidation = validateUsedEquipmentImageFiles(files, { existingCount: finalImageCount - files.length, requireAtLeastOne: false });

  if (!imageValidation.ok) {
    return imageError(values, imageValidation.message);
  }

  if (!canUseUsedEquipmentStatusWithImageCount(validation.data.status, finalImageCount)) {
    return {
      status: 'error',
      message: 'Для публікації потрібно додати фото техніки.',
      values,
      fieldErrors: {
        status: 'Без фото доступні тільки статуси “Чернетка” або “Архівовано”.',
        images: 'Додайте хоча б одне фото або залиште статус “Чернетка” / “Архівовано”.'
      }
    };
  }

  if (files.length > 0 && !hasCloudinaryConfig()) {
    return imageError(values, 'Cloudinary не налаштований. Додайте змінні CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY і CLOUDINARY_API_SECRET.');
  }

  const manufacturerResult = await validateManufacturer(validation.data.manufacturerId, validation.data.equipmentType);
  if (!manufacturerResult.ok) {
    return {
      status: 'error',
      message: 'Перевірте обов’язкові поля.',
      values,
      fieldErrors: {
        manufacturerId: manufacturerResult.message
      }
    };
  }

  const deletedPublicIds = existingItem.images
    .filter((image) => imageKeys.deletedIds.has(image.id))
    .map((image) => image.cloudinaryPublicId);
  const uploadedPublicIds: string[] = [];

  try {
    const uploads: CloudinaryUsedEquipmentUpload[] = [];
    for (const file of files) {
      const upload = await uploadUsedEquipmentImage(equipmentId, file);
      uploadedPublicIds.push(upload.publicId);
      uploads.push(upload);
    }

    await prisma.$transaction(async (tx) => {
      await tx.usedEquipment.update({
        where: { id: equipmentId },
        data: {
          title: validation.data.title,
          equipmentType: validation.data.equipmentType,
          manufacturerId: manufacturerResult.manufacturer.id,
          manufacturerName: manufacturerResult.manufacturer.name,
          year: validation.data.year,
          description: validation.data.description,
          internalComment: validation.data.internalComment,
          status: validation.data.status,
          updatedById: session.user.id,
          ...resolveUsedEquipmentStatusDates({
            nextStatus: validation.data.status,
            previous: {
              publishedAt: existingItem.publishedAt,
              archivedAt: existingItem.archivedAt
            }
          })
        }
      });

      if (imageKeys.deletedIds.size > 0) {
        await tx.usedEquipmentImage.deleteMany({
          where: {
            usedEquipmentId: equipmentId,
            id: {
              in: Array.from(imageKeys.deletedIds)
            }
          }
        });
      }

      await Promise.all(
        imageKeys.orderedKeys
          .filter((key) => key.startsWith('existing:'))
          .map((key) =>
            tx.usedEquipmentImage.updateMany({
              where: {
                id: key.slice('existing:'.length),
                usedEquipmentId: equipmentId
              },
              data: {
                sortOrder: imageKeys.orderedKeys.indexOf(key),
                isPrimary: imageKeys.primaryImageKey === key
              }
            })
          )
      );

      if (uploads.length > 0) {
        await tx.usedEquipmentImage.createMany({
          data: uploads.map((upload, newIndex) => {
            const key = `new:${newIndex}` as const;
            return mapUploadToImageCreateInput({
              upload,
              usedEquipmentId: equipmentId,
              alt: `${validation.data.title} — фото ${imageKeys.orderedKeys.indexOf(key) + 1}`,
              sortOrder: imageKeys.orderedKeys.indexOf(key),
              isPrimary: imageKeys.primaryImageKey === key
            });
          })
        });
      }
    });
  } catch {
    await cleanupCloudinaryAssets(uploadedPublicIds);
    return serverError(values);
  }

  await Promise.allSettled(deletedPublicIds.map((publicId) => deleteCloudinaryAsset(publicId)));

  redirect('/admin/used-equipment/items');
}
