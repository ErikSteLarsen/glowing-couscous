import { createHash } from 'node:crypto';

import { prisma } from './prisma.ts';
import { buildModelWorkoutDraft, type GuidedHistory, type GuidedWorkoutInput } from './guided-workout.ts';
import type { PerformanceProfile } from './performance-profile.ts';

type ApiFormat = 'responses' | 'chat-completions';
export type WorkoutAiStatus = 'available' | 'unavailable' | 'checking';
type ProviderConfig = { key: string; model: string; url: string; format: ApiFormat; hash: string };
type HealthRow = { id: string; configHash: string; status: string; checkedAt: Date | null; leaseUntil: Date | null };
type HealthDb = { aiProviderHealth: {
  findUnique(args: { where: { id: string } }): Promise<HealthRow | null>;
  create(args: { data: HealthRow }): Promise<unknown>;
  updateMany(args: { where: Partial<HealthRow>; data: Partial<HealthRow> }): Promise<{ count: number }>;
} };

const HEALTH_ID = 'guided-workout';
const DEFAULT_URL = 'https://api.openai.com/v1/responses';

function providerConfig(options: { apiKey?: string; model?: string; apiUrl?: string; apiFormat?: string }): ProviderConfig | null {
  const key = options.apiKey?.trim();
  const model = options.model?.trim();
  const url = options.apiUrl?.trim();
  const format = options.apiFormat;
  if (!key || !model || !url || (format !== 'responses' && format !== 'chat-completions')) return null;
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password || parsed.hash) return null;
    if (parsed.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) return null;
  } catch {
    return null;
  }
  return { key, model, url, format, hash: createHash('sha256').update(JSON.stringify([key, model, url, format])).digest('hex') };
}

function responseText(payload: unknown, format: ApiFormat): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as { status?: string; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>; choices?: Array<{ finish_reason?: string; message?: { content?: string | null } }> };
  if (format === 'responses') {
    if (data.status && data.status !== 'completed') return null;
    return data.output?.flatMap((item) => item.type === 'message' ? item.content ?? [] : []).find((item) => item.type === 'output_text')?.text ?? null;
  }
  return data.choices?.[0]?.finish_reason === 'stop' ? data.choices[0].message?.content ?? null : null;
}

function schema() {
  return {
    type: 'object', additionalProperties: false,
    properties: {
      title: { type: 'string' }, summary: { type: 'string' }, reason: { type: 'string' },
      blocks: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
        kind: { type: 'string', enum: ['warmup', 'work', 'recovery', 'cooldown'] },
        zone: { type: 'integer', minimum: 1, maximum: 5 },
        durationSec: { type: 'integer', minimum: 30 },
        note: { type: 'string' },
      }, required: ['kind', 'zone', 'durationSec', 'note'] } },
    }, required: ['title', 'summary', 'reason', 'blocks'],
  };
}

async function callProvider(fetcher: typeof fetch, config: ProviderConfig, prompt: string, healthCheck: boolean): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), healthCheck ? 6_000 : 25_000);
  try {
    const body = config.format === 'responses' ? {
      model: config.model, store: false, max_output_tokens: healthCheck ? 24 : 2_000,
      input: healthCheck ? 'Reply with OK.' : [{ role: 'system', content: 'Create a complete endurance workout as JSON. Follow every requested constraint. Never include medical claims or imply the athlete is ready for hard effort.' }, { role: 'user', content: prompt }],
      ...(healthCheck ? {} : { text: { format: { type: 'json_schema', name: 'guided_workout', strict: true, schema: schema() } } }),
    } : {
      model: config.model, max_tokens: healthCheck ? 24 : 2_000,
      messages: healthCheck ? [{ role: 'user', content: 'Reply with OK.' }] : [{ role: 'system', content: 'Create a complete endurance workout as JSON. Follow every requested constraint. Never include medical claims or imply the athlete is ready for hard effort.' }, { role: 'user', content: prompt }],
      ...(healthCheck ? {} : { response_format: { type: 'json_object' } }),
    };
    const response = await fetcher(config.url, { method: 'POST', headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
    if (!response.ok) return null;
    return responseText(await response.json(), config.format);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function createWorkoutLlm({ db = prisma, fetcher = fetch, now = () => new Date(), apiKey, model = process.env.WORKOUT_LLM_MODEL ?? process.env.OPENAI_WORKOUT_MODEL ?? 'gpt-4o-mini', apiUrl = process.env.WORKOUT_LLM_API_URL ?? DEFAULT_URL, apiFormat = process.env.WORKOUT_LLM_API_FORMAT ?? 'responses' }: {
  db?: typeof prisma; fetcher?: typeof fetch; now?: () => Date; apiKey?: string; model?: string; apiUrl?: string; apiFormat?: string;
} = {}) {
  const resolvedKey = apiKey ?? (apiUrl === DEFAULT_URL ? process.env.OPENAI_API_KEY : process.env.WORKOUT_LLM_API_KEY);
  const config = providerConfig({ apiKey: resolvedKey, model, apiUrl, apiFormat });
  const healthDb = db as unknown as HealthDb;
  async function getStatus(): Promise<WorkoutAiStatus> {
    if (!config) return 'unavailable';
    try {
      const current = now();
      const existing = await healthDb.aiProviderHealth.findUnique({ where: { id: HEALTH_ID } });
      if (existing?.configHash === config.hash) {
        if (existing.leaseUntil && existing.leaseUntil > current) return 'checking';
        const ttl = existing.status === 'available' ? 15 * 60_000 : 2 * 60_000;
        if (existing.checkedAt && current.getTime() - existing.checkedAt.getTime() < ttl) return existing.status === 'available' ? 'available' : 'unavailable';
      }
      const leaseUntil = new Date(current.getTime() + 10_000);
      let claimed = false;
      if (!existing) {
        try {
          await healthDb.aiProviderHealth.create({ data: { id: HEALTH_ID, configHash: config.hash, status: 'checking', checkedAt: null, leaseUntil } });
          claimed = true;
        } catch { /* Another instance created the row. */ }
      } else {
        const updated = await healthDb.aiProviderHealth.updateMany({ where: { id: HEALTH_ID, configHash: existing.configHash, status: existing.status, checkedAt: existing.checkedAt, leaseUntil: existing.leaseUntil }, data: { configHash: config.hash, status: 'checking', checkedAt: null, leaseUntil } });
        claimed = updated.count === 1;
      }
      if (!claimed) return 'checking';
      const available = Boolean(await callProvider(fetcher, config, 'Reply with OK.', true));
      await healthDb.aiProviderHealth.updateMany({ where: { id: HEALTH_ID, configHash: config.hash, leaseUntil }, data: { status: available ? 'available' : 'unavailable', checkedAt: now(), leaseUntil: null } });
      return available ? 'available' : 'unavailable';
    } catch {
      return 'unavailable';
    }
  }

  async function generate(input: GuidedWorkoutInput, history: GuidedHistory, profile: PerformanceProfile | null) {
    if (!config || await getStatus() !== 'available') return null;
    const cautious = history.sameSportLast28Days < 3 || (history.recentHighRpeDaysAgo !== null && history.recentHighRpeDaysAgo <= 2);
    const prompt = JSON.stringify({ request: input, recentCompletedTraining: history, constraints: {
      totalDurationSec: input.durationMinutes * 60, firstBlock: 'warmup', lastBlock: 'cooldown', blockCount: '3 to 24', durationSec: 'integer seconds, at least 30 each',
      warmup: input.intensity === 'hard' || input.intervals ? 'at least 8 minutes' : 'at least 3 minutes', cooldown: input.intensity === 'hard' ? 'at least 5 minutes' : 'at least 3 minutes',
      zones: '1 recovery, 2 endurance, 3 tempo, 4 threshold, 5 very hard; warmup/cooldown and recoveries must be zone 1 or 2',
      intervals: input.intervals ? 'at least two work blocks and active recovery blocks after work' : 'no recovery blocks',
      intensity: input.intensity === 'easy' ? 'all blocks zones 1-2' : input.intensity === 'steady' ? 'all blocks zones 1-3' : 'zones 1-5, high intensity zones 4-5 at most 40% of total time, zone 5 at most 8 minutes',
      cautiousHistory: cautious && input.intensity === 'hard' ? 'because same-sport history is sparse or recent effort was high, zones 4-5 at most 6 minutes total and no zone 5' : null,
      output: 'JSON object with concise title, summary, reason and blocks; each block has kind, zone, durationSec, note. Create the full sequence yourself; use the history as context, not proof of readiness.',
    } });
    const output = await callProvider(fetcher, config, prompt, false);
    async function markUnavailable() {
      try {
        await healthDb.aiProviderHealth.updateMany({ where: { id: HEALTH_ID, configHash: config!.hash, status: 'available' }, data: { status: 'unavailable', checkedAt: now(), leaseUntil: null } });
      } catch { /* The validated standard creator remains available. */ }
    }
    if (!output) { await markUnavailable(); return null; }
    try {
      const result = buildModelWorkoutDraft(JSON.parse(output) as unknown, input, profile, history);
      if (!result) await markUnavailable();
      return result;
    } catch {
      await markUnavailable();
      return null;
    }
  }
  return { getStatus, generate };
}

export const workoutLlm = createWorkoutLlm();
