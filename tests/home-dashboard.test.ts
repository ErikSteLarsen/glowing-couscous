import test from 'node:test';
import assert from 'node:assert/strict';
import { createAthleteService } from '../lib/athlete-service.ts';

function session(id: number, coachNotes: string, completed = false) {
  return {
    id, title: `Session ${id}`, summary: null, sport: 'RUNNING', date: new Date(),
    timeLabel: null, status: completed ? 'completed' : 'planned', adjusted: false,
    coachNotes, blocks: [],
    activity: completed ? { tss: 20, durationSec: 1800, metricsSource: 'manual', segmentsJson: null } : null,
  };
}

for (const nextNote of ['Evening instructions', '']) {
  test(`Home coach note belongs to next open session (${nextNote ? 'with note' : 'without note'})`, async () => {
    const service = createAthleteService({
      db: { user: { async findUnique() {
        return {
          id: 7, role: 'ATHLETE', name: 'Mara', prefsJson: null,
          coach: { id: 2, name: 'Coach', email: 'coach@example.com' }, activities: [],
          sessions: [session(1, 'Completed morning instructions', true), session(2, nextNote)],
        };
      } } } as never,
    });
    const dashboard = await service.loadHomeDashboard(7);
    assert.ok(dashboard);
    assert.deepEqual(dashboard.coachNote, nextNote ? { sessionTitle: 'Session 2', text: nextNote } : null);
  });
}
