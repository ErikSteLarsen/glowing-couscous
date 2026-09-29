/** A continuous five-zone ramp. Each zone's midpoint is its named color. */
export function intensityColor(zone: number, fraction = 0.5): string {
  const boundedZone = Math.min(5, Math.max(1, zone));
  const boundedFraction = Math.min(1, Math.max(0, fraction));
  const position = Math.min(4, Math.max(0, boundedZone - 1 + boundedFraction - 0.5));
  const lower = Math.floor(position) + 1;
  const upper = Math.min(5, lower + 1);
  const upperWeight = Math.round((position - Math.floor(position)) * 1000) / 10;
  if (upper === lower || upperWeight === 0) return `var(--color-zone-${lower})`;
  return `color-mix(in oklch, var(--color-zone-${upper}) ${upperWeight}%, var(--color-zone-${lower}))`;
}
