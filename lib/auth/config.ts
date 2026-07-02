import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth/password';
import type { UserRole } from './roles';

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

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        };
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user && 'role' in user) {
        token.role = user.role as UserRole;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? '';
        session.user.role = token.role as UserRole | undefined;
      }

      return session;
    }
  }
} satisfies NextAuthConfig;
