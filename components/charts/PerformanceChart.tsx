'use client';

import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { formatDayLong, formatDayShort, niceCeiling, signed } from '@/lib/chart-format';
import { getStressBarTss, type LoadPoint } from '@/lib/training-load';

const WIDTH = 600;
const LOAD_HEIGHT = 200;
const FORM_HEIGHT = 72;

type Props = {
  series: LoadPoint[];
  today: string;
};

function linePath(values: number[], x: (index: number) => number, y: (value: number) => number, from = 0, to = values.length - 1) {
  let path = '';
  for (let index = from; index <= to; index += 1) {
    path += `${index === from ? 'M' : 'L'}${x(index).toFixed(2)} ${y(values[index]).toFixed(2)}`;
  }
  return path;
}

function LegendValue({ color, label, value, dashed = false }: { color: string; label: string; value: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span
        aria-hidden="true"
        className="inline-block h-0.5 w-3.5 translate-y-[-3px] rounded-full"
        style={dashed ? { backgroundImage: `linear-gradient(90deg, ${color} 60%, transparent 0)`, backgroundSize: '5px 2px' } : { background: color }}
      />
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="data text-[var(--text)]">{value}</span>
    </span>
  );
}

/**
 * Fitness and fatigue as lines over daily stress bars, with form underneath.
 * The projected part follows the plan and is dashed. Hover, touch, or arrow
 * keys move the reading; the legend always shows the selected day.
 */
export function PerformanceChart({ series, today }: Props) {
  const todayIndex = series.findIndex((point) => point.day === today);
  const anchorIndex = todayIndex < 0 ? series.length - 1 : todayIndex;
  const plotRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const shown = Math.min(active ?? anchorIndex, series.length - 1);
  const point = series[shown];
  const clipId = useId();

  const scales = useMemo(() => {
    const lineMax = niceCeiling(Math.max(10, ...series.map((entry) => Math.max(entry.fitness, entry.fatigue))) * 1.1);
    const stressMax = niceCeiling(Math.max(50, ...series.map((entry) => Math.max(entry.actualTss, entry.plannedTss))));
    // Form is symmetric around zero so balance always sits on the midline.
    const formRange = niceCeiling(Math.max(15, ...series.map((entry) => Math.abs(entry.form))));
    return { lineMax, stressMax, formRange };
  }, [series]);

  if (series.length < 2 || !point) {
    return <p className="py-12 text-center text-sm text-[var(--text-muted)]">Not enough training to draw yet.</p>;
  }

  const step = WIDTH / (series.length - 1);
  const x = (index: number) => index * step;
  const yLoad = (value: number) => LOAD_HEIGHT - (value / scales.lineMax) * (LOAD_HEIGHT - 8);
  const yForm = (value: number) => FORM_HEIGHT / 2 - (Math.max(-scales.formRange, Math.min(scales.formRange, value)) / scales.formRange) * (FORM_HEIGHT / 2 - 4);
  const barWidth = Math.max(1, step * 0.55);
  const fitness = series.map((entry) => entry.fitness);
  const fatigue = series.map((entry) => entry.fatigue);
  const form = series.map((entry) => entry.form);
  const lastIndex = series.length - 1;
  const hasProjection = todayIndex >= 0 && todayIndex < lastIndex;
  const percent = (index: number) => `${(index / lastIndex) * 100}%`;
  const ticks = [scales.lineMax, scales.lineMax / 2, 0];
  const labelEvery = Math.max(1, Math.round(series.length / 6 / 7)) * 7;
  const dateLabels = series
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry, index }) => (index - anchorIndex) % labelEvery === 0 && index !== lastIndex && entry.day !== today);

  function indexFromPointer(event: PointerEvent<HTMLDivElement>) {
    const rect = plotRef.current?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(lastIndex, Math.round(ratio * lastIndex)));
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, PageUp: -7, PageDown: 7 };
    if (event.key === 'Home') setActive(0);
    else if (event.key === 'End') setActive(lastIndex);
    // Escape clears a selection first; with none, it falls through to close an enclosing dialog.
    else if (event.key === 'Escape' && active !== null) setActive(null);
    else if (event.key in moves) setActive(Math.max(0, Math.min(lastIndex, shown + moves[event.key])));
    else return;
    event.preventDefault();
  }

  const stressLabel = point.projected
    ? `${point.plannedTss} planned`
    : !point.actualLoadKnown
      ? point.actualTss > 0
        ? `${point.actualTss} · some TSS missing`
        : `No TSS${point.plannedTss > 0 ? `\u00A0· ${point.plannedTss} planned` : ''}`
    : point.plannedTss > 0
      ? `${point.actualTss} done · ${point.plannedTss} planned`
      : `${point.actualTss}`;

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 text-[13px]">
        <span className="data text-[var(--text-secondary)]">
          {formatDayLong(point.day)}
          {point.day === today ? ' · today' : point.projected ? ' · if you follow the plan' : ''}
        </span>
        <span className="flex flex-wrap gap-x-5 gap-y-1">
          <LegendValue color="var(--metric-fitness)" label="Fitness" value={String(Math.round(point.fitness))} />
          <LegendValue color="var(--metric-fatigue)" label="Fatigue" value={String(Math.round(point.fatigue))} />
          <LegendValue color="var(--metric-form)" label="Form" value={signed(point.form)} />
          <LegendValue color="var(--border-strong)" label="TSS" value={stressLabel} />
        </span>
      </figcaption>

      <div
        role="slider"
        aria-valuemin={0}
        aria-valuemax={lastIndex}
        aria-valuenow={shown}
        aria-valuetext={`${formatDayLong(point.day)}: fitness ${Math.round(point.fitness)}, fatigue ${Math.round(point.fatigue)}, form ${signed(point.form)}, TSS ${stressLabel}`}
        tabIndex={0}
        aria-label="Training load by day. Use arrow keys to move between days."
        className="relative cursor-pointer hover:bg-[var(--field-surface)] touch-pan-y select-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--background)]"
        onPointerMove={(event) => setActive(indexFromPointer(event))}
        onPointerDown={(event) => setActive(indexFromPointer(event))}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') setActive(null);
        }}
        onKeyDown={handleKey}
        onBlur={() => setActive(null)}
      >
        <div className="relative pr-9">
          <svg ref={plotRef} viewBox={`0 0 ${WIDTH} ${LOAD_HEIGHT}`} preserveAspectRatio="none" className="chart-reveal block h-[clamp(160px,24vh,220px)] w-full overflow-visible" aria-hidden="true">
            <defs>
              <clipPath id={`${clipId}-past`}>
                <rect x={0} y={-4} width={x(anchorIndex)} height={LOAD_HEIGHT + 8} />
              </clipPath>
              <clipPath id={`${clipId}-future`}>
                <rect x={x(anchorIndex)} y={-4} width={WIDTH - x(anchorIndex)} height={LOAD_HEIGHT + 8} />
              </clipPath>
            </defs>
            {ticks.map((tick) => (
              <line key={tick} x1={0} x2={WIDTH} y1={yLoad(tick)} y2={yLoad(tick)} stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            {hasProjection ? (
              <rect x={x(anchorIndex)} y={0} width={WIDTH - x(anchorIndex)} height={LOAD_HEIGHT} fill="var(--raised)" opacity={0.45} />
            ) : null}
            {series.map((entry, index) => {
              const stress = getStressBarTss(entry);
              if (!stress) return null;
              const height = (stress / scales.stressMax) * LOAD_HEIGHT * 0.42;
              const planned = !entry.actualTss;
              return (
                <rect
                  key={entry.day}
                  x={x(index) - barWidth / 2}
                  y={LOAD_HEIGHT - height}
                  width={barWidth}
                  height={height}
                  fill={planned ? 'transparent' : 'var(--border-strong)'}
                  stroke={!entry.actualLoadKnown ? 'var(--status-warning)' : planned ? 'var(--border-strong)' : 'none'}
                  strokeWidth={planned || !entry.actualLoadKnown ? 1.5 : 0}
                  vectorEffect="non-scaling-stroke"
                  opacity={index === shown ? 1 : 0.8}
                />
              );
            })}
            <g clipPath={`url(#${clipId}-past)`}>
              <path d={linePath(fatigue, x, yLoad)} fill="none" stroke="var(--metric-fatigue)" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity={0.85} />
              <path d={linePath(fitness, x, yLoad)} fill="none" stroke="var(--metric-fitness)" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </g>
            {hasProjection ? (
              <g clipPath={`url(#${clipId}-future)`} strokeDasharray="4 4">
                <path d={linePath(fatigue, x, yLoad)} fill="none" stroke="var(--metric-fatigue)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" opacity={0.6} />
                <path d={linePath(fitness, x, yLoad)} fill="none" stroke="var(--metric-fitness)" strokeWidth={2} vectorEffect="non-scaling-stroke" opacity={0.75} />
              </g>
            ) : null}
            {todayIndex >= 0 ? <line x1={x(todayIndex)} x2={x(todayIndex)} y1={0} y2={LOAD_HEIGHT} stroke="var(--brand)" strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" opacity={0.7} /> : null}
            {active !== null ? (
              <line x1={x(shown)} x2={x(shown)} y1={0} y2={LOAD_HEIGHT} stroke="var(--text)" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.5} />
            ) : null}
          </svg>
          {ticks.map((tick) => (
            <span
              key={tick}
              className="data pointer-events-none absolute right-0 -translate-y-1/2 text-[11px] text-[var(--text-muted)]"
              style={{ top: `${(yLoad(tick) / LOAD_HEIGHT) * 100}%` }}
            >
              {tick}
            </span>
          ))}
          {[
            { value: point.fitness, color: 'var(--metric-fitness)' },
            { value: point.fatigue, color: 'var(--metric-fatigue)' },
          ].map((dot) => (
            <span
              key={dot.color}
              aria-hidden="true"
              className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--background)]"
              style={{ left: `calc((100% - 2.25rem) * ${shown / lastIndex})`, top: `${(yLoad(dot.value) / LOAD_HEIGHT) * 100}%`, background: active !== null ? 'var(--text)' : dot.color }}
            />
          ))}
        </div>

        <div className="relative mt-2 pr-9">
          <svg viewBox={`0 0 ${WIDTH} ${FORM_HEIGHT}`} preserveAspectRatio="none" className="block h-[4.5rem] w-full" aria-hidden="true">
            <rect x={0} y={yForm(5)} width={WIDTH} height={yForm(-10) - yForm(5)} fill="var(--band)" opacity={0.6} />
            <line x1={0} x2={WIDTH} y1={yForm(0)} y2={yForm(0)} stroke="var(--border-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <path d={linePath(form, x, yForm, 0, anchorIndex)} fill="none" stroke="var(--metric-form)" strokeWidth={1.75} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {hasProjection ? (
              <path d={linePath(form, x, yForm, anchorIndex, lastIndex)} fill="none" stroke="var(--metric-form)" strokeWidth={1.75} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" opacity={0.7} />
            ) : null}
            {todayIndex >= 0 ? <line x1={x(todayIndex)} x2={x(todayIndex)} y1={0} y2={FORM_HEIGHT} stroke="var(--brand)" strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" opacity={0.7} /> : null}
            {active !== null ? (
              <line x1={x(shown)} x2={x(shown)} y1={0} y2={FORM_HEIGHT} stroke="var(--text)" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.5} />
            ) : null}
          </svg>
          <span className="data pointer-events-none absolute right-0 top-0 text-[11px] text-[var(--text-muted)]">+{scales.formRange}</span>
          <span className="data pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-muted)]">0</span>
          <span className="data pointer-events-none absolute bottom-0 right-0 text-[11px] text-[var(--text-muted)]">−{scales.formRange}</span>
        </div>

        <div className="relative mr-9 mt-1.5 h-4 text-[11px] text-[var(--text-muted)]" aria-hidden="true">
          {dateLabels.map(({ entry, index }, position) => (
            <span
              key={entry.day}
              className={`data absolute whitespace-nowrap ${index === 0 ? '' : '-translate-x-1/2'} ${(dateLabels.length - position) % 2 === 0 ? 'max-sm:hidden' : ''}`}
              style={{ left: percent(index) }}
            >
              {formatDayShort(entry.day)}
            </span>
          ))}
          {todayIndex >= 0 ? <span className="absolute -translate-x-1/2 whitespace-nowrap font-medium text-[var(--brand)]" style={{ left: percent(todayIndex) }}>
            Today
          </span> : null}
        </div>
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        The shaded band is the balanced form zone. Dashed lines show where your plan takes you over the next two weeks.
      </p>
    </figure>
  );
}
