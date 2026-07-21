import { createRequire } from 'node:module';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

const { Client } = createRequire(import.meta.url)('pg') as {
  Client: new (config: { connectionString: string; enableChannelBinding: boolean }) => {
    connect(): Promise<void>;
    query<T = Record<string, unknown>>(sql: string): Promise<{ rows: T[] }>;
    end(): Promise<void>;
  };
};

type Row = Record<string, unknown>;

type AuditRow = {
  id: string;
  action: string;
  metadata: unknown;
};

const sensitiveMetadataKeys = new Set([
  'token',
  'tokenhash',
  'invitationurl',
  'invitation_url',
  'password',
  'passwordhash',
  'password_hash',
  'authversion',
  'auth_version',
  'secret',
  'apikey',
  'api_key',
  'sessionid',
  'session_id',
  'access_token',
  'refreshtoken',
  'refresh_token'
]);

function parseMetadata(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }

  return value;
}

function hasSensitiveMetadataKey(value: unknown): boolean {
  if (!value) {
    return false;
  }

  if (typeof value === 'string') {
    return false;
  }

  if (typeof value !== 'object') {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasSensitiveMetadataKey(item));
  }

  const obj = value as Record<string, unknown>;
  return Object.entries(obj).some(([rawKey, val]) => {
    const key = rawKey.toLowerCase();
    if (sensitiveMetadataKeys.has(key)) {
      return true;
    }

    return hasSensitiveMetadataKey(val);
  });
}

function normalizeRowCount(rows: Row[], key1: string, key2: string) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const role = String(row[key1] ?? 'UNKNOWN');
    const status = String(row[key2] ?? 'UNKNOWN');
    const count = Number((row.count as string | number | bigint) ?? 0);
    acc[`${role}:${status}`] = count;
    return acc;
  }, {});
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const client = new Client({ connectionString: dbUrl, enableChannelBinding: true });
  await client.connect();

  try {
    const nowIso = new Date().toISOString();

    const [userRows, staffRows, inviteRows, activeInvitationRows, authVersionRows, duplicateEmailsRows, auditRows, auditEventRows] =
      await Promise.all([
        client.query(`
          SELECT "role", "status", COUNT(*)::text AS count
          FROM "User"
          GROUP BY "role", "status"
          ORDER BY "role", "status"
        `),
        client.query(`
          SELECT "status", COUNT(*)::text AS count
          FROM "User"
          WHERE "role" IN ('ADMIN', 'MANAGER')
          GROUP BY "status"
          ORDER BY "status"
        `),
        client.query(`
          SELECT
            COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE "usedAt" IS NULL AND "revokedAt" IS NULL AND "expiresAt" > now())::text AS active,
            COUNT(*) FILTER (WHERE "usedAt" IS NULL AND "revokedAt" IS NULL AND "expiresAt" <= now())::text AS expired,
            COUNT(*) FILTER (WHERE "usedAt" IS NOT NULL)::text AS used,
            COUNT(*) FILTER (WHERE "revokedAt" IS NOT NULL)::text AS revoked
          FROM "ManagerInvitation"
        `),
        client.query(`
          SELECT
            "userId"::text AS "userId",
            COUNT(*)::text AS count
          FROM "ManagerInvitation"
          WHERE "usedAt" IS NULL
            AND "revokedAt" IS NULL
            AND "expiresAt" > now()
          GROUP BY "userId"
          HAVING COUNT(*) > 1
          ORDER BY count DESC
          LIMIT 50
        `),
        client.query(`
          SELECT "authVersion"::text AS value, COUNT(*)::text AS count
          FROM "User"
          GROUP BY "authVersion"
          ORDER BY "authVersion"::int
        `),
        client.query(`
          SELECT "email", COUNT(*)::text AS count
          FROM "User"
          WHERE "email" IS NOT NULL
          GROUP BY "email"
          HAVING COUNT(*) > 1
          ORDER BY count DESC, "email"
          LIMIT 50
        `),
        client.query(`
          SELECT "id", "action"::text AS action, "metadata"
          FROM "AuditLog"
          WHERE "action" IN (
            'MANAGER_INVITATION_CREATED',
            'MANAGER_INVITATION_REGENERATED',
            'MANAGER_ACTIVATED'
          )
          OR "action" = 'ENTITY_UPDATED'
          ORDER BY "createdAt" DESC
          LIMIT 500
        `),
        client.query(`
          SELECT
            CASE
              WHEN "action" = 'ENTITY_UPDATED'
                AND jsonb_typeof("metadata") = 'object'
                AND "metadata"::jsonb ->> 'event' IN ('MANAGER_DISABLED', 'MANAGER_ENABLED')
              THEN "metadata"::jsonb ->> 'event'
              ELSE "action"::text
            END AS "action",
            COUNT(*)::text AS count
          FROM "AuditLog"
          WHERE (
            "action" IN (
              'MANAGER_INVITATION_CREATED',
              'MANAGER_INVITATION_REGENERATED',
              'MANAGER_ACTIVATED'
            )
            OR (
              "action" = 'ENTITY_UPDATED'
              AND jsonb_typeof("metadata") = 'object'
              AND "metadata"::jsonb ->> 'event' IN ('MANAGER_DISABLED', 'MANAGER_ENABLED')
            )
          )
          GROUP BY
            CASE
              WHEN "action" = 'ENTITY_UPDATED'
                AND jsonb_typeof("metadata") = 'object'
                AND "metadata"::jsonb ->> 'event' IN ('MANAGER_DISABLED', 'MANAGER_ENABLED')
              THEN "metadata"::jsonb ->> 'event'
              ELSE "action"::text
            END
          ORDER BY "action"
        `)
      ]);

    const userMatrix = normalizeRowCount(userRows.rows, 'role', 'status');
    const staffMatrix = staffRows.rows.reduce<Record<string, number>>((acc, row) => {
      acc[String(row.status)] = Number((row.count as string | number | bigint) ?? 0);
      return acc;
    }, {});
    const invites = inviteRows.rows[0] ?? {};

    const authVersions = authVersionRows.rows.map((row) => ({
      value: Number(row.value),
      count: Number(row.count)
    }));

    const duplicateEmails = duplicateEmailsRows.rows.map((row) => ({
      email: String(row.email),
      count: Number(row.count)
    }));

    const multipleActiveInvitations = activeInvitationRows.rows.map((row) => ({
      userId: String(row.userId),
      count: Number(row.count)
    }));

    const parsedAuditRows = auditRows.rows as AuditRow[];
    const auditSensitiveRows = parsedAuditRows.filter((row) =>
      hasSensitiveMetadataKey(parseMetadata(row.metadata))
    );

    const auditActionCounts = auditEventRows.rows.reduce<Record<string, number>>((acc, row) => {
      const action = String(row.action);
      acc[action] = Number((row.count as string | number | bigint) ?? 0);
      return acc;
    }, {});

    const result = {
      generatedAt: nowIso,
      users: {
        roleStatusMatrix: userMatrix,
        total: Object.values(userMatrix).reduce((sum, value) => sum + value, 0),
        staff: {
          total: Object.values(staffMatrix).reduce((sum, value) => sum + value, 0),
          byStatus: {
            invited: Number(staffMatrix.INVITED || 0),
            active: Number(staffMatrix.ACTIVE || 0),
            disabled: Number(staffMatrix.DISABLED || 0)
          }
        },
        authVersionDistribution: authVersions,
        passwordHashNull: Number(invites.total || 0),
        passwordHashNotNull: 0,
        duplicateEmails: duplicateEmails
      },
      managerInvitations: {
        total: Number(invites.total || 0),
        active: Number(invites.active || 0),
        expired: Number(invites.expired || 0),
        used: Number(invites.used || 0),
        revoked: Number(invites.revoked || 0),
        multipleActivePerUser: multipleActiveInvitations
      },
      auditLog: {
        counts: auditActionCounts,
        sensitiveMetadataRows: auditSensitiveRows.map((row) => ({ id: row.id, action: row.action }))
      }
    };

    const validation = {
      duplicateEmails: result.users.duplicateEmails.length > 0,
      multipleActiveInvitations: result.managerInvitations.multipleActivePerUser.length > 0,
      auditSensitiveLeak: result.auditLog.sensitiveMetadataRows.length > 0
    };

    console.log(`Stage 2D Admin Users read-only audit summary (${nowIso})`);
    console.log(JSON.stringify(result, null, 2));

    const issues = [
      result.users.duplicateEmails.length ? `duplicate email count: ${result.users.duplicateEmails.length}` : null,
      result.managerInvitations.multipleActivePerUser.length ? `multiple active invitations for users: ${result.managerInvitations.multipleActivePerUser.length}` : null,
      result.auditLog.sensitiveMetadataRows.length ? `sensitive fields in AuditLog metadata: ${result.auditLog.sensitiveMetadataRows.length}` : null
    ].filter(Boolean);

    if (issues.length > 0) {
      console.error('Validation findings:\n' + issues.join('\n'));
    }

    const passwordHashNullRows = await client.query(`SELECT COUNT(*)::text AS count FROM "User" WHERE "passwordHash" IS NULL`);
    const authVersionMismatchRows = await client.query(`SELECT COUNT(*)::text AS count FROM "User" WHERE "role" IN ('ADMIN', 'MANAGER') AND "authVersion" IS NULL`);

    const passwordHashNull = Number(passwordHashNullRows.rows[0].count);
    result.users.passwordHashNull = passwordHashNull;
    const totalUsers = result.users.total;
    result.users.passwordHashNotNull = totalUsers - passwordHashNull;

    console.log(`Validation flags:\n- duplicateEmails=${validation.duplicateEmails}\n- multipleActiveInvitations=${validation.multipleActiveInvitations}\n- authVersionNull=${Number(authVersionMismatchRows.rows[0].count) > 0}\n- auditLogSensitive=${validation.auditSensitiveLeak}`);

    const hasBlocker = validation.duplicateEmails || validation.multipleActiveInvitations || validation.auditSensitiveLeak;
    if (hasBlocker) {
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Stage 2D audit failed.');
  process.exitCode = 1;
});
