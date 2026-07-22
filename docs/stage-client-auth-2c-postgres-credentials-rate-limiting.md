# Stage Client Auth 2C — PostgreSQL/Neon credentials rate limiting

## 1. Мета

Додати persistent, race-safe і PII-safe захист credentials login для CLIENT, ADMIN та MANAGER.

## 2. Scope

Stage охоплює лише credentials rate limiting, migration, env contract, regression, Neon audit і staging documentation. Password, JWT, session, roles та registration не змінювалися.

## 3. Попередній auth status

Stage 2B/2B.1 забезпечив CLIENT email/phone login, canonical phone identity, staff email-only policy, dummy password verification і generic CLIENT errors.

## 4. Security blocker

До 2C невдалі credentials attempts не мали persistent ліміту та могли обходити process-memory state між Vercel invocations.

## 5. Threat model

Захист враховує brute force одного email/phone, один IP проти багатьох accounts, один account із різних IP, unknown/invalid identifiers, staff phone attempts, CLIENT/ADMIN/MANAGER attacks, concurrent requests, phone-format та email-case rotation, spoofed proxy headers, expired windows, Neon failure і table growth.

## 6. Чому PostgreSQL/Neon

Neon уже є shared durable storage застосунку, підтримує atomic upsert і працює однаково для Vercel serverless та майбутнього VPS.

## 7. Відхилені alternatives

Process memory не persistent і не shared. Upstash Redis, Vercel KV та нові зовнішні сервіси відхилені за scope. Captcha не входить до stage.

## 8. Rate-limit policy

Fixed window із database time. Pre-check лише читає active block; credentials failure атомарно збільшує два buckets.

## 9. Identifier threshold

5 невдалих attempts за 15 хвилин. П'ятий failure активує block; blocked message однаковий для known/unknown identifiers.

## 10. IP threshold

20 невдалих attempts за 15 хвилин незалежно від identifier.

## 11. Window duration

15 хвилин від `windowStart`. Після expiry наступний failure створює нове window з count `1`.

## 12. Identifier normalization

До HMAC формується `email:`, `phone:` або `unknown:` namespace. Raw material існує лише в пам'яті поточного request.

## 13. Phone canonicalization

Existing `normalizeUkrainianPhone` зводить local, `380`, `+380` і formatted input до одного `+380XXXXXXXXX` key material.

## 14. Email canonicalization

Email trim + lowercase відповідає auth lookup policy, тому case variants ділять bucket.

## 15. Unknown identifier handling

Invalid input проходить Unicode NFKC, lowercase, whitespace collapse і 512-char cap; empty input має stable marker. Raw value не записується.

## 16. IP extraction policy

На Vercel пріоритет: `x-vercel-forwarded-for`, потім platform `x-forwarded-for`, потім `x-real-ip`. IPv4/IPv6 canonicalized. Без trusted source використовується conservative `unknown` bucket.

## 17. Trusted headers

Vercel офіційно формує/перезаписує forwarding headers. На VPS вони читаються лише з `AUTH_RATE_LIMIT_TRUST_PROXY=true`, коли Nginx гарантовано overwrite-ить client headers. Інакше довільний XFF не довіряється.

## 18. HMAC design

HMAC-SHA-256, lowercase hex digest, 64 chars. Password hashing для limiter keys не використовується.

## 19. HMAC environment secret

`AUTH_RATE_LIMIT_HMAC_SECRET` має містити щонайменше 32 bytes. Missing/short secret fail closed; hardcoded production fallback відсутній.

## 20. Domain separation

Payload має `identifier:` або `ip:` prefix; identifier додатково має email/phone/unknown namespace.

## 21. PII protection

DB не містить raw email, phone, IP, User ID, password або reversible key material. Logs не містять raw значень чи hashes.

## 22. Prisma model

`AuthRateLimitBucket`: `scope`, `keyHash`, `windowStart`, `attemptCount`, `blockedUntil`, timestamps. User relation відсутній.

## 23. Migration name

`20260722140000_add_auth_rate_limit_buckets`.

## 24. Migration SQL

Створює enum `AuthRateLimitScope`, порожню table та constraints. Backfill або зміни `User` відсутні.

## 25. Unique indexes

Unique `(scope, keyHash)` гарантує один bucket на key і є conflict target atomic upsert.

## 26. Cleanup indexes

Indexes на `blockedUntil` і `updatedAt` підтримують block checks/audit та stale cleanup.

## 27. Atomic increment design

Один parameterized `INSERT ... ON CONFLICT ... DO UPDATE` оновлює IDENTIFIER та IP rows. Unsafe raw SQL відсутній.

## 28. Concurrency handling

PostgreSQL row locking у conflict update серіалізує increments. Обидва scopes завжди передаються в однаковому порядку. 12 concurrent failures дали exact count `12` для обох buckets.

## 29. Transaction isolation

Atomicity забезпечує один SQL statement: або обидва bucket writes завершуються, або statement rollback. Application read-modify-write не використовується.

## 30. Pre-check flow

Після validation `loginScope`/password Auth.js `authorize(credentials, request)` HMAC-ує keys і перевіряє active `blockedUntil` до user lookup/password verification.

## 31. Failure increment flow

Unknown/invalid identifier, wrong password, missing hash, wrong role/scope, inactive/disabled/invited user і staff phone attempt рахуються після dummy/real password decision. Configuration, DB, CSRF та internal failures не рахуються.

## 32. Successful login reset

Після password/status/role checks identifier bucket deterministic deleted до повернення authenticated user.

## 33. IP bucket success policy

Successful login не очищає IP bucket, щоб один valid account не скидав захист shared attacker IP.

## 34. Account enumeration protection

Known і unknown identifiers проходять однаковий limiter та dummy verification. Thresholds не залежать від role/account existence.

## 35. Generic errors

Blocked: `Забагато спроб входу. Спробуйте ще раз пізніше.` DB/config failure: `Не вдалося виконати вхід. Спробуйте ще раз пізніше.` Scope, count і expiry не показуються.

## 36. Database failure behavior

Pre-check, failure increment або success reset failure fail closed через controlled `CredentialsSignin`. Cleanup failure є best-effort, бо не обходить already-completed security check.

## 37. Auth.js integration

Limiter знаходиться всередині Credentials provider `authorize`, де доступні identifier, password і original `Request` headers.

## 38. Direct endpoint bypass protection

Browser form, Server Action `signIn` та direct `/api/auth/callback/credentials` проходять той самий provider. Form-only protection не використовується.

## 39. CLIENT coverage

CLIENT email та canonical/local/formatted phone protected однаковими thresholds.

## 40. ADMIN coverage

ADMIN email login protected. Phone залишається denied і failure рахується.

## 41. MANAGER coverage

MANAGER email login protected. Existing lifecycle/status behavior збережено.

## 42. Unknown account coverage

Unknown email, phone й invalid value створюють HMAC buckets без account lookup leak.

## 43. Cleanup strategy

Приблизно 1 із 64 auth attempts запускає awaited batch cleanup до 200 stale rows. Cleanup error structured-logged без keys.

## 44. Retention policy

Rows eligible після 48 годин, якщо window давно завершене й active block відсутній. Це понад три windows і достатньо для short operational inspection.

## 45. Future cron option

На VPS cron може періодично виконувати той самий indexed batch cleanup, якщо auth traffic недостатній. Для MVP окремий cron не потрібний.

## 46. Environment setup

Згенерувати production secret поза repo, наприклад `openssl rand -base64 48`, і встановити `AUTH_RATE_LIMIT_HMAC_SECRET` у Vercel Production/Preview. Реальний secret у repo не додавався.

## 47. Automated tests

`scripts/check-client-auth-2c.ts` перевіряє normalization, HMAC, namespaces, trusted IP, identifier/IP/dual limits, reset, expiry та source contracts.

## 48. Concurrency test

PASS на Neon: parallel increments не загублені, threshold не обійдений, test rows очищені у `finally`.

## 49. Neon aggregate audit

Після фінального cleanup: total `1` (один неактивний IP bucket, не позначений як test data), identifier `0`, active blocked `0`, invalid scope/hash/count/window `0`, duplicates `0`, stale `0`, test rows `0`, `hasBlocker=false`. Неавторизоване видалення не-тестового bucket не виконувалося.

## 50. Client Auth 2B regression

PASS: `scripts/check-client-auth-2b.ts`.

## 51. Client Auth 2B.1 regression

PASS: `scripts/check-client-auth-2b-1.ts` і `scripts/check-client-phone-validation.ts`.

## 52. Admin Users 2A–2D regression

PASS: Admin Users 2A–2D checks; 2D audit повернув `hasBlocker=false`.

## 53. Prisma validate

PASS після migration application.

## 54. Prisma generate

PASS; generated Client містить нову model/enum.

## 55. Migration status

PASS: migration застосована до Neon; `prisma migrate status` підтверджує актуальну schema.

## 56. Typecheck

PASS після фінального Auth.js runtime fix.

## 57. Lint

PASS.

## 58. Build

PASS: production build, 46/46 static pages generated.

## 59. git diff --check

PASS перед commit.

## 60. Local browser smoke

PASS у локальному production build із ephemeral test-only HMAC secret і вигаданим unknown email: спроби 1–4 повернули generic credentials error, п'ята — generic rate-limit message; browser console порожня. Також підтверджено fail-closed generic unavailable message при недоступній БД. Valid CLIENT/ADMIN/MANAGER credentials не використовувалися; test/browser buckets очищені після перевірки.

## 61. Staging browser smoke

NOT RUN: немає redeploy і Vercel env. PASS не заявляється.

## 62. Remaining risks

Vercel secret ще не налаштований; valid CLIENT/ADMIN/MANAGER staging credentials не надані; multi-region Neon latency потребує operational observation.

## 63. Rollback considerations

Code rollback безпечний: table лишається невикористаною. Drop table/enum потребує окремої reviewed forward migration; applied migration не редагувати. Emergency auth rollback не повинен повертати fail-open.

## 64. Operational monitoring

Використовувати aggregate counts active blocks, rows/day, cleanup volume, DB error category і query latency. Не виводити keys. Для конкретного unblock server-side tool має локально HMAC-увати operator-provided identifier та parameterized-delete bucket без output raw/hash. Emergency full reset — reviewed `TRUNCATE "AuthRateLimitBucket"`; HMAC rotation логічно скидає всі existing buckets і залишає old rows для cleanup.

## 65. Release status

`IMPLEMENTED — VERCEL ENV AND STAGING REQUIRED` після повного local verification.

## 66. Final verdict

Architecture persistent, atomic, PII-safe і fail-closed. Client Auth 2 не є повністю завершеним до Vercel env, redeploy і staging checklist.
