import type { Prisma } from '@prisma/client';

import type { ClientAccessContext } from '@/lib/client/access';

export function logisticsRequestAccessWhere(
  context: ClientAccessContext
): Prisma.LogisticsRequestWhereInput {
  if (context.companyId) {
    return {
      OR: [
        { companyId: context.companyId },
        {
          clientId: context.clientProfileId,
          companyId: null
        }
      ]
    };
  }

  return {
    clientId: context.clientProfileId,
    companyId: null
  };
}
