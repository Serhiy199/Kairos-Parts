import { UserRole } from '@prisma/client';

import { hashPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/prisma';

const seedUsers = [
  {
    email: 'client@example.test',
    name: 'Kairos Test Client',
    role: UserRole.CLIENT
  },
  {
    email: 'manager@example.test',
    name: 'Kairos Test Manager',
    role: UserRole.MANAGER
  },
  {
    email: 'admin@example.test',
    name: 'Kairos Test Admin',
    role: UserRole.ADMIN
  }
];

async function main() {
  if (process.env.ALLOW_DEV_SEED !== 'true') {
    throw new Error('Seed is disabled. Set ALLOW_DEV_SEED=true only for a local development database.');
  }

  const clientPasswordHash = await hashPassword('ClientPass123!');
  const staffPasswordHash = await hashPassword('StaffPass123!');

  for (const user of seedUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role
      },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash: user.role === UserRole.CLIENT ? clientPasswordHash : staffPasswordHash
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    await prisma.$disconnect();
    throw error;
  });
