'use server';

import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';

import { signIn } from '@/auth';
import { hasDatabaseUrl } from '@/lib/env/database';
import { hashPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/prisma';

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export async function registerClient(formData: FormData) {
  if (!hasDatabaseUrl()) {
    redirect('/register?error=database');
  }

  const contactName = readString(formData, 'contactName');
  const email = readString(formData, 'email').toLowerCase();
  const phone = readString(formData, 'phone');
  const companyName = readString(formData, 'companyName');
  const password = readString(formData, 'password');
  const confirmPassword = readString(formData, 'confirmPassword');

  if (!contactName || !email || !phone || !password || password !== confirmPassword || password.length < 8) {
    redirect('/register?error=validation');
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { phone }]
    }
  });

  if (existingUser) {
    redirect('/register?error=exists');
  }

  const passwordHash = await hashPassword(password);

  await prisma.user.create({
    data: {
      name: contactName,
      email,
      phone,
      passwordHash,
      role: 'CLIENT',
      clientProfile: {
        create: {
          contactName,
          companyName: companyName || null,
          phone,
          email
        }
      }
    }
  });

  redirect('/login?registered=1');
}

export async function loginClient(formData: FormData) {
  const email = readString(formData, 'email').toLowerCase();
  const password = readString(formData, 'password');

  if (!email || !password) {
    redirect('/login?error=validation');
  }

  try {
    await signIn('credentials', {
      email,
      password,
      redirectTo: '/client'
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect('/login?error=credentials');
    }

    throw error;
  }
}
