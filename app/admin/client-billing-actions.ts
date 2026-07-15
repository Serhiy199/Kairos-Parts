'use server';

import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';

import { requireCrmSession } from '@/lib/admin/access';
import { parseClientBillingInput } from '@/lib/billing/validation';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function redirectClient(clientProfileId: string, result: string): never {
  redirect(`/admin/clients/${clientProfileId}?result=${result}`);
}

export async function upsertClientBillingDetails(formData: FormData) {
  await requireCrmSession();

  const clientProfileId = readString(formData, 'clientProfileId');
  const parsed = parseClientBillingInput(formData);

  if (!hasDatabaseUrl() || !clientProfileId || !parsed.ok) {
    redirectClient(clientProfileId, 'billing-validation');
  }

  const clientProfile = await prisma.clientProfile.findUnique({
    where: { id: clientProfileId },
    select: { id: true }
  });

  if (!clientProfile) {
    notFound();
  }

  await prisma.clientBillingDetails.upsert({
    where: { clientProfileId },
    update: parsed.data,
    create: {
      clientProfileId,
      ...parsed.data
    }
  });

  revalidatePath('/admin/clients');
  revalidatePath(`/admin/clients/${clientProfileId}`);
  redirectClient(clientProfileId, 'billing-updated');
}
