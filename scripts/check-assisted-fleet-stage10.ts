import { config } from 'dotenv';
import assert from 'node:assert/strict';

import {
  diffVehicleFields,
  isEditableVehicleField,
  normalizeEditableVehicleValue
} from '../lib/vehicles/change-snapshot';

config({ path: '.env.local', quiet: true });

const FORBIDDEN_OWNER_KEYS = ['clientId', 'companyId', 'ownerId', 'ownerType'];

function hasForbiddenOwnerKey(value: unknown) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      FORBIDDEN_OWNER_KEYS.some((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

async function main() {
  assert.equal(isEditableVehicleField('model'), true);
  assert.equal(isEditableVehicleField('companyId'), false);
  assert.equal(normalizeEditableVehicleValue('vinOrSerial', ' ab-12 3 '), 'AB123');
  assert.equal(normalizeEditableVehicleValue('year', '2026'), 2026);
  assert.equal(normalizeEditableVehicleValue('year', 'invalid'), undefined);

  const snapshot = {
    type: 'Трактор',
    manufacturer: 'John Deere',
    model: '6155M',
    year: 2020,
    vinOrSerial: 'VIN1',
    comment: null
  };
  assert.deepEqual(diffVehicleFields(snapshot, snapshot).changedFields, []);
  assert.deepEqual(diffVehicleFields(snapshot, { ...snapshot, model: '6195M' }).changedFields, ['model']);

  const { prisma } = await import('../lib/prisma');
  const [vehicleAuditCount, vehicleRequests, approvedVehicleRequests, appliedVehicleAudits] = await Promise.all([
    prisma.auditLog.count({ where: { entityType: 'VEHICLE' } }),
    prisma.changeRequest.groupBy({
      by: ['status'],
      where: { entityType: 'VEHICLE' },
      _count: { _all: true }
    }),
    prisma.changeRequest.findMany({
      where: { entityType: 'VEHICLE', status: 'APPROVED' },
      select: { id: true, oldValue: true, newValue: true }
    }),
    prisma.auditLog.findMany({
      where: { entityType: 'VEHICLE', changeRequestId: { not: null } },
      select: { changeRequestId: true }
    })
  ]);

  const auditedRequestIds = new Set(appliedVehicleAudits.map((item) => item.changeRequestId));
  const result = {
    helperChecks: 'passed',
    vehicleAuditCount,
    vehicleChangeRequestsByStatus: Object.fromEntries(
      vehicleRequests.map((row) => [row.status, row._count._all])
    ),
    forbiddenOwnershipPayloads: approvedVehicleRequests.filter(
      (item) => hasForbiddenOwnerKey(item.oldValue) || hasForbiddenOwnerKey(item.newValue)
    ).length,
    approvedWithoutVehicleAudit: approvedVehicleRequests.filter(
      (item) => !auditedRequestIds.has(item.id)
    ).length
  };

  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Stage 10 audit failed.');
    process.exitCode = 1;
  });
