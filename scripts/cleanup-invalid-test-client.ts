/**
 * Guarded one-account cleanup utility.
 * Selectors are supplied through process environment and are never printed.
 */
import { createRequire } from 'node:module';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });

type Row = Record<string, unknown>;
type QueryResult = { rows: Row[]; rowCount: number | null };
type PgClient = {
  connect(): Promise<void>;
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
  end(): Promise<void>;
};

const { Client } = createRequire(import.meta.url)('pg') as {
  Client: new (options: { connectionString: string }) => PgClient;
};

const execute = process.argv.includes('--execute');
const confirmed = process.argv.includes('--confirm=DELETE_INVALID_TEST_CLIENT');

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required protected selector: ${name}`);
  return value;
}

function count(row: Row | undefined, key: string) {
  return Number(row?.[key] ?? 0);
}

async function loadTarget(client: PgClient, selectors: { email: string; phone: string; name: string }) {
  return client.query(
    `SELECT u."id" AS "userId", cp."id" AS "clientProfileId", cp."telegramUserId"
     FROM "User" u
     LEFT JOIN "ClientProfile" cp ON cp."userId" = u."id"
     WHERE u."role" = 'CLIENT'
       AND lower(u."email") = lower($1)
       AND u."phone" = $2
       AND u."name" = $3`,
    [selectors.email, selectors.phone, selectors.name]
  );
}

async function loadCounts(client: PgClient, target: Row, selectors: { email: string; phone: string; name: string }) {
  const userId = String(target.userId);
  const clientProfileId = target.clientProfileId ? String(target.clientProfileId) : null;
  const telegramUserId = target.telegramUserId ? String(target.telegramUserId) : null;

  const result = await client.query(
    `SELECT
      (SELECT COUNT(*) FROM "Account" WHERE "userId" = $1)::text AS accounts,
      (SELECT COUNT(*) FROM "Session" WHERE "userId" = $1)::text AS sessions,
      (SELECT COUNT(*) FROM "CompanyMember" WHERE "userId" = $1)::text AS company_members,
      (SELECT COUNT(*) FROM "ChangeRequest" WHERE "requestedById" = $1)::text AS requested_changes,
      (SELECT COUNT(*) FROM "ChangeRequest" WHERE "reviewedById" = $1)::text AS reviewed_changes,
      (SELECT COUNT(*) FROM "AuditLog" WHERE "actorId" = $1)::text AS audit_logs,
      (SELECT COUNT(*) FROM "Notification" WHERE "userId" = $1)::text AS notifications,
      (SELECT COUNT(*) FROM "Invoice" WHERE "clientId" = $1)::text AS client_invoices,
      (SELECT COUNT(*) FROM "Invoice" WHERE "createdById" = $1)::text AS created_invoices,
      (SELECT COUNT(*) FROM "Request" WHERE "assignedManagerId" = $1)::text AS assigned_requests,
      (SELECT COUNT(*) FROM "RequestStatusHistory" WHERE "changedByUserId" = $1)::text AS status_changes,
      (SELECT COUNT(*) FROM "RequestComment" WHERE "authorId" = $1)::text AS comments,
      (SELECT COUNT(*) FROM "RequestDocument" WHERE "uploadedById" = $1)::text AS uploaded_request_documents,
      (SELECT COUNT(*) FROM "Document" WHERE "uploadedById" = $1)::text AS uploaded_owner_documents,
      (SELECT COUNT(*) FROM "CommercialOffer" WHERE "createdById" = $1)::text AS created_offers,
      (SELECT COUNT(*) FROM "Vehicle" WHERE "archivedById" = $1)::text AS archived_vehicles,
      (SELECT COUNT(*) FROM "UsedEquipment" WHERE "createdById" = $1)::text AS used_equipment_created,
      (SELECT COUNT(*) FROM "UsedEquipment" WHERE "updatedById" = $1)::text AS used_equipment_updated,
      (SELECT COUNT(*) FROM "UsedEquipmentInquiry" WHERE "assignedManagerId" = $1)::text AS assigned_inquiries,
      (SELECT COUNT(*) FROM "ManagerInvitation" WHERE "userId" = $1)::text AS owned_invitations,
      (SELECT COUNT(*) FROM "ManagerInvitation" WHERE "createdById" = $1)::text AS created_invitations,
      (SELECT COUNT(*) FROM "Request" WHERE "clientId" = $2)::text AS owned_requests,
      (SELECT COUNT(*) FROM "Vehicle" WHERE "clientId" = $2)::text AS owned_vehicles,
      (SELECT COUNT(*) FROM "Document" WHERE "clientId" = $2)::text AS owned_documents,
      (SELECT COUNT(*) FROM "ClientBillingDetails" WHERE "clientProfileId" = $2)::text AS billing_details,
      (SELECT COUNT(*) FROM "RequestFile" rf JOIN "Request" r ON r."id" = rf."requestId" WHERE r."clientId" = $2)::text AS request_files,
      (SELECT COUNT(*) FROM "RequestDocument" rd JOIN "Request" r ON r."id" = rd."requestId" WHERE r."clientId" = $2)::text AS request_document_assets,
      (SELECT COUNT(*) FROM "VehicleImage" vi JOIN "Vehicle" v ON v."id" = vi."vehicleId" WHERE v."clientId" = $2)::text AS vehicle_images,
      (SELECT COUNT(*) FROM "Document" d WHERE d."clientId" = $2 OR d."vehicleId" IN (SELECT "id" FROM "Vehicle" WHERE "clientId" = $2))::text AS document_assets,
      (SELECT COUNT(*) FROM "TelegramDraftRequest" WHERE $3::text IS NOT NULL AND "telegramUserId" = $3)::text AS telegram_drafts,
      (SELECT COUNT(*) FROM "ContactMessage" WHERE lower(COALESCE("email", '')) = lower($4) OR "phone" = $5)::text AS contact_messages,
      (SELECT COUNT(*) FROM "UsedEquipmentInquiry" WHERE "phone" = $5 AND "name" = $6)::text AS equipment_inquiries,
      (SELECT COUNT(*) FROM "VerificationToken" WHERE lower("identifier") = lower($4))::text AS verification_tokens`,
    [userId, clientProfileId, telegramUserId, selectors.email, selectors.phone, selectors.name]
  );

  return result.rows[0] ?? {};
}

function printCounts(targetCount: number, counts: Row | null) {
  console.log(`targetUserCount=${targetCount}`);
  if (!counts) return;

  for (const key of Object.keys(counts).sort()) {
    console.log(`${key}=${count(counts, key)}`);
  }

  const externalAssets = ['request_files', 'request_document_assets', 'vehicle_images', 'document_assets']
    .reduce((sum, key) => sum + count(counts, key), 0);
  console.log(`external_asset_rows=${externalAssets}`);
}

async function main() {
  const connectionString = requiredEnv('DATABASE_URL');
  const selectors = {
    email: requiredEnv('CLEANUP_TARGET_EMAIL'),
    phone: requiredEnv('CLEANUP_TARGET_PHONE'),
    name: requiredEnv('CLEANUP_TARGET_NAME')
  };
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const targetResult = await loadTarget(client, selectors);
    if (targetResult.rows.length !== 1) {
      console.log(execute ? 'mode=execute' : 'mode=dry-run');
      printCounts(targetResult.rows.length, null);
      if (!execute && targetResult.rows.length === 0) return;
      throw new Error('Cleanup stopped: exact target count must equal one.');
    }

    const target = targetResult.rows[0];
    const before = await loadCounts(client, target, selectors);
    console.log(execute ? 'mode=execute' : 'mode=dry-run');
    printCounts(1, before);

    if (!execute) return;
    if (!confirmed) throw new Error('Cleanup stopped: confirmation phrase is missing.');

    const externalAssetRows = ['request_files', 'request_document_assets', 'vehicle_images', 'document_assets']
      .reduce((sum, key) => sum + count(before, key), 0);
    if (externalAssetRows > 0) {
      throw new Error('Cleanup stopped: external assets require controlled storage cleanup first.');
    }
    if (count(before, 'used_equipment_created') > 0 || count(before, 'created_invitations') > 0) {
      throw new Error('Cleanup stopped: shared/restricted staff-owned records were found.');
    }

    const userId = String(target.userId);
    const clientProfileId = target.clientProfileId ? String(target.clientProfileId) : null;
    const telegramUserId = target.telegramUserId ? String(target.telegramUserId) : null;

    await client.query('BEGIN');
    try {
      if (telegramUserId) {
        await client.query('DELETE FROM "TelegramDraftRequest" WHERE "telegramUserId" = $1', [telegramUserId]);
      }
      await client.query('DELETE FROM "ContactMessage" WHERE lower(COALESCE("email", \'\')) = lower($1) OR "phone" = $2', [selectors.email, selectors.phone]);
      await client.query('DELETE FROM "UsedEquipmentInquiry" WHERE "phone" = $1 AND "name" = $2', [selectors.phone, selectors.name]);
      await client.query('DELETE FROM "VerificationToken" WHERE lower("identifier") = lower($1)', [selectors.email]);
      await client.query('DELETE FROM "Notification" WHERE "userId" = $1', [userId]);
      await client.query('DELETE FROM "AuditLog" WHERE "actorId" = $1 AND "entityType" = \'USER\' AND "entityId" = $1', [userId]);
      if (clientProfileId) {
        await client.query('DELETE FROM "Document" WHERE "clientId" = $1', [clientProfileId]);
        await client.query('DELETE FROM "Request" WHERE "clientId" = $1', [clientProfileId]);
        await client.query('DELETE FROM "Vehicle" WHERE "clientId" = $1', [clientProfileId]);
      }
      const deleted = await client.query('DELETE FROM "User" WHERE "id" = $1', [userId]);
      if (deleted.rowCount !== 1) throw new Error('Cleanup stopped: target User delete count was not one.');
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    const after = await loadTarget(client, selectors);
    console.log('postDeleteVerification=true');
    printCounts(after.rows.length, null);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Cleanup failed.');
  process.exitCode = 1;
});
