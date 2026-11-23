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
