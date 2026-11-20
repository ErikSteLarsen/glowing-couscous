'use client';

import { hasRecordedData, parseCheckpoint, serializeCheckpoint, type RideRecording } from './recorder.ts';

const PREFIX = 'tempo:ride:v1:';

export function rideStorageKey(sessionId: number) {
  return `${PREFIX}${sessionId}`;
}

export type StoredRide = { key: string; savedAtMs: number; recording: RideRecording };

/** Writes the checkpoint to this browser and, inside Tempo Ride desktop, to its disk store. */
export function saveRideCheckpoint(recording: RideRecording): void {
  const json = serializeCheckpoint(recording, Date.now());
  const key = rideStorageKey(recording.sessionId);
  try {
    localStorage.setItem(key, json);
  } catch {
    // Storage can be full or blocked; the desktop copy and the in-memory ride remain.
  }
  window.tempoDesktop?.saveRecording(key, json).catch(() => undefined);
}

export function clearRideCheckpoint(sessionId: number): void {
  const key = rideStorageKey(sessionId);
  try {
    localStorage.removeItem(key);
  } catch {
    // Best effort.
  }
  window.tempoDesktop?.deleteRecording(key).catch(() => undefined);
}

/** Unsaved rides from this browser and the desktop store; the newest copy per session wins. */
export async function listStoredRides(sessionId?: number): Promise<StoredRide[]> {
  const requestedKey = sessionId === undefined ? null : rideStorageKey(sessionId);
  const byKey = new Map<string, StoredRide>();
  const consider = (key: string, json: string | null) => {
    if (requestedKey ? key !== requestedKey : !key.startsWith(PREFIX)) return;
    const parsed = parseCheckpoint(json);
    if (!parsed || key !== rideStorageKey(parsed.recording.sessionId) || !hasRecordedData(parsed.recording)) return;
    const existing = byKey.get(key);
    if (!existing || existing.savedAtMs < parsed.savedAtMs) byKey.set(key, { key, ...parsed });
  };
  try {
    if (requestedKey) consider(requestedKey, localStorage.getItem(requestedKey));
    else {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(PREFIX)) consider(key, localStorage.getItem(key));
      }
    }
  } catch {
    // Ignore unavailable storage.
  }
  try {
    for (const entry of (await window.tempoDesktop?.listRecordings()) ?? []) consider(entry.key, entry.json);
  } catch {
    // The desktop bridge is optional.
  }
  return [...byKey.values()].sort((left, right) => right.savedAtMs - left.savedAtMs);
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
