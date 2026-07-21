# Stage Client Auth 2B — phone login staging checklist

Заповнювати `Actual`, `Status` і `Notes` лише після фактичної перевірки на staging. Не додавати телефони, email, паролі або інші PII до цього документа.

| # | Scenario | Role | Route | Setup | Steps | Expected | Actual | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | CLIENT login за email | CLIENT | `/login` | ACTIVE account | Ввести email і правильний пароль | Redirect у client cabinet | Redirect у `/client`, dashboard доступний | PASS | Local browser + Neon |
| 2 | CLIENT login за canonical phone | CLIENT | `/login` | ACTIVE account | Ввести canonical phone і пароль | Login успішний | Login успішний, `/client` доступний | PASS | Local browser + Neon |
| 3 | CLIENT login за local phone | CLIENT | `/login` | ACTIVE account | Ввести local phone і пароль | Login успішний | — | NOT RUN | — |
| 4 | CLIENT login за formatted phone | CLIENT | `/login` | ACTIVE account | Ввести phone з дозволеним formatting | Login успішний | — | NOT RUN | — |
| 5 | CLIENT wrong password | CLIENT | `/login` | ACTIVE account | Ввести правильний identifier і хибний пароль | Generic credentials error | — | NOT RUN | — |
| 6 | Unknown phone | GUEST | `/login` | Невідомий synthetic phone | Submit | Той самий generic error | — | NOT RUN | — |
| 7 | Invalid short phone | GUEST | `/login` | Synthetic short input | Submit | Generic error, login denied | — | NOT RUN | — |
| 8 | Invalid long phone | GUEST | `/login` | Synthetic long input | Submit | Generic error, login denied | — | NOT RUN | — |
| 9 | Foreign phone | GUEST | `/login` | Synthetic foreign input | Submit | Generic error, login denied | — | NOT RUN | — |
| 10 | DISABLED CLIENT phone login | CLIENT | `/login` | DISABLED account | Submit valid phone/password | Generic error, login denied | — | NOT RUN | — |
| 11 | INVITED CLIENT phone login | CLIENT | `/login` | INVITED account | Submit valid phone/password | Generic error, login denied | — | NOT RUN | — |
| 12 | CLIENT без passwordHash | CLIENT | `/login` | Isolated fixture | Submit valid phone | Generic error, login denied | — | NOT RUN | — |
| 13 | ADMIN email login | ADMIN | `/admin/login` | ACTIVE ADMIN | Submit email/password | CRM login успішний | Redirect у `/admin` | PASS | Local browser + Neon |
| 14 | MANAGER email login | MANAGER | `/admin/login` | ACTIVE MANAGER | Submit email/password | CRM login успішний | — | NOT RUN | — |
| 15 | ADMIN phone login denied | ADMIN | `/login` | ADMIN із phone fixture | Submit phone/password | Generic error, no session | — | NOT RUN | — |
| 16 | MANAGER phone login denied | MANAGER | `/login` | MANAGER із phone fixture | Submit phone/password | Generic error, no session | — | NOT RUN | — |
| 17 | Duplicate phone registration | GUEST | `/register` | Existing CLIENT phone | Register formatting variant | Controlled non-enumerating error | — | NOT RUN | — |
| 18 | Duplicate phone profile update | CLIENT | Profile flow | Update flow must exist | Set another account phone | Controlled rejection | — | NOT RUN | Current identity-phone update UI absent |
| 19 | Own unchanged phone update | CLIENT | Profile flow | Update flow must exist | Save own phone | Allowed | — | NOT RUN | Current identity-phone update UI absent |
| 20 | Phone change to valid unique number | CLIENT | Profile flow | Update flow must exist | Save unique phone | Success | — | NOT RUN | Current identity-phone update UI absent |
| 21 | Phone change syncs raw/normalized | CLIENT | Profile/Telegram | Existing update flow | Change phone and inspect aggregates | Raw/profile/normalized match | — | NOT RUN | Telegram path implemented |
| 22 | Failed duplicate update atomicity | CLIENT | Profile/Telegram | Duplicate fixture | Attempt update | No partial state | — | NOT RUN | — |
| 23 | Telegram-linked CLIENT phone login | CLIENT | Telegram + `/login` | Linked CLIENT | Re-link, then login by phone | Login успішний | — | NOT RUN | — |
| 24 | Logout and re-login | CLIENT | `/client`, `/login` | Active session | Logout, login by phone | Session renewed | Logout завершив session; phone re-login успішний | PASS | Local browser + Neon |
| 25 | Stale CLIENT session | CLIENT | `/client` | Existing session | Increment authVersion | Session invalidated | — | NOT RUN | — |
| 26 | Mobile client login UI | GUEST | `/login` | 390 px viewport | Inspect and submit | No clipping/overflow | — | NOT RUN | — |
| 27 | Desktop client login UI | GUEST | `/login` | Desktop viewport | Inspect form | Label/placeholder correct | Label і placeholder відповідають Stage 2B | PASS | Local browser DOM inspection |
| 28 | Generic error consistency | GUEST | `/login` | Multiple failure types | Compare visible messages | Identical message | — | NOT RUN | — |
| 29 | No raw phone in server logs | GUEST | `/login` | Server logs available | Run failures and inspect logs | No identifier/phone logged | — | NOT RUN | — |
| 30 | Browser console clean | GUEST/CLIENT | Auth routes | Browser devtools | Run login scenarios | No unexpected auth errors | — | NOT RUN | — |
