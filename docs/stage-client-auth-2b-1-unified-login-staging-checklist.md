# Stage Client Auth 2B.1 — unified login staging checklist

Не вносити email, phone, password, user ID або hash у цей документ. `Actual`, `Status`, `Notes` заповнювати після Vercel redeploy.

| Scenario | Role | Route | Setup | Steps | Expected | Actual | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| Unified form | Public | `/login` | Deploy current commit | Open desktop/mobile | Немає CLIENT type switch та ЄДРПОУ | — | NOT RUN | — |
| Email login | CLIENT | `/login` | ACTIVE account | Submit valid email/password | Redirect to safe CLIENT route | — | NOT RUN | — |
| Canonical phone | CLIENT | `/login` | Exact normalizedPhone match | Paste canonical phone, submit | Masked display; successful login | — | BLOCKED | Matching test account required |
| Local phone | CLIENT | `/login` | Exact normalizedPhone match | Enter 10 local digits | Progressive mask; canonical auth value | — | BLOCKED | Matching test account required |
| Formatted paste | CLIENT | `/login` | Exact normalizedPhone match | Paste formatted phone | Correct display and successful login | — | BLOCKED | Matching test account required |
| Incomplete phone | CLIENT | `/login` | None | Enter fewer than 10 local digits | Browser denies submit | — | NOT RUN | — |
| Extra digits | CLIENT | `/login` | None | Enter/paste more than allowed | Field retains max 10 local digits | — | NOT RUN | — |
| Email isolation | CLIENT | `/login` | None | Enter `a`, `name@`, full email | Phone mask is not applied | — | NOT RUN | — |
| Backspace/Delete | CLIENT | `/login` | Complete masked number | Edit middle/end digits | Predictable digit edit and caret | — | NOT RUN | — |
| Wrong password | CLIENT | `/login` | ACTIVE account | Submit wrong password | Generic credentials error | — | NOT RUN | — |
| Unknown phone | CLIENT | `/login` | No matching account | Submit complete phone | Generic credentials error | match=0 audit | PASS | No PII output |
| Staff phone denied | ADMIN | `/admin/login` | ACTIVE account | Attempt phone identifier | Denied | — | NOT RUN | Staff form remains email-only |
| Email login | ADMIN | `/admin/login` | ACTIVE account | Submit email/password | Current admin destination | — | NOT RUN | — |
| Email login | MANAGER | `/admin/login` | ACTIVE account | Submit email/password | Current admin destination | — | NOT RUN | — |
| Safe next | CLIENT | `/login?next=...` | ACTIVE account | Login with allowlisted next | Requested safe CLIENT route | — | NOT RUN | — |
| External next | CLIENT | `/login?next=...` | ACTIVE account | Use external URL | Falls back to `/client` | — | NOT RUN | — |
| Company membership | CLIENT | `/login` | Account with membership | Login | `/client`; relations determine context | — | NOT RUN | — |
| No membership | CLIENT | `/login` | Account without membership | Login | `/client` | — | NOT RUN | — |
| Console/logs | All | Login routes | Complete scenarios | Inspect browser and Vercel logs | No unexpected exception or raw identifier | — | NOT RUN | — |
