# Stage Admin Users 2D.2 — Team Server Action runtime fix

Дата: 21 липня 2026 року.

## 1. Симптом

Після deployment сторінка `/admin/team` падала у Vercel runtime після спроби створити менеджера. Browser показував server-side application error із digest замість контрольованого action result.

## 2. Vercel error

```text
Error: A "use server" file can only export async functions, found object.
at .next/server/app/admin/team/page.js
```

## 3. Root cause

Next.js трактує файл із top-level `'use server'` як Server Action module. У такому модулі runtime exports мають бути async functions. Team action module експортував initial state object, який Next.js намагався зареєструвати як Server Function.

## 4. Точний проблемний файл

Primary runtime crash: `app/admin/team/actions.ts`.

Під час обов'язкового static audit знайдено друге аналогічне порушення в тому самому manager onboarding flow: `app/(auth)/invitation/manager/actions.ts`.

## 5. Точний non-async export

- `INITIAL_TEAM_ACTION_RESULT` у Team action module.
- `INITIAL_MANAGER_PASSWORD_SETUP_STATE` у manager password setup action module.

Type-only exports не створювали runtime object, але відповідні state types також винесені для однозначної module boundary.

## 6. Чому попередні checks не заблокували проблему

TypeScript та ESLint вважають export object валідним TypeScript. Next.js 15 production build також компілював bundle без помилки; runtime restriction спрацювала під час завантаження/реєстрації Server Action module у Vercel після invocation. Попередні checks перевіряли guards і business rules, але не форму runtime exports кожного `'use server'` модуля.

## 7. Змінені файли

- `app/admin/team/actions.ts`
- `app/admin/team/action-state.ts`
- `app/admin/team/team-management.tsx`
- `app/(auth)/invitation/manager/actions.ts`
- `app/(auth)/invitation/manager/action-state.ts`
- `app/(auth)/invitation/manager/[token]/manager-password-form.tsx`
- `docs/stage-admin-users-2d-2-team-server-action-runtime-fix.md`

## 8. Module-boundary fix

Server Action modules тепер експортують лише async action functions. Initial state objects і state types перенесені у звичайні `action-state.ts` modules. Client components імпортують objects/types зі state modules, а actions — з `'use server'` modules. Validation schemas і business services не дублювалися.

Повний static audit усіх файлів із `'use server'` не знайшов інших non-function runtime exports. Інші `export type` безпечні, бо стираються під час компіляції.

## 9. Business logic unchanged

Не змінено ADMIN-only guard, invitation TTL, SHA-256 token storage, single-use claim, regenerate/revoke policy, password validation, authVersion revocation, AuditLog, lifecycle transitions або Serializable transaction boundaries. Prisma schema й migrations у Stage 2D.2 не змінювались. UI та copy не змінювались.

## 10. Manager record після першої невдалої спроби

Read-only lookup за адресою з bug report підтвердив: запис уже існує як `CLIENT / ACTIVE`, має password hash і не має manager invitations. Нова MANAGER row або invitation після невдалої спроби не створились. Запис не змінювався й не видалявся; повторний submit має повернути контрольований existing-email conflict, а не створювати duplicate manager.

Email, IDs, hashes і персональні дані у цьому report та automated audit output не наведені.

## 11. Results 2A–2D

- Stage 2A targeted checks: PASS.
- Stage 2B rules/security checks: PASS.
- Stage 2C rules/security checks: PASS.
- Stage 2D read-only Neon audit: PASS; `hasBlocker: false`.

## 12. Prisma results

- `npx.cmd prisma validate`: PASS.
- `npx.cmd prisma generate`: PASS.
- `npx.cmd prisma migrate status`: 27 migrations found; unrelated migration `20260721100000_add_sequential_invoice_numbers` is pending.

Stage 2D.2 не застосовував migration і не змінював database data. Pending invoice migration не стосується Team runtime fix, але її потрібно окремо узгодити перед загальним production deploy.

## 13. Typecheck

`npm.cmd run typecheck`: PASS.

## 14. Lint

`npm.cmd run lint`: PASS.

## 15. Build

`npm.cmd run build`: PASS, exit code `0`. `/admin/team` і `/invitation/manager/[token]` успішно включені у route manifest. Повідомлення `A "use server" file can only export async functions` у build output відсутнє.

Build зберігає відомі unrelated Prisma/Neon TLS diagnostics для taxonomy count queries; Next.js завершує static generation. Це не частина Team action export bug.

## 16. Git diff check

`git diff --check`: PASS перед commit.

## 17. Browser smoke status

**NOT RUN.** Повний authenticated create-manager flow потребує Vercel redeploy або стабільного staging runtime. Локальний Prisma Client query отримав Windows TLS initialization error, тому локальний browser mutation не видається за PASS.

## 18. Remaining staging steps

1. Узгодити pending invoice migration перед загальним deploy.
2. Push corrective commit і виконати Vercel redeploy.
3. ADMIN відкриває `/admin/team` і перевіряє render/refresh.
4. Submit existing client email має показати safe conflict без 500.
5. Submit нового staging-only email має один раз показати invitation URL.
6. Перевірити manager password setup route після state-module fix.
7. Перевірити MANAGER denial для `/admin/team`.
8. Завершити lifecycle smoke та залишити test manager `DISABLED`.

## 19. Release status

**READY WITH MANUAL STAGING CHECKS** для самого Team Server Action fix. Code/build blocker для push відсутній. Загальний Vercel redeploy має окремий migration gate через pending invoice migration; browser verification після redeploy обов'язкова перед статусом `READY`.
