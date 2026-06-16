import { format } from 'date-fns';
import { Badge } from '@/components/ui';
import { getSportLabel } from '@/lib/sport';

type SessionCardProps = {
  session: {
    title: string;
    summary: string | null;
    sportType: string;
    durationMinutes: number | null;
    intensity: string | null;
    scheduledDate: Date;
    blocks?: Array<{
      id: number;
      blockType: string;
      title: string;
      instructions: string | null;
    }>;
    completion?: {
      isDone: boolean;
      notes: string | null;
      completedAt: Date | null;
    } | null;
  };
  compact?: boolean;
};

export function SessionCard({ session, compact = false }: SessionCardProps) {
  const sportLabel = getSportLabel(session.sportType);

  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{sportLabel}</Badge>
            {session.intensity ? <Badge>{session.intensity}</Badge> : null}
            {session.completion?.isDone ? <Badge tone="success">Done</Badge> : null}
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{session.title}</h3>
            <p className="mt-1 text-sm text-slate-300">{session.summary || 'Detailed instructions open in the session panel.'}</p>
          </div>
        </div>
        <div className="text-right text-sm text-slate-300">
          <p>{format(session.scheduledDate, 'HH:mm')}</p>
          {session.durationMinutes ? <p>{session.durationMinutes} min</p> : null}
        </div>
      </div>

      {!compact && session.blocks?.length ? (
        <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
          {session.blocks.map((block) => (
            <div key={block.id} className="rounded-xl bg-black/10 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">{block.title}</p>
                <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{block.blockType.replaceAll('_', ' ')}</span>
              </div>
              {block.instructions ? <p className="mt-1 text-sm text-slate-300">{block.instructions}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      {!compact && session.completion?.notes ? (
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          Athlete note: {session.completion.notes}
        </div>
      ) : null}
    </article>
  );
}
