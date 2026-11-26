/**
 * Rebuild the dependency-free public SVG with Node:
 *   node scripts/generate-wattonaut-sports.mjs
 * Optional PNG frames/contact sheet (requires Sharp, no browser):
 *   node scripts/generate-wattonaut-sports.mjs --preview-dir <directory>
 * WATTONAUT_SHARP_MODULE can point to an existing bundled Sharp installation.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const loadModule = createRequire(import.meta.url);
const TAU = Math.PI * 2;
const LOOP = 12;
const WHEEL_RADIUS = 35;
const WHEEL_PERIOD = .8;
const GAIT_PERIOD = .8;
const STANCE = .34;
const STRIDE = 53;
const TILE = 96;
const BIKE_ROAD_PERIOD = TILE / (TAU * WHEEL_RADIUS / WHEEL_PERIOD);
const RUN_ROAD_PERIOD = TILE / (STRIDE / (STANCE * GAIT_PERIOD));
const round = value => Number(value.toFixed(3));
const fraction = value => ((value % 1) + 1) % 1;
const line = points => points.map((p, i) => `${i ? 'L' : 'M'}${p.map(round).join(' ')}`).join(' ');
const circle = (x, y, r, cls) => `<circle cx="${x}" cy="${y}" r="${r}" class="${cls}"/>`;

// The forward-knee solution keeps limbs attached and their segment lengths fixed.
function knee(hip, foot, thigh, shin) {
  const dx = foot[0] - hip[0], dy = foot[1] - hip[1], distance = Math.hypot(dx, dy);
  if (distance > thigh + shin || distance < Math.abs(thigh - shin)) {
    throw new Error(`Unreachable foot position: ${distance}`);
  }
  const along = (thigh * thigh - shin * shin + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, thigh * thigh - along * along));
  return [hip[0] + along * dx / distance + height * dy / distance,
    hip[1] + along * dy / distance - height * dx / distance];
}

const crawl = [
  [[250, 83], [278, 96]], [[256, 110], [287, 118]],
  [[247, 132], [257, 157]], [[221, 142], [212, 167]],
  [[192, 135], [166, 145]], [[192, 106], [160, 111]],
  [[195, 79], [168, 77]], [[224, 69], [243, 76]],
];
function swimmingArm(t) {
  const position = fraction(t) * crawl.length, index = Math.floor(position), f = position - index;
  const start = crawl[index], end = crawl[(index + 1) % crawl.length];
  return line([[224, 110], ...start.map((point, j) => point.map((value, k) => value + (end[j][k] - value) * f))]);
}

function bezier(a, b, c, d, t) {
  const u = 1 - t;
  return a.map((value, i) => u ** 3 * value + 3 * u * u * t * b[i] + 3 * u * t * t * c[i] + t ** 3 * d[i]);
}
function runningFoot(t) {
  const phase = fraction(t);
  if (phase < STANCE) return [222 - STRIDE * phase / STANCE, 191];
  // Push fully behind the hip, recover the heel behind the body, then carry
  // the foot forward low. A tall symmetric ellipse reads as high-knee marching.
  if (phase < .5) return bezier([169, 191], [157, 191], [144, 184], [139, 172], (phase - STANCE) / (.5 - STANCE));
  if (phase < .68) return bezier([139, 172], [130, 154], [141, 149], [158, 155], (phase - .5) / .18);
  if (phase < .85) return bezier([158, 155], [175, 154], [194, 161], [208, 171], (phase - .68) / .17);
  return bezier([208, 171], [225, 179], [230, 191], [222, 191], (phase - .85) / .15);
}
function runningToe(t, ankle) {
  const phase = fraction(t);
  const lift = phase < STANCE ? 0 : Math.sin(Math.PI * (phase - STANCE) / (1 - STANCE));
  const pitch = Math.atan2(4, 9) + .65 * lift;
  return [ankle[0] + Math.sqrt(97) * Math.cos(pitch), ankle[1] + Math.sqrt(97) * Math.sin(pitch)];
}
function runningArm(t, shoulder) {
  const swing = -.85 * Math.cos(t * TAU);
  const elbow = [shoulder[0] + 32 * Math.sin(swing), shoulder[1] + 32 * Math.cos(swing)];
  const forearm = .45 - .9 * swing;
  const hand = [elbow[0] + 24 * Math.cos(forearm), elbow[1] + 24 * Math.sin(forearm)];
  return line([shoulder, elbow, hand]);
}
function spokes(cx, cy, t) {
  const points = [0, TAU / 3, TAU * 2 / 3].map(a => {
    const angle = a + t * TAU;
    return line([[cx, cy], [cx + 30 * Math.cos(angle), cy + 30 * Math.sin(angle)]]);
  });
  return points.join(' ');
}
function rim(cx, cy, t) {
  const a = t * TAU, b = a + .35;
  return `M${round(cx + 35 * Math.cos(a))} ${round(cy + 35 * Math.sin(a))}A35 35 0 0 1 ${round(cx + 35 * Math.cos(b))} ${round(cy + 35 * Math.sin(b))}`;
}
function pose(t) {
  const angle = t * TAU;
  const bikeHip = [169, 103], crank = [190, 161];
  const pedal = [190 + 14 * Math.cos(angle), 161 + 14 * Math.sin(angle)];
  const farPedal = [190 - 14 * Math.cos(angle), 161 - 14 * Math.sin(angle)];
  const bob = -2 * Math.cos(2 * angle - .9 * TAU);
  const hip = [196, 118 + bob], shoulder = [212, 76 + bob];
  const foot = runningFoot(t), farFoot = runningFoot(t + .5);
  const toe = runningToe(t, foot), farToe = runningToe(t + .5, farFoot);
  return {
    'swim-near': swimmingArm(t), 'swim-far': swimmingArm(t + .5),
    'kick-near': line([[166, 122], [133, 124 + Math.sin(angle) * 4], [102, 127 + Math.sin(angle) * 7]]),
    'kick-far': line([[166, 122], [135, 126 - Math.sin(angle) * 4], [105, 130 - Math.sin(angle) * 7]]),
    'bike-leg-near': line([bikeHip, knee(bikeHip, pedal, 39, 40), pedal, [pedal[0] + 7, pedal[1] + 1]]),
    'bike-leg-far': line([bikeHip, knee(bikeHip, farPedal, 39, 40), farPedal, [farPedal[0] + 7, farPedal[1] + 1]]),
    crank: line([pedal, crank, farPedal]),
    'wheel-left': spokes(140, 161, t), 'wheel-right': spokes(256, 161, t),
    'rim-left': rim(140, 161, t), 'rim-right': rim(256, 161, t),
    'run-leg-near': line([hip, knee(hip, foot, 40, 43), foot, toe]),
    'run-leg-far': line([hip, knee(hip, farFoot, 40, 43), farFoot, farToe]),
    'run-arm-near': runningArm(t, shoulder), 'run-arm-far': runningArm(t + .5, shoulder),
    'run-shoe': line([foot, toe]),
    'run-body': `M196 ${round(118 + bob)}Q204 ${round(95 + bob)} 212 ${round(76 + bob)}L218 ${round(67 + bob)}`,
    'run-head': `M234 ${round(52 + bob)}A10 10 0 1 1 214 ${round(52 + bob)}A10 10 0 1 1 234 ${round(52 + bob)}`,
  };
}
const dynamic = (id, p, cls) => `<path class="${cls} ${id}" d="${p[id]}"/>`;
const defs = `<defs>
  <linearGradient id="wattonaut-flow-fade"><stop stop-color="black"/><stop offset=".14" stop-color="white"/><stop offset=".86" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient>
  <mask id="wattonaut-flow-mask" maskUnits="userSpaceOnUse" x="65" y="0" width="270" height="220"><rect x="65" width="270" height="220" fill="url(#wattonaut-flow-fade)"/></mask>
</defs>`;
function water(time = 0, animated = false) {
  const paths = Array.from({ length: 7 }, (_, i) => {
    const x = i * TILE - TILE;
    return `<path class="water" d="M${x} 144q12-5 24 0t24 0"/><path class="water quiet" d="M${x + 36} 164q10-4 20 0t20 0"/>`;
  }).join('');
  const shift = -TILE * fraction(time / 1.5);
  return `<g mask="url(#wattonaut-flow-mask)"><g ${animated ? 'class="water-flow"' : `transform="translate(${round(shift)} 0)"`}>${paths}</g></g>`;
}
function road(time = 0, kind = 'bike', animated = false) {
  const period = kind === 'bike' ? BIKE_ROAD_PERIOD : RUN_ROAD_PERIOD;
  const paths = Array.from({ length: 7 }, (_, i) => {
    const x = i * TILE - TILE;
    return `<path class="ground" d="M${x} 198h36m24 0h8"/><path class="ground quiet" d="M${x + 34} 208h12"/>`;
  }).join('');
  const shift = -TILE * fraction(time / period);
  return `<g mask="url(#wattonaut-flow-mask)"><g ${animated ? `class="${kind}-road"` : `transform="translate(${round(shift)} 0)"`}>${paths}</g></g>`;
}
function swimmer(p, time = 0, animated = false) {
  return `${dynamic('swim-far', p, 'limb rear')}${dynamic('kick-far', p, 'limb rear')}${dynamic('kick-near', p, 'limb')}
    <path class="limb" d="M166 122Q194 112 224 110L236 106"/>${circle(247, 101, 10, 'head')}
    <path class="detail" d="M251 100h7"/>${dynamic('swim-near', p, 'limb')}${water(time, animated)}`;
}
function cyclist(p, time = 0, animated = false) {
  return `${circle(140, 161, 35, 'wheel')}${circle(256, 161, 35, 'wheel')}
    ${dynamic('wheel-left', p, 'spoke')}${dynamic('wheel-right', p, 'spoke')}
    ${dynamic('rim-left', p, 'rim')}${dynamic('rim-right', p, 'rim')}
    ${dynamic('bike-leg-far', p, 'limb rear')}
    <path class="frame" d="M140 161L169 115 190 161Z M169 115H237L190 161 M237 115L256 161 M169 115L166 103 M237 115L234 103"/>
    <path class="hardware" d="M157 101h20 M230 101h16q9 0 6 8l-3 4"/>
    ${dynamic('crank', p, 'hardware')}${circle(190, 161, 3, 'hub')}
    <path class="limb" d="M169 103Q180 84 205 78L215 72 M205 79L219 104 241 104"/>
    ${circle(226, 59, 10, 'head')}<path class="helmet" d="M217 52q9-9 18 2"/>
    ${dynamic('bike-leg-near', p, 'limb')}${road(time, 'bike', animated)}`;
}
function runner(p, time = 0, animated = false) {
  return `${dynamic('run-arm-far', p, 'limb rear')}${dynamic('run-leg-far', p, 'limb rear')}
    ${dynamic('run-body', p, 'limb')}${dynamic('run-head', p, 'head')}
    ${dynamic('run-leg-near', p, 'limb')}${dynamic('run-shoe', p, 'shoe')}${dynamic('run-arm-near', p, 'limb')}
    ${road(time, 'run', animated)}`;
}
const baseStyle = `
  .limb,.head,.wheel,.frame,.hardware,.water,.detail,.helmet,.spoke,.ground,.rim,.shoe{fill:none;stroke-linecap:round;stroke-linejoin:round}
  .limb{stroke:#102f51;stroke-width:4.7}.head{stroke:#102f51;stroke-width:4.2}
  .rear{stroke:#71879a;stroke-width:4;opacity:.65}
  .wheel{stroke:#102f51;stroke-width:3}.frame{stroke:#658a7a;stroke-width:3}
  .hardware{stroke:#102f51;stroke-width:2.7}.hub{fill:#102f51}
  .spoke{stroke:#71879a;stroke-width:1.15;opacity:.38}.rim{stroke:#658a7a;stroke-width:3.1}
  .water{stroke:#71879a;stroke-width:2.2}.quiet{opacity:.45}
  .detail{stroke:#71879a;stroke-width:2}.helmet{stroke:#658a7a;stroke-width:2.6}
  .ground{stroke:#71879a;stroke-width:1.5;opacity:.48}.shoe{stroke:#658a7a;stroke-width:4.7}
`;
const timelines = {
  swimmer: [[0, 1], [3.5, 1], [3.8, 0], [11.8, 0], [12, 1]],
  cyclist: [[0, 0], [3.8, 0], [4.1, 1], [7.5, 1], [7.8, 0], [12, 0]],
  runner: [[0, 0], [7.8, 0], [8.1, 1], [11.5, 1], [11.8, 0], [12, 0]],
};
function opacity(scene, time) {
  const points = timelines[scene];
  for (let i = 1; i < points.length; i++) {
    if (time <= points[i][0]) {
      const a = points[i - 1], b = points[i];
      return a[1] + (b[1] - a[1]) * (time - a[0]) / (b[0] - a[0]);
    }
  }
  return points.at(-1)[1];
}
function duration(id) {
  if (id.startsWith('swim') || id.startsWith('kick')) return 1.5;
  if (id.startsWith('wheel') || id.startsWith('rim')) return WHEEL_PERIOD;
  if (id.startsWith('run')) return GAIT_PERIOD;
  return 1;
}
let animationStyle = '';
for (const [scene, points] of Object.entries(timelines)) {
  animationStyle += `.${scene}{opacity:${points[0][1]};animation:${scene}-scene ${LOOP}s linear infinite}\n`;
  animationStyle += `@keyframes ${scene}-scene{${points.map(([time, value]) => `${round(time / LOOP * 100)}%{opacity:${value}}`).join('')}}\n`;
}
animationStyle += `.water-flow{animation:flow-left 1.5s linear infinite}.bike-road{animation:flow-left ${BIKE_ROAD_PERIOD}s linear infinite}.run-road{animation:flow-left ${RUN_ROAD_PERIOD}s linear infinite}@keyframes flow-left{to{transform:translateX(-${TILE}px)}}\n`;
// One gait cycle sampled into compatible SVG path commands; all limbs stay joined.
for (const id of Object.keys(pose(0))) {
  animationStyle += `.${id}{animation:${id}-motion ${duration(id)}s linear infinite}\n@keyframes ${id}-motion{`;
  for (let i = 0; i <= 48; i++) animationStyle += `${round(i / 48 * 100)}%{d:path('${pose(i / 48)[id]}')}`;
  animationStyle += '}\n';
}
animationStyle += '@media(prefers-reduced-motion:reduce){*{animation:none!important}.swimmer{opacity:1}.cyclist,.runner{display:none}}';
const initial = pose(.125);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 220" role="img" aria-labelledby="wattonaut-title wattonaut-desc">
<title id="wattonaut-title">Wattonaut – triatlon</title>
<desc id="wattonaut-desc">En svømmer, en syklist og en løper avløser hverandre i en tolv sekunders loop. Vannet og bakken glir bakover, og sykkelhjulene roterer. Transparent bakgrunn. Ved redusert bevegelse vises en stillestående svømmer.</desc>
${defs}<style>${baseStyle}${animationStyle}</style>
<g class="swimmer">${swimmer(initial, 0, true)}</g>
<g class="cyclist">${cyclist(initial, 0, true)}</g>
<g class="runner">${runner(initial, 0, true)}</g>
</svg>\n`;
fs.writeFileSync(path.resolve(import.meta.dirname, '../public/wattonaut-sports-loop.svg'), svg);
console.log(`Wrote triathlon SVG (${Buffer.byteLength(svg)} bytes).`);

async function renderPreview(output) {
  const sharp = loadModule(process.env.WATTONAUT_SHARP_MODULE || 'sharp');
  const framesDir = path.join(output, 'triathlon-frames');
  fs.mkdirSync(framesDir, { recursive: true });
  const sampleIndexes = [0, 7, 14, 21, 105, 110, 115, 120, 210, 215, 220, 225];
  const samples = [];
  for (let i = 0; i < LOOP * 25; i++) {
    const time = i / 25;
    const p = {};
    for (const id of Object.keys(initial)) p[id] = pose(time / duration(id))[id];
    const frame = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 220">${defs}<style>${baseStyle}</style><rect width="400" height="220" fill="#f5f4ef"/>
      <g opacity="${opacity('swimmer', time)}">${swimmer(p, time)}</g>
      <g opacity="${opacity('cyclist', time)}">${cyclist(p, time)}</g>
      <g opacity="${opacity('runner', time)}">${runner(p, time)}</g></svg>`;
    const image = await sharp(Buffer.from(frame)).resize(600, 330).png().toBuffer();
    fs.writeFileSync(path.join(framesDir, String(i).padStart(3, '0') + '.png'), image);
    if (sampleIndexes.includes(i)) samples.push(image);
  }
  await sharp({ create: { width: 2400, height: 990, channels: 3, background: '#f5f4ef' } })
    .composite(samples.map((input, i) => ({ input, left: i % 4 * 600, top: Math.floor(i / 4) * 330 })))
    .png().toFile(path.join(output, 'wattonaut-triathlon-contact-sheet.png'));
  console.log(`Rendered ${LOOP * 25} frames and a 12-pose contact sheet.`);
}
const previewIndex = process.argv.indexOf('--preview-dir');
if (previewIndex !== -1) {
  const output = process.argv[previewIndex + 1];
  if (!output) throw new Error('--preview-dir requires a directory.');
  renderPreview(path.resolve(output)).catch(error => { console.error(error); process.exitCode = 1; });
}
