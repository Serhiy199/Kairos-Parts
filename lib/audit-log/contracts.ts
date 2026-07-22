import type { UserRole } from '@prisma/client';

export const AUDIT_CATEGORIES = {
  TECHNICAL: 'TECHNICAL',
  LOGIN: 'LOGIN',
  CRITICAL_READ: 'CRITICAL_READ',
  STANDARD: 'STANDARD',
  FINANCIAL_CRITICAL: 'FINANCIAL_CRITICAL'
} as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[keyof typeof AUDIT_CATEGORIES];

export const AUDIT_ACTIONS = {
  CHANGE_REQUEST_CREATED: 'CHANGE_REQUEST_CREATED',
  CHANGE_REQUEST_CANCELLED: 'CHANGE_REQUEST_CANCELLED',
  CHANGE_REQUEST_APPROVED: 'CHANGE_REQUEST_APPROVED',
  CHANGE_REQUEST_REJECTED: 'CHANGE_REQUEST_REJECTED',
  CHANGE_APPLIED: 'CHANGE_APPLIED',
  VEHICLE_ARCHIVED: 'VEHICLE_ARCHIVED',
  ENTITY_UPDATED: 'ENTITY_UPDATED',
  MANAGER_INVITATION_CREATED: 'MANAGER_INVITATION_CREATED',
  MANAGER_INVITATION_REGENERATED: 'MANAGER_INVITATION_REGENERATED',
  MANAGER_ACTIVATED: 'MANAGER_ACTIVATED',
  MANAGER_DISABLED: 'MANAGER_DISABLED',
  MANAGER_ENABLED: 'MANAGER_ENABLED'
} as const;

export const AUDIT_ENTITY_TYPES = {
  REQUEST: 'REQUEST',
  REQUEST_ITEM: 'REQUEST_ITEM',
  VEHICLE: 'VEHICLE',
  REQUEST_DOCUMENT: 'REQUEST_DOCUMENT',
  DOCUMENT: 'DOCUMENT',
  COMMERCIAL_OFFER: 'COMMERCIAL_OFFER',
  INVOICE: 'INVOICE',
  COMPANY: 'COMPANY',
  CHANGE_REQUEST: 'CHANGE_REQUEST',
  USER: 'USER',
  TEAM_MEMBER: 'TEAM_MEMBER',
  CLIENT: 'CLIENT',
  EQUIPMENT_TYPE: 'EQUIPMENT_TYPE',
  MANUFACTURER: 'MANUFACTURER',
  AUTH_SESSION: 'AUTH_SESSION',
  TELEGRAM_REQUEST: 'TELEGRAM_REQUEST',
  SYSTEM: 'SYSTEM'
} as const;

export type AuditActor =
  | { type: 'USER'; id: string }
  | { type: 'SYSTEM'; name: string }
  | { type: 'ANONYMOUS' };

export function auditUserActor(id: string): AuditActor {
  return { type: 'USER', id };
}

export function auditSystemActor(name: string): AuditActor {
  return { type: 'SYSTEM', name };
}

export function auditAnonymousActor(): AuditActor {
  return { type: 'ANONYMOUS' };
}

export type AuditActorSnapshot = {
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorRole: UserRole | null;
};

export function canReadFullAuditLog(role: UserRole | string | null | undefined) {
  return role === 'ADMIN';
}
