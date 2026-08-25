'use client';

import { useState } from 'react';

import {
  addSessionEditorBlock,
  createSessionEditorBlock,
  deriveSessionEditorMetrics,
  moveSessionEditorBlock,
  removeSessionEditorBlock,
  updateSessionEditorBlock,
  updateSessionEditorFields,
  updateSessionEditorSchedule,
  type SessionEditorDraft,
  type SessionEditorTarget,
} from '@/lib/session-editor';
import { TEMPO_ZONE_META, type TempoBlockKind, type TempoZone } from '@/lib/tempo-blocks';
import { getSportLabel, SPORT_OPTIONS } from '@/lib/sport';
import { formatDuration } from '@/lib/format-duration';
import {
  formFieldClassName,
  formSelectClassName,
  formTextareaClassName,
  secondaryButtonClassName,
} from '@/components/ui';
import { MetricText } from '@/components/tempo/MetricText';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';

const blockKinds: readonly TempoBlockKind[] = ['warmup', 'work', 'recovery', 'cooldown'];
const targetTypes: readonly SessionEditorTarget['type'][] = ['power', 'pace', 'hr'];

export function SessionComposer({
  draft,
  onChange,
  showSportMetrics = false,
  showSchedule = false,
  summaryPlaceholder = 'Coach notes or session intent',
  durationUnit = 'seconds',
}: {
  draft: SessionEditorDraft;
  onChange: (draft: SessionEditorDraft) => void;
  showSportMetrics?: boolean;
  showSchedule?: boolean;
  summaryPlaceholder?: string;
  durationUnit?: 'minutes' | 'seconds';
}) {
  const [selectedBlockIndex, setSelectedBlockIndex] = useState(0);
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);
  const metrics = deriveSessionEditorMetrics(draft);
  const selectedBlock = draft.blocks[selectedBlockIndex] ?? draft.blocks[0];
  const selectedIndex = selectedBlock ? draft.blocks.indexOf(selectedBlock) : -1;

  function updateBlock(index: number, patch: Parameters<typeof updateSessionEditorBlock>[2]) {
    onChange(updateSessionEditorBlock(draft, index, patch));
  }

  function removeSelectedBlock() {
    if (selectedIndex < 0) return;
    onChange(removeSessionEditorBlock(draft, selectedIndex));
    setSelectedBlockIndex(Math.max(0, selectedIndex - 1));
  }

  function duplicateSelectedBlock() {
    if (selectedIndex < 0) return;
    const source = draft.blocks[selectedIndex];
    const copy = createSessionEditorBlock({ ...source, id: null, clientId: undefined });
    onChange({
      ...draft,
      blocks: [...draft.blocks.slice(0, selectedIndex + 1), copy, ...draft.blocks.slice(selectedIndex + 1)],
    });
    setSelectedBlockIndex(selectedIndex + 1);
  }

  function moveBlock(fromIndex: number, toIndex: number) {
    onChange(moveSessionEditorBlock(draft, fromIndex, toIndex));
    setSelectedBlockIndex(toIndex);
  }

  function updateTarget(index: number, field: 'low' | 'high', value: string) {
    if (!selectedBlock?.target) return;
    onChange(
      updateSessionEditorBlock(draft, index, {
        target: {
          ...selectedBlock.target,
          [field]: value === '' ? 0 : Number(value),
        },
      }),
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[var(--text-secondary)]">Session title</span>
          <input
            className={formFieldClassName}
            value={draft.title}
            placeholder="Session title"
            onChange={(event) => onChange(updateSessionEditorFields(draft, { title: event.target.value }))}
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[var(--text-secondary)]">Sport</span>
          <select
            className={formSelectClassName}
            value={draft.sport}
            onChange={(event) => onChange(updateSessionEditorFields(draft, { sport: event.target.value }))}
          >
            {SPORT_OPTIONS.map((sport) => (
              <option key={sport} value={sport}>
                {getSportLabel(sport)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-[var(--text-secondary)]">Summary</span>
        <textarea
          className={formTextareaClassName}
          value={draft.summary}
          placeholder={summaryPlaceholder}
          onChange={(event) => onChange(updateSessionEditorFields(draft, { summary: event.target.value }))}
        />
      </label>

      {showSchedule ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Scheduled date</span>
            <input
              className={formFieldClassName}
              type="date"
              value={draft.scheduledDate ?? ''}
              onChange={(event) => onChange(updateSessionEditorSchedule(draft, { scheduledDate: event.target.value || null }))}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Time</span>
            <input
              className={formFieldClassName}
              type="time"
              value={draft.timeLabel ?? ''}
              onChange={(event) => onChange(updateSessionEditorSchedule(draft, { timeLabel: event.target.value || null }))}
            />
          </label>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Workout blocks</p>
        <MetricText>{formatDuration(metrics.durationSec)} · {metrics.tss} TSS</MetricText>
      </div>

      <SessionBlockBar segments={metrics.segments} />

      <div className="space-y-3">
        {draft.blocks.map((block, index) => {
          const zoneMeta = TEMPO_ZONE_META[block.zone];
          return (
            <button
              key={block.clientId}
              type="button"
              draggable
              onDragStart={(event) => {
                setDraggedBlockIndex(index);
                event.dataTransfer.setData('text/plain', String(index));
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const fromIndex = Number(event.dataTransfer.getData('text/plain'));
                moveBlock(fromIndex, index);
                setDraggedBlockIndex(null);
              }}
              onDragEnd={() => setDraggedBlockIndex(null)}
              onClick={() => setSelectedBlockIndex(index)}
              className={`w-full rounded-[12px] border p-4 text-left transition ${
                selectedIndex === index
                  ? 'border-[#DCE0D2] bg-[var(--brand-tint)]'
                  : 'border-[var(--border)] bg-[#FBFAF7]'
              } ${block.skipped ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold capitalize text-[var(--text)]">
                    {block.kind}{block.skipped ? ' · skipped' : ''}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{block.note || zoneMeta.name}</p>
                </div>
                <MetricText>{formatDuration(block.durationSec)}</MetricText>
              </div>
              <div
                className="mt-3 h-2 rounded-full"
                style={{
                  background: zoneMeta.solid,
                  width: `${Math.max(18, Math.min(100, (block.durationSec / Math.max(metrics.durationSec, 1)) * 100))}%`,
                }}
              />
            </button>
          );
        })}
        {draggedBlockIndex !== null ? (
          <p className="text-xs text-[var(--text-muted)]">Drop the block where it belongs.</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        {blockKinds.map((kind) => (
          <button
            key={kind}
            type="button"
            className={secondaryButtonClassName}
            onClick={() => {
              const next = addSessionEditorBlock(draft, { kind, zone: kind === 'recovery' ? 1 : 3 });
              onChange(next);
              setSelectedBlockIndex(next.blocks.length - 1);
            }}
          >
            Add {kind}
          </button>
        ))}
      </div>

      {selectedBlock ? (
        <div className="space-y-4 border-t border-[var(--border)] pt-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Inspector</p>
            <h3 className="mt-2 text-base font-semibold text-[var(--text)]">Tune selected block</h3>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Block type</span>
            <select
              className={formSelectClassName}
              value={selectedBlock.kind}
              onChange={(event) => updateBlock(selectedIndex, { kind: event.target.value as TempoBlockKind })}
            >
              {blockKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              Duration ({durationUnit})
            </span>
            <input
              className={formFieldClassName}
              type="number"
              min="1"
              value={durationUnit === 'minutes' ? Math.round(selectedBlock.durationSec / 60) : selectedBlock.durationSec}
              onChange={(event) =>
                updateBlock(selectedIndex, {
                  durationSec: Number(event.target.value) * (durationUnit === 'minutes' ? 60 : 1),
                })
              }
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Intensity zone</span>
            <input
              className={formFieldClassName}
              type="range"
              min="1"
              max="5"
              value={selectedBlock.zone}
              onChange={(event) => updateBlock(selectedIndex, { zone: Number(event.target.value) as TempoZone })}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Repetitions</span>
            <input
              className={formFieldClassName}
              type="number"
              min="1"
              step="1"
              value={selectedBlock.reps ?? ''}
              onChange={(event) => updateBlock(selectedIndex, { reps: event.target.value === '' ? null : Number(event.target.value) })}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Target type</span>
            <select
              className={formSelectClassName}
              value={selectedBlock.target?.type ?? ''}
              onChange={(event) => {
                const type = event.target.value as SessionEditorTarget['type'] | '';
                updateBlock(selectedIndex, {
                  target: type
                    ? { type, low: selectedBlock.target?.low ?? 0, high: selectedBlock.target?.high ?? 0 }
                    : null,
                });
              }}
            >
              <option value="">No target</option>
              {targetTypes.map((targetType) => <option key={targetType} value={targetType}>{targetType}</option>)}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-2">
              <span className="text-xs text-[var(--text-secondary)]">Target low</span>
              <input
                className={formFieldClassName}
                type="number"
                min="0"
                value={selectedBlock.target?.low ?? ''}
                onChange={(event) => updateTarget(selectedIndex, 'low', event.target.value)}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs text-[var(--text-secondary)]">Target high</span>
              <input
                className={formFieldClassName}
                type="number"
                min="0"
                value={selectedBlock.target?.high ?? ''}
                onChange={(event) => updateTarget(selectedIndex, 'high', event.target.value)}
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Block note</span>
            <textarea
              className={formTextareaClassName}
              value={selectedBlock.note}
              placeholder="Block cue or instructions"
              onChange={(event) => updateBlock(selectedIndex, { note: event.target.value })}
            />
          </label>

          <label className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={selectedBlock.skipped}
              onChange={(event) => updateBlock(selectedIndex, { skipped: event.target.checked })}
            />
            Mark block as skipped
          </label>

          <div className="grid grid-cols-2 gap-3">
            <button type="button" className={secondaryButtonClassName} onClick={duplicateSelectedBlock}>Copy block</button>
            <button type="button" className={secondaryButtonClassName} onClick={removeSelectedBlock}>Remove</button>
          </div>
        </div>
      ) : null}

      {showSportMetrics ? (
        <div className="space-y-3 border-t border-[var(--border)] pt-5">
          <p className="text-sm font-semibold text-[var(--text)]">Sport metrics</p>
          <MetricField
            label="FTP (watts)"
            value={draft.sportMetrics.ftp}
            onChange={(value) => onChange(updateSessionEditorFields(draft, { sportMetrics: { ...draft.sportMetrics, ftp: value } }))}
          />
          <MetricField
            label="Threshold pace (sec/km)"
            value={draft.sportMetrics.thresholdPaceSecPerKm}
            onChange={(value) => onChange(updateSessionEditorFields(draft, { sportMetrics: { ...draft.sportMetrics, thresholdPaceSecPerKm: value } }))}
          />
          <MetricField
            label="Threshold HR (bpm)"
            value={draft.sportMetrics.thresholdHr}
            onChange={(value) => onChange(updateSessionEditorFields(draft, { sportMetrics: { ...draft.sportMetrics, thresholdHr: value } }))}
          />
        </div>
      ) : null}
    </div>
  );
}

function MetricField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-[var(--text-secondary)]">{label}</span>
      <input
        className={formFieldClassName}
        type="number"
        min="0"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
      />
    </label>
  );
}
