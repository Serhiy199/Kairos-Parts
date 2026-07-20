'use server';

import { AuthError, CredentialsSignin } from 'next-auth';
import { redirect } from 'next/navigation';

import { signIn, signOut } from '@/auth';
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

function accountLifecycleError(error: AuthError) {
  if (!(error instanceof CredentialsSignin)) {
    return null;
  }

  if (error.code === 'account-invited' || error.code === 'account-disabled') {
    return error.code;
  }

  return null;
}

function getClientNextPath(nextPath: string) {
  if (nextPath === '/request' || nextPath.startsWith('/request?')) {
    return nextPath;
  }

  if (nextPath === '/client' || nextPath.startsWith('/client/')) {
    return nextPath;
  }

  return '/client';
}

function appendNextParam(path: string, nextPath: string) {
  const normalizedNext = getClientNextPath(nextPath);

  if (!nextPath || normalizedNext === '/client') {
    return path;
  }

  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}next=${encodeURIComponent(normalizedNext)}`;
}

export async function registerClient(formData: FormData) {
  const nextPath = readString(formData, 'next');

  if (!hasDatabaseUrl()) {
    redirect(appendNextParam('/register?error=database', nextPath));
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
    redirect(appendNextParam('/register?error=validation', nextPath));
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { phone }]
    }
  });

  if (existingUser) {
    redirect(appendNextParam('/register?error=exists', nextPath));
  }

  const passwordHash = await hashPassword(password);

  await prisma.user.create({
    data: {
      name: contactName,
      email,
      phone,
      passwordHash,
      role: 'CLIENT',
      status: 'ACTIVE',
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

  redirect(appendNextParam('/login?registered=1', nextPath));
}

export async function loginClient(formData: FormData) {
  const email = readString(formData, 'email').toLowerCase();
  const password = readString(formData, 'password');
  const nextPath = readString(formData, 'next');

  if (!email || !password) {
    redirect(appendNextParam('/login?error=validation', nextPath));
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { role: true }
  });

  if (user?.role === 'MANAGER' || user?.role === 'ADMIN') {
    redirect(appendNextParam('/login?error=staff-login', nextPath));
  }

  try {
    await signIn('credentials', {
      email,
      password,
      redirect: false
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const lifecycleError = accountLifecycleError(error);

      if (lifecycleError) {
        redirect(appendNextParam(`/login?error=${lifecycleError}`, nextPath));
      }

      redirect(appendNextParam('/login?error=credentials', nextPath));
    }

    throw error;
  }

  redirect(getClientNextPath(nextPath));
}

export async function loginStaff(formData: FormData) {
  const email = readString(formData, 'email').toLowerCase();
  const password = readString(formData, 'password');
  const nextPath = readString(formData, 'next');

  if (!email || !password) {
    redirect('/admin/login?error=validation');
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { role: true }
  });

  if (user?.role === 'CLIENT') {
    redirect('/admin/login?error=client-login');
  }

  if (user?.role !== 'MANAGER' && user?.role !== 'ADMIN') {
    redirect('/admin/login?error=credentials');
  }

  try {
    await signIn('credentials', {
      email,
      password,
      redirect: false
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const lifecycleError = accountLifecycleError(error);

      if (lifecycleError) {
        redirect(`/admin/login?error=${lifecycleError}`);
      }

      redirect('/admin/login?error=credentials');
    }

    throw error;
  }

  redirect((nextPath === '/admin' || nextPath.startsWith('/admin/')) && nextPath !== '/admin/login' ? nextPath : '/admin');
}

export async function logoutClient() {
  await signOut({ redirectTo: '/login' });
}

export async function logoutStaff() {
  await signOut({ redirectTo: '/admin/login' });
}
