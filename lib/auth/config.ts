import { CredentialsSignin, type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import { validateJwtClaimsAgainstCurrentUser } from '@/lib/auth/current-user-access';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth/password';
import type { UserRole } from './roles';

class AccountInvitedError extends CredentialsSignin {
  code = 'account-invited';
}

class AccountDisabledError extends CredentialsSignin {
  code = 'account-disabled';
}

export const authConfig = {
  pages: {
    signIn: '/login'
  },
  session: {
    strategy: 'jwt'
  },
  providers: [
    Credentials({
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? credentials.email.toLowerCase().trim() : null;
        const password = typeof credentials?.password === 'string' ? credentials.password : null;

        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
            authVersion: true,
            passwordHash: true
          }
        });

        if (!user?.passwordHash || !['CLIENT', 'MANAGER', 'ADMIN'].includes(user.role)) {
          return null;
        }

        const isValid = await verifyPassword(password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        if (user.status === 'INVITED') {
          throw new AccountInvitedError();
        }

        if (user.status === 'DISABLED') {
          throw new AccountDisabledError();
        }

        if (user.status !== 'ACTIVE') {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          authVersion: user.authVersion
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user && 'role' in user && user.role && user.status && Number.isInteger(user.authVersion)) {
        token.userId = user.id;
        token.role = user.role as UserRole;
        token.status = user.status;
        token.authVersion = user.authVersion;
        token.sessionInvalid = false;

        return token;
      }

      try {
        const validation = await validateJwtClaimsAgainstCurrentUser({
          userId: token.userId,
          role: token.role,
          status: token.status,
          authVersion: token.authVersion
        });

        token.sessionInvalid = !validation.ok;
      } catch (error) {
        console.error('Auth session state validation failed.', {
          errorType: error instanceof Error ? error.name : 'UnknownError'
        });
        token.sessionInvalid = true;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        if (token.sessionInvalid || !token.userId || !token.role || !token.status) {
          session.user.id = '';
          session.user.role = undefined;
          session.user.status = undefined;
        } else {
          session.user.id = token.userId;
          session.user.role = token.role;
          session.user.status = token.status;
        }
      }

      return session;
    }
  }
} satisfies NextAuthConfig;
