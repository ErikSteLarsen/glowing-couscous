import { BLOCK_OPTIONS } from '@/lib/planner';
import { WorkoutBlockDraft } from '@/lib/workout-spec';

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
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{title}</p>
          <p className="mt-1 text-sm text-slate-300">{description}</p>
        </div>
        <button type="button" onClick={onAddBlock} className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-sm font-semibold text-slate-200">
          {addLabel}
        </button>
      </div>

      <div className="space-y-3">
        {blocks.map((block, index) => (
          <div key={`${block.blockType}-${index}`} className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="grid gap-3 sm:grid-cols-[0.9fr_1.3fr]">
              <label className="space-y-2 text-sm text-slate-300">
                <span>Type</span>
                <select value={block.blockType} onChange={(event) => onUpdateBlock(index, 'blockType', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#0f1729] px-4 py-3 text-white outline-none">
                  {BLOCK_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Title</span>
                <input value={block.title} onChange={(event) => onUpdateBlock(index, 'title', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#0f1729] px-4 py-3 text-white outline-none" placeholder="Warmup" />
              </label>
            </div>
            <label className="mt-3 block space-y-2 text-sm text-slate-300">
              <span>Instructions</span>
              <textarea value={block.instructions} onChange={(event) => onUpdateBlock(index, 'instructions', event.target.value)} className="min-h-24 w-full rounded-2xl border border-white/10 bg-[#0f1729] px-4 py-3 text-white outline-none" placeholder="15 min easy + 4 strides" />
            </label>
            <button type="button" onClick={() => onRemoveBlock(index)} className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200" disabled={blocks.length === 1}>
              Remove block
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
