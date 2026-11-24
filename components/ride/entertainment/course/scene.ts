import { elevationAt, gradientAt, lakesideLoop, lapDistance, type VirtualCourse } from '@/lib/ride/virtual-course';

/** What one frame needs from the simulation. Read-only; the scene keeps its own animation phases. */
export type SceneFrame = {
  distanceM: number;
  speedMps: number;
  powerWatts: number;
  targetWatts: number | null;
  cadenceRpm: number;
  /** Jersey colour (the current block's intensity colour). */
  accent: string;
  reducedMotion: boolean;
};

const COLORS = {
  skyTop: '#05080C',
  skyHorizon: '#16263A',
  star: '#C9D6E3',
  moon: '#DCE6F0',
  farHills: '#132033',
  farRim: '#2A4362',
  lake: '#0D1B29',
  lakeShimmer: 'rgba(94, 182, 216, 0.22)',
  midHills: '#0F2124',
  midRim: '#24403F',
  trees: '#0B1B1D',
  ground: '#0B0F15',
  groundDeep: '#080B10',
  road: '#1E2731',
  roadEdge: '#5EB6D8',
  tuft: '#1C3332',
  post: '#3A4656',
  reflector: '#F0A84A',
  plate: '#151B24',
  plateBorder: '#323C4A',
  plateText: '#A9B4C1',
  frame: '#5EB6D8',
  wheel: '#A9B4C1',
  spoke: 'rgba(169, 180, 193, 0.45)',
  limb: '#EEF2F6',
  limbFar: '#7E8B9A',
  head: '#EEF2F6',
  ink: '#0B0F15',
  helmet: '#5EB6D8',
  sweat: '#9FD6EA',
  whoosh: 'rgba(94, 182, 216, 0.55)',
};

/** Real wheel radius in metres, for wheel rotation. */
const WHEEL_RADIUS_M = 0.34;
/** Vertical exaggeration so a 6 % climb reads as a climb. */
const VERTICAL_EXAGGERATION = 3.2;
const ROAD_STEP_PX = 6;
const MAX_DROPS = 12;

/** Small seeded generator so layers look the same on every resize. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(i: number) {
  const x = Math.sin(i * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function makeLayer(width: number, height: number, dpr: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(dpr, dpr);
    paint(ctx);
  }
  return canvas;
}

/** Periodic ridge line: whole numbers of waves per tile, so the tile repeats without a seam. */
function ridge(x: number, width: number, waves: ReadonlyArray<readonly [number, number, number]>) {
  let y = 0;
  for (const [count, amplitude, phase] of waves) y += amplitude * Math.sin((2 * Math.PI * count * x) / width + phase);
  return y;
}

type Point = { x: number; y: number };

/** Two-bone joint (knee or elbow) between a root and an end; `bendLow` picks the lower solution. */
function joint(out: Point, rx: number, ry: number, ex: number, ey: number, upper: number, lower: number, bendForward: boolean) {
  const dx = ex - rx;
  const dy = ey - ry;
  const d = Math.min(Math.max(Math.hypot(dx, dy), 1e-4), upper + lower - 1e-4);
  const a = (upper * upper - lower * lower + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, upper * upper - a * a));
  const ux = dx / d;
  const uy = dy / d;
  const px = rx + a * ux;
  const py = ry + a * uy;
  // Perpendicular candidates; knees bend forward (+x), elbows bend down (+y).
  const x1 = px - h * uy;
  const y1 = py + h * ux;
  const x2 = px + h * uy;
  const y2 = py - h * ux;
  const pickFirst = bendForward ? x1 >= x2 : y1 >= y2;
  out.x = pickFirst ? x1 : x2;
  out.y = pickFirst ? y1 : y2;
}

/**
 * Side-view course scene drawn on one canvas: static sky, two repeating parallax
 * layers rendered once per resize, then the road, roadside markers and the rider
 * each frame. No allocation in the frame path apart from canvas state.
 */
export class CourseScene {
  private width = 0;
  private height = 0;
  private dpr = 1;
  private unit = 12;
  private pxPerM = 7;
  private anchorX = 0;
  private anchorY = 0;
  private font = 'sans-serif';
  private sky: HTMLCanvasElement | null = null;
  private far: HTMLCanvasElement | null = null;
  private mid: HTMLCanvasElement | null = null;
  private farHeight = 0;
  private midHeight = 0;
  private roadY = new Float32Array(0);
  private groundFill: CanvasGradient | null = null;
  private crank = 0;
  private wheel = 0;
  private time = 0;
  private lean = 0.66;
  private nextDropSec = 0;
  private drops = { x: new Float32Array(MAX_DROPS), y: new Float32Array(MAX_DROPS), vx: new Float32Array(MAX_DROPS), vy: new Float32Array(MAX_DROPS), life: new Float32Array(MAX_DROPS) };
  private knee: Point = { x: 0, y: 0 };
  private elbow: Point = { x: 0, y: 0 };

  constructor(private readonly course: VirtualCourse = lakesideLoop) {}

  resize(width: number, height: number, dpr: number, font: string) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.font = font;
    const compact = width < 560;
    this.unit = Math.min(24, Math.max(10, height * (compact ? 0.046 : 0.05)));
    this.pxPerM = this.unit * 0.55;
    this.anchorX = Math.round(width * (compact ? 0.32 : 0.3));
    this.anchorY = Math.round(height * (compact ? 0.56 : 0.6));
    this.roadY = new Float32Array(Math.ceil(width / ROAD_STEP_PX) + 3);
    this.groundFill = null;
    this.buildLayers();
  }

  private buildLayers() {
    const { width: w, height: h, dpr } = this;
    if (w < 1 || h < 1) return;
    const random = seeded(7);
    this.sky = makeLayer(w, h, dpr, (ctx) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, h * 0.62);
      gradient.addColorStop(0, COLORS.skyTop);
      gradient.addColorStop(1, COLORS.skyHorizon);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = COLORS.star;
      const stars = Math.round((w * h) / 9000);
      for (let i = 0; i < stars; i++) {
        ctx.globalAlpha = 0.25 + random() * 0.6;
        const size = random() < 0.15 ? 1.6 : 1;
        ctx.fillRect(random() * w, random() * h * 0.5, size, size);
      }
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = COLORS.moon;
      const r = Math.max(8, h * 0.035);
      const moonX = w * (w < 560 ? 0.38 : 0.6);
      ctx.beginPath();
      ctx.arc(moonX, h * 0.15, r, 0, Math.PI * 2);
      ctx.fill();
      // Crescent: cut with a sky-coloured disc.
      ctx.globalAlpha = 1;
      ctx.fillStyle = COLORS.skyTop;
      ctx.beginPath();
      ctx.arc(moonX + r * 0.45, h * 0.15 - r * 0.25, r * 0.9, 0, Math.PI * 2);
      ctx.fill();
    });

    const lakeHeight = h * 0.07;
    this.farHeight = h * 0.42;
    const farTop = this.farHeight - lakeHeight;
    this.far = makeLayer(w, this.farHeight, dpr, (ctx) => {
      const waves = [[2, h * 0.05, 0.4], [5, h * 0.03, 1.7], [11, h * 0.012, 0.2]] as const;
      ctx.beginPath();
      ctx.moveTo(0, farTop);
      for (let x = 0; x <= w; x += 4) ctx.lineTo(x, farTop - h * 0.1 - ridge(x, w, waves));
      ctx.lineTo(w, farTop);
      ctx.closePath();
      ctx.fillStyle = COLORS.farHills;
      ctx.fill();
      ctx.strokeStyle = COLORS.farRim;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) ctx.lineTo(x, farTop - h * 0.1 - ridge(x, w, waves));
      ctx.stroke();
      ctx.fillStyle = COLORS.lake;
      ctx.fillRect(0, farTop, w, lakeHeight);
      ctx.strokeStyle = COLORS.lakeShimmer;
      ctx.beginPath();
      for (let i = 0; i < Math.round(w / 40); i++) {
        const x = random() * w;
        const y = farTop + 3 + random() * (lakeHeight - 6);
        const length = 8 + random() * 30;
        ctx.moveTo(x, y);
        ctx.lineTo(Math.min(w, x + length), y);
      }
      ctx.stroke();
    });

    this.midHeight = h * 0.7;
    this.mid = makeLayer(w, this.midHeight, dpr, (ctx) => {
      const waves = [[3, h * 0.045, 2.1], [7, h * 0.02, 0.9], [1, h * 0.03, 0.3]] as const;
      const top = h * 0.1;
      const surface = (x: number) => top - ridge(x, w, waves);
      ctx.beginPath();
      ctx.moveTo(0, this.midHeight);
      for (let x = 0; x <= w; x += 4) ctx.lineTo(x, surface(x));
      ctx.lineTo(w, this.midHeight);
      ctx.closePath();
      ctx.fillStyle = COLORS.midHills;
      ctx.fill();
      ctx.strokeStyle = COLORS.midRim;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) ctx.lineTo(x, surface(x));
      ctx.stroke();
      ctx.fillStyle = COLORS.trees;
      ctx.beginPath();
      for (let i = 0; i < Math.round(w / 22); i++) {
        const x = random() * w;
        const size = h * (0.025 + random() * 0.03);
        const base = surface(x) + size * 0.25;
        ctx.moveTo(x - size * 0.35, base);
        ctx.lineTo(x, base - size * 1.6);
        ctx.lineTo(x + size * 0.35, base);
      }
      ctx.fill();
    });
  }

  private yAt(distanceM: number, cameraElevation: number, vScale: number) {
    return this.anchorY - (elevationAt(distanceM, this.course) - cameraElevation) * vScale;
  }

  draw(ctx: CanvasRenderingContext2D, frame: SceneFrame, dtSec: number) {
    const { width: w, height: h, unit: u, pxPerM, anchorX, anchorY, course } = this;
    if (w < 1 || h < 1) return;
    const dt = Math.min(Math.max(dtSec, 0), 0.1);
    const motion = !frame.reducedMotion;
    this.time += dt;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const riderD = frame.distanceM;
    const vScale = pxPerM * VERTICAL_EXAGGERATION;
    // The camera looks a little ahead, so a long climb or descent stays clear of the corners.
    const riderElevation = elevationAt(riderD, course);
    const aheadElevation = elevationAt(riderD + (w - anchorX) / pxPerM / 2, course);
    const cameraElevation = riderElevation + (aheadElevation - riderElevation) * 0.4;
    const riderY = anchorY - (riderElevation - cameraElevation) * vScale;
    const gradient = gradientAt(riderD, course);
    const heightShare = (riderElevation - course.minElevationM) / Math.max(1, course.maxElevationM - course.minElevationM);

    if (this.sky) ctx.drawImage(this.sky, 0, 0, w, h);
    const travelledPx = motion ? riderD * pxPerM : 0;
    this.drawTile(ctx, this.far, travelledPx * 0.06, h * 0.5 + heightShare * h * 0.1 - (this.farHeight - h * 0.07), this.farHeight);
    this.drawTile(ctx, this.mid, travelledPx * 0.22, h * 0.5 + heightShare * h * 0.16, this.midHeight);

    // Road surface and the ground under it.
    const ys = this.roadY;
    for (let i = 0; i < ys.length; i++) ys[i] = this.yAt(riderD + (i * ROAD_STEP_PX - ROAD_STEP_PX - anchorX) / pxPerM, cameraElevation, vScale);
    if (!this.groundFill) {
      this.groundFill = ctx.createLinearGradient(0, anchorY, 0, h);
      this.groundFill.addColorStop(0, COLORS.ground);
      this.groundFill.addColorStop(1, COLORS.groundDeep);
    }
    ctx.beginPath();
    for (let i = 0; i < ys.length; i++) ctx.lineTo(i * ROAD_STEP_PX - ROAD_STEP_PX, ys[i]);
    ctx.lineTo(w + ROAD_STEP_PX * 2, h);
    ctx.lineTo(-ROAD_STEP_PX, h);
    ctx.closePath();
    ctx.fillStyle = this.groundFill;
    ctx.fill();

    const viewStartD = riderD - anchorX / pxPerM - 4;
    const viewEndD = riderD + (w - anchorX) / pxPerM + 4;
    const toX = (d: number) => anchorX + (d - riderD) * pxPerM;

    // Reflector posts every 25 m: what makes speed legible.
    ctx.lineWidth = Math.max(1, u * 0.1);
    ctx.strokeStyle = COLORS.post;
    ctx.beginPath();
    for (let d = Math.ceil(viewStartD / 25) * 25; d <= viewEndD; d += 25) {
      const x = toX(d);
      const y = this.yAt(d, cameraElevation, vScale);
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - u * 0.95);
    }
    ctx.stroke();
    ctx.fillStyle = COLORS.reflector;
    for (let d = Math.ceil(viewStartD / 25) * 25; d <= viewEndD; d += 25) {
      const x = toX(d);
      ctx.fillRect(x - u * 0.06, this.yAt(d, cameraElevation, vScale) - u * 0.9, u * 0.12, u * 0.22);
    }

    // Road band with the cyan trace on top.
    const roadWidth = Math.max(3, u * 0.32);
    ctx.lineJoin = 'round';
    ctx.lineWidth = roadWidth;
    ctx.strokeStyle = COLORS.road;
    ctx.beginPath();
    for (let i = 0; i < ys.length; i++) ctx.lineTo(i * ROAD_STEP_PX - ROAD_STEP_PX, ys[i] + roadWidth / 2);
    ctx.stroke();
    ctx.lineWidth = Math.max(1.5, u * 0.09);
    ctx.strokeStyle = COLORS.roadEdge;
    ctx.beginPath();
    for (let i = 0; i < ys.length; i++) ctx.lineTo(i * ROAD_STEP_PX - ROAD_STEP_PX, ys[i]);
    ctx.stroke();

    // Grass tufts below the road, fixed to the course.
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.tuft;
    ctx.beginPath();
    for (let i = Math.ceil(viewStartD / 4); i * 4 <= viewEndD; i++) {
      const jitter = hash(i);
      const x = toX(i * 4 + jitter * 3);
      const y = this.yAt(i * 4, cameraElevation, vScale) + roadWidth + 3 + jitter * u * 1.4;
      ctx.moveTo(x - u * 0.14, y); ctx.lineTo(x - u * 0.2, y - u * 0.28);
      ctx.moveTo(x, y); ctx.lineTo(x + u * 0.02, y - u * 0.4);
      ctx.moveTo(x + u * 0.12, y); ctx.lineTo(x + u * 0.2, y - u * 0.25);
    }
    ctx.stroke();

    // Kilometre boards and course landmarks.
    ctx.font = `500 ${Math.round(Math.max(10, u * 0.55))}px ${this.font}`;
    ctx.textBaseline = 'middle';
    for (let d = Math.ceil((viewStartD - 30) / 1000) * 1000; d <= viewEndD + 30; d += 1000) {
      const lap = Math.round(lapDistance(d, course));
      this.drawSign(ctx, toX(d), this.yAt(d, cameraElevation, vScale), lap === 0 ? 'Lap' : `${lap / 1000} km`, lap === 0);
    }
    const lapStart = riderD - lapDistance(riderD, course);
    for (const [at, label] of LANDMARKS) {
      for (const d of [lapStart + at - course.lengthM, lapStart + at, lapStart + at + course.lengthM]) {
        if (d < viewStartD - 60 || d > viewEndD + 10) continue;
        this.drawSign(ctx, toX(d), this.yAt(d, cameraElevation, vScale), label, false);
      }
    }

    this.drawRider(ctx, frame, riderY, gradient, dt, motion);
    if (motion) this.drawEffects(ctx, frame, riderY, gradient, dt);
  }

  private drawTile(ctx: CanvasRenderingContext2D, tile: HTMLCanvasElement | null, offsetPx: number, y: number, height: number) {
    if (!tile) return;
    const w = this.width;
    const x = Math.round(-(offsetPx % w) * this.dpr) / this.dpr;
    const top = Math.round(y * this.dpr) / this.dpr;
    ctx.drawImage(tile, x, top, w, height);
    ctx.drawImage(tile, x + w, top, w, height);
  }

  private drawSign(ctx: CanvasRenderingContext2D, x: number, roadY: number, label: string, banner: boolean) {
    const u = this.unit;
    const postHeight = u * (banner ? 4.6 : 2.6);
    ctx.strokeStyle = COLORS.post;
    ctx.lineWidth = Math.max(1.5, u * 0.12);
    ctx.beginPath();
    ctx.moveTo(x, roadY);
    ctx.lineTo(x, roadY - postHeight);
    ctx.stroke();
    const textWidth = ctx.measureText(label).width;
    const plateW = textWidth + u * 0.9;
    const plateH = u * 1.05;
    const plateX = x - u * 0.2;
    const plateY = roadY - postHeight - plateH * 0.5;
    ctx.fillStyle = COLORS.plate;
    ctx.strokeStyle = banner ? COLORS.roadEdge : COLORS.plateBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(plateX, plateY, plateW, plateH);
    ctx.fill();
    ctx.stroke();
    if (banner) {
      // Chequered strip under the lap banner.
      const size = u * 0.25;
      for (let i = 0; i * size < plateW; i++) {
        for (let row = 0; row < 2; row++) {
          ctx.fillStyle = (i + row) % 2 ? COLORS.limb : COLORS.ink;
          ctx.fillRect(plateX + i * size, plateY + plateH + row * size, Math.min(size, plateW - i * size), size);
        }
      }
    }
    ctx.fillStyle = banner ? COLORS.limb : COLORS.plateText;
    ctx.fillText(label, plateX + u * 0.45, plateY + plateH / 2 + 0.5);
  }

  private drawRider(ctx: CanvasRenderingContext2D, frame: SceneFrame, riderY: number, gradient: number, dt: number, motion: boolean) {
    const u = this.unit;
    const { speedMps, powerWatts, targetWatts } = frame;
    const stopped = speedMps < 0.3;
    const coasting = powerWatts < 10;
    const tucked = coasting && !stopped && gradient < -0.02 && speedMps > 9;
    const climbing = gradient > 0.03 && powerWatts > 80;
    const effort = targetWatts && targetWatts > 0 ? powerWatts / targetWatts : powerWatts / 230;
    const waving = coasting && !tucked;

    if (motion) {
      this.crank = (this.crank + (frame.cadenceRpm / 60) * Math.PI * 2 * dt) % (Math.PI * 2);
      this.wheel = (this.wheel + Math.min(14, speedMps / WHEEL_RADIUS_M) * dt) % (Math.PI * 2);
    }
    const targetLean = stopped ? 1.25 : tucked ? 0.3 : waving ? 1.1 : climbing ? 0.5 : 0.66;
    this.lean += (targetLean - this.lean) * Math.min(1, dt * 4 || 1);

    const climbShare = climbing ? Math.min(1, gradient / 0.06) : 0;
    const bobAmplitude = (0.04 + 0.12 * climbShare + (effort > 1.1 ? 0.04 : 0)) * (frame.cadenceRpm > 0 && motion ? 1 : 0);
    const bob = -Math.abs(Math.sin(this.crank)) * bobAmplitude;
    const rock = climbShare * 0.08 * Math.sin(this.crank * 2);
    const angle = -Math.atan(gradient * VERTICAL_EXAGGERATION);

    ctx.save();
    ctx.translate(this.anchorX, riderY);
    ctx.rotate(angle);
    ctx.scale(u, u);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Wheels.
    for (const hubX of [-1.45, 1.45]) {
      ctx.strokeStyle = COLORS.wheel;
      ctx.lineWidth = 0.13;
      ctx.beginPath();
      ctx.arc(hubX, -1, 0.94, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = COLORS.spoke;
      ctx.lineWidth = 0.06;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = this.wheel + (k * Math.PI) / 3;
        ctx.moveTo(hubX - Math.cos(a) * 0.88, -1 - Math.sin(a) * 0.88);
        ctx.lineTo(hubX + Math.cos(a) * 0.88, -1 + Math.sin(a) * 0.88);
      }
      ctx.stroke();
    }

    const bbX = -0.15;
    const bbY = -0.82;
    const crankLength = 0.42;
    const hipX = -0.6;
    const hipY = -2.6 + bob;
    const leg = 1.18;

    // Far leg and crank.
    const farX = bbX + Math.cos(this.crank + Math.PI) * crankLength;
    const farY = bbY + Math.sin(this.crank + Math.PI) * crankLength;
    this.limb(ctx, COLORS.limbFar, hipX, hipY, farX, farY, leg, leg, true, 0.15);

    // Frame, saddle and bars.
    ctx.strokeStyle = COLORS.frame;
    ctx.lineWidth = 0.13;
    ctx.beginPath();
    ctx.moveTo(-1.45, -1); ctx.lineTo(bbX, bbY); ctx.lineTo(-0.55, -2.3); ctx.lineTo(-1.45, -1);
    ctx.moveTo(-0.55, -2.3); ctx.lineTo(1.0, -2.15); ctx.lineTo(bbX, bbY);
    ctx.moveTo(1.0, -2.15); ctx.lineTo(1.45, -1);
    ctx.moveTo(1.0, -2.15); ctx.lineTo(1.08, -2.45); ctx.quadraticCurveTo(1.5, -2.5, 1.38, -2.15);
    ctx.stroke();
    ctx.strokeStyle = COLORS.wheel;
    ctx.lineWidth = 0.16;
    ctx.beginPath();
    ctx.moveTo(-0.85, -2.45); ctx.lineTo(-0.35, -2.45);
    ctx.moveTo(-0.55, -2.45); ctx.lineTo(-0.55, -2.3);
    ctx.stroke();
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    ctx.arc(bbX, bbY, 0.28, 0, Math.PI * 2);
    ctx.moveTo(bbX, bbY); ctx.lineTo(farX, farY);
    ctx.stroke();

    // Torso, head and far arm.
    const lean = this.lean + rock;
    const shoulderX = hipX + Math.cos(lean) * 1.75;
    const shoulderY = hipY - Math.sin(lean) * 1.75;
    const handX = 1.3;
    const handY = -2.38;
    if (!waving) this.limb(ctx, COLORS.limbFar, shoulderX, shoulderY, handX - 0.08, handY + 0.04, 1.0, 1.0, false, 0.13);
    ctx.strokeStyle = frame.accent;
    ctx.lineWidth = 0.26;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(shoulderX, shoulderY);
    ctx.stroke();

    const headX = shoulderX + Math.cos(lean) * 0.42 + 0.22;
    const headY = shoulderY - Math.sin(lean) * 0.42 - 0.45;
    this.drawHead(ctx, headX, headY, effort, climbing, coasting, stopped);

    // Near crank, leg and arm.
    const nearX = bbX + Math.cos(this.crank) * crankLength;
    const nearY = bbY + Math.sin(this.crank) * crankLength;
    ctx.strokeStyle = COLORS.wheel;
    ctx.lineWidth = 0.09;
    ctx.beginPath();
    ctx.moveTo(bbX, bbY);
    ctx.lineTo(nearX, nearY);
    ctx.stroke();
    this.limb(ctx, COLORS.limb, hipX, hipY, nearX, nearY, leg, leg, true, 0.16);
    if (waving) {
      const wave = motion ? Math.sin(this.time * 7) * 0.35 : 0;
      this.limb(ctx, COLORS.limb, shoulderX, shoulderY, shoulderX + 0.35 + Math.sin(wave) * 1.2, shoulderY - 1.4 + Math.abs(wave) * 0.2, 0.95, 0.95, false, 0.15);
      this.limb(ctx, COLORS.limbFar, shoulderX, shoulderY, handX - 0.2, handY - 0.1, 1.1, 1.1, false, 0.13);
    } else {
      this.limb(ctx, COLORS.limb, shoulderX, shoulderY, handX, handY, 1.0, 1.0, false, 0.15);
    }
    ctx.restore();

    if (motion) {
      // Head position in screen space, for sweat drops.
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const sx = this.anchorX + u * (headX * cos - headY * sin);
      const sy = riderY + u * (headX * sin + headY * cos);
      const sweating = effort > 1.1 || (gradient > 0.045 && powerWatts > 120);
      this.nextDropSec -= dt;
      if (sweating && this.nextDropSec <= 0) {
        this.emitDrop(sx - u * 0.2, sy - u * 0.2);
        this.nextDropSec = effort > 1.25 ? 0.25 : 0.45;
      }
    }
  }

  private limb(ctx: CanvasRenderingContext2D, color: string, rx: number, ry: number, ex: number, ey: number, upper: number, lower: number, knee: boolean, width: number) {
    const mid = knee ? this.knee : this.elbow;
    joint(mid, rx, ry, ex, ey, upper, lower, knee);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(mid.x, mid.y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }

  private drawHead(ctx: CanvasRenderingContext2D, x: number, y: number, effort: number, climbing: boolean, coasting: boolean, stopped: boolean) {
    const r = 0.5;
    ctx.fillStyle = COLORS.head;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // Helmet with a little visor and vents.
    ctx.fillStyle = COLORS.helmet;
    ctx.beginPath();
    ctx.arc(x - 0.02, y - 0.04, r * 1.1, Math.PI * 1.02, Math.PI * 1.98);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COLORS.helmet;
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    ctx.moveTo(x + r * 1.0, y - 0.08);
    ctx.lineTo(x + r * 1.35, y - 0.02);
    ctx.stroke();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.moveTo(x - 0.18, y - r * 0.95); ctx.lineTo(x - 0.1, y - r * 0.55);
    ctx.moveTo(x + 0.08, y - r * 0.98); ctx.lineTo(x + 0.1, y - r * 0.58);
    ctx.stroke();

    const hard = effort > 1.05 || climbing;
    ctx.fillStyle = COLORS.ink;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 0.06;
    if (hard) {
      // Squinting eye and a gasping mouth.
      ctx.beginPath();
      ctx.moveTo(x + 0.1, y + 0.02); ctx.lineTo(x + 0.3, y + 0.0);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x + 0.3, y + 0.24, 0.07, 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(x + 0.22, y + 0.0, 0.065, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      const grin = coasting || stopped ? 0.16 : 0.11;
      ctx.arc(x + 0.24, y + 0.12, grin, Math.PI * 0.15, Math.PI * 0.75);
      ctx.stroke();
    }
  }

  private emitDrop(x: number, y: number) {
    const { drops } = this;
    for (let i = 0; i < MAX_DROPS; i++) {
      if (drops.life[i] > 0) continue;
      drops.x[i] = x;
      drops.y[i] = y;
      drops.vx[i] = -this.unit * (1.5 + Math.random() * 2);
      drops.vy[i] = -this.unit * (2 + Math.random() * 2);
      drops.life[i] = 0.8;
      return;
    }
  }

  private drawEffects(ctx: CanvasRenderingContext2D, frame: SceneFrame, riderY: number, gradient: number, dt: number) {
    const u = this.unit;
    const { drops } = this;
    ctx.fillStyle = COLORS.sweat;
    for (let i = 0; i < MAX_DROPS; i++) {
      if (drops.life[i] <= 0) continue;
      drops.life[i] -= dt;
      drops.vy[i] += u * 14 * dt;
      drops.x[i] += drops.vx[i] * dt;
      drops.y[i] += drops.vy[i] * dt;
      ctx.globalAlpha = Math.max(0, Math.min(1, drops.life[i] * 2));
      const r = u * 0.11;
      ctx.beginPath();
      ctx.moveTo(drops.x[i], drops.y[i] - r * 2.2);
      ctx.arc(drops.x[i], drops.y[i], r, -Math.PI * 0.85, Math.PI * -0.15, true);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Speed lines on a fast descent.
    if (frame.speedMps > 11 && gradient < -0.015) {
      const length = u * (1.5 + (frame.speedMps - 11) * 0.5);
      const angle = -Math.atan(gradient * VERTICAL_EXAGGERATION);
      ctx.save();
      ctx.translate(this.anchorX, riderY);
      ctx.rotate(angle);
      ctx.strokeStyle = COLORS.whoosh;
      ctx.lineWidth = Math.max(1, u * 0.08);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const flicker = 0.5 + 0.5 * Math.sin(this.time * 18 + k * 2.1);
        const start = -u * (2.8 + k * 0.6);
        ctx.moveTo(start, -u * (1.2 + k * 1.05));
        ctx.lineTo(start - length * (0.6 + 0.4 * flicker), -u * (1.2 + k * 1.05));
      }
      ctx.stroke();
      ctx.restore();
    }
  }
}

/** Signs at fixed lap distances (metres). */
const LANDMARKS: ReadonlyArray<readonly [number, string]> = [
  [4380, 'Climb – 1.7 km'],
  [6200, 'Summit'],
];
