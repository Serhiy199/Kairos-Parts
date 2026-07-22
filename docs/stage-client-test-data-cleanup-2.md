# Stage Client Test Data Cleanup 2

## 1. Мета

Повністю видалити один підтверджений test CLIENT та залежні дані, що належали лише йому, щоб повторно перевірити registration, phone mask, canonical phone storage, automatic login і перехід у client cabinet. Production business logic, Prisma schema, migrations та інші accounts у межах cleanup не змінювалися.

## 2. Exact target policy

Target вибирався deterministic read-only запитом одночасно за:

- `User.role = CLIENT`;
- точним погодженим canonical `User.normalizedPhone`.

Email, ім’я та IDs не використовувалися як delete selector і не виводилися. Перед mutation target був повторно заблокований через `SELECT ... FOR UPDATE`; delete дозволявся лише за умови exact count `1`. Raw phone variants використовувалися тільки для availability verification.

## 3. Target count до cleanup

`targetUserCount = 1`.

Знайдено рівно одного погодженого test CLIENT. У звіті не збережено phone, email, name, IDs, hashes, secrets, password або session/token data.

## 4. Dependency counts

| Категорія | Count до cleanup |
| --- | ---: |
| User | 1 |
| ClientProfile | 1 |
| Account / Session | 0 / 0 |
| CompanyMember / shared Company | 0 / 0 |
| Request | 2 |
| RequestItem | 0 |
| RequestStatusHistory | 2 |
| RequestComment | 2 |
| RequestFile / RequestDocument | 0 / 0 |
| CommercialOffer / CommercialOfferItem | 0 / 0 |
| Invoice / InvoiceItem | 0 / 0 |
| Vehicle | 1 |
| VehicleImage | 3 |
| Document | 0 |
| ChangeRequest | 0 |
| AuditLog target actor events | 2 |
| Notification | 0 |
| TelegramDraftRequest | 0 |
| ContactMessage | 0 |
| UsedEquipmentInquiry | 0 |
| VerificationToken | 0 |
| ClientBillingDetails | 0 |
| ManagerInvitation / staff-owned records | 0 |

## 5. Shared dependency checks

Shared-data blockers дорівнювали нулю:

- shared companies або company memberships — 0;
- requests/vehicles/documents у shared companies — 0;
- foreign requests/request items, що використовували target vehicle — 0;
- uploads/offers/invoices на foreign requests/entities — 0;
- audit events на entities поза target user/request/vehicle scope — 0;
- reviewed change requests, manager invitations, used-equipment actor rows та assigned inquiries — 0.

Company, shared vehicle, shared document, staff record або інший User не видалялися.

## 6. Видалені категорії records

Видалено лише підтверджені target-exclusive records:

- 1 User та його 1 ClientProfile;
- 2 Requests;
- 2 RequestStatusHistory і 2 RequestComment через request dependency cleanup;
- 1 Vehicle;
- 3 VehicleImage database rows;
- 2 AuditLog actor events, обидві в target-owned entity scope.

Категорії з count `0` не змінювалися. Broad delete за role/status не виконувався.

## 7. External assets

До DB transaction виявлено 3 Cloudinary image assets, які належали виключно target vehicle. Shared/foreign vehicle references були відсутні.

Assets видалено через той самий Cloudinary SDK/configuration та `uploader.destroy(publicId, { resource_type: 'image' })` contract, який використовує чинний vehicle storage service. Public IDs та URLs не логувалися і не зберігалися у report. Cloudinary post-check: `remainingCloudinaryAssetCount = 0`.

Documents, request attachments і Telegram uploads були відсутні; додатковий external cleanup для них не потрібний.

## 8. Rate-limit bucket handling

Identifier bucket lookup виконувався тим самим HMAC canonicalization contract і server secret без виведення hash. Account-specific `IDENTIFIER` bucket count дорівнював `0`, тому видаляти bucket не було потрібно. Загальні `IP` buckets не переглядалися за значеннями та не очищалися.

Credentials limiter захищає login, а не registration. Після cleanup він не блокує повторне створення account.

## 9. Transaction behavior

DB cleanup виконано однією PostgreSQL transaction:

1. повторний exact target lookup із row lock;
2. повторна вимога count `1`;
3. FK-safe cleanup target-exclusive records;
4. delete рівно одного User;
5. `COMMIT` лише після успіху всіх statements;
6. `ROLLBACK` був налаштований для будь-якої помилки;
7. DB connection закрито у `finally`.

Використовувалися parameterized SQL queries. `$executeRawUnsafe`, unparameterized SQL та broad deletes не використовувалися. External Cloudinary delete не може бути атомарним із PostgreSQL, тому був виконаний і перевірений до DB transaction.

## 10. Target count після cleanup

- exact target user count: `0`;
- target canonical normalized-phone count: `0`;
- target raw phone variant count: `0`;
- повторний guarded dry-run: `targetUserCount = 0`, `fallbackRawVariantCount = 0`.

## 11. Orphan checks

| Перевірка | Count після cleanup |
| --- | ---: |
| orphan ClientProfile | 0 |
| orphan CompanyMember | 0 |
| orphan RequestItem | 0 |
| orphan RequestStatusHistory | 0 |
| orphan CommercialOfferItem | 0 |
| orphan InvoiceItem | 0 |
| orphan VehicleImage | 0 |

Target-specific requests, vehicles, documents, change requests, Telegram linkage та invitations після transaction відсутні. PostgreSQL FK constraints не повідомили про violations.

## 12. Phone availability після cleanup

Погоджений canonical phone та перевірені raw/local variants більше не зайняті у `User.normalizedPhone` або `User.phone`. Duplicate-phone data blocker для повторної registration відсутній.

Саму registration у межах cleanup stage не запускали і новий account не створювали.

## 13. Email availability після cleanup

Email видаленого test account перевірено внутрішньо без виведення значення: matching `User.email` count після transaction дорівнює `0`. Email data blocker для повторної registration відсутній.

## 14. Prisma checks

- `npx.cmd prisma validate` — PASS.
- `npx.cmd prisma generate` — PASS.
- `npx.cmd prisma migrate status` — підключення успішне, але status non-zero через сторонню незастосовану migration `20260722160000_extend_audit_log_foundation`.

Cleanup не створював і не застосовував migrations. Pending migration з’явилася у сторонніх незакомічених Audit Log Stage 2 changes під час виконання цього етапу.

## 15. Typecheck

`npm.cmd run typecheck` — FAIL через сторонній незавершений Audit Log Stage 2 refactor: `lib/audit-log/service.ts` більше не export-ить `createAuditLog`, тоді як низка наявних callers ще імпортує його; також `ChangeRequest` callers передають старий `actorId` contract.

Cleanup не змінював ці runtime files і не виправляв сторонній stage.

## 16. Lint

`npm.cmd run lint` — PASS.

## 17. Build

`npm.cmd run build` — FAIL після успішної compilation фази на тих самих сторонніх Audit Log Stage 2 import/type errors (`createAuditLog` проти `writeAuditLog`). Cleanup data transaction не є причиною build failure.

## 18. Git diff check

`git diff --check` — PASS; виведені лише LF/CRLF warnings для сторонніх незакомічених files.

На старті cleanup working tree був чистий, branch `main`, HEAD `ff53f51`, синхронізований з `origin/main`. Під час роботи з’явилися сторонні незакомічені Audit Log Stage 2 files. Вони збережені без редагування cleanup stage і не включаються у cleanup commit.

Тимчасові PII-containing cleanup helpers після успішного delete та post-check видалені й не потрапляють у Git.

## 19. Чи можна повторювати registration test

З боку Neon data та Cloudinary — так:

- target phone вільний;
- target email вільний;
- target CLIENT відсутній;
- exclusive dependencies та external assets очищені;
- rate-limit identifier bucket відсутній;
- orphan checks дорівнюють нулю.

Для локального тесту слід використовувати стабільний runtime tree. Поточні сторонні незавершені Audit Log Stage 2 changes ламають typecheck/build і є окремим code-state blocker, не data-cleanup blocker.

## 20. Final verdict

**DATA CLEANUP PASS.** Один підтверджений test CLIENT і лише його exclusive records/assets повністю видалені. Phone та email знову доступні для registration. Shared records та інші users не зачеплені.

**REPOSITORY VERIFICATION PARTIAL.** Prisma validate/generate, lint і diff check пройшли; migrate status, typecheck та build не мають PASS через сторонній незавершений Audit Log Stage 2 worktree. Cleanup stage не розширював scope для виправлення цих змін і не виконував push.
