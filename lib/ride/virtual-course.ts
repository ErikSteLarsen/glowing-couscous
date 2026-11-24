/**
 * Virtual course for the ride screen's entertainment view: one looping course
 * and a simple point-mass bike model, so the rider's watts become speed along it.
 * Pure module (no DOM); the view owns rendering, timing and persistence.
 */

export type VirtualCourse = {
  name: string;
  lengthM: number;
  /** Smoothed elevation sampled every `resolutionM` metres around the loop (index 0 is the start). */
  elevationM: Float32Array;
  /** Gradient as a fraction (0.06 is 6 %) at the same samples. */
  gradient: Float32Array;
  resolutionM: number;
  minElevationM: number;
  maxElevationM: number;
};

/** [distance m, elevation m] control points; the last point closes the loop at the start's elevation. */
const LAKESIDE_LOOP_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0, 120], [800, 121],
  // Lakeshore rollers.
  [1200, 118], [1500, 125], [1800, 119], [2100, 126], [2400, 120], [2700, 127], [3000, 121],
  [3600, 122], [4200, 124], [4500, 126],
  // The climb: about 1.5 km at 5.5–6.5 %.
  [5000, 155], [5500, 187], [6000, 215], [6300, 217],
  // Descent back to the lake.
  [6800, 196], [7400, 166], [8000, 139], [8400, 131],
  [9000, 127], [9600, 130], [10200, 125], [10800, 123], [11400, 121], [12000, 120],
];

/**
 * Builds a course from control points: linear between points, then smoothed with a
 * wrap-around moving average so gradients change gradually instead of in steps.
 */
export function createCourse(name: string, points: ReadonlyArray<readonly [number, number]>, resolutionM = 10, smoothingM = 160): VirtualCourse {
  const lengthM = points[points.length - 1][0];
  const count = Math.round(lengthM / resolutionM);
  const raw = new Float32Array(count);
  let segment = 0;
  for (let i = 0; i < count; i++) {
    const d = i * resolutionM;
    while (segment < points.length - 2 && points[segment + 1][0] <= d) segment++;
    const [d0, e0] = points[segment];
    const [d1, e1] = points[segment + 1];
    raw[i] = e0 + ((e1 - e0) * (d - d0)) / (d1 - d0);
  }
  const half = Math.max(1, Math.round(smoothingM / resolutionM / 2));
  const elevationM = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let sum = 0;
    for (let k = -half; k <= half; k++) sum += raw[(i + k + count) % count];
    elevationM[i] = sum / (2 * half + 1);
  }
  const gradient = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    gradient[i] = (elevationM[(i + 1) % count] - elevationM[(i - 1 + count) % count]) / (2 * resolutionM);
  }
  let minElevationM = Infinity;
  let maxElevationM = -Infinity;
  for (const e of elevationM) {
    minElevationM = Math.min(minElevationM, e);
    maxElevationM = Math.max(maxElevationM, e);
  }
  return { name, lengthM, elevationM, gradient, resolutionM, minElevationM, maxElevationM };
}

export const lakesideLoop = createCourse('Lakeside Loop', LAKESIDE_LOOP_POINTS);

/** Position within the loop, 0 ≤ result < length, for any (also negative) distance. */
export function lapDistance(distanceM: number, course: VirtualCourse = lakesideLoop): number {
  const d = distanceM % course.lengthM;
  return d < 0 ? d + course.lengthM : d;
}

function sample(values: Float32Array, distanceM: number, course: VirtualCourse): number {
  const x = lapDistance(distanceM, course) / course.resolutionM;
  const i = Math.floor(x);
  const t = x - i;
  const a = values[i % values.length];
  const b = values[(i + 1) % values.length];
  return a + (b - a) * t;
}

/** Elevation in metres at a distance along the course; wraps around the loop. */
export function elevationAt(distanceM: number, course: VirtualCourse = lakesideLoop): number {
  return sample(course.elevationM, distanceM, course);
}

/** Gradient as a fraction (0.06 is 6 %) at a distance along the course; wraps around the loop. */
export function gradientAt(distanceM: number, course: VirtualCourse = lakesideLoop): number {
  return sample(course.gradient, distanceM, course);
}

/** Down-sampled elevation profile for a mini map: `points` evenly spaced samples covering one lap. */
export function courseProfile(points = 120, course: VirtualCourse = lakesideLoop): Array<{ distanceM: number; elevationM: number }> {
  return Array.from({ length: points }, (_, i) => {
    const distanceM = (i / (points - 1)) * course.lengthM;
    return { distanceM, elevationM: elevationAt(distanceM, course) };
  });
}

export type RiderPhysics = {
  /** Rider plus bike, kg. */
  massKg: number;
  rollingResistance: number;
  /** Drag area, m². */
  dragAreaM2: number;
  airDensity: number;
  drivetrainEfficiency: number;
  /** Propulsive force is computed at no less than this speed, so starting from rest stays finite. */
  minPropulsionSpeedMps: number;
  /** Largest integration step, seconds. */
  maxStepSec: number;
  /** A longer gap (a hidden tab) is simulated for at most this long. */
  maxSimulatedSec: number;
};

export const defaultRiderPhysics: RiderPhysics = {
  massKg: 75 + 9,
  rollingResistance: 0.004,
  dragAreaM2: 0.32,
  airDensity: 1.225,
  drivetrainEfficiency: 0.97,
  minPropulsionSpeedMps: 1,
  maxStepSec: 1 / 30,
  maxSimulatedSec: 5,
};

const GRAVITY = 9.81;

export type RiderState = {
  /** Total distance ridden on the course, metres (not wrapped). */
  distanceM: number;
  speedMps: number;
};

export function createRiderState(distanceM = 0, speedMps = 0): RiderState {
  return { distanceM: Math.max(0, distanceM), speedMps: Math.max(0, speedMps) };
}

/** Net acceleration in m/s² at a speed, power and gradient. */
export function acceleration(speedMps: number, powerWatts: number, gradient: number, physics: RiderPhysics = defaultRiderPhysics): number {
  const { massKg: m, rollingResistance, dragAreaM2, airDensity, drivetrainEfficiency, minPropulsionSpeedMps } = physics;
  const angle = Math.atan(gradient);
  const propulsion = (drivetrainEfficiency * Math.max(0, powerWatts)) / Math.max(speedMps, minPropulsionSpeedMps);
  const rolling = speedMps > 0 ? rollingResistance * m * GRAVITY * Math.cos(angle) : 0;
  const climbing = m * GRAVITY * Math.sin(angle);
  const drag = 0.5 * airDensity * dragAreaM2 * speedMps * speedMps;
  return (propulsion - rolling - climbing - drag) / m;
}

/**
 * Advances the rider by `dtSec` at a constant power, in sub-steps of at most
 * `maxStepSec` so the result does not depend on the frame rate. Gaps longer than
 * `maxSimulatedSec` are cut short. Mutates and returns `state`; speed never goes
 * below zero (a rider without power on a climb stops rather than rolling back).
 */
export function step(state: RiderState, powerWatts: number, dtSec: number, course: VirtualCourse = lakesideLoop, physics: RiderPhysics = defaultRiderPhysics): RiderState {
  const duration = Math.min(Math.max(0, Number.isFinite(dtSec) ? dtSec : 0), physics.maxSimulatedSec);
  if (duration === 0) return state;
  const power = Number.isFinite(powerWatts) ? Math.max(0, powerWatts) : 0;
  const steps = Math.ceil(duration / physics.maxStepSec);
  const h = duration / steps;
  for (let i = 0; i < steps; i++) {
    const a = acceleration(state.speedMps, power, gradientAt(state.distanceM, course), physics);
    state.speedMps = Math.max(0, state.speedMps + a * h);
    state.distanceM += state.speedMps * h;
  }
  return state;
}

/** A plausible cadence for the animation when no cadence sensor is connected. */
export function cadenceFromSpeed(speedMps: number, powerWatts: number): number {
  if (speedMps < 0.5 || powerWatts < 10) return 0;
  return Math.min(100, Math.max(62, 58 + speedMps * 3));
}
