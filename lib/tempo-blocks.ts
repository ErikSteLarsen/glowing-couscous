// Colors mirror --color-zone-N in app/globals.css; tints are the same hue at 16% alpha.
export const TEMPO_ZONE_META = {
  1: { label: 'Z1', name: 'Recovery', solid: '#7F9BB5', tint: '#7F9BB529', factor: 0.55 },
  2: { label: 'Z2', name: 'Endurance', solid: '#4FB89F', tint: '#4FB89F29', factor: 0.7 },
  3: { label: 'Z3', name: 'Tempo', solid: '#D9B44A', tint: '#D9B44A29', factor: 0.85 },
  4: { label: 'Z4', name: 'Threshold', solid: '#EE8A4C', tint: '#EE8A4C29', factor: 0.98 },
  5: { label: 'Z5', name: 'VO2 max', solid: '#E8667E', tint: '#E8667E29', factor: 1.1 },
} as const;

export type TempoZone = keyof typeof TEMPO_ZONE_META;
export type TempoBlockKind = 'warmup' | 'work' | 'recovery' | 'cooldown';

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
