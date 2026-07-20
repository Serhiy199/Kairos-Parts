function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

export function normalizeRichTextHtml(value: string | null | undefined) {
  const trimmed = value?.replace(/\r\n?/g, '\n').trim() ?? '';

  if (!trimmed || looksLikeHtml(trimmed)) {
    return trimmed;
  }

  return trimmed
    .split('\n')
    .map((line) => line.trim())
    .map((line) => (line ? `<p>${escapeHtml(line)}</p>` : '<p></p>'))
    .join('');
}
