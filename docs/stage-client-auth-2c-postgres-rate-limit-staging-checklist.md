# Stage Client Auth 2C — PostgreSQL rate-limit staging checklist

Не записувати raw email, phone, IP, hashes, passwords, IDs або secrets. До Vercel redeploy усі runtime scenarios мають статус `NOT RUN`.

| Scenario | Role | Route | Setup | Steps | Expected | Actual | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| CLIENT email below threshold | CLIENT | `/login` | ACTIVE test account | Valid email/password | Login succeeds | — | NOT RUN | — |
| CLIENT phone below threshold | CLIENT | `/login` | ACTIVE test account | Valid phone/password | Login succeeds | — | NOT RUN | — |
| ADMIN email below threshold | ADMIN | `/admin/login` | ACTIVE test account | Valid email/password | CRM login succeeds | — | NOT RUN | — |
| MANAGER email below threshold | MANAGER | `/admin/login` | ACTIVE test account | Valid email/password | CRM login succeeds | — | NOT RUN | — |
| CLIENT wrong password 1–4 | CLIENT | `/login` | Isolated account/bucket | Repeat failures | Generic credentials error; not blocked | — | NOT RUN | — |
| Identifier threshold | Any | Login route | Isolated bucket | Fifth failure, retry | Generic block message | Local production smoke: 1–4 credentials, fifth blocked | NOT RUN | Local evidence only; staging remains required |
| Unknown email | Unknown | `/login` | Nonexistent identifier | Reach threshold | Same generic block | — | NOT RUN | — |
| Unknown phone | Unknown | `/login` | Nonexistent identifier | Reach threshold | Same generic block | — | NOT RUN | — |
| Phone variants | CLIENT | `/login` | One test phone | Mix local/canonical/formatted failures | One identifier bucket | — | NOT RUN | — |
| Email case variants | CLIENT | `/login` | One test email | Mix casing | One identifier bucket | — | NOT RUN | — |
| Separate identifier | Any | Login route | Two test identifiers | Fail first identifier | Second identifier bucket separate | — | NOT RUN | — |
| IP limit across identifiers | Unknown | Login routes | Isolated trusted IP | Fail multiple identifiers | IP block at 20 | — | NOT RUN | — |
| Generic block message | Any | Login route | Blocked bucket | Attempt login | No scope/count/expiry leak | — | NOT RUN | — |
| Account existence isolation | Known/Unknown | Login route | Two identifiers | Compare errors | Existence not disclosed | — | NOT RUN | — |
| Success clears identifier | CLIENT | `/login` | Prior failures below threshold | Valid login, inspect aggregate | Identifier bucket removed | — | NOT RUN | — |
| Success preserves IP | CLIENT | `/login` | Prior IP failures | Valid login | IP bucket remains | — | NOT RUN | — |
| Window expiry | Any | Login route | Isolated expired bucket | Attempt after 15 minutes | New window allowed | — | NOT RUN | — |
| Disabled user failures | CLIENT/Staff | Login route | Disabled test account | Invalid login | Failure counted; public behavior unchanged | — | NOT RUN | — |
| Staff phone attempt | Staff | Direct credentials callback | Test phone | Submit STAFF scope | Denied and counted | — | NOT RUN | Browser form is email-only |
| Invalid identifier | Unknown | Direct credentials callback | Invalid value | Repeat failures | Stable unknown bucket | — | NOT RUN | — |
| Vercel env configured | Ops | Vercel | Preview/Production | Inspect env presence | Strong server-only secret exists | — | NOT RUN | Never copy into report |
| Missing secret | Any | Safe preview | Remove only in isolated preview | Attempt login | Fail closed; generic unavailable | — | NOT RUN | Do not test in production |
| DB temporary failure | Any | Safe environment | Controlled outage | Attempt login | Fail closed; no DB detail | — | NOT RUN | — |
| No raw email in DB | Ops | Neon | Test attempts complete | Inspect schema/rows | Hash only | — | NOT RUN | — |
| No raw phone in DB | Ops | Neon | Test attempts complete | Inspect schema/rows | Hash only | — | NOT RUN | — |
| No raw IP in DB | Ops | Neon | Test attempts complete | Inspect schema/rows | Hash only | — | NOT RUN | — |
| No raw PII in logs | Ops | Vercel logs | Test attempts complete | Inspect structured logs | Categories only | — | NOT RUN | — |
| Concurrent requests | Any | Credentials callback | Isolated keys | Parallel failures | No lost increments/bypass | Neon isolated test | PASS | Automated pre-deploy evidence |
| Stale cleanup | Ops | Neon | Isolated stale rows | Trigger/execute cleanup | Active rows preserved; stale batch removed | — | NOT RUN | Pure policy + audit covered |
| Mobile login UI | CLIENT | `/login` | Mobile viewport | Exercise failures/block | Layout and message usable | — | NOT RUN | — |
| Desktop login UI | CLIENT | `/login` | Desktop viewport | Exercise failures/block | Layout and message usable | — | NOT RUN | — |
| Logout/re-login | CLIENT | `/client` | Valid session | Logout then login | Session flow unchanged | — | NOT RUN | — |
| CLIENT phone regression | CLIENT | `/login` | ACTIVE phone account | Local/formatted/canonical login | All resolve same account | — | NOT RUN | — |
| Staff email regression | ADMIN/MANAGER | `/admin/login` | ACTIVE staff accounts | Email login | Existing destinations | — | NOT RUN | — |
| Browser console | All | Login routes | Complete scenarios | Inspect console | No unexpected error | Local unknown-identifier threshold smoke: empty console | NOT RUN | Local evidence only; staging remains required |
| Vercel logs | All | Login routes | Complete scenarios | Inspect logs | No unexpected exception/PII | — | NOT RUN | — |
