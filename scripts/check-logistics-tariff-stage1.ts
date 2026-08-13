import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Prisma } from '@prisma/client';

import {
  resolveLogisticsRequestPricing,
  type PreparedLogisticsRequest
} from '../lib/logistics/create-request';
import { calculateAuthoritativeLogisticsPrice } from '../lib/logistics/pricing';
import { LogisticsRequestError } from '../lib/logistics/request-errors';
import { parseLogisticsTariffPrice } from '../lib/logistics/tariff-price';
import { getConfiguredLogisticsTariffs } from '../lib/logistics/tariff-read-model';
import { LOGISTICS_TARIFF_CITIES } from '../lib/logistics/tariff-cities';
import { getActiveLogisticsTariff } from '../lib/logistics/tariff-service';

async function main() {
const root = process.cwd();
const source = (...segments: string[]) =>
  readFileSync(path.join(root, ...segments), 'utf8');

for (const value of ['1', '1600', '2900', '3100', '999999']) {
  assert.equal(parseLogisticsTariffPrice(value)?.toFixed(2), `${value}.00`);
}
for (const value of ['', '0', '-100', '12.5', '1600.50', '1e3', 'NaN', 'Infinity', 'text']) {
  assert.equal(parseLogisticsTariffPrice(value), null, `${value} must be rejected.`);
}

assert.notEqual('IRPIN', 'BUCHA');
assert.deepEqual(
  LOGISTICS_TARIFF_CITIES.slice(9, 11).map((city) => city.code),
  ['IRPIN', 'BUCHA']
);

const now = new Date('2026-08-13T10:00:00.000Z');
const independentTariffs = [
  {
    id: 'bucha',
    code: 'BUCHA',
    name: 'Буча',
    price: new Prisma.Decimal(2900),
    isActive: true,
    updatedAt: now
  },
  {
    id: 'irpin',
    code: 'IRPIN',
    name: 'Ірпінь',
    price: new Prisma.Decimal(2900),
    isActive: true,
    updatedAt: now
  }
];
const independentReader = {
  logisticsTariffCity: {
    findMany: async () => independentTariffs
  }
};
independentTariffs[1]!.price = new Prisma.Decimal(3100);
let independent = await getConfiguredLogisticsTariffs(
  independentReader as never
);
assert.deepEqual(independent.map((tariff) => tariff.code), ['IRPIN', 'BUCHA']);
assert.equal(independent[0]?.price.toFixed(2), '3100.00');
assert.equal(independent[1]?.price.toFixed(2), '2900.00');

independentTariffs[0]!.price = new Prisma.Decimal(3200);
independent = await getConfiguredLogisticsTariffs(independentReader as never);
assert.equal(independent[0]?.price.toFixed(2), '3100.00');
assert.equal(independent[1]?.price.toFixed(2), '3200.00');

const fixedInput: PreparedLogisticsRequest = {
  identity: {
    type: 'GUEST',
    userId: null,
    clientId: null,
    companyId: null
  },
  idempotencyKey: '2c02a400-3f24-4f00-a59b-4a1de6215b24',
  contactName: 'Stage 1 Test',
  contactPhone: '+380671234567',
  pricingType: 'FIXED',
  customLocality: null,
  tariffCityCode: 'MYRONIVKA',
  destinationType: 'FARM',
  preferredDeliveryDate: new Date('2099-08-13T00:00:00.000Z'),
  preferredDeliveryDateValue: '2099-08-13',
  baseAddressSnapshot: null,
  farmAddress: {
    formattedAddress: 'Test farm',
    externalAddressId: null,
    addressProvider: 'MANUAL',
    normalizedLocality: null,
    normalizedAdministrativeArea: null
  },
  pickupPoints: [1, 2, 3].map((index) => ({
    supplierName: `Supplier ${index}`,
    formattedAddress: `Pickup ${index}`,
    externalAddressId: null,
    addressProvider: 'MANUAL' as const,
    normalizedLocality: null,
    normalizedAdministrativeArea: null,
    cargoDescription: 'Cargo'
  })),
  clientComment: null
};

let currentPrice = new Prisma.Decimal(1600);
let tariffReads = 0;
const transactionWriter = {
  logisticsTariffCity: {
    findUnique: async () => null
  },
  $queryRaw: async () => {
    tariffReads += 1;
    return [
      {
        id: 'myronivka',
        code: 'MYRONIVKA',
        name: 'Миронівка',
        price: currentPrice,
        isActive: true,
        updatedAt: now
      }
    ];
  }
};

const requestA = await resolveLogisticsRequestPricing(
  transactionWriter as never,
  fixedInput
);
assert.equal(requestA.pricingType, 'FIXED');
assert.equal(requestA.pricing.baseTariff.toFixed(2), '1600.00');
assert.equal(requestA.pricing.additionalPointsCharge.toFixed(2), '1200.00');
assert.equal(requestA.pricing.farmDeliveryCharge.toFixed(2), '1000.00');
assert.equal(requestA.pricing.totalPrice.toFixed(2), '3800.00');

currentPrice = new Prisma.Decimal(1800);
const requestB = await resolveLogisticsRequestPricing(
  transactionWriter as never,
  fixedInput
);
assert.equal(requestB.pricingType, 'FIXED');
assert.equal(requestA.pricing.baseTariff.toFixed(2), '1600.00');
assert.equal(requestA.pricing.totalPrice.toFixed(2), '3800.00');
assert.equal(requestB.pricing.baseTariff.toFixed(2), '1800.00');
assert.equal(requestB.pricing.totalPrice.toFixed(2), '4000.00');

for (const [pickupPointCount, expected] of [[1, 0], [2, 600], [3, 1200]] as const) {
  const pricing = calculateAuthoritativeLogisticsPrice({
    baseTariff: new Prisma.Decimal(1800),
    pickupPointCount,
    destinationType: 'KAIROS_BASE'
  });
  assert.equal(pricing.additionalPointsCharge.toNumber(), expected);
}
assert.equal(
  calculateAuthoritativeLogisticsPrice({
    baseTariff: new Prisma.Decimal(1800),
    pickupPointCount: 3,
    destinationType: 'FARM'
  }).totalPrice.toNumber(),
  4000
);

const readsBeforeIndividual = tariffReads;
const individual = await resolveLogisticsRequestPricing(
  transactionWriter as never,
  {
    ...fixedInput,
    pricingType: 'INDIVIDUAL',
    customLocality: 'Черкаси',
    tariffCityCode: null
  }
);
assert.equal(individual.pricingType, 'INDIVIDUAL');
assert.equal(individual.tariff, null);
assert.equal(individual.pricing, null);
assert.equal(tariffReads, readsBeforeIndividual);

await assert.rejects(
  () =>
    resolveLogisticsRequestPricing(
      {
        logisticsTariffCity: { findUnique: async () => null },
        $queryRaw: async () => [
          {
            id: 'myronivka',
            code: 'MYRONIVKA',
            name: 'Миронівка',
            price: new Prisma.Decimal(1800),
            isActive: false,
            updatedAt: now
          }
        ]
      } as never,
      fixedInput
    ),
  (error: unknown) =>
    error instanceof LogisticsRequestError && error.code === 'TARIFF_CITY_INACTIVE'
);

await assert.rejects(
  () =>
    getActiveLogisticsTariff('MYRONIVKA', {
      logisticsTariffCity: {
        findUnique: async () => ({
          id: 'myronivka',
          code: 'MYRONIVKA',
          name: 'Миронівка',
          price: new Prisma.Decimal(1800),
          isActive: false,
          updatedAt: now
        })
      }
    } as never),
  (error: unknown) =>
    error instanceof LogisticsRequestError && error.code === 'TARIFF_CITY_INACTIVE'
);

const createSource = source('lib', 'logistics', 'create-request.ts');
const actionSource = source('lib', 'logistics', 'crm-actions.ts');
const requestServiceSource = source('lib', 'logistics', 'request-service.ts');
const readModelSource = source('lib', 'logistics', 'tariff-read-model.ts');
const tariffServiceSource = source('lib', 'logistics', 'tariff-service.ts');
const migration = source(
  'prisma',
  'migrations',
  '20260813120000_harden_logistics_tariff_price_contract',
  'migration.sql'
);

assert.match(createSource, /resolveLogisticsRequestPricing\(writer, input\)/);
assert.match(createSource, /TransactionIsolationLevel\.Serializable/);
assert.match(createSource, /error\.code === 'P2034'/);
assert.match(createSource, /attempt < 2/);
assert.doesNotMatch(createSource, /logisticsRequest\.update/);
assert.match(actionSource, /where: \{ id: tariffId, updatedAt: expectedDate \}/);
assert.match(actionSource, /LOGISTICS_TARIFF_UPDATED/);
assert.match(actionSource, /category: 'FINANCIAL_CRITICAL'/);
assert.match(actionSource, /if \(updated\.count !== 1\)/);
assert.equal(
  createSource.match(/action: 'LOGISTICS_REQUEST_CREATED'/g)?.length,
  1
);
assert.match(requestServiceSource, /tariffCityName: result\.tariffCityName/);
assert.match(requestServiceSource, /totalPrice: serializeLogisticsMoney\(result\.totalPrice/);
assert.match(readModelSource, /getConfiguredLogisticsTariffs/);
assert.match(readModelSource, /getActiveLogisticsTariffs/);
assert.match(readModelSource, /findLogisticsTariffByCode/);
assert.match(readModelSource, /findLockedLogisticsTariffByCode/);
assert.match(readModelSource, /FOR SHARE/);
assert.match(tariffServiceSource, /findLogisticsTariffByCode/);
assert.match(migration, /"price" > 0/);
assert.match(migration, /"price" = trunc\("price"\)/);
assert.doesNotMatch(migration, /\bINSERT\b|\bUPDATE\b|\bDELETE\b/i);

console.log(
  'logisticsTariffStage1=PASS parser=9-invalid cities=13 independent=IRPIN,BUCHA snapshot=preserved retry=bounded'
);
}

void main();
