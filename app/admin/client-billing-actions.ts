'use server';

import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';

import { requireCrmSession } from '@/lib/admin/access';
import { buildAuditDiff } from '@/lib/audit-log/payload';
import { getServerAuditRequestContext } from '@/lib/audit-log/request-context';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
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

const CLIENT_BILLING_FIELDS = [
  'legalName', 'edrpou', 'ipn', 'iban', 'bankName', 'legalAddress',
  'contactPerson', 'phone', 'email', 'vatPayer'
] as const;

export async function upsertClientBillingDetails(formData: FormData) {
  const session = await requireCrmSession();

  const clientProfileId = readString(formData, 'clientProfileId');
  const parsed = parseClientBillingInput(formData);

  if (!hasDatabaseUrl() || !clientProfileId || !parsed.ok) {
    redirectClient(clientProfileId, 'billing-validation');
  }

  const clientProfile = await prisma.clientProfile.findUnique({
    where: { id: clientProfileId },
    select: {
      id: true,
      contactName: true,
      companyName: true,
      userId: true,
      billingDetails: true,
      user: { select: { name: true, email: true } }
    }
  });

  if (!clientProfile) {
    notFound();
  }

  const requestContext = await getServerAuditRequestContext();
  await prisma.$transaction(async (tx) => {
    const updated = await tx.clientBillingDetails.upsert({
      where: { clientProfileId },
      update: parsed.data,
      create: { clientProfileId, ...parsed.data }
    });
    const diff = buildAuditDiff(clientProfile.billingDetails ?? {}, updated, CLIENT_BILLING_FIELDS);
    await writeAuditLog(tx, {
      actor: auditUserActor(session.user.id),
      entityType: 'CLIENT',
      entityId: clientProfile.id,
      entityLabel: clientProfile.companyName
        ?? clientProfile.contactName
        ?? clientProfile.user.name
        ?? clientProfile.user.email
        ?? 'Клієнт',
      action: 'CLIENT_BILLING_UPDATED',
      category: 'FINANCIAL_CRITICAL',
      oldValue: diff.before,
      newValue: diff.after,
      metadata: { source: 'ADMIN_CRM', userId: clientProfile.userId },
      allowedFields: {
        oldValue: CLIENT_BILLING_FIELDS,
        newValue: CLIENT_BILLING_FIELDS,
        metadata: ['source', 'userId']
      },
      requestContext
    });
  });

  revalidatePath('/admin/clients');
  revalidatePath(`/admin/clients/${clientProfileId}`);
  redirectClient(clientProfileId, 'billing-updated');
}
