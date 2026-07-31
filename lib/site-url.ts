export const PUBLIC_SITE_ORIGIN = 'https://kairos-parts.com.ua';
export const PUBLIC_SITE_URL = new URL(PUBLIC_SITE_ORIGIN);

const LOCAL_DEVELOPMENT_ORIGIN = 'http://localhost:3000';

function normalizeDevelopmentOrigin(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.hostname.endsWith('.vercel.app')
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

export function getAppBaseUrl() {
  if (process.env.NODE_ENV === 'production') {
    return PUBLIC_SITE_ORIGIN;
  }

  return (
    normalizeDevelopmentOrigin(process.env.APP_BASE_URL) ??
    normalizeDevelopmentOrigin(process.env.NEXTAUTH_URL) ??
    LOCAL_DEVELOPMENT_ORIGIN
  );
}

export function buildPublicUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(normalizedPath, PUBLIC_SITE_URL);

  if (url.origin !== PUBLIC_SITE_ORIGIN) {
    throw new Error('Public URL must use the canonical Kairos Parts origin.');
  }

  url.search = '';
  url.hash = '';

  const pathname = url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '');

  return `${PUBLIC_SITE_ORIGIN}${pathname}`;
}

export function buildAbsoluteUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return new URL(normalizedPath, `${getAppBaseUrl()}/`).toString().replace(/\/$/, '');
}
