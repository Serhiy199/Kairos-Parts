import { CredentialsSignin, type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import { evaluateCredentialCandidate, parseLoginIdentifier, parseLoginScope } from '@/lib/auth/credentials';
import { validateJwtClaimsAgainstCurrentUser } from '@/lib/auth/current-user-access';
import {
  logRateLimitDatabaseError,
  maybeCleanupExpiredRateLimits,
  prepareCredentialsRateLimit,
  recordCredentialsFailure,
  resetSuccessfulIdentifier
} from '@/lib/auth/rate-limit';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth/password';
import type { UserRole } from './roles';

class AccountInvitedError extends CredentialsSignin {
  code = 'account-invited';
}

class AccountDisabledError extends CredentialsSignin {
  code = 'account-disabled';
}

class CredentialsRateLimitError extends CredentialsSignin {
  code = 'rate-limit';
}

class CredentialsUnavailableError extends CredentialsSignin {
  code = 'auth-unavailable';
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
      name: 'Identifier and password',
      credentials: {
        identifier: { label: 'Email or phone', type: 'text' },
        password: { label: 'Password', type: 'password' },
        loginScope: { label: 'Login scope', type: 'text' }
      },
      async authorize(credentials, request) {
        const scope = parseLoginScope(credentials?.loginScope);
        const password = typeof credentials?.password === 'string' ? credentials.password : null;
        const identifier = scope ? parseLoginIdentifier(credentials?.identifier, scope) : null;

        if (!scope || !password) {
          return null;
        }

        let rateLimit;
        try {
          rateLimit = await prepareCredentialsRateLimit({
            identifier: credentials?.identifier,
            request
          });
        } catch (error) {
          logRateLimitDatabaseError('pre_check', error);
          throw new CredentialsUnavailableError();
        }

        if (rateLimit.decision.blocked) {
          console.warn('Credentials login blocked.', { category: 'auth_rate_limit_blocked' });
          throw new CredentialsRateLimitError();
        }

        await maybeCleanupExpiredRateLimits();

        const user = identifier ? await prisma.user.findFirst({
          where: identifier.kind === 'phone'
            ? { role: 'CLIENT', normalizedPhone: identifier.value }
            : scope === 'CLIENT'
              ? { role: 'CLIENT', email: identifier.value }
              : { role: { in: ['ADMIN', 'MANAGER'] }, email: identifier.value },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
            authVersion: true,
            passwordHash: true
          }
        }) : null;

        const decision = await evaluateCredentialCandidate({ candidate: user, password, scope, verify: verifyPassword });
        if (!decision.ok) {
          let failureDecision;
          try {
            failureDecision = await recordCredentialsFailure(rateLimit.keys);
          } catch (error) {
            logRateLimitDatabaseError('failure_increment', error);
            throw new CredentialsUnavailableError();
          }

          if (failureDecision.blocked) {
            console.warn('Credentials login blocked.', { category: 'auth_rate_limit_blocked' });
            throw new CredentialsRateLimitError();
          }
        }

        if (!decision.ok && decision.reason === 'account_invited') {
          throw new AccountInvitedError();
        }
        if (!decision.ok && decision.reason === 'account_disabled') {
          throw new AccountDisabledError();
        }
        if (!decision.ok) {
          return null;
        }

        try {
          await resetSuccessfulIdentifier(rateLimit.keys);
        } catch (error) {
          logRateLimitDatabaseError('success_reset', error);
          throw new CredentialsUnavailableError();
        }

        const authenticatedUser = decision.user;
        return {
          id: authenticatedUser.id,
          email: authenticatedUser.email,
          name: authenticatedUser.name,
          role: authenticatedUser.role,
          status: authenticatedUser.status,
          authVersion: authenticatedUser.authVersion
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
