/**
 * Built-in workout catalog. Ships with the code (not the database) so every
 * deployment has the same library. Bike targets are % of FTP. Run and swim steps use the
 * same 50–125 effort scale, shown and copied as a zone without a power target. Blocks
 * expand to the canonical session-editor shape when a workout is ridden, copied or scheduled.
 */

export type CatalogCategory =
  | 'recovery'
  | 'endurance'
  | 'tempo'
  | 'sweet-spot'
  | 'threshold'
  | 'over-under'
  | 'vo2max'
  | 'anaerobic'
  | 'sprint'
  | 'climbing'
  | 'cadence-skills'
  | 'mixed'
  | 'test';

export type CatalogLevel = 'beginner' | 'intermediate' | 'advanced';

/** Sports the public library offers, in display order; the first is the default. */
export type CatalogSport = 'BIKING' | 'RUNNING' | 'SWIMMING';

export type CatalogStepKind = 'warmup' | 'work' | 'recovery' | 'cooldown' | 'pause';

/** One steady (lowPct === highPct) or ranged/ramped step. Ramps: warmup rises low→high, cooldown falls high→low. */
export type CatalogStep = {
  kind: CatalogStepKind;
  durationSec: number;
  /** % of FTP, integers 30–200 (sprints may go to 300). */
  lowPct: number;
  highPct: number;
  /** Optional cadence cue in rpm, e.g. [95, 105]. */
  cadence?: [number, number];
  /** Swim distance in meters; `durationSec` is then an estimate. */
  distanceM?: number;
  /** Short rider-facing cue shown during the step. */
  cue?: string;
};

/** A repeated set: `steps` are repeated `times` times in order (e.g. 5 × [work, recovery]). */
export type CatalogRepeat = { repeat: number; steps: CatalogStep[] };

export type CatalogItem = CatalogStep | CatalogRepeat;

export type CatalogWorkout = {
  /** Stable kebab-case id, unique, never renamed once shipped (used in URLs). */
  slug: string;
  name: string;
  sport: CatalogSport;
  category: CatalogCategory;
  level: CatalogLevel;
  /** One sentence for cards. */
  summary: string;
  /** Purpose, physiology and how to ride it; 2–5 short paragraphs, plain text separated by blank lines. */
  description: string;
  /** Free-form tags for search/filter, e.g. ['indoor', 'short', 'race-prep']. */
  tags: string[];
  items: CatalogItem[];
};
