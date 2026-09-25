import { createSessionEditorBlock, type SessionEditorBlock } from './session-editor.ts';

export function createPauseBlock(seconds: number): SessionEditorBlock {
  return createSessionEditorBlock({ kind: 'pause', zone: 1, durationSec: seconds, reps: null, target: null, note: '' });
}

export function repeatPatternWithPauses(
  blocks: SessionEditorBlock[],
  selectedIds: string[],
  count: number,
  pauseSeconds: number,
): SessionEditorBlock[] {
  const selected = blocks.filter((block) => selectedIds.includes(block.clientId));
  if (!selected.some((block) => block.kind !== 'pause') || count < 2) return blocks;
  const end = blocks.findLastIndex((block) => selectedIds.includes(block.clientId)) + 1;
  const copies: SessionEditorBlock[] = [];
  for (let repeat = 1; repeat < count; repeat += 1) {
    if (pauseSeconds > 0) copies.push(createPauseBlock(pauseSeconds));
    copies.push(...selected.map((block) => createSessionEditorBlock({ ...block, clientId: '', id: null })));
  }
  return [...blocks.slice(0, end), ...copies, ...blocks.slice(end)];
}

export function insertPauseAfterSelection(blocks: SessionEditorBlock[], selectedIds: string[], seconds: number): SessionEditorBlock[] {
  const end = blocks.findLastIndex((block) => selectedIds.includes(block.clientId)) + 1;
  if (!end || end === blocks.length || blocks[end - 1].kind === 'pause' || blocks[end].kind === 'pause') return blocks;
  return [...blocks.slice(0, end), createPauseBlock(seconds), ...blocks.slice(end)];
}

export function insertPauseBeforeSelection(blocks: SessionEditorBlock[], selectedIds: string[], seconds: number): SessionEditorBlock[] {
  const start = blocks.findIndex((block) => selectedIds.includes(block.clientId));
  if (start <= 0 || blocks[start - 1].kind === 'pause' || blocks[start].kind === 'pause') return blocks;
  return [...blocks.slice(0, start), createPauseBlock(seconds), ...blocks.slice(start)];
}
