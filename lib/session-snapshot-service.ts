import { prisma } from './prisma.ts';
import {
  createSessionEditorDraftFromPersisted,
  hasBaselineActualDifference,
  serializeSessionEditorDraft,
  validateSessionEditorDraft,
  type SessionEditorDraft,
  type SessionEditorMode,
  type PersistedSessionRecord,
} from './session-editor.ts';

const MAX_NOTES_LENGTH = 2000;
const SNAPSHOT_VERSION = 1;

type SnapshotDatabase = {
  session: {
    findUnique(args: unknown): Promise<{ coachBaselineJson: string | null } | null>;
    update(args: unknown): Promise<unknown>;
  };
  activity: {
    findUnique(args: unknown): Promise<{ actualSnapshotJson: string | null } | null>;
    update(args: unknown): Promise<unknown>;
  };
};

type SnapshotPayload = ReturnType<typeof serializeSessionEditorDraft> & {
  snapshotVersion: typeof SNAPSHOT_VERSION;
};

export type SessionSnapshotResult =
  | { ok: true; snapshot: SnapshotPayload }
  | { ok: false; status: 400; error: string };

export function serializeSessionSnapshot(draft: SessionEditorDraft): string {
  return JSON.stringify({
    snapshotVersion: SNAPSHOT_VERSION,
    ...serializeSessionEditorDraft(draft),
  });
}

export function deserializeSessionSnapshot(mode: SessionEditorMode, input: string | null | undefined): SessionEditorDraft | null {
  if (!input) return null;

  try {
    const parsed: unknown = JSON.parse(input);
    if (!parsed || typeof parsed !== 'object') return null;
    return createSessionEditorDraftFromPersisted(mode, parsed);
  } catch {
    return null;
  }
}

export function createSessionSnapshotJson(input: PersistedSessionRecord): string {
  return serializeSessionSnapshot(createSessionEditorDraftFromPersisted('planned', input));
}

export function projectSessionSnapshotJson(
  baselineJson: string | null | undefined,
  actualJson: string | null | undefined,
) {
  const baseline = deserializeSessionSnapshot('planned', baselineJson);
  const actualCandidate = deserializeSessionSnapshot('actual', actualJson);
  return {
    baseline,
    actual: actualCandidate && (!baseline || hasBaselineActualDifference(baseline, actualCandidate)) ? actualCandidate : null,
  };
}

export function validateSessionSnapshotDraft(draft: SessionEditorDraft): string | null {
  const editorError = validateSessionEditorDraft(draft);
  if (editorError) return editorError;
  if (draft.coachNotes.length > MAX_NOTES_LENGTH || draft.athleteNotes.length > MAX_NOTES_LENGTH) {
    return 'Your note is too long.';
  }
  return null;
}

export function createSessionSnapshotService({
  db = prisma as unknown as SnapshotDatabase,
}: {
  db?: SnapshotDatabase;
} = {}) {
  return {
    async saveCoachBaseline(sessionId: number, draft: SessionEditorDraft): Promise<SessionSnapshotResult> {
      const validationError = validateSessionSnapshotDraft(draft);
      if (validationError) return { ok: false, status: 400, error: validationError };

      const snapshot = createPayload(draft);
      await db.session.update({
        where: { id: sessionId },
        data: {
          coachBaselineJson: JSON.stringify(snapshot),
          coachNotes: snapshot.coachNotes,
          rpe: snapshot.rpe,
        },
      });
      return { ok: true, snapshot };
    },

    async saveActual(sessionId: number, draft: SessionEditorDraft): Promise<SessionSnapshotResult> {
      const validationError = validateSessionSnapshotDraft(draft);
      if (validationError) return { ok: false, status: 400, error: validationError };

      const snapshot = createPayload(draft);
      await db.activity.update({
        where: { sessionId },
        data: {
          actualSnapshotJson: JSON.stringify(snapshot),
          notes: snapshot.athleteNotes,
          rpe: snapshot.rpe,
        },
      });
      return { ok: true, snapshot };
    },

    async loadSnapshots(sessionId: number) {
      const [session, activity] = await Promise.all([
        db.session.findUnique({
          where: { id: sessionId },
          select: { coachBaselineJson: true },
        }),
        db.activity.findUnique({
          where: { sessionId },
          select: { actualSnapshotJson: true },
        }),
      ]);
      return projectSessionSnapshotJson(session?.coachBaselineJson, activity?.actualSnapshotJson);
    },
  };
}

function createPayload(draft: SessionEditorDraft): SnapshotPayload {
  return {
    snapshotVersion: SNAPSHOT_VERSION,
    ...serializeSessionEditorDraft(draft),
  };
}

export const sessionSnapshotService = createSessionSnapshotService();
