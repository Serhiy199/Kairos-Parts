'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';

import { requireAdminSession, requireCrmSession } from '@/lib/admin/access';
import { buildAuditDiff } from '@/lib/audit-log/payload';
import { getServerAuditRequestContext } from '@/lib/audit-log/request-context';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import { parseCompanyBillingInput } from '@/lib/billing/validation';
import { parseCompanyInput, readCompanyMemberInput } from '@/lib/companies/validation';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';
import { findVehicleVinDuplicate } from '@/lib/vehicles/duplicates';
import { vehicleOwnershipForCompany } from '@/lib/vehicles/ownership';
import { normalizeVehicleVin } from '@/lib/vehicles/vin';

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function redirectCompany(companyId: string, result: string): never {
  redirect(`/admin/companies/${companyId}?result=${result}`);
}

const COMPANY_FIELDS = ['name', 'edrpou', 'phone', 'email', 'legalAddress'] as const;
const BILLING_FIELDS = [
  'legalName', 'edrpou', 'ipn', 'iban', 'bankName', 'legalAddress',
  'contactPerson', 'phone', 'email', 'vatPayer'
] as const;
const MEMBER_FIELDS = ['userId', 'name', 'email', 'isPrimaryContact'] as const;

function companySnapshot(company: {
  name: string; edrpou: string | null; phone: string | null; email: string | null; legalAddress: string | null;
}) {
  return {
    name: company.name,
    edrpou: company.edrpou,
    phone: company.phone,
    email: company.email,
    legalAddress: company.legalAddress
  };
}

export async function createCompany(formData: FormData) {
  await requireCrmSession();

  if (!hasDatabaseUrl()) {
    redirect('/admin/companies?result=database');
  }

  const parsed = parseCompanyInput(formData);

  if (!parsed.ok) {
    redirect('/admin/companies?result=validation');
  }

  if (parsed.data.edrpou) {
    const duplicate = await prisma.company.findFirst({
      where: { name: parsed.data.name, edrpou: parsed.data.edrpou },
      select: { id: true }
    });

    if (duplicate) {
      redirect('/admin/companies?result=duplicate');
    }
  }

  const company = await prisma.company.create({
    data: parsed.data,
    select: { id: true }
  });

  revalidatePath('/admin/companies');
  redirectCompany(company.id, 'created');
}

export async function updateCompany(formData: FormData) {
  const session = await requireCrmSession();

  const companyId = readString(formData, 'companyId');
  const parsed = parseCompanyInput(formData);

  if (!hasDatabaseUrl() || !companyId || !parsed.ok) {
    redirect(companyId ? `/admin/companies/${companyId}?result=validation` : '/admin/companies?result=validation');
  }

  if (parsed.data.edrpou) {
    const duplicate = await prisma.company.findFirst({
      where: {
        name: parsed.data.name,
        edrpou: parsed.data.edrpou,
        NOT: { id: companyId }
      },
      select: { id: true }
    });

    if (duplicate) {
      redirectCompany(companyId, 'duplicate');
    }
  }

  const existing = await prisma.company.findUnique({ where: { id: companyId } });
  if (!existing) notFound();

  const requestContext = await getServerAuditRequestContext();
  await prisma.$transaction(async (tx) => {
    const updated = await tx.company.update({ where: { id: companyId }, data: parsed.data });
    const before = companySnapshot(existing);
    const after = companySnapshot(updated);
    const diff = buildAuditDiff(before, after, COMPANY_FIELDS);
    const financialChanged = before.name !== after.name
      || before.edrpou !== after.edrpou
      || before.legalAddress !== after.legalAddress;
    await writeAuditLog(tx, {
      actor: auditUserActor(session.user.id),
      companyId,
      entityType: 'COMPANY',
      entityId: companyId,
      entityLabel: updated.name,
      action: 'COMPANY_UPDATED',
      category: financialChanged ? 'FINANCIAL_CRITICAL' : 'STANDARD',
      oldValue: diff.before,
      newValue: diff.after,
      metadata: { source: 'ADMIN_CRM' },
      allowedFields: { oldValue: COMPANY_FIELDS, newValue: COMPANY_FIELDS, metadata: ['source'] },
      requestContext
    });
  });

  revalidatePath('/admin/companies');
  revalidatePath(`/admin/companies/${companyId}`);
  redirectCompany(companyId, 'updated');
}

export async function updateCompanyBillingDetails(formData: FormData) {
  const session = await requireCrmSession();

  const companyId = readString(formData, 'companyId');
  const parsed = parseCompanyBillingInput(formData);

  if (!hasDatabaseUrl() || !companyId || !parsed.ok) {
    redirectCompany(companyId, 'billing-validation');
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, billingDetails: true }
  });

  if (!company) {
    notFound();
  }

  const requestContext = await getServerAuditRequestContext();
  await prisma.$transaction(async (tx) => {
    const updated = await tx.companyBillingDetails.upsert({
      where: { companyId },
      update: parsed.data,
      create: { companyId, ...parsed.data }
    });
    const diff = buildAuditDiff(company.billingDetails ?? {}, updated, BILLING_FIELDS);
    await writeAuditLog(tx, {
      actor: auditUserActor(session.user.id),
      companyId,
      entityType: 'COMPANY',
      entityId: companyId,
      entityLabel: company.name,
      action: 'COMPANY_BILLING_UPDATED',
      category: 'FINANCIAL_CRITICAL',
      oldValue: diff.before,
      newValue: diff.after,
      metadata: { source: 'ADMIN_CRM' },
      allowedFields: { oldValue: BILLING_FIELDS, newValue: BILLING_FIELDS, metadata: ['source'] },
      requestContext
    });
  });

  revalidatePath('/admin/companies');
  revalidatePath(`/admin/companies/${companyId}`);
  redirectCompany(companyId, 'billing-updated');
}

export async function addCompanyMember(formData: FormData) {
  const session = await requireCrmSession();

  const companyId = readString(formData, 'companyId');
  const input = readCompanyMemberInput(formData);

  if (!hasDatabaseUrl() || !companyId || !input.userId) {
    redirectCompany(companyId, 'member-validation');
  }

  const [company, user] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true } }),
    prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companyMemberships: { select: { id: true } }
      }
    })
  ]);

  if (!company) {
    notFound();
  }

  if (!user || user.role !== 'CLIENT') {
    redirectCompany(companyId, 'member-not-client');
  }

  if (user.companyMemberships.length > 0) {
    redirectCompany(companyId, 'member-already-linked');
  }

  const requestContext = await getServerAuditRequestContext();
  await prisma.$transaction(async (tx) => {
    if (input.isPrimaryContact) {
      await tx.companyMember.updateMany({
        where: { companyId },
        data: { isPrimaryContact: false }
      });
    }

    const member = await tx.companyMember.create({
      data: {
        companyId,
        userId: user.id,
        isPrimaryContact: input.isPrimaryContact
      }
    });
    await writeAuditLog(tx, {
      actor: auditUserActor(session.user.id),
      companyId,
      entityType: 'COMPANY',
      entityId: companyId,
      entityLabel: company.name,
      action: 'COMPANY_MEMBER_ADDED',
      category: 'STANDARD',
      newValue: {
        userId: user.id,
        name: user.name,
        email: user.email,
        isPrimaryContact: member.isPrimaryContact
      },
      metadata: { source: 'ADMIN_CRM' },
      allowedFields: { newValue: MEMBER_FIELDS, metadata: ['source'] },
      requestContext
    });
  });

  revalidatePath('/admin/companies');
  revalidatePath(`/admin/companies/${companyId}`);
  redirectCompany(companyId, 'member-added');
}

export async function removeCompanyMember(formData: FormData) {
  const session = await requireCrmSession();

  const companyId = readString(formData, 'companyId');
  const memberId = readString(formData, 'memberId');

  if (!hasDatabaseUrl() || !companyId || !memberId) {
    redirectCompany(companyId, 'member-validation');
  }

  const member = await prisma.companyMember.findFirst({
    where: { id: memberId, companyId },
    select: {
      id: true,
      userId: true,
      isPrimaryContact: true,
      user: { select: { name: true, email: true } },
      company: { select: { name: true } }
    }
  });

  if (member) {
    const requestContext = await getServerAuditRequestContext();
    await prisma.$transaction(async (tx) => {
      await tx.companyMember.delete({ where: { id: member.id } });
      await writeAuditLog(tx, {
        actor: auditUserActor(session.user.id),
        companyId,
        entityType: 'COMPANY',
        entityId: companyId,
        entityLabel: member.company.name,
        action: 'COMPANY_MEMBER_REMOVED',
        category: 'STANDARD',
        oldValue: {
          userId: member.userId,
          name: member.user.name,
          email: member.user.email,
          isPrimaryContact: member.isPrimaryContact
        },
        metadata: { source: 'ADMIN_CRM' },
        allowedFields: { oldValue: MEMBER_FIELDS, metadata: ['source'] },
        requestContext
      });
    });
  }

  revalidatePath('/admin/companies');
  revalidatePath(`/admin/companies/${companyId}`);
  redirectCompany(companyId, 'member-removed');
}

export async function setPrimaryCompanyMember(formData: FormData) {
  const session = await requireCrmSession();

  const companyId = readString(formData, 'companyId');
  const memberId = readString(formData, 'memberId');

  if (!hasDatabaseUrl() || !companyId || !memberId) {
    redirectCompany(companyId, 'member-validation');
  }

  const member = await prisma.companyMember.findFirst({
    where: { id: memberId, companyId },
    select: {
      id: true,
      userId: true,
      user: { select: { name: true, email: true } },
      company: {
        select: {
          name: true,
          members: {
            where: { isPrimaryContact: true },
            take: 1,
            select: { userId: true, user: { select: { name: true, email: true } } }
          }
        }
      }
    }
  });

  if (!member) {
    redirectCompany(companyId, 'member-not-found');
  }

  const previous = member.company.members[0] ?? null;
  const requestContext = await getServerAuditRequestContext();
  await prisma.$transaction(async (tx) => {
    await tx.companyMember.updateMany({ where: { companyId }, data: { isPrimaryContact: false } });
    await tx.companyMember.update({ where: { id: member.id }, data: { isPrimaryContact: true } });
    await writeAuditLog(tx, {
      actor: auditUserActor(session.user.id),
      companyId,
      entityType: 'COMPANY',
      entityId: companyId,
      entityLabel: member.company.name,
      action: 'COMPANY_PRIMARY_CONTACT_CHANGED',
      category: 'STANDARD',
      oldValue: previous ? {
        userId: previous.userId,
        name: previous.user.name,
        email: previous.user.email,
        isPrimaryContact: true
      } : { userId: null, name: null, email: null, isPrimaryContact: false },
      newValue: {
        userId: member.userId,
        name: member.user.name,
        email: member.user.email,
        isPrimaryContact: true
      },
      metadata: { source: 'ADMIN_CRM' },
      allowedFields: { oldValue: MEMBER_FIELDS, newValue: MEMBER_FIELDS, metadata: ['source'] },
      requestContext
    });
  });

  revalidatePath(`/admin/companies/${companyId}`);
  redirectCompany(companyId, 'primary-updated');
}

export async function assignRequestToCompany(formData: FormData) {
  const session = await requireCrmSession();

  const companyId = readString(formData, 'companyId');
  const requestId = readString(formData, 'requestId');

  if (!hasDatabaseUrl() || !companyId || !requestId) {
    redirectCompany(companyId, 'assign-validation');
  }

  const [request, company] = await Promise.all([
    prisma.request.findUnique({
      where: { id: requestId },
      select: { id: true, requestNumber: true, companyId: true, company: { select: { name: true } } }
    }),
    prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true } })
  ]);

  if (!request || !company) {
    redirectCompany(companyId, 'assign-validation');
  }

  const requestContext = await getServerAuditRequestContext();
  await prisma.$transaction(async (tx) => {
    await tx.request.update({ where: { id: request.id }, data: { companyId: company.id } });
    await writeAuditLog(tx, {
      actor: auditUserActor(session.user.id),
      companyId: company.id,
      entityType: 'REQUEST',
      entityId: request.id,
      entityLabel: `Заявка ${request.requestNumber}`,
      action: 'REQUEST_COMPANY_CHANGED',
      category: 'STANDARD',
      oldValue: { companyId: request.companyId, companyName: request.company?.name ?? null },
      newValue: { companyId: company.id, companyName: company.name },
      metadata: { source: 'ADMIN_CRM' },
      allowedFields: {
        oldValue: ['companyId', 'companyName'],
        newValue: ['companyId', 'companyName'],
        metadata: ['source']
      },
      requestContext
    });
  });

  revalidatePath('/admin/requests');
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath(`/admin/companies/${companyId}`);
  redirectCompany(companyId, 'request-assigned');
}

export async function assignVehicleToCompany(formData: FormData) {
  const session = await requireAdminSession();

  const companyId = readString(formData, 'companyId');
  const vehicleId = readString(formData, 'vehicleId');

  if (!hasDatabaseUrl() || !companyId || !vehicleId) {
    redirectCompany(companyId, 'assign-validation');
  }

  const [company, vehicle] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { id: true } }),
    prisma.vehicle.findFirst({
      where: { id: vehicleId, clientId: { not: null }, companyId: null },
      select: { id: true, clientId: true, vinOrSerial: true }
    })
  ]);

  if (!company || !vehicle) {
    redirectCompany(companyId, 'assign-validation');
  }

  const owner = vehicleOwnershipForCompany(company.id);
  const normalizedVin = normalizeVehicleVin(vehicle.vinOrSerial);
  const duplicate = await prisma.$transaction(async (tx) => {
    const found = await findVehicleVinDuplicate({
      db: tx,
      owner,
      normalizedVin
    });

    if (found) {
      return true;
    }

    await tx.vehicle.update({
      where: { id: vehicle.id },
      data: { ...owner, vinOrSerial: normalizedVin }
    });

    await writeAuditLog(tx, {
      actor: auditUserActor(session.user.id),
      companyId: company.id,
      entityType: 'VEHICLE',
      entityId: vehicle.id,
      action: 'ENTITY_UPDATED',
      category: 'STANDARD',
      oldValue: { ownerType: 'client', ownerId: vehicle.clientId },
      newValue: { ownerType: 'company', ownerId: company.id },
      metadata: {
        event: 'VEHICLE_OWNER_TRANSFERRED',
        actorRole: session.user.role
      },
      allowedFields: {
        oldValue: ['ownerType', 'ownerId'],
        newValue: ['ownerType', 'ownerId'],
        metadata: ['event', 'actorRole']
      }
    });
    return false;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  if (duplicate) {
    redirectCompany(companyId, 'vehicle-vin-duplicate');
  }

  revalidatePath('/admin/companies');
  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath(`/admin/clients/${vehicle.clientId}`);
  revalidatePath('/client/vehicles');
  revalidatePath(`/client/vehicles/${vehicle.id}`);
  redirectCompany(companyId, 'vehicle-assigned');
}
