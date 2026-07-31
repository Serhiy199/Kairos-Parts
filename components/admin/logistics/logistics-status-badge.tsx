import type { LogisticsRequestStatus } from '@prisma/client';

import {
  logisticsStatusClass,
  LOGISTICS_STATUS_LABELS
} from '@/lib/logistics/crm-presentation';

export function LogisticsStatusBadge({
  status
}: {
  status: LogisticsRequestStatus;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${logisticsStatusClass(status)}`}
    >
      {LOGISTICS_STATUS_LABELS[status]}
    </span>
  );
}
