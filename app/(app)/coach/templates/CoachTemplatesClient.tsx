'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  compactDangerButtonClassName,
  compactPrimaryButtonClassName,
  compactSecondaryButtonClassName,
  EmptyState,
  dangerTextClassName,
  formFieldClassName,
  formLabelClassName,
  formSelectClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  successTextClassName,
  Surface,
} from '@/components/ui';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { MetricText } from '@/components/tempo/MetricText';
import { WorkoutBuilder } from '@/components/WorkoutBuilder';
import { ShareLinkButton } from '@/components/ShareLinkButton';
import { deriveSessionEditorMetrics, type SessionEditorDraft } from '@/lib/session-editor';
import {
  createEmptyTemplateEditorDraft,
  createTemplateEditorDraftFromRecord,
  serializeTemplateEditorDraftForSave,
} from '@/lib/session-editor-adapters';
import { getSportLabel } from '@/lib/sport';
import { getTemplateCadence, TEMPLATE_CADENCES, templateCadenceMeta, type TemplateCadence } from '@/lib/template-cadence';
import type { PerformanceProfile } from '@/lib/performance-profile';

type TemplateRecord = {
  id: number;
  sport: string;
  name: string;
  summary: string | null;
  cadence?: string | null;
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

export function CoachTemplatesClient({
  templates,
  apiBasePath = '/api/coach/templates',
  plannerHref = '/coach/planner',
  role = 'COACH',
  performanceProfile = null,
}: {
  templates: TemplateRecord[];
  apiBasePath?: string;
  plannerHref?: string;
  role?: 'COACH' | 'ATHLETE';
  performanceProfile?: PerformanceProfile | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filterText, setFilterText] = useState('');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [editorCadence, setEditorCadence] = useState<TemplateCadence>('day');
  const [editorDraft, setEditorDraft] = useState<SessionEditorDraft>(() => createEmptyTemplateEditorDraft());
  const workoutsHref = plannerHref.startsWith('/athlete') ? '/athlete/workouts' : '/coach/workouts';
  const isAthlete = role === 'ATHLETE';

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
      try {
        const response = await fetch(`${apiBasePath}/${templateId}/duplicate`, { method: 'POST' });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({ error: 'Failed to duplicate template' }));
          setMessageTone('danger');
          setMessage(payload.error ?? 'Failed to duplicate template');
          return;
        }

        setMessageTone('success');
        setMessage('Template duplicated.');
        router.refresh();
      } catch {
        setMessageTone('danger');
        setMessage('Could not reach the server. Check your connection and try again.');
      }
    });
  }

  function deleteTemplate(templateId: number) {
    setMessage('');
    setMessageTone('success');
    if (!window.confirm('Delete this template? This cannot be undone.')) return;
    startTransition(async () => {
      try {
        const response = await fetch(`${apiBasePath}/${templateId}`, { method: 'DELETE' });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({ error: 'Failed to delete template' }));
          setMessageTone('danger');
          setMessage(payload.error ?? 'Failed to delete template');
          return;
        }

        setMessageTone('success');
        setMessage('Template deleted.');
        router.refresh();
      } catch {
        setMessageTone('danger');
        setMessage('Could not reach the server. Check your connection and try again.');
      }
    });
  }

  function openEditor(template?: TemplateRecord) {
    setEditingTemplateId(template?.id ?? null);
    setEditorCadence(getTemplateCadence(template?.cadence));
    setEditorDraft(template ? createTemplateEditorDraftFromRecord(template) : createEmptyTemplateEditorDraft());
    setEditorOpen(true);
    setMessage('');
  }

  function saveEditor() {
    startTransition(async () => {
      try {
        const response = await fetch(
          editingTemplateId ? `${apiBasePath}/${editingTemplateId}` : apiBasePath,
          {
            method: editingTemplateId ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...serializeTemplateEditorDraftForSave(editorDraft), cadence: editorCadence }),
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
      } catch {
        setMessageTone('danger');
        setMessage('Could not reach the server. Check your connection and try again.');
      }
    });
  }

  return (
    <div className={`${editorOpen ? '' : 'page-content--library'} space-y-5`}>
      <div className="rounded-[12px] border border-[var(--field-selected-border)] bg-[var(--brand-tint)] p-5">
        <div className="max-w-2xl">
           <h2 className="text-lg font-semibold text-[var(--text)]">{isAthlete ? 'Build a private template' : 'Build reusable training structure'}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
             {isAthlete ? 'Save a private starting point, then reuse it when you shape your training week.' : 'Create reusable structure here, choose how often it should repeat, then use Planner to place the finished template on a date, week, or month.'}
          </p>
          <a href={workoutsHref} className={`${compactSecondaryButtonClassName} mt-4`}>
            Open Workouts
          </a>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {TEMPLATE_CADENCES.map((cadence) => (
            <div key={cadence} className="rounded-[10px] border border-[var(--field-selected-border)] bg-[var(--surface)] px-3 py-3">
              <p className="text-[13px] font-semibold text-[var(--text)]">{templateCadenceMeta[cadence].label}</p>
              <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">{templateCadenceMeta[cadence].description}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
          className={formFieldClassName}
          placeholder="Filter templates"
          aria-label="Filter templates"
        />
        <button
          type="button"
          onClick={() => openEditor()}
          className={primaryButtonClassName}
        >
          New template
        </button>
      </div>

      {message ? <p role={messageTone === 'danger' ? 'alert' : 'status'} aria-live="polite" className={messageTone === 'success' ? successTextClassName : dangerTextClassName}>{message}</p> : null}

      {editorOpen ? (
        <Surface className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Tempo editor</p>
              <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">{editingTemplateId ? 'Edit template' : 'Create template'}</h2>
            </div>
            <button type="button" className={secondaryButtonClassName} onClick={() => setEditorOpen(false)}>Cancel</button>
          </div>
          <WorkoutBuilder
            draft={editorDraft}
            onChange={setEditorDraft}
            performanceProfile={performanceProfile}
            titleLabel="Template name"
            summaryLabel="Template summary"
            summaryPlaceholder="What is this template for?"
          />
          <label className="block space-y-2">
            <span className={formLabelClassName}>Template cadence</span>
            <select className={formSelectClassName} value={editorCadence} onChange={(event) => setEditorCadence(getTemplateCadence(event.target.value))}>
              {TEMPLATE_CADENCES.map((cadence) => <option key={cadence} value={cadence}>{templateCadenceMeta[cadence].label}</option>)}
            </select>
            <span className="block text-[12px] text-[var(--text-secondary)]">{templateCadenceMeta[editorCadence].assignment}</span>
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={primaryButtonClassName} disabled={isPending} onClick={saveEditor}>{isPending ? 'Saving…' : 'Save template'}</button>
          </div>
        </Surface>
      ) : null}

       {visibleTemplates.length === 0 ? (
        <EmptyState title={templates.length === 0 ? 'No templates yet' : 'No templates found'} description={templates.length === 0 ? (isAthlete ? 'Create a private template to reuse in your week.' : 'Create a template to reuse structured training.') : 'Try another filter or create a template.'} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {visibleTemplates.map((template) => {
            const metrics = deriveSessionEditorMetrics(createTemplateEditorDraftFromRecord(template));

            return (
              <Surface key={template.id} className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[var(--text)]">{template.name}</p>
                  <p className="text-[13px] text-[var(--text-secondary)]">
                    {getSportLabel(template.sport)}
                  </p>
                  <Badge tone="brand">{templateCadenceMeta[getTemplateCadence(template.cadence)].shortLabel}</Badge>
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
                    href={plannerHref}
                    className={compactPrimaryButtonClassName}
                  >
                      {isAthlete ? 'Schedule in Calendar' : 'Use in Planner'}
                  </a>
                  <details className="relative">
                    <summary className={`${compactSecondaryButtonClassName} list-none`}>More actions</summary>
                    <div className="absolute right-0 top-full z-10 mt-2 grid min-w-40 gap-1 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow-overlay)]">
                      <button type="button" onClick={() => openEditor(template)} disabled={isPending} className={compactSecondaryButtonClassName}>Edit</button>
                      <button type="button" onClick={() => duplicateTemplate(template.id)} disabled={isPending} className={compactSecondaryButtonClassName}>Duplicate</button>
                      <button type="button" onClick={() => deleteTemplate(template.id)} disabled={isPending} className={compactDangerButtonClassName}>Delete</button>
                    </div>
                  </details>
                </div>
                <ShareLinkButton sourceKind="template" sourceId={template.id} ariaLabel={`Create a share link for ${template.name}`} />
              </Surface>
            );
          })}
        </div>
      )}
    </div>
  );
}
