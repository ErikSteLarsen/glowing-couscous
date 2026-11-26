import { createHash, randomBytes } from 'node:crypto';

import { catalogLineageOf, readSnapshotCatalogLineage, type CatalogLineage } from './catalog-lineage.ts';
import { prisma } from './prisma.ts';
import {
  createSessionEditorDraftFromSharedProjection,
  createSharedProjectionSourceFromSession,
  parseSharedWorkoutProjection,
  isShareToken as isOpaqueShareToken,
  type SharedWorkoutProjection,
} from './share-link.ts';
import {
  normalizeSessionEditorDraft,
  serializeSessionEditorDraft,
  validateSessionEditorDraft,
  type SessionEditorDraft,
} from './session-editor.ts';
import { deserializeSessionSnapshot } from './session-snapshot-service.ts';
import { athletePlannerService } from './athlete-planner-service.ts';
import { templateService } from './template-service.ts';
import { workoutLibraryService } from './workout-library-service.ts';

export type ShareLinkSourceKind = 'session';
export type ShareLinkRole = 'COACH' | 'ATHLETE';

type ShareLinkDatabase = typeof prisma;

type ShareLinkServiceDeps = {
  db?: ShareLinkDatabase;
  createToken?: () => string;
  athletePlannerPersistence?: Pick<typeof athletePlannerService, 'saveSession'>;
  templatePersistence?: Pick<typeof templateService, 'saveForOwner'>;
  workoutLibraryPersistence?: Pick<typeof workoutLibraryService, 'saveForOwner'>;
};

type SessionShareSource = CatalogLineage & {
  id: number;
  athleteId: number | null;
  coachOwnerId: number | null;
  trainingPlanId: number | null;
  coachBaselineJson: string | null;
  status: string;
  sport: string;
  title: string;
  summary: string | null;
  blocks: Array<Record<string, unknown>>;
  athlete: { coachId: number | null } | null;
};

const NOT_FOUND = 'Share link not found.';

export function createShareLinkService({
  db = prisma,
  createToken = () => randomBytes(32).toString('base64url'),
  athletePlannerPersistence = athletePlannerService,
  templatePersistence = templateService,
  workoutLibraryPersistence = workoutLibraryService,
}: ShareLinkServiceDeps = {}) {
  async function loadSnapshot(token: string) {
    if (!isShareToken(token)) return null;
    const link = await db.shareLink.findUnique({
      where: { tokenHash: hashShareToken(token) },
      include: { session: { select: { catalogWorkoutSlug: true, catalogPlanSlug: true, catalogPlanVersion: true } } },
    });
    if (!link || (!link.ownerDeleted && link.sessionId === null)) return null;
    const projection = parseSharedWorkoutProjection(link.snapshotJson);
    if (!projection) return null;
    return {
      projection: link.ownerDeleted ? { ...projection, ownerDeleted: true as const } : projection,
      lineage: readSnapshotCatalogLineage(link.snapshotJson) ?? link.session ?? undefined,
    };
  }

  return {
    async createForUser(userId: number, sourceKind: ShareLinkSourceKind, sourceId: number) {
      if (!Number.isSafeInteger(userId) || userId <= 0 || !Number.isSafeInteger(sourceId) || sourceId <= 0) {
        return { ok: false as const, error: NOT_FOUND, status: 404 };
      }

      const source = await loadAccessibleSource(db, userId, sourceKind, sourceId);
      if (!source) return { ok: false as const, error: NOT_FOUND, status: 404 };

      const projection = projectSessionSource(source.value);
      const lineage = catalogLineageOf(source.value);
      const snapshot = {
        ...projection,
        catalogLineage: lineage.catalogWorkoutSlug || lineage.catalogPlanSlug ? lineage : undefined,
      };
      const token = createToken();
      if (!isOpaqueShareToken(token)) {
        throw new Error('Share token generator returned an invalid token.');
      }

      await db.shareLink.create({
        data: {
          tokenHash: hashShareToken(token),
          sessionId: source.value.id,
          createdById: userId,
          snapshotJson: JSON.stringify(snapshot),
        },
      });

      return {
        ok: true as const,
        url: `/share/${token}`,
        sourceKind,
        sourceId,
      };
    },

    async loadPreview(token: string): Promise<(SharedWorkoutProjection & { ownerDeleted?: boolean }) | null> {
      return (await loadSnapshot(token))?.projection ?? null;
    },

    async saveTemplateCopy(userId: number, token: string, input: unknown) {
      const snapshot = await loadSnapshot(token);
      if (!snapshot) return { ok: false as const, error: NOT_FOUND, status: 404 };
      const draftResult = createImportedDraft(snapshot.projection, input, null);
      if (!draftResult.ok) return draftResult;

      // The plan references the saved recipient copy of the shared workout.
      const serialized = serializeSessionEditorDraft(draftResult.draft);
      const workout = await workoutLibraryPersistence.saveForOwner('athlete', userId, {
        ...serialized,
        scheduledDate: null,
        templateId: null,
      }, undefined, snapshot.lineage);
      if (!workout.ok) return workout;
      const template = await templatePersistence.saveForOwner(userId, {
        name: serialized.title,
        summary: serialized.summary ?? '',
        entries: [{ weekday: 0, workoutId: workout.sessionId }],
      });
      if (template.error) return { ok: false as const, error: template.error, status: 400 };
      return { ok: true as const };
    },

    /** An athlete's own copy in My workouts, e.g. to place it with the Calendar's Add workout. */
    async saveLibraryCopy(userId: number, token: string, input: unknown) {
      const snapshot = await loadSnapshot(token);
      if (!snapshot) return { ok: false as const, error: NOT_FOUND, status: 404 };
      const draftResult = createImportedDraft(snapshot.projection, input, null);
      if (!draftResult.ok) return draftResult;
      const result = await workoutLibraryPersistence.saveForOwner('athlete', userId, {
        ...serializeSessionEditorDraft(draftResult.draft),
        scheduledDate: null,
        templateId: null,
      }, undefined, snapshot.lineage);
      if (!result.ok) return result;
      return { ok: true as const, sessionIds: [result.sessionId] };
    },

    async savePlannerCopy(userId: number, role: ShareLinkRole, token: string, input: unknown) {
      const snapshot = await loadSnapshot(token);
      if (!snapshot) return { ok: false as const, error: NOT_FOUND, status: 404 };
      const draftResult = createImportedDraft(snapshot.projection, input, role === 'ATHLETE' ? 'planner' : null);
      if (!draftResult.ok) return draftResult;

      const serialized = serializeSessionEditorDraft(draftResult.draft);
      if (role === 'ATHLETE') {
        const result = await athletePlannerPersistence.saveSession(userId, {
          ...serialized,
          dates: serialized.scheduledDate ? [serialized.scheduledDate] : [],
          templateId: null,
        }, undefined, snapshot.lineage);
        if (!result.ok) return result;
        return { ok: true as const, sessionIds: result.sessionIds };
      }

      const result = await workoutLibraryPersistence.saveForOwner('coach', userId, {
        ...serialized,
        scheduledDate: null,
        templateId: null,
      }, undefined, snapshot.lineage);
      if (!result.ok) return result;
      return { ok: true as const, sessionIds: [result.sessionId] };
    },
  };
}

export function hashShareToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function isShareToken(token: unknown): token is string {
  return isOpaqueShareToken(token);
}

function createImportedDraft(
  projection: SharedWorkoutProjection,
  input: unknown,
  action: 'planner' | null,
): { ok: true; draft: SessionEditorDraft } | { ok: false; error: string; status: 400 } {
  const sourceDraft = createSessionEditorDraftFromSharedProjection(projection);
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const rawRecord = raw as Record<string, unknown>;
  const draft = normalizeSessionEditorDraft({
    ...rawRecord,
    mode: 'create',
    id: null,
    athleteId: null,
    coachOwnerId: null,
    trainingPlanId: null,
    planId: null,
    templateId: null,
    assignedById: null,
    planWeekday: null,
    sport: rawRecord.sport ?? sourceDraft.sport,
    title: rawRecord.title ?? sourceDraft.title,
    summary: rawRecord.summary ?? sourceDraft.summary,
    blocks: rawRecord.blocks ?? sourceDraft.blocks,
    status: 'planned',
    source: 'share',
    adjusted: false,
    coachNotes: '',
    athleteNotes: '',
    rpe: null,
    scheduledDate: action === 'planner' ? rawRecord.scheduledDate ?? null : null,
  });
  const validationError = validateSessionEditorDraft(draft);
  if (validationError) return { ok: false, error: validationError, status: 400 };
  return { ok: true, draft };
}

function projectSessionSource(source: SessionShareSource) {
  const baseline = source.status === 'completed'
    ? deserializeSessionSnapshot('planned', source.coachBaselineJson)
    : null;
  return createSharedProjectionSourceFromSession(
    {
      sport: source.sport,
      title: source.title,
      summary: source.summary,
      blocks: source.blocks,
    },
    baseline,
  );
}

async function loadAccessibleSource(
  db: ShareLinkDatabase,
  userId: number,
  sourceKind: ShareLinkSourceKind,
  sourceId: number,
): Promise<
  | { kind: 'session'; value: SessionShareSource }
  | null
> {
  if (sourceKind !== 'session') return null;
  const session = await db.session.findUnique({
    where: { id: sourceId },
    include: {
      blocks: { orderBy: { sortOrder: 'asc' } },
      athlete: { select: { coachId: true } },
    },
  });
  if (!session || session.trainingPlanId !== null || !canAccessSession(userId, session as unknown as SessionShareSource)) {
    return null;
  }
  return { kind: 'session', value: session as unknown as SessionShareSource };
}

function canAccessSession(userId: number, session: SessionShareSource) {
  if (session.athleteId === userId) return true;
  if (
    session.athleteId === null &&
    session.trainingPlanId === null &&
    session.coachOwnerId === userId
  ) {
    return true;
  }
  return session.athlete?.coachId === userId;
}

export const shareLinkService = createShareLinkService();
