import type { DefaultSession } from 'next-auth';
import type { JWT as DefaultJWT } from 'next-auth/jwt';
import type { UserStatus } from '@prisma/client';

import type { UserRole } from '@/lib/auth/roles';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role?: UserRole;
      status?: UserStatus;
    } & DefaultSession['user'];
  }

  interface User {
    role?: UserRole;
    status?: UserStatus;
    authVersion?: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    role?: UserRole;
    userId?: string;
    status?: UserStatus;
    authVersion?: number;
    sessionInvalid?: boolean;
  }
}
