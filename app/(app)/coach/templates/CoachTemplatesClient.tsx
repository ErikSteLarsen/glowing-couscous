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
import { getSportLabel, SPORT_OPTIONS } from '@/lib/sport';

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

type TemplateDraftBlock = {
  kind: 'warmup' | 'work' | 'recovery' | 'cooldown';
  zone: number;
  durationSec: number;
  reps: number | null;
  targetType: 'power' | 'pace' | 'hr' | null;
  targetLow: number | null;
  targetHigh: number | null;
  note: string;
};

const emptyBlock = (): TemplateDraftBlock => ({
  kind: 'work',
  zone: 3,
  durationSec: 900,
  reps: null,
  targetType: null,
  targetLow: null,
  targetHigh: null,
  note: '',
});

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
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [editorName, setEditorName] = useState('');
  const [editorSport, setEditorSport] = useState('RUNNING');
  const [editorSummary, setEditorSummary] = useState('');
  const [editorBlocks, setEditorBlocks] = useState<TemplateDraftBlock[]>([emptyBlock()]);

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

  function openEditor(template?: TemplateRecord) {
    setEditingTemplateId(template?.id ?? null);
    setEditorName(template?.name ?? '');
    setEditorSport(template?.sport ?? 'RUNNING');
    setEditorSummary(template?.summary ?? '');
    setEditorBlocks(
      template?.blocks.map((block) => ({
        kind: block.kind as TemplateDraftBlock['kind'],
        zone: block.zone,
        durationSec: block.durationSec,
        reps: block.reps,
        targetType: block.targetType as TemplateDraftBlock['targetType'],
        targetLow: block.targetLow,
        targetHigh: block.targetHigh,
        note: block.note ?? '',
      })) ?? [emptyBlock()],
    );
    setEditorOpen(true);
    setMessage('');
  }

  function saveEditor() {
    startTransition(async () => {
      const response = await fetch(
        editingTemplateId ? `/api/coach/templates/${editingTemplateId}` : '/api/coach/templates',
        {
          method: editingTemplateId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editorName, sport: editorSport, summary: editorSummary, blocks: editorBlocks }),
        },
      );
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setMessageTone('danger');
        setMessage(payload.error ?? 'Failed to save template.');
        return;
      }
      setEditorOpen(false);
      setMessageTone('success');
      setMessage(editingTemplateId ? 'Template updated.' : 'Template created.');
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
        <button
          type="button"
          onClick={() => openEditor()}
          className={primaryButtonClassName}
        >
          New template
        </button>
      </div>

      {message ? <p className={messageTone === 'success' ? successTextClassName : dangerTextClassName}>{message}</p> : null}

      {editorOpen ? (
        <Surface className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Tempo editor</p>
              <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">{editingTemplateId ? 'Edit template' : 'Create template'}</h2>
            </div>
            <button type="button" className={secondaryButtonClassName} onClick={() => setEditorOpen(false)}>Cancel</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={formFieldClassName} placeholder="Template name" value={editorName} onChange={(event) => setEditorName(event.target.value)} />
            <select className={formFieldClassName} value={editorSport} onChange={(event) => setEditorSport(event.target.value)}>
              {SPORT_OPTIONS.map((sport) => <option key={sport} value={sport}>{getSportLabel(sport)}</option>)}
            </select>
          </div>
          <textarea className={formFieldClassName} placeholder="Summary" value={editorSummary} onChange={(event) => setEditorSummary(event.target.value)} />
          <div className="space-y-3">
            {editorBlocks.map((block, index) => (
              <div key={index} className="grid gap-2 rounded-[12px] border border-[var(--border)] p-3 sm:grid-cols-[1fr_90px_110px_1.5fr_auto]">
                <select className={formFieldClassName} value={block.kind} onChange={(event) => setEditorBlocks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, kind: event.target.value as TemplateDraftBlock['kind'] } : item))}>
                  {['warmup', 'work', 'recovery', 'cooldown'].map((kind) => <option key={kind} value={kind}>{kind}</option>)}
                </select>
                <input className={formFieldClassName} type="number" min="1" max="5" value={block.zone} onChange={(event) => setEditorBlocks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, zone: Number(event.target.value) } : item))} />
                <input className={formFieldClassName} type="number" min="60" value={block.durationSec} onChange={(event) => setEditorBlocks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, durationSec: Number(event.target.value) } : item))} />
                <input className={formFieldClassName} placeholder="Block note" value={block.note} onChange={(event) => setEditorBlocks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, note: event.target.value } : item))} />
                <button type="button" className={secondaryButtonClassName} onClick={() => setEditorBlocks((current) => current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={secondaryButtonClassName} onClick={() => setEditorBlocks((current) => [...current, emptyBlock()])}>Add block</button>
            <button type="button" className={primaryButtonClassName} disabled={isPending} onClick={saveEditor}>{isPending ? 'Saving…' : 'Save template'}</button>
          </div>
        </Surface>
      ) : null}

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
                    href={`/coach/planner?templateId=${template.id}`}
                    className={primaryButtonClassName}
                   >
                     Load into builder
                   </a>
                   <button type="button" onClick={() => openEditor(template)} disabled={isPending} className={secondaryButtonClassName}>
                     Edit
                   </button>
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
