import { normalizeUkrainianPhone } from '@/lib/phone/normalize';

const validCases = new Map([
  ['0680087708', '+380680087708'],
  ['380680087708', '+380680087708'],
  ['+380680087708', '+380680087708'],
  ['(068) 008 77 08', '+380680087708'],
  ['068 008 77 08', '+380680087708'],
  ['068-008-77-08', '+380680087708'],
  ['+38 (068) 008-77-08', '+380680087708']
]);

const invalidCases = [
  '+38000000000',
  '068008770',
  '06800877088',
  '+48123456789',
  'abc',
  '',
  '   ',
  '() --',
  '+380680087708 ext 1',
  '068/008/77/08'
];

for (const [input, expected] of validCases) {
  const actual = normalizeUkrainianPhone(input);
  if (actual !== expected) {
    throw new Error('A valid Ukrainian phone normalization case failed.');
  }
}

for (const input of invalidCases) {
  if (normalizeUkrainianPhone(input) !== null) {
    throw new Error('An invalid Ukrainian phone rejection case failed.');
  }
}

console.log(`clientPhoneValidation=PASS valid=${validCases.size} invalid=${invalidCases.length}`);
