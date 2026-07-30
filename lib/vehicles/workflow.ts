export type CreateVehicleCoreInput = {
  type: string;
  manufacturer: string;
  model: string;
  year?: number | null;
  vinOrSerial?: string | null;
  comment?: string | null;
};

export type VehicleImageUploadInput = {
  file: File;
};

export type VehicleDocumentUploadInput = {
  file: File;
  visibleToClient?: boolean;
};

export type CreateVehicleWithAssetsInput = {
  vehicle: CreateVehicleCoreInput;
  images: VehicleImageUploadInput[];
  documents: VehicleDocumentUploadInput[];
};

export type VehicleWorkflowActor =
  | { userId: string; role: 'CLIENT' }
  | { userId: string; role: 'MANAGER' | 'ADMIN' };

export type VehicleWorkflowOwner =
  | { type: 'client'; clientId: string }
  | { type: 'company'; companyId: string };

export type CreateVehicleWithAssetsResult =
  | { ok: true; vehicleId: string; imageIds: string[]; documentIds: string[] }
  | {
      ok: false;
      code:
        | 'VEHICLE_OWNER_INVALID'
        | 'VEHICLE_NAME_BUILD_FAILED'
        | 'VEHICLE_CREATE_FAILED'
        | 'VEHICLE_IMAGE_UPLOAD_FAILED'
        | 'VEHICLE_DOCUMENT_UPLOAD_FAILED';
      vehicleId?: string;
    };
