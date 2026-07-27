import assert from 'node:assert/strict';

import { buildPublicRedirectUrl } from '@/lib/auth/redirect-url';

const productionHost = 'kairos-parts.com.ua';
const internalOrigin = 'https://localhost:3000';
const forwardedRequest = {
  headers: new Headers({
    'x-forwarded-host': productionHost,
    'x-forwarded-proto': 'https'
  }),
  nextUrl: {
    origin: internalOrigin
  }
};

const clientRedirect = buildPublicRedirectUrl(forwardedRequest, '/login');
clientRedirect.searchParams.set('next', '/client');

assert.equal(
  clientRedirect.toString(),
  `https://${productionHost}/login?next=%2Fclient`
);

const adminRedirect = buildPublicRedirectUrl(forwardedRequest, '/admin/login');
adminRedirect.searchParams.set('next', '/admin');

assert.equal(
  adminRedirect.toString(),
  `https://${productionHost}/admin/login?next=%2Fadmin`
);
assert.doesNotMatch(clientRedirect.toString(), /localhost/);
assert.doesNotMatch(adminRedirect.toString(), /localhost/);

const originalAppBaseUrl = process.env.APP_BASE_URL;

try {
  process.env.APP_BASE_URL = `https://${productionHost}`;

  const configuredRedirect = buildPublicRedirectUrl(
    {
      headers: new Headers(),
      nextUrl: {
        origin: internalOrigin
      }
    },
    '/login'
  );

  assert.equal(configuredRedirect.origin, `https://${productionHost}`);

  delete process.env.APP_BASE_URL;

  const requestOriginRedirect = buildPublicRedirectUrl(
    {
      headers: new Headers(),
      nextUrl: {
        origin: internalOrigin
      }
    },
    '/login'
  );

  assert.equal(requestOriginRedirect.origin, internalOrigin);
} finally {
  if (originalAppBaseUrl === undefined) {
    delete process.env.APP_BASE_URL;
  } else {
    process.env.APP_BASE_URL = originalAppBaseUrl;
  }
}

console.log('productionRedirectOrigin=PASS');
