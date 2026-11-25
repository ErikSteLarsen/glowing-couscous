import { getSafeShareCallbackPath } from './share-link.ts';
import { SEND_PATH } from './youtube/send-to-ride.ts';
import { parseYouTubeLink } from './youtube/youtube-url.ts';

const RIDE_PATH = /^\/athlete\/ride(?:\/[1-9]\d*)?$/;
const RIDE_FROM = /^[a-z][a-z-]{0,31}$/;

/** The Send to Wattonaut window (bookmark setup without a link), keeping only a YouTube link `u` and whole seconds `t`. The send key never travels here. */
function sendCallbackPath(url: URL): string | null {
  const u = url.searchParams.get('u');
  if (!u) return SEND_PATH;
  if (!parseYouTubeLink(u)) return null;
  const query = new URLSearchParams();
  const t = url.searchParams.get('t');
  query.set('u', u);
  if (t && /^\d{1,6}$/.test(t)) query.set('t', t);
  return `${SEND_PATH}?${query}`;
}

/**
 * Local path to return to after sign-in, sign-up or setup. Share continuations,
 * ride pages and the Send to Wattonaut window are allowed, so a Wattonaut Ride deep link
 * still opens its workout, and a sent video still reaches the ride, after the
 * visitor signs in. Anything else returns null.
 */
export function getSafeCallbackPath(input: unknown): string | null {
  const share = getSafeShareCallbackPath(input);
  if (share) return share;
  if (typeof input !== 'string' || !input.startsWith('/')) return null;
  try {
    const url = new URL(input, 'https://callback.invalid');
    if (url.origin !== 'https://callback.invalid') return null;
    if (url.pathname === SEND_PATH) return sendCallbackPath(url);
    if (!RIDE_PATH.test(url.pathname)) return null;
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
