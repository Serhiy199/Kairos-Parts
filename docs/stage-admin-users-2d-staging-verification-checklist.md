# Stage Admin Users 2D — Staging verification checklist

## 1) Read-only audit script

- [x] `npx.cmd tsx scripts/check-admin-users-2d.ts` виконується без блокуючих помилок.
- [x] `users.staff.total` у звіті дорівнює сумі `INVITED + ACTIVE + DISABLED`.
- [x] `validation.duplicateEmails === false` (або при наявності — відмінено blocker і зафіксовано причину).
- [x] `validation.multipleActiveInvitations === false` (або зафіксовано виняток).
- [x] `validation.auditLogSensitiveLeak === false` (за відсутності чутливих ключів у `metadata`).

## 2) Script health

- [x] Обробка `metadata` не падає на не-JSON значеннях.
- [x] Агрегація `auditEventCounts` включає:
  - `MANAGER_INVITATION_CREATED`
  - `MANAGER_INVITATION_REGENERATED`
  - `MANAGER_ACTIVATED`
  - `MANAGER_DISABLED` (через `metadata.event` + `ENTITY_UPDATED`)
  - `MANAGER_ENABLED` (через `metadata.event` + `ENTITY_UPDATED`)

## 3) Prisma + quality

- [x] `npx.cmd prisma validate` — PASS.
- [x] `npx.cmd prisma generate` — PASS.
- [x] `npx.cmd prisma migrate status` — без незастосованих migration.
- [x] `npm.cmd run typecheck` — PASS.
- [x] `npm.cmd run lint` — PASS.
- [x] `npm.cmd run build` — PASS.
- [x] `git diff --check` — PASS.

## 4) Stage 2A–2C continuity check

- [x] Stage 2D не змінює `User`, `ManagerInvitation`, `AuditLog` схеми.
- [x] Stage 2D не вводить нові API або route-ів.
- [ ] За потреби — пробний ручний smoke у staging проводиться поза Scope Stage 2D (після стабілізації з UI-етапів).
