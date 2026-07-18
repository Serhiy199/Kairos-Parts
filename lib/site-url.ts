export function getAppBaseUrl() {
  return (process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || 'https://kairos-parts.vercel.app').replace(/\/$/, '');
}

export function buildAbsoluteUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${getAppBaseUrl()}${normalizedPath}`;
}
