import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { appendClientNextParam, getClientNextPath } from '../lib/auth/client-next-path';

const root = process.cwd();

const acceptedNextPaths = [
  '/client',
  '/client/profile',
  '/client/requests/KP-1',
  '/request',
  '/request?vehicleId=vehicle-1'
];

for (const nextPath of acceptedNextPaths) {
  assert.equal(getClientNextPath(nextPath), nextPath, `Expected ${nextPath} to remain an allowed client destination`);
}

const rejectedNextPaths = [
  '',
  '/client/login',
  '/client/login?error=session-expired',
  '/client/login#retry',
  '/client/login/legacy',
  '/admin',
  '/login',
  '//example.com/client',
  'https://example.com/client',
  'javascript:alert(1)'
];

for (const nextPath of rejectedNextPaths) {
  assert.equal(getClientNextPath(nextPath), '/client', `Expected ${nextPath || '<empty>'} to fall back to /client`);
}

assert.equal(
  appendClientNextParam('/login?registered=1', '/client/login'),
  '/login?registered=1',
  'Registration must discard the obsolete client login destination'
);
assert.equal(
  appendClientNextParam('/login?registered=1', '/client/profile'),
  '/login?registered=1&next=%2Fclient%2Fprofile',
  'Registration must preserve an allowed client destination'
);

async function main() {
  const actionsSource = await readFile(path.join(root, 'app', '(auth)', 'actions.ts'), 'utf8');
  const middlewareSource = await readFile(path.join(root, 'middleware.ts'), 'utf8');

  assert.match(actionsSource, /redirect\(getClientNextPath\(nextPath\)\)/, 'Client login must normalize the final destination');
  assert.match(
    actionsSource,
    /redirect\(appendNextParam\('\/login\?registered=1', nextPath\)\)/,
    'Registration success must normalize or discard next'
  );
  assert.match(
    actionsSource,
    /nextPath !== '\/admin\/login' \? nextPath : '\/admin'/,
    'Staff login fallback must remain unchanged'
  );
  assert.match(
    middlewareSource,
    /redirectUrl\.searchParams\.set\('next', pathname\)/,
    'Regression evidence must retain the audited source of the stale next value'
  );
  assert.match(middlewareSource, /isSessionExpiredLogin/, 'Stale-session login handling must remain present');

  console.log('Client login redirect regression check passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
