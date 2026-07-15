'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireAdminSession } from '@/lib/admin/access';
import { parseSellerBillingInput } from '@/lib/billing/validation';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';

export async function saveSellerBillingDetails(formData: FormData) {
  await requireAdminSession();

  if (!hasDatabaseUrl()) {
    redirect('/admin/billing-settings?result=database');
  }

  const parsed = parseSellerBillingInput(formData);

  if (!parsed.ok) {
    redirect('/admin/billing-settings?result=validation');
  }

  const existing = await prisma.sellerBillingDetails.findFirst({
    where: { isDefault: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true }
  });

  if (existing) {
    await prisma.sellerBillingDetails.update({
      where: { id: existing.id },
      data: { ...parsed.data, isDefault: true }
    });
  } else {
    await prisma.sellerBillingDetails.create({
      data: { ...parsed.data, isDefault: true }
    });
  }

  revalidatePath('/admin/billing-settings');
  revalidatePath('/admin/requests');
  redirect('/admin/billing-settings?result=saved');
}
