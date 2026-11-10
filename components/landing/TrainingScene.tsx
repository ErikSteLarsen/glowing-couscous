import './training-scene.css';

/**
 * Decorative landing background: four training lanes with stick figures that
 * run, ride, lift, and swim. Pure SVG and CSS; hidden from assistive tech.
 */
export function TrainingScene() {
  return (
    <div className="ts-scene" aria-hidden="true">
      <div className="ts-lane">
        <span className="ts-label">Run</span>
        <div className="ts-mover ts-mover--run">
          <Runner />
        </div>
      </div>
      <div className="ts-lane">
        <span className="ts-label">Bike</span>
        <div className="ts-mover ts-mover--bike">
          <Cyclist />
        </div>
      </div>
      <div className="ts-lane">
        <span className="ts-label">Strength</span>
        <div className="ts-mover ts-mover--lift">
          <Lifter />
        </div>
      </div>
      <div className="ts-lane ts-lane--water">
        <span className="ts-label">Swim</span>
        <div className="ts-mover ts-mover--swim">
          <Swimmer />
        </div>
      </div>
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

function Runner() {
  return (
    <svg className="ts-figure ts-figure--run" viewBox="-36 -58 72 104">
      <g className="ts-run-bob">
        <RunArm />
        <RunLeg />
        <circle cx="8" cy="-46" r="7" />
        <path d="M0 0L6 -36" />
        <RunLeg lead />
        <RunArm lead />
      </g>
    </svg>
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
    <svg className="ts-figure ts-figure--bike" viewBox="-42 -66 84 84">
      <PedalLeg />
      <Wheel x={-24} />
      <Wheel x={24} />
      <path d="M-24 0L-8 -26L16 -24L0 0ZM-24 0H0M16 -24L24 0M16 -24L20 -31" strokeWidth="2" />
      <path className="ts-spin" d="M-7 0H7" />
      <path d="M-8 -28L10 -48L20 -31" />
      <circle cx="16" cy="-56" r="6.5" />
      <PedalLeg lead />
    </svg>
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
    <svg className="ts-figure ts-figure--lift" viewBox="-40 -94 80 96">
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
    </svg>
  );
}

function Swimmer() {
  return (
    <svg className="ts-figure ts-figure--swim" viewBox="-46 -26 92 52">
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
    </svg>
  );
}
