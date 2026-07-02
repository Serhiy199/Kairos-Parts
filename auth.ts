import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';

import { authConfig } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  ...authConfig
});
