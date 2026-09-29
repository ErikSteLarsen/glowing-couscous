import { prisma } from './prisma.ts';
import { parsePerformanceProfileJson } from './performance-profile.ts';
import {
  createGuidedCandidates,
  fallbackGuidedChoice,
  guidedContextExplanation,
  parseGuidedWorkoutInput,
  type GuidedCandidate,
  type GuidedHistory,
  type GuidedWorkoutInput,
} from './guided-workout.ts';

type CompletedTraining = {
  completedAt: Date;
  durationSec: number;
  rpe: number | null;
  metricsSource: string;
  session: { sport: string };
};

export function summarizeGuidedHistory(activities: CompletedTraining[], sport: string, now = new Date()): GuidedHistory {
  const ageDays = (date: Date) => (now.getTime() - date.getTime()) / 86_400_000;
  const recent = activities.filter((activity) => ageDays(activity.completedAt) >= 0 && ageDays(activity.completedAt) < 28);
  const sameSport = recent.filter((activity) => activity.session.sport === sport);
  const durations = sameSport.map((activity) => Math.round(activity.durationSec / 60)).filter((minutes) => minutes > 0).sort((a, b) => a - b);
  const median = durations.length === 0 ? null : durations.length % 2 === 1
    ? durations[Math.floor(durations.length / 2)]
    : Math.round((durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2);
  const highRpe = recent.filter((activity) => activity.rpe !== null && activity.rpe >= 7).sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())[0];
  return {
    completedLast7Days: recent.filter((activity) => ageDays(activity.completedAt) < 7).length,
    completedLast28Days: recent.length,
    sameSportLast28Days: sameSport.length,
    sameSportMedianMinutes: median,
    recentHighRpeDaysAgo: highRpe ? Math.floor(ageDays(highRpe.completedAt)) : null,
    importedLast28Days: recent.filter((activity) => activity.metricsSource === 'strava-import' || activity.metricsSource === 'file-import').length,
  };
}

type ModelChoice = { candidate_id: string };
type ModelApiFormat = 'responses' | 'chat-completions';
const DEFAULT_MODEL_URL = 'https://api.openai.com/v1/responses';

function validModelUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
  } catch {
    return false;
  }
}

async function chooseWithModel(input: GuidedWorkoutInput, history: GuidedHistory, candidates: GuidedCandidate[], fetcher: typeof fetch, key: string, model: string, apiUrl: string, apiFormat: ModelApiFormat): Promise<ModelChoice | null> {
  if (!validModelUrl(apiUrl)) return null;
  const ids = candidates.map((candidate) => candidate.id);
  const systemPrompt = 'Choose the most suitable valid workout candidate for this endurance athlete. Use only the supplied facts. Training history may be incomplete. Do not diagnose, claim readiness, or change the requested duration or effort. Return JSON with a candidate_id field.';
  const userPrompt = JSON.stringify({ request: input, recentCompletedTraining: history, candidates: candidates.map(({ id, label, rationale, draft }) => ({ id, label, rationale, title: draft.title, blocks: draft.blocks.map(({ kind, zone, durationSec }) => ({ kind, zone, durationSec })) })) });
  const schema = { type: 'object', additionalProperties: false, properties: { candidate_id: { type: 'string', enum: ids } }, required: ['candidate_id'] };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetcher(apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(apiFormat === 'responses' ? {
        model,
        store: false,
        max_output_tokens: 80,
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        text: { format: { type: 'json_schema', name: 'guided_workout_choice', strict: true, schema } },
      } : {
        model,
        max_tokens: 80,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        response_format: { type: 'json_object' },
      }),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>; choices?: Array<{ finish_reason?: string; message?: { content?: string | null } }> };
    const output = apiFormat === 'responses'
      ? payload.output?.flatMap((item) => item.type === 'message' ? item.content ?? [] : []).find((item) => item.type === 'output_text')?.text
      : payload.choices?.[0]?.finish_reason === 'stop' ? payload.choices[0].message?.content : null;
    if (!output) return null;
    const parsed = JSON.parse(output) as Partial<ModelChoice>;
    if (typeof parsed.candidate_id !== 'string' || !ids.includes(parsed.candidate_id)) return null;
    return { candidate_id: parsed.candidate_id };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function createGuidedWorkoutService({ db = prisma, fetcher = fetch, now = () => new Date(), apiKey = process.env.WORKOUT_LLM_API_KEY ?? process.env.OPENAI_API_KEY, model = process.env.WORKOUT_LLM_MODEL ?? process.env.OPENAI_WORKOUT_MODEL ?? 'gpt-4o-mini', apiUrl = process.env.WORKOUT_LLM_API_URL ?? DEFAULT_MODEL_URL, apiFormat = process.env.WORKOUT_LLM_API_FORMAT ?? 'responses' }: {
  db?: typeof prisma;
  fetcher?: typeof fetch;
  now?: () => Date;
  apiKey?: string;
  model?: string;
  apiUrl?: string;
  apiFormat?: string;
} = {}) {
  return {
    async generateForAthlete(userId: number, rawInput: unknown) {
      const input = parseGuidedWorkoutInput(rawInput);
      if (!input) return { ok: false as const, status: 400 as const, error: 'Choose a sport, a listed duration, effort, and interval preference.' };
      const started = now();
      const [user, activities] = await Promise.all([
        db.user.findUnique({ where: { id: userId }, select: { performanceProfileJson: true } }),
        db.activity.findMany({
          where: { athleteId: userId, completedAt: { gte: new Date(started.getTime() - 28 * 86_400_000), lte: started } },
          select: { completedAt: true, durationSec: true, rpe: true, metricsSource: true, session: { select: { sport: true } } },
          orderBy: { completedAt: 'desc' },
          take: 120,
        }),
      ]);
      if (!user) return { ok: false as const, status: 404 as const, error: 'Account not found.' };
      const profile = parsePerformanceProfileJson(user.performanceProfileJson);
      const history = summarizeGuidedHistory(activities, input.sport, started);
      const allCandidates = createGuidedCandidates(input, profile, history);
      const recentHighEffort = history.recentHighRpeDaysAgo !== null && history.recentHighRpeDaysAgo <= 2;
      const limitedHardChoice = input.intensity === 'hard' && (history.sameSportLast28Days < 3 || recentHighEffort);
      const candidates = limitedHardChoice ? allCandidates.filter((candidate) => candidate.id === 'short' || candidate.id === 'progressive') : allCandidates;
      const modelChoice = apiKey && candidates.length > 1 && (apiFormat === 'responses' || apiFormat === 'chat-completions')
        ? await chooseWithModel(input, history, candidates, fetcher, apiKey, model, apiUrl, apiFormat)
        : null;
      const choice = candidates.find((candidate) => candidate.id === modelChoice?.candidate_id) ?? fallbackGuidedChoice(candidates, history);
      return {
        ok: true as const,
        draft: choice.draft,
        source: modelChoice ? 'ai' as const : 'guided' as const,
        selectedPattern: choice.label,
        reason: choice.rationale,
        context: guidedContextExplanation(history, input),
      };
    },
  };
}

export const guidedWorkoutService = createGuidedWorkoutService();
