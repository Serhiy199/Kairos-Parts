import { sanitizeUsedEquipmentDescription } from '../lib/used-equipment/description';

const sanitized = sanitizeUsedEquipmentDescription(
  '<h2 style="text-align:center;color:red" onclick="alert(1)">Заголовок</h2>' +
    '<table><tbody><tr><th colspan="2">A</th><td style="color:red">B</td></tr></tbody></table>' +
    '<img src="https://example.com/image.jpg"><script>alert(1)</script>' +
    '<a href="javascript:alert(1)">Небезпечне посилання</a>'
);

const requiredFragments = ['<h2 style="text-align:center">', '<table>', '<th colspan="2">'];
const forbiddenFragments = ['onclick', 'color:red', '<img', '<script', 'javascript:'];

for (const fragment of requiredFragments) {
  if (!sanitized.includes(fragment)) {
    throw new Error(`Sanitizer removed required fragment: ${fragment}`);
  }
}

for (const fragment of forbiddenFragments) {
  if (sanitized.includes(fragment)) {
    throw new Error(`Sanitizer retained forbidden fragment: ${fragment}`);
  }
}

console.log('Used equipment description sanitizer check passed.');
