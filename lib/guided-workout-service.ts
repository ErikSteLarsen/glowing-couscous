import { prisma } from './prisma.ts';
import { parsePerformanceProfileJson } from './performance-profile.ts';
import {
  createGuidedCandidates,
  fallbackGuidedChoice,
  guidedContextExplanation,
  parseGuidedWorkoutInput,
  type GuidedHistory,
} from './guided-workout.ts';
import { workoutLlm } from './workout-llm.ts';

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

export function createGuidedWorkoutService({ db = prisma, llm = workoutLlm, now = () => new Date() }: {
  db?: typeof prisma;
  llm?: Pick<typeof workoutLlm, 'generate'>;
  now?: () => Date;
} = {}) {
  return {
    async generateForAthlete(userId: number, rawInput: unknown) {
      const input = parseGuidedWorkoutInput(rawInput);
      if (!input) return { ok: false as const, status: 400 as const, error: 'Choose a sport, a length, an effort and whether you want intervals.' };
      const started = now();
      const [user, activities] = await Promise.all([
        db.user.findUnique({ where: { id: userId }, select: { performanceProfileJson: true } }),
        db.activity.findMany({
          where: { athleteId: userId, metricsSource: { not: 'strava-import' }, OR: [{ externalSource: null }, { externalSource: { not: 'STRAVA' } }], completedAt: { gte: new Date(started.getTime() - 28 * 86_400_000), lte: started } },
          select: { completedAt: true, durationSec: true, rpe: true, metricsSource: true, session: { select: { sport: true } } },
          orderBy: { completedAt: 'desc' },
          take: 120,
        }),
      ]);
      if (!user) return { ok: false as const, status: 404 as const, error: 'Account not found.' };
      const profile = parsePerformanceProfileJson(user.performanceProfileJson);
      const history = summarizeGuidedHistory(activities, input.sport, started);
      const modelWorkout = await llm.generate(input, history, profile);
      if (modelWorkout) return {
        ok: true as const,
        draft: modelWorkout.draft,
        source: 'ai' as const,
        selectedPattern: 'Original AI workout',
        reason: modelWorkout.reason,
        context: guidedContextExplanation(history, input),
      };
      const recentHighEffort = history.recentHighRpeDaysAgo !== null && history.recentHighRpeDaysAgo <= 2;
      const limitedHardChoice = input.intensity === 'hard' && (history.sameSportLast28Days < 3 || recentHighEffort);
      const allCandidates = createGuidedCandidates(input, profile, history);
      const candidates = limitedHardChoice ? allCandidates.filter((candidate) => candidate.id === 'short' || candidate.id === 'progressive') : allCandidates;
      const choice = fallbackGuidedChoice(candidates, history);
      return {
        ok: true as const,
        draft: choice.draft,
        source: 'guided' as const,
        selectedPattern: choice.label,
        reason: choice.rationale,
        context: guidedContextExplanation(history, input),
      };
    },
  };
}

export const guidedWorkoutService = createGuidedWorkoutService();
