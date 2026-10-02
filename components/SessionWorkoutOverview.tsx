'use client';

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { SessionPlanBlock } from './SessionPlanCanvas';
import { getSessionBlockStyle } from './SessionPlanCanvas';
import { Surface, buttonFocusClassName, formSelectClassName, sectionHeadingClassName } from './ui';
import { describeStructureGroup, groupSessionStructure, structureBlockLabel } from '@/lib/session-structure';
import { formatDurationExact } from '@/lib/format-duration';

export function SessionWorkoutOverview({ blocks, header }: { blocks: SessionPlanBlock[]; header?: ReactNode }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const panelId = useId();
  const selectorId = useId();
  const groups = groupSessionStructure(blocks);
  const selected = blocks.find((block) => block.id === selectedId);
  const selectedGroup = groups.find((group) => group.blocks.some((block) => block.id === selectedId));

  function selectBlock(id: number) {
    setSelectedId(id);
    setDetailsOpen(true);
  }

  return <>
    <Surface className="min-w-0 space-y-4">
      {header}
      {blocks.length ? <>
        <p className="max-w-[68ch] text-[13px] leading-relaxed text-[var(--text-secondary)]">
          {groups.map(describeStructureGroup).join(' · ')}.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-4" role="group" aria-label="Workout structure. Select a block for details">
          {groups.map((group) => <div key={group.blocks[0].id} className="min-w-0 flex-[1_1_0px]" style={{ minWidth: `min(100%, ${group.pattern.length * 44 + 4}px)` }}>
            <div className="mb-2 flex min-h-10 items-start justify-between gap-1 text-[12px] font-medium text-[var(--text-secondary)] sm:min-h-5">
              <span>{group.pattern[0].kind === 'warmup' ? 'Warm-up' : group.pattern[0].kind === 'cooldown' ? 'Cool-down' : group.repeats > 1 ? 'Repeated set' : group.pattern[0].kind === 'pause' ? 'Pause' : 'Effort'}</span>
              {group.repeats > 1 ? <span className="metric-text shrink-0 whitespace-nowrap">× {group.repeats}</span> : null}
            </div>
            <div className="flex h-16 items-end gap-1 overflow-x-auto border-b border-[var(--border)] sm:h-20">
              {group.pattern.map((block, index) => {
                const active = selectedGroup === group && selected
                  ? index === group.blocks.findIndex((candidate) => candidate.id === selected.id) % group.pattern.length
                  : false;
                return <button key={block.id} type="button"
                  onClick={() => selectBlock(block.id)} aria-pressed={active} aria-controls={panelId}
                  aria-label={`${structureBlockLabel(block)}${group.repeats > 1 ? `, repeated set of ${group.repeats}` : ''}${block.targetLabel ? `, ${block.targetLabel}` : ''}. Show block details`}
                  className={`group relative flex h-full min-w-11 flex-1 items-end rounded-t-[6px] px-1 pb-1 hover:bg-[var(--field-surface)] ${buttonFocusClassName}`}
                  style={{ flexGrow: Math.max(1, block.durationSec * (block.reps ?? 1)) }}>
                  <span className={`training-chart-bar block w-full border-2 ${active ? 'border-[var(--text)]' : 'border-transparent'} ${block.kind === 'pause' ? 'bg-[var(--text-muted)]' : `ink-zone-${Math.min(5, Math.max(1, block.zone))}`} ${block.skipped ? 'opacity-40' : ''}`}
                    style={{ height: block.kind === 'pause' ? 12 : `${Math.max(24, Math.min(5, Math.max(1, block.zone)) * 18)}%` }} />
                </button>;
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[var(--text-secondary)]">
              {group.pattern.map((block) => <span key={block.id}>{structureBlockLabel(block)}</span>)}
            </div>
          </div>)}
        </div>
        <p className="text-[12px] text-[var(--text-secondary)]">Select an effort or pause to see its targets and notes. Repeated sets are shown once.</p>
      </> : <p className="text-[13px] text-[var(--text-secondary)]">This session has no workout blocks.</p>}
    </Surface>

    {blocks.length ? <Surface className="space-y-4">
      <button type="button" onClick={() => setDetailsOpen(!detailsOpen)} aria-expanded={detailsOpen} aria-controls={panelId}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-[6px] text-left ${buttonFocusClassName}`}>
        <span className={sectionHeadingClassName}>Block details</span>
        <ChevronDown size={18} className={`shrink-0 text-[var(--text-secondary)] ${detailsOpen ? 'rotate-180' : ''}`} />
      </button>
      <div id={panelId} hidden={!detailsOpen}>
        {selected ? <div className="space-y-4 border-t border-[var(--border)] pt-4">
          <div>
            <label htmlFor={selectorId} className="block text-[12px] font-medium text-[var(--text-secondary)]">Inspect a block</label>
            <select id={selectorId} className={`mt-2 ${formSelectClassName}`} value={selected.id} onChange={(event) => selectBlock(Number(event.target.value))}>
              {blocks.map((block, index) => <option key={block.id} value={block.id}>{index + 1}. {structureBlockLabel(block)}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex min-h-7 items-center rounded-full px-3 text-[12px] font-semibold" style={getSessionBlockStyle(selected)}>{selected.kind === 'pause' ? 'Pause' : selected.label}</span>
            {selected.skipped ? <span className="text-[12px] font-medium text-[var(--text-secondary)]">Skipped in plan</span> : null}
          </div>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><dt className="text-[12px] text-[var(--text-secondary)]">Duration</dt><dd className="metric-text mt-1 text-[13px] font-semibold text-[var(--text)]">{formatDurationExact(selected.durationSec * (selected.reps ?? 1))}{selected.reps && selected.reps > 1 ? ` (${selected.reps} × ${formatDurationExact(selected.durationSec)})` : ''}</dd></div>
            <div><dt className="text-[12px] text-[var(--text-secondary)]">Target</dt><dd className="mt-1 break-words text-[13px] font-semibold text-[var(--text)]">{selected.targetLabel || 'No target set'}{selected.targetBasis && selected.targetBasis !== selected.targetLabel ? <span className="mt-1 block text-[12px] font-normal text-[var(--text-secondary)]">{selected.targetBasis} · uses your Profile</span> : null}</dd></div>
          </dl>
          {selectedGroup && selectedGroup.repeats > 1 ? <p className="text-[12px] text-[var(--text-secondary)]">Part of a {selectedGroup.repeats}-repeat set. Use the selector to inspect each original block.</p> : null}
          {selected.note ? <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[var(--text)]">{selected.note}</p> : null}
          <p className="text-[12px] text-[var(--text-secondary)]">Read-only scheduled copy</p>
        </div> : <p className="text-[13px] text-[var(--text-secondary)]">Select a block in the workout overview to inspect it.</p>}
      </div>
    </Surface> : null}
  </>;
}
