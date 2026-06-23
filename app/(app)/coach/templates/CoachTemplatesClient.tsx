'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  EmptyState,
  dangerTextClassName,
  formFieldClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  successTextClassName,
  Surface,
} from '@/components/ui';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { MetricText } from '@/components/tempo/MetricText';
import { deriveSessionMetrics } from '@/lib/session-math';
import { getSportLabel } from '@/lib/sport';

type TemplateRecord = {
  id: number;
  sport: string;
  name: string;
  summary: string | null;
  blocks: Array<{
    id: number;
    kind: string;
    zone: number;
    durationSec: number;
    reps: number | null;
    targetType: string | null;
    targetLow: number | null;
    targetHigh: number | null;
    note: string | null;
    sortOrder: number;
  }>;
};

function formatDuration(durationSec: number) {
  const hours = Math.floor(durationSec / 3600);
  const minutes = Math.round((durationSec % 3600) / 60);
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}m`;
}

export function CoachTemplatesClient({ templates }: { templates: TemplateRecord[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filterText, setFilterText] = useState('');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');

  const visibleTemplates = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    return templates.filter((template) => {
      if (!query) return true;
      return (
        template.name.toLowerCase().includes(query) ||
        (template.summary ?? '').toLowerCase().includes(query)
      );
    });
  }, [filterText, templates]);

  function duplicateTemplate(templateId: number) {
    setMessage('');
    setMessageTone('success');
    startTransition(async () => {
      const response = await fetch(`/api/coach/templates/${templateId}/duplicate`, { method: 'POST' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Failed to duplicate template' }));
        setMessageTone('danger');
        setMessage(payload.error ?? 'Failed to duplicate template');
        return;
      }

      setMessageTone('success');
      setMessage('Template duplicated.');
      router.refresh();
    });
  }

  function deleteTemplate(templateId: number) {
    setMessage('');
    setMessageTone('success');
    startTransition(async () => {
      const response = await fetch(`/api/coach/templates/${templateId}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Failed to delete template' }));
        setMessageTone('danger');
        setMessage(payload.error ?? 'Failed to delete template');
        return;
      }

      setMessageTone('success');
      setMessage('Template deleted.');
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
          className={formFieldClassName}
          placeholder="Filter templates"
        />
        <a
          href="/coach/builder"
          className={primaryButtonClassName}
        >
          New template in builder
        </a>
      </div>

      {message ? <p className={messageTone === 'success' ? successTextClassName : dangerTextClassName}>{message}</p> : null}

      {visibleTemplates.length === 0 ? (
        <EmptyState title="No templates found" description="Try another filter or create a new builder template." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {visibleTemplates.map((template) => {
            const metrics = deriveSessionMetrics(
              template.blocks.map((block) => ({
                kind: block.kind as 'warmup' | 'work' | 'recovery' | 'cooldown',
                zone: block.zone as 1 | 2 | 3 | 4 | 5,
                durationSec: block.durationSec,
                reps: block.reps,
                target:
                  block.targetType && block.targetLow !== null && block.targetHigh !== null
                    ? {
                        type: block.targetType as 'power' | 'pace' | 'hr',
                        low: block.targetLow,
                        high: block.targetHigh,
                      }
                    : null,
              })),
            );

            return (
              <Surface key={template.id} className="space-y-4">
                <div className="space-y-2">
                  <p className="text-[13px] font-semibold text-[var(--text)]">{template.name}</p>
                  <p className="text-[12px] text-[var(--text-secondary)]">
                    {getSportLabel(template.sport)}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {template.summary || 'No summary yet.'}
                  </p>
                </div>
                <SessionBlockBar segments={metrics.segments} />
                <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
                  <MetricText>{formatDuration(metrics.durationSec)}</MetricText>
                  <MetricText>{metrics.tss} TSS</MetricText>
                </div>
                <div className="flex flex-wrap gap-3">
                  <a
                    href={`/coach/builder?templateId=${template.id}`}
                    className={primaryButtonClassName}
                  >
                    Load into builder
                  </a>
                  <button
                    type="button"
                    onClick={() => duplicateTemplate(template.id)}
                    disabled={isPending}
                    className={secondaryButtonClassName}
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTemplate(template.id)}
                    disabled={isPending}
                    className="min-h-11 rounded-[10px] border border-[#FAD8BE] bg-[#FEEDE0] px-4 text-sm font-semibold text-[#B45516]"
                  >
                    Delete
                  </button>
                </div>
              </Surface>
            );
          })}
        </div>
      )}
    </div>
  );
}
