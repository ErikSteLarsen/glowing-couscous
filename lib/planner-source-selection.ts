export type PlannerSourceSelection = {
  key: string;
  tab: 'workout' | 'template';
};

export function resolvePlannerSourceSelection(
  value: unknown,
  catalog: { workoutIds: readonly number[]; templateIds: readonly number[]; builtInSlugs?: readonly string[] },
): PlannerSourceSelection | null {
  if (typeof value !== 'string') return null;

  const builtIn = /^built-in-plan:([a-z0-9-]+)$/.exec(value);
  if (builtIn && catalog.builtInSlugs?.includes(builtIn[1])) return { key: value, tab: 'template' };

  const match = /^(workout|template):([1-9]\d*)$/.exec(value);
  if (!match) return null;

  const id = Number(match[2]);
  if (!Number.isSafeInteger(id)) return null;

  const tab = match[1];
  if (tab === 'workout' && catalog.workoutIds.includes(id)) return { key: value, tab };
  if (tab === 'template' && catalog.templateIds.includes(id)) return { key: value, tab };
  return null;
}
