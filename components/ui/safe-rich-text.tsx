import { normalizeUsedEquipmentDescriptionForEditor, sanitizeUsedEquipmentDescription } from '@/lib/used-equipment/description';

type SafeRichTextProps = {
  html: string | null | undefined;
  className?: string;
};

export function SafeRichText({ html, className = '' }: SafeRichTextProps) {
  const normalized = normalizeUsedEquipmentDescriptionForEditor(html);
  const sanitized = sanitizeUsedEquipmentDescription(normalized);

  if (!sanitized) {
    return null;
  }

  return (
    <div
      className={[
        'max-w-none text-sm leading-6 text-muted',
        '[&_a]:font-semibold [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-4',
        '[&_blockquote]:border-l-4 [&_blockquote]:border-accent/40 [&_blockquote]:pl-4 [&_blockquote]:italic',
        '[&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground',
        '[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-foreground',
        '[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5',
        '[&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
        '[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5',
        className
      ]
        .filter(Boolean)
        .join(' ')}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
