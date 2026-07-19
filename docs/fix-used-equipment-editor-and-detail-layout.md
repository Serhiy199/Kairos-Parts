# Fix Used Equipment: editor and public detail layout

## Scope

This fix aligns the used-equipment CRM controls and public pages with the Kairos Parts design system. It does not change Prisma models, migrations, inquiry business rules, access rules, or persistence flows.

## CRM comboboxes

- `SearchableCombobox` now supports `default` and `light` visual variants.
- The existing dark/public appearance remains the default for backward compatibility.
- Used-equipment type and manufacturer fields use the light variant in create/edit CRM forms.
- Keyboard navigation, filtering, labels, validation messages, and ARIA attributes are unchanged.

## Inquiry dialog

- The public inquiry modal now uses a consistent dark surface, dark inputs, readable secondary text, and dark-theme success/error states.
- The portal, focus trap, Escape handling, focus return, validation, honeypot, duplicate protection, and submit action were not changed.

## Public equipment detail

- The gallery, equipment facts, inquiry CTA, and description now form one cohesive dark detail surface.
- Marketing intro copy, the redundant availability badge, and secondary CTA copy were removed.
- The inquiry action is a single full-width gold button.
- The gallery keeps `next/image`, primary-image behavior, thumbnails, and the defensive no-image state.
- The description remains server-sanitized and is rendered below the main gallery/information grid.

## Rich-text editor

The existing TipTap editor was expanded with:

- paragraph, H2, and H3;
- bold, italic, and underline;
- bullet and ordered lists;
- blockquote;
- left, center, and right alignment;
- add/edit/remove link;
- insert table;
- add/delete row;
- add/delete column;
- delete table;
- clear formatting and clear content;
- undo and redo.

The editor does not provide image upload, base64 images, an image node, raw HTML mode, or arbitrary embed controls.

Added TipTap packages:

- `@tiptap/extension-text-align`;
- `@tiptap/extension-table`;
- `@tiptap/extension-table-row`;
- `@tiptap/extension-table-header`;
- `@tiptap/extension-table-cell`.

## Sanitization and safe rendering

The server sanitizer now permits only the controlled table structure `table`, `thead`, `tbody`, `tr`, `th`, and `td`. Table cells may contain only `colspan` and `rowspan`. Paragraphs and H2/H3 headings may contain only `text-align` with `left`, `center`, or `right` values.

Scripts, images, event handlers, arbitrary CSS, unsafe URL schemes, and all other unapproved markup remain stripped. Link protocols remain limited to the existing allowlist.

`SafeRichText` styles tables and contains wide tables in a local horizontal scroll area, preventing page-level overflow on narrow viewports.

## Verification

Passed:

- `npx.cmd prisma validate`;
- `npx.cmd prisma generate`;
- `npm.cmd run typecheck`;
- `npm.cmd run lint`;
- `npm.cmd run build`;
- `npx.cmd tsx scripts/verify-used-equipment-description-sanitizer.ts`;
- `git diff --check`.

The targeted sanitizer check confirms that controlled tables and text alignment survive while `img`, `script`, event handlers, arbitrary colors, and `javascript:` links are removed.

`npm.cmd audit` reports 3 moderate advisories in the transitive `postcss` bundled through the current Next.js dependency chain. npm reports no fix available. No dependency upgrades or automatic audit fixes were applied in this scoped task.

## Responsive and browser QA

The updated layouts use responsive grid collapse, wrapping toolbar controls, full-width mobile actions, and local table overflow for the requested desktop/tablet/mobile ranges.

A live local browser check was attempted. The route compiled, but local rendering of the database-backed equipment page was blocked by a Windows Prisma-to-Neon TLS error (`Error opening a TLS connection`, OS security credentials error). Therefore the production build and static responsive review passed, while live visual confirmation at 1440, 1280, 1024, 768, 430, 390, and 375 px remains a post-deploy/staging smoke-test item.

## Database and deployment

- Prisma schema changed: no.
- Migration required: no.
- Existing used-equipment and inquiry business logic changed: no.
- Vercel redeploy required to publish the UI and dependency changes: yes.
