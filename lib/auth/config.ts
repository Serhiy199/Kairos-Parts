import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import type { UserRole } from './roles';

async function verifyPassword(_password: string, _passwordHash: string) {
  void _password;
  void _passwordHash;
  // Day 3 foundation only. Add a real password hashing implementation before enabling credentials login.
  return false;
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
        const email = typeof credentials?.email === 'string' ? credentials.email : null;
        const password = typeof credentials?.password === 'string' ? credentials.password : null;

        if (!email || !password) {
          return null;
        }

        // The lookup and password check will be enabled after Day 3 when validation and hashing are selected.
        const passwordHash = '';
        const isValid = await verifyPassword(password, passwordHash);

        if (!isValid) {
          return null;
        }

        return null;
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
