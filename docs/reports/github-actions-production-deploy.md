# GitHub Actions Production Deploy через PM2

## 1. Початковий стан

- базова гілка: `main`;
- початковий commit: `20a88dc docs: finalize PM2 integration report`;
- `main` був синхронізований з `origin/main`;
- робоче дерево було чистим;
- робоча гілка: `infra/github-actions-production-deploy`;
- PM2 baseline `231a781` уже містив `.nvmrc` і `ecosystem.config.cjs`;
- Docker stash не застосовувався.

Production workflow у межах цього етапу не запускався, `main` не змінювався, production VPS і database не змінювалися.

## 2. Поточна production-архітектура

Цільова схема:

```text
GitHub Actions (Ubuntu, Node.js 24)
  → npm ci
  → lint
  → typecheck
  → next build
  → перевірений release artifact
  → native OpenSSH upload

Hostinger VPS (developer user)
  → checksum verification
  → release extraction
  → shared env/uploads symlinks
  → npm ci --omit=dev
  → prisma migrate deploy
  → atomic current symlink switch
  → PM2 startOrReload
  → 127.0.0.1:3000 health check
  → retention cleanup
```

Nginx, DNS, SSL, UFW, cron, rclone та PostgreSQL provisioning не входять у scope.

## 3. Результати runtime-аудиту

Для `next start` потрібні:

- GitHub-built `.next`, без `.next/cache`;
- `public`;
- `package.json` і `package-lock.json`;
- `next.config.ts`;
- production `node_modules`, встановлений на Ubuntu VPS;
- `prisma/schema.prisma`, повний `prisma/migrations` і `prisma.config.ts`;
- `ecosystem.config.cjs`;
- shared production env і uploads.

Вихідний код `app`, `lib`, `features` та інші TypeScript source files після standard `next build` для `next start` не потрібні: server code уже скомпільований у `.next`. Винятки, потрібні окремим deploy tools, явно включені в artifact.

Native/runtime dependencies:

- Prisma Client і Prisma engines генеруються/встановлюються повторно на Linux VPS;
- `sharp` є optional dependency Next.js і встановлюється для Linux під час VPS `npm ci`;
- `pdfkit` встановлюється як runtime dependency;
- `tesseract.js` та його runtime assets встановлюються як runtime dependency;
- Cloudinary і Telegram libraries залишаються звичайними runtime dependencies.

GitHub runner і VPS мають однакову ОС-сім’ю та архітектурний клас Ubuntu/Linux x64, тому GitHub-built `.next` переносимий. Windows `node_modules` в artifact не передається.

## 4. Обрана artifact strategy

Обрано **Варіант 2A — standard Next.js build**.

Причини:

- чинний PM2 baseline уже використовує `npm start` / `next start`;
- не потрібно змінювати `next.config.ts` або переходити на `output: 'standalone'`;
- production dependencies установлюються безпосередньо на Linux VPS, тому Prisma і `sharp` отримують правильні platform binaries;
- dynamic import `tesseract.js`, PDFKit, локальне storage і Next image optimization доступні через повний production dependency tree;
- GitHub build не повторюється на VPS.

Standalone не обрано, бо він потребував би додаткової перевірки output tracing для Prisma CLI, OCR/PDF runtime assets і зміни PM2 entrypoint без необхідної переваги для поточного моноліту.

## 5. Сумісність із Next.js, Prisma і Node.js 24

GitHub Actions та VPS використовують `.nvmrc` зі значенням `24`.

На GitHub виконується повний `npm run build`. На VPS виконується лише:

```text
npm ci --omit=dev
prisma migrate deploy
next start
```

Ізольована production-only інсталяція підтвердила наявність:

- Next.js `15.5.19`;
- Prisma CLI і Client `6.19.3`;
- `dotenv` `17.4.2`;
- `sharp` `0.34.5`;
- PDFKit `0.19.1`;
- Tesseract.js `5.1.1`.

`prisma` і `dotenv` переміщено з `devDependencies` у `dependencies` без зміни version ranges. Це мінімально необхідно, оскільки:

- `prisma migrate deploy` потребує локального Prisma CLI;
- `postinstall` виконує `prisma generate`;
- `prisma.config.ts` імпортує `dotenv`;
- VPS навмисно не встановлює весь dev dependency tree.

## 6. Структура artifact

Artifact містить:

```text
.next/                без .next/cache
public/
package.json
package-lock.json
next.config.ts
prisma/
prisma.config.ts
ecosystem.config.cjs
scripts/deploy-production.sh
scripts/rollback-production.sh
```

Archive створюється через sorted tar з нормалізованими owner/group/mtime та `gzip -n`. Для нього створюється SHA-256 checksum.

Artifact не містить `.env*`, `.git`, `node_modules`, uploads, logs, tmp, coverage або private-key material.

## 7. Реалізований workflow

Створено `.github/workflows/deploy-production.yml`.

Властивості:

- лише `workflow_dispatch`;
- input `confirm` повинен точно дорівнювати `DEPLOY`;
- `environment: production`;
- `permissions: contents: read`;
- concurrency group `kairos-production-deploy`;
- `cancel-in-progress: false`;
- Ubuntu runner і Node.js з `.nvmrc`;
- `npm ci`, lint, typecheck, build;
- dependency audit summary без `npm audit fix`;
- deterministic archive і checksum;
- native `ssh` / `scp`;
- release ID: commit SHA + UTC timestamp;
- жодних production runtime secrets у GitHub build environment.

Build використовує лише статичні non-production placeholder URLs для Prisma schema generation. Вони не є GitHub secrets, не дають доступу до database і не використовуються на VPS.

## 8. Реалізований deploy script

`scripts/deploy-production.sh`:

1. вимагає `APP_PATH`, `RELEASE_ID`, `ARTIFACT_PATH`, `CHECKSUM_PATH`;
2. перевіряє безпечні paths, required commands, shared env/uploads/logs і права;
3. перевіряє checksum;
4. відхиляє path traversal, `.env*`, `.git`, `node_modules`, uploads та private keys в artifact;
5. розпаковує новий release;
6. створює лише symlinks до shared env/uploads;
7. виконує `npm ci --omit=dev`, але не `next build`;
8. виконує локальний Prisma CLI `migrate deploy`;
9. зберігає migration status і diagnostic log у release;
10. атомарно перемикає `current`;
11. запускає `pm2 startOrReload` під поточним користувачем;
12. виконує retry health check;
13. виконує `pm2 save`;
14. зберігає current плюс чотири найновіші неактивні releases.

## 9. Реалізований rollback

`scripts/rollback-production.sh`:

- знаходить найновіший попередній deployable release;
- атомарно перемикає `current`;
- виконує PM2 reload;
- перевіряє `127.0.0.1:3000`;
- відновлює початковий code release, якщо rollback target не проходить health check;
- не виконує Prisma rollback/reset;
- явно попереджає, що code rollback не є database rollback.

Rollback слід запускати лише після перевірки сумісності попереднього коду з уже застосованими forward-only migrations.

## 10. Secret та env safety

Production secrets залишаються лише у:

```text
/var/www/kairos-parts/shared/.env.production
```

Deploy створює:

```text
release/.env.production → shared/.env.production
release/.env            → shared/.env.production
```

Другий symlink потрібний для Prisma CLI: поточний `prisma.config.ts` завантажує `.env` та `.env.local`, тоді як Next.js у production завантажує `.env.production`.

Workflow не потребує GitHub secrets для `DATABASE_URL`, `AUTH_SECRET`, Cloudinary або Telegram. SSH private key записується у тимчасовий файл з mode `600` і видаляється через trap.

ED25519 host key отримується через `ssh-keyscan`, але додається у `known_hosts` лише після точного SHA-256 fingerprint match. `StrictHostKeyChecking=no` не використовується.

## 11. Prisma migration strategy

Artifact містить повний `prisma/migrations`.

Production install запускає `prisma generate`, після чого deploy script виконує:

```text
./node_modules/.bin/prisma migrate deploy
```

Не використовуються `db push`, `migrate dev`, `migrate reset` або seed.

Production env повинен містити обидва:

- `DATABASE_URL`;
- `DATABASE_URL_UNPOOLED`.

`DATABASE_URL_UNPOOLED` потрібний, бо Prisma datasource використовує його як `directUrl`. Для локального PostgreSQL обидва variables можуть бути спрямовані на контрольоване direct connection, але їхні значення не фіксуються в Git.

Перший deploy до порожньої database створить `_prisma_migrations` і застосує всі migrations. ADMIN і test CLIENT автоматично не створюються.

## 12. PM2 strategy

Використовується існуючий `ecosystem.config.cjs`:

- process `kairos-web`;
- `cwd: /var/www/kairos-parts/current`;
- один `fork` instance;
- `npm start -- -H 127.0.0.1 -p 3000`;
- autorestart і memory limit;
- logs у shared production logs directory.

PM2 запускається без `sudo`, під SSH user `developer`. Окремий Telegram process не створюється: у застосунку підтверджено webhook route.

## 13. Health check

Health check:

```text
http://127.0.0.1:3000/
```

Використовується до налаштування/перевірки Nginx, DNS і SSL. Скрипт робить до 30 спроб із timeout.

Якщо health check після migration і PM2 reload не проходить:

- database migrations автоматично не відкочуються;
- новий release залишається для діагностики;
- workflow завершується помилкою;
- оператор отримує явне попередження перевірити migration compatibility перед code rollback.

## 14. Release retention

Після успішного health check зберігається максимум п’ять releases:

- активний `current`;
- чотири найновіші неактивні.

Активний release не видаляється. `.incoming` не бере участі у release cleanup і видаляється лише після успішного deploy.

## 15. Результати перевірок

- workflow YAML parser — PASS;
- `bash -n scripts/deploy-production.sh` — PASS;
- `bash -n scripts/rollback-production.sh` — PASS;
- local artifact creation, forbidden-path scan і SHA-256 verification — PASS;
- ізольований `npm ci --omit=dev` — PASS;
- Prisma generate у production-only dependency tree — PASS;
- `npm ci` — PASS;
- lint — PASS;
- typecheck — PASS;
- production build — PASS, 46 routes;
- `git diff --check` — PASS.

`shellcheck` і `actionlint` не були встановлені в доступному середовищі, тому нові global/project dependencies для них не додавалися. Bash syntax перевірено через `bash -n`, YAML — через локально доступний parser і окремі safety assertions.

Workflow і production deploy не запускалися.

## 16. Відомі dependency vulnerabilities

Поточний npm audit summary повідомляє:

- 5 high;
- 2 critical.

`npm audit fix`, dependency upgrades та зміни version ranges не виконувалися. Workflow додає aggregate counts у GitHub Step Summary без автоматичних package mutations.

Перед першим production deploy потрібне окреме security triage/acceptance цих findings.

## 17. Змінені файли

Основний scope:

- `.github/workflows/deploy-production.yml`;
- `scripts/deploy-production.sh`;
- `scripts/rollback-production.sh`;
- `docs/reports/github-actions-production-deploy.md`.

Мінімальні dependency classification changes:

- `package.json`;
- `package-lock.json`.

`next.config.ts` та `ecosystem.config.cjs` не змінювалися.

## 18. Готовність до першого manual run

Workflow технічно готовий до code review і merge в default branch після успішних фінальних checks.

Він не повинен запускатися з цієї task branch. Перший manual run можливий лише після review/merge і виконання checklist нижче.

## 19. Manual checklist

Перед `Actions → Deploy Production → Run workflow`:

1. Переглянути commit і merge `infra/github-actions-production-deploy` у `main` через контрольований процес.
2. Переконатися, що GitHub Environment `production` має approvals, якщо вони потрібні.
3. Перевірити наявність `VPS_HOST`, `VPS_USER`, `VPS_PORT`, `VPS_SSH_KEY`.
4. Перевірити `VPS_APP_PATH=/var/www/kairos-parts`.
5. Звірити актуальний VPS ED25519 fingerprint з pinned fingerprint workflow поза GitHub runner.
6. Перевірити ownership/write access користувача `developer` до releases/shared/logs.
7. Перевірити на VPS `node --version`, `npm --version`, `pm2 --version`, `curl`, `tar`, `sha256sum`.
8. Перевірити shared `.env.production`, не виводячи його вміст.
9. Переконатися, що env містить `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUTH_SECRET`, `KAIROS_UPLOAD_DIR` та потрібні Cloudinary/Telegram variables.
10. Переконатися, що `KAIROS_UPLOAD_DIR` вказує на shared uploads.
11. Перевірити PostgreSQL connectivity під application user окремою безпечною командою.
12. Підтвердити backup/restore readiness, навіть якщо production database поки порожня.
13. Переглянути всі Prisma migrations і forward-only rollback risk.
14. Провести security triage npm vulnerabilities.
15. Переконатися, що port 3000 вільний або керується лише `kairos-web`.
16. Переконатися, що workflow у `main` і вибрано правильний branch/SHA.
17. Ввести `DEPLOY` у confirmation input.
18. Після run перевірити Step Summary, PM2 status, health result, current symlink і migration result.
19. Не запускати seed; створення ADMIN/CLIENT виконувати окремим контрольованим етапом.

## 20. Blocker для першого production deploy

До першого manual run залишаються операційні gates:

- workflow ще не reviewed/merged у `main`;
- GitHub Environment secrets/variable і pinned host fingerprint мають бути повторно перевірені;
- shared production env має пройти completeness check без розкриття значень;
- потрібні database connectivity та backup/restore preflight;
- потрібне security рішення щодо 5 high і 2 critical npm findings;
- потрібно підтвердити forward compatibility усіх migrations і manual rollback procedure.

Жоден із цих кроків не виконувався автоматично в межах цього завдання.
