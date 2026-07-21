# Stage Admin Users 2D — Audit, security, regression checks

## 1. Scope

Stage 2D додає контрольну перевірку для вже реалізованого функціоналу Admin Users:

- читабельна агрегація користувачів (роль/статус);
- стан запрошень менеджерів;
- валідація `AuditLog` подій;
- виявлення потенційних витоків чутливих полів у `metadata`;
- огляд потенційних регресій без зміни бізнес-логіки Stage 2A–2C.

Мета етапу: отримати робочий звіт + гарантії безпеки перед подальшими етапами.

## 2. Код: що змінено для Stage 2D

### 2.1 `scripts/check-admin-users-2d.ts`

- Виправлено `users.staff.total`: тепер рахується через `staffMatrix` (sum of `INVITED|ACTIVE|DISABLED`), а не `invites.total`.
- Додано безпечний парсинг `metadata`:
  - helper `parseMetadata(value)` з `JSON.parse` у `try/catch`;
  - уникнення падіння на сирому `metadata` (не JSON).
- Корекція агрегації `AuditLog`:
  - lifecycle події `MANAGER_DISABLED` / `MANAGER_ENABLED` фактично приходять у `metadata.event` разом з `action = ENTITY_UPDATED`;
  - в запиті до `auditEventRows` додано `CASE`, щоб коректно рахувати такі події.
- Розширено пошук чутливих ключів у metadata:
  - `token`, `tokenhash`, `password`, `password_hash`, `secret`, `api_key`, `session_id`, `access_token`, `refresh_token` тощо.
- `sensitiveMetadataRows` формуються як список `id/action` для швидкої перевірки без розкриття payload.

## 3. Результати запуску скрипту

Команда:

```bash
npx.cmd tsx scripts/check-admin-users-2d.ts
```

Очікувані поля на прикладі поточного snapshot:

- `users.total = 8`
- `users.staff.total = 2`
- `users.staff.byStatus = { invited: 0, active: 2, disabled: 0 }`
- duplicate emails: `0`
- `multipleActivePerUser`: `0`
- `auditLog.sensitiveMetadataRows`: `0`
- `auditLog.counts`: (може бути `{}` залежно від історії, але без блокуючих знахідок)

Validation flags:

- `duplicateEmails=false`
- `multipleActiveInvitations=false`
- `auditLogSensitive=false`
- `hasBlocker = false`

## 4. Security checks

Скрипт виконує:

- перевірку дублювань email;
- перевірку кількох активних запрошень на одного користувача;
- виявлення чутливих полів у `AuditLog.metadata` (включно з вкладеними об’єктами/масивами);
- агрегацію lifecycle-подій для контролю `MANAGER_ENABLED` / `MANAGER_DISABLED`.

## 5. Команди та інфраструктурні перевірки

Перед фіналом для Stage 2D виконувались:

- `npx.cmd prisma validate`
- `npx.cmd prisma generate`
- `npx.cmd prisma migrate status`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`
- `git diff --check`

## 6. Prisma/schema

- Prisma schema не змінювався на цьому етапі.
- Міграції для Stage 2D не вводились.

## 7. Висновок

Stage 2D проходить як read-only audit/stability step.
На момент виконання:

- блокуючих знахідок не зафіксовано;
- `users.staff.total` рахується коректно;
- lifecycle події з `metadata` обробляються коректно;
- Stage 2D не змінює поведінку Stage 2A–2C.

## 8. Зв’язок із Stage 2A–2C

- 2A/2B/2C залишаються джерелами логіки авторизації, інвайтів, lifecycle і ролей;
- Stage 2D лише аудитить стан і сигналізує про regression/security regression риски.
