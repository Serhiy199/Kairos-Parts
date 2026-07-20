import { RequestSource, RequestStatus, UserRole } from '@prisma/client';

import { catalogCategories } from '@/lib/catalog/catalog-data';
import { hashPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/prisma';

const TEST_PASSWORD = 'Test123456!';

const testAccounts = {
  client: {
    email: 'client@test.com',
    name: 'Тестовий клієнт',
    phone: '+380501111111'
  },
  manager: {
    email: 'manager@test.com',
    name: 'Тестовий менеджер'
  },
  admin: {
    email: 'admin@test.com',
    name: 'Тестовий адміністратор'
  }
} as const;

const seedRequestNumbers = {
  clientJohnDeere: 'KP-DEV-0001',
  websiteMan: 'KP-DEV-0002',
  guestTires: 'KP-DEV-0003'
} as const;

function publicToken(key: string) {
  return `dev_${key}_status_token`;
}

function catalogSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9а-яіїєґ]+/giu, '-')
    .replace(/^-|-$/g, '');
}

async function ensureCategory(slug: string) {
  const catalogCategory = catalogCategories.find((category) => category.slug === slug);

  if (!catalogCategory) {
    throw new Error(`Missing catalog category fixture for slug: ${slug}`);
  }

  return prisma.category.upsert({
    where: { slug: catalogCategory.slug },
    update: {
      name: catalogCategory.name,
      description: catalogCategory.description
    },
    create: {
      name: catalogCategory.name,
      slug: catalogCategory.slug,
      description: catalogCategory.description
    }
  });
}

async function ensureManufacturer(categoryId: string, name: string) {
  const slug = catalogSlug(name);
  const existingManufacturer = await prisma.manufacturer.findFirst({
    where: {
      categoryId,
      subcategoryId: null,
      slug
    }
  });

  if (existingManufacturer) {
    return prisma.manufacturer.update({
      where: { id: existingManufacturer.id },
      data: { name }
    });
  }

  return prisma.manufacturer.create({
    data: {
      categoryId,
      name,
      slug
    }
  });
}

async function ensureStatusHistory(requestId: string, newStatus: RequestStatus, changedByUserId: string | null) {
  const existingHistory = await prisma.requestStatusHistory.findFirst({
    where: { requestId, newStatus }
  });

  if (existingHistory) {
    return existingHistory;
  }

  return prisma.requestStatusHistory.create({
    data: {
      requestId,
      oldStatus: null,
      newStatus,
      changedByUserId
    }
  });
}

async function ensureRequestFile(requestId: string) {
  const existingFile = await prisma.requestFile.findFirst({
    where: {
      requestId,
      fileName: 'test-defect-list.xlsx'
    }
  });

  if (existingFile) {
    return existingFile;
  }

  return prisma.requestFile.create({
    data: {
      requestId,
      fileName: 'test-defect-list.xlsx',
      storageKey: 'dev-metadata/request-files/test-defect-list.xlsx',
      fileUrl: null,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 24832
    }
  });
}

async function ensureInternalComment(requestId: string, authorId: string) {
  const message = 'Перевірити сумісність по серійному номеру перед формуванням пропозиції.';
  const existingComment = await prisma.requestComment.findFirst({
    where: { requestId, authorId, message, internal: true }
  });

  if (existingComment) {
    return existingComment;
  }

  return prisma.requestComment.create({
    data: {
      requestId,
      authorId,
      message,
      internal: true
    }
  });
}

async function main() {
  if (process.env.ALLOW_DEV_SEED !== 'true') {
    console.log('Dev seed skipped. Set ALLOW_DEV_SEED=true only for a local development database.');
    return;
  }

  const passwordHash = await hashPassword(TEST_PASSWORD);

  const clientUser = await prisma.user.upsert({
    where: { email: testAccounts.client.email },
    update: {
      name: testAccounts.client.name,
      phone: testAccounts.client.phone,
      passwordHash,
      role: UserRole.CLIENT,
      status: 'ACTIVE',
      authVersion: 1
    },
    create: {
      email: testAccounts.client.email,
      name: testAccounts.client.name,
      phone: testAccounts.client.phone,
      passwordHash,
      role: UserRole.CLIENT,
      status: 'ACTIVE',
      authVersion: 1
    }
  });

  const clientProfile = await prisma.clientProfile.upsert({
    where: { userId: clientUser.id },
    update: {
      clientType: 'BUSINESS',
      contactName: 'Тестовий клієнт',
      companyName: 'ФГ Тест Агро',
      phone: testAccounts.client.phone,
      email: testAccounts.client.email
    },
    create: {
      userId: clientUser.id,
      clientType: 'BUSINESS',
      contactName: 'Тестовий клієнт',
      companyName: 'ФГ Тест Агро',
      phone: testAccounts.client.phone,
      email: testAccounts.client.email
    }
  });

  const managerUser = await prisma.user.upsert({
    where: { email: testAccounts.manager.email },
    update: {
      name: testAccounts.manager.name,
      passwordHash,
      role: UserRole.MANAGER,
      status: 'ACTIVE',
      authVersion: 1
    },
    create: {
      email: testAccounts.manager.email,
      name: testAccounts.manager.name,
      passwordHash,
      role: UserRole.MANAGER,
      status: 'ACTIVE',
      authVersion: 1
    }
  });

  await prisma.managerProfile.upsert({
    where: { userId: managerUser.id },
    update: { displayName: 'Тестовий менеджер' },
    create: {
      userId: managerUser.id,
      displayName: 'Тестовий менеджер'
    }
  });

  const adminUser = await prisma.user.upsert({
    where: { email: testAccounts.admin.email },
    update: {
      name: testAccounts.admin.name,
      passwordHash,
      role: UserRole.ADMIN,
      status: 'ACTIVE',
      authVersion: 1
    },
    create: {
      email: testAccounts.admin.email,
      name: testAccounts.admin.name,
      passwordHash,
      role: UserRole.ADMIN,
      status: 'ACTIVE',
      authVersion: 1
    }
  });

  await prisma.managerProfile.upsert({
    where: { userId: adminUser.id },
    update: { displayName: 'Тестовий адміністратор' },
    create: {
      userId: adminUser.id,
      displayName: 'Тестовий адміністратор'
    }
  });

  const [agriculturalCategory, truckCategory, tiresCategory] = await Promise.all([
    ensureCategory('agricultural-parts'),
    ensureCategory('truck-parts'),
    ensureCategory('tires-tubes')
  ]);

  const [johnDeereManufacturer, manManufacturer] = await Promise.all([
    ensureManufacturer(agriculturalCategory.id, 'John Deere'),
    ensureManufacturer(truckCategory.id, 'MAN')
  ]);

  const johnDeereVehicle = await prisma.vehicle.upsert({
    where: { id: 'dev_vehicle_john_deere_8430' },
    update: {
      clientId: clientProfile.id,
      companyId: null,
      type: 'Сільгосптехніка',
      manufacturer: 'John Deere',
      model: '8430',
      year: 2011,
      vinOrSerial: 'JD8430TEST001',
      comment: 'Тестова одиниця техніки для перевірки заявок'
    },
    create: {
      id: 'dev_vehicle_john_deere_8430',
      clientId: clientProfile.id,
      companyId: null,
      type: 'Сільгосптехніка',
      manufacturer: 'John Deere',
      model: '8430',
      year: 2011,
      vinOrSerial: 'JD8430TEST001',
      comment: 'Тестова одиниця техніки для перевірки заявок'
    }
  });

  const manVehicle = await prisma.vehicle.upsert({
    where: { id: 'dev_vehicle_man_tgx_18440' },
    update: {
      clientId: clientProfile.id,
      companyId: null,
      type: 'Вантажний транспорт',
      manufacturer: 'MAN',
      model: 'TGX 18.440',
      year: 2016,
      vinOrSerial: 'MANTGXTEST002',
      comment: 'Тестова вантажна техніка'
    },
    create: {
      id: 'dev_vehicle_man_tgx_18440',
      clientId: clientProfile.id,
      companyId: null,
      type: 'Вантажний транспорт',
      manufacturer: 'MAN',
      model: 'TGX 18.440',
      year: 2016,
      vinOrSerial: 'MANTGXTEST002',
      comment: 'Тестова вантажна техніка'
    }
  });

  const clientRequest = await prisma.request.upsert({
    where: { requestNumber: seedRequestNumbers.clientJohnDeere },
    update: {
      source: RequestSource.CLIENT_DASHBOARD,
      clientId: clientProfile.id,
      vehicleId: johnDeereVehicle.id,
      status: RequestStatus.NEW,
      description: 'Потрібно підібрати фільтри та ремені для John Deere 8430',
      categoryId: agriculturalCategory.id,
      manufacturerId: johnDeereManufacturer.id,
      equipmentType: 'Сільгосптехніка',
      model: '8430',
      vinOrSerial: 'JD8430TEST001',
      assignedManagerId: managerUser.id
    },
    create: {
      requestNumber: seedRequestNumbers.clientJohnDeere,
      publicStatusToken: publicToken('client_john_deere_8430'),
      source: RequestSource.CLIENT_DASHBOARD,
      clientId: clientProfile.id,
      vehicleId: johnDeereVehicle.id,
      status: RequestStatus.NEW,
      description: 'Потрібно підібрати фільтри та ремені для John Deere 8430',
      categoryId: agriculturalCategory.id,
      manufacturerId: johnDeereManufacturer.id,
      equipmentType: 'Сільгосптехніка',
      model: '8430',
      vinOrSerial: 'JD8430TEST001',
      assignedManagerId: managerUser.id
    }
  });

  const websiteRequest = await prisma.request.upsert({
    where: { requestNumber: seedRequestNumbers.websiteMan },
    update: {
      source: RequestSource.WEBSITE,
      clientId: clientProfile.id,
      vehicleId: manVehicle.id,
      status: RequestStatus.IN_PROGRESS,
      description: 'Потрібні гальмівні комплектуючі для MAN TGX',
      categoryId: truckCategory.id,
      manufacturerId: manManufacturer.id,
      equipmentType: 'Вантажний транспорт',
      model: 'TGX 18.440',
      vinOrSerial: 'MANTGXTEST002',
      assignedManagerId: managerUser.id
    },
    create: {
      requestNumber: seedRequestNumbers.websiteMan,
      publicStatusToken: publicToken('website_man_tgx'),
      source: RequestSource.WEBSITE,
      clientId: clientProfile.id,
      vehicleId: manVehicle.id,
      status: RequestStatus.IN_PROGRESS,
      description: 'Потрібні гальмівні комплектуючі для MAN TGX',
      categoryId: truckCategory.id,
      manufacturerId: manManufacturer.id,
      equipmentType: 'Вантажний транспорт',
      model: 'TGX 18.440',
      vinOrSerial: 'MANTGXTEST002',
      assignedManagerId: managerUser.id
    }
  });

  const guestRequest = await prisma.request.upsert({
    where: { requestNumber: seedRequestNumbers.guestTires },
    update: {
      source: RequestSource.WEBSITE,
      clientId: null,
      vehicleId: null,
      status: RequestStatus.WAITING_APPROVAL,
      guestName: 'Гостьовий клієнт',
      guestPhone: '+380502222222',
      guestEmail: 'guest@test.com',
      companyName: null,
      description: 'Потрібно підібрати шини для причепа',
      categoryId: tiresCategory.id,
      manufacturerId: null,
      equipmentType: 'Причіп',
      model: null,
      vinOrSerial: null,
      assignedManagerId: managerUser.id
    },
    create: {
      requestNumber: seedRequestNumbers.guestTires,
      publicStatusToken: publicToken('guest_tires'),
      source: RequestSource.WEBSITE,
      status: RequestStatus.WAITING_APPROVAL,
      guestName: 'Гостьовий клієнт',
      guestPhone: '+380502222222',
      guestEmail: 'guest@test.com',
      description: 'Потрібно підібрати шини для причепа',
      categoryId: tiresCategory.id,
      equipmentType: 'Причіп',
      assignedManagerId: managerUser.id
    }
  });

  await Promise.all([
    ensureStatusHistory(clientRequest.id, RequestStatus.NEW, managerUser.id),
    ensureStatusHistory(websiteRequest.id, RequestStatus.IN_PROGRESS, managerUser.id),
    ensureStatusHistory(guestRequest.id, RequestStatus.WAITING_APPROVAL, managerUser.id),
    ensureRequestFile(clientRequest.id),
    ensureInternalComment(clientRequest.id, managerUser.id)
  ]);

  console.log('Dev seed completed.');
  console.log('Accounts: client@test.com / manager@test.com / admin@test.com');
  console.log('Password for all test accounts: Test123456!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    await prisma.$disconnect();
    throw error;
  });
