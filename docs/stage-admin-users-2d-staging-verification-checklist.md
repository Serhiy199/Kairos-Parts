# Stage Admin Users 2D.1 — Controlled staging verification checklist

Усі сценарії за замовчуванням мають статус `NOT RUN`. Не записувати в цей файл passwords, invitation tokens, URLs із token, реальні emails або персональні дані.

## Scenario 1 — ADMIN Team access

Role: ADMIN
Route: `/admin/team`
Setup: ACTIVE ADMIN staging session.
Steps: Увійти через `/admin/login`; відкрити route і sidebar item `Команда`.
Expected: Page відкривається; staff list і create form доступні.
Actual: Not run.
Status: [ ] PASS [ ] FAIL [ ] BLOCKED [x] NOT RUN
Notes:

## Scenario 2 — MANAGER Team denial

Role: MANAGER
Route: `/admin/team`
Setup: ACTIVE MANAGER staging session.
Steps: Відкрити direct URL і перевірити sidebar.
Expected: Доступ заборонений/redirect; `Команда` не показується.
Actual: Not run.
Status: [ ] PASS [ ] FAIL [ ] BLOCKED [x] NOT RUN
Notes:

## Scenario 3 — CLIENT Team denial

Role: CLIENT
Route: `/admin/team`
Setup: ACTIVE CLIENT staging session.
Steps: Відкрити direct URL.
Expected: CRM/Team access denied according to auth conventions.
Actual: Not run.
Status: [ ] PASS [ ] FAIL [ ] BLOCKED [x] NOT RUN
Notes:

## Scenario 4 — Create invited MANAGER

Role: ADMIN
Route: `/admin/team`
Setup: Unique staging-only name/email.
Steps: Submit create manager form once.
Expected: MANAGER/INVITED created without password; one active invitation; URL shown once.
Actual: Not run.
Status: [ ] PASS [ ] FAIL [ ] BLOCKED [x] NOT RUN
Notes:

## Scenario 5 — Invitation URL one-time display

Role: ADMIN
Route: `/admin/team`
Setup: Newly invited MANAGER from scenario 4.
Steps: Copy URL; close modal; refresh page.
Expected: URL is available only in immediate result and absent after close/refresh.
Actual: Not run.
Status: [ ] PASS [ ] FAIL [ ] BLOCKED [x] NOT RUN
Notes:

## Scenario 6 — Invalid token

Role: Guest
Route: `/invitation/manager/[token]`
Setup: Syntactically invalid token without using a real secret.
Steps: Open URL.
Expected: Safe Ukrainian inactive message; no IDs/hash/stack trace.
Actual: Not run.
Status: [ ] PASS [ ] FAIL [ ] BLOCKED [x] NOT RUN
Notes:

## Scenario 7 — Expired token

Role: Guest
Route: `/invitation/manager/[token]`
Setup: Controlled expired staging invitation prepared without production data.
Steps: Open URL; attempt submit.
Expected: Expired/inactive result; account remains INVITED.
Actual: Not run.
Status: [ ] PASS [ ] FAIL [ ] BLOCKED [x] NOT RUN
Notes:

## Scenario 8 — Revoked token after regenerate

Role: ADMIN then Guest
Route: `/admin/team`, `/invitation/manager/[token]`
Setup: INVITED MANAGER with first URL.
Steps: Regenerate; open old URL; retain new URL for activation.
Expected: Old URL denied; exactly one active invitation remains.
Actual: Not run.
Status: [ ] PASS [ ] FAIL [ ] BLOCKED [x] NOT RUN
Notes:

## Scenario 9 — Successful password setup

Role: Guest / invited MANAGER
Route: `/invitation/manager/[token]`
Setup: Active new invitation URL.
Steps: Enter valid matching password and submit.
Expected: User becomes ACTIVE, password saved as hash, authVersion increments, invitation used.
Actual: Not run.
Status: [ ] PASS [ ] FAIL [ ] BLOCKED [x] NOT RUN
Notes:

## Scenario 10 — Reused token denied

Role: Guest
Route: `/invitation/manager/[token]`
Setup: URL consumed in scenario 9.
Steps: Reopen URL and retry submit.
Expected: Used/inactive result; password/account unchanged.
Actual: Not run.
Status: [ ] PASS [ ] FAIL [ ] BLOCKED [x] NOT RUN
Notes:

## Scenario 11 — MANAGER login

Role: MANAGER
Route: `/admin/login`, `/admin`
Setup: Activated test manager.
Steps: Sign in using the newly established password.
Expected: Login succeeds and `/admin` opens.
Actual: Not run.
Status: [ ] PASS [ ] FAIL [ ] BLOCKED [x] NOT RUN
Notes:

## Scenario 12 — MANAGER cannot access Team

Role: MANAGER
Route: `/admin/team`
Setup: Session from scenario 11.
Steps: Open direct route and inspect sidebar.
Expected: Access denied and Team navigation hidden.
Actual: Not run.
Status: [ ] PASS [ ] FAIL [ ] BLOCKED [x] NOT RUN
Notes:

## Scenario 13 — Disable MANAGER

Role: ADMIN
Route: `/admin/team`
Setup: ACTIVE test manager with an existing browser session.
Steps: Confirm disable action.
Expected: Status DISABLED, authVersion incremented, password unchanged, audit event created.
Actual: Not run.
Status: [ ] PASS [ ] FAIL [ ] BLOCKED [x] NOT RUN
Notes:

## Scenario 14 — Existing session immediately denied

Role: MANAGER
Route: `/admin`
Setup: Keep the pre-disable manager browser session open.
Steps: Navigate or refresh after scenario 13.
Expected: Existing session loses CRM access on next server validation.
Actual: Not run.
Status: [ ] PASS [ ] FAIL [ ] BLOCKED [x] NOT RUN
Notes:

## Scenario 15 — Login denied while DISABLED

Role: MANAGER
Route: `/admin/login`
Setup: Disabled test manager.
Steps: Attempt login with valid password.
Expected: Login denied with safe Ukrainian disabled-account message.
Actual: Not run.
Status: [ ] PASS [ ] FAIL [ ] BLOCKED [x] NOT RUN
Notes:

## Scenario 16 — Enable MANAGER

Role: ADMIN
Route: `/admin/team`
Setup: DISABLED test manager with password.
Steps: Confirm enable action.
Expected: Status ACTIVE, authVersion increments again, password remains unchanged.
Actual: Not run.
Status: [ ] PASS [ ] FAIL [ ] BLOCKED [x] NOT RUN
Notes:

## Scenario 17 — Old JWT remains stale

Role: MANAGER
Route: `/admin`
Setup: Preserve JWT issued before disable/enable.
Steps: Try CRM access without a new login.
Expected: Old JWT remains invalid due authVersion mismatch.
Actual: Not run.
Status: [ ] PASS [ ] FAIL [ ] BLOCKED [x] NOT RUN
Notes:

## Scenario 18 — New login works

Role: MANAGER
Route: `/admin/login`, `/admin`
Setup: Enabled manager; old session cleared.
Steps: Sign in again with the same password.
Expected: New JWT uses current authVersion and CRM opens.
Actual: Not run.
Status: [ ] PASS [ ] FAIL [ ] BLOCKED [x] NOT RUN
Notes:

## Scenario 19 — AuditLog events

Role: ADMIN
Route: `/admin/audit-log`
Setup: Scenarios 4, 8, 9, 13 and 16 completed.
Steps: Inspect lifecycle events and actor/entity/status details.
Expected: Created, regenerated, activated, disabled and enabled events present once each as applicable.
Actual: Not run.
Status: [ ] PASS [ ] FAIL [ ] BLOCKED [x] NOT RUN
Notes:

## Scenario 20 — Secret leakage visual check

Role: ADMIN
Route: `/admin/team`, `/admin/audit-log`
Setup: Completed onboarding lifecycle.
Steps: Inspect page source-visible UI, dialogs and audit details.
Expected: No token/hash/password/authVersion/session secret or persistent invitation URL is displayed.
Actual: Not run.
Status: [ ] PASS [ ] FAIL [ ] BLOCKED [x] NOT RUN
Notes:

## Scenario 21 — Responsive Team UI

Role: ADMIN
Route: `/admin/team`
Setup: Staff list containing ADMIN and test MANAGER.
Steps: Verify 390px, 768px and 1280px; open create/result/confirmation dialogs; keyboard navigate.
Expected: No global horizontal scroll or clipped actions; table/cards switch correctly; focus and live states work.
Actual: Not run.
Status: [ ] PASS [ ] FAIL [ ] BLOCKED [x] NOT RUN
Notes:

## Scenario 22 — Cleanup

Role: ADMIN
Route: `/admin/team`
Setup: All prior staging scenarios complete.
Steps: Disable the controlled test manager; verify login denial. Do not delete history.
Expected: Test manager remains DISABLED; invitation and AuditLog history preserved.
Actual: Not run.
Status: [ ] PASS [ ] FAIL [ ] BLOCKED [x] NOT RUN
Notes:
