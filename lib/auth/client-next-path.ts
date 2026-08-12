const CLIENT_HOME_PATH = '/client';
const CLIENT_LOGIN_PATH = '/client/login';

function isObsoleteClientLoginPath(nextPath: string) {
  return (
    nextPath === CLIENT_LOGIN_PATH ||
    nextPath.startsWith(`${CLIENT_LOGIN_PATH}?`) ||
    nextPath.startsWith(`${CLIENT_LOGIN_PATH}#`) ||
    nextPath.startsWith(`${CLIENT_LOGIN_PATH}/`)
  );
}

export function getClientNextPath(nextPath: string) {
  if (nextPath === '/request' || nextPath.startsWith('/request?')) {
    return nextPath;
  }

  if (
    (nextPath === CLIENT_HOME_PATH || nextPath.startsWith(`${CLIENT_HOME_PATH}/`)) &&
    !isObsoleteClientLoginPath(nextPath)
  ) {
    return nextPath;
  }

  return CLIENT_HOME_PATH;
}

export function appendClientNextParam(path: string, nextPath: string) {
  const normalizedNext = getClientNextPath(nextPath);

  if (!nextPath || normalizedNext === CLIENT_HOME_PATH) {
    return path;
  }

  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}next=${encodeURIComponent(normalizedNext)}`;
}
