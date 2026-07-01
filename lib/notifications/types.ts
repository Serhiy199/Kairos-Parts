export const NOTIFICATION_CHANNELS = ['EMAIL', 'TELEGRAM'] as const;
export const NOTIFICATION_STATUSES = ['PENDING', 'SENT', 'FAILED'] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export type NotificationContract = {
  id: string;
  requestId?: string | null;
  userId?: string | null;
  channel: NotificationChannel;
  status: NotificationStatus;
  message: string;
  sentAt?: string | null;
  createdAt: string;
};
