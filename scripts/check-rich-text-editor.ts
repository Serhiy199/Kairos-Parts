import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

import { applyHeading } from '../lib/rich-text/heading';
import { normalizeRichTextHtml } from '../lib/rich-text/normalize';
import { normalizeUsedEquipmentDescriptionForEditor } from '../lib/used-equipment/description';

const plainText = ['Перший рядок', 'Другий рядок', '', 'Новий абзац'].join('\n');
const normalized = normalizeRichTextHtml(plainText);

if (normalized !== '<p>Перший рядок</p><p>Другий рядок</p><p></p><p>Новий абзац</p>') {
  throw new Error(`Unexpected plain-text normalization: ${normalized}`);
}

const escaped = normalizeRichTextHtml('<не HTML & text>');
if (escaped !== '<p>&lt;не HTML &amp; text&gt;</p>') {
  throw new Error(`Unexpected escaping: ${escaped}`);
}

const existingHtml = '<h2>Готовий HTML</h2><p>Опис</p>';
if (normalizeRichTextHtml(existingHtml) !== existingHtml) {
  throw new Error('Existing HTML was unexpectedly normalized.');
}

const sanitized = normalizeUsedEquipmentDescriptionForEditor(
  '<p>Текст</p><img src="https://example.com/equipment.jpg" alt="Техніка"><script>alert(1)</script>'
);

if (!sanitized.includes('<img') || sanitized.includes('<script')) {
  throw new Error(`Unexpected rich-text sanitization: ${sanitized}`);
}

const editor = new Editor({
  extensions: [StarterKit.configure({ heading: { levels: [2, 3] } })],
  content: {
    type: 'doc',
    content: ['Рядок A', 'Рядок B', 'Рядок C'].map((line) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: line }]
    }))
  }
});

let middleLinePosition = 0;
editor.state.doc.descendants((node, position) => {
  if (node.isText && node.text === 'Рядок B') {
    middleLinePosition = position;
  }
});
editor.commands.setTextSelection(middleLinePosition);
applyHeading(editor, 3);
const paragraphHeadingTypes = editor.getJSON().content?.map((node) => node.type).join('|');
if (paragraphHeadingTypes !== 'paragraph|heading|paragraph') {
  throw new Error(`Unexpected current-paragraph heading result: ${JSON.stringify(editor.getJSON())}`);
}

const text = 'дуже гарний робочий стан після ремонту';
const selectedText = 'робочий стан';
editor.commands.setContent({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
});
const selectionStart = 1 + text.indexOf(selectedText);
editor.commands.setTextSelection({ from: selectionStart, to: selectionStart + selectedText.length });
applyHeading(editor, 2);
const partialSelectionShape = editor.state.doc.content.content.map((node) => `${node.type.name}:${node.textContent}`).join('|');
if (partialSelectionShape !== 'paragraph:дуже гарний |heading:робочий стан|paragraph: після ремонту') {
  throw new Error(`Unexpected partial-selection heading result: ${JSON.stringify(editor.getJSON())}`);
}

if (!editor.isActive('heading', { level: 2 })) {
  throw new Error('Heading active state was not preserved for the selected block.');
}

editor.destroy();

console.log('Rich-text normalization and sanitization checks passed.');
