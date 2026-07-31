# Kairos Parts — Branch, deployment and database topology audit

Дата аудиту: 2026-07-28
Режим: read-only для Git remote, Vercel, VPS і PostgreSQL; єдина зміна у репозиторії — цей звіт.

## 1. Executive summary

Фактична топологія не є моделлю «одна гілка — один однаковий deployment pipeline»:

- `develop` є Vercel Production Branch і автоматично розгортається у Vercel target `production`. Поточний deployment відповідає `135807fe11431dffdc1d1d4bf0f11d9453237186`.
- `main` є джерелом production-релізу на VPS, але deployment виконується лише вручну через GitHub Actions `workflow_dispatch`. Поточний VPS-реліз відповідає `055200959f2ed8e1be628d46e91265f23cc93e61`.
- push у `main` сам по собі не запускає VPS deployment. Git integration Vercel натомість створює для `main` Vercel Preview deployment.
- Vercel використовує віддалений Neon PostgreSQL, а VPS — локальний PostgreSQL 17 на `127.0.0.1:5432`. Фізична ізоляція БД підтверджена.
- Neon/Vercel DB має 36 застосованих із 38 наявних у `develop` міграцій; Stage 2 і Stage 4B pending.
- VPS DB має 36 застосованих міграцій і є up to date відносно поточного `main`-релізу, де існують лише 36 migration directories. Дві нові міграції ще не входять до deployed artifact.
- Stage 2–4D містяться тільки в `develop`. `main` і `develop` мають розбіжність 10/10 commits.
- Застосовувати Stage 2/4B зараз небезпечно і у Vercel, і на VPS: для Vercel спочатку треба усунути неоднозначне DB resource binding; для VPS — інтегрувати й перевірити код у `main`, створити backup і лише тоді виконати штатний release.

Жодних migrations, DDL, DML, deployment, Vercel/VPS config changes або Stage 5 робіт під час аудиту не виконано.

## 2. Git branch topology

Live-перевірка `origin` (`git ls-remote --heads origin`) показала:

| Branch | Remote HEAD | Роль |
|---|---|---|
| `develop` | `135807fe11431dffdc1d1d4bf0f11d9453237186` | інтеграційна гілка; Vercel Production Branch; містить Stage 2–4D |
| `main` | `055200959f2ed8e1be628d46e91265f23cc93e61` | джерело production-релізу на VPS |
| `fix/production-redirect-origin` | `bbe0e92...` | уже інтегрована production fix branch |
| `infra/github-actions-production-deploy` | `3f2bff2...` | джерело deployment workflow |
| `infra/production-admin-bootstrap` | `1a7e671...` | production ADMIN bootstrap tooling |

`develop`-only Stage commits:

- `73d77d9` — Stage 2 domain model and transition service;
- `c4f4c82` — Stage 3 draft selection trigger;
- `18ecc7e` — Stage 4A audit;
- `1048546` — Stage 4B selection batch foundation;
- `73b3491` — Stage 4C send-for-approval trigger;
- `885ffb9` — Stage 4D immutable batch UI read model;
- `135807f` — test DB migration activation audit/report.

`main` містить окремі production infrastructure/security commits, яких немає в `develop`, зокрема GitHub Actions deployment, production ADMIN bootstrap і redirect-origin fix.

## 3. Local and remote branch state

Аудит і цей report виконані в `develop`.

| Ref | SHA | Стан відносно remote |
|---|---|---|
| local `develop` до report commit | `135807fe11431dffdc1d1d4bf0f11d9453237186` | `0` ahead / `0` behind `origin/develop` |
| `origin/develop` | `135807fe11431dffdc1d1d4bf0f11d9453237186` | live remote підтверджено |
| local `main` | `055200959f2ed8e1be628d46e91265f23cc93e61` | `0` ahead / `0` behind `origin/main` |
| `origin/main` | `055200959f2ed8e1be628d46e91265f23cc93e61` | live remote підтверджено |

`main...develop`: `10 10`; merge base — `1cf141696f9ff88d76f7bc5f24ea6ada9f84e60e`. Це справжня двостороння розбіжність, а не просте fast-forward відставання.

Під час аудиту `main` не редагувався і його ref не переміщувався.

## 4. GitHub Actions and deployment triggers

У tree `develop` директорія `.github/workflows` відсутня. У `main` існує один deployment workflow:

`main:.github/workflows/deploy-production.yml`

Фактичні властивості:

- trigger — тільки `workflow_dispatch`;
- оператор має ввести `confirm=DEPLOY`;
- автоматичного trigger на `push` немає;
- job використовує GitHub Environment `production`;
- workflow checkout-ить обраний ref, виконує `npm ci`, lint, typecheck і build;
- build використовує окремий неproduction localhost placeholder DB URL;
- release archive передається SSH на `/var/www/kairos-parts`;
- remote script виконує `npm ci --omit=dev`, далі `prisma migrate deploy`, після цього перемикає `current`, reload-ить PM2 і перевіряє health;
- rollback script повертає кодовий release, але прямо не відкочує БД.

Важливе обмеження: workflow не має умови, що ref обов’язково `main`. Водночас workflow і production deploy scripts відсутні у `develop`, тому ручний запуск на довільному ref не є надійним способом деплою `develop`.

## 5. Vercel project configuration

Linked project:

| Поле | Значення |
|---|---|
| Project | `kairos-parts` |
| Project ID | `prj_YIWQSdRXmSNAP6pcepoz7YCfW3v7` |
| Team ID | `team_Q4tt0g8CoJoV4SNQirt12UQf` |
| Git repository | `Serhiy199/Kairos-Parts` |
| Framework | Next.js |
| Node.js | `24.x` |
| Vercel targets | `production`, `preview` |

Дані отримано read-only через локальний link metadata і Vercel project/deployment metadata.

## 6. Vercel production branch

Vercel `productionBranch` фактично дорівнює `develop`.

Отже термін `production` у Vercel описує Vercel target, а не бізнес-production Kairos Parts. Бізнес-production із custom domain працює на VPS із `main`.

## 7. Vercel deployments by branch

| Branch | Commit | Vercel target | State | Created at (UTC) | Deployment URL |
|---|---|---|---|---|---|
| `develop` | `135807fe11431dffdc1d1d4bf0f11d9453237186` | `production` | `READY` | `2026-07-27T17:07:16.659Z` | `kairos-parts-ngmw3vxpa-sergiys-projects-c8c24309.vercel.app` |
| `main` | `055200959f2ed8e1be628d46e91265f23cc93e61` | `preview` | `READY` | `2026-07-27T18:39:07.975Z` | `kairos-parts-1rh68fokd-sergiys-projects-c8c24309.vercel.app` |

`develop` також має branch alias `kairos-parts-git-develop-sergiys-projects-c8c24309.vercel.app`. Перегляд попередніх deployment metadata підтвердив послідовну модель: `develop` → `production`, `main` → `preview`.

## 8. Vercel domains

Vercel metadata показує:

- `kairos-parts.vercel.app`;
- `kairos-parts-sergiys-projects-c8c24309.vercel.app`;
- `kairos-parts-git-develop-sergiys-projects-c8c24309.vercel.app`.

Project domains API повернув як verified project domain `kairos-parts.vercel.app`. Custom domains `kairos-parts.com.ua` і `www.kairos-parts.com.ua` у Vercel project не знайдені.

DNS обох custom domains повертає `187.127.85.46`, що збігається з перевіреним VPS host. Nginx на VPS приймає обидва і proxy_pass-ить на `127.0.0.1:3000`.

Локальна Windows HTTP smoke-команда завершилась TLS помилкою `SEC_E_NO_CREDENTIALS`; це обмеження локального клієнта, а не доказ недоступності сайту.

## 9. Vercel environment variable scopes

Перевірено тільки names, scopes і metadata; secret values не виводились.

| Variable/group | Scopes | Branch override |
|---|---|---|
| `DATABASE_URL` | production, preview, development | немає |
| `DATABASE_URL_UNPOOLED` | production, preview, development | немає |
| `DATABASE_NEON_PROJECT_ID` | production, preview, development | немає |
| `DIRECT_URL` | відсутня | — |
| `NEXTAUTH_URL` | production, preview | немає |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | preview, production | немає |
| Telegram bot/webhook variables | preview, production | немає |
| Cloudinary name/key/secret | preview, production | немає |
| `AUTH_URL` | відсутня | — |

Один `DATABASE_URL` record охоплює всі три Vercel scopes. Окремого branch-specific override для `develop` чи `main` немає.

## 10. Vercel database resources

Знайдено два available owned Neon resources:

| Resource | Provider | Project environments у connection metadata |
|---|---|---|
| `kairos-parts-db` | Neon | production, preview, development |
| `kairos-parts-staging` | Neon | production, preview, development |

Це конфігураційна колізія: обидва ресурси заявлені для всіх environment scopes одного Vercel project. Env metadata для DB variables має `configurationId=null`, тому за доступними read-only metadata неможливо доказово приписати фактичний injected endpoint одному з двох resource names.

Спроба отримати masked identity через окремий Vercel Production env pull була заблокована security gate як retrieval secrets. Її не обходили. Тому чесний verdict щодо точного resource name: **не доведено; кандидати — `kairos-parts-db` і `kairos-parts-staging`, binding треба виправити до migration**.

## 11. Vercel database identity

Фактичний DB endpoint, який використовується наявним локальним/Vercel-correlated binding:

| Поле | Masked/read-only значення |
|---|---|
| Provider | Neon PostgreSQL |
| Pooled host | `ep-wandering-thunder-aszf0fwz-pooler.c-4.eu-central-1.aws.neon.tech` |
| Direct host (`DATABASE_URL_UNPOOLED`) | `ep-wandering-thunder-aszf0fwz.c-4.eu-central-1.aws.neon.tech` |
| Database | `neondb` |
| Schema | `public` |
| Port | `5432` |
| DB user | `n***` |
| PostgreSQL | `17.10 (4f20678)` |

`DIRECT_URL` не використовується; його роль виконує `DATABASE_URL_UNPOOLED`. Passwords і повні connection strings не читались і не зафіксовані у звіті.

Через неоднозначність resource mapping цей endpoint упевнено ідентифікує БД, але не доводить, котрий із двох Vercel resource labels є її власником.

## 12. Vercel migration state

Read-only SQL audit `_prisma_migrations`:

- records: `36`;
- finished/applied: `36`;
- unfinished: `0`;
- rolled back: `0`;
- остання застосована: `20260723120000_add_auth_audit_events`;
- Stage 2 row: `0`;
- Stage 4B row: `0`.

`npx prisma migrate status` відносно `develop` знайшов 38 migration directories і дві pending migrations у правильному порядку:

1. `20260727120000_add_awaiting_invoice_and_invoice_sent_request_statuses`;
2. `20260727183000_add_request_selection_batch_foundation`.

Команда завершилась exit code `1`, тому що БД не up to date; це очікуваний read-only status result. `prisma migrate deploy` не запускався.

## 13. VPS deployment architecture

Фактична схема VPS:

1. GitHub Actions вручну формує release archive.
2. SSH upload і remote deploy працюють у `/var/www/kairos-parts`.
3. Версійовані артефакти лежать у `/var/www/kairos-parts/releases`.
4. `/var/www/kairos-parts/current` є symlink на активний release.
5. PM2 process `kairos-web` працює з `current`, Node.js `24.18`, один instance, port `3000`.
6. Nginx обслуговує `kairos-parts.com.ua` та `www.kairos-parts.com.ua` і proxy-ить на `127.0.0.1:3000`.
7. PostgreSQL працює окремим systemd cluster `17/main`.

`docker.service`, `nginx.service` і `postgresql@17-main.service` активні. Поточний SSH user не має permission на Docker socket, а `sudo` потребує пароль, тому container inventory не підтверджено. Application runtime і DB при цьому доказово працюють через PM2 та system PostgreSQL, а не через встановлений Docker inventory.

## 14. VPS branch and deployed commit

У release artifact немає `.git`, тому branch не можна визначати через `git branch`. Надійні джерела — `current` symlink, release name і deploy marker:

- active release: `/var/www/kairos-parts/releases/055200959f2ed8e1be628d46e91265f23cc93e61-20260727T184143Z`;
- deployed SHA: `055200959f2ed8e1be628d46e91265f23cc93e61`;
- deploy completed: `2026-07-27T18:42:42Z`;
- marker status: `success`;
- SHA збігається з поточними local/remote `main`.

Отже deployed source branch — `main`, доведена через SHA correspondence. Значення `RELEASE_ID` у PM2 process environment було старішим; його не можна використовувати як authoritative deployed version після reload із retained env. Authoritative є symlink/marker.

## 15. VPS PostgreSQL identity

| Поле | Masked/read-only значення |
|---|---|
| Host | `127.0.0.1` |
| Port | `5432` |
| Database | `kairos_parts` |
| Schema | `public` |
| PostgreSQL | `17.10 (Ubuntu 17.10-1.pgdg24.04+1)` |
| Cluster | `17/main` |
| Data directory | `/var/lib/postgresql/17/main` |

SQL connection підтвердила server address `127.0.0.1/32`. Credentials і env values не виводились.

## 16. VPS migration state

З активного `main`-релізу `prisma migrate status` повідомив:

- datasource: `kairos_parts`, `public`, `127.0.0.1:5432`;
- migration directories у release: `36`;
- schema up to date відносно цих 36.

Read-only `_prisma_migrations` audit:

- records/applied: `36/36`;
- unfinished: `0`;
- rolled back: `0`;
- остання: `20260723120000_add_auth_audit_events`;
- Stage 2 row: `0`;
- Stage 4B row: `0`.

Твердження «up to date» є відносним до `main` artifact. Порівняно з `develop` на VPS все ще відсутні Stage 2 і Stage 4B migrations разом із відповідним кодом.

## 17. Vercel DB vs VPS DB isolation proof

Verdict: **фізично різні PostgreSQL databases**.

| Ознака | Vercel/Neon | VPS |
|---|---|---|
| Provider/storage | managed Neon, remote AWS endpoint | local system PostgreSQL cluster |
| Host | `*.eu-central-1.aws.neon.tech` | `127.0.0.1` |
| Database | `neondb` | `kairos_parts` |
| Data location | Neon-managed | `/var/lib/postgresql/17/main` |
| Network boundary | external TLS/proxy endpoint | loopback |

Однакові 36 застосованих migrations означають спільний schema baseline, а не спільне physical storage.

## 18. Final environment topology

```text
develop
  -> Vercel Git integration (automatic)
  -> project kairos-parts / target production
  -> *.vercel.app test runtime
  -> Neon ep-wandering-thunder-aszf0fwz / neondb / public
  -> 36 applied of 38 develop migrations; Stage 2 and Stage 4B pending

main
  -> Vercel Git integration (automatic, incidental Preview)
  -> Vercel target preview

main
  -> GitHub Actions workflow_dispatch(confirm=DEPLOY)
  -> SSH release /var/www/kairos-parts/releases/<sha>-<timestamp>
  -> current symlink -> PM2 kairos-web -> Nginx
  -> kairos-parts.com.ua / www.kairos-parts.com.ua
  -> local PostgreSQL 17 / kairos_parts / public
  -> 36 applied of 36 migrations present in current main release
```

## 19. Actual deployment automation

| Подія | Фактичний результат |
|---|---|
| push to `develop` | automatic Vercel Production deployment |
| push to `main` | automatic Vercel Preview deployment; **не** VPS deploy |
| manual GitHub Actions + `confirm=DEPLOY` | VPS release; migration deploy до activation |
| VPS rollback workflow/script | code symlink rollback; без автоматичного DB rollback |

Vercel може build/deploy code автоматично, але migration automation для Neon у перевірених repo workflows не знайдена. GitHub Actions migration automation стосується VPS deployment.

## 20. Migration deployment policy

Безпечний порядок:

1. однозначно встановити environment і DB resource;
2. створити й перевірити restore point/backup саме цієї БД;
3. перевірити, що deployed code і migration set належать одному commit;
4. застосувати Stage 2 migration;
5. перевірити `_prisma_migrations` і schema;
6. застосувати Stage 4B migration у штатному migration deploy того самого release;
7. виконати application smoke і rollback-readiness check;
8. не намагатися зменшувати sequence або відкочувати forward migration кодовим rollback.

Stage 4B залежить від Stage 2 domain statuses, тому порядок за timestamp змінювати не можна.

## 21. Safe next action for Vercel DB

Рішення: **зараз migration deploy небезпечний**.

Наступна точна задача: окремий read/write-approved task «Vercel staging DB binding remediation», який:

1. визначить `kairos-parts-staging` єдиним дозволеним Neon resource для тестового `develop` runtime;
2. прибере overlap, за якого `kairos-parts-db` і `kairos-parts-staging` обидва охоплюють production/preview/development;
3. створить explicit environment/branch binding і незалежно звірить masked endpoint fingerprint;
4. створить Neon branch/restore point та перевірить спосіб restore;
5. лише після повторного dry read-only audit дозволить `prisma migrate deploy` для двох pending migrations.

Цей audit жодного з цих config/migration кроків не виконував.

## 22. Safe next action for VPS DB

Рішення: **зараз migration deploy небезпечний**.

Перед production migration потрібно:

1. інтегрувати `develop` у `main` із явним вирішенням розбіжності 10/10 і збереженням production workflow, ADMIN bootstrap та redirect-origin fix;
2. пройти повні code/tests/build checks на точному майбутньому `main` SHA;
3. створити перевірений `pg_dump` або physical snapshot локального cluster `/var/lib/postgresql/17/main` та провести restore rehearsal у ізольовану БД;
4. запустити ручний GitHub Actions deployment лише для точного `main` SHA;
5. дозволити штатному remote deploy застосувати migrations перед activation;
6. після deployment перевірити `_prisma_migrations`, status transitions, PM2 health і custom domain.

Не слід застосовувати Stage 2/4B без відповідного production code release.

## 23. Stage 5 readiness

| Scope | Verdict | Причина |
|---|---|---|
| Local/mock implementation | **READY** | Stage 2–4D code і schema присутні в `develop`; validate/lint/typecheck проходять |
| Vercel runtime | **BLOCKED** | дві pending migrations і неоднозначне Neon resource binding |
| VPS production | **BLOCKED** | `main` не містить Stage 2–4D, branches diverged, потрібні backup та release gate |

Stage 5 у межах цього завдання не розпочинався.

## 24. Risks and inconsistencies

1. Vercel `production` означає тестовий `develop` runtime, що створює семантичну плутанину з VPS production.
2. Два Neon resources одночасно охоплюють усі project environments.
3. DB variables не мають branch override і не містять resource `configurationId`.
4. Точний Vercel resource label для фактичного endpoint не доведено.
5. `main` автоматично створює Vercel Preview, хоча бізнес-production для `main` — VPS.
6. Production workflow доступний лише в `main`, але не має жорсткого ref guard на `main`.
7. `main` і `develop` розійшлися на 10 commits у кожен бік.
8. PM2 retained environment містить stale `RELEASE_ID`; symlink є надійнішим джерелом.
9. VPS SSH deploy user не має read access до Docker inventory.
10. `DIRECT_URL` відсутній; використовується провайдерський `DATABASE_URL_UNPOOLED`.
11. Custom domain навмисно не прив’язаний до Vercel і веде на VPS; це правильно, але має бути явно задокументовано.
12. VPS `migrate status: up to date` може ввести в оману: active `main` artifact просто ще не містить двох `develop` migrations.
13. Code rollback на VPS не є DB rollback; forward schema changes потребують backward-compatible release design.

## 25. Recommended remediation

Пріоритетний порядок окремих змін:

1. Vercel staging DB binding remediation без migrations.
2. Повторний read-only Vercel identity/migration audit і restore-point proof.
3. Controlled Stage 2/4B activation у Vercel test DB.
4. Окремий branch reconciliation task для `develop` → `main`, включно з production-only commits.
5. Додати workflow guard, який не дозволяє production VPS deploy не з `main`.
6. Створити й перевірити VPS PostgreSQL backup/restore runbook.
7. Виконати exact-SHA production release і post-deploy audit.
8. Лише після Vercel runtime proof планувати Stage 5 runtime integration.

## 26. Final decisions

- Роль `develop`: integration/test; automatic Vercel `production` target.
- Роль `main`: source of truth для manual VPS production release.
- Vercel Production Branch: `develop`.
- `develop` deployment target: Vercel production / `*.vercel.app`.
- `main` deployment targets: automatic Vercel preview та окремо manual VPS production.
- Vercel DB: Neon `neondb/public`, endpoint fingerprint `ep-wandering-thunder-aszf0fwz`; точний resource label не доведений через collision.
- VPS DB: local PostgreSQL `kairos_parts/public` на `127.0.0.1:5432`.
- Physical isolation: підтверджена.
- Vercel migrations: 36/38, Stage 2 і Stage 4B pending.
- VPS migrations: 36/36 відносно current `main`; Stage 2/4B не включені й не застосовані.
- Безпечний Vercel migration зараз: **NO**.
- Безпечний VPS migration зараз: **NO**.
- Stage 5 local/mock readiness: **YES**.
- Stage 5 Vercel/VPS runtime readiness: **NO**.
- Наступна точна задача: **Vercel staging DB binding remediation and restore-point proof, without migrations**.

### Audit verification

| Check | Result |
|---|---|
| `npx.cmd prisma validate` | PASS |
| `npm.cmd run lint` | PASS |
| `npm.cmd run typecheck` | PASS після локального `npx.cmd prisma generate`; generated files ignored, tracked diff відсутній |
| `git diff --check` | PASS |
| Application build | не запускався: application code не змінювався, а task визначає build optional |

Початковий `typecheck` після перемикання з `main` на `develop` побачив stale generated Prisma Client від 36-migration schema. `prisma generate` синхронізував лише ignored `node_modules/@prisma/client`; повторний `typecheck` пройшов. Це не змінювало DB або tracked source.
