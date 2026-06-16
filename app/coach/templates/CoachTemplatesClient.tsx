'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CoachEditorDrawer } from '@/components/CoachEditorDrawer';
import { WorkoutBlocksEditor } from '@/components/WorkoutBlocksEditor';
import { Badge, Surface } from '@/components/ui';
import { createEmptyTemplateDraft, TemplateDraft, templateRecordToDraft } from '@/lib/planner';
import { getSportLabel, SPORT_OPTIONS } from '@/lib/sport';
import { addWorkoutBlock, removeWorkoutBlock, updateWorkoutBlock } from '@/lib/workout-spec';

type TemplateRecord = {
  id: number;
  sportType: string;
  name: string;
  summary: string | null;
  blocks: Array<{
    id: number;
    blockType: string;
    title: string;
    instructions: string | null;
    sortOrder: number;
  }>;
};

type CoachTemplatesClientProps = {
  templates: TemplateRecord[];
};

export function CoachTemplatesClient({ templates }: CoachTemplatesClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [draft, setDraft] = useState<TemplateDraft>(createEmptyTemplateDraft());
  const [errorMessage, setErrorMessage] = useState('');
  const [filterText, setFilterText] = useState('');
  const [sportFilter, setSportFilter] = useState('ALL');

  const visibleTemplates = templates.filter((template) => {
    const normalizedFilter = filterText.trim().toLowerCase();
    const matchesText =
      !normalizedFilter ||
      template.name.toLowerCase().includes(normalizedFilter) ||
      (template.summary ?? '').toLowerCase().includes(normalizedFilter);
    const matchesSport = sportFilter === 'ALL' || template.sportType === sportFilter;
    return matchesText && matchesSport;
  });

  function openCreateDrawer() {
    setMode('create');
    setEditingTemplateId(null);
    setDraft(createEmptyTemplateDraft());
    setErrorMessage('');
    setIsDrawerOpen(true);
  }

  function openEditDrawer(template: TemplateRecord) {
    setMode('edit');
    setEditingTemplateId(template.id);
    setDraft(templateRecordToDraft(template));
    setErrorMessage('');
    setIsDrawerOpen(true);
  }

  function updateDraft<K extends keyof TemplateDraft>(key: K, value: TemplateDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateBlock(index: number, key: 'blockType' | 'title' | 'instructions', value: string) {
    setDraft((current) => ({ ...current, blocks: updateWorkoutBlock(current.blocks, index, key, value) }));
  }

  function addBlock() {
    setDraft((current) => ({ ...current, blocks: addWorkoutBlock(current.blocks) }));
  }

  function removeBlock(index: number) {
    setDraft((current) => ({ ...current, blocks: removeWorkoutBlock(current.blocks, index) }));
  }

  function submitTemplate() {
    setErrorMessage('');
    const url = mode === 'create' ? '/api/coach/templates' : `/api/coach/templates/${editingTemplateId}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';

    startTransition(async () => {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(draft),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Failed to save template' }));
        setErrorMessage(payload.error ?? 'Failed to save template');
        return;
      }

      setIsDrawerOpen(false);
      router.refresh();
    });
  }

  function deleteTemplate() {
    if (!editingTemplateId) {
      return;
    }

    setErrorMessage('');
    startTransition(async () => {
      const response = await fetch(`/api/coach/templates/${editingTemplateId}`, { method: 'DELETE' });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Failed to delete template' }));
        setErrorMessage(payload.error ?? 'Failed to delete template');
        return;
      }

      setIsDrawerOpen(false);
      router.refresh();
    });
  }

  function duplicateTemplate(templateId: number) {
    setErrorMessage('');
    startTransition(async () => {
      const response = await fetch(`/api/coach/templates/${templateId}/duplicate`, { method: 'POST' });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Failed to duplicate template' }));
        setErrorMessage(payload.error ?? 'Failed to duplicate template');
        return;
      }

      router.refresh();
    });
  }

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openCreateDrawer}
          className="rounded-2xl bg-[var(--brand-strong)] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(59,90,245,0.35)]"
        >
          New template
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <input
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white outline-none"
          placeholder="Filter templates by name or summary"
        />
        <select
          value={sportFilter}
          onChange={(event) => setSportFilter(event.target.value)}
          className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white outline-none"
        >
          <option value="ALL">All sports</option>
          {SPORT_OPTIONS.map((sport) => (
            <option key={sport} value={sport}>
              {getSportLabel(sport)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {visibleTemplates.map((template) => (
          <Surface key={template.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-white">{template.name}</h2>
                  <Badge tone="brand">{getSportLabel(template.sportType)}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-300">{template.summary || 'No summary added yet.'}</p>
              </div>
              <Badge>{template.blocks.length} blocks</Badge>
            </div>

            <div className="mt-5 space-y-3">
              {template.blocks.map((block) => (
                <div key={block.id} className="rounded-2xl bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-white">{block.title}</p>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{block.blockType.replaceAll('_', ' ')}</span>
                  </div>
                  {block.instructions ? <p className="mt-2 text-sm text-slate-300">{block.instructions}</p> : null}
                </div>
              ))}
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => openEditDrawer(template)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200"
              >
                Edit template
              </button>
              <button
                type="button"
                onClick={() => duplicateTemplate(template.id)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200"
              >
                Duplicate template
              </button>
            </div>
          </Surface>
        ))}
      </div>

      {visibleTemplates.length === 0 ? (
        <Surface>
          <p className="text-sm text-slate-300">No templates match the current filters.</p>
        </Surface>
      ) : null}

      <CoachEditorDrawer
        isOpen={isDrawerOpen}
        eyebrow="Template editor"
        title={mode === 'create' ? 'Create template' : 'Edit template'}
        description="Templates stay coach-owned and reusable. They prefill the same session editor used in the planner."
        onClose={() => setIsDrawerOpen(false)}
        actions={
          <>
            <button type="button" onClick={submitTemplate} className="rounded-2xl bg-[var(--brand-strong)] px-4 py-2 text-sm font-semibold text-white" disabled={isPending}>
              {mode === 'create' ? 'Create template' : 'Save changes'}
            </button>
            {mode === 'edit' ? (
              <button type="button" onClick={deleteTemplate} className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200" disabled={isPending}>
                Delete template
              </button>
            ) : null}
          </>
        }
      >
        <label className="space-y-2 text-sm text-slate-300">
          <span>Sport</span>
          <select value={draft.sportType} onChange={(event) => updateDraft('sportType', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white outline-none">
            {SPORT_OPTIONS.map((sport) => (
              <option key={sport} value={sport}>
                {sport}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm text-slate-300">
          <span>Name</span>
          <input value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white outline-none" placeholder="Tempo Builder" />
        </label>

        <label className="space-y-2 text-sm text-slate-300">
          <span>Summary</span>
          <textarea value={draft.summary} onChange={(event) => updateDraft('summary', event.target.value)} className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white outline-none" placeholder="Short template summary for reuse" />
        </label>

        <WorkoutBlocksEditor
          title="Template blocks"
          description="These blocks are copied into sessions when the template is used."
          blocks={draft.blocks}
          onAddBlock={addBlock}
          onUpdateBlock={updateBlock}
          onRemoveBlock={removeBlock}
        />

        {errorMessage ? <p className="text-sm text-amber-300">{errorMessage}</p> : null}
      </CoachEditorDrawer>
    </>
  );
}
