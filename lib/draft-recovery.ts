export const DRAFT_PREFIX = 'tempo-draft:v1:';
export const DRAFT_MAX_BYTES = 512_000;
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export type DraftStorage = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>;
export type RecoveryDraft = {
  version: 1; userId: number; surface: 'workout' | 'profile' | 'live'; resource: string;
  writer: string; savedAt: number; baseline: string; payload: string;
};

export function recoveryKey(draft: Pick<RecoveryDraft, 'userId' | 'surface' | 'resource' | 'writer'>) {
  return `${DRAFT_PREFIX}${draft.userId}:${draft.surface}:${encodeURIComponent(draft.resource)}:${draft.writer}`;
}

export function parseRecoveryDraft(raw: string | null, userId: number, surface: RecoveryDraft['surface'], now = Date.now()): RecoveryDraft | null {
  if (!raw || raw.length > DRAFT_MAX_BYTES) return null;
  try {
    const value = JSON.parse(raw) as Partial<RecoveryDraft>;
    const ttl = surface === 'live' ? 24 * 60 * 60 * 1000 : DRAFT_TTL_MS;
    if (!value || value.version !== 1 || value.userId !== userId || value.surface !== surface || typeof value.resource !== 'string' || value.resource.length > 100 || typeof value.writer !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(value.writer) || typeof value.baseline !== 'string' || typeof value.payload !== 'string' || !Number.isFinite(value.savedAt) || value.savedAt! > now + 60_000 || now - value.savedAt! > ttl) return null;
    return value as RecoveryDraft;
  } catch { return null; }
}

export function listRecoveryDrafts(storage: DraftStorage, userId: number, surface: RecoveryDraft['surface'], now = Date.now()) {
  const prefix = `${DRAFT_PREFIX}${userId}:${surface}:`;
  const drafts: RecoveryDraft[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!key?.startsWith(prefix)) continue;
    const draft = parseRecoveryDraft(storage.getItem(key), userId, surface, now);
    if (draft && recoveryKey(draft) === key) drafts.push(draft);
  }
  return drafts.sort((left, right) => right.savedAt - left.savedAt).slice(0, 20);
}

export function saveRecoveryDraft(storage: DraftStorage, draft: RecoveryDraft) {
  const serialized = JSON.stringify(draft);
  if (new TextEncoder().encode(serialized).byteLength > DRAFT_MAX_BYTES) throw new Error('Draft exceeds local recovery limit');
  const prefix = `${DRAFT_PREFIX}${draft.userId}:${draft.surface}:`;
  const stale: string[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith(prefix) && !parseRecoveryDraft(storage.getItem(key), draft.userId, draft.surface, draft.savedAt)) stale.push(key);
  }
  for (const key of stale) storage.removeItem(key);
  // Preserve other tabs' drafts. Never evict recoverable work to make room.
  if (listRecoveryDrafts(storage, draft.userId, draft.surface, draft.savedAt).length >= 20 && !storage.getItem(recoveryKey(draft))) throw new Error('Too many recoverable drafts');
  storage.setItem(recoveryKey(draft), serialized);
}

export function clearUserRecovery(storage: DraftStorage, userId: number) {
  const prefix = `${DRAFT_PREFIX}${userId}:`;
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
}

export function removeRecoveryDraftIfUnchanged(storage: DraftStorage, draft: RecoveryDraft, now = Date.now()) {
  const key = recoveryKey(draft);
  const stored = parseRecoveryDraft(storage.getItem(key), draft.userId, draft.surface, now);
  if (stored && (stored.savedAt !== draft.savedAt || stored.payload !== draft.payload || stored.baseline !== draft.baseline)) return false;
  storage.removeItem(key);
  return true;
}

/** "just now", "12 min ago", "3 hr ago", then a short date: drafts live at most a week. */
export function formatDraftAge(savedAt: number, now: number, locale?: string) {
  const minutes = Math.round((now - savedAt) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}\u00A0min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}\u00A0hr ago`;
  return new Date(savedAt).toLocaleString(locale, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}
