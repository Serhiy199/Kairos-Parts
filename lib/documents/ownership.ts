export type DocumentOwnerContext =
  | { type: 'vehicle'; vehicleId: string }
  | { type: 'company'; companyId: string }
  | { type: 'client'; clientId: string };

export type OwnerDocumentType = DocumentOwnerContext['type'];

export function documentOwnerId(owner: DocumentOwnerContext) {
  if (owner.type === 'vehicle') return owner.vehicleId;
  if (owner.type === 'company') return owner.companyId;
  return owner.clientId;
}

export function documentOwnerData(owner: DocumentOwnerContext) {
  if (owner.type === 'vehicle') {
    return { vehicleId: owner.vehicleId, companyId: null, clientId: null, requestId: null };
  }

  if (owner.type === 'company') {
    return { vehicleId: null, companyId: owner.companyId, clientId: null, requestId: null };
  }

  return { vehicleId: null, companyId: null, clientId: owner.clientId, requestId: null };
}

export function hasExactlyOneDocumentOwner(value: {
  vehicleId?: string | null;
  companyId?: string | null;
  clientId?: string | null;
  requestId?: string | null;
}) {
  return [value.vehicleId, value.companyId, value.clientId, value.requestId].filter(Boolean).length === 1;
}

export function ownerDocumentWhere(owner: DocumentOwnerContext) {
  return documentOwnerData(owner);
}
