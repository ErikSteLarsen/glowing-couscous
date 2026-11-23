'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { buttonFocusClassName } from '@/components/ui';
import { wattsForPct } from '@/lib/workout-catalog/metrics';
import {
  describeProfileStep,
  describeWorkoutProfile,
  fitSpanLabels,
  levelColor,
  profileTimeTicks,
  type WorkoutProfileModel,
  type WorkoutProfileStep,
} from '@/lib/workout-profile';

const WIDTH = 1000;
const HEIGHT = 200;
const ZONE_FLOOR = 0.2;
const ZONE_STEP = 0.155;

function clockLabel(totalSec: number): string {
  const minutes = Math.round(totalSec / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 === 0 ? `${hours}h` : `${hours}h\u00A0${minutes % 60}m`;
}

/** Width of an element in CSS pixels, or null until it has been measured on the client. */
function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * The full-size workout profile shared by session, library, live, comparison and builder
 * views. Time runs left to right without gaps, height is %FTP (or the zone's equivalent),
 * repeated sets are unrolled and bracketed, and a phase row names each stretch.
 *
 * Pass `onSelectStep` to make steps selectable (one tab stop, arrow keys move);
 * `activeStep` outlines the step being followed without making the chart interactive.
 */
export function WorkoutProfile({
  model,
  label,
  ftpWatts = null,
  selectedStep = null,
  onSelectStep,
  activeStep = null,
  size = 'full',
  controlsId,
}: {
  model: WorkoutProfileModel;
  /** Names the chart; the step-by-step description is added automatically. */
  label: string;
  ftpWatts?: number | null;
  selectedStep?: number | null;
  onSelectStep?: (index: number) => void;
  activeStep?: number | null;
  /** `compact` drops the axes and phase labels for tight previews. */
  size?: 'full' | 'compact';
  /** Id of the panel that shows the selected step. */
  controlsId?: string;
}) {
  const gradientPrefix = `profile${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const descriptionId = `${gradientPrefix}-description`;
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const full = size === 'full';
  const { steps, sets, phases } = model;
  const totalSec = Math.max(1, model.totalSec);
  const power = model.axis === 'power';
  const top = Math.max(130, Math.ceil((model.maxPct * 1.08) / 10) * 10);
  const x = (sec: number) => (sec / totalSec) * WIDTH;
  // Power charts scale by %FTP; zone charts give each zone an equal band (level 0–5) above a pause floor.
  const y = (value: number) => HEIGHT - (power ? Math.min(value, top) / top : ZONE_FLOOR + Math.max(-0.5, value) * ZONE_STEP) * HEIGHT;
  const startOf = (step: WorkoutProfileStep) => power ? step.startPct : step.startLevel;
  const endOf = (step: WorkoutProfileStep) => power ? step.endPct : step.endLevel;
  const percentTop = (value: number) => `${(y(value) / HEIGHT) * 100}%`;
  const left = (sec: number) => `${(sec / totalSec) * 100}%`;
  const ticks = full ? profileTimeTicks(model.totalSec) : [];
  const axisLabels = !full ? [] : power
    ? [50, 75, 100, 125, 150, 200, 250, 300].filter((pct) => pct < top).map((pct) => ({ pct, text: ftpWatts ? String(wattsForPct(pct, ftpWatts)) : `${pct}%`, strong: pct === 100 }))
    : [1, 2, 3, 4, 5].map((zone) => ({ pct: zone - 0.5, text: `Z${zone}`, strong: false }));
  const gridPcts = !full ? [] : power ? axisLabels.map((entry) => entry.pct) : [1, 2, 3, 4, 5];
  // Until measured, assume a phone-width chart so the server render never overflows.
  const measured = chartWidth ?? 280;
  const setFits = fitSpanLabels(sets.map((set) => ({ ...set, options: set.labels.map((text) => [text]) })), totalSec, measured);
  const phaseFits = fitSpanLabels(phases.map((phase) => ({ ...phase, options: [[phase.title, phase.detail], [phase.title]] })), totalSec, measured);
  const interactive = Boolean(onSelectStep) && steps.length > 0;
  const focusIndex = selectedStep !== null && selectedStep < steps.length ? selectedStep : 0;

  function move(event: KeyboardEvent<HTMLDivElement>) {
    if (!onSelectStep) return;
    const current = buttonRefs.current.findIndex((button) => button === document.activeElement);
    if (current < 0) return;
    const next = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? Math.min(steps.length - 1, current + 1)
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? Math.max(0, current - 1)
        : event.key === 'Home' ? 0 : event.key === 'End' ? steps.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    onSelectStep(next);
    buttonRefs.current[next]?.focus();
  }

  const outline = (index: number, tone: 'selected' | 'active') => {
    const step = steps[index];
    if (!step) return null;
    return (
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute bottom-0 rounded-t-[3px] border-2 ${tone === 'selected' ? 'border-[var(--text)]' : 'border-[var(--brand)]'}`}
        style={{ left: left(step.startSec), width: `max(4px, ${(step.durationSec / totalSec) * 100}%)`, top: `calc(${percentTop(Math.max(startOf(step), endOf(step)))} - 2px)` }}
      />
    );
  };

  return (
    <div className="min-w-0">
      <p id={descriptionId} className="sr-only">{describeWorkoutProfile(model)}{model.skippedCount ? ` ${model.skippedCount} skipped ${model.skippedCount === 1 ? 'block is' : 'blocks are'} not drawn.` : ''}</p>

      {sets.length ? (
        <div aria-hidden="true" className={`relative h-6 ${full ? 'ml-11' : ''}`}>
          {sets.map((set, index) => (
            <div key={set.startSec} className="absolute bottom-0 flex flex-col items-stretch px-px" style={{ left: left(set.startSec), width: left(set.durationSec) }} title={set.labels[0]}>
              <span className="truncate px-0.5 text-center text-[11px] font-medium leading-4 text-[var(--text-secondary)]">{setFits[index] >= 0 ? set.labels[setFits[index]] : ' '}</span>
              <span className="h-1.5 rounded-t-[2px] border-x border-t border-[var(--text-muted)]" />
            </div>
          ))}
        </div>
      ) : null}

      <figure className={`relative ${full ? 'ml-11 h-44 sm:h-56' : 'h-24'}`}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={label} aria-describedby={descriptionId} className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            {steps.map((step, index) => step.startLevel !== step.endLevel ? (
              <linearGradient key={step.key} id={`${gradientPrefix}-ramp-${index}`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor={levelColor(step.startLevel)} />
                <stop offset="100%" stopColor={levelColor(step.endLevel)} />
              </linearGradient>
            ) : null)}
          </defs>
          {gridPcts.map((pct) => (
            <line key={pct} x1={0} x2={WIDTH} y1={y(pct)} y2={y(pct)} stroke="var(--border)" strokeDasharray={pct === 100 ? '4 5' : undefined} vectorEffect="non-scaling-stroke" />
          ))}
          {ticks.map((tick) => <line key={`t${tick}`} x1={x(tick)} x2={x(tick)} y1={0} y2={HEIGHT} stroke="var(--border)" vectorEffect="non-scaling-stroke" opacity={0.6} />)}
          {steps.map((step, index) => {
            const x0 = x(step.startSec);
            const x1 = x(step.startSec + step.durationSec);
            const pause = step.kind === 'pause';
            return (
              <path
                key={step.key}
                d={`M${x0},${HEIGHT}L${x0},${y(startOf(step))}L${x1},${y(endOf(step))}L${x1},${HEIGHT}Z`}
                fill={pause ? 'var(--text-muted)' : step.startLevel !== step.endLevel ? `url(#${gradientPrefix}-ramp-${index})` : levelColor(step.startLevel)}
                fillOpacity={pause ? 0.4 : step.kind === 'recovery' || step.kind === 'cooldown' || step.kind === 'warmup' ? 0.72 : 0.92}
                stroke="var(--profile-gap, var(--surface))"
                strokeWidth={full ? 1.5 : 1}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
          {full && power ? <line x1={0} x2={WIDTH} y1={y(100)} y2={y(100)} stroke="var(--text-secondary)" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" /> : null}
        </svg>

        {full ? (
          <div aria-hidden="true" className="data pointer-events-none absolute inset-y-0 -left-11 w-10 text-right text-[11px] leading-none text-[var(--text-muted)]">
            {axisLabels.map((entry) => (
              <span key={entry.pct} className={`absolute right-0 -translate-y-1/2 ${entry.strong ? 'text-[var(--text-secondary)]' : ''}`} style={{ top: percentTop(entry.pct) }}>{entry.text}</span>
            ))}
          </div>
        ) : null}
        {full && power ? (
          <span aria-hidden="true" className="data pointer-events-none absolute right-0 -translate-y-full pb-1 text-[11px] text-[var(--text-secondary)]" style={{ top: percentTop(100) }}>
            FTP{ftpWatts ? ` ${ftpWatts} W` : ''}
          </span>
        ) : null}

        {activeStep !== null ? outline(activeStep, 'active') : null}
        {interactive ? (
          <div role="group" aria-label="Workout steps. Use the arrow keys to move between steps" className="absolute inset-0" onKeyDown={move}>
            {steps.map((step, index) => (
              <button
                key={step.key}
                ref={(element) => { buttonRefs.current[index] = element; }}
                type="button"
                tabIndex={index === focusIndex ? 0 : -1}
                aria-pressed={selectedStep === index}
                aria-controls={controlsId}
                aria-label={`${describeProfileStep(model, step)}. Show details`}
                title={describeProfileStep(model, step)}
                onClick={() => onSelectStep?.(index)}
                className={`absolute inset-y-0 cursor-pointer rounded-t-[3px] control-hover:bg-[color-mix(in_oklch,var(--text)_8%,transparent)] ${buttonFocusClassName}`}
                style={{ left: left(step.startSec), width: left(step.durationSec) }}
              />
            ))}
          </div>
        ) : null}
        {selectedStep !== null ? outline(selectedStep, 'selected') : null}
      </figure>

      <div ref={chartRef} className={full ? 'ml-11' : ''}>
        {full && phases.length ? (
          <div aria-hidden="true" className="relative mt-1.5 h-9">
            {phases.map((phase, index) => (
              <div key={phase.startSec} className="absolute inset-y-0 overflow-hidden border-l border-[var(--border-strong)] pl-1" style={{ left: left(phase.startSec), width: left(phase.durationSec) }} title={`${phase.title} · ${phase.detail}`}>
                {phaseFits[index] >= 0 ? (
                  <>
                    <span className="block truncate text-[12px] font-medium leading-4 text-[var(--text)]">{phase.title}</span>
                    {phaseFits[index] === 0 ? <span className="data block truncate text-[11px] leading-4 text-[var(--text-secondary)]">{phase.detail}</span> : null}
                  </>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        {full ? (
          <div aria-hidden="true" className="data relative mt-1 h-4 text-[11px] leading-none text-[var(--text-muted)]">
            <span className="absolute left-0">0</span>
            {ticks.map((tick) => <span key={tick} className="absolute -translate-x-1/2 max-sm:[&:nth-child(odd)]:hidden" style={{ left: left(tick) }}>{clockLabel(tick)}</span>)}
            <span className="absolute right-0">{clockLabel(totalSec)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** A profile with its own selection readout, for read-only pages that have no separate inspector. */
export function WorkoutProfileExplorer({ model, label, ftpWatts = null, hint = 'Select a step to see its target and cue.' }: { model: WorkoutProfileModel; label: string; ftpWatts?: number | null; hint?: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  const panelId = useId();
  const step = selected === null ? null : model.steps[selected];
  const block = step ? model.blocks[step.blockIndex] : null;
  return (
    <div className="space-y-3">
      <WorkoutProfile model={model} label={label} ftpWatts={ftpWatts} selectedStep={selected} onSelectStep={setSelected} controlsId={panelId} />
      <div id={panelId} aria-live="polite" className="min-h-11 border-t border-[var(--border)] pt-3 text-[13px]">
        {step && block ? (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="font-medium text-[var(--text)]">{step.repetition ? `Rep ${step.repetition.index} of ${step.repetition.of} · ` : ''}{step.label}</span>
            {block.targetLabel ? <span className="data text-[var(--text)]">{block.targetLabel}</span> : null}
            {block.note ? <span className="basis-full text-[var(--text-secondary)]">{block.note}</span> : null}
          </div>
        ) : <p className="text-[12px] text-[var(--text-secondary)]">{hint}</p>}
      </div>
    </div>
  );
}
