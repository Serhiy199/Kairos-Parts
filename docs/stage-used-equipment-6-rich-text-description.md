# Stage Used Equipment 6 — Rich-text description

## Scope

Stage 6 adds a safe rich-text description workflow for the CRM used-equipment module.

Implemented:

- TipTap rich-text editor for the required `Опис *` field in the used-equipment create/edit form.
- Sanitized HTML storage in the existing `UsedEquipment.description` string field.
- Server-side sanitization and visible-text validation before create/update.
- Safe rich-text renderer for CRM preview.
- Plain-text compatibility for existing records.
- Ukrainian validation message for empty/non-meaningful descriptions.

Not implemented in this stage:

- Public used-equipment detail page.
- Public catalog/gallery rendering.
- Image upload inside the editor.
- Tables, iframes, videos, custom HTML, colors, fonts, or page-builder controls.
- Telegram/email notifications.
- Stage 7 marketplace functionality.

## Dependencies

Added runtime dependencies:

```text
@tiptap/react
@tiptap/starter-kit
@tiptap/extension-underline
@tiptap/extension-link
sanitize-html
```

Added dev dependency:

```text
@types/sanitize-html
```

## Editor Configuration

The editor is implemented in:

```text
components/ui/rich-text-editor.tsx
```

It uses `immediatelyRender: false` to avoid SSR/hydration mismatch in Next.js client rendering.

Toolbar controls:

- Paragraph;
- H2;
- H3;
- Bold;
- Italic;
- Underline;
- Bullet list;
- Ordered list;
- Blockquote;
- Link / unlink;
- Clear formatting;
- Clear description;
- Undo;
- Redo.

The editor syncs form state through a hidden `description` input. Validation errors preserve the current HTML content.

`internalComment` remains a plain textarea and is not rich text.

## Storage Format

`UsedEquipment.description` remains a `String`.

No Prisma schema change or migration was needed.

New records store sanitized HTML. Existing plain-text descriptions are normalized into safe paragraphs when opened in the editor.

## Sanitization

Sanitization lives in:

```text
lib/used-equipment/description.ts
```

Allowed tags:

```text
p, br, strong, b, em, i, u, h2, h3, ul, ol, li, blockquote, a
```

Allowed attributes:

```text
a: href, target, rel
```

Allowed link protocols:

```text
http, https, mailto, tel
```

Disallowed content:

- `script`;
- `style`;
- `iframe`;
- `object`;
- `embed`;
- `form`;
- `input`;
- `button`;
- `video`;
- `audio`;
- `svg`;
- `math`;
- `table`;
- `img`;
- inline `style`;
- `class`;
- `id`;
- event handlers;
- unsafe link protocols such as `javascript:`, `data:`, `vbscript:`, `file:`.

External HTTP/HTTPS links are normalized with:

```text
target="_blank"
rel="noopener noreferrer"
```

## Empty Content And Limits

Empty HTML variants such as:

```text
<p></p>
<p><br></p>
<p>&nbsp;</p>
<div>   </div>
```

are treated as empty because validation checks visible text, not raw HTML length.

Limits:

- minimum visible text length: 10 characters;
- maximum visible text length: 20,000 characters;
- maximum raw HTML size: 100,000 characters.

Validation message for empty/non-meaningful content:

```text
Додайте змістовний опис техніки.
```

## Safe Rendering

Reusable renderer:

```text
components/ui/safe-rich-text.tsx
```

It sanitizes again before `dangerouslySetInnerHTML`, so stored DB content is not trusted blindly.

CRM edit page now shows a safe preview of the current description before the form.

## Security Smoke Test

Checked sanitizer behavior against:

```text
<script>alert(1)</script>
<p onclick="alert(1)">Текст</p>
<a href="javascript:alert(1)">Небезпечне посилання</a>
<img src=x onerror=alert(1)>
<iframe src="https://example.com"></iframe>
<style>body{display:none}</style>
<p style="position:fixed">Styled</p>
```

Result:

- dangerous tags are removed;
- event handlers are removed;
- inline styles are removed;
- images and iframes are removed;
- unsafe `javascript:` href is not preserved as a working link.

## Responsive Notes

The editor toolbar wraps across multiple rows on narrow screens. The editor keeps stable height and full-width layout inside the existing CRM form card.

Recommended browser QA breakpoints:

```text
1440, 1280, 1024, 768, 430, 390, 375
```

## Checks

Passed during implementation:

```text
npx.cmd prisma validate
npx.cmd prisma generate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
git diff --check
```

`git diff --check` only reported expected CRLF conversion warnings for touched files.

## npm audit

`npm.cmd audit` was run and reported:

```text
3 moderate severity vulnerabilities
```

The advisories are in the `next` / `postcss` / `next-auth` dependency chain, and the `postcss` advisory has no available fix in the current dependency set.

No automatic `npm audit fix` was run because it is outside this stage and may require a broader dependency upgrade decision.

## Stage 7 Readiness

There is no Prisma blocker for the next stage. Public rendering can reuse `SafeRichText` when the used-equipment detail/catalog page is implemented.
