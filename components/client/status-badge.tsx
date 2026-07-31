import { REQUEST_STATUS_BADGES, REQUEST_STATUS_LABELS, type AnyRequestStatus } from '@/lib/requests/statuses';

export function StatusBadge({
  status,
  highlightNew = false
}: {
  status: AnyRequestStatus;
  highlightNew?: boolean;
}) {
  const colors = highlightNew && status === 'NEW'
    ? { background: '#E7F6EC', text: '#2E7D4F' }
    : REQUEST_STATUS_BADGES[status];

  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-xs font-bold"
      style={{ backgroundColor: colors.background, color: colors.text }}
    >
      {REQUEST_STATUS_LABELS[status]}
    </span>
  );
}
