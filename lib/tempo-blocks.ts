export const TEMPO_ZONE_META = {
  1: { label: 'Z1', name: 'Recovery', solid: '#3B82F6', tint: '#E8F0FE', factor: 0.55 },
  2: { label: 'Z2', name: 'Endurance', solid: '#22C55E', tint: '#E3F7EC', factor: 0.7 },
  3: { label: 'Z3', name: 'Tempo', solid: '#EAB308', tint: '#FBF1D5', factor: 0.85 },
  4: { label: 'Z4', name: 'Threshold', solid: '#F97316', tint: '#FEEDE0', factor: 0.98 },
  5: { label: 'Z5', name: 'VO2 max', solid: '#EF4444', tint: '#FCE8E7', factor: 1.1 },
} as const;

export type TempoZone = keyof typeof TEMPO_ZONE_META;
export type TempoBlockKind = 'warmup' | 'work' | 'recovery' | 'cooldown';

export type TempoBlock = {
  kind: TempoBlockKind;
  zone: TempoZone;
  durationSec: number;
  reps?: number | null;
  target?: {
    type: 'power' | 'pace' | 'hr';
    low: number;
    high: number;
  } | null;
};

export function getTempoZoneMeta(zone: number) {
  return TEMPO_ZONE_META[(zone in TEMPO_ZONE_META ? zone : 1) as TempoZone];
}
