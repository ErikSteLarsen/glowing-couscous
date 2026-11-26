import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecording, finishRecording, startRecording, tick } from '../lib/ride/recorder.ts';
import { createRidePlan } from '../lib/ride/ride-plan.ts';
import { createEmptyPerformanceProfile } from '../lib/performance-profile.ts';
import { rideStorageKey, saveStoredRide } from '../lib/ride/recording-store.ts';

const store = new Map<string, string>();
Object.assign(globalThis, {
  window: {},
  localStorage: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value), removeItem: (key: string) => store.delete(key) },
});

function finishedRide() {
  const ride = createRidePlan([], createEmptyPerformanceProfile());
  const start = Date.UTC(2026, 10, 20, 7);
  let rec = startRecording(createRecording(404, 'Deleted session', ride), ride, start);
  rec = tick(rec, ride, start + 5000, { powerWatts: 200, heartRateBpm: null, cadenceRpm: 90, speedMetersPerSecond: 9 });
  return finishRecording(rec, ride, start + 5000);
}

test('saving an orphaned ride posts it without its session and clears the checkpoint', async () => {
  const recording = finishedRide();
  store.set(rideStorageKey(3, 404), 'checkpoint');
  const bodies: Array<Record<string, unknown>> = [];
  const result = await saveStoredRide(3, recording, { standalone: true }, async (url, init) => {
    assert.equal(url, '/api/activity-imports');
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ ok: true, activityId: 9, sessionId: 81, duplicate: false }, { status: 201 });
  });
  assert.deepEqual(result, { ok: true, sessionId: 81, duplicate: false });
  assert.equal('plannedSessionId' in bodies[0], false);
  assert.equal(bodies[0].sport, 'BIKING');
  assert.equal(store.has(rideStorageKey(3, 404)), false);
});

test('a failed save keeps the checkpoint and reports the server error', async () => {
  store.set(rideStorageKey(3, 404), 'checkpoint');
  const result = await saveStoredRide(3, finishedRide(), { standalone: true }, async () => Response.json({ error: 'Account not found.' }, { status: 404 }));
  assert.deepEqual(result, { ok: false, error: 'Account not found.' });
  assert.equal(store.has(rideStorageKey(3, 404)), true);
  const offline = await saveStoredRide(3, finishedRide(), { standalone: true }, async () => { throw new TypeError('offline'); });
  assert.equal(offline.ok, false);
  assert.equal(store.has(rideStorageKey(3, 404)), true);
});

test('an unsaved ride saves to its own workout, on the day it was ridden', async () => {
  const bodies: Array<Record<string, unknown>> = [];
  await saveStoredRide(3, finishedRide(), { standalone: false }, async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ ok: true, activityId: 9, sessionId: 404, duplicate: false }, { status: 201 });
  });
  assert.equal(bodies[0].plannedSessionId, 404);
  assert.match(String(bodies[0].localDay), /^2026-11-(19|20|21)$/);
});
