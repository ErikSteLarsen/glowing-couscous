'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  compactDangerButtonClassName,
  compactPrimaryButtonClassName,
  compactSecondaryButtonClassName,
  EmptyState,
  dangerTextClassName,
  formFieldClassName,
  primaryButtonClassName,
  successTextClassName,
  Surface,
} from '@/components/ui';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { MetricText } from '@/components/tempo/MetricText';
import { SessionComposer } from '@/components/SessionComposer';
import { deriveSessionEditorMetrics, type SessionEditorDraft } from '@/lib/session-editor';
import {
  createEmptyTemplateEditorDraft,
  createTemplateEditorDraftFromRecord,
  serializeTemplateEditorDraftForSave,
} from '@/lib/session-editor-adapters';
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

export function CoachTemplatesClient({
  templates,
  apiBasePath = '/api/coach/templates',
  plannerHref = '/coach/planner',
}: {
  templates: TemplateRecord[];
  apiBasePath?: string;
  plannerHref?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filterText, setFilterText] = useState('');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [editorDraft, setEditorDraft] = useState<SessionEditorDraft>(() => createEmptyTemplateEditorDraft());

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
    });
  }

  function deleteTemplate(templateId: number) {
    setMessage('');
    setMessageTone('success');
    startTransition(async () => {
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
    });
  }

  function openEditor(template?: TemplateRecord) {
    setEditingTemplateId(template?.id ?? null);
    setEditorDraft(template ? createTemplateEditorDraftFromRecord(template) : createEmptyTemplateEditorDraft());
    setEditorOpen(true);
    setMessage('');
  }

  function saveEditor() {
    startTransition(async () => {
      const response = await fetch(
        editingTemplateId ? `${apiBasePath}/${editingTemplateId}` : apiBasePath,
        {
          method: editingTemplateId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(serializeTemplateEditorDraftForSave(editorDraft)),
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
            <button type="button" className={compactSecondaryButtonClassName} onClick={() => setEditorOpen(false)}>Cancel</button>
          </div>
          <SessionComposer
            draft={editorDraft}
            onChange={setEditorDraft}
            summaryPlaceholder="Summary"
          />
          <div className="flex flex-wrap gap-3">
            <button type="button" className={compactPrimaryButtonClassName} disabled={isPending} onClick={saveEditor}>{isPending ? 'Saving…' : 'Save template'}</button>
          </div>
        </Surface>
      ) : null}

      {visibleTemplates.length === 0 ? (
        <EmptyState title="No templates found" description="Try another filter or create a template." />
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
                    href={`${plannerHref}?templateId=${template.id}`}
                    className={compactPrimaryButtonClassName}
                  >
                    Load into builder
                  </a>
                   <button type="button" onClick={() => openEditor(template)} disabled={isPending} className={compactSecondaryButtonClassName}>
                     Edit
                   </button>
                  <button
                    type="button"
                    onClick={() => duplicateTemplate(template.id)}
                    disabled={isPending}
                    className={compactSecondaryButtonClassName}
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTemplate(template.id)}
                    disabled={isPending}
                    className={compactDangerButtonClassName}
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
