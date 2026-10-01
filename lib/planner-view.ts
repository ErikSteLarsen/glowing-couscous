
export type PlannerRole = 'coach' | 'athlete';
export type PlannerSourceKind = 'workout' | 'template' | 'training-plan';

export type PlannerSource = {
  key: string;
  id: number;
  kind: PlannerSourceKind;
  title: string;
  sport: string;
  summary: string | null;
  durationSec?: number;
  sessionCount?: number;
  routineEntries?: Array<{ weekday: number; title: string }>;
};

export type PersonalPlannerSource = PlannerSource & {
  kind: 'workout' | 'template';
};

export type CoachPlannerSource = Omit<PlannerSource, 'kind'> & {
  kind: 'workout' | 'training-plan';
};

export type PlannerSession = {
  id: number;
  athleteId?: number | null;
  scheduledDate: string;
  sport: string;
  title: string;
  summary?: string | null;
  status: string;
  durationSec: number;
  tss: number;
  segments: Array<{ key: string; zone: number; durationSec: number; label: string; color: string }>;
};

export type PlannerCalendarDay = {
  isoDate: string;
  label: string;
  dateLabel: string;
  inMonth: boolean;
  sessions: PlannerSession[];
};

export type PlannerAthlete = {
  id: number;
  name: string;
  email?: string;
};
