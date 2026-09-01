import { createHash, randomBytes } from 'node:crypto';

import { prisma } from './prisma.ts';
import {
  createSessionEditorDraftFromSharedProjection,
  createSharedProjectionSourceFromSession,
  createSharedWorkoutProjection,
  parseSharedWorkoutProjection,
  isShareToken as isOpaqueShareToken,
  type ShareLinkAction,
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
import { coachSessionLibraryService } from './coach-session-library-service.ts';
import { templateService } from './template-service.ts';

export type ShareLinkSourceKind = 'session' | 'template';
export type ShareLinkRole = 'COACH' | 'ATHLETE';

type ShareLinkDatabase = typeof prisma;

type ShareLinkServiceDeps = {
  db?: ShareLinkDatabase;
  createToken?: () => string;
  templatePersistence?: Pick<typeof templateService, 'saveForOwner'>;
  athletePlannerPersistence?: Pick<typeof athletePlannerService, 'saveSession'>;
  coachLibraryPersistence?: Pick<typeof coachSessionLibraryService, 'saveForCoach'>;
};

type SessionShareSource = {
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

type TemplateShareSource = {
  id: number;
  ownerId: number;
  name: string;
  sport: string;
  summary: string | null;
  blocks: Array<Record<string, unknown>>;
};

const NOT_FOUND = 'Share link not found.';

export function createShareLinkService({
  db = prisma,
  createToken = () => randomBytes(32).toString('base64url'),
  templatePersistence = templateService,
  athletePlannerPersistence = athletePlannerService,
  coachLibraryPersistence = coachSessionLibraryService,
}: ShareLinkServiceDeps = {}) {
  const service = {
    async createForUser(userId: number, sourceKind: ShareLinkSourceKind, sourceId: number) {
      if (!Number.isSafeInteger(userId) || userId <= 0 || !Number.isSafeInteger(sourceId) || sourceId <= 0) {
        return { ok: false as const, error: NOT_FOUND, status: 404 };
      }

      const source = await loadAccessibleSource(db, userId, sourceKind, sourceId);
      if (!source) return { ok: false as const, error: NOT_FOUND, status: 404 };

      const projection = source.kind === 'session'
        ? projectSessionSource(source.value)
        : createSharedWorkoutProjection({
            sourceKind: 'template',
            sport: source.value.sport,
            name: source.value.name,
            summary: source.value.summary,
            blocks: source.value.blocks,
          });
      const token = createToken();
      if (!isOpaqueShareToken(token)) {
        throw new Error('Share token generator returned an invalid token.');
      }

      await db.shareLink.create({
        data: {
          tokenHash: hashShareToken(token),
          sessionId: source.kind === 'session' ? source.value.id : null,
          templateId: source.kind === 'template' ? source.value.id : null,
          createdById: userId,
          snapshotJson: JSON.stringify(projection),
        },
      });

      return {
        ok: true as const,
        url: `/share/${token}`,
        sourceKind,
        sourceId,
      };
    },

    async loadPreview(token: string): Promise<SharedWorkoutProjection | null> {
      if (!isShareToken(token)) return null;
      const link = await db.shareLink.findUnique({
        where: { tokenHash: hashShareToken(token) },
      });
      if (!link || !hasExactlyOneSource(link.sessionId, link.templateId)) return null;
      return parseSharedWorkoutProjection(link.snapshotJson);
    },

    async saveTemplateCopy(userId: number, token: string, input: unknown) {
      const projection = await service.loadPreview(token);
      if (!projection) return { ok: false as const, error: NOT_FOUND, status: 404 };
      const draftResult = createImportedDraft(projection, input, null);
      if (!draftResult.ok) return draftResult;

      const serialized = serializeSessionEditorDraft(draftResult.draft);
      const result = await templatePersistence.saveForOwner(userId, {
        name: serialized.title,
        sport: serialized.sport,
        summary: serialized.summary ?? '',
        blocks: serialized.blocks,
      });
      if (result.error) return { ok: false as const, error: result.error, status: 400 };
      return { ok: true as const };
    },

    async savePlannerCopy(userId: number, role: ShareLinkRole, token: string, input: unknown) {
      const projection = await service.loadPreview(token);
      if (!projection) return { ok: false as const, error: NOT_FOUND, status: 404 };
      const draftResult = createImportedDraft(projection, input, 'planner');
      if (!draftResult.ok) return draftResult;

      const serialized = serializeSessionEditorDraft(draftResult.draft);
      if (role === 'ATHLETE') {
        const result = await athletePlannerPersistence.saveSession(userId, {
          ...serialized,
          dates: serialized.scheduledDate ? [serialized.scheduledDate] : [],
          templateId: null,
        });
        if (!result.ok) return result;
        return { ok: true as const, sessionIds: result.sessionIds };
      }

      const result = await coachLibraryPersistence.saveForCoach(userId, {
        ownershipMode: 'coach-library',
        athleteId: null,
        scheduledDate: serialized.scheduledDate,
        planWeekday: null,
        sport: serialized.sport,
        title: serialized.title,
        summary: serialized.summary ?? '',
        sourceTemplateId: null,
        sportMetrics: serialized.sportMetrics,
        blocks: serialized.blocks.map((block, index) => ({
          ...block,
          id: block.id ?? undefined,
          clientId: `share-block-${index}`,
          note: block.note ?? '',
        })),
      });
      if (!result.ok) return result;
      return { ok: true as const, sessionIds: [result.sessionId] };
    },
  };

  return service;
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
  | { kind: 'template'; value: TemplateShareSource }
  | null
> {
  if (sourceKind === 'template') {
    const template = await db.template.findUnique({
      where: { id: sourceId },
      include: { blocks: { orderBy: { sortOrder: 'asc' } } },
    });
    return template && template.ownerId === userId
      ? { kind: 'template', value: template as unknown as TemplateShareSource }
      : null;
  }

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

function hasExactlyOneSource(sessionId: number | null, templateId: number | null) {
  return (sessionId !== null) !== (templateId !== null);
}

export const shareLinkService = createShareLinkService();
