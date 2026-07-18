import sanitizeHtml from 'sanitize-html';

export const USED_EQUIPMENT_DESCRIPTION_MIN_TEXT_LENGTH = 10;
export const USED_EQUIPMENT_DESCRIPTION_MAX_TEXT_LENGTH = 20000;
export const USED_EQUIPMENT_DESCRIPTION_MAX_HTML_LENGTH = 100000;

const allowedTags = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a'];

const allowedAttributes = {
  a: ['href', 'target', 'rel']
};

const allowedSchemes = ['http', 'https', 'mailto', 'tel'];

const blockContentTags = ['script', 'style', 'textarea', 'option'];

function isExternalHttpLink(href: string) {
  return /^https?:\/\//i.test(href);
}

export function sanitizeUsedEquipmentDescription(html: string) {
  return sanitizeHtml(html, {
    allowedTags,
    allowedAttributes,
    allowedSchemes,
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    nonTextTags: blockContentTags,
    transformTags: {
      a: (tagName, attribs) => {
        const href = typeof attribs.href === 'string' ? attribs.href.trim() : '';

        if (!href) {
          return { tagName, attribs: {} };
        }

        const linkAttributes: Record<string, string> = { href };

        if (isExternalHttpLink(href)) {
          linkAttributes.target = '_blank';
          linkAttributes.rel = 'noopener noreferrer';
        }

        return {
          tagName,
          attribs: linkAttributes
        };
      }
    }
  }).trim();
}

export function getUsedEquipmentDescriptionVisibleText(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
    nonTextTags: blockContentTags
  })
    .replace(/&nbsp;|\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getUsedEquipmentDescriptionExcerpt(html: string | null | undefined, maxLength = 180) {
  const text = getUsedEquipmentDescriptionVisibleText(html ?? '');

  if (text.length <= maxLength) {
    return text;
  }

  const trimmed = text.slice(0, maxLength + 1).trim();
  const lastSpaceIndex = trimmed.lastIndexOf(' ');
  const safeText = lastSpaceIndex > Math.floor(maxLength * 0.65) ? trimmed.slice(0, lastSpaceIndex) : trimmed.slice(0, maxLength);

  return `${safeText.trim()}…`;
}

export function isUsedEquipmentDescriptionEmpty(html: string) {
  return getUsedEquipmentDescriptionVisibleText(html).length === 0;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function plainTextToHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

export function normalizeUsedEquipmentDescriptionForEditor(value: string | null | undefined) {
  const rawValue = value?.trim() ?? '';

  if (!rawValue) {
    return '';
  }

  if (looksLikeHtml(rawValue)) {
    return sanitizeUsedEquipmentDescription(rawValue);
  }

  return plainTextToHtml(rawValue);
}

export function validateAndSanitizeUsedEquipmentDescription(value: string) {
  if (value.length > USED_EQUIPMENT_DESCRIPTION_MAX_HTML_LENGTH) {
    return {
      ok: false as const,
      message: `Опис має бути не більшим за ${USED_EQUIPMENT_DESCRIPTION_MAX_HTML_LENGTH} символів HTML.`
    };
  }

  const normalized = normalizeUsedEquipmentDescriptionForEditor(value);
  const sanitized = sanitizeUsedEquipmentDescription(normalized);
  const visibleText = getUsedEquipmentDescriptionVisibleText(sanitized);

  if (visibleText.length < USED_EQUIPMENT_DESCRIPTION_MIN_TEXT_LENGTH) {
    return {
      ok: false as const,
      message: 'Додайте змістовний опис техніки.'
    };
  }

  if (visibleText.length > USED_EQUIPMENT_DESCRIPTION_MAX_TEXT_LENGTH) {
    return {
      ok: false as const,
      message: `Опис має бути не довшим за ${USED_EQUIPMENT_DESCRIPTION_MAX_TEXT_LENGTH} видимих символів.`
    };
  }

  return {
    ok: true as const,
    html: sanitized,
    visibleText
  };
}
