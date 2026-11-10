'use client';

import { useEffect, useRef } from 'react';
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

/** A brief rise and fall that repeats every `period` seconds: 0 on the ground, 1 at the top. */
function hop(time: number, period: number, length: number) {
  const phase = time % period;
  return phase < length ? Math.sin((Math.PI * phase) / length) : 0;
}

type Mover = {
  figure: SVGGElement;
  tail: SVGPathElement | null;
  gradient: SVGLinearGradientElement | null;
  start: number;
  x: number;
};

/**
 * Decorative landing background. Stick figures ride, run, and swim across the
 * whole page on rolling terrain while one presses a barbell on a rise. Hidden
 * from assistive tech; holds a still frame when motion is reduced.
 */
export function TrainingScene() {
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    const svg = scene?.querySelector('svg');
    if (!scene || !svg) return;

    const part = <T extends SVGElement>(name: string) => svg.querySelector<T>(`[data-part="${name}"]`)!;
    const mover = (name: string, start: number): Mover => ({
      figure: part<SVGGElement>(name),
      tail: svg.querySelector<SVGPathElement>(`[data-tail="${name}"]`),
      gradient: svg.querySelector<SVGLinearGradientElement>(`#ts-tail-${name}`),
      start,
      x: 0,
    });

    const rideTrail = part<SVGPathElement>('ride-trail');
    const runTrail = part<SVGPathElement>('run-trail');
    const rise = part<SVGPathElement>('rise');
    const surface = part<SVGPathElement>('surface');
    const deep = part<SVGPathElement>('deep');
    const lifter = part<SVGGElement>('lifter');
    const cyclist = mover('cyclist', 0.5);
    const runner = mover('runner', 0.22);
    const chaser = mover('chaser', 0.72);
    const swimmer = mover('swimmer', 0.45);
    const movers = [cyclist, runner, chaser, swimmer];

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

    function place(target: Mover, y: number, angle: number, direction: 1 | -1) {
      target.figure.setAttribute(
        'transform',
        `translate(${target.x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(1)}) scale(${direction * scale} ${scale})`,
      );
    }

    /** The fading trace a mover leaves behind on its line. */
    function trail(target: Mover, line: (x: number) => number, direction: 1 | -1) {
      if (!target.tail || !target.gradient) return;
      const end = target.x - direction * 190 * scale;
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

      // The cyclist slows on the climb, speeds up downhill, and pops a small hop.
      const rideSlope = slope(rideY, cyclist.x);
      advance(cyclist, dt * (width * 0.1 + 70) * clamp(1 + 1.5 * rideSlope, 0.5, 1.8));
      const bunny = hop(time, 6.4, 0.7);
      place(cyclist, rideY(cyclist.x) - bunny * 26 * scale, degrees(rideSlope) - bunny * 14, 1);
      trail(cyclist, rideY, 1);

      advance(runner, dt * (width * 0.06 + 46));
      const leap = hop(time + 2, 4.6, 0.62);
      place(runner, runY(runner.x) - leap * 44 * scale, degrees(slope(runY, runner.x)) * 0.5 - leap * 8, 1);
      trail(runner, runY, 1);

      advance(chaser, -dt * (width * 0.085 + 60));
      const skip = hop(time, 3.3, 0.5);
      place(chaser, runY(chaser.x) - skip * 30 * scale, degrees(slope(runY, chaser.x)) * 0.5, -1);
      trail(chaser, runY, -1);

      // The swimmer rides the moving surface and ducks under it now and then.
      advance(swimmer, -dt * (width * 0.03 + 20));
      const wave = (x: number) => waveY(x, time);
      const divePhase = (time % 9) / 1.6;
      const dive = divePhase < 1 ? Math.sin(Math.PI * divePhase) : 0;
      const diveTilt = divePhase < 1 ? Math.cos(Math.PI * divePhase) * 32 : 0;
      place(swimmer, wave(swimmer.x) + dive * 26 * scale, -degrees(slope(wave, swimmer.x)) + diveTilt, -1);

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
          {['cyclist', 'runner', 'chaser'].map((name) => (
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

        <path className="ts-tail" data-tail="cyclist" stroke="url(#ts-tail-cyclist)" />
        <path className="ts-tail" data-tail="runner" stroke="url(#ts-tail-runner)" />
        <path className="ts-tail" data-tail="chaser" stroke="url(#ts-tail-chaser)" />

        <g className="ts-figure" data-part="lifter">
          <Lifter />
        </g>
        <g className="ts-figure" data-part="swimmer">
          <Swimmer />
        </g>
        <g className="ts-figure" data-part="chaser">
          <Runner />
        </g>
        <g className="ts-figure ts-figure--lead" data-part="cyclist">
          <Cyclist />
        </g>
        <g className="ts-figure ts-figure--lead" data-part="runner">
          <Runner />
        </g>
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

function Cyclist() {
  return (
    <g transform="translate(0 -17.5)">
      <PedalLeg />
      <Wheel x={-24} />
      <Wheel x={24} />
      <path d="M-24 0L-8 -26L16 -24L0 0ZM-24 0H0M16 -24L24 0M16 -24L20 -31" strokeWidth="2" />
      <path className="ts-spin" d="M-7 0H7" />
      <path d="M-8 -28L10 -48L20 -31" />
      <circle cx="16" cy="-56" r="6.5" />
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
