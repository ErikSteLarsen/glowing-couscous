export type WorkoutBlockDraft = {
  id?: number;
  blockType: string;
  title: string;
  instructions: string;
  sortOrder: number;
};

export type WorkoutBlockRecord = {
  id: number;
  blockType: string;
  title: string;
  instructions: string | null;
  sortOrder: number;
};

export function createEmptyWorkoutBlockDraft(sortOrder = 0, blockType = 'WARMUP'): WorkoutBlockDraft {
  return {
    blockType,
    title: '',
    instructions: '',
    sortOrder,
  };
}

export function normalizeWorkoutBlockDrafts(input: unknown) {
  const values = Array.isArray(input) ? input : [];

  return values.map((block, index) => {
    const item = (block ?? {}) as Record<string, unknown>;
    return {
      id: toNullableInt(item.id) ?? undefined,
      blockType: typeof item.blockType === 'string' ? item.blockType : 'NOTE',
      title: typeof item.title === 'string' ? item.title.trim() : '',
      instructions: typeof item.instructions === 'string' ? item.instructions.trim() : '',
      sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : index,
    } satisfies WorkoutBlockDraft;
  });
}

export function validateWorkoutBlocks(blocks: WorkoutBlockDraft[], allowedTypes: readonly string[]) {
  for (const block of blocks) {
    if (!block.title) {
      return 'Every workout block needs a title.';
    }

    if (!allowedTypes.includes(block.blockType)) {
      return 'Workout block type is invalid.';
    }
  }

  return null;
}

export function addWorkoutBlock(blocks: WorkoutBlockDraft[], blockType = 'NOTE') {
  return [...blocks, createEmptyWorkoutBlockDraft(blocks.length, blockType)];
}

export function updateWorkoutBlock(
  blocks: WorkoutBlockDraft[],
  index: number,
  key: 'blockType' | 'title' | 'instructions',
  value: string,
) {
  return blocks.map((block, blockIndex) => (blockIndex === index ? { ...block, [key]: value } : block));
}

export function removeWorkoutBlock(blocks: WorkoutBlockDraft[], index: number) {
  return blocks
    .filter((_, blockIndex) => blockIndex !== index)
    .map((block, blockIndex) => ({
      ...block,
      sortOrder: blockIndex,
    }));
}

export function serializeWorkoutBlocksForPersistence(blocks: WorkoutBlockDraft[]) {
  return blocks.map((block, index) => ({
    blockType: block.blockType,
    title: block.title,
    instructions: block.instructions || null,
    sortOrder: index,
  }));
}

export function mapWorkoutBlockRecordsToDraft(blocks: WorkoutBlockRecord[]) {
  return blocks.map((block, index) => ({
    id: block.id,
    blockType: block.blockType,
    title: block.title,
    instructions: block.instructions ?? '',
    sortOrder: index,
  } satisfies WorkoutBlockDraft));
}

function toNullableInt(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}
