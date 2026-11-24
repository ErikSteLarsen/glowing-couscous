'use client';

import { useEffect, useMemo, useRef } from 'react';

import { cadenceFromSpeed, courseProfile, createRiderState, gradientAt, lakesideLoop, lapDistance, step, type RiderState } from '@/lib/ride/virtual-course';
import { CourseScene } from './course/scene';
import type { EntertainmentRide } from './types';

type PowerSource = 'live' | 'target' | 'none' | 'paused';

/** Watts that drive the rider: live power, else the target as a stand-in, else nothing. */
function coursePower(ride: EntertainmentRide): { watts: number; source: PowerSource } {
  if (ride.status === 'paused') return { watts: 0, source: 'paused' };
  const live = ride.reading.powerWatts ?? ride.threeSecondPowerWatts;
  if (live !== null) return { watts: live, source: 'live' };
  if (ride.targetWatts !== null) return { watts: ride.targetWatts, source: 'target' };
  return { watts: 0, source: 'none' };
}

const storageKey = (sessionId: number) => `tempo.ride.course.${sessionId}`;

function loadState(sessionId: number): RiderState {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey(sessionId)) ?? 'null') as { d?: unknown; v?: unknown; t?: unknown } | null;
    if (saved && typeof saved.d === 'number' && Number.isFinite(saved.d)) {
      const fresh = typeof saved.t === 'number' && Date.now() - saved.t < 60_000;
      return createRiderState(saved.d, fresh && typeof saved.v === 'number' ? saved.v : 0);
    }
  } catch {
    // Storage unavailable or corrupt: start at the line.
  }
  return createRiderState();
}

function saveState(sessionId: number, state: RiderState) {
  try {
    window.localStorage.setItem(storageKey(sessionId), JSON.stringify({ d: Math.round(state.distanceM * 10) / 10, v: Math.round(state.speedMps * 100) / 100, t: Date.now() }));
  } catch {
    // Best effort only.
  }
}

function formatClock(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

function gradientColor(gradient: number) {
  if (gradient >= 0.04) return 'var(--color-zone-4)';
  if (gradient >= 0.01) return 'var(--color-zone-3)';
  if (gradient <= -0.01) return 'var(--brand)';
  return 'var(--text-secondary)';
}

const toneColor = { on: 'var(--ride-on)', under: 'var(--ride-under)', over: 'var(--ride-over)', none: 'var(--text)' } as const;

const PROFILE_POINTS = 160;
const textShadow = { textShadow: '0 1px 6px rgb(0 0 0 / 70%)' };

/** Virtual course: a stick-figure rider on the Lakeside Loop, moved by the rider's watts. */
export function CourseView({ ride }: { ride: EntertainmentRide }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rideRef = useRef(ride);
  const engineRef = useRef<{ onRide: (resumed: boolean) => void } | null>(null);
  const speedRef = useRef<HTMLSpanElement>(null);
  const distanceRef = useRef<HTMLSpanElement>(null);
  const gradientRef = useRef<HTMLSpanElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<SVGRectElement>(null);
  const { sessionId } = ride;

  const profile = useMemo(() => {
    const points = courseProfile(PROFILE_POINTS);
    const { minElevationM: min, maxElevationM: max } = lakesideLoop;
    const y = (e: number) => 92 - ((e - min) / (max - min)) * 80;
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${((p.distanceM / lakesideLoop.lengthM) * 1000).toFixed(1)} ${y(p.elevationM).toFixed(1)}`).join(' ');
    return { line, area: `${line} L1000 100 L0 100 Z`, y };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !ctx) return;
    const scene = new CourseScene();
    const state = loadState(sessionId);
    const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = reducedQuery.matches;
    let frame = 0;
    let onScreen = true;
    let lastSim = performance.now();
    let lastDraw = 0;
    let lastStats = 0;
    let lastSave = performance.now();

    // While the ride is paused the course stands still; the clock restarts on resume, so no jump.
    const advance = (now: number) => {
      if (rideRef.current.status !== 'paused') step(state, coursePower(rideRef.current).watts, (now - lastSim) / 1000);
      lastSim = now;
    };
    const shownSpeed = () => (rideRef.current.status === 'paused' ? 0 : state.speedMps);

    const writeStats = (now: number) => {
      if (now - lastStats < 250) return;
      lastStats = now;
      const gradient = gradientAt(state.distanceM);
      const percent = Math.round(gradient * 1000) / 10;
      if (speedRef.current) speedRef.current.textContent = (shownSpeed() * 3.6).toFixed(1);
      if (distanceRef.current) distanceRef.current.textContent = (state.distanceM / 1000).toFixed(1);
      if (gradientRef.current) {
        gradientRef.current.textContent = `${percent > 0 ? '+' : percent < 0 ? '−' : ''}${Math.abs(percent).toFixed(1)}`;
        gradientRef.current.style.color = gradientColor(gradient);
      }
      const lap = lapDistance(state.distanceM) / lakesideLoop.lengthM;
      if (markerRef.current) {
        markerRef.current.style.left = `${(lap * 100).toFixed(2)}%`;
        markerRef.current.style.top = `${profile.y(lakesideLoop.elevationM[Math.floor(lapDistance(state.distanceM) / lakesideLoop.resolutionM)])}%`;
      }
      progressRef.current?.setAttribute('width', (lap * 1000).toFixed(1));
      if (now - lastSave > 5000) {
        lastSave = now;
        saveState(sessionId, state);
      }
    };

    const render = (now: number, dtSec: number) => {
      const current = rideRef.current;
      const power = coursePower(current).watts;
      // Paused: the rider stands still, sits up and waves (the scene's stopped pose).
      const speed = shownSpeed();
      scene.draw(ctx, {
        distanceM: state.distanceM,
        speedMps: speed,
        powerWatts: power,
        targetWatts: current.targetWatts,
        cadenceRpm: current.status === 'paused' ? 0 : current.reading.cadenceRpm ?? cadenceFromSpeed(speed, power),
        accent: current.blockColor,
        reducedMotion,
      }, dtSec);
      lastDraw = now;
    };

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = (now - lastSim) / 1000;
      advance(now);
      if (!reducedMotion || now - lastDraw >= 1000) render(now, dt);
      writeStats(now);
    };
    const running = () => onScreen && !document.hidden;
    const sync = () => {
      if (running() && !frame) {
        lastSim = performance.now();
        frame = requestAnimationFrame(loop);
      } else if (!running() && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };
    // While the loop is stopped (hidden tab, scrolled away), keep the rider moving on each ride update.
    engineRef.current = {
      onRide: (resumed) => {
        const now = performance.now();
        if (resumed) lastSim = now;
        if (frame) return;
        advance(now);
        writeStats(now);
      },
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      scene.resize(rect.width, rect.height, dpr, getComputedStyle(canvas).fontFamily || 'sans-serif');
      render(performance.now(), 0);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? true;
      sync();
    });
    intersection.observe(canvas);
    const onMotion = () => { reducedMotion = reducedQuery.matches; };
    const onHide = () => saveState(sessionId, state);
    reducedQuery.addEventListener('change', onMotion);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pagehide', onHide);
    resize();
    sync();
    writeStats(performance.now());

    return () => {
      cancelAnimationFrame(frame);
      frame = 0;
      engineRef.current = null;
      resizeObserver.disconnect();
      intersection.disconnect();
      reducedQuery.removeEventListener('change', onMotion);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pagehide', onHide);
      saveState(sessionId, state);
    };
  }, [sessionId, profile]);

  useEffect(() => {
    const resumed = rideRef.current.status === 'paused' && ride.status !== 'paused';
    rideRef.current = ride;
    engineRef.current?.onRide(resumed);
  }, [ride]);

  const { source } = coursePower(ride);
  const power = ride.threeSecondPowerWatts;
  const note = source === 'target' ? 'Using target power' : source === 'none' ? 'No power – connect a trainer to ride' : null;

  return (
    <div className="@container relative h-full w-full overflow-hidden bg-[#0B0F15]" role="group" aria-label={`Virtual course: ${lakesideLoop.name}`}>
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block h-full w-full" />
      <p className="sr-only">
        {lakesideLoop.name}, a {lakesideLoop.lengthM / 1000} km loop with rollers, one climb and a descent. Your power sets the rider’s speed.
      </p>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#0B0F15]/80 to-transparent @md:h-32" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0B0F15]/85 to-transparent @md:h-36" />

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 @md:p-5" style={textShadow}>
        <div className="flex items-start justify-between gap-4">
          <dl className="ml-auto flex flex-col items-end text-right">
            <dt className="sr-only">Speed</dt>
            <dd className="flex items-baseline gap-1">
              <span ref={speedRef} className="ride-numeral !leading-none text-[2rem] @md:text-[3rem]">0.0</span>
              <span className="text-[12px] text-[var(--text-muted)]">km/h</span>
            </dd>
            <div className="mt-1.5 flex items-baseline gap-3 @md:mt-2.5 @md:gap-4">
              <div className="flex items-baseline gap-1">
                <dt className="sr-only">Distance</dt>
                <dd className="flex items-baseline gap-1">
                  <span ref={distanceRef} className="ride-numeral !leading-none text-lg @md:text-2xl">0.0</span>
                  <span className="text-[12px] text-[var(--text-muted)]">km</span>
                </dd>
              </div>
              <div className="flex items-baseline gap-1">
                <dt className="sr-only">Gradient</dt>
                <dd className="flex items-baseline gap-1">
                  <span ref={gradientRef} className="ride-numeral !leading-none text-lg @md:text-2xl">0.0</span>
                  <span className="text-[12px] text-[var(--text-muted)]">%</span>
                </dd>
              </div>
            </div>
          </dl>
        </div>

        <div>
          <div className="mb-2 flex items-end justify-between gap-4 @md:mb-5">
            <div className="min-w-0">
              <dl className="-mx-3 -mb-2 hidden rounded-lg bg-[rgb(11_15_21/0.55)] px-3 py-2 @md:block">
                <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">Power</dt>
                <dd className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="ride-numeral !leading-none text-[2.5rem]" style={{ color: power !== null ? toneColor[ride.tone] : undefined }}>{power ?? '--'}</span>
                  {ride.targetWatts !== null ? <span className="data text-sm text-[var(--text-secondary)]">/ {ride.targetWatts} W</span> : power !== null ? <span className="text-[12px] text-[var(--text-muted)]">W</span> : null}
                </dd>
              </dl>
              {note ? <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{note}</p> : null}
            </div>
            <dl className="-mx-3 -mb-2 hidden items-end gap-5 rounded-lg bg-[rgb(11_15_21/0.55)] px-3 py-2 text-right @md:flex">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">Heart rate</dt>
                <dd className="mt-1.5 flex items-baseline justify-end gap-1">
                  <span className="ride-numeral !leading-none text-[1.75rem]" style={{ color: ride.reading.heartRateBpm !== null ? 'var(--ride-hr)' : undefined }}>{ride.reading.heartRateBpm ?? '--'}</span>
                  {ride.reading.heartRateBpm !== null ? <span className="text-[12px] text-[var(--text-muted)]">bpm</span> : null}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">Cadence</dt>
                <dd className="mt-1.5 flex items-baseline justify-end gap-1">
                  <span className="ride-numeral !leading-none text-[1.75rem]">{ride.reading.cadenceRpm !== null ? Math.round(ride.reading.cadenceRpm) : '--'}</span>
                  {ride.reading.cadenceRpm !== null ? <span className="text-[12px] text-[var(--text-muted)]">rpm</span> : null}
                </dd>
              </div>
            </dl>
          </div>

          <div className="relative h-7 @md:h-10" aria-hidden="true">
            <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
              <defs>
                <clipPath id={`course-ridden-${sessionId}`}>
                  <rect ref={progressRef} x="0" y="0" width="0" height="100" />
                </clipPath>
              </defs>
              <path d={profile.area} fill="rgb(94 182 216 / 7%)" />
              <path d={profile.area} fill="rgb(94 182 216 / 20%)" clipPath={`url(#course-ridden-${sessionId})`} />
              <path d={profile.line} fill="none" stroke="var(--brand)" strokeOpacity="0.7" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            </svg>
            <div ref={markerRef} className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0B0F15] bg-[var(--text)]" style={{ left: '0%', top: '92%' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
