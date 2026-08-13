import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  ADDITIONAL_PICKUP_CHARGE_MINOR_UNITS,
  calculateLogisticsPricePreview,
  FARM_DELIVERY_CHARGE_MINOR_UNITS
} from '../lib/logistics/pricing-preview';
import {
  addLogisticsPickupPoint,
  createLogisticsPickupPoint,
  isLogisticsRequestDraftReady,
  parseLogisticsTariffCitySelection,
  removeLogisticsPickupPoint,
  transitionLogisticsDestination
} from '../lib/logistics/request-form-state';
import {
  LOGISTICS_TARIFF_CITIES,
  type LogisticsTariffCityCode
} from '../lib/logistics/tariff-cities';

const root = process.cwd();
const migrationPath = path.join(
  root,
  'prisma',
  'migrations',
  '20260729120000_add_logistics_persistence_foundation',
  'migration.sql'
);
const routePath = path.join(
  root,
  'app',
  '(public)',
  'logistics',
  'request',
  'page.tsx'
);
const landingPath = path.join(root, 'app', '(public)', 'logistics', 'page.tsx');
const formPath = path.join(
  root,
  'components',
  'public',
  'logistics',
  'logistics-request-form.tsx'
);
const comboboxPath = path.join(
  root,
  'components',
  'public',
  'logistics',
  'logistics-address-combobox.tsx'
);

const migrationSql = readFileSync(migrationPath, 'utf8');
const routeSource = readFileSync(routePath, 'utf8');
const landingSource = readFileSync(landingPath, 'utf8');
const formSource = readFileSync(formPath, 'utf8');
const comboboxSource = readFileSync(comboboxPath, 'utf8');
const pricingSource = readFileSync(
  path.join(root, 'lib', 'logistics', 'pricing-preview.ts'),
  'utf8'
);
const requestFormStateSource = readFileSync(
  path.join(root, 'lib', 'logistics', 'request-form-state.ts'),
  'utf8'
);
const stage4RuntimeSource = [
  routeSource,
  landingSource,
  formSource,
  comboboxSource,
  pricingSource,
  requestFormStateSource
].join('\n');

const expectedTariffs = new Map<
  LogisticsTariffCityCode,
  { displayName: string; minorUnits: number }
>([
  ['MYRONIVKA', { displayName: 'Миронівка', minorUnits: 160_000 }],
  ['OBUKHIV', { displayName: 'Обухів', minorUnits: 170_000 }],
  ['UZYN', { displayName: 'Узин', minorUnits: 180_000 }],
  ['VASYLKIV', { displayName: 'Васильків', minorUnits: 200_000 }],
  ['BILA_TSERKVA', { displayName: 'Біла Церква', minorUnits: 220_000 }],
  ['BORYSPIL', { displayName: 'Бориспіль', minorUnits: 240_000 }],
  [
    'KYIV_RIGHT_BANK',
    { displayName: 'Київ — правий берег', minorUnits: 250_000 }
  ],
  [
    'KYIV_LEFT_BANK',
    { displayName: 'Київ — лівий берег', minorUnits: 260_000 }
  ],
  ['BROVARY', { displayName: 'Бровари', minorUnits: 270_000 }],
  ['IRPIN', { displayName: 'Ірпінь', minorUnits: 290_000 }],
  ['BUCHA', { displayName: 'Буча', minorUnits: 290_000 }],
  ['BEREZAN', { displayName: 'Березань', minorUnits: 300_000 }],
  ['VYSHHOROD', { displayName: 'Вишгород', minorUnits: 320_000 }]
]);

assert.equal(LOGISTICS_TARIFF_CITIES.length, 13, 'Preview catalog must contain 13 cities.');
assert.equal(
  new Set(LOGISTICS_TARIFF_CITIES.map((city) => city.code)).size,
  13,
  'Tariff codes must be unique.'
);
for (const city of LOGISTICS_TARIFF_CITIES) {
  const expectedTariff = expectedTariffs.get(city.code);
  assert.ok(expectedTariff, `Unexpected tariff city code ${city.code}.`);
  assert.equal(city.displayName, expectedTariff.displayName);
  const migrationRow = migrationSql.match(
    new RegExp(`'${city.code}',\\s*'[^']+',\\s*([0-9]+\\.[0-9]{2}),\\s*true`)
  );
  assert.ok(migrationRow, `Missing Stage 3 tariff row for ${city.code}.`);
  assert.equal(
    Number(migrationRow[1]) * 100,
    expectedTariff.minorUnits,
    `Test tariff fixture must match Stage 3 migration for ${city.code}.`
  );
}
assert.ok(expectedTariffs.has('IRPIN') && expectedTariffs.has('BUCHA'));
assert.notEqual('IRPIN', 'BUCHA');
assert.equal(ADDITIONAL_PICKUP_CHARGE_MINOR_UNITS, 60_000);
assert.equal(FARM_DELIVERY_CHARGE_MINOR_UNITS, 100_000);
assert.equal(parseLogisticsTariffCitySelection(''), null);
assert.equal(parseLogisticsTariffCitySelection('UNKNOWN'), null);
assert.equal(parseLogisticsTariffCitySelection('MYRONIVKA'), 'MYRONIVKA');

const cases = [
  ['MYRONIVKA', 1, 'KAIROS_BASE', 160_000],
  ['MYRONIVKA', 2, 'KAIROS_BASE', 220_000],
  ['MYRONIVKA', 3, 'KAIROS_BASE', 280_000],
  ['MYRONIVKA', 1, 'FARM', 260_000],
  ['KYIV_RIGHT_BANK', 3, 'FARM', 470_000]
] as const;
for (const [code, count, destination, expectedTotal] of cases) {
  const tariff = expectedTariffs.get(code);
  assert.ok(tariff);
  assert.equal(
    calculateLogisticsPricePreview(
      { code, name: tariff.displayName, priceMinorUnits: tariff.minorUnits },
      count,
      destination
    ).totalMinorUnits,
    expectedTotal
  );
}
const kyivLeftBankTariff = expectedTariffs.get('KYIV_LEFT_BANK');
assert.ok(kyivLeftBankTariff);
assert.equal(
  calculateLogisticsPricePreview(
    {
      code: 'KYIV_LEFT_BANK',
      name: kyivLeftBankTariff.displayName,
      priceMinorUnits: kyivLeftBankTariff.minorUnits
    },
    1,
    'KAIROS_BASE'
  ).totalMinorUnits,
  260_000
);
assert.throws(() =>
  calculateLogisticsPricePreview(
    { code: 'MYRONIVKA', name: 'Миронівка', priceMinorUnits: 160_000 },
    0,
    'KAIROS_BASE'
  )
);

const manualAddress = 'Київська область, Миронівка, вул. Тестова, 1';
const firstPoint = {
  ...createLogisticsPickupPoint('pickup-1'),
  supplierName: 'ТОВ «Тест»',
  address: manualAddress,
  cargoDescription: 'Запчастини'
};
const secondPoint = createLogisticsPickupPoint('pickup-2');
const addedPoints = addLogisticsPickupPoint([firstPoint], secondPoint);
assert.equal(addedPoints.length, 2);
assert.equal(addedPoints[1]?.address, '');
assert.equal(removeLogisticsPickupPoint([firstPoint], firstPoint.id).length, 1);
assert.deepEqual(
  removeLogisticsPickupPoint(addedPoints, firstPoint.id).map((point) => point.id),
  ['pickup-1', 'pickup-2']
);
assert.deepEqual(
  removeLogisticsPickupPoint(addedPoints, secondPoint.id).map((point) => point.id),
  ['pickup-1']
);
assert.equal(
  transitionLogisticsDestination('KAIROS_BASE', manualAddress).farmAddress,
  ''
);
assert.equal(
  transitionLogisticsDestination('FARM', manualAddress).farmAddress,
  manualAddress
);
assert.equal(
  isLogisticsRequestDraftReady(
    {
      pricingType: 'FIXED',
      tariffCityCode: 'MYRONIVKA',
      customLocality: '',
      pickupPoints: [firstPoint],
      destinationType: 'KAIROS_BASE',
      farmAddress: '',
      preferredDeliveryDate: '2099-08-05',
      contactName: 'Іван',
      contactPhone: '+380671234567',
      clientComment: ''
    },
    '2099-08-01'
  ),
  true
);
assert.equal(
  isLogisticsRequestDraftReady(
    {
      pricingType: 'FIXED',
      tariffCityCode: 'MYRONIVKA',
      customLocality: '',
      pickupPoints: [firstPoint],
      destinationType: 'FARM',
      farmAddress: '',
      preferredDeliveryDate: '2099-08-05',
      contactName: 'Іван',
      contactPhone: '+380671234567',
      clientComment: ''
    },
    '2099-08-01'
  ),
  false
);

assert.ok(existsSync(routePath), 'Public Logistics request route must exist.');
assert.doesNotMatch(routeSource, /LOGISTICS_REQUEST_FORM_ENABLED|notFound\(\)/);
assert.match(routeSource, /robots:[\s\S]*index: false[\s\S]*follow: false/);
assert.match(landingSource, /href="\/logistics\/request"/);
assert.doesNotMatch(landingSource, /Онлайн-заявка готується до запуску\./);
assert.doesNotMatch(routeSource, /LOGISTICS_REQUEST_SUBMIT_ENABLED|submitEnabled=/);
assert.match(formSource, /type="submit"[\s\S]{0,100}disabled=\{!canSubmit\}/);
assert.match(comboboxSource, /AbortController/);
assert.match(comboboxSource, /400/);
assert.match(comboboxSource, /aria-activedescendant/);
assert.match(comboboxSource, /\/api\/logistics\/addresses\/autocomplete/);
assert.match(comboboxSource, /\/api\/logistics\/addresses\/resolve/);
assert.match(comboboxSource, /if \(value\)[\s\S]{0,100}onResolvedChange\(null\)/);
assert.match(formSource, /LogisticsTariffCityCode \| null/);
assert.match(
  formSource,
  /pricingType === 'INDIVIDUAL'[\s\S]{0,100}\? INDIVIDUAL_PRICING_SELECT_VALUE[\s\S]{0,100}: \(tariffCityCode \?\? ''\)/
);
assert.match(
  formSource,
  /pricingType === 'FIXED'[\s\S]{0,100}\? \{ tariffCityCode \}[\s\S]{0,160}customLocality:[\s\S]{0,100}normalizeLogisticsCustomLocality/
);
assert.match(
  pricingSource,
  /tariff: LogisticsTariffClientItem,[\s\S]{0,120}pickupPointCount: number/
);
assert.match(
  comboboxSource,
  /const requestScope: LogisticsAddressScope \| null[\s\S]{0,260}if \(!requestScope\)/
);
assert.doesNotMatch(
  `${formSource}\n${comboboxSource}\n${pricingSource}\n${requestFormStateSource}`,
  /as any|as LogisticsTariffCityCode|@ts-ignore|@ts-expect-error|\bany\b/
);
assert.equal(
  existsSync(path.join(root, 'app', 'api', 'logistics', 'requests', 'route.ts')),
  true,
  'Stage 5 must add the Logistics create API without breaking the Stage 4 form.'
);

for (const forbiddenPattern of [
  /google\.maps/i,
  /@google/i,
  /\blatitude\b/i,
  /\blongitude\b/i,
  /<iframe/i,
  /localStorage/,
  /sessionStorage/
]) {
  assert.doesNotMatch(stage4RuntimeSource, forbiddenPattern);
}

assert.match(landingSource, /Створити заявку на перевезення/);
assert.match(formSource, /initialTariffs\.map/);
assert.match(formSource, /calculateLogisticsPricePreview\([\s\S]{0,100}selectedTariff/);
assert.doesNotMatch(stage4RuntimeSource, /previewPriceMinorUnits/);
assert.doesNotMatch(stage4RuntimeSource, /Ірпінь\s*\/\s*Буча/);

console.log(
  `logisticsRequestForm=PASS cities=${LOGISTICS_TARIFF_CITIES.length} formulaCases=${cases.length} submit=enabled`
);
