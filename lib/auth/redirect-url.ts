type RedirectRequest = {
  headers: Headers;
  nextUrl: {
    origin: string;
  };
};

function firstHeaderValue(value: string | null) {
  return value?.split(',', 1)[0]?.trim() || null;
}

function parseHttpOrigin(value: string) {
  try {
    const url = new URL(value);

    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

export function buildPublicRedirectUrl(request: RedirectRequest, pathname: string) {
  const forwardedHost = firstHeaderValue(request.headers.get('x-forwarded-host'));
  const forwardedProto = firstHeaderValue(request.headers.get('x-forwarded-proto'))?.toLowerCase();
  const forwardedOrigin =
    forwardedHost && (forwardedProto === 'http' || forwardedProto === 'https')
      ? parseHttpOrigin(`${forwardedProto}://${forwardedHost}`)
      : null;
  const configuredOrigin = process.env.APP_BASE_URL
    ? parseHttpOrigin(process.env.APP_BASE_URL.trim())
    : null;
  const requestOrigin = parseHttpOrigin(request.nextUrl.origin);
  const publicOrigin = forwardedOrigin ?? configuredOrigin ?? requestOrigin;

  if (!publicOrigin) {
    throw new Error('Unable to determine a valid public redirect origin.');
  }

  return new URL(pathname, publicOrigin);
}
