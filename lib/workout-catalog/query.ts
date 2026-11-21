import { catalogWorkoutMetrics, type CatalogMetrics } from './metrics.ts';
import type { CatalogCategory, CatalogLevel, CatalogWorkout } from './types.ts';

export const CATALOG_CATEGORIES: readonly { id: CatalogCategory; label: string }[] = [
  { id: 'recovery', label: 'Recovery' },
  { id: 'endurance', label: 'Endurance' },
  { id: 'tempo', label: 'Tempo' },
  { id: 'sweet-spot', label: 'Sweet spot' },
  { id: 'threshold', label: 'Threshold' },
  { id: 'over-under', label: 'Over-unders' },
  { id: 'vo2max', label: 'VO2 max' },
  { id: 'anaerobic', label: 'Anaerobic' },
  { id: 'sprint', label: 'Sprint' },
  { id: 'climbing', label: 'Climbing' },
  { id: 'cadence-skills', label: 'Cadence skills' },
  { id: 'mixed', label: 'Mixed' },
  { id: 'test', label: 'Tests' },
];

export const CATALOG_LEVELS: readonly { id: CatalogLevel; label: string }[] = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];

export type DurationBucket = 'under-45' | '45-75' | '75-120' | 'over-120';

export const DURATION_BUCKETS: readonly { id: DurationBucket; label: string }[] = [
  { id: 'under-45', label: 'Under 45 min' },
  { id: '45-75', label: '45–75 min' },
  { id: '75-120', label: '75–120 min' },
  { id: 'over-120', label: 'Over 2 h' },
];

export type CatalogSort = 'name' | 'duration-asc' | 'duration-desc' | 'tss-asc' | 'tss-desc';

export const CATALOG_SORTS: readonly { id: CatalogSort; label: string }[] = [
  { id: 'name', label: 'Name' },
  { id: 'duration-asc', label: 'Shortest first' },
  { id: 'duration-desc', label: 'Longest first' },
  { id: 'tss-asc', label: 'Lowest TSS' },
  { id: 'tss-desc', label: 'Highest TSS' },
];

export type CatalogQuery = {
  q: string;
  categories: CatalogCategory[];
  levels: CatalogLevel[];
  durations: DurationBucket[];
  tags: string[];
  tssMin: number | null;
  tssMax: number | null;
  ifMin: number | null;
  ifMax: number | null;
  sort: CatalogSort;
};

export type CatalogEntry = { workout: CatalogWorkout; metrics: CatalogMetrics; bucket: DurationBucket };

export const EMPTY_CATALOG_QUERY: CatalogQuery = {
  q: '', categories: [], levels: [], durations: [], tags: [], tssMin: null, tssMax: null, ifMin: null, ifMax: null, sort: 'name',
};

const categoryIds = new Set(CATALOG_CATEGORIES.map((category) => category.id));
const levelIds = new Set(CATALOG_LEVELS.map((level) => level.id));
const bucketIds = new Set(DURATION_BUCKETS.map((bucket) => bucket.id));
const sortIds = new Set(CATALOG_SORTS.map((sort) => sort.id));

export function isCatalogCategory(value: unknown): value is CatalogCategory {
  return typeof value === 'string' && categoryIds.has(value as CatalogCategory);
}

export function isCatalogLevel(value: unknown): value is CatalogLevel {
  return typeof value === 'string' && levelIds.has(value as CatalogLevel);
}

export function categoryLabel(category: CatalogCategory): string {
  return CATALOG_CATEGORIES.find((entry) => entry.id === category)?.label ?? category;
}

export function levelLabel(level: CatalogLevel): string {
  return CATALOG_LEVELS.find((entry) => entry.id === level)?.label ?? level;
}

export function durationBucketFor(durationSec: number): DurationBucket {
  const minutes = durationSec / 60;
  if (minutes < 45) return 'under-45';
  if (minutes < 75) return '45-75';
  if (minutes <= 120) return '75-120';
  return 'over-120';
}

export function createCatalogEntries(workouts: readonly CatalogWorkout[]): CatalogEntry[] {
  return workouts.map((workout) => {
    const metrics = catalogWorkoutMetrics(workout);
    return { workout, metrics, bucket: durationBucketFor(metrics.durationSec) };
  });
}

/** List entries without long descriptions, for pages that only show cards. */
export function createCatalogListEntries(workouts: readonly CatalogWorkout[]): CatalogEntry[] {
  return createCatalogEntries(workouts).map((entry) => ({ ...entry, workout: { ...entry.workout, description: '' } }));
}

export function findCatalogWorkout(workouts: readonly CatalogWorkout[], slug: string): CatalogWorkout | null {
  return workouts.find((workout) => workout.slug === slug) ?? null;
}

function fold(value: string): string {
  return value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Every whitespace-separated term must appear in the name, summary, tags or category. */
export function matchesCatalogSearch(workout: CatalogWorkout, q: string): boolean {
  const terms = fold(q).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = fold([workout.name, workout.summary, workout.tags.join(' '), categoryLabel(workout.category), workout.category].join(' '));
  return terms.every((term) => haystack.includes(term));
}

export function filterCatalog(entries: readonly CatalogEntry[], query: CatalogQuery): CatalogEntry[] {
  const tags = query.tags.map(fold);
  const filtered = entries.filter(({ workout, metrics, bucket }) =>
    (query.categories.length === 0 || query.categories.includes(workout.category))
    && (query.levels.length === 0 || query.levels.includes(workout.level))
    && (query.durations.length === 0 || query.durations.includes(bucket))
    && (tags.length === 0 || tags.every((tag) => workout.tags.some((candidate) => fold(candidate) === tag)))
    && (query.tssMin === null || metrics.tss >= query.tssMin)
    && (query.tssMax === null || metrics.tss <= query.tssMax)
    && (query.ifMin === null || metrics.intensityFactor >= query.ifMin)
    && (query.ifMax === null || metrics.intensityFactor <= query.ifMax)
    && matchesCatalogSearch(workout, query.q));
  return sortCatalog(filtered, query.sort);
}

export function sortCatalog(entries: readonly CatalogEntry[], sort: CatalogSort): CatalogEntry[] {
  const byName = (left: CatalogEntry, right: CatalogEntry) => left.workout.name.localeCompare(right.workout.name, 'en') || left.workout.slug.localeCompare(right.workout.slug);
  const compare: Record<CatalogSort, (left: CatalogEntry, right: CatalogEntry) => number> = {
    name: byName,
    'duration-asc': (left, right) => left.metrics.durationSec - right.metrics.durationSec || byName(left, right),
    'duration-desc': (left, right) => right.metrics.durationSec - left.metrics.durationSec || byName(left, right),
    'tss-asc': (left, right) => left.metrics.tss - right.metrics.tss || byName(left, right),
    'tss-desc': (left, right) => right.metrics.tss - left.metrics.tss || byName(left, right),
  };
  return [...entries].sort(compare[sort]);
}

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function readParam(source: ParamSource, key: string): string {
  if (source instanceof URLSearchParams) return source.getAll(key).join(',');
  const value = source[key];
  return Array.isArray(value) ? value.join(',') : value ?? '';
}

function readList<T extends string>(source: ParamSource, key: string, accept: (value: string) => value is T): T[] {
  return [...new Set(readParam(source, key).split(',').map((value) => value.trim()).filter(accept))];
}

function readNumber(source: ParamSource, key: string, min: number, max: number): number | null {
  const raw = readParam(source, key).trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min && value <= max ? value : null;
}

/** Reads the library filter state from URL search params; unknown values are dropped. */
export function parseCatalogQuery(source: ParamSource): CatalogQuery {
  const sort = readParam(source, 'sort');
  return {
    q: readParam(source, 'q').trim().slice(0, 80),
    categories: readList(source, 'category', isCatalogCategory),
    levels: readList(source, 'level', isCatalogLevel),
    durations: readList(source, 'duration', (value): value is DurationBucket => bucketIds.has(value as DurationBucket)),
    tags: readList(source, 'tag', (value): value is string => /^[a-z0-9][a-z0-9-]{0,39}$/i.test(value)),
    tssMin: readNumber(source, 'tssMin', 0, 1000),
    tssMax: readNumber(source, 'tssMax', 0, 1000),
    ifMin: readNumber(source, 'ifMin', 0, 3),
    ifMax: readNumber(source, 'ifMax', 0, 3),
    sort: sortIds.has(sort as CatalogSort) ? sort as CatalogSort : 'name',
  };
}

/** Serializes only non-default values, so an unfiltered library has a clean URL. */
export function serializeCatalogQuery(query: CatalogQuery): string {
  const params = new URLSearchParams();
  if (query.q.trim()) params.set('q', query.q.trim());
  if (query.categories.length) params.set('category', query.categories.join(','));
  if (query.levels.length) params.set('level', query.levels.join(','));
  if (query.durations.length) params.set('duration', query.durations.join(','));
  if (query.tags.length) params.set('tag', query.tags.join(','));
  if (query.tssMin !== null) params.set('tssMin', String(query.tssMin));
  if (query.tssMax !== null) params.set('tssMax', String(query.tssMax));
  if (query.ifMin !== null) params.set('ifMin', String(query.ifMin));
  if (query.ifMax !== null) params.set('ifMax', String(query.ifMax));
  if (query.sort !== 'name') params.set('sort', query.sort);
  return params.toString();
}

export function withCatalogQuery(params: URLSearchParams, query: CatalogQuery) {
  const result = new URLSearchParams(params);
  for (const key of ['q', 'category', 'level', 'duration', 'tag', 'tssMin', 'tssMax', 'ifMin', 'ifMax', 'sort']) {
    result.delete(key);
  }
  for (const [key, value] of new URLSearchParams(serializeCatalogQuery(query))) result.set(key, value);
  return result;
}

export function isCatalogQueryFiltered(query: CatalogQuery): boolean {
  return serializeCatalogQuery({ ...query, sort: 'name' }) !== '';
}

export type CatalogFilterChip = { key: string; label: string; remove: Partial<CatalogQuery> };

/** Active narrowing choices other than search and sort, each with the patch that removes it. */
export function listCatalogFilters(query: CatalogQuery): CatalogFilterChip[] {
  const range = (min: number | null, max: number | null, unit: string, format: (value: number) => string) =>
    min !== null && max !== null ? `${unit} ${format(min)}–${format(max)}` : min !== null ? `${unit} ≥ ${format(min)}` : `${unit} ≤ ${format(max!)}`;
  return [
    ...query.categories.map((id) => ({ key: `category:${id}`, label: categoryLabel(id), remove: { categories: query.categories.filter((value) => value !== id) } })),
    ...query.durations.map((id) => ({ key: `duration:${id}`, label: DURATION_BUCKETS.find((bucket) => bucket.id === id)?.label ?? id, remove: { durations: query.durations.filter((value) => value !== id) } })),
    ...query.levels.map((id) => ({ key: `level:${id}`, label: levelLabel(id), remove: { levels: query.levels.filter((value) => value !== id) } })),
    ...query.tags.map((tag) => ({ key: `tag:${tag}`, label: `#${tag}`, remove: { tags: query.tags.filter((value) => value !== tag) } })),
    ...(query.tssMin !== null || query.tssMax !== null ? [{ key: 'tss', label: range(query.tssMin, query.tssMax, 'TSS', String), remove: { tssMin: null, tssMax: null } }] : []),
    ...(query.ifMin !== null || query.ifMax !== null ? [{ key: 'if', label: range(query.ifMin, query.ifMax, 'IF', (value) => value.toFixed(2)), remove: { ifMin: null, ifMax: null } }] : []),
  ];
}
