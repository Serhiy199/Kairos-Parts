'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';

import { requireCrmSession } from '@/lib/admin/access';
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
  await requireCrmSession();

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

  await prisma.company.update({
    where: { id: companyId },
    data: parsed.data
  });

  revalidatePath('/admin/companies');
  revalidatePath(`/admin/companies/${companyId}`);
  redirectCompany(companyId, 'updated');
}

export async function updateCompanyBillingDetails(formData: FormData) {
  await requireCrmSession();

  const companyId = readString(formData, 'companyId');
  const parsed = parseCompanyBillingInput(formData);

  if (!hasDatabaseUrl() || !companyId || !parsed.ok) {
    redirectCompany(companyId, 'billing-validation');
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true }
  });

  if (!company) {
    notFound();
  }

  await prisma.companyBillingDetails.upsert({
    where: { companyId },
    update: parsed.data,
    create: {
      companyId,
      ...parsed.data
    }
  });

  revalidatePath('/admin/companies');
  revalidatePath(`/admin/companies/${companyId}`);
  redirectCompany(companyId, 'billing-updated');
}

export async function addCompanyMember(formData: FormData) {
  await requireCrmSession();

  const companyId = readString(formData, 'companyId');
  const input = readCompanyMemberInput(formData);

  if (!hasDatabaseUrl() || !companyId || !input.userId) {
    redirectCompany(companyId, 'member-validation');
  }

  const [company, user] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { id: true } }),
    prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
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

  await prisma.$transaction(async (tx) => {
    if (input.isPrimaryContact) {
      await tx.companyMember.updateMany({
        where: { companyId },
        data: { isPrimaryContact: false }
      });
    }

    await tx.companyMember.create({
      data: {
        companyId,
        userId: user.id,
        isPrimaryContact: input.isPrimaryContact
      }
    });
  });

  revalidatePath('/admin/companies');
  revalidatePath(`/admin/companies/${companyId}`);
  redirectCompany(companyId, 'member-added');
}

export async function removeCompanyMember(formData: FormData) {
  await requireCrmSession();

  const companyId = readString(formData, 'companyId');
  const memberId = readString(formData, 'memberId');

  if (!hasDatabaseUrl() || !companyId || !memberId) {
    redirectCompany(companyId, 'member-validation');
  }

  await prisma.companyMember.deleteMany({
    where: { id: memberId, companyId }
  });

  revalidatePath('/admin/companies');
  revalidatePath(`/admin/companies/${companyId}`);
  redirectCompany(companyId, 'member-removed');
}

export async function setPrimaryCompanyMember(formData: FormData) {
  await requireCrmSession();

  const companyId = readString(formData, 'companyId');
  const memberId = readString(formData, 'memberId');

  if (!hasDatabaseUrl() || !companyId || !memberId) {
    redirectCompany(companyId, 'member-validation');
  }

  const member = await prisma.companyMember.findFirst({
    where: { id: memberId, companyId },
    select: { id: true }
  });

  if (!member) {
    redirectCompany(companyId, 'member-not-found');
  }

  await prisma.$transaction([
    prisma.companyMember.updateMany({ where: { companyId }, data: { isPrimaryContact: false } }),
    prisma.companyMember.update({ where: { id: member.id }, data: { isPrimaryContact: true } })
  ]);

  revalidatePath(`/admin/companies/${companyId}`);
  redirectCompany(companyId, 'primary-updated');
}

export async function assignRequestToCompany(formData: FormData) {
  await requireCrmSession();

  const companyId = readString(formData, 'companyId');
  const requestId = readString(formData, 'requestId');

  if (!hasDatabaseUrl() || !companyId || !requestId) {
    redirectCompany(companyId, 'assign-validation');
  }

  await prisma.request.update({
    where: { id: requestId },
    data: { companyId }
  });

  revalidatePath('/admin/requests');
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath(`/admin/companies/${companyId}`);
  redirectCompany(companyId, 'request-assigned');
}

export async function assignVehicleToCompany(formData: FormData) {
  await requireCrmSession();

  const companyId = readString(formData, 'companyId');
  const vehicleId = readString(formData, 'vehicleId');

  if (!hasDatabaseUrl() || !companyId || !vehicleId) {
    redirectCompany(companyId, 'assign-validation');
  }

  const [company, vehicle] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { id: true } }),
    prisma.vehicle.findFirst({
      where: { id: vehicleId, clientId: { not: null }, companyId: null },
      select: { id: true, vinOrSerial: true }
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
    return false;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  if (duplicate) {
    redirectCompany(companyId, 'vehicle-vin-duplicate');
  }

  revalidatePath('/admin/companies');
  revalidatePath(`/admin/companies/${companyId}`);
  redirectCompany(companyId, 'vehicle-assigned');
}
