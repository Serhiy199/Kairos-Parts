import { pathToFileURL } from 'node:url';

import type { Prisma } from '@prisma/client';

import { hashPassword } from '../lib/auth/password';
import {
  isValidManagerEmail,
  isValidManagerName,
  isValidManagerPassword,
  normalizeManagerEmail,
  normalizeManagerName
} from '../lib/users/manager-invitation-rules';

const PRODUCTION_ORIGIN = 'https://kairos-parts.com.ua';
const REQUIRED_CONFIRMATION = 'CREATE_FIRST_ADMIN';

export type BootstrapEnvironment = Record<string, string | undefined>;

type ExistingAdmin = {
  id: string;
  status: 'INVITED' | 'ACTIVE' | 'DISABLED';
  managerProfile: { id: string } | null;
};

type ExistingEmailAccount = {
  id: string;
  role: 'GUEST' | 'CLIENT' | 'MANAGER' | 'ADMIN';
  status: 'INVITED' | 'ACTIVE' | 'DISABLED';
  managerProfile: { id: string } | null;
};

type CreatedAdmin = {
  id: string;
  email: string | null;
  role: 'ADMIN';
  status: 'ACTIVE';
  managerProfile: { id: string } | null;
};

export type BootstrapTransaction = {
  user: {
    findMany(args: unknown): Promise<ExistingAdmin[]>;
    findFirst(args: unknown): Promise<ExistingEmailAccount | null>;
    create(args: unknown): Promise<CreatedAdmin>;
  };
};

export type BootstrapDatabase = {
  $transaction<T>(
    callback: (tx: BootstrapTransaction) => Promise<T>,
    options: { isolationLevel: Prisma.TransactionIsolationLevel }
  ): Promise<T>;
};

export type BootstrapResult =
  | {
      mode: 'dry-run';
      email: string;
      role: 'ADMIN';
      status: 'ACTIVE';
      managerProfile: 'would-create';
    }
  | {
      mode: 'created';
      userId: string;
      email: string;
      role: 'ADMIN';
      status: 'ACTIVE';
      managerProfile: 'created';
    };

export class BootstrapRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BootstrapRefusedError';
  }
}

function requireValue(env: BootstrapEnvironment, key: string) {
  const value = env[key]?.trim();
  if (!value) {
    throw new BootstrapRefusedError(`${key} is required. Bootstrap refused.`);
  }
  return value;
}

function validateProductionOrigin(env: BootstrapEnvironment) {
  const appBaseUrl = env.APP_BASE_URL?.trim();
  const nextAuthUrl = env.NEXTAUTH_URL?.trim();
  if (appBaseUrl !== PRODUCTION_ORIGIN && nextAuthUrl !== PRODUCTION_ORIGIN) {
    throw new BootstrapRefusedError(
      `APP_BASE_URL or NEXTAUTH_URL must exactly match ${PRODUCTION_ORIGIN}. Bootstrap refused.`
    );
  }
}

function validateDatabaseUrl(value: string) {
  let databaseUrl: URL;
  try {
    databaseUrl = new URL(value);
  } catch {
    throw new BootstrapRefusedError('DATABASE_URL is invalid. Bootstrap refused.');
  }

  if (databaseUrl.protocol !== 'postgresql:' && databaseUrl.protocol !== 'postgres:') {
    throw new BootstrapRefusedError('DATABASE_URL must use PostgreSQL. Bootstrap refused.');
  }

  if (!databaseUrl.hostname) {
    throw new BootstrapRefusedError('DATABASE_URL must include a database host. Bootstrap refused.');
  }
}

export function readBootstrapConfig(env: BootstrapEnvironment) {
  if (env.NODE_ENV !== 'production') {
    throw new BootstrapRefusedError('NODE_ENV must be production. Bootstrap refused.');
  }
  if (env.CONFIRM_PRODUCTION_ADMIN_BOOTSTRAP !== REQUIRED_CONFIRMATION) {
    throw new BootstrapRefusedError(
      'CONFIRM_PRODUCTION_ADMIN_BOOTSTRAP must exactly equal CREATE_FIRST_ADMIN. Bootstrap refused.'
    );
  }

  validateProductionOrigin(env);
  const databaseUrl = requireValue(env, 'DATABASE_URL');
  validateDatabaseUrl(databaseUrl);

  const email = normalizeManagerEmail(requireValue(env, 'BOOTSTRAP_ADMIN_EMAIL'));
  const name = normalizeManagerName(requireValue(env, 'BOOTSTRAP_ADMIN_NAME'));
  const password = requireValue(env, 'BOOTSTRAP_ADMIN_PASSWORD');

  if (!isValidManagerEmail(email)) {
    throw new BootstrapRefusedError('BOOTSTRAP_ADMIN_EMAIL is invalid. Bootstrap refused.');
  }
  if (!isValidManagerName(name)) {
    throw new BootstrapRefusedError('BOOTSTRAP_ADMIN_NAME does not satisfy the staff name policy. Bootstrap refused.');
  }
  if (!isValidManagerPassword(password)) {
    throw new BootstrapRefusedError(
      'BOOTSTRAP_ADMIN_PASSWORD does not satisfy the production password policy. Bootstrap refused.'
    );
  }
  if (env.BOOTSTRAP_DRY_RUN !== 'true' && env.BOOTSTRAP_DRY_RUN !== 'false') {
    throw new BootstrapRefusedError('BOOTSTRAP_DRY_RUN must exactly equal true or false. Bootstrap refused.');
  }

  return {
    email,
    name,
    password,
    dryRun: env.BOOTSTRAP_DRY_RUN === 'true'
  };
}

export async function bootstrapProductionAdmin(input: {
  env: BootstrapEnvironment;
  database: BootstrapDatabase;
  hash?: typeof hashPassword;
}): Promise<BootstrapResult> {
  const config = readBootstrapConfig(input.env);
  const passwordHasher = input.hash ?? hashPassword;

  return input.database.$transaction(async (tx) => {
    const [admins, emailAccount] = await Promise.all([
      tx.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true, status: true, managerProfile: { select: { id: true } } }
      }),
      tx.user.findFirst({
        where: { email: { equals: config.email, mode: 'insensitive' } },
        select: {
          id: true,
          role: true,
          status: true,
          managerProfile: { select: { id: true } }
        }
      })
    ]);

    if (admins.some((admin) => admin.status === 'ACTIVE')) {
      throw new BootstrapRefusedError('Production ADMIN already exists. Bootstrap refused.');
    }
    if (admins.length > 0) {
      throw new BootstrapRefusedError(
        'A non-active or partially configured ADMIN exists. Manual diagnosis is required. Bootstrap refused.'
      );
    }
    if (emailAccount) {
      throw new BootstrapRefusedError('Email is already assigned to another account. Bootstrap refused.');
    }

    if (config.dryRun) {
      return {
        mode: 'dry-run',
        email: config.email,
        role: 'ADMIN',
        status: 'ACTIVE',
        managerProfile: 'would-create'
      };
    }

    const passwordHash = await passwordHasher(config.password);
    const created = await tx.user.create({
      data: {
        name: config.name,
        email: config.email,
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        authVersion: 1,
        managerProfile: {
          create: { displayName: config.name }
        }
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        managerProfile: { select: { id: true } }
      }
    });

    if (!created.email || !created.managerProfile) {
      throw new BootstrapRefusedError('ADMIN creation returned an incomplete result. Transaction refused.');
    }

    return {
      mode: 'created',
      userId: created.id,
      email: created.email,
      role: created.role,
      status: created.status,
      managerProfile: 'created'
    };
  }, { isolationLevel: 'Serializable' });
}

function printResult(result: BootstrapResult) {
  if (result.mode === 'dry-run') {
    console.log('Production ADMIN dry run passed');
    console.log(`normalized email: ${result.email}`);
    console.log(`role: ${result.role}`);
    console.log(`status: ${result.status}`);
    console.log('ManagerProfile would be created');
    return;
  }

  console.log('ADMIN created successfully');
  console.log(`user id: ${result.userId}`);
  console.log(`normalized email: ${result.email}`);
  console.log(`role: ${result.role}`);
  console.log(`status: ${result.status}`);
  console.log('ManagerProfile created');
}

export async function runBootstrapCli() {
  try {
    const { prisma } = await import('../lib/prisma');
    try {
      const result = await bootstrapProductionAdmin({
        env: process.env,
        database: prisma as unknown as BootstrapDatabase
      });
      printResult(result);
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    const message = error instanceof BootstrapRefusedError
      ? error.message
      : 'Production ADMIN bootstrap failed safely. No secret details were logged.';
    console.error(message);
    process.exitCode = 1;
  }
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  void runBootstrapCli();
}
