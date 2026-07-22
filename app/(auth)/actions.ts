'use server';

import { Prisma } from '@prisma/client';
import { AuthError, CredentialsSignin } from 'next-auth';
import { redirect } from 'next/navigation';

import { signIn, signOut } from '@/auth';
import { hasDatabaseUrl } from '@/lib/env/database';
import { hashPassword } from '@/lib/auth/password';
import { normalizeUkrainianPhone } from '@/lib/phone/normalize';
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

function credentialsSecurityError(error: AuthError) {
  if (!(error instanceof CredentialsSignin)) {
    return null;
  }

  if (error.code === 'rate-limit') return 'rate-limit';
  if (error.code === 'auth-unavailable') return 'auth-unavailable';

  return null;
}

function credentialsSignInCode(result: unknown) {
  const resultUrl =
    typeof result === 'string'
      ? result
      : result && typeof result === 'object' && 'url' in result && typeof result.url === 'string'
        ? result.url
        : null;

  if (!resultUrl) return null;

  try {
    const url = new URL(resultUrl, 'http://localhost');
    if (url.searchParams.get('error') !== 'CredentialsSignin') return null;
    return url.searchParams.get('code') ?? 'credentials';
  } catch {
    return null;
  }
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
  const rawPhone = readString(formData, 'phone');
  const phone = normalizeUkrainianPhone(rawPhone);
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
    !rawPhone ||
    !password ||
    password !== confirmPassword ||
    password.length < 8
  ) {
    redirect(appendNextParam('/register?error=validation', nextPath));
  }

  if (!phone) {
    redirect(appendNextParam('/register?error=phone', nextPath));
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { normalizedPhone: phone }]
    }
  });

  if (existingUser) {
    redirect(appendNextParam('/register?error=exists', nextPath));
  }

  const passwordHash = await hashPassword(password);

  try {
    await prisma.user.create({
      data: {
        name: contactName,
        email,
        phone,
        normalizedPhone: phone,
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      redirect(appendNextParam('/register?error=exists', nextPath));
    }
    throw error;
  }

  redirect(appendNextParam('/login?registered=1', nextPath));
}

export async function loginClient(formData: FormData) {
  const identifier = readString(formData, 'identifier');
  const canonicalPhone = normalizeUkrainianPhone(identifier);
  const authIdentifier = canonicalPhone ?? identifier;
  const password = readString(formData, 'password');
  const nextPath = readString(formData, 'next');

  if (!identifier || !password) {
    redirect(appendNextParam('/login?error=credentials', nextPath));
  }

  try {
    const result: unknown = await signIn('credentials', {
      identifier: authIdentifier,
      password,
      loginScope: 'CLIENT',
      redirect: false
    });
    const code = credentialsSignInCode(result);

    if (code === 'rate-limit' || code === 'auth-unavailable') {
      redirect(appendNextParam(`/login?error=${code}`, nextPath));
    }

    if (code) {
      redirect(appendNextParam('/login?error=credentials', nextPath));
    }
  } catch (error) {
    if (error instanceof AuthError) {
      const securityError = credentialsSecurityError(error);
      if (securityError) {
        redirect(appendNextParam(`/login?error=${securityError}`, nextPath));
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

  try {
    const result: unknown = await signIn('credentials', {
      identifier: email,
      password,
      loginScope: 'STAFF',
      redirect: false
    });
    const code = credentialsSignInCode(result);

    if (code === 'rate-limit' || code === 'auth-unavailable') {
      redirect(`/admin/login?error=${code}`);
    }

    if (code === 'account-invited' || code === 'account-disabled') {
      redirect(`/admin/login?error=${code}`);
    }

    if (code) {
      redirect('/admin/login?error=credentials');
    }
  } catch (error) {
    if (error instanceof AuthError) {
      const securityError = credentialsSecurityError(error);
      if (securityError) {
        redirect(`/admin/login?error=${securityError}`);
      }

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
