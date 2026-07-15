# Delete test client by exact email

## Scope

Target email:

```text
clientMyTest@test.com
```

The task was to find a test client by exact email in the connected Neon database, run a dry-run dependency summary, and delete only if exactly one CLIENT match was found.

## Database connection check

The dry-run used the local `.env.local` configuration without printing secrets or full connection strings.

Safe connection metadata:

```text
database: neondb
host hint: ep-wandering-thunder-***
host suffix: eu-central-1.aws.neon.tech
sslmode: require
likely Neon: yes
likely pooler: no
```

Note: the first sandboxed Prisma attempt failed with a Windows TLS credentials error. The same dry-run command succeeded outside the sandbox. No database credentials were printed.

## Dry-run result

Command:

```powershell
npx.cmd tsx scripts/delete-test-client-by-email.ts --email clientMyTest@test.com
```

Result:

```text
matchCount: 0
usersByEmail: 0
profilesByEmail: 0
stopReason: No exact match found.
```

## Found records

No exact `User.email` match was found.

No exact `ClientProfile.email` match was found.

Because there was no exact match, related records were not deleted and no dependency cleanup was performed.

## Deleted records

Nothing was deleted.

Reason:

```text
Deletion is allowed only when exactly one matching CLIENT user/profile is found.
```

## Company handling

No company or company membership was found for this exact email.

No company was deleted.

## User handling

No User was deleted.

## Schema and migrations

Prisma schema was not changed.

No migration was created or applied.

## Post-checks

The email `clientMyTest@test.com` was not found by exact match in the connected Neon database, so there was no user/profile to remove.

If the user still cannot register this email, the next check should verify whether the stored email differs by casing or another value, for example `clientmytest@test.com`. That broader search was intentionally not used for deletion because this task required exact email matching.
