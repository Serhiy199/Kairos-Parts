/**
 * READ-ONLY AUDIT: runs static SELECT queries and prints aggregate counts only.
 * No phone numbers, emails, tax identifiers, user IDs, hashes, or secrets are selected.
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
  Client: new (options: { connectionString: string; enableChannelBinding: boolean }) => PgClient;
};

function numberValue(row: QueryRow | undefined, key: string) {
  return Number(row?.[key] ?? 0);
}

function assertReadOnly(sql: string) {
  if (!/^\s*(SELECT|WITH)\b/i.test(sql)) {
    throw new Error('The audit rejected a non-read-only SQL statement.');
  }
}

async function select(client: PgClient, sql: string) {
  assertReadOnly(sql);
  return client.query(sql);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const client = new Client({ connectionString, enableChannelBinding: true });
  await client.connect();

  try {
    const phoneResult = await select(client, `
      WITH client_profiles AS (
        SELECT cp."userId", cp."phone"
        FROM "ClientProfile" cp
        JOIN "User" u ON u."id" = cp."userId" AND u."role" = 'CLIENT'
      ), profile_phones AS (
        SELECT
          "userId",
          "phone",
          regexp_replace(COALESCE("phone", ''), '[^0-9]', '', 'g') AS digits
        FROM client_profiles
      ), normalized_profile_phones AS (
        SELECT
          "userId",
          "phone",
          CASE
            WHEN length(digits) = 10 AND digits LIKE '0%' THEN '38' || digits
            WHEN length(digits) = 9 THEN '380' || digits
            ELSE digits
          END AS normalized
        FROM profile_phones
      ), normalized_user_record_phones AS (
        SELECT
          u."id" AS "userId",
          u."phone",
          CASE
            WHEN length(digits) = 10 AND digits LIKE '0%' THEN '38' || digits
            WHEN length(digits) = 9 THEN '380' || digits
            ELSE digits
          END AS normalized
        FROM (
          SELECT u.*, regexp_replace(COALESCE(u."phone", ''), '[^0-9]', '', 'g') AS digits
          FROM "User" u
          WHERE u."role" = 'CLIENT'
        ) u
      ), all_client_phone_sources AS (
        SELECT u."id" AS "userId", u."phone"
        FROM "User" u
        WHERE u."role" = 'CLIENT' AND NULLIF(btrim(u."phone"), '') IS NOT NULL
        UNION ALL
        SELECT cp."userId", cp."phone"
        FROM client_profiles cp
        WHERE NULLIF(btrim(cp."phone"), '') IS NOT NULL
      ), normalized_user_phones AS (
        SELECT DISTINCT
          "userId",
          CASE
            WHEN length(digits) = 10 AND digits LIKE '0%' THEN '38' || digits
            WHEN length(digits) = 9 THEN '380' || digits
            ELSE digits
          END AS normalized
        FROM (
          SELECT "userId", regexp_replace("phone", '[^0-9]', '', 'g') AS digits
          FROM all_client_phone_sources
        ) source
      )
      SELECT
        (SELECT COUNT(*) FROM "User" WHERE "role" = 'CLIENT')::text AS total_client_users,
        (SELECT COUNT(*) FROM normalized_user_record_phones WHERE NULLIF(btrim("phone"), '') IS NOT NULL)::text AS client_users_with_phone,
        (SELECT COUNT(*) FROM normalized_user_record_phones WHERE NULLIF(btrim("phone"), '') IS NULL)::text AS client_users_without_phone,
        (SELECT COUNT(*) FROM client_profiles)::text AS total_client_profiles,
        (SELECT COUNT(*) FROM client_profiles WHERE NULLIF(btrim("phone"), '') IS NOT NULL)::text AS profiles_with_phone,
        (SELECT COUNT(*) FROM client_profiles WHERE NULLIF(btrim("phone"), '') IS NULL)::text AS profiles_without_phone,
        (SELECT COUNT(*) FROM client_profiles WHERE "phone" IS NULL)::text AS profile_phone_null,
        (SELECT COUNT(*) FROM client_profiles WHERE "phone" IS NOT NULL AND btrim("phone") = '')::text AS profile_phone_empty,
        (SELECT COUNT(DISTINCT "phone") FROM client_profiles WHERE NULLIF(btrim("phone"), '') IS NOT NULL)::text AS distinct_raw_profile_phones,
        (SELECT COUNT(*) FROM (
          SELECT "phone" FROM client_profiles
          WHERE NULLIF(btrim("phone"), '') IS NOT NULL
          GROUP BY "phone" HAVING COUNT(*) > 1
        ) duplicate_raw)::text AS duplicate_raw_groups,
        (SELECT COUNT(*) FROM (
          SELECT normalized FROM normalized_profile_phones
          WHERE normalized <> ''
          GROUP BY normalized HAVING COUNT(*) > 1
        ) duplicate_normalized)::text AS duplicate_normalized_groups,
        (SELECT COUNT(*) FROM normalized_profile_phones
          WHERE normalized <> '' AND normalized !~ '^380[0-9]{9}$')::text AS invalid_profile_phone_format,
        (SELECT COUNT(*) FROM "ClientProfile" cp
          LEFT JOIN "User" u ON u."id" = cp."userId"
          WHERE u."id" IS NULL)::text AS profiles_without_user,
        (SELECT COUNT(*)
          FROM normalized_profile_phones cp
          JOIN normalized_user_record_phones u ON u."userId" = cp."userId"
          WHERE cp.normalized <> '' AND cp.normalized <> u.normalized)::text AS profile_phones_not_matching_user_phone,
        (SELECT COUNT(*) FROM (
          SELECT normalized FROM normalized_user_phones
          WHERE normalized <> ''
          GROUP BY normalized HAVING COUNT(DISTINCT "userId") > 1
        ) multi_user_phone_groups)::text AS normalized_phone_multi_user_groups,
        (SELECT COUNT(*) FROM normalized_profile_phones WHERE "phone" LIKE '+%')::text AS format_plus_prefix,
        (SELECT COUNT(*) FROM normalized_profile_phones WHERE "phone" ~ '^380[0-9]+$')::text AS format_380_digits,
        (SELECT COUNT(*) FROM normalized_profile_phones WHERE "phone" ~ '^0[0-9]{9}$')::text AS format_local_digits,
        (SELECT COUNT(*) FROM normalized_profile_phones
          WHERE NULLIF(btrim("phone"), '') IS NOT NULL AND "phone" ~ '[^0-9+]')::text AS format_decorated
    `);

    const taxResult = await select(client, `
      WITH company_identifiers AS (
        SELECT
          c."id" AS "companyId",
          c."edrpou" AS raw,
          regexp_replace(COALESCE(c."edrpou", ''), '[^0-9]', '', 'g') AS normalized
        FROM "Company" c
      ), company_member_counts AS (
        SELECT ci."companyId", ci.normalized, COUNT(cm."id") AS member_count
        FROM company_identifiers ci
        LEFT JOIN "CompanyMember" cm ON cm."companyId" = ci."companyId"
        WHERE NULLIF(btrim(ci.raw), '') IS NOT NULL
        GROUP BY ci."companyId", ci.normalized
      ), eligible_company_users AS (
        SELECT DISTINCT
          ci.normalized,
          u."id" AS "userId"
        FROM company_identifiers ci
        JOIN "CompanyMember" cm ON cm."companyId" = ci."companyId"
        JOIN "User" u ON u."id" = cm."userId"
        WHERE ci.normalized <> ''
          AND u."role" = 'CLIENT'
          AND u."status" = 'ACTIVE'
          AND u."passwordHash" IS NOT NULL
      ), personal_tax_sources AS (
        SELECT cp."userId", cp."taxId" AS raw, 'PROFILE' AS source
        FROM "ClientProfile" cp
        WHERE NULLIF(btrim(cp."taxId"), '') IS NOT NULL
        UNION ALL
        SELECT cp."userId", cbd."edrpou" AS raw, 'CLIENT_BILLING_EDRPOU' AS source
        FROM "ClientBillingDetails" cbd
        JOIN "ClientProfile" cp ON cp."id" = cbd."clientProfileId"
        WHERE NULLIF(btrim(cbd."edrpou"), '') IS NOT NULL
        UNION ALL
        SELECT cp."userId", cbd."ipn" AS raw, 'CLIENT_BILLING_IPN' AS source
        FROM "ClientBillingDetails" cbd
        JOIN "ClientProfile" cp ON cp."id" = cbd."clientProfileId"
        WHERE NULLIF(btrim(cbd."ipn"), '') IS NOT NULL
      ), normalized_personal_tax AS (
        SELECT DISTINCT "userId", source, regexp_replace(raw, '[^0-9]', '', 'g') AS normalized
        FROM personal_tax_sources
      ), all_tax_user_candidates AS (
        SELECT normalized, "userId" FROM eligible_company_users
        UNION
        SELECT npt.normalized, npt."userId"
        FROM normalized_personal_tax npt
        JOIN "User" u ON u."id" = npt."userId"
        WHERE npt.normalized <> ''
          AND u."role" = 'CLIENT'
          AND u."status" = 'ACTIVE'
          AND u."passwordHash" IS NOT NULL
      ), tax_mapping_sizes AS (
        SELECT normalized, COUNT(DISTINCT "userId") AS user_count
        FROM all_tax_user_candidates
        GROUP BY normalized
      )
      SELECT
        (SELECT COUNT(*) FROM "Company")::text AS companies_total,
        (SELECT COUNT(*) FROM company_identifiers WHERE NULLIF(btrim(raw), '') IS NOT NULL)::text AS companies_with_identifier,
        (SELECT COUNT(*) FROM company_identifiers WHERE NULLIF(btrim(raw), '') IS NULL)::text AS companies_without_identifier,
        (SELECT COUNT(DISTINCT raw) FROM company_identifiers WHERE NULLIF(btrim(raw), '') IS NOT NULL)::text AS distinct_raw_company_identifiers,
        (SELECT COUNT(*) FROM (
          SELECT raw FROM company_identifiers
          WHERE NULLIF(btrim(raw), '') IS NOT NULL
          GROUP BY raw HAVING COUNT(*) > 1
        ) duplicate_raw)::text AS duplicate_raw_company_identifier_groups,
        (SELECT COUNT(*) FROM (
          SELECT normalized FROM company_identifiers
          WHERE normalized <> ''
          GROUP BY normalized HAVING COUNT(*) > 1
        ) duplicate_normalized)::text AS duplicate_normalized_company_identifier_groups,
        (SELECT COUNT(*) FROM company_identifiers
          WHERE normalized <> '' AND normalized !~ '^[0-9]{8}$')::text AS invalid_company_identifier_format,
        (SELECT COUNT(*) FROM company_member_counts WHERE member_count = 0)::text AS identifiers_with_zero_members,
        (SELECT COUNT(*) FROM company_member_counts WHERE member_count = 1)::text AS identifiers_with_one_member,
        (SELECT COUNT(*) FROM company_member_counts WHERE member_count > 1)::text AS identifiers_with_multiple_members,
        (SELECT COUNT(*) FROM (
          SELECT normalized FROM eligible_company_users
          GROUP BY normalized HAVING COUNT(DISTINCT "userId") > 1
        ) ambiguous_company_identifier_groups)::text AS identifiers_with_multiple_eligible_login_users,
        (SELECT COUNT(*) FROM "ClientProfile" WHERE NULLIF(btrim("taxId"), '') IS NOT NULL)::text AS client_profiles_with_tax_id,
        (SELECT COUNT(*) FROM "ClientBillingDetails" WHERE NULLIF(btrim("edrpou"), '') IS NOT NULL)::text AS client_billing_with_edrpou,
        (SELECT COUNT(*) FROM "ClientBillingDetails" WHERE NULLIF(btrim("ipn"), '') IS NOT NULL)::text AS client_billing_with_ipn,
        (SELECT COUNT(*) FROM normalized_personal_tax
          WHERE source = 'PROFILE' AND normalized !~ '^([0-9]{8}|[0-9]{10})$')::text AS invalid_profile_tax_format,
        (SELECT COUNT(*) FROM normalized_personal_tax
          WHERE source = 'CLIENT_BILLING_EDRPOU' AND normalized !~ '^[0-9]{8}$')::text AS invalid_client_billing_edrpou,
        (SELECT COUNT(*) FROM normalized_personal_tax
          WHERE source = 'CLIENT_BILLING_IPN' AND normalized !~ '^[0-9]{10}$')::text AS invalid_client_billing_ipn,
        (SELECT COUNT(*) FROM tax_mapping_sizes WHERE user_count > 1)::text AS ambiguous_tax_identifier_groups,
        (SELECT COUNT(DISTINCT atc."userId")
          FROM all_tax_user_candidates atc
          JOIN tax_mapping_sizes tms ON tms.normalized = atc.normalized
          WHERE tms.user_count <> 1)::text AS users_with_ambiguous_tax_mapping,
        (SELECT COUNT(*) FROM "CompanyMember" WHERE "isPrimaryContact" = true)::text AS primary_contact_members,
        (SELECT COUNT(*) FROM (
          SELECT "companyId" FROM "CompanyMember"
          WHERE "isPrimaryContact" = true
          GROUP BY "companyId" HAVING COUNT(*) > 1
        ) multiple_primary)::text AS companies_with_multiple_primary_contacts
    `);

    const accountResult = await select(client, `
      SELECT
        COUNT(*) FILTER (WHERE "role" = 'CLIENT' AND "status" = 'ACTIVE' AND "passwordHash" IS NOT NULL)::text AS eligible_clients,
        COUNT(*) FILTER (WHERE "role" = 'CLIENT' AND "status" = 'ACTIVE' AND "passwordHash" IS NULL)::text AS active_clients_without_password,
        COUNT(*) FILTER (WHERE "role" = 'CLIENT' AND "status" <> 'ACTIVE')::text AS inactive_clients,
        COUNT(*) FILTER (WHERE "role" IN ('ADMIN', 'MANAGER') AND NULLIF(btrim("phone"), '') IS NOT NULL)::text AS staff_with_phone
      FROM "User"
    `);

    const phone = phoneResult.rows[0] ?? {};
    const tax = taxResult.rows[0] ?? {};
    const accounts = accountResult.rows[0] ?? {};

    console.log('Stage Client Auth 1 aggregate audit');
    console.log('\nPhone:');
    for (const [label, key] of [
      ['total CLIENT users', 'total_client_users'],
      ['CLIENT users with phone', 'client_users_with_phone'],
      ['CLIENT users without phone', 'client_users_without_phone'],
      ['total CLIENT profiles', 'total_client_profiles'],
      ['CLIENT profiles with phone', 'profiles_with_phone'],
      ['CLIENT profiles without phone', 'profiles_without_phone'],
      ['profile phone null', 'profile_phone_null'],
      ['profile phone empty', 'profile_phone_empty'],
      ['distinct raw profile phones', 'distinct_raw_profile_phones'],
      ['duplicate raw phone groups', 'duplicate_raw_groups'],
      ['duplicate normalized phone groups', 'duplicate_normalized_groups'],
      ['invalid normalized phone format', 'invalid_profile_phone_format'],
      ['profiles without matching User', 'profiles_without_user'],
      ['profile phones not matching User.phone', 'profile_phones_not_matching_user_phone'],
      ['normalized phone groups linked to multiple Users', 'normalized_phone_multi_user_groups'],
      ['format + prefix', 'format_plus_prefix'],
      ['format 380 digits', 'format_380_digits'],
      ['format local digits', 'format_local_digits'],
      ['format decorated', 'format_decorated']
    ] as const) {
      console.log(`- ${label}: ${numberValue(phone, key)}`);
    }

    console.log('\nTax identifiers:');
    for (const [label, key] of [
      ['companies total', 'companies_total'],
      ['companies with identifier', 'companies_with_identifier'],
      ['companies without identifier', 'companies_without_identifier'],
      ['distinct raw company identifiers', 'distinct_raw_company_identifiers'],
      ['duplicate raw company identifier groups', 'duplicate_raw_company_identifier_groups'],
      ['duplicate normalized company identifier groups', 'duplicate_normalized_company_identifier_groups'],
      ['invalid company identifier format', 'invalid_company_identifier_format'],
      ['company identifiers with 0 members', 'identifiers_with_zero_members'],
      ['company identifiers with 1 member', 'identifiers_with_one_member'],
      ['company identifiers with >1 member', 'identifiers_with_multiple_members'],
      ['company identifiers with multiple eligible login users', 'identifiers_with_multiple_eligible_login_users'],
      ['ClientProfile taxId present', 'client_profiles_with_tax_id'],
      ['ClientBillingDetails edrpou present', 'client_billing_with_edrpou'],
      ['ClientBillingDetails ipn present', 'client_billing_with_ipn'],
      ['invalid ClientProfile taxId format', 'invalid_profile_tax_format'],
      ['invalid ClientBillingDetails edrpou', 'invalid_client_billing_edrpou'],
      ['invalid ClientBillingDetails ipn', 'invalid_client_billing_ipn'],
      ['ambiguous tax identifier groups', 'ambiguous_tax_identifier_groups'],
      ['users with ambiguous tax mapping', 'users_with_ambiguous_tax_mapping'],
      ['primary contact members', 'primary_contact_members'],
      ['companies with multiple primary contacts', 'companies_with_multiple_primary_contacts']
    ] as const) {
      console.log(`- ${label}: ${numberValue(tax, key)}`);
    }

    console.log('\nAccount eligibility:');
    for (const [label, key] of [
      ['eligible ACTIVE CLIENT users with password', 'eligible_clients'],
      ['ACTIVE CLIENT users without password', 'active_clients_without_password'],
      ['non-ACTIVE CLIENT users', 'inactive_clients'],
      ['staff users with phone', 'staff_with_phone']
    ] as const) {
      console.log(`- ${label}: ${numberValue(accounts, key)}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Client login identifier audit failed.');
  process.exitCode = 1;
});
