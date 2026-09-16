import { BLOCK_OPTIONS } from '@/lib/planner';
import { WorkoutBlockDraft } from '@/lib/workout-spec';
import { compactSecondaryButtonClassName, dangerButtonClassName, formFieldClassName, formLabelClassName, formSelectClassName, formTextareaClassName } from '@/components/ui';

type WorkoutBlocksEditorProps = {
  title: string;
  description: string;
  blocks: WorkoutBlockDraft[];
  onAddBlock: () => void;
  onUpdateBlock: (index: number, key: 'blockType' | 'title' | 'instructions', value: string) => void;
  onRemoveBlock: (index: number) => void;
  addLabel?: string;
};

export function WorkoutBlocksEditor({
  title,
  description,
  blocks,
  onAddBlock,
  onUpdateBlock,
  onRemoveBlock,
  addLabel = 'Add block',
}: WorkoutBlocksEditorProps) {
  return (
    <div className="space-y-3 rounded-[12px] border border-[var(--border)] bg-[var(--field-surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-[var(--text)]">{title}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
        </div>
        <button
          type="button"
          onClick={onAddBlock}
          className={compactSecondaryButtonClassName}
        >
          {addLabel}
        </button>
      </div>

      <div className="space-y-3">
        {blocks.map((block, index) => (
          <div key={`${block.blockType}-${index}`} className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="grid gap-3 sm:grid-cols-[0.9fr_1.3fr]">
              <label className="block space-y-2">
                <span className={formLabelClassName}>Type</span>
                <select value={block.blockType} onChange={(event) => onUpdateBlock(index, 'blockType', event.target.value)} className={formSelectClassName}>
                  {BLOCK_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2">
                <span className={formLabelClassName}>Title</span>
                <input value={block.title} onChange={(event) => onUpdateBlock(index, 'title', event.target.value)} className={formFieldClassName} placeholder="Warmup" />
              </label>
            </div>
            <label className="mt-3 block space-y-2">
              <span className={formLabelClassName}>Instructions</span>
                <textarea value={block.instructions} onChange={(event) => onUpdateBlock(index, 'instructions', event.target.value)} className={`${formTextareaClassName} min-h-24`} placeholder="15 min easy + 4 strides" />
            </label>
            <button type="button" onClick={() => onRemoveBlock(index)} className={`mt-3 ${dangerButtonClassName}`} disabled={blocks.length === 1}>
              Remove block
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
