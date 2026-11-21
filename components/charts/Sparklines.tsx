/**
 * Word-sized trend marks for Home tiles. They show shape only; exact values
 * and axes live in the full chart behind each tile, so they are hidden from
 * assistive technology and the tile text carries the reading.
 */

const WIDTH = 120;
const HEIGHT = 32;

export function Sparkline({ values, color, className = '' }: { values: number[]; color: string; className?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (index: number) => (index / (values.length - 1)) * WIDTH;
  const y = (value: number) => 2 + (1 - (value - min) / span) * (HEIGHT - 4);
  const path = values.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join('');
  const last = values.length - 1;

  return (
    <svg aria-hidden="true" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className={`block h-8 w-full overflow-visible ${className}`}>
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(values[last])} r={2} fill={color} />
    </svg>
  );
}

export type MiniBar = { key: string; planned: number; done: number; current: boolean };

/** Planned outline with done fill, matching the full weekly volume chart. */
export function MiniBars({ bars, className = '' }: { bars: MiniBar[]; className?: string }) {
  const max = Math.max(1, ...bars.flatMap((bar) => [bar.planned, bar.done]));
  return (
    <div aria-hidden="true" className={`flex h-8 items-end gap-[3px] ${className}`}>
      {bars.map((bar) => (
        <span key={bar.key} className="relative h-full min-w-0 flex-1">
          {bar.planned > 0 ? (
            <span className="absolute inset-x-0 bottom-0 rounded-[2px] border border-[var(--border-strong)]" style={{ height: `${Math.max(6, (bar.planned / max) * 100)}%` }} />
          ) : null}
          {bar.done > 0 ? (
            <span
              className={`absolute inset-x-0 bottom-0 rounded-[2px] ${bar.current ? 'bg-[var(--brand)]' : 'bg-[var(--metric-fitness)] opacity-60'}`}
              style={{ height: `${Math.max(6, (bar.done / max) * 100)}%` }}
            />
          ) : null}
        </span>
      ))}
    </div>
  );
}
