import { formatDurationExact } from './format-duration.ts';

export type StructureBlock = {
  id: number;
  kind: string;
  zone: number;
  durationSec: number;
  reps: number | null;
  targetLabel: string | null;
  targetBasis?: string | null;
  note: string | null;
  skipped: boolean;
};

export type SessionStructureGroup = {
  blocks: StructureBlock[];
  pattern: StructureBlock[];
  repeats: number;
  recoveryCount: number;
};

function equivalent(a: StructureBlock, b: StructureBlock) {
  return a.kind === b.kind && a.zone === b.zone && a.durationSec === b.durationSec
    && (a.reps ?? 1) === (b.reps ?? 1) && a.targetLabel === b.targetLabel
    && (a.targetBasis ?? '') === (b.targetBasis ?? '')
    && (a.note ?? '') === (b.note ?? '') && a.skipped === b.skipped;
}

function recovery(block: StructureBlock) {
  return block.kind === 'pause' || block.kind === 'recovery';
}

// Only identical, consecutive instructions are folded; every original block
// remains available to inspect. Never infer missing warm-ups or recoveries.
export function groupSessionStructure(blocks: StructureBlock[]): SessionStructureGroup[] {
  const groups: SessionStructureGroup[] = [];
  for (let start = 0; start < blocks.length;) {
    const first = blocks[start];
    const pause = blocks[start + 1];
    let end = start + 1;
    let repeats = 1;
    let recoveryCount = 0;
    if (first.kind === 'work' && pause && recovery(pause) && !first.skipped && !pause.skipped) {
      while (end + 1 < blocks.length && equivalent(pause, blocks[end]) && equivalent(first, blocks[end + 1])) {
        end += 2;
        repeats += 1;
        recoveryCount += 1;
      }
      if (repeats > 1 && end < blocks.length && equivalent(pause, blocks[end])) {
        end += 1;
        recoveryCount += 1;
      }
    }
    if (repeats > 1) {
      groups.push({ blocks: blocks.slice(start, end), pattern: [first, pause], repeats, recoveryCount });
    } else {
      // Fold repeated multi-step sets too, keeping their full pattern visible.
      let bestWidth = 1;
      let bestCount = 1;
      for (let width = 1; width <= Math.floor((blocks.length - start) / 2); width += 1) {
        const pattern = blocks.slice(start, start + width);
        if (pattern.some((block) => block.skipped || block.kind === 'warmup' || block.kind === 'cooldown')) continue;
        let count = 1;
        while (start + (count + 1) * width <= blocks.length
          && pattern.every((block, offset) => equivalent(block, blocks[start + count * width + offset]))) count += 1;
        if (count > 1 && width * (count - 1) > bestWidth * (bestCount - 1)) {
          bestWidth = width;
          bestCount = count;
        }
      }
      end = start + bestWidth * bestCount;
      groups.push({ blocks: blocks.slice(start, end), pattern: blocks.slice(start, start + bestWidth), repeats: bestCount, recoveryCount: 0 });
    }
    start = end;
  }
  return groups;
}

export function structureBlockLabel(block: StructureBlock) {
  const kind = block.kind === 'warmup' ? 'Warm-up' : block.kind === 'cooldown' ? 'Cool-down'
    : block.kind === 'pause' ? 'Pause' : block.kind === 'recovery' ? 'Recovery' : `Zone ${block.zone}`;
  const duration = formatDurationExact(block.durationSec);
  return `${block.reps && block.reps > 1 ? `${block.reps} × ` : ''}${duration} ${kind.toLowerCase()}${block.skipped ? ' (skipped)' : ''}`;
}

export function describeStructureGroup(group: SessionStructureGroup) {
  if (group.recoveryCount) {
    return `${group.repeats} × ${structureBlockLabel(group.pattern[0])}, ${structureBlockLabel(group.pattern[1])} ${group.recoveryCount === group.repeats ? 'after each effort' : 'between efforts'}`;
  }
  const pattern = group.pattern.map(structureBlockLabel).join(' + ');
  return group.repeats > 1 ? `${group.repeats} × (${pattern})` : pattern;
}
