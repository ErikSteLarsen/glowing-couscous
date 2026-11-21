import Link from 'next/link';
import { ArrowRight, HeartPulse } from 'lucide-react';
import { buttonFocusClassName } from '@/components/ui';
import type { PerformanceProfile } from '@/lib/performance-profile';
import { getTrainingSetupTarget, type TrainingSport, type TrainingSetupTarget } from '@/lib/training-setup';

const targetLabels: Record<TrainingSetupTarget, string> = {
  'heart-rate': 'Maximum heart rate',
  running: 'Running pace',
  cycling: 'Cycling FTP',
  swimming: 'Swimming pace',
};

export function HomeTrainingSetup({ profile, sports, workoutSport }: {
  profile: PerformanceProfile;
  sports: TrainingSport[] | null;
  workoutSport?: string;
}) {
  const target = getTrainingSetupTarget(profile, sports, workoutSport);
  if (!target) return null;

  return (
    <Link
      href={`/profile#${target}`}
      className={`flex min-h-11 items-center gap-3 rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--text)] hover:bg-[var(--raised)] ${buttonFocusClassName}`}
    >
      <HeartPulse size={18} aria-hidden="true" className="shrink-0 text-[var(--brand)]" />
      <span className="flex flex-1 flex-wrap items-baseline gap-x-3">
        <span className="font-medium">Set up training targets</span>
        <span className="text-[13px] text-[var(--text-muted)]">{targetLabels[target]}</span>
      </span>
      <ArrowRight size={16} aria-hidden="true" className="shrink-0 text-[var(--brand)]" />
    </Link>
  );
}
