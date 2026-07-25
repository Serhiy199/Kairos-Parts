# PM2 Production Baseline — інтеграція в main

## 1. Початковий стан main, develop та origin/main

Аудит виконано після `git fetch origin --prune`.

- активна гілка: `main`;
- робоче дерево до інтеграції: чисте;
- локальний `main`: `1cf1416 feat(audit): cover session and authentication events`;
- `origin/main`: `63a20ff feat(audit): cover critical CRM operations`;
- `develop`: `d531a80 Merge branch 'infra/pm2-production-baseline' into develop`;
- PM2 baseline: `e951eec chore: add PM2 production baseline`;
- `e951eec` має прямого parent `1cf1416`, тобто був створений безпосередньо поверх початкового локального `main`.

## 2. Коміти, які були лише локально

До інтеграції `main` випереджав `origin/main` на два коміти:

1. `1cf1416 feat(audit): cover session and authentication events`;
2. `4eac54a feat(admin): add manager activity audit UI`.

`origin/main..main` не містив інших комітів, а `main..origin/main` був порожнім. Обидва audit-коміти збережено без зміни історії.

## 3. Різниця між main і develop

Tree-diff `main..develop` до інтеграції містив рівно два файли:

- `.nvmrc`;
- `ecosystem.config.cjs`.

Application code, Prisma schema/migrations, auth, audit, database configuration та dependency manifests між цими гілками не відрізнялися.

## 4. Git-конфлікти

Реальних Git-конфліктів не було. У `main` не існувало ні `.nvmrc`, ні `ecosystem.config.cjs`, а parent PM2-коміту точно збігався з початковим `HEAD` гілки `main`.

## 5. Причина можливих розбіжностей

Різниця історії пояснювалася лише тим, що `develop` містив merge commit `d531a80` та PM2 commit `e951eec`, тоді як `main` містив спільний parent `1cf1416`. Прихованих application/database/auth/audit розбіжностей не виявлено.

## 6. Метод інтеграції

Використано:

```text
git cherry-pick e951eec
```

Merge `develop → main` не виконувався. Конфлікти не вирішувалися, Docker stash не застосовувався. До task-коміту додано цей обов’язковий звіт; PM2 baseline-файли перенесені без зміни їхнього вмісту.

## 7. Фінальний commit

Commit message:

```text
chore: add PM2 production baseline
```

Фінальний hash PM2 integration commit: `231a781324b60088bbf1ce57e749fdce07b67bd8`.

Початковий hash чистого cherry-pick до додавання звіту: `628bf59`.

## 8. Перевірка PM2 baseline

`.nvmrc` містить `24`.

`ecosystem.config.cjs`:

- запускає один процес `kairos-web`;
- використовує `/var/www/kairos-parts/current`;
- виконує `npm start -- -H 127.0.0.1 -p 3000`;
- використовує `instances: 1` та `exec_mode: 'fork'`;
- має `autorestart: true`, `watch: false`;
- має `max_memory_restart: '1500M'` і `restart_delay`;
- пише stdout/stderr у `/var/www/kairos-parts/logs/`;
- не містить секретів, staging URL, Docker-конфігурації або окремого Telegram process.

## 9. Результати перевірок

- `npm ci` — PASS, встановлено 533 packages; lockfile не змінено;
- `npm run lint` — PASS;
- `npm run typecheck` — PASS;
- `npm run build` — PASS, Next.js production build згенерував 46 сторінок;
- `git diff --check` — PASS.

`npm ci` повідомив про 7 відомих dependency vulnerabilities: 5 high і 2 critical. `npm audit fix` не запускався, оскільки оновлення залежностей заборонене scope цього завдання.

## 10. Push

Звичайний non-force push виконано:

```text
63a20ff..231a781 main -> main
```

Після `git fetch origin` гілки `main` та `origin/main` були синхронізовані, робоче дерево — чисте.

Force push не використовувався.

## 11. Docker stash

Stash збережено й не застосовувався:

```text
stash@{0}: On infra/docker-production-baseline: WIP Docker baseline before PM2 switch
```

Dockerfile, compose-файли, `sharp` та `output: standalone` з нього не поверталися.

## 12. Відсутність небажаних файлів

PM2 integration не додає:

- Dockerfile, `.dockerignore`, compose-файли;
- `.env*`, secrets, VPS credentials або SSH keys;
- backup files;
- `node_modules`, `.next`, uploads;
- application, auth, database чи audit code.

## 13. Blocker для першого ручного VPS deploy

Перший ручний deploy у межах цього завдання не починався.

Перед ним окремо потрібно:

1. підтвердити provisioning Ubuntu/Nginx/Node.js 24/PM2 і права на `/var/www/kairos-parts`;
2. безпечно налаштувати production environment variables поза Git;
3. створити та перевірити каталог `/var/www/kairos-parts/logs`;
4. перед deploy повторити `prisma migrate status`; на момент фінальної перевірки всі 36 migrations застосовані й database schema up to date;
5. виконати security triage 7 dependency vulnerabilities без автоматичного оновлення production dependencies;
6. перевірити backup/restore, Nginx health check і rollback procedure.

VPS, Vercel, DNS, cron та production database у межах цієї інтеграції не змінювалися.
