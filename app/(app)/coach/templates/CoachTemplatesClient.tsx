'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Badge,
  compactDangerButtonClassName,
  compactSecondaryButtonClassName,
  dangerButtonClassName,
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
import { deriveSessionEditorMetrics, validateSessionEditorDraft, type SessionEditorDraft } from '@/lib/session-editor';
import {
  createEmptyTemplateEditorDraft,
  createTemplateEditorDraftFromRecord,
  serializeTemplateEditorDraftForSave,
  type PlannerEditorTemplateRecord,
} from '@/lib/session-editor-adapters';
import { formatDuration } from '@/lib/format-duration';
import type { PerformanceProfile } from '@/lib/performance-profile';
import { getSportLabel } from '@/lib/sport';
import { readApiErrorMessage, readCreatedSourceId } from '@/lib/api-response';
import { getTemplateCadence, TEMPLATE_CADENCES, templateCadenceMeta, type TemplateCadence } from '@/lib/template-cadence';

type TemplateRecord = PlannerEditorTemplateRecord & {
  cadence?: string | null;
};

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
  const [savedTemplateId, setSavedTemplateId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [editorCadence, setEditorCadence] = useState<TemplateCadence>('day');
  const [editorDraft, setEditorDraft] = useState<SessionEditorDraft>(() => createEmptyTemplateEditorDraft());
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
    setSavedTemplateId(null);
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
    setSavedTemplateId(null);
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
    if (isPending) return;
    setSavedTemplateId(null);
    setEditingTemplateId(template?.id ?? null);
    setEditorCadence(getTemplateCadence(template?.cadence));
    setEditorDraft(template ? createTemplateEditorDraftFromRecord(template) : createEmptyTemplateEditorDraft());
    setEditorOpen(true);
    setIsDirty(false);
    setConfirmDiscard(false);
    setMessage('');
  }

  function closeEditor() {
    if (isPending) return;
    if (isDirty) {
      setConfirmDiscard(true);
      return;
    }
    setEditorOpen(false);
    setMessage('');
  }

  function saveEditor() {
    if (isPending) return;
    const validationError = !editorDraft.title.trim()
      ? 'Template name is required.'
      : validateSessionEditorDraft(editorDraft);
    if (validationError) {
      setMessageTone('danger');
      setMessage(validationError);
      return;
    }
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
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          setMessageTone('danger');
          setMessage(readApiErrorMessage(payload, 'Failed to save template.'));
          return;
        }
        setSavedTemplateId(isAthlete && !editingTemplateId ? readCreatedSourceId(payload, 'templateId') : null);
        setEditorOpen(false);
        setIsDirty(false);
        setConfirmDiscard(false);
        setFilterText('');
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
    <div className="min-w-0 space-y-5">
      {!editorOpen ? (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="min-w-0 flex-1 space-y-2">
          <span className={formLabelClassName}>Find a template</span>
          <input
            type="search"
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
            className={formFieldClassName}
            placeholder="Search by name or summary"
          />
        </label>
        <button
          type="button"
          onClick={() => openEditor()}
          className={primaryButtonClassName}
          disabled={isPending}
        >
          New template
        </button>
      </div>
      ) : null}

      {message ? (
        <div role={messageTone === 'danger' ? 'alert' : 'status'} aria-live="polite" className={messageTone === 'success' ? successTextClassName : dangerTextClassName}>
          <p>{message}</p>
          {isAthlete && savedTemplateId ? (
            <Link href={`${plannerHref}?source=template:${savedTemplateId}`} className={`${compactSecondaryButtonClassName} mt-2 min-h-11`}>
              Plan this template
            </Link>
          ) : null}
        </div>
      ) : null}

      {editorOpen ? (
        <Surface className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
            <h2 className="text-lg font-medium text-[var(--text)]">{editingTemplateId ? 'Edit template' : 'Create template'}</h2>
            <button type="button" className={compactSecondaryButtonClassName} onClick={closeEditor} disabled={isPending}>Back to templates</button>
          </div>
          {confirmDiscard ? (
            <div role="alert" className="space-y-3 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-tint)] p-4">
              <p className="text-sm text-[var(--text)]">Discard unsaved changes to this template?</p>
              <div className="flex flex-wrap gap-3">
                <button type="button" className={secondaryButtonClassName} disabled={isPending} onClick={() => setConfirmDiscard(false)}>Keep editing</button>
                <button type="button" className={dangerButtonClassName} disabled={isPending} onClick={() => { setEditorOpen(false); setConfirmDiscard(false); setIsDirty(false); setMessage(''); }}>Discard changes</button>
              </div>
            </div>
          ) : null}
          <fieldset disabled={isPending} className="min-w-0 space-y-4">
          <WorkoutBuilder
            draft={editorDraft}
            onChange={(next) => { setEditorDraft(next); setIsDirty(true); setMessage(''); }}
            titleLabel="Template name"
            summaryLabel="Template summary"
            summaryPlaceholder="What is this template for?"
            performanceProfile={performanceProfile}
          />
          <label className="block space-y-2">
            <span className={formLabelClassName}>Template cadence</span>
            <select className={formSelectClassName} value={editorCadence} onChange={(event) => { setEditorCadence(getTemplateCadence(event.target.value)); setIsDirty(true); setMessage(''); }}>
              {TEMPLATE_CADENCES.map((cadence) => <option key={cadence} value={cadence}>{templateCadenceMeta[cadence].label}</option>)}
            </select>
            <span className="block text-[12px] text-[var(--text-secondary)]">{templateCadenceMeta[editorCadence].assignment}</span>
          </label>
          </fieldset>
          <div className="sticky bottom-[var(--mobile-nav-clearance)] z-10 -mx-5 flex flex-wrap gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-3 md:bottom-0">
            <button type="button" className={primaryButtonClassName} disabled={isPending || confirmDiscard} onClick={saveEditor}>{isPending ? 'Saving…' : 'Save template'}</button>
          </div>
        </Surface>
      ) : null}

       {!editorOpen ? visibleTemplates.length === 0 ? (
        <EmptyState title={templates.length === 0 ? 'No templates yet' : 'No templates found'} description={templates.length === 0 ? 'Create a reusable workout and choose its placement span in Planner.' : 'Try another name or summary.'} action={templates.length > 0 ? <button type="button" className={secondaryButtonClassName} onClick={() => setFilterText('')}>Clear search</button> : undefined} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {visibleTemplates.map((template) => {
            const metrics = deriveSessionEditorMetrics(createTemplateEditorDraftFromRecord(template));

            return (
              <Surface key={template.id} className="min-w-0 space-y-4">
                <div className="space-y-2">
                  <h2 className="break-words text-base font-medium text-[var(--text)] [overflow-wrap:anywhere]">{template.name}</h2>
                  <p className="text-[13px] text-[var(--text-secondary)]">
                    {getSportLabel(template.sport)}
                  </p>
                  <Badge>{templateCadenceMeta[getTemplateCadence(template.cadence)].shortLabel}</Badge>
                  <p className="break-words text-sm text-[var(--text-secondary)] [overflow-wrap:anywhere]">
                    {template.summary || 'No summary yet.'}
                  </p>
                </div>
                <SessionBlockBar segments={metrics.segments} />
                <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
                  <MetricText>{formatDuration(metrics.durationSec)}</MetricText>
                  <MetricText>{metrics.tss} TSS</MetricText>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={isAthlete ? `${plannerHref}?source=template:${template.id}` : plannerHref}
                    className={`${compactSecondaryButtonClassName} min-h-11`}
                  >
                     {isAthlete ? 'Plan this' : 'Use in Planner'}
                  </Link>
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
      ) : null}
    </div>
  );
}
