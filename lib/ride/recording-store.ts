'use client';

import { hasRecordedData, parseCheckpoint, serializeCheckpoint, toImportPayload, type RideRecording } from './recorder.ts';

/** Keys written before per-user scoping carry no owner; the server must confirm ownership before use. */
const LEGACY_PREFIX = 'tempo:ride:v1:';
/** Desktop stores accept 1–120 chars of [A-Za-z0-9_-], so the owner and session go in a dash-separated key. */
const userPrefix = (userId: number) => `tempo-ride-v2-${userId}-`;

export function rideStorageKey(userId: number, sessionId: number) {
  return `${userPrefix(userId)}${sessionId}`;
}

export function legacyRideStorageKey(sessionId: number) {
  return `${LEGACY_PREFIX}${sessionId}`;
}

/** `legacy` rides have no recorded owner and are shown only after the server confirms the session is the rider's. */
export type StoredRide = { key: string; savedAtMs: number; legacy: boolean; recording: RideRecording };

function removeEverywhere(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Best effort.
  }
  window.tempoDesktop?.deleteRecording(key).catch(() => undefined);
}

const retiredLegacySessions = new Set<number>();

/**
 * Writes the checkpoint to this browser and, inside Tempo Ride desktop, to its disk store.
 * Only call it for a session the server has confirmed belongs to `userId`; a legacy copy of it is then retired.
 */
export function saveRideCheckpoint(userId: number, recording: RideRecording): void {
  const json = serializeCheckpoint(recording, Date.now());
  const key = rideStorageKey(userId, recording.sessionId);
  try {
    localStorage.setItem(key, json);
  } catch {
    // Storage can be full or blocked; the desktop copy and the in-memory ride remain.
  }
  window.tempoDesktop?.saveRecording(key, json).catch(() => undefined);
  if (!retiredLegacySessions.has(recording.sessionId)) {
    retiredLegacySessions.add(recording.sessionId);
    removeEverywhere(legacyRideStorageKey(recording.sessionId));
  }
}

/** Removes the rider's copy and any legacy copy; only call it for a session confirmed to be the rider's. */
export function clearRideCheckpoint(userId: number, sessionId: number): void {
  removeEverywhere(rideStorageKey(userId, sessionId));
  removeEverywhere(legacyRideStorageKey(sessionId));
}

/**
 * The rider's unsaved rides plus unowned legacy ones from this browser and the desktop store; the newest copy per
 * session wins. Other users' checkpoints are never returned.
 */
export async function listStoredRides(userId: number, sessionId?: number): Promise<StoredRide[]> {
  const prefix = userPrefix(userId);
  const bySession = new Map<number, StoredRide>();
  const consider = (key: string | null, json: string | null) => {
    if (!key) return;
    const legacy = key.startsWith(LEGACY_PREFIX);
    if (!legacy && !key.startsWith(prefix)) return;
    const parsed = parseCheckpoint(json);
    if (!parsed || !hasRecordedData(parsed.recording)) return;
    const id = parsed.recording.sessionId;
    if ((sessionId !== undefined && id !== sessionId) || key !== (legacy ? legacyRideStorageKey(id) : rideStorageKey(userId, id))) return;
    const existing = bySession.get(id);
    if (!existing || existing.savedAtMs < parsed.savedAtMs) bySession.set(id, { key, legacy, ...parsed });
  };
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      consider(key, key ? localStorage.getItem(key) : null);
    }
  } catch {
    // Ignore unavailable storage.
  }
  try {
    for (const entry of (await window.tempoDesktop?.listRecordings()) ?? []) consider(entry.key, entry.json);
  } catch {
    // The desktop bridge is optional.
  }
  return [...bySession.values()].sort((left, right) => right.savedAtMs - left.savedAtMs);
}

export type RideSessionStatus = 'planned' | 'skipped' | 'completed';
export type ClassifiedRide = { ride: StoredRide; state: 'open' | 'closed' };

/**
 * Decides what the rider may do with each stored ride given the statuses of sessions the server confirmed they own.
 * Legacy rides without a confirmed owner stay hidden (and are never deleted); the rider's own rides whose session is
 * gone, skipped or completed are `closed`, so only a backup or discard is offered.
 */
export function classifyStoredRides(rides: StoredRide[], ownedStatuses: ReadonlyMap<number, RideSessionStatus>): ClassifiedRide[] {
  return rides.flatMap((ride) => {
    const status = ownedStatuses.get(ride.recording.sessionId);
    if (ride.legacy && !status) return [];
    return [{ ride, state: status === 'planned' ? 'open' as const : 'closed' as const }];
  });
}

export type StoredRideSaveResult = { ok: true; sessionId: number; duplicate: boolean } | { ok: false; error: string };

/**
 * Saves an unsaved ride and clears its checkpoint: to its workout, or (`standalone`, when that is gone, skipped or
 * completed) as its own completed activity.
 * Retries are safe: the importer returns the existing activity for the same recording.
 */
export async function saveStoredRide(userId: number, recording: RideRecording, { standalone }: { standalone: boolean }, fetcher: typeof fetch = fetch): Promise<StoredRideSaveResult> {
  let response: Response;
  try {
    response = await fetcher('/api/activity-imports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toImportPayload(recording, { standalone })),
    });
  } catch {
    return { ok: false, error: 'Could not reach Tempo.' };
  }
  const body = (await response.json().catch(() => null)) as { sessionId?: unknown; duplicate?: unknown; error?: unknown } | null;
  if (!response.ok || typeof body?.sessionId !== 'number') {
    return { ok: false, error: typeof body?.error === 'string' ? body.error : 'Tempo could not save this ride.' };
  }
  clearRideCheckpoint(userId, recording.sessionId);
  return { ok: true, sessionId: body.sessionId, duplicate: body.duplicate === true };
}

export function downloadRideBackup(recording: RideRecording): void {
  const blob = new Blob([serializeCheckpoint(recording, Date.now())], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `tempo-ride-${recording.sessionId}-${new Date(recording.startedAtMs ?? Date.now()).toISOString().slice(0, 19).replace(/:/g, '')}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
