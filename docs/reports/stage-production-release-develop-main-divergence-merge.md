# Stage Production Release — Develop-to-Main Divergence Audit and Merge

Дата: 2026-07-31

Режим: local Git integration, без push, deploy або production mutations.

## 1. Executive summary

Після `git fetch --all --prune` підтверджено реальну divergence: `main` мала 17 власних commits, `develop` — один commit SEO 1B. Обидва local refs збігалися з remote refs; `origin/develop` уже містив `0e2d913`. Merge base — `2e77d97`.

Main-only history містила production-required PM2/deployment/admin-bootstrap/auth changes, release merge topology та документацію. Жоден commit не відкидався й history не переписувалася. Обидві гілки мали ідентичні 47 migration files; SEO merge не додає migrations.

Створено backup refs і `integration/develop-to-main-20260731` від актуального `main`. `git merge --no-commit --no-ff develop` завершився без conflicts. Integrated tree пройшло Prisma validate/generate, 29 package regressions, додаткові audit/logistics checks, lint, typecheck, build, SEO та локальну HTTP/auth validation. Після створення report цей validated tree фіксується одним merge commit `merge: integrate develop into main`, після чого local `main` має бути fast-forward до нього. Push не дозволений і не виконується.

## 2. Initial Git baseline

| Check | Result |
|---|---|
| Initial current branch | `main` |
| Working tree | clean |
| Initial `main` | `3b388d8446c4e4c96b4d27cfff30131d4b0fd9ca` |
| Initial `develop` | `0e2d91333b83a2c82417a47c50e41deb7f6ec066` |
| Stash | preserved `stash@{0}: On infra/docker-production-baseline: WIP Docker baseline before PM2 switch` |
| Untracked/unstaged files | none |

## 3. Remote and local refs

| Ref | Hash | State |
|---|---|---|
| `main` | `3b388d8446c4e4c96b4d27cfff30131d4b0fd9ca` | equal to `origin/main` before integration |
| `origin/main` | `3b388d8446c4e4c96b4d27cfff30131d4b0fd9ca` | fetched |
| `develop` | `0e2d91333b83a2c82417a47c50e41deb7f6ec066` | equal to `origin/develop` |
| `origin/develop` | `0e2d91333b83a2c82417a47c50e41deb7f6ec066` | SEO 1B already pushed before this stage |

Remote: `git@github.com:Serhiy199/Kairos-Parts.git`. Backup та integration refs залишаються local-only.

## 4. Divergence count

`git rev-list --left-right --count main...develop` повернув:

```text
17  1
```

Тобто 17 commits reachable лише з `main` і один commit reachable лише з `develop`.

## 5. Merge base

```text
2e77d97e81616150652fcc82065ced76fcbc4829 fix: allow free-text request item manufacturer
```

## 6. Commits only in main

| Commit | Branch-only | Classification | Files/scope | Decision |
|---|---|---|---|---|
| `231a781` | main | `PRODUCTION_REQUIRED` | `.nvmrc`, `ecosystem.config.cjs`, PM2 report | Preserve |
| `20a88dc` | main | `DOCUMENTATION_ONLY` | PM2 report finalization | Preserve |
| `3f2bff2` | main | `DEPLOYMENT_ONLY` | manual production workflow, deploy/rollback scripts, package metadata | Preserve |
| `aa4d636` | main | `PRODUCTION_REQUIRED` | merge topology for deployment workflow | Preserve parent/history |
| `1a7e671` | main | `PRODUCTION_REQUIRED` | guarded production admin bootstrap and check | Preserve |
| `ba66d53` | main | `PRODUCTION_REQUIRED` | merge topology for admin bootstrap | Preserve parent/history |
| `f860183` | main | `DOCUMENTATION_ONLY` | request status automation audit | Preserve |
| `8cf1909` | main | `HOTFIX_REQUIRED` | reverse-proxy public redirect helper, middleware, regression | Preserve |
| `bbe0e92` | main | `DEPLOYMENT_ONLY` | production app URL passed to workflow build | Preserve |
| `0552009` | main | `HOTFIX_REQUIRED` | merge topology for auth redirect branch | Preserve parent/history |
| `1ef90ad` | main | `ALREADY_EQUIVALENT_IN_DEVELOP` | prior release integration of develop payload into production line | Preserve merge topology |
| `b244acd` | main | `HOTFIX_REQUIRED` | release audit plus Windows-portable regression adjustments | Preserve |
| `6428532` | main | `DOCUMENTATION_ONLY` | staging migration rehearsal report | Preserve |
| `42e90c9` | main | `PRODUCTION_REQUIRED` | prior release merge topology | Preserve parent/history |
| `11268cb` | main | `DOCUMENTATION_ONLY` | final develop-to-main merge report | Preserve |
| `fa3c359` | main | `ALREADY_EQUIVALENT_IN_DEVELOP` | manufacturer free-text merge topology | Preserve parent/history |
| `3b388d8` | main | `DOCUMENTATION_ONLY` | manufacturer fix report | Preserve |

## 7. Commits only in develop

Єдиний develop-only commit:

| Commit | Scope | Migration/schema | Breaking/risk analysis | Decision |
|---|---|---|---|---|
| `0e2d913 fix: replace categories landing with logistics in sitemap` | видалення exact `/categories`, cleanup двох links, indexable `/logistics`, sitemap/test/report | none | intentional `/categories` 404; `/logistics` becomes public indexable; `/logistics/request` remains noindex | Integrate |

Попередні SEO/Vercel/auth commits (`c108de1`, `f481cfd`, `cbec632`, `2e77d97`) вже були спільними ancestors або раніше integrated у `main`.

## 8. Main-only commit classification

Підсумок:

- `PRODUCTION_REQUIRED`: PM2 baseline, protected production bootstrap, prior release merge topology;
- `HOTFIX_REQUIRED`: reverse-proxy redirect behavior та regression portability;
- `DEPLOYMENT_ONLY`: manual production workflow, deploy/rollback scripts, workflow build origin;
- `DOCUMENTATION_ONLY`: release, staging, PM2, lifecycle та fix reports;
- `ALREADY_EQUIVALENT_IN_DEVELOP`: payloads, які вже присутні у develop history, але merge commits потрібні для збереження topology;
- `OBSOLETE`/`UNKNOWN`: none.

## 9. Migration inventory

| Migration | Present in main | Present in develop | Production status | Risk |
|---|---:|---:|---|---|
| Incoming migrations from `main...develop` | none | none | not applicable | no Git integration risk |
| Existing shared migration inventory | 47 | 47 | live production state not queried in this Git-only stage | verify before future deploy |

`git diff --name-status main...develop -- prisma/migrations` і direct `git diff main develop -- prisma/migrations` обидва порожні. Prisma schema також не має branch delta. Migrations не застосовувалися.

## 10. Backup refs

| Backup ref | Hash |
|---|---|
| `backup/main-before-develop-merge-20260731` | `3b388d8446c4e4c96b4d27cfff30131d4b0fd9ca` |
| `backup/develop-before-main-merge-20260731` | `0e2d91333b83a2c82417a47c50e41deb7f6ec066` |

Backup refs не push-илися.

## 11. Dry-run merge result

Integration branch створена від exact initial `main`:

```text
integration/develop-to-main-20260731
```

Команда `git merge --no-commit --no-ff develop` завершилась повідомленням `Automatic merge went well; stopped before committing as requested`. Merge tree містив рівно 8 SEO 1B files.

## 12. Conflict inventory

| File | Main intent | Develop intent | Resolution | Validation |
|---|---|---|---|---|
| none | n/a | n/a | automatic clean merge; blanket ours/theirs не використовувалися | staged tree review, regressions, build |

Conflict count: `0`.

## 13. Conflict resolutions

Manual resolutions не знадобилися. Production-only PM2/deployment/bootstrap/auth files не перетиналися з SEO 1B delta, тому вони залишилися byte-preserved від `main`. Develop SEO files застосувалися без конфлікту.

## 14. Final integrated state

Validated integration tree одночасно містить:

- усю reachable history initial `main`;
- commit `0e2d913` і SEO 1B report;
- production auth redirect helper/check;
- PM2 ecosystem і production workflow/scripts;
- guarded admin bootstrap;
- `vercel.json` з `main: false`, `develop: true`;
- unchanged Prisma schema та 47 migrations.

## 15. SEO state verification

- `app/(public)/categories/page.tsx` absent;
- local `/categories` → `404`, Next noindex;
- local `/logistics` → `200`, `index, follow`;
- canonical `/logistics` → `https://kairos-parts.com.ua/logistics`;
- `/logistics/request` → `200`, `noindex,nofollow`, no canonical;
- child category representatives → `200`, index/follow, self-canonical;
- `/sitemap.xml` → `200`, exactly 13 `<loc>` entries;
- sitemap includes `/logistics`, excludes exact `/categories` and `/logistics/request`;
- `/robots.txt` → `200`; request exclusion preserved;
- `npm run test:seo-crawl-foundation` → PASS.

## 16. Auth and production URL verification

`npm run auth:redirect-origin:check` → PASS. Local unauthenticated boundaries:

- `/client` → `307` to local `/login?next=%2Fclient`;
- `/admin` → `307` to local `/admin/login?next=%2Fadmin`.

Localhost occurrences are intentional non-production parsing/fallback or outbound-safety checks. `lib/site-url.ts` rejects `.vercel.app` for public runtime origin and forces apex production origin. No SEO canonical/runtime builder regressed to localhost, IP, `www` or Vercel.

## 17. Database and migration risks

`npx prisma validate` і `npx prisma generate` passed. No schema or migration delta enters `main`; database was not contacted or mutated for merge. Deployment must still verify live production migration state before running the existing deployment workflow because Git equivalence does not prove database application state.

## 18. Validation results

| Check | Result | Evidence |
|---|---|---|
| Remote refs | PASS | fetch/prune; local refs equal remotes before merge |
| Prisma validate | PASS | schema valid |
| Prisma generate | PASS | client v6.19.3 generated |
| Package regression suite | PASS | 29/29 scripts, including auth, SEO, requests, admin bootstrap, client, logistics, OCR |
| Audit Log 3/4/5 | PASS | direct standalone checks |
| Logistics address provider | PASS | direct standalone check |
| Lint | PASS | `eslint .` exit 0 |
| Typecheck | PASS | `tsc --noEmit` exit 0 |
| Build | PASS | Next 15.5.19, 56/56 static pages |
| Route inventory | PASS | local production server HTTP evidence |
| `git diff --check` | PASS | integrated staged tree |

Three non-package standalone checks retain baseline debt on both parents and are not caused by the merge:

- `check-admin-audit-log-2.ts` globally scans test doubles and rejects the committed `auditLog.create(...)` fixture; this is already documented in `stage-request-approval-6-simplified-crm-item-statuses.md`;
- `check-logistics-persistence-foundation.ts` expects old `[MOCK, GOOGLE]`, while both parents correctly contain `[MOCK, GOOGLE, MANUAL]`;
- `check-logistics-request-creation.ts` expects deleted `lib/features/logistics.ts`, removed by shared ancestor `af64850`.

These stale harnesses are not package scripts, do not reflect integrated runtime regressions, and were not modified during this Git-only stage.

## 19. Main branch final state

Після створення validated merge commit integration branch має бути fast-forwarded у local `main`. Required final assertions:

- current branch `main`;
- clean working tree;
- `0e2d913` is ancestor of `main`;
- `origin/main` remains unchanged;
- local `main` contains the merge commit and both parent histories.

## 20. Outgoing commits to origin/main

Очікуваний outgoing set після local fast-forward:

```text
<merge-commit> merge: integrate develop into main
0e2d913 fix: replace categories landing with logistics in sitemap
```

Exact merge hash фіксується completion summary після commit. Remote push не виконується.

## 21. Push readiness

Code integration technically ready for a separately approved non-force push після final ref audit. Команда не виконується в цьому stage:

```bash
git push origin main
```

## 22. Production deployment prerequisites

1. Окремо погодити й виконати non-force push local `main`.
2. Підтвердити remote `main` SHA після push.
3. Перевірити production DB identity та `prisma migrate status`; не припускати стан лише з Git.
4. Створити/перевірити актуальний production backup відповідно до deployment runbook.
5. Review outgoing migration list; для цього merge він порожній.
6. Запустити manual production workflow лише після окремого approval.
7. Перевірити build/deploy logs, PM2 process health і Nginx upstream без конфігураційних змін.
8. Виконати live SEO/auth smoke: `/categories`, `/logistics`, request route, 7 categories, sitemap, robots, client/admin redirects.
9. Лише після live success виконувати Search Console follow-up для production `/logistics`.

## 23. Rollback plan

До push: local `main` можна без втрати evidence повернути через backup ref лише за окремою explicit командою користувача; автоматичний reset не виконується. Після push/deploy rollback має використовувати repository `scripts/rollback-production.sh` та documented deployment workflow, а не force-push. Backup refs:

```text
backup/main-before-develop-merge-20260731
backup/develop-before-main-merge-20260731
```

## 24. Remaining blockers

- Push потребує окремого explicit approval.
- Production deploy потребує окремого approval та live DB/backup/preflight verification.
- Три stale standalone harnesses потребують окремого cleanup stage; вони не блокують validated code integration, але залишаються test-maintenance debt.

## 25. Final conclusion

Divergence досліджена повністю. Main-only production history збережена, develop SEO 1B інтегрована без conflicts, schema/migrations не змінилися, обов’язкові code/build/route gates пройшли. Local `main` готується до exact validated merge commit без rebase/reset/force/squash. Push, deploy, migrations, production DB, VPS, Nginx, DNS і Search Console changes не виконувалися.
