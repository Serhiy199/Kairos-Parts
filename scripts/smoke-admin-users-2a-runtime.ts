import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const port = 3000;
const baseUrl = `http://localhost:${port}`;
const password = process.env.KAIROS_SMOKE_PASSWORD;

if (!password) {
  throw new Error('KAIROS_SMOKE_PASSWORD is required for the local auth smoke check.');
}

const smokePassword: string = password;

async function main() {
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  let serverError = '';
  server.stderr.on('data', (chunk: Buffer) => {
    serverError = `${serverError}${chunk.toString('utf8')}`.slice(-4000);
  });

  try {
    await waitForServer();

    const results = [];
    results.push(await testCredentialsLogin('CLIENT', 'client@test.com', '/client'));
    results.push(await testCredentialsLogin('MANAGER', 'manager@test.com', '/admin'));
    results.push(await testCredentialsLogin('ADMIN', 'admin@test.com', '/admin'));

    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    if (serverError.trim()) {
      console.error(serverError.trim());
    }
    throw error;
  } finally {
    server.kill();
  }
}

void main();

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.ok) return;
    } catch {
      // Server startup is still in progress.
    }

    await delay(250);
  }

  throw new Error('Local Next.js server did not become ready.');
}

async function testCredentialsLogin(role: 'CLIENT' | 'MANAGER' | 'ADMIN', email: string, protectedPath: string) {
  const cookies = new Map<string, string>();
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  collectCookies(csrfResponse, cookies);
  const csrf = (await csrfResponse.json()) as { csrfToken?: string };

  if (!csrf.csrfToken) {
    throw new Error(`${role} smoke did not receive a CSRF token.`);
  }

  const loginResponse = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieHeader(cookies)
    },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      email,
      password: smokePassword,
      callbackUrl: `${baseUrl}${protectedPath}`
    })
  });
  collectCookies(loginResponse, cookies);

  if (![200, 302, 303].includes(loginResponse.status)) {
    throw new Error(`${role} credentials callback returned ${loginResponse.status}.`);
  }

  const protectedResponse = await fetch(`${baseUrl}${protectedPath}`, {
    redirect: 'manual',
    headers: { Cookie: cookieHeader(cookies) }
  });

  if (protectedResponse.status !== 200) {
    throw new Error(
      `${role} protected route returned ${protectedResponse.status}; login=${loginResponse.status}; ` +
        `loginLocation=${loginResponse.headers.get('location') ?? 'none'}; ` +
        `protectedLocation=${protectedResponse.headers.get('location') ?? 'none'}; ` +
        `cookieNames=${[...cookies.keys()].join(',') || 'none'}.`
    );
  }

  return { role, protectedPath, status: protectedResponse.status };
}

function collectCookies(response: Response, cookies: Map<string, string>) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = headers.getSetCookie?.() ?? (headers.get('set-cookie') ? [headers.get('set-cookie') as string] : []);

  for (const value of setCookies) {
    const pair = value.split(';', 1)[0];
    const separator = pair.indexOf('=');
    if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}

function cookieHeader(cookies: Map<string, string>) {
  return [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
}
