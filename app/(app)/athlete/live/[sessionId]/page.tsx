import { notFound, redirect } from 'next/navigation';
import { ActionLink, EmptyState, PageShell, Surface, TopBar } from '@/components/ui';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { Stepper } from '@/components/tempo/Stepper';
import { getCurrentUser } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { formatDuration } from '@/lib/format-duration';

export default async function AthleteLivePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const { sessionId } = await params;
  const parsedSessionId = Number(sessionId);
  if (!Number.isInteger(parsedSessionId) || parsedSessionId <= 0) {
    notFound();
  }

  const detail = await athleteService.loadSessionDetail(user.id, parsedSessionId);
  if (!detail) {
    return (
      <PageShell size="wide">
        <EmptyState title="Live session unavailable" description="This session could not be loaded for live execution." />
      </PageShell>
    );
  }

  return (
    <PageShell size="wide">
      <TopBar
        eyebrow="Live"
        title={`Execute ${detail.session.title}`}
        description="A mobile-friendly stepper that walks through each block in order."
        actions={<ActionLink href={`/athlete/session/${detail.session.id}`} tone="secondary">Back to session</ActionLink>}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Surface className="space-y-4">
          <SessionBlockBar segments={detail.session.segments} />
          <Stepper
            items={detail.session.blocks.map((block, index) => ({
              id: block.id,
              title: `${block.label} · ${formatDuration(block.durationSec)}`,
              detail: [block.targetLabel, block.note].filter(Boolean).join(' · ') || 'Stay smooth and controlled.',
              active: index === 0,
              done: false,
            }))}
          />
        </Surface>

        <div className="space-y-4">
          <Surface>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Session total</p>
            <p className="mt-3 text-[20px] font-semibold text-[var(--text)]">{formatDuration(detail.session.durationSec)}</p>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{detail.session.blocks.length} blocks</p>
          </Surface>
          <Surface>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Coach cue</p>
            <p className="mt-3 text-[13px] leading-[1.55] text-[var(--text-secondary)]">
              Keep the effort aligned with the target labels and move through each step in order.
            </p>
          </Surface>
        </div>
      </div>
    </PageShell>
  );
}
