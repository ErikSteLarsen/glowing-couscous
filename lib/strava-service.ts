import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { prisma } from './prisma.ts';
import { activityImportService, type ActivityImportTransaction } from './activity-import-service.ts';
import { normalizeStravaActivity, normalizeStravaSport, toStravaActivitySummary } from './strava-normalizer.ts';
import type { StravaRecord, StravaStreams, StravaActivitySummary } from './strava-normalizer.ts';

const STRAVA_API = 'https://www.strava.com/api/v3';
const STRAVA_TOKEN = 'https://www.strava.com/oauth/token';
const STRAVA_REVOKE = 'https://www.strava.com/oauth/revoke';
const MAX_INBOX_ACTIVITIES = 100;
const STREAM_KEYS = ['time', 'distance', 'altitude', 'heartrate', 'cadence', 'velocity_smooth', 'watts', 'grade_smooth', 'temp'];

export type { StravaActivitySummary };

export type StravaInboxActivitySummary = StravaActivitySummary & { imported: boolean; dismissed?: boolean };

export type StravaConnectionSummary = {
  connected: boolean;
  canConnect: boolean;
  athleteName: string | null;
  webhookConfigured: boolean;
  activities: StravaInboxActivitySummary[];
};

export class StravaConfigurationError extends Error {}
export class StravaConnectionConflictError extends Error {}
export class StravaProviderError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new StravaConfigurationError(`${name} is not configured.`);
  return value;
}

function tokenKey() {
  const encoded = requiredEnvironment('STRAVA_TOKEN_ENCRYPTION_KEY');
  if (!/^[0-9a-f]{64}$/i.test(encoded)) {
    throw new StravaConfigurationError('STRAVA_TOKEN_ENCRYPTION_KEY must be a 32-byte key encoded as 64 hexadecimal characters.');
  }
  return Buffer.from(encoded, 'hex');
}

function encryptToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', tokenKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decryptToken(value: string) {
  const [version, encodedIv, encodedTag, encodedData] = value.split('.');
  if (version !== 'v1' || !encodedIv || !encodedTag || !encodedData) throw new Error('Tempo couldn’t use your Strava connection. Disconnect Strava in Settings, then connect it again.');
  const decipher = createDecipheriv('aes-256-gcm', tokenKey(), Buffer.from(encodedIv, 'base64url'));
  decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encodedData, 'base64url')), decipher.final()]).toString('utf8');
}

function stravaClient() {
  return {
    clientId: requiredEnvironment('STRAVA_CLIENT_ID'),
    clientSecret: requiredEnvironment('STRAVA_CLIENT_SECRET'),
  };
}

function webhooksConfigured() {
  const id = Number(process.env.STRAVA_WEBHOOK_SUBSCRIPTION_ID);
  return Number.isSafeInteger(id) && id > 0 && Boolean(process.env.STRAVA_WEBHOOK_VERIFY_TOKEN?.trim());
}

async function readJson(response: Response): Promise<unknown> {
  let value: unknown;
  try { value = await response.json(); } catch { value = null; }
  if (!response.ok) {
    const message = response.status === 401 || response.status === 403
      ? 'Strava stopped accepting Tempo’s connection. Connect Strava again in Settings.'
      : response.status === 429
        ? 'Strava is busy. Try again in a few minutes.'
        : 'Strava isn’t responding right now. Try again later.';
    throw new StravaProviderError(message, response.status);
  }
  return value;
}

async function postToken(fields: Record<string, string>) {
  const { clientId, clientSecret } = stravaClient();
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...fields });
  return asRecord(await readJson(await fetch(STRAVA_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  })));
}

function asRecord(value: unknown): StravaRecord { return value && typeof value === 'object' ? value as StravaRecord : {}; }
function asString(value: unknown, fallback = '') { return typeof value === 'string' ? value : fallback; }
function asNumber(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function isPrivateActivity(activity: StravaRecord) { return activity.private === true || activity.private === 'true'; }

async function getConnection(userId: number) {
  return prisma.stravaConnection.findUnique({ where: { userId } });
}

async function getActiveAccessToken(connection: NonNullable<Awaited<ReturnType<typeof getConnection>>>) {
  const refreshThreshold = Math.floor(Date.now() / 1000) + 3600;
  if (connection.expiresAt > refreshThreshold) return decryptToken(connection.accessTokenEncrypted);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const latest = await prisma.stravaConnection.findUnique({ where: { id: connection.id } });
    if (!latest) throw new Error('Strava is no longer connected. Connect it again in Settings.');
    if (latest.expiresAt > refreshThreshold) return decryptToken(latest.accessTokenEncrypted);

    const now = new Date();
    const leaseUntil = new Date(now.getTime() + 30_000);
    const claim = await prisma.stravaConnection.updateMany({
      where: {
        id: latest.id,
        expiresAt: { lte: refreshThreshold },
        OR: [{ refreshLockUntil: null }, { refreshLockUntil: { lte: now } }],
      },
      data: { refreshLockUntil: leaseUntil },
    });
    if (claim.count === 0) {
      for (let check = 0; check < 30; check += 1) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        const refreshed = await prisma.stravaConnection.findUnique({ where: { id: connection.id } });
        if (!refreshed) throw new Error('Strava is no longer connected. Connect it again in Settings.');
        if (refreshed.expiresAt > refreshThreshold) return decryptToken(refreshed.accessTokenEncrypted);
        if (!refreshed.refreshLockUntil || refreshed.refreshLockUntil <= new Date()) break;
      }
      continue;
    }

    try {
      const previousRefresh = decryptToken(latest.refreshTokenEncrypted);
      const token = await postToken({ grant_type: 'refresh_token', refresh_token: previousRefresh });
      const accessToken = asString(token.access_token);
      const refreshToken = asString(token.refresh_token);
      const expiresAt = asNumber(token.expires_at);
      if (!accessToken || !refreshToken || expiresAt === null) throw new Error('Strava didn’t respond as expected. Try again in a moment.');
      await prisma.stravaConnection.update({
        where: { id: latest.id },
        data: {
          accessTokenEncrypted: encryptToken(accessToken),
          refreshTokenEncrypted: encryptToken(refreshToken),
          expiresAt,
          refreshLockUntil: null,
        },
      });
      return accessToken;
    } catch (error) {
      await prisma.stravaConnection.updateMany({
        where: { id: latest.id, refreshLockUntil: leaseUntil },
        data: { refreshLockUntil: null },
      });
      throw error;
    }
  }
  throw new Error('Tempo is reconnecting to Strava. Try again in a moment.');
}

async function apiGet(token: string, path: string) {
  return readJson(await fetch(`${STRAVA_API}${path}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  }));
}

async function revokeProviderToken(token: string) {
  try {
    const { clientId, clientSecret } = stravaClient();
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch(STRAVA_REVOKE, {
      method: 'POST',
      headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token, token_type_hint: 'refresh_token' }),
      cache: 'no-store',
      signal: AbortSignal.timeout(3_000),
    });
    return response.ok;
  } catch {
    // Local credential and data removal must not depend on Strava being reachable.
    return false;
  }
}

async function fetchDetailedForConnection(
  connection: NonNullable<Awaited<ReturnType<typeof getConnection>>>,
  stravaActivityId: string,
) {
  if (!/^\d{1,20}$/.test(stravaActivityId)) throw new Error('Choose a valid Strava activity.');
  const token = await getActiveAccessToken(connection);
  const activity = asRecord(await apiGet(token, `/activities/${stravaActivityId}`));
  const athlete = asRecord(activity.athlete);
  if (String(athlete.id ?? '') !== connection.athleteId) throw new StravaProviderError('This activity isn’t from your connected Strava account.', 404);
  let streams: StravaStreams = {};
  try {
    const query = new URLSearchParams({ keys: STREAM_KEYS.join(','), key_by_type: 'true' });
    streams = asRecord(await apiGet(token, `/activities/${stravaActivityId}/streams?${query.toString()}`)) as StravaStreams;
  } catch (error) {
    if (!(error instanceof StravaProviderError) || ![403, 404].includes(error.status)) throw error;
    // Some activity types or permission levels do not expose streams; the summary remains importable.
  }
  return normalizeStravaActivity(activity, streams);
}

async function detailsFromInbox(
  connection: NonNullable<Awaited<ReturnType<typeof getConnection>>>,
  stravaActivityId: string,
) {
  const inboxItem = await prisma.stravaInboxActivity.findUnique({
    where: { connectionId_stravaActivityId: { connectionId: connection.id, stravaActivityId } },
    select: { id: true, fetchedAt: true },
  });
  if (!inboxItem) throw new StravaProviderError('This Strava activity is no longer available. Choose Check Strava now, then try again.', 404);
  const details = await fetchDetailedForConnection(connection, stravaActivityId);
  return { ...details, inboxFetchedAt: inboxItem.fetchedAt.toISOString() };
}

async function upsertInboxActivity(
  connectionId: string,
  stravaActivityId: string,
  activity: StravaRecord,
) {
  const summary = toStravaActivitySummary({ ...activity, id: stravaActivityId });
  if (!summary.startedAt || summary.durationSec < 1) throw new Error('Strava sent an incomplete activity. Try again later.');
  const data = {
    title: summary.title,
    sportType: summary.sportType,
    startedAt: new Date(summary.startedAt),
    durationSec: summary.durationSec,
    distanceMeters: summary.distanceMeters,
    elevationGainMeters: summary.elevationGainMeters,
    metadataJson: JSON.stringify(summary.metadata),
  };
  await prisma.$transaction(async (transaction) => {
    const lockedConnection = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "StravaConnection" WHERE "id" = ${connectionId} FOR UPDATE
    `;
    if (lockedConnection.length === 0) return;
    await transaction.stravaInboxActivity.upsert({
      where: { connectionId_stravaActivityId: { connectionId, stravaActivityId } },
      create: { connectionId, stravaActivityId, ...data },
      update: { ...data, fetchedAt: new Date() },
    });
  });
}

async function deleteImportedStravaActivity(connection: { id: string; userId: number }, stravaActivityId: string) {
  return prisma.$transaction(async (transaction) => {
    const lockedConnection = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "StravaConnection" WHERE "id" = ${connection.id} FOR UPDATE
    `;
    if (lockedConnection.length === 0) return false;
    const result = await activityImportService.deleteStravaActivityInTransaction(
      transaction as unknown as ActivityImportTransaction,
      connection.userId,
      stravaActivityId,
    );
    return result.ok;
  });
}

async function removeLocalStravaActivity(connection: { id: string; userId: number }, stravaActivityId: string) {
  return prisma.$transaction(async (transaction) => {
    const lockedConnection = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "StravaConnection" WHERE "id" = ${connection.id} FOR UPDATE
    `;
    if (lockedConnection.length === 0) return false;
    await activityImportService.deleteStravaActivityInTransaction(
      transaction as unknown as ActivityImportTransaction,
      connection.userId,
      stravaActivityId,
    );
    await transaction.stravaInboxActivity.deleteMany({
      where: { connectionId: connection.id, stravaActivityId },
    });
    return true;
  });
}

export const stravaService = {
  async connectionForUser(userId: number): Promise<StravaConnectionSummary> {
    const connection = await getConnection(userId);
    const canConnect = Boolean(
      process.env.STRAVA_CLIENT_ID?.trim() && process.env.STRAVA_CLIENT_SECRET?.trim() &&
      /^[0-9a-f]{64}$/i.test(process.env.STRAVA_TOKEN_ENCRYPTION_KEY?.trim() ?? ''),
    );
    if (!connection) return { connected: false, canConnect, athleteName: null, webhookConfigured: webhooksConfigured(), activities: [] };
    const [activities, imported] = await Promise.all([
      prisma.stravaInboxActivity.findMany({
        where: { connectionId: connection.id },
        orderBy: { startedAt: 'desc' },
        take: MAX_INBOX_ACTIVITIES,
      }),
      prisma.activity.findMany({
        where: { athleteId: userId, externalSource: 'STRAVA', externalActivityId: { not: null } },
        select: { externalActivityId: true },
      }),
    ]);
    const importedIds = new Set(imported.flatMap((item) => item.externalActivityId ? [item.externalActivityId] : []));
    // Keep recoverable inbox items reachable after they age out of the recent
    // provider page. This is a read limit, never a retention/deletion policy.
    const unimported = await prisma.stravaInboxActivity.findMany({
      where: { connectionId: connection.id, stravaActivityId: { notIn: [...importedIds] } },
      orderBy: { startedAt: 'desc' },
    });
    const reviewActivities = [...new Map([...activities, ...unimported].map((activity) => [activity.stravaActivityId, activity])).values()]
      .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime());
    return {
      connected: true,
      canConnect,
      athleteName: connection.athleteName,
      webhookConfigured: webhooksConfigured(),
      activities: reviewActivities.map((activity) => ({
        id: activity.stravaActivityId,
        title: activity.title,
        sportType: activity.sportType,
        sport: normalizeStravaSport(activity.sportType),
        startedAt: activity.startedAt.toISOString(),
        durationSec: activity.durationSec,
        distanceMeters: activity.distanceMeters,
        elevationGainMeters: activity.elevationGainMeters,
        metadata: parseMetadata(activity.metadataJson),
        imported: importedIds.has(activity.stravaActivityId),
        dismissed: activity.dismissedAt !== null,
      })),
    };
  },

  async connectAccount(userId: number, code: string, callbackScopes: string) {
    const token = await postToken({ grant_type: 'authorization_code', code });
    const athlete = asRecord(token.athlete);
    const athleteId = athlete.id;
    const accessToken = asString(token.access_token);
    const refreshToken = asString(token.refresh_token);
    const expiresAt = asNumber(token.expires_at);
    const scopes = asString(token.scope, callbackScopes);
    const acceptedScopes = scopes.split(/[\s,]+/).filter(Boolean);
    if (!athleteId || !accessToken || !refreshToken || expiresAt === null) {
      throw new Error('Tempo needs permission to see your Strava activities. Connect again and allow activity access.');
    }
    const athleteName = [asString(athlete.firstname), asString(athlete.lastname)].filter(Boolean).join(' ') || null;
    const authorizedAt = new Date();
    if (!acceptedScopes.includes('activity:read') && !acceptedScopes.includes('activity:read_all')) {
      throw new Error('Tempo needs permission to see your Strava activities. Connect again and allow activity access.');
    }
    const existingAthlete = await prisma.stravaConnection.findUnique({ where: { athleteId: String(athleteId) }, select: { userId: true } });
    if (existingAthlete && existingAthlete.userId !== userId) {
      // An OAuth code exchange can rotate credentials; preserve the existing owner's connection without relinking it.
      await prisma.stravaConnection.update({
        where: { athleteId: String(athleteId) },
        data: {
          athleteName,
          accessTokenEncrypted: encryptToken(accessToken),
          refreshTokenEncrypted: encryptToken(refreshToken),
          expiresAt,
          scopes: acceptedScopes.join(' '),
          authorizedAt,
        },
      });
      throw new StravaConnectionConflictError('That Strava account is already linked to another Tempo account.');
    }
    const existingConnection = await getConnection(userId);
    let previousProviderRevoked = true;
    if (existingConnection && existingConnection.athleteId !== String(athleteId)) {
      let previousRefreshToken = '';
      try { previousRefreshToken = decryptToken(existingConnection.refreshTokenEncrypted); } catch { /* Remove invalid local credentials below. */ }
      await removeLocalConnectionData(existingConnection);
      previousProviderRevoked = previousRefreshToken ? await revokeProviderToken(previousRefreshToken) : false;
    }
    try {
      const connection = await prisma.stravaConnection.upsert({
        where: { userId },
        create: {
          userId,
          athleteId: String(athleteId),
          athleteName,
          accessTokenEncrypted: encryptToken(accessToken),
          refreshTokenEncrypted: encryptToken(refreshToken),
          expiresAt,
          scopes: acceptedScopes.join(' '),
          authorizedAt,
        },
        update: {
          athleteId: String(athleteId),
          athleteName,
          accessTokenEncrypted: encryptToken(accessToken),
          refreshTokenEncrypted: encryptToken(refreshToken),
          expiresAt,
          scopes: acceptedScopes.join(' '),
          authorizedAt,
        },
      });
      return { connection, previousProviderRevoked };
    } catch (error) {
      if (isUniqueConflict(error)) throw new StravaConnectionConflictError('That Strava account is already linked to another Tempo account.');
      throw error;
    }
  },

  async syncRecentActivities(userId: number) {
    const connection = await getConnection(userId);
    if (!connection) throw new Error('Connect Strava first.');
    const token = await getActiveAccessToken(connection);
    const raw = await apiGet(token, '/athlete/activities?per_page=100&page=1');
    const list = Array.isArray(raw) ? raw : [];
    const activities = list.flatMap((item) => {
      const activity = asRecord(item);
      const id = activity.id === undefined || activity.id === null ? '' : String(activity.id);
      return /^\d{1,20}$/.test(id) ? [{ id, activity }] : [];
    });
    const visibleActivities = activities.filter(({ activity }) => !isPrivateActivity(activity));
    const privateActivities = activities.filter(({ activity }) => isPrivateActivity(activity));
    for (let index = 0; index < privateActivities.length; index += 10) {
      await Promise.all(privateActivities.slice(index, index + 10).map(async ({ id }) => {
        await removeLocalStravaActivity(connection, id);
      }));
    }
    for (let index = 0; index < visibleActivities.length; index += 10) {
      await Promise.all(visibleActivities.slice(index, index + 10).map(({ id, activity }) =>
        upsertInboxActivity(connection.id, id, activity),
      ));
    }
    return { synced: list.length };
  },

  async detailsForUser(userId: number, stravaActivityId: string) {
    const connection = await getConnection(userId);
    if (!connection) throw new Error('Connect Strava to see this activity.');
    return detailsFromInbox(connection, stravaActivityId);
  },

  async importActivityForUser(
    userId: number,
    stravaActivityId: string,
    plannedSessionId: number | null,
    titleOverride?: string,
    sportOverride?: string,
  ) {
    const supportedSports = ['RUNNING', 'BIKING', 'SWIMMING', 'STRENGTH', 'STRETCHING', 'OTHER'];
    if (sportOverride && !supportedSports.includes(sportOverride)) {
      return { ok: false as const, status: 400 as const, error: 'Choose a sport.' };
    }
    const connection = await getConnection(userId);
    if (!connection) throw new Error('Connect Strava to see this activity.');
    const details = await detailsFromInbox(connection, stravaActivityId);
    const title = titleOverride === undefined ? details.title : titleOverride.trim();
    if (!title || title.length > 140) return { ok: false as const, status: 400 as const, error: 'Enter an activity name up to 140 characters.' };
    const sport = sportOverride ?? details.sport;
    return activityImportService.importForUser(userId, { ...details, title, sport, plannedSessionId }, {
      sourceProvider: 'STRAVA',
      connectionId: connection.id,
      expectedInboxFetchedAt: new Date(details.inboxFetchedAt),
      externalActivityId: stravaActivityId,
      metadata: details.metadata,
    });
  },

  async disconnectForUser(userId: number) {
    const connection = await getConnection(userId);
    if (!connection) return { disconnected: false, removedActivities: 0 };
    let refreshToken = '';
    try { refreshToken = decryptToken(connection.refreshTokenEncrypted); } catch { /* Local removal still takes priority. */ }
    const removedActivities = await removeLocalConnectionData(connection);
    const providerRevoked = refreshToken ? await revokeProviderToken(refreshToken) : false;
    return { disconnected: true, removedActivities, providerRevoked };
  },

  async revokeDeletedConnection(encryptedRefreshToken: string) {
    try { return await revokeProviderToken(decryptToken(encryptedRefreshToken)); }
    catch { return false; }
  },

  async processWebhookEvent(eventId: number) {
    const now = new Date();
    const claim = await prisma.stravaWebhookEvent.updateMany({
      where: { id: eventId, OR: [
        { status: 'pending', nextAttemptAt: { lte: now } },
        { status: 'processing', processingUntil: { lte: now } },
      ] },
      data: { status: 'processing', processingUntil: new Date(now.getTime() + 120_000) },
    });
    if (claim.count === 0) return;
    const event = await prisma.stravaWebhookEvent.findUnique({ where: { id: eventId } });
    if (!event || event.status === 'processed') return;
    try {
      const connection = await prisma.stravaConnection.findUnique({ where: { athleteId: event.ownerAthleteId } });
      if (event.objectType === 'athlete') {
        const updates = parseMetadata(event.updatesJson);
        if (updates.authorized === false) {
          if (connection && connection.authorizedAt.getTime() > event.eventTime * 1000) {
            await markEventProcessed(event.id);
            return;
          }
          if (connection) await removeLocalConnectionData(connection);
          else await prisma.stravaWebhookEvent.deleteMany({ where: { ownerAthleteId: event.ownerAthleteId } });
          return;
        }
        await markEventProcessed(event.id);
        return;
      }
      if (!connection || event.objectType !== 'activity') {
        await prisma.stravaWebhookEvent.delete({ where: { id: event.id } });
        return;
      }

      const privateUpdate = parseMetadata(event.updatesJson).private;
      const isPrivate = privateUpdate === true || privateUpdate === 'true';
      if (event.aspectType === 'delete' || isPrivate) {
        await removeLocalStravaActivity(connection, event.objectId);
      } else {
        const token = await getActiveAccessToken(connection);
        const detail = asRecord(await apiGet(token, `/activities/${event.objectId}`));
        const owner = asRecord(detail.athlete);
        if (String(owner.id ?? '') !== connection.athleteId) throw new StravaProviderError('Activity ownership did not match its connection.', 403);
        if (isPrivateActivity(detail)) {
          await removeLocalStravaActivity(connection, event.objectId);
        } else {
          await upsertInboxActivity(connection.id, event.objectId, detail);
          if (event.aspectType === 'update') {
            await deleteImportedStravaActivity(connection, event.objectId);
          }
        }
      }
      await markEventProcessed(event.id);
    } catch (error) {
      await prisma.stravaWebhookEvent.update({
        where: { id: event.id },
        data: {
          status: 'pending',
          processingUntil: null,
          nextAttemptAt: new Date(Date.now() + Math.min(3_600_000, 30_000 * 2 ** Math.min(event.attemptCount, 7))),
          attemptCount: { increment: 1 },
          lastError: error instanceof Error ? error.message.slice(0, 300) : 'Strava event processing failed.',
        },
      });
    }
  },

  async enqueueWebhookEvent(input: {
    ownerAthleteId: string;
    objectId: string;
    objectType: string;
    aspectType: string;
    updates: Record<string, unknown>;
    eventTime: number;
    subscriptionId: number;
  }) {
    const eventKey = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    return prisma.$transaction(async (tx) => {
    // Lock the connection until enqueue commits: deletion will then remove this event,
    // or a webhook arriving after deletion finds no connection and stores nothing.
    const connections = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "StravaConnection" WHERE "athleteId" = ${input.ownerAthleteId} FOR UPDATE`;
    if (!connections.length) return null;
    const event = await tx.stravaWebhookEvent.upsert({
      where: { eventKey },
      create: {
        eventKey,
        ownerAthleteId: input.ownerAthleteId,
        objectId: input.objectId,
        objectType: input.objectType,
        aspectType: input.aspectType,
        updatesJson: JSON.stringify(input.updates),
        eventTime: input.eventTime,
        subscriptionId: input.subscriptionId,
      },
      update: {},
      select: { id: true },
    });
    return event.id;
    });
  },

  async processPendingWebhookEvents(userId?: number) {
    const connection = userId === undefined ? null : await getConnection(userId);
    if (userId !== undefined && !connection) return 0;
    const now = new Date();
    const events = await prisma.stravaWebhookEvent.findMany({
      where: {
        ...(connection ? { ownerAthleteId: connection.athleteId } : {}),
        OR: [
          { status: 'pending', nextAttemptAt: { lte: now } },
          { status: 'processing', processingUntil: { lte: now } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: userId === undefined ? 20 : 3,
      select: { id: true },
    });
    const startedAt = Date.now();
    let processed = 0;
    for (const event of events) {
      if (Date.now() - startedAt > 40_000) break;
      await this.processWebhookEvent(event.id);
      processed += 1;
    }
    return processed;
  },
};

async function removeLocalConnectionData(connection: { id: string; userId: number; athleteId: string }) {
  return prisma.$transaction(async (transaction) => {
    const lockedConnection = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "StravaConnection"
      WHERE "id" = ${connection.id} AND "userId" = ${connection.userId}
      FOR UPDATE
    `;
    if (lockedConnection.length === 0) return 0;
    const removedActivities = await activityImportService.deleteAllStravaActivitiesInTransaction(
      transaction as unknown as ActivityImportTransaction,
      connection.userId,
    );
    await transaction.stravaWebhookEvent.deleteMany({ where: { ownerAthleteId: connection.athleteId } });
    await transaction.stravaConnection.deleteMany({ where: { id: connection.id, userId: connection.userId } });
    return removedActivities;
  }, { timeout: 30_000 });
}

async function markEventProcessed(id: number) {
  await prisma.stravaWebhookEvent.update({
    where: { id },
    data: { status: 'processed', processedAt: new Date(), processingUntil: null, updatesJson: null, lastError: null },
  });
}

function parseMetadata(value: string | null) {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

function isUniqueConflict(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002');
}
