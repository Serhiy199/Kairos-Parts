/** READ-ONLY protected audit. Inputs come from environment; no identifier, id, or hash is printed. */
import { createRequire } from 'node:module';
import { config } from 'dotenv';

import { verifyPassword } from '@/lib/auth/password';
import { normalizeUkrainianPhone } from '@/lib/phone/normalize';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

type AuditRow = {
  authVersion: number;
  passwordHash: string | null;
  role: string;
  status: string;
};
type PgClient = {
  connect(): Promise<void>;
  query(sql: string, values: unknown[]): Promise<{ rows: AuditRow[] }>;
  end(): Promise<void>;
};

const { Client } = createRequire(import.meta.url)('pg') as {
  Client: new (options: { connectionString: string; enableChannelBinding: boolean }) => PgClient;
};

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const normalizedPhone = normalizeUkrainianPhone(process.env.KAIROS_AUTH_TEST_PHONE);
  const password = process.env.KAIROS_AUTH_TEST_PASSWORD;

  if (!connectionString) throw new Error('DATABASE_URL is not configured.');
  if (!normalizedPhone) throw new Error('KAIROS_AUTH_TEST_PHONE is missing or invalid.');

  const client = new Client({ connectionString, enableChannelBinding: true });
  await client.connect();

  try {
    const result = await client.query(
      `SELECT "role", "status", "authVersion", "passwordHash"
       FROM "User"
       WHERE "normalizedPhone" = $1`,
      [normalizedPhone]
    );
    const user = result.rows.length === 1 ? result.rows[0] : null;

    console.log(`exactMatchCount=${result.rows.length}`);
    console.log(`roleClient=${user?.role === 'CLIENT'}`);
    console.log(`statusActive=${user?.status === 'ACTIVE'}`);
    console.log(`passwordPresent=${Boolean(user?.passwordHash)}`);
    console.log(`authVersionValid=${Number.isInteger(user?.authVersion) && Number(user?.authVersion) >= 1}`);

    if (password) {
      const passwordMatches = user?.passwordHash
        ? await verifyPassword(password, user.passwordHash)
        : false;
      console.log(`passwordMatches=${passwordMatches}`);
    } else {
      console.log('passwordMatches=NOT_RUN');
    }

    if (
      !user
      || user.role !== 'CLIENT'
      || user.status !== 'ACTIVE'
      || !user.passwordHash
      || !Number.isInteger(user.authVersion)
      || user.authVersion < 1
    ) {
      throw new Error('Protected test account audit found a blocker.');
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Protected test account audit failed.');
  process.exitCode = 1;
});
