import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  BootstrapRefusedError,
  bootstrapProductionAdmin,
  readBootstrapConfig,
  type BootstrapDatabase,
  type BootstrapEnvironment,
  type BootstrapTransaction
} from './bootstrap-production-admin';

const validEnvironment: BootstrapEnvironment = {
  NODE_ENV: 'production',
  APP_BASE_URL: 'https://kairos-parts.com.ua',
  DATABASE_URL: 'postgresql://bootstrap-check:unused@127.0.0.1:5432/kairos_parts',
  BOOTSTRAP_ADMIN_EMAIL: ' First.Admin@Example.COM ',
  BOOTSTRAP_ADMIN_NAME: ' Перший   Адміністратор ',
  BOOTSTRAP_ADMIN_PASSWORD: 'local-check-only',
  CONFIRM_PRODUCTION_ADMIN_BOOTSTRAP: 'CREATE_FIRST_ADMIN',
  BOOTSTRAP_DRY_RUN: 'true'
};

type MockOptions = {
  admins?: Awaited<ReturnType<BootstrapTransaction['user']['findMany']>>;
  emailAccount?: Awaited<ReturnType<BootstrapTransaction['user']['findFirst']>>;
};

function mockDatabase(options: MockOptions = {}) {
  const writes: unknown[] = [];
  let transactions = 0;
  const database: BootstrapDatabase = {
    async $transaction(callback) {
      transactions += 1;
      const tx: BootstrapTransaction = {
        user: {
          async findMany() {
            return options.admins ?? [];
          },
          async findFirst() {
            return options.emailAccount ?? null;
          },
          async create(args) {
            writes.push(args);
            return {
              id: 'bootstrap-user-id',
              email: 'first.admin@example.com',
              role: 'ADMIN',
              status: 'ACTIVE',
              managerProfile: { id: 'bootstrap-profile-id' }
            };
          }
        }
      };
      return callback(tx);
    }
  };

  return {
    database,
    writes,
    transactionCount: () => transactions
  };
}

async function expectRefusal(
  overrides: Partial<BootstrapEnvironment>,
  expected: RegExp,
  database = mockDatabase().database
) {
  await assert.rejects(
    bootstrapProductionAdmin({
      env: { ...validEnvironment, ...overrides },
      database,
      hash: async () => 'check-hash'
    }),
    (error: unknown) => error instanceof BootstrapRefusedError && expected.test(error.message)
  );
}

async function main() {
  await expectRefusal(
    { CONFIRM_PRODUCTION_ADMIN_BOOTSTRAP: undefined },
    /CREATE_FIRST_ADMIN/
  );
  await expectRefusal({ NODE_ENV: 'development' }, /NODE_ENV/);
  await expectRefusal({ BOOTSTRAP_ADMIN_EMAIL: undefined }, /BOOTSTRAP_ADMIN_EMAIL/);
  await expectRefusal({ BOOTSTRAP_ADMIN_NAME: undefined }, /BOOTSTRAP_ADMIN_NAME/);
  await expectRefusal({ BOOTSTRAP_ADMIN_PASSWORD: undefined }, /BOOTSTRAP_ADMIN_PASSWORD/);
  await expectRefusal({ APP_BASE_URL: 'https://example.com' }, /APP_BASE_URL/);
  await expectRefusal({ DATABASE_URL: 'not-a-url' }, /DATABASE_URL/);

  const existingAdmin = mockDatabase({
    admins: [{ id: 'existing-admin', status: 'ACTIVE', managerProfile: { id: 'existing-profile' } }]
  });
  await expectRefusal({}, /already exists/, existingAdmin.database);
  assert.equal(existingAdmin.writes.length, 0);

  const partialAdmin = mockDatabase({
    admins: [{ id: 'partial-admin', status: 'DISABLED', managerProfile: null }]
  });
  await expectRefusal({}, /partially configured/, partialAdmin.database);
  assert.equal(partialAdmin.writes.length, 0);

  for (const role of ['CLIENT', 'MANAGER'] as const) {
    const collision = mockDatabase({
      emailAccount: {
        id: `${role.toLowerCase()}-id`,
        role,
        status: 'ACTIVE',
        managerProfile: role === 'MANAGER' ? { id: 'manager-profile-id' } : null
      }
    });
    await expectRefusal({}, /already assigned/, collision.database);
    assert.equal(collision.writes.length, 0);
  }

  const dryRun = mockDatabase();
  let dryRunHashCalls = 0;
  const dryRunResult = await bootstrapProductionAdmin({
    env: validEnvironment,
    database: dryRun.database,
    hash: async () => {
      dryRunHashCalls += 1;
      return 'unused-hash';
    }
  });
  assert.equal(dryRunResult.mode, 'dry-run');
  assert.equal(dryRun.writes.length, 0);
  assert.equal(dryRunHashCalls, 0);
  assert.equal(dryRun.transactionCount(), 1);

  const success = mockDatabase();
  let successHashCalls = 0;
  const successResult = await bootstrapProductionAdmin({
    env: { ...validEnvironment, BOOTSTRAP_DRY_RUN: 'false' },
    database: success.database,
    hash: async (password) => {
      successHashCalls += 1;
      assert.equal(password, validEnvironment.BOOTSTRAP_ADMIN_PASSWORD);
      return 'scrypt:check-salt:check-derived-key';
    }
  });
  assert.equal(successResult.mode, 'created');
  assert.equal(successHashCalls, 1);
  assert.equal(success.writes.length, 1);

  const createInput = success.writes[0] as {
    data: {
      role: string;
      status: string;
      authVersion: number;
      email: string;
      name: string;
      passwordHash: string;
      managerProfile?: { create?: { displayName?: string } };
      clientProfile?: unknown;
    };
  };
  assert.equal(createInput.data.role, 'ADMIN');
  assert.equal(createInput.data.status, 'ACTIVE');
  assert.equal(createInput.data.authVersion, 1);
  assert.equal(createInput.data.email, 'first.admin@example.com');
  assert.equal(createInput.data.name, 'Перший Адміністратор');
  assert.equal(createInput.data.passwordHash, 'scrypt:check-salt:check-derived-key');
  assert.deepEqual(createInput.data.managerProfile, {
    create: { displayName: 'Перший Адміністратор' }
  });
  assert.equal(createInput.data.clientProfile, undefined);

  const parsed = readBootstrapConfig(validEnvironment);
  assert.equal(parsed.email, 'first.admin@example.com');
  assert.equal(parsed.name, 'Перший Адміністратор');

  const bootstrapSource = await readFile('scripts/bootstrap-production-admin.ts', 'utf8');
  assert.match(bootstrapSource, /import \{ hashPassword \} from '\.\.\/lib\/auth\/password'/);
  assert.doesNotMatch(bootstrapSource, /Test123456|admin@test\.com|ALLOW_DEV_SEED|prisma db seed/);
  assert.doesNotMatch(bootstrapSource, /BOOTSTRAP_ADMIN_PASSWORD\s*=\s*['"][^'"]+/);
  assert.doesNotMatch(bootstrapSource, /clientProfile\s*:\s*\{\s*create/);

  console.log('Production ADMIN bootstrap safety checks passed.');
}

void main();
