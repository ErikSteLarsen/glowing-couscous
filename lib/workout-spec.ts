export type WorkoutBlockDraft = {
  id?: number;
  blockType: string;
  title: string;
  instructions: string;
  sortOrder: number;
};

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
      return 'Every block needs a name.';
    }

    if (!allowedTypes.includes(block.blockType)) {
      return 'One of the blocks has a type TempoBuilder doesn’t recognize.';
    }
  }

  return null;
}

function toNullableInt(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}
