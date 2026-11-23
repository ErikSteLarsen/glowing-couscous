'use client';

import { createContext, useContext, useId, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Surface, buttonFocusClassName, formSelectClassName, sectionHeadingClassName } from '@/components/ui';
import { WorkoutProfile } from '@/components/WorkoutProfile';
import { formatDurationExact } from '@/lib/format-duration';
import { structureBlockLabel } from '@/lib/session-structure';
import type { WorkoutProfileBlock, WorkoutProfileModel } from '@/lib/workout-profile';

export type SessionStructureBlock = WorkoutProfileBlock & {
  id: number;
  label: string;
  reps: number | null;
  targetLabel: string | null;
  note: string | null;
  skipped: boolean;
};

type Selection = { block: number; step: number | null } | null;

const SelectionContext = createContext<{
  selection: Selection;
  select: (selection: NonNullable<Selection>) => void;
  detailsOpen: boolean;
  setDetailsOpen: (open: boolean) => void;
  panelId: string;
} | null>(null);

function useSelection() {
  const context = useContext(SelectionContext);
  if (!context) throw new Error('Session structure parts must be inside SessionStructureProvider.');
  return context;
}

/**
 * Shares the selected step between the overview profile and the Block details panel,
 * which sit in different grid cells so logging can come between them on small screens.
 */
export function SessionStructureProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<Selection>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const panelId = useId();
  return (
    <SelectionContext.Provider value={{
      selection,
      select: (next) => { setSelection(next); setDetailsOpen(true); },
      detailsOpen,
      setDetailsOpen,
      panelId,
    }}>
      {children}
    </SelectionContext.Provider>
  );
}

export function SessionWorkoutProfileCard({ model, header, ftpWatts, title, className }: {
  model: WorkoutProfileModel<SessionStructureBlock>;
  header: ReactNode;
  ftpWatts: number | null;
  title: string;
  className?: string;
}) {
  const { selection, select, panelId } = useSelection();
  return (
    <Surface className={`min-w-0 space-y-4 ${className ?? ''}`}>
      {header}
      {model.steps.length ? (
        <>
          <WorkoutProfile
            model={model}
            ftpWatts={ftpWatts}
            label={`${title} workout profile`}
            selectedStep={selection?.step ?? null}
            onSelectStep={(step) => select({ block: model.steps[step].blockIndex, step })}
            controlsId={panelId}
          />
          <p className="text-[12px] text-[var(--text-secondary)]">
            Select an effort or pause to see its targets and notes.
            {model.skippedCount ? ` ${model.skippedCount} skipped ${model.skippedCount === 1 ? 'block is' : 'blocks are'} left out of the profile.` : ''}
          </p>
        </>
      ) : <p className="text-[13px] text-[var(--text-secondary)]">{model.blocks.length ? 'Every block in this session is skipped.' : 'This session has no workout blocks.'}</p>}
    </Surface>
  );
}

function chipStyle(block: Pick<SessionStructureBlock, 'kind' | 'zone'>): CSSProperties {
  if (block.kind === 'pause') return { backgroundColor: 'var(--sunken)', color: 'var(--text-secondary)' };
  const zone = Math.min(Math.max(block.zone, 1), 5);
  return { backgroundColor: `var(--color-zone-${zone}-tint)`, color: 'var(--text)' };
}

export function SessionBlockDetails({ model, className }: { model: WorkoutProfileModel<SessionStructureBlock>; className?: string }) {
  const { selection, select, detailsOpen, setDetailsOpen, panelId } = useSelection();
  const selectorId = useId();
  if (!model.blocks.length) return null;
  const block = selection ? model.blocks[selection.block] : null;
  const step = selection?.step !== null && selection?.step !== undefined ? model.steps[selection.step] : null;

  function chooseBlock(index: number) {
    const first = model.steps.findIndex((candidate) => candidate.blockIndex === index);
    select({ block: index, step: first >= 0 ? first : null });
  }

  return (
    <Surface className={`space-y-4 ${className ?? ''}`}>
      <button type="button" onClick={() => setDetailsOpen(!detailsOpen)} aria-expanded={detailsOpen} aria-controls={panelId}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-[6px] text-left hover:bg-[var(--raised)] ${buttonFocusClassName}`}>
        <span className={sectionHeadingClassName}>Block details</span>
        <ChevronDown size={18} className={`shrink-0 text-[var(--text-secondary)] ${detailsOpen ? 'rotate-180' : ''}`} />
      </button>
      <div id={panelId} hidden={!detailsOpen}>
        <div className="space-y-4 border-t border-[var(--border)] pt-4">
          <div>
            <label htmlFor={selectorId} className="block text-[12px] font-medium text-[var(--text-secondary)]">Inspect a block</label>
            <select id={selectorId} className={`mt-2 ${formSelectClassName}`} value={selection?.block ?? ''} onChange={(event) => chooseBlock(Number(event.target.value))}>
              {block ? null : <option value="" disabled>Choose a block</option>}
              {model.blocks.map((candidate, index) => <option key={candidate.id} value={index}>{index + 1}. {structureBlockLabel(candidate)}</option>)}
            </select>
          </div>
          {block ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex min-h-7 items-center rounded-full px-3 text-[12px] font-semibold" style={chipStyle(block)}>{block.kind === 'pause' ? 'Pause' : block.label}</span>
                {step?.repetition ? <span className="metric-text text-[12px] font-medium text-[var(--text-secondary)]">Rep {step.repetition.index} of {step.repetition.of}</span> : null}
                {block.skipped ? <span className="text-[12px] font-medium text-[var(--text-secondary)]">Skipped in plan</span> : null}
              </div>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><dt className="text-[12px] text-[var(--text-secondary)]">Duration</dt><dd className="metric-text mt-1 text-[13px] font-semibold text-[var(--text)]">{formatDurationExact(block.durationSec * (block.reps ?? 1))}{block.reps && block.reps > 1 ? ` (${block.reps} × ${formatDurationExact(block.durationSec)})` : ''}</dd></div>
                <div><dt className="text-[12px] text-[var(--text-secondary)]">Target</dt><dd className="mt-1 break-words text-[13px] font-semibold text-[var(--text)]">{block.targetLabel || 'No target set'}{block.targetBasis && block.targetBasis !== block.targetLabel ? <span className="mt-1 block text-[12px] font-normal text-[var(--text-secondary)]">{block.targetBasis} · uses your Profile</span> : null}</dd></div>
              </dl>
              {block.note ? <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[var(--text)]">{block.note}</p> : null}
              <p className="text-[12px] text-[var(--text-secondary)]">Read-only scheduled copy</p>
            </>
          ) : <p className="text-[13px] text-[var(--text-secondary)]">Select a step in the workout profile, or choose a block above.</p>}
        </div>
      </div>
    </Surface>
  );
}
