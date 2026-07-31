# Kairos Parts — Develop → Main Final Merge

Дата: 2026-07-31

Merge commit: `42e90c9`

Результат Git-інтеграції: **MERGED AND PUSHED TO MAIN**

Production deploy: **NOT RUN**

Production readiness: **BLOCKED PENDING EXPLICIT RISK RESOLUTION**

## 1. Початковий Git стан

- Початкова branch: `release/develop-to-main-20260731`.
- Release HEAD: `64285329355a929a25250635687ee284cec3dd6b`.
- `main` і `origin/main` перед merge: `055200959f2ed8e1be628d46e91265f23cc93e61`.
- `origin/develop`: `cbec63224af29fe7b081b8e71b8ab14de700a38f`.
- Working tree був чистим.
- Незавершених merge, cherry-pick або rebase не було.
- `stash@{0}: WIP Docker baseline before PM2 switch` не застосовувався і не видалявся.
- Виконано `git fetch origin --prune`; local tracking refs були актуальні.

## 2. Порівняння migrations

Надійне tree comparison між `origin/main` і `origin/release/develop-to-main-20260731` показало:

```text
origin/main migration folders: 36
release migration folders: 47
new folders: 11
lost folders: 0
changed old migration trees: 0
```

`prisma/schema.prisma` очікувано оновлений. Усі migration differences є додаванням нових `migration.sql`; delete або rename не виявлено.

## 3. Neon/Vercel migration state

Під час безпосередньо попереднього staging rehearsal exact Preview branch використовувала підтверджену non-production Neon DB:

```text
database: neondb
provider: Neon PostgreSQL 17.10
repository migrations: 47
applied: 47
pending: 0
failed: 0
rolled back: 0
status: Database schema is up to date
```

Усі 11 release migrations були присутні в `_prisma_migrations` рівно один раз. Вони вже були застосовані до staging до початку останнього rehearsal; контрольний `prisma migrate deploy` був успішним no-op.

## 4. Production VPS migration state

Fresh read-only SSH attempt через primary alias `kairos-vps` завершився `Permission denied (publickey)`. Інший deployment key не використовувався, щоб не розширювати доступ без потреби.

Використано дозволений промптом останній підтверджений read-only evidence з `docs/reports/kairos-parts-branch-deployment-database-topology-audit.md`:

```text
deployed SHA: 055200959f2ed8e1be628d46e91265f23cc93e61
production migration folders in deployed release: 36
production _prisma_migrations: 36 applied
unfinished: 0
rolled back: 0
last migration: 20260723120000_add_auth_audit_events
schema status: up to date relative to current 36-migration production artifact
```

Нові 11 migrations не могли бути застосовані production deploy до merge, бо їх не було в deployed artifact. Fresh live status необхідно повторити перед ручним workflow.

## 5. Підтвердження 11 нових migrations

1. `20260727120000_add_awaiting_invoice_and_invoice_sent_request_statuses`
2. `20260727183000_add_request_selection_batch_foundation`
3. `20260728120000_add_request_selection_item_audit_events`
4. `20260728150000_add_partially_approved_selection_batch_status`
5. `20260728151000_add_invoice_selection_provenance`
6. `20260729120000_add_logistics_persistence_foundation`
7. `20260729160000_add_manual_logistics_addresses`
8. `20260729230000_add_logistics_preferred_delivery_date`
9. `20260730120000_add_individual_logistics_pricing`
10. `20260730123000_add_document_source_provenance`
11. `20260730170000_add_request_file_cloudinary_storage`

Усі назви мають timestamp, більший за останню migration production baseline. Ordering послідовний.

## 6. Відсутність втрати старих migrations

- Усі 36 migration folder names з `origin/main` присутні в release і merge result.
- Tree object кожної старої migration ідентичний між `origin/main` та release.
- Старих migrations не видалено, не перейменовано і не переписано.
- Після merge repository містить 47 migration folders.

## 7. Merge integration branch у main

Виконано:

```text
git switch main
git pull --ff-only origin main
git merge --no-ff release/develop-to-main-20260731
```

`main` перед merge: `0552009`.

Merge commit: `42e90c9 Merge branch 'release/develop-to-main-20260731'`.

Стратегія: `ort`. Глобальні `ours` або `theirs` не використовувалися.

## 8. Конфлікти

Конфліктів не виникло.

```text
conflict files: none
unmerged paths: none
```

## 9. Рішення конфліктів

Ручне conflict resolution не виконувалося, оскільки merge був чистим. Production і develop частини були попередньо інтегровані та перевірені в release branch.

## 10. Production infrastructure preservation

Після merge підтверджена наявність:

- `.github/workflows/deploy-production.yml`;
- `scripts/deploy-production.sh`;
- `scripts/rollback-production.sh`;
- `ecosystem.config.cjs`;
- `.nvmrc`;
- `vercel.json`;
- `middleware.ts`;
- `lib/auth/redirect-url.ts`;
- `scripts/check-production-redirect-origin.ts`.

Production workflow зберіг:

- `workflow_dispatch` only;
- `environment: production`;
- обов'язковий input `DEPLOY`;
- `APP_BASE_URL` з `vars.APP_BASE_URL`;
- SHA-256 artifact checksum;
- SSH host fingerprint verification;
- `prisma migrate deploy` у remote deploy script;
- PM2 `startOrReload`;
- health check і rollback handling.

## 11. Redirect fix preservation

Збережена послідовність public origin resolution:

```text
x-forwarded-host + x-forwarded-proto
→ APP_BASE_URL
→ request.nextUrl.origin
```

`npm run auth:redirect-origin:check` після merge: PASS. Regression test окремо перевіряє, що internal `https://localhost:3000` не повертається як public redirect origin.

## 12. Vercel policy preservation

`vercel.json` після merge:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": {
      "main": false,
      "develop": true
    }
  }
}
```

Push `main` не має запускати Vercel production deployment.

## 13. Prisma validate/generate

Після merge:

- `npm ci`: PASS; 533 packages installed from lockfile;
- `npx prisma validate`: PASS;
- `npx prisma generate`: PASS;
- Prisma Client: `6.19.3`;
- `package-lock.json` вручну не редагувався;
- `prisma migrate deploy`, `migrate dev`, `db push`, `reset` і seed локально або production не запускалися.

## 14. Lint/typecheck/build

Після merge:

```text
Lint: PASS
Typecheck: PASS
Build: PASS
Generated static pages: 57/57
Redirect origin regression: PASS
Prisma validate: PASS
Prisma generate: PASS
```

У попередньому exact-release staging gate domain regression також мала результат `26/26 PASS`; після merge повторно запускалися обов'язкові checks із цього завдання.

Повний dependency tree після `npm ci` усе ще повідомляє `2 critical` і `5 high`; `npm audit fix` не запускався.

## 15. Push main

Перед push:

```text
main: ahead of origin/main
working tree: clean
merge commit: 42e90c9
```

Виконано звичайний non-force push:

```text
0552009..42e90c9  main -> main
```

Force push не використовувався. Report додається окремим docs-only commit після merge push.

## 16. Що не виконувалося

- GitHub Actions `Deploy Production` не запускався.
- `workflow_dispatch` не викликався.
- Production `prisma migrate deploy` не запускався.
- Production DB не змінювалася, не reset-илася, не restore-илася і не seed-илася.
- Production users або data не створювалися і не видалялися.
- Nginx, PM2, DNS, Certbot, GitHub Secrets та production Environment не змінювалися.
- Dependency upgrades і `npm audit fix` не виконувалися.
- Stash не застосовувався.

## 17. Checklist ручного production deploy

Перед запуском workflow:

1. Відновити working read-only SSH access і виконати fresh `npx prisma migrate status` на VPS.
2. Підтвердити production baseline `36/36`, 0 failed/rolled back migrations.
3. Створити fresh production `pg_dump` у custom format.
4. Виконати `pg_restore --list` і створити SHA-256 checksum.
5. Скопіювати dump поза VPS та перевірити disk space.
6. Окремо прийняти або усунути security і staging-smoke blockers із розділу 18.
7. У GitHub відкрити `Actions → Deploy Production → Run workflow`.
8. Вибрати branch `main` і ввести `DEPLOY`.
9. Дочекатися checksum, SSH, migration, PM2 і health gates.
10. Не rerun-ити workflow навмання у разі migration failure; спочатку зберегти logs і проаналізувати `_prisma_migrations`.

Після workflow:

1. Виконати production `npx prisma migrate status`; очікується `Database schema is up to date!`.
2. Підтвердити 47 applied migrations, 0 failed і 0 rolled back.
3. Виконати `pm2 status` і HTTPS health check.
4. Перевірити `/client → https://kairos-parts.com.ua/login?next=%2Fclient`.
5. Перевірити `/admin → https://kairos-parts.com.ua/admin/login?next=%2Fadmin`.
6. Виконати ручні ADMIN/MANAGER/CLIENT, request, invoice, files/OCR, vehicle і logistics smoke tests.

## 18. Blockers

Merge і push `main` завершені, але перед ручним production deploy залишаються:

1. **Fresh VPS migration status відсутній.** Primary SSH key не пройшов authentication; production `36/36` взято з попереднього read-only audit, що дозволено завданням, але це не current runtime proof.
2. **Dependency security.** Попередній runtime-only audit показав `2 critical + 4 high`; повний install tree зараз показує `2 critical + 5 high`. Серед runtime findings є Auth.js/`next-auth` та Next.js advisories. Їх слід усунути або письмово прийняти ризик до production deploy.
3. **Staging live smoke неповний.** Vercel Deployment Protection заблокував повну routing/auth/workflow перевірку.
4. **Third-party staging isolation не доведена.** Окремий Cloudinary namespace/account і Telegram bot identity не були підтверджені; зовнішні staging mutations не запускалися.
5. **`Document.source` data-path не exercised.** Staging `Document` була порожня, хоча schema і SQL guards перевірені.

Отже, source integration у `main` завершена технічно коректно, але запуск production workflow не рекомендується до закриття або явного прийняття наведених ризиків.
