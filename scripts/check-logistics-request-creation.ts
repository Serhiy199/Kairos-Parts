import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Prisma } from '@prisma/client';

import {
  createLogisticsRequestInTransaction,
  logisticsIdempotencyIntentMatches,
  type PreparedLogisticsRequest
} from '../lib/logistics/create-request';
import {
  calculateAuthoritativeLogisticsPrice,
  serializeLogisticsMoney
} from '../lib/logistics/pricing';
import { calculateLogisticsPricePreview } from '../lib/logistics/pricing-preview';
import {
  LOGISTICS_CREATE_JSON_MAX_BYTES,
  parseLogisticsCreateInput,
  parseLogisticsQuoteInput,
  readBoundedLogisticsJson
} from '../lib/logistics/request-input';
import { LogisticsRequestError } from '../lib/logistics/request-errors';
import {
  logisticsRequestErrorResponse,
  logisticsRequestJson
} from '../lib/logistics/request-responses';
import { LOGISTICS_TARIFF_CITIES } from '../lib/logistics/tariff-cities';
import { prisma } from '../lib/prisma';

async function main() {
const root = process.cwd();
const source = (...segments: string[]) =>
  readFileSync(path.join(root, ...segments), 'utf8');

const quoteRouteSource = source('app', 'api', 'logistics', 'quote', 'route.ts');
const createRouteSource = source(
  'app',
  'api',
  'logistics',
  'requests',
  'route.ts'
);
const createServiceSource = source('lib', 'logistics', 'create-request.ts');
const requestServiceSource = source('lib', 'logistics', 'request-service.ts');
const accessSource = source('lib', 'logistics', 'access.ts');
const securitySource = source('lib', 'logistics', 'request-security.ts');
const formSource = source(
  'components',
  'public',
  'logistics',
  'logistics-request-form.tsx'
);
const featureSource = source('lib', 'features', 'logistics.ts');
const schemaSource = source('prisma', 'schema.prisma');

function expectRequestError(
  action: () => unknown,
  code: LogisticsRequestError['code']
) {
  assert.throws(
    action,
    (error: unknown) =>
      error instanceof LogisticsRequestError && error.code === code
  );
}

function decimalFromMinorUnits(minorUnits: number) {
  return new Prisma.Decimal(minorUnits).dividedBy(100);
}

const pricingCases = [
  ['MYRONIVKA', 1, 'KAIROS_BASE', 160_000],
  ['MYRONIVKA', 2, 'KAIROS_BASE', 210_000],
  ['MYRONIVKA', 3, 'KAIROS_BASE', 260_000],
  ['MYRONIVKA', 1, 'FARM', 210_000],
  ['KYIV_RIGHT_BANK', 3, 'FARM', 400_000]
] as const;

assert.equal(LOGISTICS_TARIFF_CITIES.length, 13);
for (const city of LOGISTICS_TARIFF_CITIES) {
  const authoritative = calculateAuthoritativeLogisticsPrice({
    baseTariff: decimalFromMinorUnits(city.previewPriceMinorUnits),
    pickupPointCount: 3,
    destinationType: 'FARM'
  });
  const preview = calculateLogisticsPricePreview(city.code, 3, 'FARM');
  assert.equal(
    authoritative.totalPrice.times(100).toNumber(),
    preview.totalMinorUnits,
    `Preview/server parity failed for ${city.code}.`
  );
}

for (const [code, pointCount, destination, expectedMinorUnits] of pricingCases) {
  const city = LOGISTICS_TARIFF_CITIES.find((candidate) => candidate.code === code);
  assert.ok(city);
  const pricing = calculateAuthoritativeLogisticsPrice({
    baseTariff: decimalFromMinorUnits(city.previewPriceMinorUnits),
    pickupPointCount: pointCount,
    destinationType: destination
  });
  assert.equal(pricing.totalPrice.times(100).toNumber(), expectedMinorUnits);
  assert.equal(
    pricing.additionalPickupCount,
    Math.max(0, pointCount - 1)
  );
}
assert.equal(
  serializeLogisticsMoney(new Prisma.Decimal('4000')),
  '4000.00'
);
assert.throws(() =>
  calculateAuthoritativeLogisticsPrice({
    baseTariff: new Prisma.Decimal(1600),
    pickupPointCount: 0,
    destinationType: 'KAIROS_BASE'
  })
);

assert.deepEqual(
  parseLogisticsQuoteInput({
    tariffCityCode: 'KYIV_RIGHT_BANK',
    pickupPointCount: 3,
    destinationType: 'FARM'
  }),
  {
    tariffCityCode: 'KYIV_RIGHT_BANK',
    pickupPointCount: 3,
    destinationType: 'FARM'
  }
);
expectRequestError(
  () =>
    parseLogisticsQuoteInput({
      tariffCityCode: 'UNKNOWN',
      pickupPointCount: 1,
      destinationType: 'FARM'
    }),
  'UNKNOWN_TARIFF_CITY'
);
expectRequestError(
  () =>
    parseLogisticsQuoteInput({
      tariffCityCode: 'MYRONIVKA',
      pickupPointCount: 0,
      destinationType: 'FARM'
    }),
  'INVALID_PICKUP_POINTS'
);

const validCreatePayload = {
  idempotencyKey: randomUUID(),
  honeypot: '',
  tariffCityCode: 'BILA_TSERKVA',
  pickupPoints: [
    {
      externalAddressId: 'mock:tariff-city:bila-tserkva:001',
      cargoDescription: 'Synthetic Stage 5 cargo'
    }
  ],
  destinationType: 'FARM',
  farmExternalAddressId: 'mock:community:kaharlyk:001',
  contactName: 'Synthetic Stage Five',
  contactPhone: '+380000000001',
  clientComment: ''
};
const parsedCreate = parseLogisticsCreateInput({
  ...validCreatePayload,
  totalPrice: '0.01',
  clientId: 'untrusted-client',
  companyId: 'untrusted-company',
  pickupPointCount: 999,
  addressProvider: 'GOOGLE'
});
assert.equal(parsedCreate.pickupPoints.length, 1);
assert.equal('totalPrice' in parsedCreate, false);
assert.equal('clientId' in parsedCreate, false);
assert.equal('companyId' in parsedCreate, false);

for (const [overrides, code] of [
  [{ contactName: ' ' }, 'INVALID_CONTACT_NAME'],
  [{ contactPhone: '' }, 'INVALID_CONTACT_PHONE'],
  [{ pickupPoints: [] }, 'INVALID_PICKUP_POINTS'],
  [{ destinationType: 'FARM', farmExternalAddressId: '' }, 'INVALID_DESTINATION'],
  [{ destinationType: 'UNKNOWN' }, 'INVALID_DESTINATION'],
  [{ idempotencyKey: 'not-a-uuid' }, 'INVALID_IDEMPOTENCY_KEY'],
  [{ honeypot: 'bot-value' }, 'INVALID_REQUEST']
] as const) {
  expectRequestError(
    () => parseLogisticsCreateInput({ ...validCreatePayload, ...overrides }),
    code
  );
}
expectRequestError(
  () =>
    parseLogisticsCreateInput({
      ...validCreatePayload,
      pickupPoints: Array.from({ length: 21 }, (_, index) => ({
        externalAddressId: `mock:${index}`,
        cargoDescription: 'Synthetic'
      }))
    }),
  'INVALID_PICKUP_POINTS'
);
expectRequestError(
  () =>
    parseLogisticsCreateInput({
      ...validCreatePayload,
      pickupPoints: [
        {
          formattedAddress: 'Untrusted free text',
          cargoDescription: 'Synthetic'
        }
      ]
    }),
  'INVALID_PICKUP_POINTS'
);

await assert.rejects(
  () =>
    readBoundedLogisticsJson(
      new Request('http://localhost/api/logistics/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: '{}'
      }),
      LOGISTICS_CREATE_JSON_MAX_BYTES
    ),
  (error: unknown) =>
    error instanceof LogisticsRequestError && error.code === 'INVALID_REQUEST'
);
await assert.rejects(
  () =>
    readBoundedLogisticsJson(
      new Request('http://localhost/api/logistics/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(LOGISTICS_CREATE_JSON_MAX_BYTES + 1)
        },
        body: '{}'
      }),
      LOGISTICS_CREATE_JSON_MAX_BYTES
    ),
  (error: unknown) =>
    error instanceof LogisticsRequestError && error.code === 'INVALID_REQUEST'
);

const safeErrorResponse = logisticsRequestErrorResponse(
  new Error('secret SQL at C:\\private\\dump.sql'),
  'REQUEST_CREATE_FAILED'
);
assert.equal(safeErrorResponse.status, 500);
assert.doesNotMatch(
  JSON.stringify(await safeErrorResponse.json()),
  /secret|sql|private|dump/i
);
const moneyResponse = logisticsRequestJson({
  quote: { totalPrice: serializeLogisticsMoney(new Prisma.Decimal('4000')) }
});
assert.match(JSON.stringify(await moneyResponse.json()), /"4000\.00"/);

for (const [runtimeSource, pattern] of [
  [quoteRouteSource, /LOGISTICS_REQUEST_FORM_ENABLED/],
  [quoteRouteSource, /getActiveLogisticsTariff/],
  [quoteRouteSource, /calculateAuthoritativeLogisticsPrice/],
  [createRouteSource, /LOGISTICS_REQUEST_SUBMIT_ENABLED/],
  [createRouteSource, /assertLogisticsSameOrigin/],
  [createRouteSource, /resolveLogisticsSubmitIdentity/],
  [createRouteSource, /consumeLogisticsCreateRuntimeLimit/],
  [requestServiceSource, /resolveLogisticsAddress/],
  [requestServiceSource, /normalizeUkrainianPhone/],
  [createServiceSource, /writer\.logisticsRequest\.create/],
  [createServiceSource, /writeAuditLog/],
  [createServiceSource, /LOGISTICS_REQUEST_CREATED/],
  [createServiceSource, /PrismaClientKnownRequestError/],
  [accessSource, /STAFF_SUBMIT_FORBIDDEN/],
  [accessSource, /getClientAccessContext/],
  [securitySource, /hmacRateLimitKey/],
  [formSource, /AbortController/],
  [formSource, /crypto\.randomUUID\(\)/],
  [formSource, /\/api\/logistics\/quote/],
  [formSource, /\/api\/logistics\/requests/],
  [featureSource, /process\.env\.LOGISTICS_REQUEST_SUBMIT_ENABLED/]
] as const) {
  assert.match(runtimeSource, pattern);
}

assert.doesNotMatch(
  `${quoteRouteSource}\n${createRouteSource}`,
  /body\.(total|baseTariff|clientId|companyId|addressProvider)/
);
assert.doesNotMatch(
  `${createServiceSource}\n${requestServiceSource}`,
  /telegram|\bNotification\b|confirmedPrice|finalPrice|latitude|longitude|coordinates|google\.maps|\bmapUrl\b|\brouteData\b/i
);
assert.match(schemaSource, /model LogisticsRequest/);

const samplePrepared = {
  identity: {
    type: 'GUEST',
    userId: null,
    clientId: null,
    companyId: null
  },
  idempotencyKey: validCreatePayload.idempotencyKey,
  contactName: validCreatePayload.contactName,
  contactPhone: validCreatePayload.contactPhone,
  tariff: {
    id: 'synthetic-tariff',
    code: 'BILA_TSERKVA',
    name: 'Біла Церква',
    price: new Prisma.Decimal('2200.00')
  },
  destinationType: 'FARM',
  baseAddressSnapshot: null,
  farmAddress: {
    formattedAddress: 'Synthetic farm',
    externalAddressId: 'mock:community:kaharlyk:001',
    addressProvider: 'MOCK',
    normalizedLocality: 'Кагарлик',
    normalizedAdministrativeArea: 'Київська область'
  },
  pickupPoints: [
    {
      supplierName: 'Synthetic supplier',
      formattedAddress: 'Synthetic pickup',
      externalAddressId: 'mock:tariff-city:bila-tserkva:001',
      addressProvider: 'MOCK',
      normalizedLocality: 'Біла Церква',
      normalizedAdministrativeArea: 'Київська область',
      cargoDescription: 'Synthetic Stage 5 cargo'
    }
  ],
  pricing: calculateAuthoritativeLogisticsPrice({
    baseTariff: new Prisma.Decimal('2200.00'),
    pickupPointCount: 1,
    destinationType: 'FARM'
  }),
  clientComment: null
} satisfies PreparedLogisticsRequest;

assert.equal(
  logisticsIdempotencyIntentMatches(
    {
      requestNumber: 'LG-000001',
      totalPrice: new Prisma.Decimal('2700.00'),
      status: 'NEW',
      clientId: null,
      companyId: null,
      contactName: samplePrepared.contactName,
      contactPhone: samplePrepared.contactPhone,
      tariffCityCodeSnapshot: samplePrepared.tariff.code,
      destinationType: samplePrepared.destinationType,
      farmFormattedAddress: samplePrepared.farmAddress.formattedAddress,
      clientComment: null,
      pickupPoints: samplePrepared.pickupPoints.map((point) => ({
        supplierName: point.supplierName,
        formattedAddress: point.formattedAddress,
        cargoDescription: point.cargoDescription
      }))
    },
    samplePrepared
  ),
  true
);

class RollbackSentinel extends Error {}

async function runStagingIntegration() {
  const before = {
    requests: await prisma.logisticsRequest.count(),
    points: await prisma.logisticsPickupPoint.count(),
    audit: await prisma.auditLog.count(),
    notifications: await prisma.notification.count()
  };
  const guestKey = randomUUID();
  const clientKey = randomUUID();

  await assert.rejects(
    () =>
      prisma.$transaction(
        async (writer) => {
          const tariff = await writer.logisticsTariffCity.findUniqueOrThrow({
            where: { code: 'BILA_TSERKVA' },
            select: { id: true, code: true, name: true, price: true, isActive: true }
          });
          assert.equal(tariff.isActive, true);
          assert.equal(
            await writer.logisticsTariffCity.count({ where: { isActive: true } }),
            13
          );

          const guestPrepared: PreparedLogisticsRequest = {
            ...samplePrepared,
            idempotencyKey: guestKey,
            tariff: {
              id: tariff.id,
              code: 'BILA_TSERKVA',
              name: tariff.name,
              price: tariff.price
            },
            pricing: calculateAuthoritativeLogisticsPrice({
              baseTariff: tariff.price,
              pickupPointCount: 1,
              destinationType: 'FARM'
            })
          };
          const guest = await createLogisticsRequestInTransaction(
            writer,
            guestPrepared
          );
          const duplicate = await createLogisticsRequestInTransaction(
            writer,
            guestPrepared
          );
          assert.equal(duplicate.requestNumber, guest.requestNumber);
          assert.equal(guest.status, 'NEW');
          assert.match(guest.requestNumber, /^LG-\d{6,}$/);
          assert.equal(guest.totalPrice.toFixed(2), '2700.00');

          await assert.rejects(
            () =>
              createLogisticsRequestInTransaction(writer, {
                ...guestPrepared,
                contactName: 'Conflicting synthetic intent'
              }),
            (error: unknown) =>
              error instanceof LogisticsRequestError &&
              error.code === 'IDEMPOTENCY_CONFLICT'
          );

          const createdGuest = await writer.logisticsRequest.findUniqueOrThrow({
            where: { idempotencyKey: guestKey },
            include: { pickupPoints: true }
          });
          assert.equal(createdGuest.clientId, null);
          assert.equal(createdGuest.companyId, null);
          assert.equal(createdGuest.pickupPoints.length, 1);
          assert.equal(createdGuest.baseTariffSnapshot.toFixed(2), '2200.00');
          assert.equal(createdGuest.additionalPointsCharge.toFixed(2), '0.00');
          assert.equal(createdGuest.farmDeliveryCharge.toFixed(2), '500.00');
          assert.equal(createdGuest.totalPrice.toFixed(2), '2700.00');
          assert.equal(
            await writer.auditLog.count({
              where: {
                entityType: 'LOGISTICS_REQUEST',
                entityId: createdGuest.id,
                action: 'LOGISTICS_REQUEST_CREATED'
              }
            }),
            1
          );

          const syntheticUser = await writer.user.create({
            data: {
              name: 'Synthetic Stage 5 Client',
              role: 'CLIENT',
              status: 'ACTIVE'
            },
            select: { id: true }
          });
          const syntheticClient = await writer.clientProfile.create({
            data: {
              userId: syntheticUser.id,
              clientType: 'BUSINESS',
              contactName: 'Synthetic Stage 5 Client'
            },
            select: { id: true }
          });
          const syntheticCompany = await writer.company.create({
            data: { name: `Synthetic Stage 5 ${randomUUID()}` },
            select: { id: true }
          });
          await writer.companyMember.create({
            data: {
              userId: syntheticUser.id,
              companyId: syntheticCompany.id,
              isPrimaryContact: true
            }
          });

          const clientPrepared: PreparedLogisticsRequest = {
            ...guestPrepared,
            idempotencyKey: clientKey,
            identity: {
              type: 'CLIENT',
              userId: syntheticUser.id,
              clientId: syntheticClient.id,
              companyId: syntheticCompany.id
            },
            destinationType: 'KAIROS_BASE',
            baseAddressSnapshot: 'м. Кагарлик, вул. Миронівська, 33д',
            farmAddress: null,
            pricing: calculateAuthoritativeLogisticsPrice({
              baseTariff: tariff.price,
              pickupPointCount: 1,
              destinationType: 'KAIROS_BASE'
            })
          };
          await createLogisticsRequestInTransaction(writer, clientPrepared);
          const createdClient = await writer.logisticsRequest.findUniqueOrThrow({
            where: { idempotencyKey: clientKey }
          });
          assert.equal(createdClient.clientId, syntheticClient.id);
          assert.equal(createdClient.companyId, syntheticCompany.id);
          assert.equal(createdClient.totalPrice.toFixed(2), '2200.00');
          assert.equal(createdClient.baseAddressSnapshot, clientPrepared.baseAddressSnapshot);
          assert.equal(createdClient.farmFormattedAddress, null);
          assert.equal(
            await writer.notification.count(),
            before.notifications
          );

          throw new RollbackSentinel('rollback Stage 5 synthetic transaction');
        },
        { timeout: 30_000 }
      ),
    (error: unknown) => error instanceof RollbackSentinel
  );

  assert.equal(
    await prisma.logisticsRequest.count({
      where: { idempotencyKey: { in: [guestKey, clientKey] } }
    }),
    0
  );
  assert.equal(await prisma.logisticsRequest.count(), before.requests);
  assert.equal(await prisma.logisticsPickupPoint.count(), before.points);
  assert.equal(await prisma.auditLog.count(), before.audit);
  assert.equal(await prisma.notification.count(), before.notifications);
}

if (process.env.LOGISTICS_STAGE5_INTEGRATION === '1') {
  await runStagingIntegration();
}

console.log(
  `logisticsRequestCreation=PASS cities=${LOGISTICS_TARIFF_CITIES.length} pricingCases=${pricingCases.length} integration=${
    process.env.LOGISTICS_STAGE5_INTEGRATION === '1' ? 'rollback' : 'skipped'
  }`
);

await prisma.$disconnect();
}

void main();
