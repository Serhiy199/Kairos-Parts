import { normalizeRichTextHtml } from '../lib/rich-text/normalize';
import { normalizeUsedEquipmentDescriptionForEditor } from '../lib/used-equipment/description';

const plainText = ['Перший рядок', 'Другий рядок', '', 'Новий абзац'].join('\n');
const normalized = normalizeRichTextHtml(plainText);

if (normalized !== '<p>Перший рядок<br>Другий рядок</p><p>Новий абзац</p>') {
  throw new Error(`Unexpected plain-text normalization: ${normalized}`);
}

const sanitized = normalizeUsedEquipmentDescriptionForEditor(
  '<p>Текст</p><img src="https://example.com/equipment.jpg" alt="Техніка"><script>alert(1)</script>'
);

if (!sanitized.includes('<img') || sanitized.includes('<script')) {
  throw new Error(`Unexpected rich-text sanitization: ${sanitized}`);
}

console.log('Rich-text normalization and sanitization checks passed.');
