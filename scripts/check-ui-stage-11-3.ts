import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { taxonomySlug, uniqueTaxonomySlug } from '../lib/vehicles/taxonomy-normalization';

const slugCases = new Map([
  ['Трактор', 'traktor'],
  ['Спеціальна техніка', 'spetsialna-tekhnika'],
  ['Китайські міні-трактори', 'kytaiski-mini-traktory'],
  ['  Трактор --- 4x4  ', 'traktor-4x4']
]);

for (const [input, expected] of slugCases) {
  const actual = taxonomySlug(input);
  if (actual !== expected) {
    throw new Error(`Unexpected taxonomy slug for ${input}: ${actual}`);
  }
}

const occupied = new Set(['traktor', 'traktor-2', 'traktor-3']);
if (uniqueTaxonomySlug('Трактор', occupied) !== 'traktor-4') {
  throw new Error('Equipment type slug suffix is not deterministic.');
}

const projectRoot = resolve(import.meta.dirname, '..');
const equipmentTypesPage = readFileSync(resolve(projectRoot, 'app/admin/directories/equipment-types/page.tsx'), 'utf8');
const directoryActions = readFileSync(resolve(projectRoot, 'app/admin/directories/actions.ts'), 'utf8');
const clientLayout = readFileSync(resolve(projectRoot, 'app/client/layout.tsx'), 'utf8');

if (equipmentTypesPage.includes('name="slug"') || equipmentTypesPage.includes('label="Slug"')) {
  throw new Error('EquipmentType slug is still exposed in the admin form.');
}

if (directoryActions.includes("value(formData, 'slug')")) {
  throw new Error('EquipmentType action still trusts a browser-provided slug.');
}

for (const icon of ['dashboard', 'requests', 'tractor', 'documents', 'changes', 'profile']) {
  if (!clientLayout.includes(`icon: '${icon}'`)) {
    throw new Error(`Client navigation icon is missing: ${icon}`);
  }
}

console.log('Stage UI 11.3 taxonomy and client navigation checks passed.');
