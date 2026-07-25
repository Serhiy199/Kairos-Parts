# Production ADMIN Bootstrap

Дата аудиту: 2026-07-25.

## 1. Початковий стан

Роботу розпочато з чистого `main` на commit `aa4d636`, синхронізованого з `origin/main`. Створено окрему локальну гілку `infra/production-admin-bootstrap`. У `prisma/migrations` наявні 36 migration directories. Production bootstrap і production database у межах цієї роботи не запускалися.

## 2. Чому dev seed неприйнятний

`prisma/seed.ts` захищений `ALLOW_DEV_SEED=true`, призначений для local development database і створює не лише ADMIN, а й тестових CLIENT/MANAGER, профілі, заявки та інші fixtures зі спільними тестовими credentials. Тому `prisma db seed` не є допустимим механізмом першого production ADMIN.

## 3. Моделі User і ManagerProfile

Фактичний contract:

- `User.id` має `cuid()` default; `createdAt`/`updatedAt` мають defaults.
- Для bootstrap явно задаються `name`, нормалізований `email`, `passwordHash`, `role=ADMIN`, `status=ACTIVE`, `authVersion=1`.
- `User.email` optional на рівні загальної моделі, але має unique constraint і є обов’язковим для цього CLI.
- `User.phone` та `normalizedPhone` optional. Для staff вони не потрібні.
- `ManagerProfile` вимагає `userId` і `displayName`; `userId` unique. Nested create автоматично задає relation.
- Доступні ролі: `GUEST`, `CLIENT`, `MANAGER`, `ADMIN`.
- Доступні статуси: `INVITED`, `ACTIVE`, `DISABLED`.
- Staff login у `lib/auth/config.ts` шукає `ADMIN`/`MANAGER` лише за нормалізованим email. Phone login належить CLIENT scope.

`BOOTSTRAP_ADMIN_PHONE` не підтримується, бо воно не потрібне моделі чи staff login і створило б зайву ідентифікаційну поверхню.

## 4. CLI contract

Source entry:

```text
scripts/bootstrap-production-admin.ts
```

Required environment:

```text
NODE_ENV=production
DATABASE_URL
APP_BASE_URL=https://kairos-parts.com.ua
# або NEXTAUTH_URL=https://kairos-parts.com.ua
BOOTSTRAP_ADMIN_EMAIL
BOOTSTRAP_ADMIN_NAME
BOOTSTRAP_ADMIN_PASSWORD
CONFIRM_PRODUCTION_ADMIN_BOOTSTRAP=CREATE_FIRST_ADMIN
BOOTSTRAP_DRY_RUN=true|false
```

Password не передається positional argument і не має потрапляти до shell history або process list.

## 5. Production safeguards

Скрипт відмовляється працювати, якщо:

- `NODE_ENV` не дорівнює `production`;
- confirmation не має точного значення `CREATE_FIRST_ADMIN`;
- немає або не можна parse як PostgreSQL URL значення `DATABASE_URL`;
- жоден із `APP_BASE_URL`/`NEXTAUTH_URL` не дорівнює точному production origin;
- відсутні email, name або password;
- email/name/password не проходять поточні staff rules;
- `BOOTSTRAP_DRY_RUN` не заданий явно як `true` або `false`.

Confirmation є окремим обов’язковим safeguard для production PostgreSQL на `127.0.0.1`; значення connection string не виводиться.

## 6. Existing ADMIN та email safeguards

У `Serializable` transaction виконується:

1. Пошук усіх `User.role=ADMIN` разом із status і наявністю `ManagerProfile`.
2. Case-insensitive пошук будь-якого account із нормалізованим email разом із role/status/profile.
3. Відмова, якщо є активний ADMIN.
4. Окрема відмова для non-active або partial ADMIN; автоматичного repair немає.
5. Відмова за будь-якої email collision, включно з CLIENT або MANAGER; автоматичного promotion немає.

Concurrent bootstrap захищений `Serializable` isolation та unique email constraint. Помилка concurrency не розкриває connection details.

## 7. Password hashing

Використовується існуючий `lib/auth/password.ts -> hashPassword()`: Node.js `scrypt`, 16 random bytes salt, derived key 64 bytes, storage format `scrypt:<salt>:<hex>`.

Поточна production password policy не має окремого ADMIN rule. Bootstrap повторно використовує фактичний staff rule із `manager-invitation-rules.ts`: довжина 8–128 символів. Скрипт не вигадує сильнішу несумісну політику; оператор повинен обрати унікальний сильний пароль.

## 8. Transaction strategy

Read checks і nested create виконуються однією Prisma `$transaction` з `Serializable` isolation. Success path створює рівно:

- один `User` із `ADMIN/ACTIVE/authVersion=1`;
- один пов’язаний `ManagerProfile`.

Не створюються `ClientProfile`, `Company`, `CompanyMember`, `Request`, `Vehicle`, fixtures, notifications, sessions, accounts або tokens.

## 9. AuditLog decision

Audit architecture підтримує system actor (`auditSystemActor`) і nullable `actorId`, але актуальний Prisma enum `AuditAction` не має `ADMIN_BOOTSTRAPPED`. Використання `ENTITY_UPDATED` або іншого action дало б неправдиву семантику. Тому bootstrap не створює AuditLog і не розширює audit architecture/migrations. Подальші ADMIN actions логуються стандартними workflow.

## 10. Dry-run

`BOOTSTRAP_DRY_RUN=true` виконує повну env validation і відкриває Prisma transaction, чим перевіряє DB connectivity, ADMIN state та email collision. Він перевіряє password policy, показує лише normalized email, майбутні role/status/profile і не викликає `hashPassword` чи write method.

Локальний check script використовує in-memory mock, не підключається до production DB і доводить нуль writes у dry-run.

## 11. Runtime strategy на VPS

Вибрано варіант A: контрольований одноразовий admin artifact без збільшення production dependencies.

Причини:

- production release виконує `npm ci --omit=dev`;
- `tsx` залишається devDependency;
- deploy workflow навмисно включає лише `deploy-production.sh` і `rollback-production.sh`, а не довільні source scripts;
- змінювати deploy workflow цим завданням заборонено.

`npm run admin:bootstrap` є source/developer entry і використовується там, де встановлені dev dependencies. Для VPS source script збирається з перевіреного commit в один ESM bundle; `@prisma/client` залишається external і береться з production release. Bundle тимчасово розміщується всередині поточного release, щоб standard Node module resolution знайшов `node_modules`, а після перевірки видаляється.

Команда збірки artifact:

```bash
./node_modules/.bin/esbuild scripts/bootstrap-production-admin.ts \
  --bundle \
  --platform=node \
  --format=esm \
  --packages=external \
  --outfile=bootstrap-production-admin.mjs

sha256sum bootstrap-production-admin.mjs \
  > bootstrap-production-admin.mjs.sha256
```

Artifact не містить credentials. Його SHA-256 потрібно перевірити після transfer. Включення bootstrap до звичайного deploy залишається навмисно відсутнім.

## 12. Production runbook

Передумови:

- merge і review commit із цим bootstrap;
- backup/restore readiness підтверджені окремо;
- current release відповідає Prisma schema з 36 застосованими migrations;
- контрольований bundle зібрано з exact reviewed commit, checksum перевірено;
- оператор окремо підтвердив, що має бути створений саме перший ADMIN.

На VPS bundle і checksum потрібно доставити через контрольований operator channel у staging directory поза web root. Після звірки checksum тимчасово встановити artifact так:

```bash
cd /var/www/kairos-parts/current
install -d -m 700 .admin-tools

cd /secure/operator-upload
sha256sum --check bootstrap-production-admin.mjs.sha256
install -m 700 bootstrap-production-admin.mjs \
  /var/www/kairos-parts/current/.admin-tools/bootstrap-production-admin.mjs
```

`/secure/operator-upload` у прикладі — root/deployment-operator-only staging path, не repository path. Директорія/файл мають бути доступні лише deployment operator. Далі запускати в subshell, щоб тимчасові environment variables не залишилися в основній shell session:

```bash
cd /var/www/kairos-parts/current

(
  set -a
  source /var/www/kairos-parts/shared/.env.production
  set +a

  read -r -p "Admin email: " BOOTSTRAP_ADMIN_EMAIL
  read -r -p "Admin name: " BOOTSTRAP_ADMIN_NAME
  read -r -s -p "Admin password: " BOOTSTRAP_ADMIN_PASSWORD
  printf '\n'

  export BOOTSTRAP_ADMIN_EMAIL
  export BOOTSTRAP_ADMIN_NAME
  export BOOTSTRAP_ADMIN_PASSWORD
  export CONFIRM_PRODUCTION_ADMIN_BOOTSTRAP=CREATE_FIRST_ADMIN
  export BOOTSTRAP_DRY_RUN=true

  node .admin-tools/bootstrap-production-admin.mjs

  unset BOOTSTRAP_ADMIN_EMAIL
  unset BOOTSTRAP_ADMIN_NAME
  unset BOOTSTRAP_ADMIN_PASSWORD
  unset CONFIRM_PRODUCTION_ADMIN_BOOTSTRAP
  unset BOOTSTRAP_DRY_RUN
  unset DATABASE_URL
  unset DATABASE_URL_UNPOOLED
  unset AUTH_SECRET
  unset NEXTAUTH_SECRET
)
```

Після успішного dry-run оператор має повторити той самий isolated input flow і лише після review змінити:

```bash
export BOOTSTRAP_DRY_RUN=false
node .admin-tools/bootstrap-production-admin.mjs
```

Після success verification тимчасовий bundle видалити контрольованою командою з точним absolute path:

```bash
rm -f -- /var/www/kairos-parts/current/.admin-tools/bootstrap-production-admin.mjs
rmdir -- /var/www/kairos-parts/current/.admin-tools
```

Staging copy/checksum також видаляються за окремою operator procedure. Цей runbook не є дозволом виконувати production mutation.

## 13. Verification queries без PII

Після authorized execution застосувати read-only Prisma/check tooling або parametrized SQL, що повертає лише counts/booleans:

```sql
SELECT COUNT(*) AS active_admin_count
FROM "User"
WHERE "role" = 'ADMIN' AND "status" = 'ACTIVE';

SELECT COUNT(*) AS active_admin_with_profile_count
FROM "User" u
JOIN "ManagerProfile" mp ON mp."userId" = u.id
WHERE u."role" = 'ADMIN'
  AND u."status" = 'ACTIVE'
  AND u."authVersion" = 1
  AND u."email" = lower(u."email")
  AND u."passwordHash" LIKE 'scrypt:%';

SELECT COUNT(*) AS bootstrap_admin_client_profile_count
FROM "ClientProfile" cp
JOIN "User" u ON u.id = cp."userId"
WHERE u."role" = 'ADMIN';
```

Очікування: `active_admin_count=1`, `active_admin_with_profile_count=1`, `bootstrap_admin_client_profile_count=0`. Не виводити email, name, passwordHash або connection string.

## 14. Verification results

Фінальні результати зафіксовано після реалізації:

- `npm ci`: PASS; 533 packages installed, Prisma Client generated. npm reported 7 existing dependency vulnerabilities (5 high, 2 critical); `npm audit fix` was not run because dependency upgrades/audit fixes are out of scope;
- `npm run admin:bootstrap:check`: PASS;
- direct CLI guard without production env: PASS, refusal before DB access;
- bundled ESM runtime guard: PASS, refusal before DB access;
- `npm run lint`: PASS;
- `npm run typecheck`: PASS;
- `npm run build`: PASS, 46 static pages generated;
- `git diff --check`: PASS;
- `git diff --cached --check`: PASS.

Security greps виконані. Existing dev-only references до `Test123456!` і `admin@test.com` залишилися у README/dev-seed/smoke files поза scope; новий bootstrap їх не використовує. `BOOTSTRAP_ADMIN_PASSWORD=` і private-key material у tracked tree не знайдені. Нові files не містять hardcoded production credentials.

Жодна перевірка не використовувала production credentials або production DB.

## 15. Змінені файли

```text
scripts/bootstrap-production-admin.ts
scripts/check-production-admin-bootstrap.ts
package.json
docs/reports/production-admin-bootstrap.md
```

`package-lock.json` не змінюється: dependency graph не змінено.

## 16. Готовність до production dry-run

Source logic і окремий admin artifact strategy готові до review. До production dry-run потрібні merge reviewed commit, контрольована збірка/transfer/checksum artifact та окреме authorization. Звичайний deployment bootstrap автоматично не запускає.

## 17. Blocker для створення першого ADMIN

Перший production ADMIN не створений, бо це завдання прямо забороняє production bootstrap. Операційні blockers: code review/merge, verified admin artifact, актуальна backup/restore readiness, повторна read-only перевірка migrations і нульового ADMIN count, безпечне введення identity/password та явний дозвіл на production mutation.
