import { clearUserRecovery } from './draft-recovery.ts';

export function clearClientRecovery(userId: number) {
  try {
    clearUserRecovery(window.localStorage, userId);
    window.localStorage.setItem('tempo-recovery-cleared', JSON.stringify({ userId, at: Date.now() }));
  } catch { /* Other tabs/storage may be unavailable. */ }
  window.dispatchEvent(new CustomEvent('tempo-recovery-cleared', { detail: userId }));
}

/**
 * Load a fresh document after the account session ends. A client-side router
 * transition would keep the Router Cache, SessionProvider state and React state
 * from the signed-in page, so this navigation must not use `router.push()`.
 */
export function loadSignedOutDocument(path: string) {
  window.location.assign(path);
}
