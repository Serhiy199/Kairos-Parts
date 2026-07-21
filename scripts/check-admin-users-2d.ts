/**
 * READ-ONLY AUDIT: this script performs SELECT queries only and never prints PII,
 * credentials, invitation secrets, hashes, record IDs, or metadata payloads.
 */
import { createRequire } from 'node:module';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

type QueryRow = Record<string, unknown>;
type QueryResult<T extends QueryRow = QueryRow> = { rows: T[] };
type PgClient = {
  connect(): Promise<void>;
  query<T extends QueryRow = QueryRow>(sql: string): Promise<QueryResult<T>>;
  end(): Promise<void>;
};

const { Client } = createRequire(import.meta.url)('pg') as {
  Client: new (config: { connectionString: string; enableChannelBinding: boolean }) => PgClient;
};

const sensitiveKeyCategories = new Map<string, string>([
  ['token', 'token'],
  ['tokenhash', 'tokenHash'],
  ['plaintoken', 'plainToken'],
  ['invitationurl', 'invitationUrl'],
  ['password', 'password'],
  ['passwordhash', 'passwordHash'],
  ['secret', 'secret'],
  ['apikey', 'apiKey'],
  ['authorization', 'authorization'],
  ['cookie', 'cookie'],
  ['sessiontoken', 'sessionToken'],
  ['accesstoken', 'accessToken'],
  ['refreshtoken', 'refreshToken']
]);

function count(row: QueryRow | undefined, key: string) {
  return Number(row?.[key] ?? 0);
}

function normalizeSensitiveKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseMetadata(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function collectSensitiveKeyCategories(value: unknown, found: Set<string>): void {
  const parsed = parseMetadata(value);

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      collectSensitiveKeyCategories(item, found);
    }
    return;
  }

  if (!parsed || typeof parsed !== 'object') {
    return;
  }

  for (const [rawKey, nestedValue] of Object.entries(parsed as Record<string, unknown>)) {
    const category = sensitiveKeyCategories.get(normalizeSensitiveKey(rawKey));
    if (category) {
      found.add(category);
    }
    collectSensitiveKeyCategories(nestedValue, found);
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const client = new Client({ connectionString, enableChannelBinding: true });
  await client.connect();

  try {
    // Queries are intentionally sequential: pg.Client supports one active query at a time.
    const userSummaryResult = await client.query(`
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE "status" = 'INVITED')::text AS invited,
        COUNT(*) FILTER (WHERE "status" = 'ACTIVE')::text AS active,
        COUNT(*) FILTER (WHERE "status" = 'DISABLED')::text AS disabled,
        COUNT(*) FILTER (WHERE "role" IN ('ADMIN', 'MANAGER'))::text AS staff_total,
        COUNT(*) FILTER (WHERE "role" IN ('ADMIN', 'MANAGER') AND "status" = 'INVITED')::text AS staff_invited,
        COUNT(*) FILTER (WHERE "role" IN ('ADMIN', 'MANAGER') AND "status" = 'ACTIVE')::text AS staff_active,
        COUNT(*) FILTER (WHERE "role" IN ('ADMIN', 'MANAGER') AND "status" = 'DISABLED')::text AS staff_disabled,
        COUNT(*) FILTER (WHERE "passwordHash" IS NULL)::text AS password_hash_null,
        COUNT(*) FILTER (WHERE "passwordHash" IS NOT NULL)::text AS password_hash_not_null,
        COUNT(*) FILTER (WHERE "status" = 'INVITED' AND "passwordHash" IS NULL)::text AS invited_password_null,
        COUNT(*) FILTER (WHERE "status" = 'INVITED' AND "passwordHash" IS NOT NULL)::text AS invited_password_not_null,
        COUNT(*) FILTER (WHERE "status" = 'ACTIVE' AND "passwordHash" IS NULL)::text AS active_password_null,
        COUNT(*) FILTER (WHERE "status" = 'ACTIVE' AND "passwordHash" IS NOT NULL)::text AS active_password_not_null,
        COUNT(*) FILTER (WHERE "status" = 'DISABLED' AND "passwordHash" IS NULL)::text AS disabled_password_null,
        COUNT(*) FILTER (WHERE "status" = 'DISABLED' AND "passwordHash" IS NOT NULL)::text AS disabled_password_not_null,
        COUNT(*) FILTER (WHERE "role" = 'MANAGER' AND "status" = 'INVITED' AND "passwordHash" IS NOT NULL)::text AS invited_manager_with_password,
        COUNT(*) FILTER (WHERE "role" = 'MANAGER' AND "status" = 'DISABLED' AND "passwordHash" IS NULL)::text AS disabled_manager_without_password,
        COUNT(*) FILTER (WHERE "role" = 'ADMIN' AND "status" = 'INVITED')::text AS invited_admin,
        COUNT(*) FILTER (WHERE "role" = 'CLIENT' AND "status" = 'INVITED')::text AS invited_client,
        COUNT(*) FILTER (WHERE "role" = 'MANAGER' AND "status" = 'INVITED')::text AS invited_manager,
        COUNT(*) FILTER (WHERE "role" IN ('ADMIN', 'MANAGER') AND "status" = 'ACTIVE')::text AS active_staff,
        COUNT(*) FILTER (WHERE "role" = 'CLIENT' AND "status" = 'DISABLED')::text AS disabled_client,
        COUNT(*) FILTER (WHERE "role" = 'MANAGER' AND "status" = 'DISABLED')::text AS disabled_manager,
        COUNT(*) FILTER (WHERE "role" = 'ADMIN' AND "status" = 'DISABLED')::text AS disabled_admin,
        COUNT(*) FILTER (WHERE "authVersion" IS NULL)::text AS auth_version_null,
        COUNT(*) FILTER (WHERE "authVersion" < 1)::text AS auth_version_less_than_one
      FROM "User"
    `);

    const duplicateEmailResult = await client.query(`
      SELECT COUNT(*)::text AS duplicate_group_count
      FROM (
        SELECT lower("email")
        FROM "User"
        WHERE "email" IS NOT NULL
        GROUP BY lower("email")
        HAVING COUNT(*) > 1
      ) duplicate_groups
    `);

    const invitationStateResult = await client.query(`
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE "usedAt" IS NOT NULL)::text AS used,
        COUNT(*) FILTER (WHERE "usedAt" IS NULL AND "revokedAt" IS NOT NULL)::text AS revoked_unused,
        COUNT(*) FILTER (
          WHERE "usedAt" IS NULL AND "revokedAt" IS NULL AND "expiresAt" > now()
        )::text AS active,
        COUNT(*) FILTER (
          WHERE "usedAt" IS NULL AND "revokedAt" IS NULL AND "expiresAt" <= now()
        )::text AS expired_unused
      FROM "ManagerInvitation"
    `);

    const invitationIntegrityResult = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE u."id" IS NULL)::text AS invitation_without_user,
        COUNT(*) FILTER (WHERE u."id" IS NOT NULL AND u."role" <> 'MANAGER')::text AS invitation_for_non_manager,
        COUNT(*) FILTER (
          WHERE i."usedAt" IS NULL AND i."revokedAt" IS NULL AND i."expiresAt" > now()
            AND u."status" = 'ACTIVE'
        )::text AS active_for_active_user,
        COUNT(*) FILTER (
          WHERE i."usedAt" IS NULL AND i."revokedAt" IS NULL AND i."expiresAt" > now()
            AND u."status" = 'DISABLED'
        )::text AS active_for_disabled_user,
        COUNT(*) FILTER (
          WHERE i."usedAt" IS NULL AND i."revokedAt" IS NULL AND i."expiresAt" > now()
            AND (u."id" IS NULL OR u."role" <> 'MANAGER')
        )::text AS active_for_invalid_role
      FROM "ManagerInvitation" i
      LEFT JOIN "User" u ON u."id" = i."userId"
    `);

    const multipleActiveInvitationResult = await client.query(`
      SELECT COUNT(*)::text AS group_count
      FROM (
        SELECT "userId"
        FROM "ManagerInvitation"
        WHERE "usedAt" IS NULL AND "revokedAt" IS NULL AND "expiresAt" > now()
        GROUP BY "userId"
        HAVING COUNT(*) > 1
      ) duplicate_active_groups
    `);

    const auditMetadataResult = await client.query<{ metadata: unknown }>(`
      SELECT "metadata"
      FROM "AuditLog"
      WHERE "metadata" IS NOT NULL
    `);

    const auditEventResult = await client.query(`
      SELECT
        CASE
          WHEN "action" = 'ENTITY_UPDATED'
            AND jsonb_typeof("metadata") = 'object'
            AND "metadata" ->> 'event' IN ('MANAGER_DISABLED', 'MANAGER_ENABLED')
          THEN "metadata" ->> 'event'
          ELSE "action"::text
        END AS event,
        COUNT(*)::text AS count
      FROM "AuditLog"
      WHERE "action" IN (
        'MANAGER_INVITATION_CREATED',
        'MANAGER_INVITATION_REGENERATED',
        'MANAGER_ACTIVATED'
      ) OR (
        "action" = 'ENTITY_UPDATED'
        AND jsonb_typeof("metadata") = 'object'
        AND "metadata" ->> 'event' IN ('MANAGER_DISABLED', 'MANAGER_ENABLED')
      )
      GROUP BY event
      ORDER BY event
    `);

    const user = userSummaryResult.rows[0] ?? {};
    const invitationStates = invitationStateResult.rows[0] ?? {};
    const invitationIntegrity = invitationIntegrityResult.rows[0] ?? {};

    const users = {
      total: count(user, 'total'),
      invited: count(user, 'invited'),
      active: count(user, 'active'),
      disabled: count(user, 'disabled'),
      staffTotal: count(user, 'staff_total'),
      staffInvited: count(user, 'staff_invited'),
      staffActive: count(user, 'staff_active'),
      staffDisabled: count(user, 'staff_disabled'),
      passwordHashNull: count(user, 'password_hash_null'),
      passwordHashNotNull: count(user, 'password_hash_not_null'),
      invitedPasswordNull: count(user, 'invited_password_null'),
      invitedPasswordNotNull: count(user, 'invited_password_not_null'),
      activePasswordNull: count(user, 'active_password_null'),
      activePasswordNotNull: count(user, 'active_password_not_null'),
      disabledPasswordNull: count(user, 'disabled_password_null'),
      disabledPasswordNotNull: count(user, 'disabled_password_not_null'),
      invitedManagerWithPassword: count(user, 'invited_manager_with_password'),
      disabledManagerWithoutPassword: count(user, 'disabled_manager_without_password'),
      invitedAdmin: count(user, 'invited_admin'),
      invitedClient: count(user, 'invited_client'),
      invitedManager: count(user, 'invited_manager'),
      activeStaff: count(user, 'active_staff'),
      disabledClient: count(user, 'disabled_client'),
      disabledManager: count(user, 'disabled_manager'),
      disabledAdmin: count(user, 'disabled_admin'),
      authVersionNull: count(user, 'auth_version_null'),
      authVersionLessThanOne: count(user, 'auth_version_less_than_one'),
      duplicateEmailGroups: count(duplicateEmailResult.rows[0], 'duplicate_group_count')
    };

    const invitations = {
      total: count(invitationStates, 'total'),
      active: count(invitationStates, 'active'),
      expiredUnused: count(invitationStates, 'expired_unused'),
      used: count(invitationStates, 'used'),
      revokedUnused: count(invitationStates, 'revoked_unused'),
      invitationWithoutUserCount: count(invitationIntegrity, 'invitation_without_user'),
      invitationForNonManagerCount: count(invitationIntegrity, 'invitation_for_non_manager'),
      activeInvitationForActiveUserCount: count(invitationIntegrity, 'active_for_active_user'),
      activeInvitationForDisabledUserCount: count(invitationIntegrity, 'active_for_disabled_user'),
      activeInvitationForInvalidRoleCount: count(invitationIntegrity, 'active_for_invalid_role'),
      multipleActiveInvitationUserGroups: count(multipleActiveInvitationResult.rows[0], 'group_count')
    };

    const sensitiveCategories = new Set<string>();
    let sensitiveMetadataEntryCount = 0;
    for (const row of auditMetadataResult.rows) {
      const rowCategories = new Set<string>();
      collectSensitiveKeyCategories(row.metadata, rowCategories);
      if (rowCategories.size > 0) {
        sensitiveMetadataEntryCount += 1;
        for (const category of rowCategories) {
          sensitiveCategories.add(category);
        }
      }
    }

    const auditEventCounts = Object.fromEntries(
      auditEventResult.rows.map((row) => [String(row.event), count(row, 'count')])
    );

    const userStatusInvariant = users.invited + users.active + users.disabled === users.total;
    const staffStatusInvariant = users.staffInvited + users.staffActive + users.staffDisabled === users.staffTotal;
    const passwordHashInvariant = users.passwordHashNull + users.passwordHashNotNull === users.total;
    const invitationStateInvariant =
      invitations.active + invitations.expiredUnused + invitations.used + invitations.revokedUnused === invitations.total;

    // The current Auth.js configuration contains only the Credentials provider.
    const credentialsOnlyAuth = true;
    const blockerReasons = [
      !userStatusInvariant && 'user_status_count_mismatch',
      !staffStatusInvariant && 'staff_status_count_mismatch',
      !passwordHashInvariant && 'password_hash_count_mismatch',
      users.duplicateEmailGroups > 0 && 'duplicate_email_groups',
      credentialsOnlyAuth && users.activePasswordNull > 0 && 'active_user_without_password',
      users.invitedManagerWithPassword > 0 && 'invited_manager_with_password',
      users.disabledManagerWithoutPassword > 0 && 'disabled_manager_without_password',
      users.invitedAdmin + users.invitedClient > 0 && 'invalid_invited_role',
      users.authVersionNull > 0 && 'auth_version_null',
      users.authVersionLessThanOne > 0 && 'auth_version_less_than_one',
      invitations.invitationWithoutUserCount > 0 && 'invitation_without_user',
      invitations.activeInvitationForInvalidRoleCount > 0 && 'active_invitation_invalid_role',
      invitations.activeInvitationForActiveUserCount > 0 && 'active_invitation_active_user',
      invitations.activeInvitationForDisabledUserCount > 0 && 'active_invitation_disabled_user',
      invitations.multipleActiveInvitationUserGroups > 0 && 'multiple_active_invitation_groups',
      !invitationStateInvariant && 'invitation_state_count_mismatch',
      sensitiveMetadataEntryCount > 0 && 'sensitive_audit_metadata'
    ].filter((reason): reason is string => Boolean(reason));

    console.log('Stage Admin Users 2D Audit');
    console.log('\nUsers:');
    console.log(`- total: ${users.total}`);
    console.log(`- active: ${users.active}`);
    console.log(`- invited: ${users.invited}`);
    console.log(`- disabled: ${users.disabled}`);
    console.log(`- staff total: ${users.staffTotal}`);
    console.log(`- staff active: ${users.staffActive}`);
    console.log(`- staff invited: ${users.staffInvited}`);
    console.log(`- staff disabled: ${users.staffDisabled}`);
    console.log(`- authVersion null: ${users.authVersionNull}`);
    console.log(`- authVersion < 1: ${users.authVersionLessThanOne}`);
    console.log(`- passwordHash null: ${users.passwordHashNull}`);
    console.log(`- passwordHash not null: ${users.passwordHashNotNull}`);
    console.log(`- active users without password: ${users.activePasswordNull}`);
    console.log(`- invalid invited role count: ${users.invitedAdmin + users.invitedClient}`);
    console.log(`- duplicate email groups: ${users.duplicateEmailGroups}`);
    console.log(`- user status invariant: ${userStatusInvariant}`);
    console.log(`- staff status invariant: ${staffStatusInvariant}`);
    console.log(`- passwordHash invariant: ${passwordHashInvariant}`);

    console.log('\nLifecycle/password readiness:');
    console.log(`- invited/password null: ${users.invitedPasswordNull}`);
    console.log(`- invited/password present: ${users.invitedPasswordNotNull}`);
    console.log(`- active/password null: ${users.activePasswordNull}`);
    console.log(`- active/password present: ${users.activePasswordNotNull}`);
    console.log(`- disabled/password null: ${users.disabledPasswordNull}`);
    console.log(`- disabled/password present: ${users.disabledPasswordNotNull}`);
    console.log(`- invited manager with password: ${users.invitedManagerWithPassword}`);
    console.log(`- disabled manager without password: ${users.disabledManagerWithoutPassword}`);

    console.log('\nInvitations:');
    console.log(`- total: ${invitations.total}`);
    console.log(`- active: ${invitations.active}`);
    console.log(`- expired unused: ${invitations.expiredUnused}`);
    console.log(`- used: ${invitations.used}`);
    console.log(`- revoked unused: ${invitations.revokedUnused}`);
    console.log(`- without user: ${invitations.invitationWithoutUserCount}`);
    console.log(`- non-manager owner: ${invitations.invitationForNonManagerCount}`);
    console.log(`- active for active user: ${invitations.activeInvitationForActiveUserCount}`);
    console.log(`- active for disabled user: ${invitations.activeInvitationForDisabledUserCount}`);
    console.log(`- active for invalid role: ${invitations.activeInvitationForInvalidRoleCount}`);
    console.log(`- multiple active user groups: ${invitations.multipleActiveInvitationUserGroups}`);
    console.log(`- state invariant: ${invitationStateInvariant}`);

    console.log('\nAuditLog:');
    for (const event of [
      'MANAGER_INVITATION_CREATED',
      'MANAGER_INVITATION_REGENERATED',
      'MANAGER_ACTIVATED',
      'MANAGER_DISABLED',
      'MANAGER_ENABLED'
    ]) {
      console.log(`- ${event}: ${auditEventCounts[event] ?? 0}`);
    }
    console.log(`- sensitive metadata records: ${sensitiveMetadataEntryCount}`);
    console.log(`- sensitive key categories: ${JSON.stringify([...sensitiveCategories].sort())}`);

    console.log(`\nhasBlocker: ${blockerReasons.length > 0}`);
    console.log(`blockerCategories: ${JSON.stringify(blockerReasons)}`);

    if (blockerReasons.length > 0) {
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
