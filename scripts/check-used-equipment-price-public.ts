import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { formatUsedEquipmentPriceOrFallback } from '../lib/used-equipment/price';

const PUBLIC_PRICE_FALLBACK = 'Ціна за запитом';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function main() {
  assert.equal(formatUsedEquipmentPriceOrFallback(1_250_000, PUBLIC_PRICE_FALLBACK), '1 250 000 грн');
  assert.equal(formatUsedEquipmentPriceOrFallback(null, PUBLIC_PRICE_FALLBACK), PUBLIC_PRICE_FALLBACK);
  assert.equal(formatUsedEquipmentPriceOrFallback(2_147_483_647, PUBLIC_PRICE_FALLBACK), '2 147 483 647 грн');

  const queries = source('lib/used-equipment/queries.ts');
  const publicListQuery = queries.slice(
    queries.indexOf('export async function getPublicUsedEquipmentPage'),
    queries.indexOf('export type PublicUsedEquipmentListItem')
  );
  const publicDetailQuery = queries.slice(
    queries.indexOf('export async function getPublicUsedEquipmentBySlug'),
    queries.indexOf('export type PublicUsedEquipmentDetail')
  );
  assert.match(publicListQuery, /priceAmount: true/);
  assert.equal((publicListQuery.match(/prisma\.usedEquipment\.findMany\(/g) ?? []).length, 1);
  assert.match(publicDetailQuery, /priceAmount: true/);
  assert.equal((publicDetailQuery.match(/prisma\.usedEquipment\.findFirst\(/g) ?? []).length, 1);
  assert.match(publicDetailQuery, /status: 'PUBLISHED'/);

  const card = source('components/used-equipment/public-used-equipment-card.tsx');
  assert.match(card, /formatUsedEquipmentPriceOrFallback\(item\.priceAmount, 'Ціна за запитом'\)/);
  assert.match(card, /text-xl[\s\S]*sm:text-2xl/);
  assert.ok(
    card.lastIndexOf('formatUsedEquipmentPriceOrFallback') < card.indexOf('<UsedEquipmentInquiryDialog'),
    'Card price must render before the inquiry CTA.'
  );
  assert.match(card, /trigger="Запит на перегляд техніки"/);

  const detail = source('app/(public)/used-equipment/[slug]/page.tsx');
  assert.match(detail, />Ціна<\/p>/);
  assert.match(detail, /formatUsedEquipmentPriceOrFallback\(item\.priceAmount, 'Ціна за запитом'\)/);
  assert.match(detail, /text-2xl[\s\S]*sm:text-3xl/);
  assert.ok(
    detail.lastIndexOf('formatUsedEquipmentPriceOrFallback') < detail.lastIndexOf('<UsedEquipmentInquiryDialog'),
    'Detail price must render before the inquiry CTA.'
  );
  assert.match(detail, /<InfoRow icon=\{FaIndustry\}/);
  assert.match(detail, /<PublicUsedEquipmentGallery/);
  assert.match(detail, /trigger="Запит на перегляд техніки"/);

  const metadataSection = detail.slice(
    detail.indexOf('export async function generateMetadata'),
    detail.indexOf('function InfoRow')
  );
  assert.doesNotMatch(metadataSection, /priceAmount|formatUsedEquipmentPrice|Offer|application\/ld\+json/);

  const inquiryAction = source('app/(public)/used-equipment/actions.ts');
  const inquiryDialog = source('components/used-equipment/used-equipment-inquiry-dialog.tsx');
  assert.doesNotMatch(inquiryAction, /priceAmount|priceSnapshot/);
  assert.doesNotMatch(inquiryDialog, /priceAmount|priceSnapshot/);

  const priceMigrations = readdirSync(resolve(process.cwd(), 'prisma/migrations'))
    .filter((name) => name.includes('used_equipment_price'));
  assert.deepEqual(priceMigrations, ['20260808190000_add_used_equipment_price_foundation']);

  console.log('Used Equipment public price checks passed.');
}

main();
