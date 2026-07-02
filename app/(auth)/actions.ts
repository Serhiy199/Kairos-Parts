'use server';

import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';

import { signIn } from '@/auth';
import { canAccessPath, defaultRedirectForRole } from '@/lib/auth/permissions';
import { hasDatabaseUrl } from '@/lib/env/database';
import { hashPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/prisma';

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function registerClient(formData: FormData) {
  if (!hasDatabaseUrl()) {
    redirect('/register?error=database');
  }

  const accountType = readString(formData, 'accountType') === 'INDIVIDUAL' ? 'INDIVIDUAL' : 'BUSINESS';
  const companyName = readString(formData, 'companyName');
  const taxId = readString(formData, 'taxId');
  const firstName = readString(formData, 'firstName');
  const lastName = readString(formData, 'lastName');
  const contactName = accountType === 'BUSINESS' ? readString(formData, 'contactName') : [firstName, lastName].filter(Boolean).join(' ');
  const email = readString(formData, 'email').toLowerCase();
  const phone = readString(formData, 'phone');
  const password = readString(formData, 'password');
  const confirmPassword = readString(formData, 'confirmPassword');

  const hasBusinessFields = accountType === 'BUSINESS' ? Boolean(companyName && taxId && contactName) : true;
  const hasIndividualFields = accountType === 'INDIVIDUAL' ? Boolean(firstName) : true;

  if (
    !hasBusinessFields ||
    !hasIndividualFields ||
    !contactName ||
    !email ||
    !isValidEmail(email) ||
    !phone ||
    !password ||
    password !== confirmPassword ||
    password.length < 8
  ) {
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
          clientType: accountType,
          contactName,
          companyName: accountType === 'BUSINESS' ? companyName : null,
          taxId: accountType === 'BUSINESS' ? taxId : null,
          firstName: accountType === 'INDIVIDUAL' ? firstName : null,
          lastName: accountType === 'INDIVIDUAL' ? lastName || null : null,
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
  const nextPath = readString(formData, 'next');

  if (!email || !password) {
    redirect('/login?error=validation');
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { role: true }
  });
  const redirectTo =
    user?.role && nextPath.startsWith('/') && !nextPath.startsWith('//') && canAccessPath(nextPath, user.role)
      ? nextPath
      : defaultRedirectForRole(user?.role);

  try {
    await signIn('credentials', {
      email,
      password,
      redirect: false
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect('/login?error=credentials');
    }

    throw error;
  }

  redirect(redirectTo);
}
