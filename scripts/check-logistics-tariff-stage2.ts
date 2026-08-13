import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Prisma } from '@prisma/client';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { LogisticsRatesSection } from '../components/public/logistics/logistics-rates-section';
import { LogisticsRequestForm } from '../components/public/logistics/logistics-request-form';
import {
  calculateLogisticsPricePreview,
  formatLogisticsPrice
} from '../lib/logistics/pricing-preview';
import { LOGISTICS_TARIFF_CITIES } from '../lib/logistics/tariff-cities';
import { getActiveLogisticsTariffClientItems } from '../lib/logistics/tariff-read-model';

async function main() {
  (globalThis as typeof globalThis & { React: typeof React }).React = React;
  const root = process.cwd();
  const source = (...segments: string[]) =>
    readFileSync(path.join(root, ...segments), 'utf8');
  const now = new Date('2026-08-13T12:00:00.000Z');
  const prices = [
    1500, 1700, 1800, 2000, 2200, 2400, 2500, 2600, 2700, 2900,
    3100, 3000, 3200
  ] as const;
  const records = LOGISTICS_TARIFF_CITIES.map((city, index) => ({
    id: `tariff-${city.code}`,
    code: city.code,
    name: city.displayName,
    price: new Prisma.Decimal(prices[index]!),
    isActive: true,
    updatedAt: now
  }));
  const reader = {
    logisticsTariffCity: {
      findMany: async () => [...records].reverse()
    }
  };

  let tariffs = await getActiveLogisticsTariffClientItems(reader as never);
  assert.equal(tariffs.length, 13);
  assert.deepEqual(
    tariffs.map((tariff) => tariff.code),
    LOGISTICS_TARIFF_CITIES.map((city) => city.code)
  );
  assert.deepEqual(tariffs.find((tariff) => tariff.code === 'IRPIN'), {
    code: 'IRPIN',
    name: 'Ірпінь',
    priceMinorUnits: 290_000
  });
  assert.deepEqual(tariffs.find((tariff) => tariff.code === 'BUCHA'), {
    code: 'BUCHA',
    name: 'Буча',
    priceMinorUnits: 310_000
  });

  const publicMarkup = renderToStaticMarkup(
    React.createElement(LogisticsRatesSection, { tariffs })
  );
  const publicRows = publicMarkup.match(/<tr/g) ?? [];
  const normalizedPublicMarkup = publicMarkup.replace(/[\s\u00a0]+/g, ' ');
  assert.equal(publicRows.length, 15, 'Header + 13 tariffs + INDIVIDUAL expected.');
  assert.match(normalizedPublicMarkup, /Миронівка.*1 500 грн/);
  assert.match(normalizedPublicMarkup, /Обухів.*1 700 грн/);
  assert.match(normalizedPublicMarkup, /Ірпінь.*2 900 грн/);
  assert.match(normalizedPublicMarkup, /Буча.*3 100 грн/);
  assert.doesNotMatch(normalizedPublicMarkup, /Миронівка.*1 600 грн/);
  assert.match(publicMarkup, /Ірпінь/);
  assert.match(publicMarkup, /Буча/);
  assert.doesNotMatch(publicMarkup, /Ірпінь\s*\/\s*Буча/);
  assert.match(publicMarkup, /Інші населені пункти/);
  assert.match(publicMarkup, /Індивідуальний розрахунок/);

  const formMarkup = renderToStaticMarkup(
    React.createElement(LogisticsRequestForm, {
      initialContact: { name: '', phone: '' },
      initialTariffs: tariffs,
      minPreferredDeliveryDate: '2099-08-13'
    })
  );
  for (const tariff of tariffs) {
    assert.match(formMarkup, new RegExp(`value="${tariff.code}"`));
  }
  assert.match(formMarkup, /value="INDIVIDUAL"/);
  assert.equal((formMarkup.match(/<option/g) ?? []).length, 15);

  const irpin = tariffs.find((tariff) => tariff.code === 'IRPIN')!;
  const bucha = tariffs.find((tariff) => tariff.code === 'BUCHA')!;
  assert.equal(
    calculateLogisticsPricePreview(irpin, 1, 'KAIROS_BASE').totalMinorUnits,
    290_000
  );
  assert.equal(
    calculateLogisticsPricePreview(bucha, 1, 'KAIROS_BASE').totalMinorUnits,
    310_000
  );
  assert.equal(
    formatLogisticsPrice(150_000).replace(/[\s\u00a0]+/g, ' '),
    '1 500 грн'
  );
  assert.equal(
    formatLogisticsPrice(290_000).replace(/[\s\u00a0]+/g, ' '),
    '2 900 грн'
  );
  assert.equal(
    formatLogisticsPrice(310_000).replace(/[\s\u00a0]+/g, ' '),
    '3 100 грн'
  );

  records.find((record) => record.code === 'IRPIN')!.price =
    new Prisma.Decimal(3000);
  tariffs = await getActiveLogisticsTariffClientItems(reader as never);
  assert.equal(
    tariffs.find((tariff) => tariff.code === 'IRPIN')?.priceMinorUnits,
    300_000
  );
  assert.equal(
    tariffs.find((tariff) => tariff.code === 'BUCHA')?.priceMinorUnits,
    310_000
  );

  records.find((record) => record.code === 'IRPIN')!.isActive = false;
  tariffs = await getActiveLogisticsTariffClientItems(reader as never);
  assert.equal(tariffs.length, 12);
  assert.equal(tariffs.some((tariff) => tariff.code === 'IRPIN'), false);
  assert.equal(tariffs.some((tariff) => tariff.code === 'BUCHA'), true);

  const publicPage = source('app', '(public)', 'logistics', 'page.tsx');
  const requestPage = source(
    'app',
    '(public)',
    'logistics',
    'request',
    'page.tsx'
  );
  const ratesSource = source(
    'components',
    'public',
    'logistics',
    'logistics-rates-section.tsx'
  );
  const formSource = source(
    'components',
    'public',
    'logistics',
    'logistics-request-form.tsx'
  );
  const citySource = source('lib', 'logistics', 'tariff-cities.ts');
  const previewSource = source('lib', 'logistics', 'pricing-preview.ts');
  const actionSource = source('lib', 'logistics', 'crm-actions.ts');

  assert.match(publicPage, /dynamic = 'force-dynamic'/);
  assert.match(requestPage, /dynamic = 'force-dynamic'/);
  assert.match(publicPage, /getActiveLogisticsTariffClientItems/);
  assert.match(publicPage, /<LogisticsRatesSection tariffs=\{tariffs\} \/>/);
  assert.match(requestPage, /getActiveLogisticsTariffClientItems/);
  assert.match(requestPage, /initialTariffs=\{initialTariffs\}/);
  assert.match(formSource, /initialTariffs\.map/);
  assert.match(formSource, /verifiedQuote \? \(/);
  assert.match(formSource, /: preview \? \(/);
  assert.match(actionSource, /revalidatePath\('\/logistics'\)/);
  assert.match(actionSource, /revalidatePath\('\/logistics\/request'\)/);
  assert.doesNotMatch(
    `${citySource}\n${previewSource}\n${ratesSource}\n${formSource}`,
    /previewPriceMinorUnits/
  );
  assert.doesNotMatch(ratesSource, /Ірпінь\s*\/\s*Буча/);
  assert.doesNotMatch(ratesSource, /const\s+logisticsRates\s*=/);
  assert.doesNotMatch(ratesSource, /Миронівка[^\n]*1600/);

  console.log(
    'logisticsTariffStage2=PASS publicRows=14 fixedOptions=13 individual=1 dynamic=2 inactive=filtered'
  );
}

void main();
