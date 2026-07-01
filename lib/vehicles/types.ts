export type VehicleSummary = {
  id: string;
  clientId: string;
  type: string;
  manufacturer: string;
  model: string;
  year?: number | null;
  vinOrSerial?: string | null;
  comment?: string | null;
};
