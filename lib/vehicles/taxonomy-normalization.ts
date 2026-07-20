export function normalizeTaxonomyName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('uk-UA');
}

const CYRILLIC_SLUG_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ye', ж: 'zh', з: 'z',
  и: 'y', і: 'i', ї: 'yi', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ь: '', ю: 'yu', я: 'ya', ы: 'y', э: 'e', ё: 'yo', ъ: ''
};

export function taxonomySlug(value: string) {
  const transliterated = normalizeTaxonomyName(value)
    .split('')
    .map((character) => CYRILLIC_SLUG_MAP[character] ?? character)
    .join('');

  return transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'directory-item';
}

export function uniqueTaxonomySlug(value: string, occupiedSlugs: ReadonlySet<string>) {
  const baseSlug = taxonomySlug(value);

  if (!occupiedSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  while (occupiedSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}
