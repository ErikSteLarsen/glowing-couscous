export const TEMPO_ZONE_META = {
  1: { label: 'Z1', name: 'Recovery', solid: '#2563EB', tint: '#E4EDFF', factor: 0.55 },
  2: { label: 'Z2', name: 'Endurance', solid: '#16A34A', tint: '#E1F4E7', factor: 0.7 },
  3: { label: 'Z3', name: 'Tempo', solid: '#CA8A04', tint: '#FBF1D2', factor: 0.85 },
  4: { label: 'Z4', name: 'Threshold', solid: '#EA580C', tint: '#FDE7D9', factor: 0.98 },
  5: { label: 'Z5', name: 'VO2 max', solid: '#DC2626', tint: '#FBE4E2', factor: 1.1 },
} as const;

export type TempoZone = keyof typeof TEMPO_ZONE_META;
export type TempoBlockKind = 'warmup' | 'work' | 'recovery' | 'cooldown' | 'pause';

import type { WorkoutTarget } from './workout-targets.ts';

export type TempoBlock = {
  kind: TempoBlockKind;
  zone: TempoZone;
  durationSec: number;
  reps?: number | null;
  target?: WorkoutTarget | null;
};

export function getTempoZoneMeta(zone: number) {
  return TEMPO_ZONE_META[(zone in TEMPO_ZONE_META ? zone : 1) as TempoZone];
}
