import test from 'node:test';
import assert from 'node:assert/strict';
import { DRAFT_TTL_MS, clearUserRecovery, listRecoveryDrafts, parseRecoveryDraft, recoveryKey, removeRecoveryDraftIfUnchanged, saveRecoveryDraft, type DraftStorage, type RecoveryDraft } from '../lib/draft-recovery.ts';
import { parseProfileRecovery } from '../lib/profile-recovery.ts';
import { createEmptyPerformanceProfile } from '../lib/performance-profile.ts';
import { parseWorkoutRecovery } from '../lib/workout-recovery.ts';

function storage(): DraftStorage {
  const map = new Map<string, string>();
  return { get length() { return map.size; }, key: (index) => [...map.keys()][index] ?? null, getItem: (key) => map.get(key) ?? null, setItem: (key, value) => { map.set(key, value); }, removeItem: (key) => { map.delete(key); } };
}
const now = 1_800_000_000_000;
function draft(overrides: Partial<RecoveryDraft> = {}): RecoveryDraft {
  return { version: 1, userId: 7, surface: 'workout', resource: 'new', writer: 'tab-one', savedAt: now, baseline: '', payload: '{}', ...overrides };
}

test('adopting or discarding a snapshot cannot erase newer work from the original tab', () => {
  const store = storage(); const original = draft();
  saveRecoveryDraft(store, original);
  saveRecoveryDraft(store, draft({ savedAt: now + 1, payload: 'newer work' }));
  assert.equal(removeRecoveryDraftIfUnchanged(store, original, now + 1), false);
  assert.equal(listRecoveryDrafts(store, 7, 'workout', now + 1)[0].payload, 'newer work');
  const latest = listRecoveryDrafts(store, 7, 'workout', now + 1)[0];
  assert.equal(removeRecoveryDraftIfUnchanged(store, latest, now + 1), true);
});

test('recovery isolates accounts and preserves independent tab drafts and unrelated storage', () => {
  const store = storage(); store.setItem('theme', 'dark');
  saveRecoveryDraft(store, draft());
  saveRecoveryDraft(store, draft({ writer: 'tab-two', payload: '{"title":"other"}' }));
  saveRecoveryDraft(store, draft({ userId: 8 }));
  assert.equal(listRecoveryDrafts(store, 7, 'workout', now).length, 2);
  assert.equal(listRecoveryDrafts(store, 8, 'workout', now).length, 1);
  clearUserRecovery(store, 7);
  assert.equal(listRecoveryDrafts(store, 7, 'workout', now).length, 0);
  assert.equal(listRecoveryDrafts(store, 8, 'workout', now).length, 1);
  assert.equal(store.getItem('theme'), 'dark');
});

test('recovery rejects invalid/versioned/expired state and prunes only expired owned entries when saving', () => {
  const store = storage();
  const old = draft({ savedAt: now - DRAFT_TTL_MS - 1 });
  store.setItem(recoveryKey(old), JSON.stringify(old));
  assert.equal(parseRecoveryDraft(JSON.stringify(old), 7, 'workout', now), null);
  for (const raw of ['null', '{', JSON.stringify({ ...draft(), version: 2 }), JSON.stringify({ ...draft(), userId: 8 }), JSON.stringify({ ...draft(), savedAt: now + 120000 })]) assert.equal(parseRecoveryDraft(raw, 7, 'workout', now), null);
  saveRecoveryDraft(store, draft({ writer: 'fresh' }));
  assert.equal(store.getItem(recoveryKey(old)), null);
  assert.equal(parseRecoveryDraft(JSON.stringify(draft({ surface: 'live', savedAt: now - 25 * 60 * 60 * 1000 })), 7, 'live', now), null);
});

test('oversized or unavailable storage never overwrites an existing draft', () => {
  const store = storage(); saveRecoveryDraft(store, draft());
  assert.throws(() => saveRecoveryDraft(store, draft({ payload: 'x'.repeat(600_000) })));
  assert.equal(parseRecoveryDraft(store.getItem(recoveryKey(draft())), 7, 'workout', now)?.payload, '{}');
  const blocked = { ...store, setItem() { throw new Error('QuotaExceeded'); } };
  assert.throws(() => saveRecoveryDraft(blocked, draft({ writer: 'new-tab' })));
});

test('profile recovery preserves unfinished pace/time input but rejects malformed objects', () => {
  const customizedZones = Object.fromEntries([1, 2, 3, 4, 5].map((zone) => [zone, true]));
  const paceDrafts = Object.fromEntries([1, 2, 3, 4, 5].map((zone) => [zone, { fastest: '4:', slowest: '' }]));
  const payload = JSON.stringify({ name: 'Runner', profile: createEmptyPerformanceProfile(), raceTimeDraft: '1:', customizedZones, paceDrafts });
  assert.equal(parseProfileRecovery(payload)?.paceDrafts[1].fastest, '4:');
  assert.equal(parseProfileRecovery(payload)?.raceTimeDraft, '1:');
  assert.equal(parseProfileRecovery('{"profile":{}}'), null);
  assert.equal(parseProfileRecovery('null'), null);
  assert.equal(parseWorkoutRecovery('{"draft":{"blocks":"bad"}}'), null);
});
