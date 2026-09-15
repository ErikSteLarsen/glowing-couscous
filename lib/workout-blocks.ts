import type { TempoBlock } from './tempo-blocks.ts';

export type ExpandedTempoBlock = TempoBlock & { sourceIndex: number; occurrence: number; key: string };

export function expandRepeatedBlocks<T extends TempoBlock>(blocks: T[]): Array<T & ExpandedTempoBlock> {
  return blocks.flatMap((block, sourceIndex) => Array.from({ length: block.reps ?? 1 }, (_, occurrence) => ({
    ...block,
    reps: 1,
    sourceIndex,
    occurrence,
    key: block.reps && block.reps > 1 ? `${block.kind}-${sourceIndex}-${occurrence}` : `${block.kind}-${sourceIndex}`,
  })));
}

export function repeatBlockSelection<T>(blocks: T[], selectedIndexes: number[], times: number): T[] {
  const ordered = [...new Set(selectedIndexes)].sort((left, right) => left - right);
  if (!ordered.length || !Number.isInteger(times) || times < 1) return blocks;
  const insertionIndex = ordered[ordered.length - 1] + 1;
  const copies = Array.from({ length: times }, () => ordered.map((index) => ({ ...blocks[index] }))).flat();
  return [...blocks.slice(0, insertionIndex), ...copies, ...blocks.slice(insertionIndex)];
}
