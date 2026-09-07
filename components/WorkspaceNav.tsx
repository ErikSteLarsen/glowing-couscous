import Link from 'next/link';

type WorkspaceNavProps = {
  role: 'COACH' | 'ATHLETE';
  active: 'workouts' | 'planner' | 'templates' | 'calendar';
};

const copy = {
  workouts: { label: 'Workouts', description: 'Create & manage' },
  planner: { label: 'Planner', description: 'Place on dates' },
  templates: { label: 'Templates', description: 'Reuse & assign' },
  calendar: { label: 'Calendar', description: 'See scheduled work' },
} as const;

export function WorkspaceNav({ role, active }: WorkspaceNavProps) {
  const prefix = role === 'COACH' ? '/coach' : '/athlete';
  const items = role === 'COACH'
    ? (['workouts', 'planner', 'templates'] as const)
    : (['workouts', 'planner', 'templates', 'calendar'] as const);

  return (
    <nav aria-label="Training workspace" className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-4">
      {items.map((item) => {
        const isActive = active === item;
        const meta = copy[item];
        return (
          <Link
            key={item}
            href={`${prefix}/${item}`}
            aria-current={isActive ? 'page' : undefined}
            className={`min-h-11 min-w-[132px] rounded-[10px] border px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] ${
              isActive
                ? 'border-[var(--field-selected-border)] bg-[var(--brand-tint)] text-[var(--field-selected-text)]'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--field-focus)] hover:text-[var(--text)]'
            }`}
          >
            <span className="block text-[13px] font-semibold">{meta.label}</span>
            <span className="mt-0.5 block text-[11px]">{meta.description}</span>
          </Link>
        );
      })}
    </nav>
  );
}
