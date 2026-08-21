export type ActivitySegment = {
  key: string;
  zone: number;
  durationSec: number;
  label: string;
  color: string;
  tint: string;
};

export function parseActivitySegments(value: string | null | undefined): ActivitySegment[] {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isActivitySegment);
  } catch {
    return [];
  }
}

function isActivitySegment(value: unknown): value is ActivitySegment {
  if (!value || typeof value !== 'object') return false;
  const segment = value as Record<string, unknown>;
  return (
    typeof segment.key === 'string' &&
    typeof segment.zone === 'number' &&
    typeof segment.durationSec === 'number' &&
    typeof segment.label === 'string' &&
    typeof segment.color === 'string' &&
    typeof segment.tint === 'string'
  );
}
