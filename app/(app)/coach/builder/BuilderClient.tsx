'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { format, isValid, parseISO } from 'date-fns';
import { MetricText } from '@/components/tempo/MetricText';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import {
  Badge,
  dangerTextClassName,
  EmptyState,
  formFieldClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  successTextClassName,
  Surface,
} from '@/components/ui';
import { formatDuration } from '@/lib/format-duration';
import { deriveSessionMetrics } from '@/lib/session-math';
import { getSportLabel } from '@/lib/sport';

type BuilderAthlete = {
  id: number;
  name: string;
  email: string;
  compliancePct: number;
  nextSession: string;
};

type BuilderTemplate = {
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

type BuilderClientProps = {
  athletes: BuilderAthlete[];
  templates: BuilderTemplate[];
  initialAthleteId: number | null;
  initialTemplateId: number | null;
  initialScheduledDate: string;
};

export function BuilderClient({
  athletes,
  templates,
  initialAthleteId,
  initialTemplateId,
  initialScheduledDate,
}: BuilderClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filterText, setFilterText] = useState('');
  const [selectedAthleteId, setSelectedAthleteId] = useState<number>(() => {
    if (initialAthleteId && athletes.some((athlete) => athlete.id === initialAthleteId)) {
      return initialAthleteId;
    }

    return athletes[0]?.id ?? 0;
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(() => {
    if (initialTemplateId && templates.some((template) => template.id === initialTemplateId)) {
      return initialTemplateId;
    }

    return templates[0]?.id ?? null;
  });
  const [scheduledDate, setScheduledDate] = useState(initialScheduledDate);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');

  const visibleTemplates = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    return templates.filter((template) => {
      if (!query) return true;
      return (
        template.name.toLowerCase().includes(query) ||
        (template.summary ?? '').toLowerCase().includes(query) ||
        getSportLabel(template.sport).toLowerCase().includes(query)
      );
    });
  }, [filterText, templates]);

  const selectedAthlete = athletes.find((athlete) => athlete.id === selectedAthleteId) ?? null;
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null;
  const parsedScheduledDate = parseISO(scheduledDate);
  const hasValidScheduledDate = isValid(parsedScheduledDate);
  const selectedMetrics = selectedTemplate
    ? deriveSessionMetrics(
        selectedTemplate.blocks.map((block) => ({
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
      )
    : null;

  function assignTemplate() {
    if (!selectedAthlete || !selectedTemplate) {
      setMessageTone('danger');
      setMessage('Choose an athlete and a template first.');
      return;
    }

    if (!hasValidScheduledDate) {
      setMessageTone('danger');
      setMessage('Choose a valid scheduled date before assigning the template.');
      return;
    }

    setMessage('');
    startTransition(async () => {
      const response = await fetch('/api/coach/assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          athleteId: selectedAthlete.id,
          templateId: selectedTemplate.id,
          scheduledDate,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Failed to assign template' }));
        setMessageTone('danger');
        setMessage(payload.error ?? 'Failed to assign template');
        return;
      }

      setMessageTone('success');
      setMessage(`Assigned ${selectedTemplate.name} to ${selectedAthlete.name}.`);
      router.refresh();
    });
  }

  if (athletes.length === 0) {
    return (
      <EmptyState
        title="No athletes available for assignment"
        description="Add an athlete to your roster before using the Tempo builder."
      />
    );
  }

  if (templates.length === 0) {
    return (
      <EmptyState
        title="No templates ready yet"
        description="Create a template in the library first, then return here to assign it."
      />
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr_0.95fr]">
      <Surface className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Assignment target</p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">Choose athlete and date</h2>
          </div>
          <Badge tone="brand">{athletes.length} athletes</Badge>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[var(--text-secondary)]">Scheduled date</span>
          <input
            type="date"
            value={scheduledDate}
            onChange={(event) => setScheduledDate(event.target.value)}
            className={formFieldClassName}
          />
        </label>

        <div className="space-y-3">
          {athletes.map((athlete) => (
            <button
              key={athlete.id}
              type="button"
              onClick={() => setSelectedAthleteId(athlete.id)}
              className={`w-full rounded-[12px] border p-4 text-left transition ${
                athlete.id === selectedAthleteId
                  ? 'border-[#DCE0D2] bg-[var(--brand-tint)]'
                  : 'border-[var(--border)] bg-[#FBFAF7] hover:border-[#D6D1C7]'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text)]">{athlete.name}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{athlete.email}</p>
                </div>
                <Badge tone={athlete.compliancePct >= 80 ? 'success' : 'warning'}>
                  {athlete.compliancePct}%
                </Badge>
              </div>
              <p className="mt-3 text-sm text-[var(--text-secondary)]">{athlete.nextSession}</p>
            </button>
          ))}
        </div>
      </Surface>

      <Surface className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Template library</p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">Select the planned session</h2>
          </div>
          <Badge>{templates.length} templates</Badge>
        </div>

        <input
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
          className={formFieldClassName}
          placeholder="Filter templates"
        />

        <div className="space-y-3">
          {visibleTemplates.length > 0 ? (
            visibleTemplates.map((template) => {
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
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={`w-full rounded-[12px] border p-4 text-left transition ${
                    template.id === selectedTemplateId
                      ? 'border-[#DCE0D2] bg-[var(--brand-tint)]'
                      : 'border-[var(--border)] bg-[#FBFAF7] hover:border-[#D6D1C7]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">{template.name}</p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{getSportLabel(template.sport)}</p>
                    </div>
                    <Badge>{metrics.tss} TSS</Badge>
                  </div>
                  <p className="mt-3 text-sm text-[var(--text-secondary)]">{template.summary || 'No summary yet.'}</p>
                  <div className="mt-4">
                    <SessionBlockBar segments={metrics.segments} compact />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm text-[var(--text-secondary)]">
                    <MetricText>{formatDuration(metrics.durationSec)}</MetricText>
                    <MetricText>{metrics.segments.length} blocks</MetricText>
                  </div>
                </button>
              );
            })
          ) : (
            <EmptyState title="No templates match this filter" description="Try a different term or clear the filter." />
          )}
        </div>
      </Surface>

      <Surface className="space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Assignment preview</p>
          <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">Ready to assign</h2>
        </div>

        {selectedTemplate && selectedAthlete && selectedMetrics ? (
          <>
            <div className="rounded-[12px] bg-[#FBFAF7] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-[var(--text)]">{selectedTemplate.name}</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{getSportLabel(selectedTemplate.sport)}</p>
                </div>
                <Badge tone="brand">{hasValidScheduledDate ? format(parsedScheduledDate, 'EEE d MMM') : 'Choose date'}</Badge>
              </div>
              <p className="mt-3 text-sm text-[var(--text-secondary)]">
                {selectedTemplate.summary || 'Template has no summary yet.'}
              </p>
              <div className="mt-4">
                <SessionBlockBar segments={selectedMetrics.segments} />
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-[var(--text-secondary)]">
                <MetricText>{formatDuration(selectedMetrics.durationSec)}</MetricText>
                <MetricText>{selectedMetrics.tss} TSS</MetricText>
              </div>
            </div>

            <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-sm font-semibold text-[var(--text)]">{selectedAthlete.name}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{selectedAthlete.email}</p>
              <p className="mt-3 text-sm text-[var(--text-secondary)]">Next session: {selectedAthlete.nextSession}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={assignTemplate}
                disabled={isPending || !hasValidScheduledDate}
                className={primaryButtonClassName}
              >
                Assign template
              </button>
              <a href="/coach/templates" className={secondaryButtonClassName}>
                Open template library
              </a>
              <a href={selectedAthlete ? `/coach/athletes/${selectedAthlete.id}` : '/coach'} className={secondaryButtonClassName}>
                Open athlete detail
              </a>
            </div>

            {message ? (
              <p className={messageTone === 'success' ? successTextClassName : dangerTextClassName}>
                {message}
              </p>
            ) : null}
          </>
        ) : (
          <EmptyState
            title="Select a template to preview"
            description="Pick a template from the library column to review it and assign it."
          />
        )}
      </Surface>
    </div>
  );
}
