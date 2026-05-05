import { ActionLink, PageShell, Surface, TopBar } from '@/components/ui';

export default function HomePage() {
  return (
    <PageShell>
      <TopBar
        eyebrow="Demo entry"
        title="Workout Planner"
        description="A week-based planning tool for coaches and athletes, built to replace spreadsheet planning with a cleaner workflow."
        actions={
          <>
            <ActionLink href="/coach">Open coach view</ActionLink>
            <ActionLink href="/athlete" tone="secondary">
              Open athlete view
            </ActionLink>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Surface>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Coach experience</p>
          <h2 className="mt-3 text-xl font-semibold text-white">Dashboard + athlete planning status</h2>
          <p className="mt-2 text-sm text-slate-300">
            Start from athlete list, open a planner, create sessions from scratch or from templates, and structure a week without juggling spreadsheets.
          </p>
        </Surface>
        <Surface>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Athlete experience</p>
          <h2 className="mt-3 text-xl font-semibold text-white">Weekly plan with simple completion feedback</h2>
          <p className="mt-2 text-sm text-slate-300">
            Weekly note, daily sessions, structured workout blocks, and a lightweight done-plus-notes feedback loop.
          </p>
        </Surface>
      </div>
    </PageShell>
  );
}
