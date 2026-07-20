# Admin rich text editor: Tiptap v3 stabilization

## Summary

Поле `Опис` у CRM-формах БВ техніки переведене на reusable компонент `AdminRichTextEditor`. Аудит показав, що попередній компонент уже використовував Tiptap v3, тому заміни іншої editor-бібліотеки не було. Зміна стабілізує наявну реалізацію, додає відсутній `Image` extension і відокремлює admin editor від загальних UI-компонентів.

У поточному Kairos Parts цей editor використовується лише у create/edit формі БВ техніки. Admin-форми товарів, категорій або підкатегорій із rich-text полем у репозиторії відсутні; API-заглушки категорій не змінювалися.

## Installed packages

Додано:

- `@tiptap/extension-image` `3.28.0`.

Наявний Tiptap v3 stack залишено узгодженим на `3.28.0`:

- `@tiptap/react`;
- `@tiptap/starter-kit`;
- `@tiptap/extension-link`;
- `@tiptap/extension-table`;
- `@tiptap/extension-table-cell`;
- `@tiptap/extension-table-header`;
- `@tiptap/extension-table-row`;
- `@tiptap/extension-text-align`;
- `@tiptap/extension-underline`.

Референс указував `3.25.0`, але проєкт уже мав повний stack `3.28.0`. Спроба часткового downgrade створила invalid peer tree через транзитивні Tiptap `3.28.0`; її не залишено. `npm ls` підтверджує єдину валідну версію `3.28.0` для `@tiptap/core` та всіх використаних extensions.

## Files changed

- `components/admin/admin-rich-text-editor.tsx` — reusable client editor з HTML value/onChange, toolbar, зовнішнім value sync, disabled/minHeight/className та вставкою image URL.
- `components/used-equipment/used-equipment-form.tsx` — create/edit форма БВ техніки використовує `AdminRichTextEditor`.
- `components/ui/rich-text-editor.tsx` — старий локальний wrapper видалено після заміни єдиного caller.
- `lib/rich-text/normalize.ts` — shared plain-text to HTML normalization з HTML escaping.
- `lib/used-equipment/description.ts` — server-side sanitizer дозволяє безпечні HTTP(S) images і використовує shared normalization.
- `components/ui/safe-rich-text.tsx` — responsive стилі публічного image rendering.
- `scripts/check-rich-text-editor.ts` — targeted normalization/sanitization check.
- `package.json`, `package-lock.json` — додано `@tiptap/extension-image`.

## Old editor

Окремої старої editor library не виявлено. Попередній `RichTextEditor` уже базувався на Tiptap v3 `3.28.0`, тому жодну сторонню editor dependency не видаляли. Компонент замінено на reusable `AdminRichTextEditor` з ширшим контрактом і повним набором потрібних extensions.

## Data format

Основний формат залишається HTML string:

- editor приймає `value: string`;
- при редагуванні викликає `onChange(editor.getHTML())`;
- hidden form field передає HTML у чинний server action;
- Prisma schema та backend contract не змінювалися;
- plain text при відкритті нормалізується в `<p>` і `<br>`;
- перед збереженням і публічним rendering HTML проходить server-side sanitization.

Дозволені image source protocols: `http` та `https`. Base64 і небезпечні протоколи не дозволяються.

## Image handling

Окремого generic endpoint для inline rich-text images у Kairos Parts немає. Наявний Cloudinary flow керує gallery БВ техніки, а не вкладеннями editor. Тому в цьому scope реалізовано безпечну вставку image URL без створення нового upload API.

## Checks

Пройшли:

- `npm.cmd ls ...` — Tiptap dependency tree валідний, весь stack `3.28.0`;
- `npx.cmd prisma validate`;
- `npm.cmd run typecheck`;
- `npm.cmd run lint`;
- `npx.cmd tsx scripts/check-rich-text-editor.ts`;
- `npm.cmd run build`;
- `git diff --check`.

Build завершився успішно. Під час static generation Prisma вивів наявні TLS diagnostics для taxonomy counts, але Next.js згенерував усі сторінки та завершився з exit code `0`.

## Notes / Blockers

- Повний browser smoke із входом у CRM, збереженням запису та повторним відкриттям не виконано: background dev server не залишається активним у поточному sandbox, а browser driver недоступний.
- Компіляція create/edit routes і server/public rendering підтверджена production build.
- Для ручної перевірки після запуску dev server потрібно перевірити P/H2/H3, bold/italic/underline, списки, цитату, вирівнювання, link/unlink, image URL, таблицю, undo/redo, save/reopen і public detail rendering.
- Prisma schema не змінювалася, migration не потрібна.
- Коміт не створено відповідно до обмеження завдання.
