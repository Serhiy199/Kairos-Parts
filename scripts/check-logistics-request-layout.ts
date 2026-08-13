import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Prisma } from '@prisma/client';

import { calculateAuthoritativeLogisticsPrice } from '../lib/logistics/pricing';
import {
  ADDITIONAL_PICKUP_CHARGE_MINOR_UNITS,
  calculateLogisticsPricePreview,
  FARM_DELIVERY_CHARGE_MINOR_UNITS
} from '../lib/logistics/pricing-preview';
import {
  createLogisticsPickupPoint,
  isLogisticsRequestDraftReady
} from '../lib/logistics/request-form-state';

const source = readFileSync(
  resolve(process.cwd(), 'components/public/logistics/logistics-request-form.tsx'),
  'utf8'
);

function occurrences(value: string) {
  return source.split(value).length - 1;
}

const formStart = source.indexOf('<form');
const formEnd = source.indexOf('</form>', formStart);
const commentSection = source.indexOf('id="logistics-comment-section"');
const summary = source.indexOf('aria-labelledby="logistics-price-preview-title"');
const restrictions = source.indexOf('aria-labelledby="logistics-restrictions-title"');
const submit = source.indexOf('type="submit"', summary);

assert.ok(formStart >= 0 && formEnd > formStart, 'Logistics request form must remain intact.');
assert.ok(commentSection > formStart, 'The final comment section must remain inside the form.');
assert.ok(summary > commentSection, 'Mobile DOM order must place the summary after all form fields.');
assert.ok(restrictions > summary, 'Mobile DOM order must place restrictions after the summary and CTA.');
assert.ok(submit > summary && submit < formEnd, 'The only CTA must remain associated with the same form.');

assert.equal(occurrences('Розрахунок вартості'), 1);
assert.equal(occurrences("Індивідуальний розрахунок"), 2);
assert.equal(occurrences('Створити заявку на перевезення'), 1);
assert.equal(occurrences('type="submit"'), 1);
assert.equal(occurrences('<DeliveryGuidance />'), 1);
assert.equal(occurrences('Обмеження перевезень'), 1);

assert.match(
  source,
  /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(340px,0\.48fr\)\][^"\n]*lg:items-stretch/
);
assert.match(source, /className="flex min-w-0 flex-col gap-5 lg:h-full"/);
assert.match(
  source,
  /aria-labelledby="logistics-price-preview-title"[\s\S]{0,160}lg:order-2 lg:mt-auto/
);
assert.match(source, /className="grid gap-4 lg:order-1"/);

assert.doesNotMatch(
  source,
  /(?:mt|pt)-\[\d{3,}px\]|translate-y|absolute\s+bottom|fixed\s+bottom|(?:min-)?h-\[\d+vh\]/
);

assert.match(source, /pricingType === 'INDIVIDUAL'/);
assert.match(source, /pricingType === 'FIXED'/);
assert.match(source, /verifiedQuote \?/);
assert.match(source, /pickupPoints\.map/);
assert.match(source, /role="alert"/);
assert.match(source, /disabled=\{!canSubmit\}/);

const firstPoint = {
  ...createLogisticsPickupPoint('pickup-1'),
  supplierName: 'ТОВ «Постачальник»',
  address: 'Київська область, м. Миронівка, вул. Соборна, 1',
  cargoDescription: 'Запчастини до сільськогосподарської техніки'
};
const secondPoint = {
  ...createLogisticsPickupPoint('pickup-2'),
  supplierName: 'ТОВ «Другий постачальник»',
  address: 'Київська область, м. Обухів, вул. Київська, 2',
  cargoDescription: 'Комплектуючі'
};
const fixedDraft = {
  pricingType: 'FIXED' as const,
  tariffCityCode: 'MYRONIVKA' as const,
  customLocality: '',
  pickupPoints: [firstPoint],
  destinationType: 'KAIROS_BASE' as const,
  farmAddress: '',
  preferredDeliveryDate: '2099-08-05',
  contactName: 'Іван Петренко',
  contactPhone: '+380671234567',
  clientComment: ''
};

assert.equal(isLogisticsRequestDraftReady(fixedDraft, '2099-08-01'), true);
assert.equal(
  isLogisticsRequestDraftReady(
    {
      ...fixedDraft,
      pricingType: 'INDIVIDUAL',
      tariffCityCode: null,
      customLocality: 'Черкаси',
      pickupPoints: [firstPoint, secondPoint]
    },
    '2099-08-01'
  ),
  true
);
assert.equal(
  isLogisticsRequestDraftReady(
    { ...fixedDraft, pickupPoints: [{ ...firstPoint, address: '' }] },
    '2099-08-01'
  ),
  false
);

const preview = calculateLogisticsPricePreview(
  { code: 'MYRONIVKA', name: 'Миронівка', priceMinorUnits: 160_000 },
  3,
  'FARM'
);
assert.equal(preview.additionalPointCount, 2);
assert.equal(
  preview.totalMinorUnits,
  preview.baseTariffMinorUnits
    + 2 * ADDITIONAL_PICKUP_CHARGE_MINOR_UNITS
    + FARM_DELIVERY_CHARGE_MINOR_UNITS
);
const authoritative = calculateAuthoritativeLogisticsPrice({
  baseTariff: new Prisma.Decimal(preview.baseTariffMinorUnits).dividedBy(100),
  pickupPointCount: 3,
  destinationType: 'FARM'
});
assert.equal(
  authoritative.totalPrice.times(100).toNumber(),
  preview.totalMinorUnits
);

console.log('Logistics request responsive bottom-alignment checks passed.');
