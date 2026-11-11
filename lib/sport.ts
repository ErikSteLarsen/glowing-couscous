export const SPORT_OPTIONS = ['RUNNING', 'BIKING', 'SWIMMING', 'STRENGTH', 'STRETCHING', 'REST'] as const;

export type SportType = (typeof SPORT_OPTIONS)[number];

export const sportLabels: Record<SportType, string> = {
  RUNNING: 'Running',
  BIKING: 'Biking',
  SWIMMING: 'Swimming',
  STRENGTH: 'Strength',
  STRETCHING: 'Stretching',
  REST: 'Rest',
};

export function getSportLabel(sportType: string) {
  if (sportType === 'OTHER') return 'Other';
  if (sportType === 'TRIATHLON') return 'Triathlon';
  return sportLabels[sportType as SportType] ?? sportType;
}
