'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import './training-scene.css';

const TAU = Math.PI * 2;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(value: number) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

/** Terrain heights as a fraction of the scene height, by horizontal fraction. */
function rideLine(u: number) {
  return 0.72 - 0.36 * smoothstep((u - 0.2) / 0.55) + 0.08 * smoothstep((u - 0.8) / 0.3) + 0.022 * Math.sin(u * 9);
}

function runLine(u: number) {
  return 0.815 + 0.022 * Math.sin(u * 7 + 1) + 0.012 * Math.sin(u * 15);
}

type Cast = {
  name: string;
  line: 'ride' | 'run' | 'swim';
  /** Starting point as a fraction of the scene width. */
  start: number;
  direction: 1 | -1;
  /** Travel speed relative to the usual speed on this line. */
  speed: number;
  /** Limb cycle length relative to the usual cadence; lower is quicker. */
  pace: number;
  posture?: 'tempo' | 'relaxed';
  lead?: boolean;
};

/** Everyone who moves, drawn back to front. Each has their own speed and cadence. */
const CAST: Cast[] = [
  { name: 'swimmer', line: 'swim', start: 0.45, direction: -1, speed: 1, pace: 0.9 },
  { name: 'floater', line: 'swim', start: 0.8, direction: 1, speed: 0.6, pace: 1.45 },
  { name: 'cruiser', line: 'ride', start: 0.92, direction: -1, speed: 0.68, pace: 1.35, posture: 'relaxed' },
  { name: 'jogger', line: 'run', start: 0.58, direction: 1, speed: 0.7, pace: 1.22 },
  { name: 'chaser', line: 'run', start: 0.95, direction: -1, speed: 1.28, pace: 0.84 },
  { name: 'cyclist', line: 'ride', start: 0.3, direction: 1, speed: 1.08, pace: 0.8, posture: 'tempo', lead: true },
  { name: 'runner', line: 'run', start: 0.2, direction: 1, speed: 1, pace: 1, lead: true },
];

const LAND_CAST = CAST.filter((member) => member.line !== 'swim');

type Mover = Cast & {
  figure: SVGGElement;
  tail: SVGPathElement | null;
  gradient: SVGLinearGradientElement | null;
  x: number;
};

/**
 * Decorative landing background. Stick figures ride, run, and swim across the
 * whole page on rolling terrain, each at their own speed and cadence, while one presses a barbell on a rise. Hidden
 * from assistive tech; holds a still frame when motion is reduced.
 */
export function TrainingScene() {
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    const svg = scene?.querySelector('svg');
    if (!scene || !svg) return;

    const part = <T extends SVGElement>(name: string) => svg.querySelector<T>(`[data-part="${name}"]`)!;
    const movers: Mover[] = CAST.map((member) => ({
      ...member,
      figure: part<SVGGElement>(member.name),
      tail: svg.querySelector<SVGPathElement>(`[data-tail="${member.name}"]`),
      gradient: svg.querySelector<SVGLinearGradientElement>(`#ts-tail-${member.name}`),
      x: 0,
    }));

    const rideTrail = part<SVGPathElement>('ride-trail');
    const runTrail = part<SVGPathElement>('run-trail');
    const rise = part<SVGPathElement>('rise');
    const surface = part<SVGPathElement>('surface');
    const deep = part<SVGPathElement>('deep');
    const lifter = part<SVGGElement>('lifter');

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0;
    let height = 0;
    let scale = 1;
    let margin = 0;
    let frame = 0;
    let last = 0;
    let time = 0;

    const rideY = (x: number) => height * rideLine(x / width);
    const runY = (x: number) => height * runLine(x / width);
    const waveY = (x: number, t: number) =>
      height * 0.925 + scale * (4 * Math.sin(x / 38 + t * 1.6) + 2.5 * Math.sin(x / 17 - t * 1.1));
    const slope = (line: (x: number) => number, x: number) => (line(x + 4) - line(x - 4)) / 8;
    const degrees = (gradient: number) => (Math.atan(gradient) * 360) / TAU;

    function trace(line: (x: number) => number, from: number, to: number, step = 8) {
      let d = '';
      for (let x = from; x < to; x += step) d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${line(x).toFixed(1)}`;
      return `${d}L${to.toFixed(1)} ${line(to).toFixed(1)}`;
    }

    function place(target: Mover, y: number, angle: number) {
      target.figure.setAttribute(
        'transform',
        `translate(${target.x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(1)}) scale(${target.direction * scale} ${scale})`,
      );
    }

    /** The fading trace a mover leaves behind on its line. */
    function trail(target: Mover, line: (x: number) => number) {
      if (!target.tail || !target.gradient) return;
      const end = target.x - target.direction * 190 * scale;
      target.tail.setAttribute('d', trace(line, Math.min(end, target.x), Math.max(end, target.x)));
      target.gradient.setAttribute('x1', end.toFixed(1));
      target.gradient.setAttribute('x2', target.x.toFixed(1));
    }

    function advance(target: Mover, distance: number) {
      const span = width + margin * 2;
      target.x = ((((target.x + margin + distance) % span) + span) % span) - margin;
    }

    function draw(dt: number) {
      time += dt;

      const wave = (x: number) => waveY(x, time);

      for (const target of movers) {
        if (target.line === 'swim') {
          advance(target, dt * target.direction * target.speed * (width * 0.03 + 20));
          place(target, wave(target.x), degrees(slope(wave, target.x)) * 0.6);
          continue;
        }

        // Riders slow clearly on a climb and pick up speed downhill; runners only a little.
        const riding = target.line === 'ride';
        const line = riding ? rideY : runY;
        const climb = slope(line, target.x) * target.direction;
        const effort = riding ? clamp(1 + 1.5 * climb, 0.5, 1.8) : clamp(1 + 0.6 * climb, 0.85, 1.15);
        const usual = riding ? width * 0.1 + 70 : width * 0.065 + 48;
        advance(target, dt * target.direction * target.speed * usual * effort);
        place(target, line(target.x), degrees(slope(line, target.x)) * (riding ? 1 : 0.5));
        trail(target, line);
      }

      surface.setAttribute('d', trace(wave, -8, width + 8));
      deep.setAttribute('d', trace((x) => waveY(x + 60, time * 0.7 + 2) + 9 * scale, -8, width + 8));
    }

    function layout() {
      const box = scene!.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const previousWidth = width;
      width = box.width;
      height = box.height;
      scale = clamp(height / 700, 0.68, 1.2);
      margin = 130 * scale;
      svg!.setAttribute('viewBox', `0 0 ${width} ${height}`);

      for (const target of movers) {
        target.x = previousWidth ? (target.x / previousWidth) * width : target.start * width;
      }

      rideTrail.setAttribute('d', trace(rideY, -8, width + 8));
      runTrail.setAttribute('d', trace(runY, -8, width + 8));

      const riseX = width * 0.86;
      const riseY = height * 0.64;
      const reach = 58 * scale;
      const drop = 9 * scale;
      rise.setAttribute('d', `M${riseX - reach} ${riseY + drop}Q${riseX} ${riseY - drop} ${riseX + reach} ${riseY + drop}`);
      lifter.setAttribute('transform', `translate(${riseX} ${riseY}) scale(${scale})`);

      draw(0);
      svg!.dataset.ready = 'true';
    }

    function tick(now: number) {
      draw(Math.min((now - last) / 1000, 0.05));
      last = now;
      frame = requestAnimationFrame(tick);
    }

    function start() {
      cancelAnimationFrame(frame);
      if (reduceMotion.matches) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }

    const observer = new ResizeObserver(layout);
    observer.observe(scene);
    layout();
    start();
    reduceMotion.addEventListener('change', start);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      reduceMotion.removeEventListener('change', start);
    };
  }, []);

  return (
    <div className="ts-scene" ref={sceneRef} aria-hidden="true">
      <svg className="ts-canvas">
        <defs>
          {LAND_CAST.map(({ name }) => (
            <linearGradient key={name} id={`ts-tail-${name}`} gradientUnits="userSpaceOnUse" y1="0" y2="0">
              <stop className="ts-tail-stop" offset="0" stopOpacity="0" />
              <stop className="ts-tail-stop" offset="1" stopOpacity="0.85" />
            </linearGradient>
          ))}
        </defs>

        <path className="ts-trail" data-part="ride-trail" />
        <path className="ts-trail" data-part="run-trail" />
        <path className="ts-trail" data-part="rise" />
        <path className="ts-water ts-water--deep" data-part="deep" />
        <path className="ts-water" data-part="surface" />

        {LAND_CAST.map(({ name }) => (
          <path key={name} className="ts-tail" data-tail={name} stroke={`url(#ts-tail-${name})`} />
        ))}

        <g className="ts-figure" data-part="lifter">
          <Lifter />
        </g>
        {CAST.map((member) => (
          <g
            key={member.name}
            className={`ts-figure${member.lead ? ' ts-figure--lead' : ''}`}
            data-part={member.name}
            style={{ '--ts-pace': member.pace } as CSSProperties}
          >
            {member.line === 'swim' && <Swimmer />}
            {member.line === 'run' && <Runner />}
            {member.line === 'ride' && <Cyclist posture={member.posture} />}
          </g>
        ))}
      </svg>
    </div>
  );
}

function RunLeg({ lead }: { lead?: boolean }) {
  const phase = lead ? '' : ' ts-half';
  return (
    <g className={`ts-run-thigh${phase}`}>
      <path d="M0 0V22" />
      <g transform="translate(0 22)">
        <path className={`ts-run-shin${phase}`} d="M0 0V22" />
      </g>
    </g>
  );
}

function RunArm({ lead }: { lead?: boolean }) {
  return (
    <g transform="translate(5 -30)">
      <g className={`ts-run-arm${lead ? '' : ' ts-half'}`}>
        <path d="M0 0V15" />
        <path d="M0 15L12 19" />
      </g>
    </g>
  );
}

/** Each figure is drawn with its ground contact at the origin, facing right. */
function Runner() {
  return (
    <g transform="translate(0 -45)">
      <g className="ts-run-bob">
        <RunArm />
        <RunLeg />
        <circle cx="8" cy="-46" r="7" />
        <path d="M0 0L6 -36" />
        <RunLeg lead />
        <RunArm lead />
      </g>
    </g>
  );
}

function Wheel({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <circle r="16" />
      <path className="ts-spin" d="M-16 0H16M0 -16V16" strokeWidth="1.5" />
    </g>
  );
}

function PedalLeg({ lead }: { lead?: boolean }) {
  const phase = lead ? '' : ' ts-half';
  return (
    <g transform="translate(-8 -28)">
      <g className={`ts-pedal-thigh${phase}`}>
        <path d="M0 0V18" />
        <g transform="translate(0 18)">
          <path className={`ts-pedal-shin${phase}`} d="M0 0V18" />
        </g>
      </g>
    </g>
  );
}

/** Shoulder, hand, and head positions, from tucked over the bars to sitting up. */
const POSTURES = {
  tempo: { shoulder: '14 -43', hands: '23 -27', bars: 'M16 -24L20 -30L24 -26', head: [22, -48] },
  neutral: { shoulder: '10 -48', hands: '20 -31', bars: 'M16 -24L20 -31', head: [16, -56] },
  relaxed: { shoulder: '4 -51', hands: '17 -35', bars: 'M16 -24L17 -35', head: [8, -60] },
};

function Cyclist({ posture = 'neutral' }: { posture?: keyof typeof POSTURES }) {
  const { shoulder, hands, bars, head } = POSTURES[posture];
  return (
    <g transform="translate(0 -17.5)">
      <PedalLeg />
      <Wheel x={-24} />
      <Wheel x={24} />
      <path d={`M-24 0L-8 -26L16 -24L0 0ZM-24 0H0M16 -24L24 0${bars}`} strokeWidth="2" />
      <path className="ts-spin" d="M-7 0H7" />
      <path d={`M-8 -28L${shoulder}L${hands}`} />
      <circle cx={head[0]} cy={head[1]} r="6.5" />
      <PedalLeg lead />
    </g>
  );
}

function PressArm() {
  return (
    <g transform="translate(8 -50)">
      <g className="ts-press-upper">
        <path d="M0 0V16" />
        <g transform="translate(0 16)">
          <path className="ts-press-fore" d="M0 0V16" />
        </g>
      </g>
    </g>
  );
}

function Lifter() {
  return (
    <g transform="translate(0 -1.5)">
      <circle cx="0" cy="-63" r="6.5" />
      <path d="M-8 -50H8M0 -50V-26M0 -26L-9 0M0 -26L9 0" />
      <PressArm />
      <g transform="scale(-1 1)">
        <PressArm />
      </g>
      <g className="ts-press-bar">
        <path d="M-34 0H34" strokeWidth="2" />
        <path d="M-27 -10V10M27 -10V10M-32 -7V7M32 -7V7" strokeWidth="4" />
      </g>
    </g>
  );
}

function Swimmer() {
  return (
    <g>
      <g transform="translate(14 1)">
        <path className="ts-stroke ts-half" d="M0 0H20" />
      </g>
      <circle cx="25" cy="-2" r="6" />
      <path d="M16 1L-18 4" />
      <g transform="translate(-18 4)">
        <path className="ts-kick" d="M0 0H-18" />
        <path className="ts-kick ts-half" d="M0 0H-18" />
      </g>
      <g transform="translate(14 1)">
        <path className="ts-stroke" d="M0 0H20" />
      </g>
    </g>
  );
}
