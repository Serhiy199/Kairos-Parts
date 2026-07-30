import type { DocumentSource, UserRole } from '@prisma/client';

export type DocumentActorRole = Extract<UserRole, 'CLIENT' | 'MANAGER' | 'ADMIN'>;

export class UnsupportedDocumentActorRoleError extends Error {
  readonly code = 'DOCUMENT_SOURCE_FORBIDDEN';

  constructor(readonly role: UserRole) {
    super(`Unsupported document actor role: ${role}`);
    this.name = 'UnsupportedDocumentActorRoleError';
  }
}

export function resolveDocumentSourceForActor(role: UserRole): DocumentSource {
  if (role === 'CLIENT' || role === 'MANAGER' || role === 'ADMIN') {
    return role;
  }

  throw new UnsupportedDocumentActorRoleError(role);
}
