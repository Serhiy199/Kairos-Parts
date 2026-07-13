import type { RequestSource } from './sources';
import type { RequestStatus } from './statuses';

export type RequestListItem = {
  id: string;
  requestNumber: string;
  source: RequestSource;
  status: RequestStatus;
  clientId?: string | null;
  companyName?: string | null;
  guestName?: string | null;
  assignedManagerId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RequestDetail = RequestListItem & {
  publicStatusToken: string;
  guestPhone?: string | null;
  guestEmail?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  manufacturerId?: string | null;
  vehicleId?: string | null;
  equipmentType?: string | null;
  model?: string | null;
  vehicleYear?: number | null;
  vinOrSerial?: string | null;
  description: string;
};

export type CreateGuestRequestInput = {
  source: 'WEBSITE' | 'TELEGRAM';
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
  companyName?: string;
  categoryId?: string;
  subcategoryId?: string;
  manufacturerId?: string;
  equipmentType?: string;
  model?: string;
  vehicleYear?: number;
  vinOrSerial?: string;
  description: string;
};

export type CreateClientRequestInput = Omit<CreateGuestRequestInput, 'source'> & {
  source: 'CLIENT_DASHBOARD';
  clientId: string;
  vehicleId?: string;
};

export type UpdateRequestStatusInput = {
  status: RequestStatus;
  changedByUserId: string;
};
