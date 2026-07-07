export const USER_ROLES = ['GUEST', 'CLIENT', 'MANAGER', 'ADMIN'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  GUEST: 'Can view public pages, create a one-time request, and access request status by token.',
  CLIENT: 'Can use the client dashboard, request history, vehicles, documents, and repeated requests.',
  MANAGER: 'Can process client requests in CRM and coordinate fulfillment workflows.',
  ADMIN: 'Can manage CRM settings, directories, managers, and platform-level configuration.'
};

export const ROLE_CAPABILITIES: Record<UserRole, string[]> = {
  GUEST: ['public:read', 'request:create:guest', 'request-status:read:token'],
  CLIENT: ['client-dashboard:read', 'request:create:client', 'request:read:own', 'vehicle:manage:own', 'document:read:own'],
  MANAGER: ['crm:read', 'request:read:assigned', 'request:update-status', 'request:assign', 'request-comment:create', 'ocr:review'],
  ADMIN: [
    'crm:read:all',
    'manager:manage',
    'catalog:manage',
    'request:update-status',
    'request:assign',
    'request-comment:create',
    'ocr:review',
    'analytics:read',
    'settings:manage'
  ]
};
