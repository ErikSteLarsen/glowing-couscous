import { getSafeShareCallbackPath } from './share-link.ts';

const RIDE_PATH = /^\/athlete\/ride(?:\/[1-9]\d*)?$/;
const RIDE_FROM = /^[a-z][a-z-]{0,31}$/;

/**
 * Local path to return to after sign-in, sign-up or setup. Share continuations
 * and ride pages are allowed, so a Tempo Ride deep link still opens its workout
 * after the visitor signs in. Anything else returns null.
 */
export function getSafeCallbackPath(input: unknown): string | null {
  const share = getSafeShareCallbackPath(input);
  if (share) return share;
  if (typeof input !== 'string' || !input.startsWith('/')) return null;
  try {
    const url = new URL(input, 'https://callback.invalid');
    if (url.origin !== 'https://callback.invalid' || !RIDE_PATH.test(url.pathname)) return null;
    const from = url.searchParams.get('from');
    return from && RIDE_FROM.test(from) ? `${url.pathname}?from=${from}` : url.pathname;
  } catch {
    return null;
  }
}

/** Login URL that returns to `path` (with its query) when that path is an allowed callback. */
export function loginPathFor(path: string): string {
  const callback = getSafeCallbackPath(path);
  return callback ? `/login?callbackUrl=${encodeURIComponent(callback)}` : '/login';
}
