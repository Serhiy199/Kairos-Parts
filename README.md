# Kairos-Parts

## Test accounts

Use these accounts for local/staging testing after running the dev seed.

| Role | Email | Password | Area |
| --- | --- | --- | --- |
| Client | `client@test.com` | `Test123456!` | `/client` |
| Manager | `manager@test.com` | `Test123456!` | `/admin` |
| Admin | `admin@test.com` | `Test123456!` | `/admin` |

Seed command:

```powershell
$env:ALLOW_DEV_SEED='true'
npm.cmd run db:seed
```

Do not run the dev seed against production database.
