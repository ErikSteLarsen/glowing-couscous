import { clearUserRecovery } from './draft-recovery.ts';

export function clearClientRecovery(userId: number) {
  try {
    clearUserRecovery(window.localStorage, userId);
    window.localStorage.setItem('tempo-recovery-cleared', JSON.stringify({ userId, at: Date.now() }));
  } catch { /* Other tabs/storage may be unavailable. */ }
  window.dispatchEvent(new CustomEvent('tempo-recovery-cleared', { detail: userId }));
}
